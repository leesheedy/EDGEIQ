/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Data scraper — uses public APIs that work from any IP/region.
 *
 * Sports  → The Odds API (the-odds-api.com) with regions=au
 *            Returns real TAB / Sportsbet / Neds odds.
 *            Requires env: ODDS_API_KEY (free tier: 500 req/month)
 *
 * Racing  → BetFair Exchange API (api.betfair.com)
 *            Australian WIN markets, works globally.
 *            Requires env: BETFAIR_APP_KEY + BETFAIR_USERNAME + BETFAIR_PASSWORD
 *
 * Fallback → ESPN public API (no key needed) for sports events without odds.
 */

import { config } from '../config';
import { db } from '../database';
import type { Event, Runner, Sport } from '../types';

let scraperErrors: string[] = [];
export function getScraperErrors() { return scraperErrors; }
export function clearScraperErrors() { scraperErrors = []; }

// ─── Shared fetch helper ─────────────────────────────────────────────────────

async function apiFetch(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${url.split('?')[0]} — ${body.slice(0, 120)}`);
  }
  return res.json();
}

// ─── The Odds API — Sports ────────────────────────────────────────────────────

const ODDS_BASE = 'https://api.the-odds-api.com/v4';

/** Maps Odds API sport keys → our Sport enum */
const ODDS_SPORTS: Array<{ oddsKey: string; sport: Sport }> = [
  { oddsKey: 'rugbyleague_nrl',              sport: 'nrl' },
  { oddsKey: 'aussierules_afl',              sport: 'afl' },
  { oddsKey: 'soccer_australia_aleague',     sport: 'soccer' },
  { oddsKey: 'basketball_nba',               sport: 'nba' },
  { oddsKey: 'cricket_big_bash',             sport: 'cricket' },
  { oddsKey: 'cricket_australia_domestic',   sport: 'cricket' },
  { oddsKey: 'tennis_atp_aus_open',          sport: 'tennis' },
  { oddsKey: 'tennis_wta_aus_open',          sport: 'tennis' },
];

/** Australian bookmaker preference order */
const AU_BOOKMAKERS = ['tab', 'tabtouch', 'sportsbet', 'neds', 'betfair_ex_au', 'ladbrokes_au', 'unibet_au'];

function bestAuOdds(bookmakers: any[]): { home: number; draw: number; away: number } | null {
  // Prefer AU bookmakers; use whichever has h2h market
  const sorted = [...(bookmakers ?? [])].sort((a, b) => {
    const ai = AU_BOOKMAKERS.indexOf(a.key);
    const bi = AU_BOOKMAKERS.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  for (const bm of sorted) {
    const h2h = (bm.markets ?? []).find((m: any) => m.key === 'h2h');
    if (!h2h?.outcomes?.length) continue;
    const outcomes: any[] = h2h.outcomes;
    return {
      home: outcomes[0]?.price ?? 0,
      draw: outcomes.find((o: any) => o.name === 'Draw')?.price ?? 0,
      away: outcomes[outcomes.length > 2 ? 2 : 1]?.price ?? 0,
    };
  }
  return null;
}

async function scrapeSportsOddsApi(): Promise<Omit<Event, 'id'>[]> {
  if (!config.oddsApi.key) {
    scraperErrors.push(
      'ODDS_API_KEY not set. Get a free key at the-odds-api.com and add it to Railway environment variables.'
    );
    return [];
  }

  const events: Omit<Event, 'id'>[] = [];

  for (const { oddsKey, sport } of ODDS_SPORTS) {
    try {
      const url =
        `${ODDS_BASE}/sports/${oddsKey}/odds/` +
        `?apiKey=${config.oddsApi.key}` +
        `&regions=au` +
        `&markets=h2h` +
        `&oddsFormat=decimal` +
        `&dateFormat=iso`;

      const matches: any[] = await apiFetch(url);
      if (!Array.isArray(matches)) continue;

      for (const m of matches.slice(0, 25)) {
        const odds = bestAuOdds(m.bookmakers ?? []);
        const tabBm = (m.bookmakers ?? []).find((b: any) => b.key === 'tab' || b.key === 'tabtouch');
        const tabUrl = `https://www.tab.com.au/sports/${sport}`;

        events.push({
          sport,
          event_name: `${m.home_team} v ${m.away_team}`,
          event_time: m.commence_time,
          market_type: 'head_to_head',
          tab_url: tabUrl,
          raw_data: {
            market_type: 'head_to_head',
            home_team: m.home_team,
            away_team: m.away_team,
            home_odds:  odds?.home  ?? 0,
            draw_odds:  odds?.draw  ?? 0,
            away_odds:  odds?.away  ?? 0,
            bookmaker:  tabBm?.title ?? (m.bookmakers?.[0]?.title ?? 'Unknown'),
          },
          scraped_at: new Date().toISOString(),
        });
      }

      console.log(`  Odds API ${oddsKey}: ${matches.length} events`);
    } catch (err) {
      const msg = `${sport} (Odds API): ${err instanceof Error ? err.message : String(err)}`;
      console.warn(msg);
      scraperErrors.push(msg);
    }
  }

  return events;
}

// ─── ESPN fallback — Sports (no odds) ────────────────────────────────────────

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_SPORTS: Array<{ path: string; sport: Sport }> = [
  { path: 'rugby-league/nrl/scoreboard',             sport: 'nrl' },
  { path: 'australian-football/afl/scoreboard',      sport: 'afl' },
  { path: 'soccer/aus.1/scoreboard',                 sport: 'soccer' },
  { path: 'basketball/nba/scoreboard',               sport: 'nba' },
];

async function scrapeSportsEspn(): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  for (const { path, sport } of ESPN_SPORTS) {
    try {
      const data = await apiFetch(`${ESPN_BASE}/${path}`);
      const games: any[] = data?.events ?? [];

      for (const g of games.slice(0, 15)) {
        const comps: any[] = g.competitions ?? [];
        const comp = comps[0];
        if (!comp) continue;
        const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
        if (!home || !away) continue;

        events.push({
          sport,
          event_name: `${home.team?.displayName ?? 'Home'} v ${away.team?.displayName ?? 'Away'}`,
          event_time: g.date ?? new Date(Date.now() + 7200000).toISOString(),
          market_type: 'head_to_head',
          tab_url: `https://www.tab.com.au/sports/${sport}`,
          raw_data: {
            market_type: 'head_to_head',
            home_team: home.team?.displayName ?? '',
            away_team: away.team?.displayName ?? '',
            home_odds: 0,
            draw_odds: 0,
            away_odds: 0,
          },
          scraped_at: new Date().toISOString(),
        });
      }

      console.log(`  ESPN ${sport}: ${events.length} events`);
    } catch (err) {
      console.warn(`ESPN ${sport}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return events;
}

// ─── BetFair Exchange API — Racing ───────────────────────────────────────────

const BF_API = 'https://api.betfair.com/exchange/betting/rest/v1.0';

let bfSessionToken: string | null = null;
let bfSessionExpiry = 0;

async function betfairLogin(): Promise<string | null> {
  if (bfSessionToken && Date.now() < bfSessionExpiry) return bfSessionToken;
  if (!config.betfair.appKey || !config.betfair.username || !config.betfair.password) return null;

  try {
    const res = await fetch('https://identitysso-cert.betfair.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Application': config.betfair.appKey,
        'Accept': 'application/json',
      },
      body: `username=${encodeURIComponent(config.betfair.username)}&password=${encodeURIComponent(config.betfair.password)}`,
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    if (data.status === 'SUCCESS') {
      bfSessionToken = data.token;
      bfSessionExpiry = Date.now() + 3 * 3600 * 1000; // 3 hour session
      console.log('BetFair login successful');
      return bfSessionToken;
    }

    scraperErrors.push(`BetFair login failed: ${data.error ?? data.status}`);
    return null;
  } catch (err) {
    scraperErrors.push(`BetFair login error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function bfFetch(endpoint: string, body: object, session: string): Promise<any> {
  return apiFetch(`${BF_API}/${endpoint}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Application': config.betfair.appKey,
      'X-Authentication': session,
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function scrapeRacingBetfair(): Promise<Omit<Event, 'id'>[]> {
  const session = await betfairLogin();
  if (!session) {
    if (config.betfair.appKey) {
      scraperErrors.push('BetFair login failed — check BETFAIR_USERNAME and BETFAIR_PASSWORD.');
    } else {
      scraperErrors.push(
        'Racing requires BetFair API credentials. Set BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD in Railway env vars. Get a free API key at developer.betfair.com.'
      );
    }
    return [];
  }

  const events: Omit<Event, 'id'>[] = [];

  try {
    // List AU WIN markets starting in next 8 hours
    const now = new Date();
    const cutoff = new Date(now.getTime() + 8 * 3600 * 1000);

    const catalogue: any[] = await bfFetch('listMarketCatalogue', {
      filter: {
        eventTypeIds: ['7'],              // 7 = Horse Racing
        marketCountries: ['AU'],
        marketTypeCodes: ['WIN'],
        marketStartTime: {
          from: now.toISOString(),
          to: cutoff.toISOString(),
        },
      },
      marketProjection: ['EVENT', 'MARKET_START_TIME', 'RUNNER_METADATA', 'COMPETITION'],
      maxResults: 50,
      sort: 'FIRST_TO_START',
    }, session);

    if (!Array.isArray(catalogue) || catalogue.length === 0) {
      console.log('BetFair: no AU racing markets found');
      return [];
    }

    // Get prices for all markets in one call
    const marketIds = catalogue.map((m: any) => m.marketId);
    const books: any[] = await bfFetch('listMarketBook', {
      marketIds: marketIds.slice(0, 40),
      priceProjection: {
        priceData: ['EX_BEST_OFFERS'],
        exBestOffersOverrides: { bestPricesDepth: 1 },
      },
    }, session);

    const bookMap: Record<string, any> = {};
    for (const b of books ?? []) bookMap[b.marketId] = b;

    for (const market of catalogue) {
      try {
        const book = bookMap[market.marketId];
        const runners: Runner[] = [];

        for (const runner of market.runners ?? []) {
          const runnerBook = (book?.runners ?? []).find(
            (rb: any) => rb.selectionId === runner.selectionId
          );

          const bestBack = runnerBook?.ex?.availableToBack?.[0]?.price ?? 0;
          const bestLay  = runnerBook?.ex?.availableToLay?.[0]?.price ?? 0;
          // Use back price (equivalent to win odds)
          const odds = bestBack || 0;

          runners.push({
            name: runner.runnerName ?? `Runner ${runner.sortPriority}`,
            barrier: runner.metadata?.CLOTH_NUMBER ? parseInt(runner.metadata.CLOTH_NUMBER) : undefined,
            jockey: runner.metadata?.JOCKEY_NAME ?? undefined,
            trainer: runner.metadata?.TRAINER_NAME ?? undefined,
            weight: runner.metadata?.WEIGHT_VALUE ? parseFloat(runner.metadata.WEIGHT_VALUE) : undefined,
            odds,
            form: parseFormString(runner.metadata?.FORM ?? ''),
          });
        }

        // Sort by odds ascending (favourite first)
        runners.sort((a, b) => {
          if (!a.odds) return 1;
          if (!b.odds) return -1;
          return a.odds - b.odds;
        });

        const venue = market.event?.venue ?? market.competition?.name ?? market.marketName ?? 'Unknown';
        const raceNum = extractRaceNumber(market.marketName ?? '');
        const sportType = detectRaceType(market.marketName ?? '', market.competition?.name ?? '');

        events.push({
          sport: sportType,
          event_name: `${venue} Race ${raceNum}`,
          event_time: market.marketStartTime ?? new Date().toISOString(),
          market_type: 'win',
          tab_url: `https://www.tab.com.au/racing`,
          raw_data: {
            market_type: 'win',
            runners,
            distance: 0,
            track_condition: 'Good',
            race_number: raceNum,
            venue,
            betfair_market_id: market.marketId,
          },
          scraped_at: new Date().toISOString(),
        });
      } catch (e) {
        // skip individual market errors
      }
    }

    console.log(`BetFair: ${events.length} AU racing events`);
  } catch (err) {
    const msg = `BetFair racing: ${err instanceof Error ? err.message : String(err)}`;
    console.warn(msg);
    scraperErrors.push(msg);
  }

  return events;
}

function parseFormString(form: string): string[] {
  return form.split('').filter(c => /[0-9xXFPU]/.test(c)).slice(0, 10);
}

function extractRaceNumber(marketName: string): number {
  const m = marketName.match(/\bR(\d+)\b|\bRace\s*(\d+)\b/i);
  if (m) return parseInt(m[1] ?? m[2]);
  const n = marketName.match(/\b(\d+)\b/);
  return n ? parseInt(n[1]) : 1;
}

function detectRaceType(marketName: string, competition: string): Sport {
  const text = `${marketName} ${competition}`.toLowerCase();
  if (text.includes('harness') || text.includes('trot')) return 'horse_racing_harness';
  if (text.includes('greyhound') || text.includes('dogs')) return 'horse_racing_greyhound';
  return 'horse_racing_thoroughbred';
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function runScrape(): Promise<{ eventsScraped: number; errors: string[] }> {
  console.log('Starting scrape...');
  clearScraperErrors();
  let eventsScraped = 0;

  // Sports: try Odds API first, ESPN as fallback
  let sportsEvents: Omit<Event, 'id'>[] = [];
  if (config.oddsApi.key) {
    sportsEvents = await scrapeSportsOddsApi();
  }
  if (sportsEvents.length === 0) {
    console.log('Odds API returned 0 events — using ESPN fallback');
    sportsEvents = await scrapeSportsEspn();
  }

  // Racing: BetFair (requires credentials)
  const racingEvents = await scrapeRacingBetfair();

  const allEvents = [...sportsEvents, ...racingEvents];

  for (const event of allEvents) {
    const saved = await db.upsertEvent(event);
    if (saved) eventsScraped++;
  }

  console.log(
    `Scrape complete: ${eventsScraped} events saved` +
    ` (${sportsEvents.length} sports, ${racingEvents.length} racing)` +
    `, ${scraperErrors.length} errors`
  );

  return { eventsScraped, errors: scraperErrors };
}

// No-op — Playwright is gone
export async function closeBrowser(): Promise<void> {}
