import React, { useEffect } from 'react';
import { CheckCircle, XCircle, MinusCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatEventTime, sportEmoji, betTypeLabel, clsx } from '../lib/utils';
import type { Bet } from '../types';

export function ActiveBets() {
  const { activeBets, loadActiveBets, isLoadingBets, markPlaced, settleBet, cancelBet } =
    useBettingStore();
  const { addToast, loadBankroll } = useAppStore();

  useEffect(() => {
    loadActiveBets();
  }, []);

  async function handleSettle(bet: Bet, outcome: 'WON' | 'LOST' | 'VOID') {
    try {
      await settleBet(bet.id, outcome);
      await loadBankroll();
      const pnl =
        outcome === 'WON'
          ? bet.stake * (bet.odds - 1)
          : outcome === 'LOST'
          ? -bet.stake
          : 0;
      addToast(
        outcome === 'WON' ? 'success' : outcome === 'LOST' ? 'error' : 'info',
        `${outcome}: ${bet.selection} — ${formatCurrency(pnl)}`
      );
    } catch {
      addToast('error', 'Failed to settle bet');
    }
  }

  async function handleMarkPlaced(betId: string) {
    try {
      await markPlaced(betId);
      addToast('info', 'Bet marked as placed');
    } catch {
      addToast('error', 'Failed to update bet status');
    }
  }

  if (isLoadingBets) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-navy-800 border border-navy-700 rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Active Bets</h1>
          <p className="text-gray-500 text-sm font-mono mt-0.5">
            {activeBets.length} bets awaiting settlement
          </p>
        </div>
        <button
          onClick={loadActiveBets}
          disabled={isLoadingBets}
          className="flex items-center gap-2 px-3 py-2 bg-navy-800 border border-navy-600 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw size={14} className={isLoadingBets ? 'animate-spin' : ''} />
        </button>
      </div>

      {activeBets.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">💤</div>
          <h3 className="font-display font-semibold text-white text-lg mb-2">No active bets</h3>
          <p className="text-gray-500 font-mono text-sm">
            Confirm bets from the Pending screen to track them here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeBets.map((bet) => (
            <ActiveBetRow
              key={bet.id}
              bet={bet}
              onSettle={handleSettle}
              onMarkPlaced={handleMarkPlaced}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveBetRow({
  bet,
  onSettle,
  onMarkPlaced,
}: {
  bet: Bet;
  onSettle: (bet: Bet, outcome: 'WON' | 'LOST' | 'VOID') => void;
  onMarkPlaced: (id: string) => void;
}) {
  const potentialProfit = bet.stake * (bet.odds - 1);

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">
          {bet.events ? sportEmoji(bet.events.sport) : '🎯'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-white">{bet.selection}</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {bet.events?.event_name}
                {bet.events && ` · ${formatEventTime(bet.events.event_time)}`}
              </p>
            </div>
            <span
              className={clsx(
                'text-xs font-mono px-2 py-1 rounded-full shrink-0',
                bet.status === 'placed'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-amber-edge/20 text-amber-edge'
              )}
            >
              {bet.status}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-navy-900 rounded-lg p-2">
              <div className="text-xs text-gray-500 font-mono">Type</div>
              <div className="text-sm font-mono text-white">{betTypeLabel(bet.bet_type)}</div>
            </div>
            <div className="bg-navy-900 rounded-lg p-2">
              <div className="text-xs text-gray-500 font-mono">Odds</div>
              <div className="text-sm font-mono text-white">${bet.odds.toFixed(2)}</div>
            </div>
            <div className="bg-navy-900 rounded-lg p-2">
              <div className="text-xs text-gray-500 font-mono">Stake</div>
              <div className="text-sm font-mono text-white">{formatCurrency(bet.stake)}</div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">
              Potential: <span className="text-green-edge">{formatCurrency(potentialProfit)}</span>
            </span>
            {bet.tab_url && (
              <a
                href={bet.tab_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-white transition-colors"
              >
                <ExternalLink size={11} />
                TAB
              </a>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {bet.status === 'confirmed' && (
              <button
                onClick={() => onMarkPlaced(bet.id)}
                className="flex-1 py-2 rounded-xl text-xs font-mono bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
              >
                Mark as Placed
              </button>
            )}
            <button
              onClick={() => onSettle(bet, 'WON')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono bg-green-edge/20 text-green-edge hover:bg-green-edge/30 transition-all"
            >
              <CheckCircle size={13} />
              WON
            </button>
            <button
              onClick={() => onSettle(bet, 'LOST')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono bg-red-edge/20 text-red-edge hover:bg-red-edge/30 transition-all"
            >
              <XCircle size={13} />
              LOST
            </button>
            <button
              onClick={() => onSettle(bet, 'VOID')}
              className="px-3 py-2 rounded-xl text-xs font-mono bg-navy-700 text-gray-400 hover:text-white transition-all"
            >
              <MinusCircle size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
