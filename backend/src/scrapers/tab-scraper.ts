/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../database';
import type { Event, Runner, Sport } from '../types';

let scraperErrors: string[] = [];

export function getScraperErrors(): string[] { return scraperErrors; }
export function clearScraperErrors(): void { scraperErrors = []; }

// ─── TAB Public API ────────────────────────────────────────────────────────
// TAB Australia exposes a public REST API used by tab.com.au itself.
// No Playwright needed — these are plain JSON endpoints.

const TAB_API = 'https://api.tab.com.au/v1/tab-info-service';
const JURISDICTIONS = ['NSW', 'VIC', 'QLD', 'SA', 'WA'];

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Origin': 'https://www.tab.com.au',
  'Referer': 'https://www.tab.com.au/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

async function tabFetch(path: string): Promise<any> {
  const url = `${TAB_API}${path}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ─── Racing ────────────────────────────────────────────────────────────────

async function scrapeRacing(): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  for (const jur of JURISDICTIONS) {
    try {
      // Next-to-go races per jurisdiction
      const data = await tabFetch(
        `/racing/next-to-go/races?jurisdiction=${jur}&maxEvents=20`
      );

      const races: any[] = data?.races ?? data?.data ?? [];
      for (const race of races) {
        try {
          events.push(...(await buildRaceEvents(race, jur)));
        } catch (e) {
          // skip individual race errors
        }
      }
    } catch (err) {
      const msg = `Racing scrape failed (${jur}): ${err instanceof Error ? err.message : String(err)}`;
      console.warn(msg);
      scraperErrors.push(msg);
    }
  }

  return events;
}

async function buildRaceEvents(race: any, jur: string): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  // Determine sport type
  const raceType: string = (race.raceType || race.meeting?.raceType || '').toLowerCase();
  const sport: Sport = raceType.includes('harness') ? 'horse_racing_harness'
    : raceType.includes('greyhound') ? 'horse_racing_greyhound'
    : 'horse_racing_thoroughbred';

  // Try to get full race detail with runners
  let runners: Runner[] = [];
  let trackCondition = 'Good';
  let distance = 0;
  let tabUrl = `https://www.tab.com.au/racing`;

  try {
    const raceId = race.raceId || race.id;
    const meetingId = race.meetingId || race.meeting?.meetingId;

    if (raceId) {
      const detail = await tabFetch(
        `/racing/meetings/races/${raceId}?jurisdiction=${jur}`
      ).catch(() => null);

      if (detail) {
        const raceData = detail.race ?? detail;
        trackCondition = raceData.trackCondition ?? raceData.meeting?.trackCondition ?? 'Good';
        distance = raceData.distance ?? raceData.raceDistance ?? 0;
        tabUrl = `https://www.tab.com.au/racing/${meetingId}/${raceId}`;

        const competitors: any[] = raceData.runners ?? raceData.competitors ?? [];
        runners = competitors
          .filter((c: any) => !c.scratched && !c.isScratched)
          .map((c: any): Runner => ({
            name: c.runnerName ?? c.name ?? 'Unknown',
            barrier: c.barrierNumber ?? c.barrier ?? undefined,
            jockey: c.jockeyName ?? c.rider ?? c.driver ?? undefined,
            trainer: c.trainerName ?? c.trainer ?? undefined,
            weight: c.handicapWeight ?? c.weight ?? undefined,
            odds: extractOdds(c),
            form: parseForm(c.form ?? c.last5Starts ?? ''),
          }));
      }
    }
  } catch {
    // fall through with empty runners — event still recorded
  }

  const venueName = race.meetingName ?? race.meeting?.meetingName ?? race.venue ?? 'Unknown';
  const raceNum = race.raceNumber ?? race.number ?? 1;
  const eventTime = parseTime(race.raceStartTime ?? race.startTime ?? race.advertisedStartTime);

  events.push({
    sport,
    event_name: `${venueName} Race ${raceNum}`,
    event_time: eventTime,
    market_type: 'win',
    tab_url: tabUrl,
    raw_data: {
      market_type: 'win',
      runners,
      distance,
      track_condition: trackCondition,
      race_number: raceNum,
      venue: venueName,
    },
    scraped_at: new Date().toISOString(),
  });

  return events;
}

function extractOdds(competitor: any): number {
  // TAB API nests odds in various ways
  const win = competitor.winOdds ?? competitor.fixedOdds?.returnWin
    ?? competitor.parimutuelOdds?.returnWin
    ?? competitor.odds?.win
    ?? competitor.currentOdds
    ?? 0;
  return typeof win === 'number' ? win : parseFloat(win) || 0;
}

function parseForm(formStr: string): string[] {
  if (!formStr) return [];
  return formStr.split('').filter(c => /[0-9xX]/.test(c)).slice(0, 10);
}

// ─── Sports ────────────────────────────────────────────────────────────────

const SPORT_PATHS: Array<{ sport: Sport; path: string }> = [
  { sport: 'nrl', path: '/sports/competitions/nrl-telstra-premiership/matches' },
  { sport: 'afl', path: '/sports/competitions/afl-premiership/matches' },
  { sport: 'soccer', path: '/sports/competitions/a-league-men/matches' },
  { sport: 'nba', path: '/sports/competitions/nba/matches' },
  { sport: 'cricket', path: '/sports/competitions/international-cricket/matches' },
  { sport: 'tennis', path: '/sports/competitions/atp-tour/matches' },
];

async function scrapeSports(): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  for (const { sport, path } of SPORT_PATHS) {
    try {
      const data = await tabFetch(`${path}?jurisdiction=NSW&maxEvents=20`);
      const matches: any[] = data?.matches ?? data?.competitions ?? data?.data ?? [];

      for (const match of matches.slice(0, 20)) {
        const homeTeam = match.homeTeam?.name ?? match.contestants?.[0]?.name ?? match.name ?? '';
        const awayTeam = match.awayTeam?.name ?? match.contestants?.[1]?.name ?? '';
        const eventName = homeTeam && awayTeam ? `${homeTeam} v ${awayTeam}` : match.name ?? 'Unknown';
        const eventTime = parseTime(match.startTime ?? match.advertisedStartTime);

        const odds = extractSportsOdds(match);
        const tabUrl = buildSportUrl(sport, match);

        events.push({
          sport,
          event_name: eventName,
          event_time: eventTime,
          market_type: 'head_to_head',
          tab_url: tabUrl,
          raw_data: {
            market_type: 'head_to_head',
            home_team: homeTeam,
            away_team: awayTeam,
            home_odds: odds.home,
            draw_odds: odds.draw,
            away_odds: odds.away,
          },
          scraped_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg = `${sport} scrape failed: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(msg);
      scraperErrors.push(msg);
    }
  }

  return events;
}

function extractSportsOdds(match: any): { home: number; draw: number; away: number } {
  // Try head to head market
  const h2h = match.markets?.find((m: any) =>
    /head.to.head|win/i.test(m.marketName ?? m.name ?? '')
  );
  const outcomes: any[] = h2h?.runners ?? h2h?.selections ?? match.runners ?? match.selections ?? [];

  if (outcomes.length >= 2) {
    return {
      home: parseFloat(outcomes[0]?.fixedOdds?.returnWin ?? outcomes[0]?.odds ?? 0) || 0,
      draw: outcomes.length > 2 ? parseFloat(outcomes[1]?.fixedOdds?.returnWin ?? outcomes[1]?.odds ?? 0) || 0 : 0,
      away: parseFloat(outcomes[outcomes.length - 1]?.fixedOdds?.returnWin ?? outcomes[outcomes.length - 1]?.odds ?? 0) || 0,
    };
  }

  return {
    home: parseFloat(match.homeOdds ?? match.homeWinOdds ?? 0) || 0,
    draw: parseFloat(match.drawOdds ?? 0) || 0,
    away: parseFloat(match.awayOdds ?? match.awayWinOdds ?? 0) || 0,
  };
}

function buildSportUrl(sport: Sport, match: any): string {
  const id = match.matchId ?? match.id ?? '';
  return id ? `https://www.tab.com.au/sports/${sport}/${id}` : 'https://www.tab.com.au/sports';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTime(raw: string | number | undefined): string {
  if (!raw) return new Date(Date.now() + 7200000).toISOString();
  if (typeof raw === 'number') return new Date(raw).toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(Date.now() + 7200000).toISOString() : d.toISOString();
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function runScrape(): Promise<{ eventsScraped: number; errors: string[] }> {
  console.log('Starting TAB API scrape...');
  clearScraperErrors();
  let eventsScraped = 0;

  try {
    const [racingResult, sportsResult] = await Promise.allSettled([
      scrapeRacing(),
      scrapeSports(),
    ]);

    const allEvents: Omit<Event, 'id'>[] = [];
    if (racingResult.status === 'fulfilled') allEvents.push(...racingResult.value);
    else scraperErrors.push(`Racing batch failed: ${racingResult.reason}`);

    if (sportsResult.status === 'fulfilled') allEvents.push(...sportsResult.value);
    else scraperErrors.push(`Sports batch failed: ${sportsResult.reason}`);

    for (const event of allEvents) {
      const saved = await db.upsertEvent(event);
      if (saved) eventsScraped++;
    }

    console.log(`TAB API scrape complete: ${eventsScraped} events saved, ${scraperErrors.length} errors`);
  } catch (err) {
    const msg = `Scrape error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    scraperErrors.push(msg);
  }

  return { eventsScraped, errors: scraperErrors };
}

// closeBrowser kept for backwards compat — no-op now since no browser
export async function closeBrowser(): Promise<void> {}
