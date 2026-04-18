import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from 'recharts';
import { betsApi, learningApi, bankrollApi } from '../lib/api';
import type { Bet, BankrollLog } from '../types';
import {
  formatCurrency,
  formatEventTime,
  sportEmoji,
  betTypeLabel,
  clsx,
} from '../lib/utils';

type Tab = 'table' | 'pnl' | 'sport' | 'calibration';

export function History() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [bankrollHistory, setBankrollHistory] = useState<BankrollLog[]>([]);
  const [bySport, setBySport] = useState<
    Array<{ sport: string; wins: number; losses: number; total: number; win_rate: number; pnl: number; roi: number }>
  >([]);
  const [calibration, setCalibration] = useState<
    Array<{ confidence_bucket: number; actual_win_rate: number | null; sample_size: number }>
  >([]);
  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [betsData, histData, sportData, calData] = await Promise.allSettled([
          betsApi.history(200),
          bankrollApi.history(90),
          learningApi.bySport(),
          learningApi.calibration(),
        ]);
        if (betsData.status === 'fulfilled') setBets(betsData.value);
        if (histData.status === 'fulfilled') setBankrollHistory(histData.value);
        if (sportData.status === 'fulfilled') setBySport(sportData.value);
        if (calData.status === 'fulfilled') setCalibration(calData.value);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'table', label: 'All Bets' },
    { key: 'pnl', label: 'P&L Chart' },
    { key: 'sport', label: 'By Sport' },
    { key: 'calibration', label: 'AI Calibration' },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: '#111827',
      border: '1px solid #1e2a3a',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'DM Mono, monospace',
    },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-display font-bold text-2xl text-white mb-5">History & Analytics</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-navy-800 border border-navy-700 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-mono transition-all',
              activeTab === key
                ? 'bg-navy-700 text-white'
                : 'text-gray-500 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-navy-800 border border-navy-700 rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Table tab */}
          {activeTab === 'table' && (
            <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 text-xs font-mono text-gray-500 px-4 py-3 border-b border-navy-700">
                <div className="col-span-4">Event / Selection</div>
                <div className="col-span-1 text-center">Type</div>
                <div className="col-span-1 text-right">Odds</div>
                <div className="col-span-1 text-right">Stake</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-1 text-center">Result</div>
                <div className="col-span-2 text-right">P&L</div>
              </div>
              {bets.length === 0 ? (
                <div className="p-12 text-center text-gray-600 font-mono text-sm">
                  No settled bets yet
                </div>
              ) : (
                bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="grid grid-cols-12 items-center px-4 py-3 border-t border-navy-700/50 hover:bg-navy-900/30 transition-colors"
                  >
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span>{bet.events ? sportEmoji(bet.events.sport) : '🎯'}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{bet.selection}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">
                          {bet.events?.event_name}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1 text-center text-xs font-mono text-gray-400">
                      {betTypeLabel(bet.bet_type)}
                    </div>
                    <div className="col-span-1 text-right text-sm font-mono text-white">
                      ${bet.odds.toFixed(2)}
                    </div>
                    <div className="col-span-1 text-right text-sm font-mono text-white">
                      {formatCurrency(bet.stake)}
                    </div>
                    <div className="col-span-2 text-center text-xs font-mono text-gray-500">
                      {bet.settled_at
                        ? new Date(bet.settled_at).toLocaleDateString('en-AU')
                        : '-'}
                    </div>
                    <div className="col-span-1 text-center">
                      <span
                        className={clsx(
                          'text-xs font-mono px-2 py-0.5 rounded-full',
                          bet.outcome === 'WON'
                            ? 'bg-green-edge/20 text-green-edge'
                            : bet.outcome === 'LOST'
                            ? 'bg-red-edge/20 text-red-edge'
                            : 'bg-navy-700 text-gray-400'
                        )}
                      >
                        {bet.outcome || bet.status}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        'col-span-2 text-right text-sm font-mono font-medium',
                        bet.profit_loss && bet.profit_loss > 0
                          ? 'text-green-edge'
                          : bet.profit_loss && bet.profit_loss < 0
                          ? 'text-red-edge'
                          : 'text-gray-400'
                      )}
                    >
                      {bet.profit_loss !== undefined
                        ? formatCurrency(bet.profit_loss)
                        : '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* P&L chart */}
          {activeTab === 'pnl' && (
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5">
              <h2 className="font-display font-semibold text-white mb-4">Bankroll Over Time</h2>
              {bankrollHistory.length < 2 ? (
                <div className="py-12 text-center text-gray-600 font-mono text-sm">
                  Not enough data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={bankrollHistory.map((b) => ({
                      date: new Date(b.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
                      balance: b.balance,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'DM Mono' }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'DM Mono' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Balance']} />
                    <Line type="monotone" dataKey="balance" stroke="#00ff88" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* By sport */}
          {activeTab === 'sport' && (
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5">
              <h2 className="font-display font-semibold text-white mb-4">Performance by Sport</h2>
              {bySport.length === 0 ? (
                <div className="py-12 text-center text-gray-600 font-mono text-sm">No settled bets yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={bySport}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                      <XAxis dataKey="sport" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Win Rate']} />
                      <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="4 4" />
                      <Bar dataKey="win_rate" fill="#00ff88" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-gray-500 border-b border-navy-700">
                          <th className="text-left py-2">Sport</th>
                          <th className="text-right py-2">Bets</th>
                          <th className="text-right py-2">W/L</th>
                          <th className="text-right py-2">Win %</th>
                          <th className="text-right py-2">P&L</th>
                          <th className="text-right py-2">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySport.map((s) => (
                          <tr key={s.sport} className="border-b border-navy-700/50">
                            <td className="py-2.5 text-white">{s.sport}</td>
                            <td className="py-2.5 text-right text-gray-400">{s.total}</td>
                            <td className="py-2.5 text-right text-gray-400">{s.wins}/{s.losses}</td>
                            <td className={clsx('py-2.5 text-right', s.win_rate > 0.5 ? 'text-green-edge' : 'text-red-edge')}>
                              {(s.win_rate * 100).toFixed(1)}%
                            </td>
                            <td className={clsx('py-2.5 text-right', s.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                              {formatCurrency(s.pnl)}
                            </td>
                            <td className={clsx('py-2.5 text-right', s.roi >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                              {s.roi.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Calibration */}
          {activeTab === 'calibration' && (
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5">
              <h2 className="font-display font-semibold text-white mb-1">AI Calibration</h2>
              <p className="text-xs text-gray-500 font-mono mb-4">
                Confidence score vs actual win rate. Perfect calibration follows the diagonal.
              </p>
              {calibration.filter((c) => c.sample_size > 0).length === 0 ? (
                <div className="py-12 text-center text-gray-600 font-mono text-sm">
                  Need more settled bets for calibration data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={calibration.map((c) => ({
                      confidence: c.confidence_bucket,
                      actual: c.actual_win_rate !== null ? c.actual_win_rate * 100 : null,
                      expected: c.confidence_bucket,
                      sample: c.sample_size,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="confidence" tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: 'Confidence %', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} />
                    <ReferenceLine stroke="#f59e0b" strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} label={{ value: 'Perfect', fill: '#6b7280', fontSize: 10 }} />
                    <Line type="monotone" dataKey="expected" stroke="#1e2a3a" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#00ff88" strokeWidth={2} connectNulls={false} dot={{ fill: '#00ff88', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
