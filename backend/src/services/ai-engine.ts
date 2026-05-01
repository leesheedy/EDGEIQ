import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { db } from '../database';
import type { Event, Analysis, AiRecommendation } from '../types';

const SYSTEM_PROMPT = `You are EdgeIQ, an expert Australian sports betting and horse racing analyst with 20+ years of experience. You have deep knowledge of:

- Australian horse racing (thoroughbred, harness, greyhounds): form reading, track conditions, jockey/trainer statistics, barrier draws, weight impacts, class assessments, speed maps
- Australian sports betting: NRL, AFL, A-League soccer, NBA, cricket, tennis
- Odds markets: TAB (Australia), head-to-head, line betting, totals, exotics, same-game multis
- Value identification: finding positive expected value (+EV) situations where the market has mispriced the probability
- Kelly criterion staking for optimal bankroll management
- Risk management: identifying when NOT to bet is as important as finding value

Your analysis must be rigorous, data-driven, and honest about uncertainty. Never recommend a bet without genuine edge. Be concise but thorough. Always return valid JSON.`;

function buildRacingPrompt(event: Event, performanceSummary: string): string {
  const d = event.raw_data;
  const e = event.enriched_data || {};
  const runners = d.runners || [];

  const runnersStr = runners
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (Barrier: ${r.barrier || 'N/A'}, Jockey: ${r.jockey || 'N/A'}, Trainer: ${r.trainer || 'N/A'}, Weight: ${r.weight || 'N/A'}kg, Win odds: $${r.odds}, Form: ${(r.form || []).join('-') || 'N/A'})`
    )
    .join('\n');

  return `RACING ANALYSIS REQUEST

Event: ${event.event_name}
Time: ${new Date(event.event_time).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
Venue: ${d.venue || 'Unknown'}
Track Condition: ${d.track_condition || 'Unknown'}
Distance: ${d.distance || 'Unknown'}m
Race Class: ${d.runners?.[0]?.class || 'Unknown'}

RUNNERS:
${runnersStr}

ENRICHED DATA:
Track Bias: ${e.track_bias || 'Unknown'}
Barrier Stats (win%): ${JSON.stringify(e.barrier_stats || {})}
Weather Impact: ${e.weather_impact || 'Fine'}
Speed Map: ${e.speed_map || 'Not available'}

RECENT AI PERFORMANCE:
${performanceSummary}

Analyse this race and provide a recommendation. Consider: value in the market, track bias vs barrier draw, jockey/trainer form, class assessment, distance suitability, speed map positioning.

Return ONLY valid JSON in this exact format:
{
  "recommendation": "BET" | "SKIP" | "WATCH",
  "bet_type": "win" | "place" | "each_way" | "quinella" | "exacta" | "trifecta" | "first4",
  "selection": "Runner name (and 2nd/3rd if exotic)",
  "confidence_score": 0-100,
  "expected_value": number (positive = value, e.g. 0.12 = 12% edge),
  "suggested_stake_percent": number (0-5, percent of bankroll via Kelly),
  "reasoning": "3-5 paragraph detailed analysis",
  "risk_flags": ["array", "of", "concerns"],
  "learn_notes": "what to observe post-race for learning"
}`;
}

function buildSportsPrompt(event: Event, performanceSummary: string): string {
  const d = event.raw_data;
  const e = event.enriched_data || {};

  return `SPORTS BETTING ANALYSIS REQUEST

Sport: ${event.sport.toUpperCase()}
Event: ${event.event_name}
Time: ${new Date(event.event_time).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}

ODDS:
${d.home_team || 'Home'}: $${d.home_odds || 'N/A'}
${d.draw_odds ? `Draw: $${d.draw_odds}` : ''}
${d.away_team || 'Away'}: $${d.away_odds || 'N/A'}
${d.line !== undefined ? `Line: ${d.line}` : ''}
${d.total !== undefined ? `Total: ${d.total}` : ''}

TEAM FORM (last 10):
${d.home_team}: ${(e.form_last_10 || []).slice(0, 10).join('')}
${d.away_team}: ${(e.form_last_10 || []).slice(11).join('')}
Records: ${e.home_away_record || 'N/A'}
H2H: ${e.h2h_record || 'N/A'}
Injuries: ${(e.injuries || []).join(', ') || 'None reported'}

RECENT AI PERFORMANCE:
${performanceSummary}

Analyse this market for betting value. Consider form, H2H, home/away advantage, injuries, market price vs true probability, and any situational factors.

Return ONLY valid JSON:
{
  "recommendation": "BET" | "SKIP" | "WATCH",
  "bet_type": "head_to_head" | "line" | "total" | "same_game_multi",
  "selection": "Team name or outcome description",
  "confidence_score": 0-100,
  "expected_value": number,
  "suggested_stake_percent": number,
  "reasoning": "3-5 paragraph analysis",
  "risk_flags": ["array"],
  "learn_notes": "what to observe"
}`;
}

async function callClaudeWithRetry(
  client: Anthropic,
  prompt: string,
  maxRetries = 3
): Promise<AiRecommendation | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        console.log(`AI retry attempt ${attempt + 1}/${maxRetries}`);
      }

      const message = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content
        .filter((c) => c.type === 'text')
        .map((c) => (c as { type: 'text'; text: string }).text)
        .join('');

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.recommendation || !parsed.bet_type || !parsed.selection) {
        throw new Error('AI response missing required fields');
      }

      return {
        recommendation: parsed.recommendation,
        bet_type: parsed.bet_type,
        selection: parsed.selection,
        confidence_score: Math.min(100, Math.max(0, Number(parsed.confidence_score) || 0)),
        expected_value: Number(parsed.expected_value) || 0,
        suggested_stake: Number(parsed.suggested_stake_percent) || 0,
        reasoning: String(parsed.reasoning || ''),
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
        learn_notes: String(parsed.learn_notes || ''),
        legs: Array.isArray(parsed.legs) ? parsed.legs : undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`AI call attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  console.error('AI analysis failed after all retries:', lastError?.message);
  return null;
}

function calculateKellyStake(
  ev: number,
  odds: number,
  bankroll: number,
  maxPercent: number
): number {
  if (odds <= 1 || ev <= 0) return 0;
  const p = (ev + 1) / odds;
  const q = 1 - p;
  const kelly = (p * (odds - 1) - q) / (odds - 1);
  const fraction = Math.max(0, Math.min(kelly * 0.25, maxPercent / 100));
  return Math.round(bankroll * fraction * 100) / 100;
}

export async function analyseEvent(
  event: Event,
  bankroll: number,
  maxStakePercent = 5
): Promise<Analysis | null> {
  const apiKey = await db.getAnthropicApiKey();
  if (!apiKey) {
    console.warn('No Anthropic API key configured');
    return null;
  }

  const client = new Anthropic({ apiKey });
  const performanceSummary = await db.getRecentPerformanceSummary();

  const isRacing = event.sport.startsWith('horse_racing');
  const prompt = isRacing
    ? buildRacingPrompt(event, performanceSummary)
    : buildSportsPrompt(event, performanceSummary);

  const recommendation = await callClaudeWithRetry(client, prompt);
  if (!recommendation) return null;

  // Calculate Kelly stake based on EV and best available odds
  const bestOdds =
    event.raw_data.runners?.[0]?.odds ||
    event.raw_data.home_odds ||
    event.raw_data.away_odds ||
    2.0;

  const dollarStake = calculateKellyStake(
    recommendation.expected_value,
    bestOdds,
    bankroll,
    maxStakePercent
  );

  const analysis: Omit<Analysis, 'id' | 'created_at'> = {
    event_id: event.id,
    ai_recommendation: { ...recommendation, suggested_stake: dollarStake },
    confidence: recommendation.confidence_score,
    ev: recommendation.expected_value,
    suggested_stake: dollarStake,
    reasoning: recommendation.reasoning,
  };

  const saved = await db.createAnalysis(analysis);
  return saved;
}

export async function analyseAllNewEvents(
  bankroll: number,
  minConfidence: number,
  maxStakePercent: number
): Promise<{ analysed: number; highConfidence: number }> {
  const events = await db.getEvents({ limit: 50 });

  // Get already-analysed event IDs
  const { data: existing } = await (await import('../database')).supabase
    .from('analyses')
    .select('event_id')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString());

  const analysedIds = new Set((existing || []).map((a: { event_id: string }) => a.event_id));
  const newEvents = events.filter((e) => !analysedIds.has(e.id));

  let analysed = 0;
  let highConfidence = 0;

  for (const event of newEvents) {
    const analysis = await analyseEvent(event, bankroll, maxStakePercent);
    if (analysis) {
      analysed++;
      if (analysis.confidence >= minConfidence) highConfidence++;
    }
    // Rate limit: 1 request per 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { analysed, highConfidence };
}
