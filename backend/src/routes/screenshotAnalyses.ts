import { Router } from 'express';
import { db } from '../database';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const row = await db.saveScreenshotAnalysis(req.body);
    if (!row) return res.status(500).json({ error: 'Failed to save analysis' });
    res.json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const analyses = await db.getScreenshotAnalyses(100);
    res.json({ data: analyses });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load history' });
  }
});

router.patch('/:id', async (req, res) => {
  const { status, placed_stake, outcome, notes, odds } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (status != null) updates.status = status;
  if (placed_stake != null) updates.placed_stake = placed_stake;
  if (outcome != null) updates.outcome = outcome;
  if (notes != null) updates.notes = notes;

  if (outcome && placed_stake != null && odds != null) {
    const stake = Number(placed_stake);
    const o = Number(odds);
    if (outcome === 'WON') updates.profit_loss = stake * (o - 1);
    else if (outcome === 'LOST') updates.profit_loss = -stake;
    else updates.profit_loss = 0;
  }

  const updated = await db.updateScreenshotAnalysis(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ data: updated });
});

router.delete('/:id', async (req, res) => {
  await db.deleteScreenshotAnalysis(req.params.id);
  res.json({ data: { deleted: true } });
});

export default router;
