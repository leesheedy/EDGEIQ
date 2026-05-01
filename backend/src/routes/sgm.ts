/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../database';

const router = Router();

const SGM_SYSTEM = `You are an expert Australian sports betting analyst specialising in Same Game Multi (SGM) bets. You know how to identify correlated outcomes and calculate combined probabilities.

Key principles:
- SGM legs must be from the SAME game (same event)
- Avoid highly correlated legs that inflate the risk (e.g. don't combine "Team A Win" + "Team A +15.5 line" — both likely fail together)
- Low risk: high-probability selections, 2 legs max, combined odds 1.5-2.5
- Medium risk: balanced, 2-3 legs, combined odds 3-7
- Value pick: where you find genuine edge vs the market price
- ALWAYS provide honest confidence scores — if you have limited info, say so
- If no odds are provided, estimate based on your knowledge of the teams/competition

Return ONLY valid JSON.`;

function buildSgmPrompt(events: object[]): string {
  return `Analyze these upcoming Australian sports events and generate Same Game Multi (SGM) recommendations.

Available events:
${JSON.stringify(events, null, 2)}

For each risk tier, pick the SINGLE best game and build an SGM from it.

Markets you can use per sport:
- NRL/AFL: Match Winner, Total Points Over/Under, Winning Margin, First Try Scorer (NRL), First Goal Scorer (AFL)
- Soccer: Match Winner, Both Teams to Score, Total Goals Over/Under, Correct Score
- NBA: Match Winner, Total Points, Player Points Over/Under
- Tennis: Match Winner, Total Games, Set Handicap

Return ONLY this JSON:
{
  "low_risk": {
    "event": "event name",
    "sport": "nrl|afl|soccer|nba|tennis",
    "title": "Safe Double",
    "legs": [
      { "market": "Match Winner", "selection": "Team A", "est_odds": 1.45 },
      { "market": "Total Points Under", "selection": "Under 42.5", "est_odds": 1.75 }
    ],
    "combined_est_odds": 2.10,
    "confidence": 75,
    "reasoning": "2-3 sentences explaining why this is a solid low-risk combination"
  },
  "medium_risk": {
    "event": "event name",
    "sport": "nrl|afl|soccer|nba|tennis",
    "title": "Value Multi",
    "legs": [
      { "market": "Match Winner", "selection": "Team A", "est_odds": 1.80 },
      { "market": "Both Teams to Score", "selection": "Yes", "est_odds": 1.65 },
      { "market": "Total Points Over", "selection": "Over 38.5", "est_odds": 1.90 }
    ],
    "combined_est_odds": 5.60,
    "confidence": 58,
    "reasoning": "2-3 sentences explaining the medium-risk angle and why it represents value"
  },
  "value_pick": {
    "event": "event name",
    "sport": "nrl|afl|soccer|nba|tennis",
    "title": "Best Bet",
    "legs": [
      { "market": "Match Winner", "selection": "Team B", "est_odds": 2.40 }
    ],
    "combined_est_odds": 2.40,
    "confidence": 68,
    "reasoning": "2-3 sentences on why this is the standout value bet",
    "key_insight": "One-liner with the key angle, e.g. 'Team B are 7-1 at home vs top-4 sides'"
  },
  "odds_available": true,
  "note": "Optional caveat — e.g. 'Odds estimates based on recent form, verify on TAB before placing'"
}`;
}

router.post('/generate', async (req, res) => {
  try {
    const apiKey = await db.getAnthropicApiKey();
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured — add it in Settings' });

    // Load current sports events
    const allEvents = await db.getEvents({ limit: 30 });
    const sportsEvents = allEvents.filter(e => !e.sport.startsWith('horse_racing'));

    if (sportsEvents.length === 0) {
      return res.json({
        data: null,
        message: 'No sports events available. Trigger a scrape to load events.',
      });
    }

    const eventsPayload = sportsEvents.slice(0, 10).map(e => ({
      event: e.event_name,
      sport: e.sport,
      time: e.event_time,
      home_team: (e.raw_data as any)?.home_team ?? null,
      away_team: (e.raw_data as any)?.away_team ?? null,
      home_odds: (e.raw_data as any)?.home_odds ?? null,
      draw_odds: (e.raw_data as any)?.draw_odds ?? null,
      away_odds: (e.raw_data as any)?.away_odds ?? null,
    }));

    const hasOdds = eventsPayload.some(e => e.home_odds && e.home_odds > 1);

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: SGM_SYSTEM,
      messages: [{
        role: 'user',
        content: buildSgmPrompt(eventsPayload),
      }],
    });

    const text = message.content.filter(c => c.type === 'text').map(c => (c as any).text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(422).json({ error: 'Failed to generate SGM suggestions' });

    const parsed = JSON.parse(m[0]);
    parsed.odds_available = hasOdds;
    res.json({ data: parsed });
  } catch (err) {
    console.error('SGM generation error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate SGM' });
  }
});

export default router;
