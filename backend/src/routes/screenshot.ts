import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { db } from '../database';

const router = Router();

const SYSTEM_PROMPT = `You are EdgeIQ, an expert Australian sports betting and horse racing analyst. A user has shared a TAB (Australia's online betting platform) screenshot. Extract every piece of visible betting information and return a structured recommendation. Be precise with odds — read them exactly as shown. Always return valid JSON only, no other text.`;

const EXTRACT_PROMPT = `Analyze this TAB betting screenshot carefully. Extract ALL visible information including any account balance displayed.

Return ONLY this exact JSON structure (no other text):
{
  "tab_balance": 1250.50 or null (IMPORTANT: if you can see a TAB account balance, wallet balance, or available funds amount anywhere on screen, extract the exact dollar value as a number — look for labels like "Balance", "Available", "Funds", "Wallet"),
  "sport": "horse_racing_thoroughbred" | "horse_racing_harness" | "horse_racing_greyhound" | "nrl" | "afl" | "soccer" | "nba" | "cricket" | "tennis" | "other",
  "event_name": "full event name as shown",
  "event_time": "time as shown on screen or null",
  "venue": "venue name or null",
  "market_type": "win" | "each_way" | "place" | "head_to_head" | "line" | "total" | "same_game_multi" | "other",
  "track_condition": "Good/Heavy/Soft/Firm or null (racing only)",
  "distance": 1200,
  "race_number": 1,
  "runners": [
    {
      "name": "Runner/Team name",
      "barrier": 3 or null,
      "jockey": "jockey name or null",
      "trainer": "trainer name or null",
      "weight": 57.5 or null,
      "odds": 3.50,
      "place_odds": 1.80 or null,
      "form": "x1x21" or null
    }
  ],
  "home_team": "team name or null",
  "away_team": "team name or null",
  "home_odds": 1.95 or null,
  "away_odds": 2.10 or null,
  "draw_odds": null,
  "recommendation": {
    "recommendation": "BET" | "WATCH" | "SKIP",
    "bet_type": "win" | "place" | "each_way" | "head_to_head" | "line" | "total" | "quinella" | "exacta" | "trifecta",
    "selection": "Exact selection name",
    "confidence_score": 72,
    "expected_value": 0.08,
    "suggested_stake_percent": 2.5,
    "reasoning": "Detailed 2-3 paragraph analysis covering form, value, risk factors",
    "risk_flags": ["list", "of", "concerns"],
    "key_stat": "One-liner key insight (e.g. 'Barrier 1 wins 28% at this track')"
  }
}`;

router.post('/analyse', async (req, res) => {
  try {
    const { image, mediaType = 'image/jpeg' } = req.body as {
      image: string;
      mediaType?: string;
    };

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const apiKey = (await db.getSetting('anthropic_api_key')) || config.anthropic.apiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Anthropic API key not configured — add it to Settings' });
    }

    const client = new Anthropic({ apiKey });

    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const safeMediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)
      ? mediaType
      : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: safeMediaType, data: base64 },
            },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const text = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not read betting data from screenshot — try a clearer image' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ data: parsed });
  } catch (err) {
    console.error('Screenshot analysis error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
});

export default router;
