import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { RefreshCw, Zap, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';
import { analysesApi } from '../lib/api';
import type { Event, Analysis } from '../types';
import { clsx, sportEmoji, formatCurrency } from '../lib/utils';
import { ConfidenceGauge } from '../components/ConfidenceGauge';

function useCountdownSeconds(targetTime: string) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000))
  );
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetTime]);
  return secs;
}

function BigCountdown({ eventTime }: { eventTime: string }) {
  const s = useCountdownSeconds(eventTime);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const isUrgent = s < 300;
  const isVeryUrgent = s < 60;

  return (
    <div className={clsx('text-center', isVeryUrgent ? 'text-red-edge' : isUrgent ? 'text-amber-edge' : 'text-white')}>
      {h > 0 ? (
        <div className="text-2xl font-display font-bold tabular-nums">{h}h {m}m</div>
      ) : m > 0 ? (
        <div className="flex items-end gap-1 justify-center">
          <span className="text-3xl font-display font-bold tabular-nums leading-none">{m}:{sec.toString().padStart(2, '0')}</span>
          <span className="text-xs text-gray-500 font-mono mb-1">min</span>
        </div>
      ) : (
        <div className={clsx('text-3xl font-display font-bold tabular-nums', isVeryUrgent && 'animate-pulse')}>
          {sec}s
        </div>
      )}
      <div className="text-xs text-gray-500 font-mono mt-0.5">
        {new Date(eventTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

const WINDOW_OPTIONS = [
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: 'All', minutes: 1440 },
];

export function Live() {
  const { events, loadEvents, isLoadingEvents } = useBettingStore();
  const { triggerScrape, scraperStatus, bankrollStats } = useAppStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [window, setWindow] = useState(120);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { confirmBet } = useBettingStore();

  const refresh = useCallback(async () => {
    await loadEvents();
    const data = await analysesApi.list().catch(() => []);
    setAnalyses(data);
  }, []);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const analysisMap = useMemo(
    () => Object.fromEntries(analyses.map(a => [a.event_id, a])),
    [analyses]
  );

  const liveEvents = useMemo(() => {
    const now = Date.now();
    const cutoff = now + window * 60 * 1000;
    return events
      .filter(e => {
        const t = new Date(e.event_time).getTime();
        return t > now - 60000 && t < cutoff;
      })
      .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
  }, [events, window]);

  const betEvents = liveEvents.filter(e => analysisMap[e.id]?.ai_recommendation?.recommendation === 'BET');
  const watchEvents = liveEvents.filter(e => analysisMap[e.id]?.ai_recommendation?.recommendation === 'WATCH');

  async function handleConfirm(analysis: Analysis) {
    setConfirmingId(analysis.id);
    try {
      await confirmBet(analysis);
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-edge animate-pulse" />
            <h1 className="font-display font-bold text-2xl text-white">Live</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            Events in the next {window < 1440 ? `${window / 60}h` : 'day'} · auto-refresh 20s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-navy-800 border border-navy-700 rounded-xl p-0.5">
            {WINDOW_OPTIONS.map(opt => (
              <button key={opt.minutes} onClick={() => setWindow(opt.minutes)}
                className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all',
                  window === opt.minutes ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white'
                )}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={isLoadingEvents}
            className="p-2 rounded-xl bg-navy-800 border border-navy-700 text-gray-500 hover:text-white disabled:opacity-40 transition-all">
            <RefreshCw size={14} className={isLoadingEvents ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatPill label="In Window" value={liveEvents.length} color="white" />
        <StatPill label="BET Signals" value={betEvents.length} color="green" />
        <StatPill label="WATCH" value={watchEvents.length} color="amber" />
        <StatPill label="Analysed" value={liveEvents.filter(e => !!analysisMap[e.id]).length} color="blue" />
      </div>

      {isLoadingEvents ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-56 bg-navy-800 border border-navy-700 rounded-2xl animate-pulse" />)}
        </div>
      ) : liveEvents.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-16 text-center">
          <Clock size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-mono text-sm mb-2">No events in the next {window < 1440 ? `${window / 60}h` : '24h'}</p>
          <p className="text-gray-600 font-mono text-xs mb-5">Trigger a scrape to pull in fresh data from TAB</p>
          <button onClick={() => { triggerScrape(); setTimeout(refresh, 4000); }}
            disabled={scraperStatus?.running}
            className="px-4 py-2 bg-green-edge/20 text-green-edge rounded-xl text-sm font-mono hover:bg-green-edge/30 transition-all disabled:opacity-50">
            {scraperStatus?.running ? 'Scraping...' : 'Trigger Scrape'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {liveEvents.map(ev => (
            <LiveEventCard
              key={ev.id}
              event={ev}
              analysis={analysisMap[ev.id]}
              onConfirm={handleConfirm}
              isConfirming={confirmingId === analysisMap[ev.id]?.id}
              bankroll={bankrollStats?.current_balance}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: 'white' | 'green' | 'amber' | 'blue' }) {
  const styles = {
    white: 'text-white',
    green: 'text-green-edge',
    amber: 'text-amber-edge',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 text-center">
      <div className={clsx('text-2xl font-display font-bold', styles[color])}>{value}</div>
      <div className="text-xs text-gray-500 font-mono mt-0.5">{label}</div>
    </div>
  );
}

function LiveEventCard({
  event, analysis, onConfirm, isConfirming, bankroll
}: {
  event: Event;
  analysis?: Analysis;
  onConfirm: (a: Analysis) => void;
  isConfirming: boolean;
  bankroll?: number;
}) {
  const rec = analysis?.ai_recommendation;
  const isBet = rec?.recommendation === 'BET';
  const isWatch = rec?.recommendation === 'WATCH';
  const runners = event.raw_data?.runners || [];
  const isRacing = event.sport.startsWith('horse_racing');

  return (
    <div className={clsx('bg-navy-800 border rounded-2xl overflow-hidden flex flex-col',
      isBet ? 'border-green-edge/40' : isWatch ? 'border-amber-edge/30' : 'border-navy-700'
    )}>
      {/* Countdown header */}
      <div className={clsx('p-4 border-b border-navy-700/50',
        isBet ? 'bg-green-edge/5' : 'bg-navy-900/30'
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sportEmoji(event.sport)}</span>
              <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full border',
                isBet ? 'bg-green-edge/20 border-green-edge/30 text-green-edge' :
                isWatch ? 'bg-amber-edge/20 border-amber-edge/30 text-amber-edge' :
                'bg-navy-700 border-navy-600 text-gray-400'
              )}>
                {rec?.recommendation || 'PENDING'}
              </span>
            </div>
            <h3 className="text-white font-medium text-sm leading-snug">{event.event_name}</h3>
            {event.raw_data?.venue && (
              <p className="text-xs text-gray-500 font-mono mt-0.5">{event.raw_data.venue}</p>
            )}
          </div>
          <BigCountdown eventTime={event.event_time} />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* AI details */}
        {rec ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 font-mono">Selection</div>
                <div className="text-white font-medium text-sm">{rec.selection}</div>
              </div>
              {analysis && <ConfidenceGauge value={analysis.confidence} size={50} />}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-navy-900 rounded-xl p-2 text-center">
                <div className="text-xs text-gray-500 font-mono">Confidence</div>
                <div className="text-sm font-mono font-bold text-white">{analysis?.confidence}%</div>
              </div>
              <div className="bg-navy-900 rounded-xl p-2 text-center">
                <div className="text-xs text-gray-500 font-mono">EV</div>
                <div className={clsx('text-sm font-mono font-bold',
                  (rec.expected_value || 0) >= 0 ? 'text-green-edge' : 'text-red-edge'
                )}>
                  {((rec.expected_value || 0) * 100) >= 0 ? '+' : ''}{((rec.expected_value || 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-navy-900 rounded-xl p-2 text-center">
                <div className="text-xs text-gray-500 font-mono">Stake</div>
                <div className="text-sm font-mono font-bold text-white">{formatCurrency(rec.suggested_stake || 0)}</div>
              </div>
            </div>

            {rec.risk_flags && rec.risk_flags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {rec.risk_flags.map((f, i) => (
                  <span key={i} className="text-xs font-mono px-1.5 py-0.5 bg-amber-edge/10 text-amber-edge rounded-full flex items-center gap-1">
                    <AlertTriangle size={9} />{f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
            <Zap size={12} />
            Awaiting AI analysis
          </div>
        )}

        {/* Runners preview (racing only) */}
        {isRacing && runners.length > 0 && (
          <div className="border-t border-navy-700/50 pt-3">
            <div className="text-xs text-gray-500 font-mono mb-2">Top runners</div>
            <div className="space-y-1">
              {[...runners].sort((a, b) => (a.odds || 99) - (b.odds || 99)).slice(0, 3).map((r, i) => {
                const isAI = rec?.selection?.toLowerCase().includes(r.name.toLowerCase());
                return (
                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{r.barrier || i + 1}.</span>
                      <span className={clsx(isAI ? 'text-green-edge font-bold' : 'text-gray-300')}>{r.name}</span>
                      {isAI && <span className="w-1.5 h-1.5 rounded-full bg-green-edge animate-pulse" />}
                    </div>
                    <span className={clsx('font-bold', isAI ? 'text-green-edge' : 'text-white')}>
                      {r.odds > 0 ? `$${r.odds.toFixed(2)}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-2 flex gap-2">
          {isBet && analysis ? (
            <button
              onClick={() => onConfirm(analysis)}
              disabled={isConfirming}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-edge text-navy-950 rounded-xl text-sm font-display font-bold hover:bg-green-dim disabled:opacity-60 transition-all">
              {isConfirming ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              {isConfirming ? 'Confirming...' : 'Confirm Bet'}
            </button>
          ) : event.tab_url ? (
            <a href={event.tab_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-navy-700 border border-navy-600 text-gray-300 rounded-xl text-sm font-mono hover:text-white hover:bg-navy-600 transition-all">
              Open TAB ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
