import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { db } from '../database';

const router = Router();

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Australian racing analyst and professional sharp bettor with 20 years of experience. You are highly selective and disciplined.

Core principles:
- DEFAULT TO PASS: genuine betting edge exists in fewer than 1 in 5 races
- Only recommend BET when true probability significantly exceeds implied market probability (+EV ≥ 8%)
- A disciplined PASS is as valuable as a confident BET — never manufacture action
- Always calculate: implied_prob = 100 / decimal_odds. Find runners where true_prob > implied_prob.

Racing intelligence:
- GREYHOUNDS: Box 1-2 win ~35-40% at most Australian tracks; early pace and box record are critical; straight vs turning tracks have different biases
- THOROUGHBREDS: Barrier bias varies by track; class relief (stepping down in class) is the strongest positive signal; 57kg+ weight disadvantages runners; track condition suitability is key
- HARNESS: Inside gate positions heavily advantaged; driver form and track knowledge; mobile vs standing start affects short-priced runners more

Value grading:
- BET: Genuine +EV, true_prob > implied_prob by 8%+, confidence 70%+, stake 1-3% bankroll
- WATCH: Marginal edge, confidence 55-70%, 0.5% max stake
- PASS: No edge found — market correctly priced or overpriced. Give specific reason + what to wait for.
- SKIP: Clear negative EV (odds too short, overcrowded market, no standout)

Return ONLY valid JSON. No markdown, no other text.`;

const EXTRACT_PROMPT = `Extract all visible information from this TAB betting screenshot precisely.

Return ONLY this JSON structure:
{
  "tab_balance": number or null,
  "sport": "horse_racing_thoroughbred" | "horse_racing_harness" | "horse_racing_greyhound" | "nrl" | "afl" | "soccer" | "nba" | "cricket" | "tennis" | "other",
  "event_name": "event name",
  "event_time": "time or null",
  "venue": "venue or null",
  "market_type": "win" | "each_way" | "place" | "head_to_head" | "line" | "total" | "same_game_multi" | "other",
  "track_condition": "Good/Heavy/Soft/Firm or null",
  "distance": number or null,
  "race_number": number or null,
  "runners": [{ "name": "string", "barrier": number|null, "jockey": "string|null", "trainer": "string|null", "weight": number|null, "odds": number, "place_odds": number|null, "form": "string|null" }],
  "home_team": null, "away_team": null, "home_odds": null, "away_odds": null, "draw_odds": null
}`;

function buildResearchPrompt(extracted: object, perfContext: string): string {
  return `You are a sharp professional Australian bettor. Analyze this race data deeply:

${JSON.stringify(extracted, null, 2)}
${perfContext ? `\nRecent performance context:\n${perfContext}` : ''}

Perform expert analysis covering:
1. Form: Each runner's recent results, consistency, suitability to today's distance/track/conditions
2. Barrier/Box: What advantage does this draw offer at this venue? For greyhounds, box 1-2 advantage is critical.
3. Trainer/Jockey: Any standout combinations? Relevant strike rates at this track or distance?
4. Class: Is any runner dropping in class (strong positive) or rising (negative)?
5. Weight: Any significant weight advantage/disadvantage for thoroughbreds?
6. Market: Calculate implied probability (100/odds) for each runner. Where is the market wrong?
7. Conditions: Which runners are suited or unsuited to today's conditions?
8. Pace map: How will the race unfold? Does anyone benefit from the expected run?

For GREYHOUNDS: focus on box draw (box 1-2 wins majority at most AU tracks), early pace speed, and trap-to-trap form.
For THOROUGHBREDS: barrier bias at this specific track, class drops, weight, and conditions suitability are paramount.
For HARNESS: inside gate, driver's track record, mobile vs gate starts.

BE CRITICAL. Default to PASS unless genuine value exists. Identify the single best bet only if genuinely +EV.

Return ONLY this JSON:
{
  "recommendation": {
    "recommendation": "BET" | "WATCH" | "PASS" | "SKIP",
    "bet_type": "win" | "place" | "each_way" | "head_to_head" | "line" | "total" | "quinella" | "exacta" | "trifecta",
    "selection": "runner or team name",
    "confidence_score": 0-100,
    "expected_value": number (-1.0 to 1.0, e.g. 0.12 = 12% edge),
    "suggested_stake_percent": 0-5,
    "professional_verdict": "1-2 sentence sharp summary — the single key insight",
    "reasoning": "Detailed 3-4 paragraph analysis: form breakdown, market assessment, key angles, final call",
    "risk_flags": ["specific risk 1", "specific risk 2"],
    "key_stat": "Single most important stat or insight",
    "pass_reason": "Why there is no value here (required if PASS or SKIP)",
    "wait_for": "Exact conditions that would make this worth betting — e.g. 'odds drift to $4.50+', 'track firms to Good', 'drop back to Class 3' (required if PASS, SKIP, or WATCH)",
    "probability_table": [
      { "runner": "name", "market_odds": number, "implied_prob": number, "true_prob": number, "value_rating": "good" | "fair" | "poor" }
    ]
  }
}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string };
};

function buildImageBlocks(images: Array<{ image: string; mediaType?: string }>): ImageBlock[] {
  return images.slice(0, 6).map(({ image, mediaType = 'image/jpeg' }) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType as string)
        ? mediaType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: image.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function getTextContent(msg: Anthropic.Message): string {
  return msg.content
    .filter(c => c.type === 'text')
    .map(c => (c as { type: 'text'; text: string }).text)
    .join('');
}

async function runTwoStageAnalysis(
  client: Anthropic,
  imageBlocks: ImageBlock[],
  imageCount: number,
  perfContext: string,
) {
  // Stage 1: Vision extraction — pull all structured data from the screenshot(s)
  const extractMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: imageCount > 1
            ? `These are ${imageCount} screenshots of the same TAB page. Extract all visible data.\n\n${EXTRACT_PROMPT}`
            : EXTRACT_PROMPT,
        },
      ],
    }],
  });

  const extracted = extractJson(getTextContent(extractMsg));
  if (!extracted) {
    throw new Error('Could not read betting data from screenshots — try clearer images');
  }

  // Stage 2: Deep research + recommendation (text only, no image tokens needed)
  const researchMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: buildResearchPrompt(extracted, perfContext) }],
    }],
  });

  const research = extractJson(getTextContent(researchMsg));
  if (!research?.recommendation) {
    throw new Error('Analysis incomplete — please try again');
  }

  return { ...extracted, ...research };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/analyse-multi', async (req, res) => {
  try {
    const { images } = req.body as { images: Array<{ image: string; mediaType?: string }> };
    if (!images?.length) return res.status(400).json({ error: 'No images provided' });

    const apiKey = (await db.getSetting('anthropic_api_key')) || config.anthropic.apiKey;
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured — add it in Settings' });

    const client = new Anthropic({ apiKey });
    const imageBlocks = buildImageBlocks(images);
    const perfContext = await db.getScanDraftsPerformanceSummary().catch(() => '');
    const result = await runTwoStageAnalysis(client, imageBlocks, images.length, perfContext);
    res.json({ data: result });
  } catch (err) {
    console.error('Screenshot multi-analysis error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis failed' });
  }
});

router.post('/analyse', async (req, res) => {
  try {
    const { image, mediaType = 'image/jpeg' } = req.body as { image: string; mediaType?: string };
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const apiKey = (await db.getSetting('anthropic_api_key')) || config.anthropic.apiKey;
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured — add it in Settings' });

    const client = new Anthropic({ apiKey });
    const imageBlocks = buildImageBlocks([{ image, mediaType }]);
    const perfContext = await db.getScanDraftsPerformanceSummary().catch(() => '');
    const result = await runTwoStageAnalysis(client, imageBlocks, 1, perfContext);
    res.json({ data: result });
  } catch (err) {
    console.error('Screenshot analysis error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis failed' });
  }
});

export default router;
