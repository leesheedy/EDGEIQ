import { Router } from 'express';
import { db } from '../database';
import { supabase } from '../database';

const router = Router();

router.get('/snapshots', async (_req, res) => {
  const snapshots = await db.getLearningSnapshots();
  res.json({ data: snapshots });
});

router.get('/calibration', async (_req, res) => {
  // Return confidence buckets vs actual win rate for calibration chart
  const { data: bets } = await supabase
    .from('bets')
    .select('outcome, analyses(confidence)')
    .eq('status', 'settled');

  if (!bets) return res.json({ data: [] });

  const buckets: Record<number, { wins: number; total: number }> = {};
  for (let i = 0; i <= 100; i += 10) buckets[i] = { wins: 0, total: 0 };

  for (const bet of bets) {
    const conf = (bet.analyses as unknown as { confidence: number } | null)?.confidence || 0;
    const bucket = Math.floor(conf / 10) * 10;
    if (buckets[bucket]) {
      buckets[bucket].total++;
      if (bet.outcome === 'WON') buckets[bucket].wins++;
    }
  }

  const calibration = Object.entries(buckets).map(([conf, { wins, total }]) => ({
    confidence_bucket: parseInt(conf),
    actual_win_rate: total > 0 ? wins / total : null,
    sample_size: total,
  }));

  res.json({ data: calibration });
});

router.get('/by-sport', async (_req, res) => {
  const { data: bets } = await supabase
    .from('bets')
    .select('outcome, stake, profit_loss, bet_type, events(sport)')
    .eq('status', 'settled');

  if (!bets) return res.json({ data: [] });

  const bySport: Record<
    string,
    { wins: number; losses: number; total: number; pnl: number; stake: number }
  > = {};

  for (const bet of bets) {
    const sport = (bet.events as unknown as { sport: string } | null)?.sport || 'unknown';
    if (!bySport[sport]) bySport[sport] = { wins: 0, losses: 0, total: 0, pnl: 0, stake: 0 };
    bySport[sport].total++;
    bySport[sport].stake += bet.stake || 0;
    bySport[sport].pnl += bet.profit_loss || 0;
    if (bet.outcome === 'WON') bySport[sport].wins++;
    else if (bet.outcome === 'LOST') bySport[sport].losses++;
  }

  const result = Object.entries(bySport).map(([sport, s]) => ({
    sport,
    wins: s.wins,
    losses: s.losses,
    total: s.total,
    win_rate: s.total > 0 ? s.wins / s.total : 0,
    pnl: s.pnl,
    roi: s.stake > 0 ? (s.pnl / s.stake) * 100 : 0,
  }));

  res.json({ data: result });
});

router.get('/summary', async (_req, res) => {
  const summary = await db.getRecentPerformanceSummary();
  res.json({ data: { summary } });
});

export default router;
