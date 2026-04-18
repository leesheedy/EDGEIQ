/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium, Browser, Page } from 'playwright';
import { config } from '../config';
import { db } from '../database';
import type { Event, RawEventData, Runner, Sport } from '../types';

let browser: Browser | null = null;
let page: Page | null = null;
let isLoggedIn = false;
let scraperErrors: string[] = [];

export function getScraperErrors(): string[] {
  return scraperErrors;
}

export function clearScraperErrors(): void {
  scraperErrors = [];
}

function findChromiumPath(): string | undefined {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const fs = require('fs');
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const executablePath = findChromiumPath();
    if (!executablePath) {
      console.warn('No system Chromium found — Playwright will download its own');
    } else {
      console.log(`Using Chromium at: ${executablePath}`);
    }
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1920,1080',
      ],
    });
  }
  return browser;
}

async function getPage(): Promise<Page> {
  const b = await getBrowser();
  if (!page || page.isClosed()) {
    const ctx = await b.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });
    page = await ctx.newPage();
    isLoggedIn = false;
  }
  return page;
}

async function login(p: Page): Promise<boolean> {
  if (isLoggedIn) return true;
  if (!config.tab.username || !config.tab.password) {
    console.warn('TAB credentials not set — scraping public odds only');
    return false;
  }

  try {
    await p.goto(`${config.tab.baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForSelector('[data-testid="username"], input[name="username"], #username', { timeout: 10000 });
    await p.fill('[data-testid="username"], input[name="username"], #username', config.tab.username);
    await p.fill('[data-testid="password"], input[name="password"], #password', config.tab.password);
    await p.click('[data-testid="login-button"], button[type="submit"]');
    await p.waitForURL(/account|dashboard|racing/, { timeout: 15000 });
    isLoggedIn = true;
    console.log('TAB login successful');
    return true;
  } catch (err) {
    console.error('TAB login failed:', err);
    scraperErrors.push(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function scrapeRacing(p: Page): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  try {
    await p.goto(`${config.tab.baseUrl}/racing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(2000);

    // Get all race meetings
    const meetings = await p.evaluate(() => {
      const items: Array<{
        name: string;
        url: string;
        type: string;
        state: string;
        venue: string;
      }> = [];

      // TAB typically has a sidebar or grid with race meetings
      const links = Array.from(
        document.querySelectorAll('a[href*="/racing/"], a[href*="/race/"]')
      );

      for (const link of links.slice(0, 100)) {
        const href = (link as unknown as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || '';
        if (href && text) {
          const type = href.includes('harness') ? 'horse_racing_harness'
            : href.includes('greyhound') ? 'horse_racing_greyhound'
            : 'horse_racing_thoroughbred';
          items.push({ name: text, url: href, type, state: '', venue: text });
        }
      }
      return [...new Map(items.map((i) => [i.url, i])).values()].slice(0, 30);
    });

    for (const meeting of meetings) {
      try {
        const raceEvents = await scrapeRaceMeeting(p, meeting);
        events.push(...raceEvents);
      } catch (err) {
        console.warn(`Failed scraping meeting ${meeting.name}:`, err);
      }
    }
  } catch (err) {
    scraperErrors.push(`Racing scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return events;
}

async function scrapeRaceMeeting(
  p: Page,
  meeting: { name: string; url: string; type: string }
): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  await p.goto(meeting.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1500);

  const raceData = await p.evaluate(() => {
    const races: Array<{
      raceNum: number;
      eventTime: string;
      runners: Array<{ name: string; barrier?: number; jockey?: string; trainer?: string; weight?: number; odds: number }>;
      distance: number;
      trackCondition: string;
    }> = [];

    // Generic extraction — adapt selectors to actual TAB DOM
    const raceCards = document.querySelectorAll('[data-race], .race-card, [class*="RaceCard"]');
    raceCards.forEach((card, idx) => {
      const timeEl = card.querySelector('[class*="time"], [data-time]');
      const runnerEls = card.querySelectorAll('[class*="runner"], [class*="Runner"]');

      const runners: Array<{ name: string; barrier?: number; odds: number }> = [];
      runnerEls.forEach((r) => {
        const nameEl = r.querySelector('[class*="name"], [class*="Name"]');
        const oddsEl = r.querySelector('[class*="odds"], [class*="price"]');
        const barrierEl = r.querySelector('[class*="barrier"], [class*="Barrier"]');

        if (nameEl && oddsEl) {
          const oddsText = oddsEl.textContent?.replace(/[^0-9.]/g, '') || '0';
          runners.push({
            name: nameEl.textContent?.trim() || 'Unknown',
            odds: parseFloat(oddsText) || 0,
            barrier: barrierEl ? parseInt(barrierEl.textContent || '0') : undefined,
          });
        }
      });

      if (runners.length > 0) {
        races.push({
          raceNum: idx + 1,
          eventTime: timeEl?.textContent?.trim() || new Date(Date.now() + 3600000).toISOString(),
          runners,
          distance: 0,
          trackCondition: 'Good',
        });
      }
    });

    return races;
  });

  for (const race of raceData) {
    const eventTime = parseEventTime(race.eventTime);
    events.push({
      sport: meeting.type as Sport,
      event_name: `${meeting.name} Race ${race.raceNum}`,
      event_time: eventTime,
      market_type: 'win',
      tab_url: meeting.url,
      raw_data: {
        market_type: 'win',
        runners: race.runners as Runner[],
        distance: race.distance,
        track_condition: race.trackCondition,
        race_number: race.raceNum,
        venue: meeting.name,
      },
      scraped_at: new Date().toISOString(),
    });
  }

  return events;
}

async function scrapeSports(p: Page): Promise<Omit<Event, 'id'>[]> {
  const events: Omit<Event, 'id'>[] = [];

  const sportPages: Array<{ sport: Sport; path: string }> = [
    { sport: 'nrl', path: '/sports/rugby-league' },
    { sport: 'afl', path: '/sports/australian-rules' },
    { sport: 'soccer', path: '/sports/soccer' },
    { sport: 'nba', path: '/sports/basketball' },
    { sport: 'cricket', path: '/sports/cricket' },
    { sport: 'tennis', path: '/sports/tennis' },
  ];

  for (const { sport, path } of sportPages) {
    try {
      await p.goto(`${config.tab.baseUrl}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await p.waitForTimeout(1500);

      const sportEvents = await p.evaluate(
        ({ sportName, baseUrl }: { sportName: string; baseUrl: string }) => {
          const items: Array<{
            name: string;
            url: string;
            time: string;
            homeTeam: string;
            awayTeam: string;
            homeOdds: number;
            drawOdds: number;
            awayOdds: number;
          }> = [];

          const eventEls = document.querySelectorAll(
            '[class*="event"], [class*="Event"], [data-event-id]'
          );

          eventEls.forEach((el) => {
            const link = el.querySelector('a') as HTMLAnchorElement | null;
            const url = link?.href || baseUrl;
            const nameEl = el.querySelector('[class*="name"], [class*="title"]');
            const timeEl = el.querySelector('[class*="time"], [class*="date"]');
            const oddsEls = el.querySelectorAll('[class*="odds"], [class*="price"]');

            const teams = (nameEl?.textContent || '').split(/v|vs\.?|\-/).map((t) => t.trim());
            const odds = Array.from(oddsEls).map((o) =>
              parseFloat(o.textContent?.replace(/[^0-9.]/g, '') || '0')
            );

            if (teams.length >= 2 && odds.length >= 2) {
              items.push({
                name: nameEl?.textContent?.trim() || '',
                url,
                time: timeEl?.textContent?.trim() || new Date(Date.now() + 7200000).toISOString(),
                homeTeam: teams[0],
                awayTeam: teams[1],
                homeOdds: odds[0] || 0,
                drawOdds: odds.length > 2 ? odds[1] : 0,
                awayOdds: odds[odds.length > 2 ? 2 : 1] || 0,
              });
            }
          });

          return items.slice(0, 20);
        },
        { sportName: sport, baseUrl: config.tab.baseUrl }
      );

      for (const ev of sportEvents) {
        events.push({
          sport,
          event_name: ev.name || `${ev.homeTeam} v ${ev.awayTeam}`,
          event_time: parseEventTime(ev.time),
          market_type: 'head_to_head',
          tab_url: ev.url,
          raw_data: {
            market_type: 'head_to_head',
            home_team: ev.homeTeam,
            away_team: ev.awayTeam,
            home_odds: ev.homeOdds,
            draw_odds: ev.drawOdds,
            away_odds: ev.awayOdds,
          },
          scraped_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`Failed scraping ${sport}:`, err);
      scraperErrors.push(`${sport} scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return events;
}

function parseEventTime(raw: string): string {
  const now = Date.now();
  // Already ISO
  if (raw.includes('T') && raw.includes(':')) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Time like "3:45pm" — assume today
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (timeMatch) {
    const d = new Date();
    let hours = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    d.setHours(hours, mins, 0, 0);
    if (d.getTime() < now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  // Fallback: 2 hours from now
  return new Date(now + 7200000).toISOString();
}

export async function runScrape(): Promise<{
  eventsScraped: number;
  errors: string[];
}> {
  console.log('Starting TAB scrape...');
  clearScraperErrors();
  let eventsScraped = 0;

  try {
    const p = await getPage();
    await login(p);

    const [racingEvents, sportsEvents] = await Promise.allSettled([
      scrapeRacing(p),
      scrapeSports(p),
    ]);

    const allEvents: Omit<Event, 'id'>[] = [];
    if (racingEvents.status === 'fulfilled') allEvents.push(...racingEvents.value);
    if (sportsEvents.status === 'fulfilled') allEvents.push(...sportsEvents.value);

    for (const event of allEvents) {
      const saved = await db.upsertEvent(event);
      if (saved) eventsScraped++;
    }

    console.log(`TAB scrape complete: ${eventsScraped} events saved`);
  } catch (err) {
    const msg = `Scrape error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    scraperErrors.push(msg);
  }

  return { eventsScraped, errors: scraperErrors };
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    isLoggedIn = false;
  }
}
