import { Router } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { updateBalanceAfterBet, deductStake, getCurrentBalance } from '../services/bankroll';

const router = Router();

const CreateBetSchema = z.object({
  event_id: z.string().uuid(),
  analysis_id: z.string().uuid(),
  selection: z.string(),
  odds: z.number().positive(),
  stake: z.number().positive(),
  bet_type: z.string(),
  tab_url: z.string().url().optional(),
});

const SettleSchema = z.object({
  outcome: z.enum(['WON', 'LOST', 'VOID']),
});

router.get('/', async (req, res) => {
  const { status, limit, offset, sport } = req.query;
  const bets = await db.getBets({
    status: status as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });
  res.json({ data: bets });
});

router.get('/active', async (req, res) => {
  const bets = await db.getBets({ status: 'placed' });
  res.json({ data: bets });
});

router.get('/history', async (req, res) => {
  const { limit, offset } = req.query;
  const bets = await db.getBets({
    status: 'settled',
    limit: limit ? parseInt(limit as string, 10) : 100,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });
  res.json({ data: bets });
});

router.post('/', async (req, res) => {
  const parsed = CreateBetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { event_id, analysis_id, selection, odds, stake, bet_type, tab_url } = parsed.data;

  // Get event for tab_url fallback
  const event = await db.getEvent(event_id);

  const bet = await db.createBet({
    event_id,
    analysis_id,
    selection,
    odds,
    stake,
    bet_type: bet_type as import('../types').BetType,
    status: 'confirmed',
    placed_at: new Date().toISOString(),
    tab_url: tab_url || event?.tab_url,
  });

  if (!bet) return res.status(500).json({ error: 'Failed to create bet' });

  // Deduct stake from bankroll
  await deductStake(stake, `Bet placed: ${selection} @ $${odds}`);

  res.status(201).json({ data: bet });
});

router.patch('/:id/placed', async (req, res) => {
  const bet = await db.updateBet(req.params.id, { status: 'placed' });
  if (!bet) return res.status(404).json({ error: 'Bet not found' });
  res.json({ data: bet });
});

router.patch('/:id/settle', async (req, res) => {
  const parsed = SettleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const bet = await db.settleBet(req.params.id, parsed.data.outcome);
  if (!bet) return res.status(404).json({ error: 'Bet not found' });

  await updateBalanceAfterBet(req.params.id, parsed.data.outcome);

  res.json({ data: bet });
});

router.delete('/:id', async (req, res) => {
  // Soft delete — mark as void and return stake
  const bet = await db.settleBet(req.params.id, 'VOID');
  if (!bet) return res.status(404).json({ error: 'Bet not found' });

  const balance = await getCurrentBalance();
  await db.logBankroll(balance + (bet.stake || 0), `Bet cancelled: ${bet.selection}`);

  res.json({ data: bet });
});

export default router;
