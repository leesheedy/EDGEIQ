import { db } from '../database';
import type { BankrollStats } from '../types';

export async function initBankroll(startingBalance: number): Promise<void> {
  await db.logBankroll(startingBalance, 'Initial deposit');
}

export async function getCurrentBalance(): Promise<number> {
  const history = await db.getBankrollHistory(365);
  if (history.length === 0) return 0;
  return history[history.length - 1].balance;
}

export async function updateBalanceAfterBet(
  betId: string,
  outcome: 'WON' | 'LOST' | 'VOID'
): Promise<number> {
  const { data: bet } = await (await import('../database')).supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (!bet) throw new Error('Bet not found');

  const current = await getCurrentBalance();
  let newBalance = current;
  let desc = '';

  if (outcome === 'WON') {
    const profit = bet.stake * (bet.odds - 1);
    newBalance = current + profit;
    desc = `Won: ${bet.selection} @ $${bet.odds} — +$${profit.toFixed(2)}`;
  } else if (outcome === 'LOST') {
    newBalance = current - bet.stake;
    desc = `Lost: ${bet.selection} — -$${bet.stake.toFixed(2)}`;
  } else {
    newBalance = current + bet.stake;
    desc = `Void: ${bet.selection} — stake returned $${bet.stake.toFixed(2)}`;
  }

  await db.logBankroll(newBalance, desc);
  return newBalance;
}

export async function deductStake(stake: number, description: string): Promise<number> {
  const current = await getCurrentBalance();
  const newBalance = current - stake;
  await db.logBankroll(newBalance, description);
  return newBalance;
}

export async function getStats(): Promise<BankrollStats> {
  return db.getBankrollStats();
}

export function calcKelly(
  edge: number,
  odds: number,
  bankroll: number,
  maxPct: number = 5
): number {
  if (odds <= 1 || edge <= 0) return 0;
  const winProb = (edge + 1) / odds;
  const lossProb = 1 - winProb;
  const kelly = (winProb * (odds - 1) - lossProb) / (odds - 1);
  const fractional = Math.max(0, Math.min(kelly * 0.25, maxPct / 100));
  return Math.round(bankroll * fractional * 100) / 100;
}
