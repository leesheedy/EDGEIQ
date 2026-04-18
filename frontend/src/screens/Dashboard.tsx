import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Activity,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';
import { BetCard } from '../components/BetCard';
import { SparklineChart } from '../components/SparklineChart';
import { StatsCard } from '../components/StatsCard';
import { bankrollApi } from '../lib/api';
import type { BankrollLog } from '../types';
import {
  formatCurrency,
  formatEventTime,
  timeUntil,
  sportEmoji,
  clsx,
} from '../lib/utils';

export function Dashboard() {
  const { bankrollStats, scraperStatus, loadBankroll, loadScraperStatus, triggerScrape } = useAppStore();
  const { pending, activeBets, loadPending } = useBettingStore();
  const [bankrollHistory, setBankrollHistory] = useState<BankrollLog[]>([]);

  useEffect(() => {
    bankrollApi.history(30).then(setBankrollHistory).catch(() => {});
    loadPending();
    loadBankroll();
    loadScraperStatus();
  }, []);

  const todayBets = activeBets.filter((b) => {
    const placed = b.placed_at ? new Date(b.placed_at) : null;
    if (!placed) return false;
    const today = new Date();
    return placed.toDateString() === today.toDateString();
  });

  const todayPnl = todayBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);

  const top3 = pending
    .filter((a) => a.ai_recommendation?.recommendation === 'BET')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const scrapeErrors = scraperStatus?.errors?.length || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm font-mono mt-0.5">
            {new Date().toLocaleDateString('en-AU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={triggerScrape}
          disabled={scraperStatus?.running}
          className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-navy-600 rounded-xl text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={scraperStatus?.running ? 'animate-spin' : ''} />
          {scraperStatus?.running ? 'Scraping...' : 'Refresh'}
        </button>
      </div>

      {/* Scraper error banner */}
      {scrapeErrors > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-red-edge/10 border border-red-edge/30 rounded-xl text-sm text-red-edge">
          <AlertCircle size={16} />
          <span>
            Scraper has {scrapeErrors} error{scrapeErrors > 1 ? 's' : ''} — check Settings
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard
          label="Bankroll"
          value={formatCurrency(bankrollStats?.current_balance || 0)}
          color="white"
          icon={<Activity size={14} />}
        />
        <StatsCard
          label="Net P&L"
          value={formatCurrency(bankrollStats?.net_pnl || 0)}
          sub={`ROI: ${(bankrollStats?.roi_percent || 0).toFixed(1)}%`}
          color={bankrollStats?.net_pnl && bankrollStats.net_pnl >= 0 ? 'green' : 'red'}
          icon={bankrollStats?.net_pnl && bankrollStats.net_pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        />
        <StatsCard
          label="Win Rate"
          value={`${(bankrollStats?.win_rate || 0).toFixed(1)}%`}
          sub={`${bankrollStats?.won_bets || 0}W / ${bankrollStats?.lost_bets || 0}L`}
          color="amber"
          icon={<Target size={14} />}
        />
        <StatsCard
          label="Today's P&L"
          value={formatCurrency(todayPnl)}
          sub={`${todayBets.length} bets today`}
          color={todayPnl >= 0 ? 'green' : 'red'}
          icon={<Clock size={14} />}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sparkline + Active */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Bankroll sparkline */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-white text-sm">Bankroll Trend (30d)</h2>
            </div>
            <SparklineChart data={bankrollHistory} height={80} showTooltip />
          </div>

          {/* Active bets */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 flex-1">
            <h2 className="font-display font-semibold text-white text-sm mb-3">
              Active Bets
              {activeBets.length > 0 && (
                <span className="ml-2 text-xs font-mono bg-amber-edge/20 text-amber-edge px-2 py-0.5 rounded-full">
                  {activeBets.length}
                </span>
              )}
            </h2>
            {activeBets.length === 0 ? (
              <p className="text-gray-600 text-sm font-mono">No active bets</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeBets.slice(0, 5).map((bet) => (
                  <div key={bet.id} className="flex items-center gap-2 py-2 border-t border-navy-700 first:border-0">
                    <span className="text-lg">{bet.events ? sportEmoji(bet.events.sport) : '🎯'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{bet.selection}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        ${bet.odds.toFixed(2)} · {formatCurrency(bet.stake)}
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 bg-amber-edge/20 text-amber-edge rounded-full">
                      {bet.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Top picks */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-white">
              Top Picks
              {pending.length > 0 && (
                <span className="ml-2 text-xs font-mono text-gray-500">
                  {pending.length} pending
                </span>
              )}
            </h2>
          </div>
          {top3.length === 0 ? (
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-gray-400 font-mono text-sm">
                No high-confidence picks right now
              </p>
              <p className="text-gray-600 font-mono text-xs mt-1">
                {scraperStatus?.running
                  ? 'Scraper is running — data incoming...'
                  : 'Trigger a scrape to find opportunities'}
              </p>
              <button
                onClick={triggerScrape}
                className="mt-4 px-4 py-2 bg-green-edge/20 text-green-edge rounded-xl text-sm font-mono hover:bg-green-edge/30 transition-all"
              >
                Trigger Scrape
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {top3.map((analysis) => (
                <BetCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
