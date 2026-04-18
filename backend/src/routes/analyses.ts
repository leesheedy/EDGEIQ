import { Router } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { analyseEvent } from '../services/ai-engine';
import { getCurrentBalance } from '../services/bankroll';

const router = Router();

router.get('/', async (req, res) => {
  const { min_confidence, limit } = req.query;
  const analyses = await db.getAnalyses({
    min_confidence: min_confidence ? parseInt(min_confidence as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : 50,
  });
  res.json({ data: analyses });
});

router.get('/pending', async (req, res) => {
  const settings = await db.getAllSettings();
  const threshold = parseInt(settings.confidence_threshold || '65', 10);
  const analyses = await db.getPendingAnalyses(threshold);
  res.json({ data: analyses });
});

router.post('/analyse/:eventId', async (req, res) => {
  const event = await db.getEvent(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const bankroll = await getCurrentBalance();
  const settings = await db.getAllSettings();
  const maxStake = parseFloat(settings.max_stake_percent || '5');

  const analysis = await analyseEvent(event, bankroll || 1000, maxStake);
  if (!analysis) return res.status(500).json({ error: 'AI analysis failed' });

  res.json({ data: analysis });
});

export default router;
