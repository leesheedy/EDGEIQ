import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Zap, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';
import { analysesApi } from '../lib/api';
import type { Event, Analysis, Sport } from '../types';
import { formatCurrency, clsx } from '../lib/utils';
import { ConfidenceGauge } from '../components/ConfidenceGauge';

function useCountdownSeconds(targetTime: string) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000))
  );
  useEffect(() => {
    const tick = () =>
      setSecs(Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetTime]);
  return secs;
}

function Countdown({ eventTime, compact = false }: { eventTime: string; compact?: boolean }) {
  const s = useCountdownSeconds(eventTime);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  const urgent = s < 300;
  const vUrgent = s < 60;

  if (compact) {
    return (
      <span className={clsx('text-xs font-mono tabular-nums',
        vUrgent ? 'text-red-edge animate-pulse' : urgent ? 'text-amber-edge' : 'text-gray-500'
      )}>{label}</span>
    );
  }
  return (
    <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono tabular-nums text-sm',
      vUrgent ? 'bg-red-edge/10 border-red-edge/30 text-red-edge animate-pulse' :
      urgent ? 'bg-amber-edge/10 border-amber-edge/30 text-amber-edge' :
      'bg-navy-800 border-navy-600 text-gray-300'
    )}>
      <Clock size={12} />
      {label}
    </div>
  );
}

const TRACK_MAP: Record<string, { color: string; dot: string }> = {
  Firm: { color: 'text-yellow-400', dot: 'bg-yellow-400' },
  Good: { color: 'text-green-edge', dot: 'bg-green-edge' },
  Soft: { color: 'text-blue-400', dot: 'bg-blue-400' },
  Heavy: { color: 'text-purple-400', dot: 'bg-purple-400' },
  Fast: { color: 'text-yellow-300', dot: 'bg-yellow-300' },
  Slow: { color: 'text-orange-400', dot: 'bg-orange-400' },
};

const SPORT_TABS = [
  { value: 'all' as const, label: 'All', emoji: '🏇' },
  { value: 'horse_racing_thoroughbred' as const, label: 'TB', emoji: '🏇' },
  { value: 'horse_racing_harness' as const, label: 'HN', emoji: '🐎' },
  { value: 'horse_racing_greyhound' as const, label: 'GH', emoji: '🐕' },
];

export function Racing() {
  const { events, loadEvents, isLoadingEvents } = useBettingStore();
  const { triggerScrape, scraperStatus } = useAppStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const refresh = useCallback(async () => {
    await loadEvents(activeSport === 'all' ? undefined : activeSport);
    const data = await analysesApi.list().catch(() => []);
    setAnalyses(data);
  }, [activeSport]);

  useEffect(() => { refresh(); }, [activeSport]);

  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const racingEvents = useMemo(() =>
    events
      .filter(e => activeSport === 'all' ? e.sport.startsWith('horse_racing') : e.sport === activeSport)
      .filter(e => new Date(e.event_time).getTime() > Date.now() - 600000)
      .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()),
    [events, activeSport]
  );

  const analysisMap = useMemo(
    () => Object.fromEntries(analyses.map(a => [a.event_id, a])),
    [analyses]
  );

  const grouped = useMemo(() => {
    const g: Record<string, Event[]> = {};
    for (const ev of racingEvents) {
      const v = ev.raw_data?.venue || ev.event_name.split(' Race')[0] || 'Unknown';
      if (!g[v]) g[v] = [];
      g[v].push(ev);
    }
    return g;
  }, [racingEvents]);

  useEffect(() => {
    if (!selectedEvent && racingEvents.length > 0) setSelectedEvent(racingEvents[0]);
  }, [racingEvents]);

  const nextRace = racingEvents[0];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-navy-700 flex flex-col bg-navy-950">
        <div className="p-3 border-b border-navy-700 flex items-center justify-between">
          <div className="flex gap-1">
            {SPORT_TABS.map(({ value, emoji }) => (
              <button key={value} onClick={() => setActiveSport(value)}
                className={clsx('px-2.5 py-1.5 rounded-lg text-sm transition-all',
                  activeSport === value ? 'bg-green-edge/20 text-green-edge' : 'text-gray-500 hover:text-white hover:bg-navy-800'
                )}>
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={isLoadingEvents}
            className="p-1 rounded text-gray-500 hover:text-white disabled:opacity-40 transition-all">
            <RefreshCw size={12} className={isLoadingEvents ? 'animate-spin' : ''} />
          </button>
        </div>

        {nextRace && (
          <button onClick={() => setSelectedEvent(nextRace)}
            className="mx-3 mt-3 p-3 bg-green-edge/5 border border-green-edge/20 rounded-xl text-left hover:bg-green-edge/10 transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-green-edge uppercase tracking-wider">Next Up</span>
              <Countdown eventTime={nextRace.event_time} compact />
            </div>
            <div className="text-sm text-white font-medium truncate">{nextRace.event_name}</div>
            <div className="flex items-center gap-2 mt-1">
              {nextRace.raw_data?.distance && <span className="text-xs text-gray-500 font-mono">{nextRace.raw_data.distance}m</span>}
              {nextRace.raw_data?.track_condition && (
                <span className={clsx('text-xs font-mono', TRACK_MAP[nextRace.raw_data.track_condition]?.color || 'text-gray-500')}>
                  {nextRace.raw_data.track_condition}
                </span>
              )}
            </div>
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {isLoadingEvents ? (
            <div className="flex flex-col gap-2 mt-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-navy-800 rounded-xl animate-pulse" />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🏇</div>
              <p className="text-gray-600 text-xs font-mono mb-4">No racing events yet</p>
              <button
                onClick={() => { triggerScrape(); setTimeout(refresh, 4000); }}
                disabled={scraperStatus?.running}
                className="px-3 py-1.5 bg-green-edge/20 text-green-edge text-xs font-mono rounded-lg hover:bg-green-edge/30 transition-all disabled:opacity-50">
                {scraperStatus?.running ? 'Scraping...' : 'Trigger Scrape'}
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([venue, evs]) => (
              <div key={venue} className="mb-5">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-xs font-mono text-gray-500 uppercase tracking-wider truncate">{venue}</span>
                  <div className="flex-1 h-px bg-navy-800" />
                  <span className="text-xs font-mono text-gray-600">{evs.length}</span>
                </div>
                {evs.map(ev => {
                  const an = analysisMap[ev.id];
                  const rn = ev.raw_data?.race_number || '?';
                  const isSelected = selectedEvent?.id === ev.id;
                  const isBet = an?.ai_recommendation?.recommendation === 'BET';
                  return (
                    <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 text-left transition-all',
                        isSelected ? 'bg-navy-700 border border-green-edge/20' : 'hover:bg-navy-800'
                      )}>
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold shrink-0',
                        isBet ? 'bg-green-edge/20 text-green-edge' : 'bg-navy-700 text-gray-400'
                      )}>
                        R{rn}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs text-white font-medium">
                            {new Date(ev.event_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Countdown eventTime={ev.event_time} compact />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.raw_data?.distance && <span className="text-xs text-gray-600 font-mono">{ev.raw_data.distance}m</span>}
                          {ev.raw_data?.track_condition && (
                            <div className="flex items-center gap-1">
                              <div className={clsx('w-1.5 h-1.5 rounded-full', TRACK_MAP[ev.raw_data.track_condition]?.dot || 'bg-gray-600')} />
                              <span className={clsx('text-xs font-mono', TRACK_MAP[ev.raw_data.track_condition]?.color || 'text-gray-600')}>
                                {ev.raw_data.track_condition}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {an && (
                        <span className={clsx('text-xs font-mono px-1.5 py-0.5 rounded shrink-0',
                          an.confidence >= 80 ? 'bg-green-edge/20 text-green-edge' :
                          an.confidence >= 65 ? 'bg-amber-edge/20 text-amber-edge' :
                          'bg-navy-700 text-gray-500'
                        )}>
                          {an.confidence}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-y-auto bg-navy-950">
        {!selectedEvent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🏇</div>
            <h2 className="font-display font-semibold text-white text-xl mb-2">Select a Race</h2>
            <p className="text-gray-500 font-mono text-sm">Choose a race from the left panel</p>
          </div>
        ) : (
          <RaceDetail event={selectedEvent} analysis={analysisMap[selectedEvent.id]} />
        )}
      </div>
    </div>
  );
}

function RaceDetail({ event, analysis }: { event: Event; analysis?: Analysis }) {
  const runners = event.raw_data?.runners || [];
  const rec = analysis?.ai_recommendation;

  const totalOv = runners.reduce((s, r) => s + (r.odds > 0 ? 1 / r.odds : 0), 0);
  const runnersExt = runners.map(r => ({
    ...r,
    prob: totalOv > 0 && r.odds > 0 ? (1 / r.odds / totalOv) * 100 : 0,
  }));
  const sorted = [...runnersExt].sort((a, b) => (a.odds || 99) - (b.odds || 99));
  const fav = sorted[0];
  const trackStyle = TRACK_MAP[event.raw_data?.track_condition || ''];

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">{event.event_name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {event.raw_data?.venue && <span className="text-sm text-gray-400 font-mono">{event.raw_data.venue}</span>}
            {event.raw_data?.distance && (
              <span className="px-2 py-0.5 bg-navy-800 border border-navy-700 rounded-full text-xs font-mono text-gray-300">
                {event.raw_data.distance}m
              </span>
            )}
            {event.raw_data?.track_condition && (
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-mono border bg-navy-800 border-navy-700',
                trackStyle?.color || 'text-gray-400'
              )}>
                {event.raw_data.track_condition}
              </span>
            )}
          </div>
        </div>
        <Countdown eventTime={event.event_time} />
      </div>

      {/* AI + Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* AI rec */}
        <div className={clsx('col-span-2 p-4 rounded-2xl border',
          rec?.recommendation === 'BET' ? 'bg-green-edge/5 border-green-edge/20' :
          rec?.recommendation === 'WATCH' ? 'bg-amber-edge/5 border-amber-edge/20' :
          'bg-navy-800 border-navy-700'
        )}>
          {rec ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-xs font-display font-bold px-2.5 py-1 rounded-full uppercase tracking-wide',
                    rec.recommendation === 'BET' ? 'bg-green-edge/20 text-green-edge' :
                    rec.recommendation === 'WATCH' ? 'bg-amber-edge/20 text-amber-edge' :
                    'bg-navy-700 text-gray-400'
                  )}>{rec.recommendation}</span>
                  <span className="text-white font-display font-semibold truncate">{rec.selection}</span>
                  {rec.bet_type && (
                    <span className="text-xs font-mono text-gray-500 bg-navy-800 px-2 py-0.5 rounded-full shrink-0">
                      {rec.bet_type.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-500 font-mono mb-0.5">Expected Value</div>
                    <div className={clsx('text-sm font-mono font-bold', (rec.expected_value || 0) >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                      {((rec.expected_value || 0) * 100) >= 0 ? '+' : ''}{((rec.expected_value || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-mono mb-0.5">Suggested Stake</div>
                    <div className="text-sm font-mono font-bold text-white">{formatCurrency(rec.suggested_stake || 0)}</div>
                  </div>
                  {rec.risk_flags && rec.risk_flags.length > 0 && (
                    <div className="flex items-center gap-1 text-xs font-mono text-amber-edge">
                      <AlertTriangle size={12} />
                      {rec.risk_flags.length} flag{rec.risk_flags.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{rec.reasoning}</p>
                {rec.risk_flags && rec.risk_flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rec.risk_flags.map((flag, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-0.5 bg-amber-edge/10 text-amber-edge rounded-full">{flag}</span>
                    ))}
                  </div>
                )}
              </div>
              <ConfidenceGauge value={analysis!.confidence} size={72} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full py-4">
              <div className="text-center">
                <Zap size={20} className="text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm font-mono">No AI analysis yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex flex-col gap-2">
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-3">
            <div className="text-xs text-gray-500 font-mono mb-1.5 uppercase tracking-wider">Favourite</div>
            {fav && fav.odds > 0 ? (
              <>
                <div className="text-white font-medium text-sm truncate">{fav.name}</div>
                <div className="text-green-edge font-mono font-bold text-xl">${fav.odds.toFixed(2)}</div>
                <div className="text-xs text-gray-500 font-mono">{fav.prob.toFixed(1)}% implied</div>
              </>
            ) : <span className="text-gray-600 text-sm font-mono">Unknown</span>}
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-3 flex-1">
            <div className="text-xs text-gray-500 font-mono mb-1.5 uppercase tracking-wider">Field Size</div>
            <div className="text-white font-bold text-3xl font-display">{runners.length}</div>
            <div className="text-xs text-gray-500 font-mono">runners</div>
          </div>
        </div>
      </div>

      {/* Probability distribution */}
      {runners.length > 0 && totalOv > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">Win Probability (Market Implied)</span>
            <span className="text-xs text-gray-600 font-mono">Overround: {(totalOv * 100).toFixed(1)}%</span>
          </div>
          <div className="flex h-5 rounded-lg overflow-hidden gap-px bg-navy-900">
            {sorted.filter(r => r.prob > 0).map((r, i) => {
              const isAI = rec?.selection?.toLowerCase().includes(r.name.toLowerCase());
              const colors = ['bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'];
              return (
                <div key={i} title={`${r.name}: ${r.prob.toFixed(1)}%`}
                  style={{ width: `${r.prob}%` }}
                  className={clsx('transition-all', isAI ? 'bg-green-edge' : colors[i % colors.length])} />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
            {sorted.slice(0, 5).map((r, i) => {
              const isAI = rec?.selection?.toLowerCase().includes(r.name.toLowerCase());
              const colors = ['bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'];
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className={clsx('w-2 h-2 rounded-full', isAI ? 'bg-green-edge' : colors[i % colors.length])} />
                  <span className="text-xs text-gray-500 font-mono">{r.name.split(' ')[0]}</span>
                  <span className="text-xs text-gray-600 font-mono">{r.prob.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Runners table */}
      <div className="bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs font-mono text-gray-500 px-4 py-2.5 border-b border-navy-700 bg-navy-800/80">
          <div className="col-span-1">Bar</div>
          <div className="col-span-3">Runner / Trainer</div>
          <div className="col-span-2">Jockey</div>
          <div className="col-span-1 text-center">Wt</div>
          <div className="col-span-2 text-center">Form</div>
          <div className="col-span-2">Implied %</div>
          <div className="col-span-1 text-right">Odds</div>
        </div>
        {runners.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-gray-600 font-mono text-sm">No runner data scraped</p>
            <p className="text-gray-700 font-mono text-xs mt-1">TAB selectors may need updating</p>
          </div>
        ) : (
          runnersExt
            .sort((a, b) => (a.barrier || 99) - (b.barrier || 99))
            .map((runner, i) => {
              const isAI = rec?.selection?.toLowerCase().includes(runner.name.toLowerCase());
              const form = (runner as any).form || [];
              return (
                <div key={i} className={clsx(
                  'grid grid-cols-12 items-center px-4 py-3 border-b border-navy-700/40 last:border-0 transition-all group',
                  isAI ? 'bg-green-edge/5 hover:bg-green-edge/8' : 'hover:bg-navy-800/40'
                )}>
                  <div className="col-span-1">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-display font-bold',
                      isAI ? 'bg-green-edge text-navy-950' : 'bg-navy-700 text-gray-400 group-hover:bg-navy-600'
                    )}>
                      {runner.barrier || i + 1}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1.5">
                      {isAI && <span className="w-1.5 h-1.5 rounded-full bg-green-edge shrink-0 animate-pulse" />}
                      <div>
                        <div className={clsx('text-sm font-medium', isAI ? 'text-green-edge' : 'text-white')}>{runner.name}</div>
                        {(runner as any).trainer && <div className="text-xs text-gray-600 font-mono truncate">{(runner as any).trainer}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-xs text-gray-400 font-mono truncate">{(runner as any).jockey || '—'}</div>
                  <div className="col-span-1 text-xs text-gray-400 font-mono text-center">{(runner as any).weight || '—'}</div>
                  <div className="col-span-2 flex items-center justify-center gap-0.5">
                    {form.length > 0 ? form.slice(-5).map((f: string, fi: number) => (
                      <div key={fi} className={clsx('w-5 h-5 rounded flex items-center justify-center text-xs font-mono font-bold',
                        f === '1' ? 'bg-green-edge/20 text-green-edge' :
                        f === '2' ? 'bg-blue-500/20 text-blue-400' :
                        f === '3' ? 'bg-purple-500/20 text-purple-400' :
                        f === 'x' || f === 'X' ? 'bg-red-edge/20 text-red-edge' :
                        'bg-navy-700 text-gray-600'
                      )}>{f}</div>
                    )) : <span className="text-gray-600 text-xs">—</span>}
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                        <div className={clsx('h-full rounded-full', isAI ? 'bg-green-edge' : 'bg-blue-500/60')}
                          style={{ width: `${Math.min(100, runner.prob)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 font-mono w-7 text-right tabular-nums">{runner.prob.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    {runner.odds > 0 ? (
                      <span className={clsx('text-sm font-mono font-bold', isAI ? 'text-green-edge' : 'text-white')}>
                        ${runner.odds.toFixed(2)}
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
