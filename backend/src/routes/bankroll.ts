import { Router } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { initBankroll, getStats, getCurrentBalance } from '../services/bankroll';

const router = Router();

router.get('/stats', async (_req, res) => {
  const stats = await getStats();
  res.json({ data: stats });
});

router.get('/history', async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
  const history = await db.getBankrollHistory(days);
  res.json({ data: history });
});

router.get('/balance', async (_req, res) => {
  const balance = await getCurrentBalance();
  res.json({ data: { balance } });
});

router.post('/init', async (req, res) => {
  const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
  await initBankroll(amount);
  await db.setSetting('starting_bankroll', String(amount));
  res.json({ data: { balance: amount } });
});

router.post('/deposit', async (req, res) => {
  const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
  const current = await getCurrentBalance();
  const newBalance = current + amount;
  await db.logBankroll(newBalance, `Manual deposit: +$${amount}`);
  res.json({ data: { balance: newBalance } });
});

// Set balance directly (manual sync from TAB account)
router.post('/set', async (req, res) => {
  const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
  await db.logBankroll(amount, `Balance updated to $${amount.toFixed(2)}`);
  await db.setSetting('starting_bankroll', String(amount));
  res.json({ data: { balance: amount } });
});

export default router;
