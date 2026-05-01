import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
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

const EXTRACT_PROMPT = `You are reading a screenshot from TAB.com.au. Extract every piece of visible information and return it as JSON.

CRITICAL: Always return valid JSON even if the image is unclear — use null for anything you cannot read.

Return ONLY this exact JSON (no markdown, no explanation, start with { and end with }):
{
  "tab_balance": null,
  "sport": "horse_racing_thoroughbred",
  "event_name": "Race name or event",
  "event_time": "time string or null",
  "venue": "track/venue name or null",
  "market_type": "win",
  "track_condition": "Good or null",
  "distance": 1200,
  "race_number": 1,
  "runners": [
    { "name": "Runner Name", "barrier": 1, "jockey": "J Smith", "trainer": "T Jones", "weight": 56.5, "odds": 3.50, "place_odds": 1.80, "form": "1-2-3" }
  ],
  "home_team": null,
  "away_team": null,
  "home_odds": null,
  "away_odds": null,
  "draw_odds": null
}

Rules:
- sport must be one of: horse_racing_thoroughbred, horse_racing_harness, horse_racing_greyhound, nrl, afl, soccer, nba, cricket, tennis, other
- market_type must be one of: win, each_way, place, head_to_head, line, total, same_game_multi, other
- Extract ALL runners visible — do not skip any
- odds must be a decimal number (e.g. 3.50), not null — estimate if unclear
- For greyhounds: barrier = box number, jockey = null, trainer = box trainer
- For sports markets: fill home_team, away_team, home_odds, away_odds instead of runners`;

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

function extractJson(text: string): Record<string, unknown> | null {
  // Strip markdown code fences that Claude sometimes wraps around JSON
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const jsonStr = match[0];

  // Try 1: direct parse
  try { return JSON.parse(jsonStr); } catch { /* continue */ }

  // Try 2: repair trailing commas before } or ]
  try {
    const repaired = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(repaired);
  } catch { /* continue */ }

  // Try 3: find the last valid closing brace (handles truncated JSON)
  for (let i = jsonStr.length - 1; i >= 0; i--) {
    if (jsonStr[i] === '}') {
      try { return JSON.parse(jsonStr.slice(0, i + 1)); } catch { /* try shorter */ }
    }
  }

  return null;
}

function getTextContent(msg: Anthropic.Message): string {
  return msg.content
    .filter(c => c.type === 'text')
    .map(c => (c as { type: 'text'; text: string }).text)
    .join('');
}

async function runStage2Analysis(
  client: Anthropic,
  extracted: Record<string, unknown>,
  perfContext: string,
): Promise<Record<string, unknown>> {
  const researchMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: buildResearchPrompt(extracted, perfContext) }] }],
  });
  const rawResearch = getTextContent(researchMsg);
  console.log('[Screenshot] Stage2 raw:', rawResearch.slice(0, 300));
  const research = extractJson(rawResearch);
  if (!research?.recommendation) {
    throw new Error('Analysis did not return a recommendation — please try again');
  }
  const inner = research.recommendation as Record<string, unknown> | string;
  const rec = typeof inner === 'string' || !(inner as Record<string, unknown>)?.recommendation
    ? research : inner;
  return { ...extracted, recommendation: rec };
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
    max_tokens: 3000,
    system: 'You extract structured data from betting screenshots. Return ONLY valid JSON. No markdown, no explanation.',
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: imageCount > 1
              ? `These are ${imageCount} screenshots of the same TAB.com.au page. Combine all visible information.\n\n${EXTRACT_PROMPT}`
              : EXTRACT_PROMPT,
          },
        ],
      },
    ],
  });

  const rawExtract = getTextContent(extractMsg);
  console.log('[Screenshot] Stage1 raw:', rawExtract.slice(0, 300));

  let extracted = extractJson(rawExtract);

  // Retry with a minimal prompt if first attempt still failed to parse
  if (!extracted) {
    console.warn('[Screenshot] Stage1 parse failed — retrying with minimal prompt');
    const retryMsg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Extract betting data from the screenshot. Return ONLY valid JSON.',
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: 'Return JSON with: sport, event_name, venue, runners (name, odds), track_condition, distance, race_number. No other text.' },
          ],
        },
      ],
    });
    const rawRetry = getTextContent(retryMsg);
    console.log('[Screenshot] Stage1 retry raw:', rawRetry.slice(0, 300));
    extracted = extractJson(rawRetry);
  }

  if (!extracted) {
    const preview = rawExtract.slice(0, 200).replace(/\n/g, ' ');
    throw new Error(`Could not parse screenshot data — Claude responded: "${preview}". Try a clearer screenshot showing runners and odds.`);
  }

  return await runStage2Analysis(client, extracted, perfContext);
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/analyse-multi', async (req, res) => {
  try {
    const { images } = req.body as { images: Array<{ image: string; mediaType?: string }> };
    if (!images?.length) return res.status(400).json({ error: 'No images provided' });

    const apiKey = await db.getAnthropicApiKey();
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

    const apiKey = await db.getAnthropicApiKey();
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

router.post('/analyse-text', async (req, res) => {
  try {
    const { pageText, pageUrl } = req.body as { pageText: string; pageUrl?: string };
    if (!pageText) return res.status(400).json({ error: 'No page text provided' });

    const apiKey = await db.getAnthropicApiKey();
    if (!apiKey) return res.status(400).json({ error: 'Anthropic API key not configured — add it in Settings' });

    const client = new Anthropic({ apiKey });
    const perfContext = await db.getScanDraftsPerformanceSummary().catch(() => '');

    const extractMsg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: 'You extract structured betting data from TAB.com.au page text. Return ONLY valid JSON. No markdown.',
      messages: [{
        role: 'user',
        content: `URL: ${pageUrl || 'tab.com.au'}\n\nPage text:\n${pageText.slice(0, 8000)}\n\n${EXTRACT_PROMPT}`,
      }],
    });

    const rawExtract = getTextContent(extractMsg);
    console.log('[Screenshot] TextStage1 raw:', rawExtract.slice(0, 300));

    const extracted = extractJson(rawExtract);
    if (!extracted) {
      const preview = rawExtract.slice(0, 200).replace(/\n/g, ' ');
      throw new Error(`Could not parse page data — "${preview}". Try refreshing the page.`);
    }

    const result = await runStage2Analysis(client, extracted, perfContext);
    res.json({ data: result });
  } catch (err) {
    console.error('Text analysis error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis failed' });
  }
});

export default router;
