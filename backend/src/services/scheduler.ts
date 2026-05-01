import cron from 'node-cron';
import { runScrape } from '../scrapers/tab-scraper';
import { enrichRacingEvents } from '../scrapers/racing-enrichment';
import { enrichSportsEvents } from '../scrapers/sports-enrichment';
import { analyseAllNewEvents } from './ai-engine';
import { notifyHighConfidenceBets } from './notifications';
import { db } from '../database';
import { getCurrentBalance } from './bankroll';
import { config } from '../config';
import type { ScraperStatus } from '../types';

const status: ScraperStatus = {
  running: false,
  events_scraped: 0,
  errors: [],
};

let scrapeTask: cron.ScheduledTask | null = null;
let analysisTask: cron.ScheduledTask | null = null;

export function getStatus(): ScraperStatus {
  return { ...status };
}

async function runFullCycle(): Promise<void> {
  if (status.running) {
    console.log('Scrape cycle already running, skipping');
    return;
  }

  status.running = true;
  status.errors = [];

  try {
    console.log('=== EdgeIQ scrape cycle starting ===');

    // 1. Scrape TAB
    const { eventsScraped, errors } = await runScrape();
    status.events_scraped = eventsScraped;
    status.errors.push(...errors);
    status.last_run = new Date().toISOString();

    if (eventsScraped === 0) {
      console.warn('No events scraped — check TAB scraper');
    }

    // 2. Get newly scraped events for enrichment
    const events = await db.getEvents({ limit: 50 });

    // 3. Enrich in parallel
    await Promise.allSettled([
      enrichRacingEvents(events),
      enrichSportsEvents(events),
    ]);

    // 4. Run AI analysis on new events
    const settings = await db.getAllSettings();
    const bankroll = await getCurrentBalance();
    const minConfidence = parseInt(settings.confidence_threshold || String(config.thresholds.confidence), 10);
    const smsThreshold = parseInt(settings.sms_confidence_threshold || String(config.thresholds.smsConfidence), 10);
    const maxStakePct = parseFloat(settings.max_stake_percent || '5');

    const anthropicKey = await db.getAnthropicApiKey();
    if (anthropicKey) {
      const { analysed, highConfidence } = await analyseAllNewEvents(
        bankroll || 1000,
        minConfidence,
        maxStakePct
      );
      console.log(`AI: ${analysed} events analysed, ${highConfidence} high confidence`);

      // 5. Notify high-confidence bets
      if (highConfidence > 0) {
        const pending = await db.getPendingAnalyses(minConfidence);
        await notifyHighConfidenceBets(pending, smsThreshold);
      }
    }

    console.log(`=== Scrape cycle complete: ${eventsScraped} events ===`);
  } catch (err) {
    const msg = `Cycle error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    status.errors.push(msg);
  } finally {
    status.running = false;
  }
}

export function startScheduler(): void {
  const intervalMins = config.scraping.intervalMinutes;
  const cronExpr = `*/${intervalMins} * * * *`;

  console.log(`Starting scheduler: every ${intervalMins} minutes`);

  scrapeTask = cron.schedule(cronExpr, () => {
    runFullCycle().catch(console.error);
  });

  // Run learning snapshot daily at 11pm AEST
  analysisTask = cron.schedule('0 11 * * *', () => {
    generateLearningSnapshot().catch(console.error);
  });

  // Run initial scrape after 5 second startup delay
  setTimeout(() => runFullCycle().catch(console.error), 5000);
}

export function stopScheduler(): void {
  scrapeTask?.stop();
  analysisTask?.stop();
  console.log('Scheduler stopped');
}

export async function triggerManualScrape(): Promise<ScraperStatus> {
  runFullCycle().catch(console.error);
  return getStatus();
}

async function generateLearningSnapshot(): Promise<void> {
  const { data: bets } = await (await import('../database')).supabase
    .from('bets')
    .select('bet_type, outcome, profit_loss, events(sport)')
    .eq('status', 'settled');

  if (!bets || bets.length === 0) return;

  const bySport: Record<string, { wins: number; total: number; pnl: number }> = {};
  for (const bet of bets) {
    const sport = (bet.events as unknown as { sport: string })?.sport || 'unknown';
    if (!bySport[sport]) bySport[sport] = { wins: 0, total: 0, pnl: 0 };
    bySport[sport].total++;
    if (bet.outcome === 'WON') bySport[sport].wins++;
    bySport[sport].pnl += bet.profit_loss || 0;
  }

  for (const [sport, stats] of Object.entries(bySport)) {
    await db.createLearningSnapshot({
      sport,
      bet_type: 'all',
      sample_size: stats.total,
      win_rate: stats.total > 0 ? stats.wins / stats.total : 0,
      avg_ev: stats.pnl / (stats.total || 1),
      notes: `Auto-generated snapshot. Win rate: ${((stats.wins / stats.total) * 100).toFixed(1)}%`,
    });
  }
}
