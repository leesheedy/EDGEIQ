import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Clock, TrendingUp, AlertTriangle, Zap, Layers, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';
import { analysesApi, sgmApi, type SgmTier } from '../lib/api';
import type { Event, Analysis, Sport } from '../types';
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

function MatchCountdown({ eventTime }: { eventTime: string }) {
  const s = useCountdownSeconds(eventTime);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  const urgent = s < 1800;

  return (
    <div className={clsx('flex items-center gap-1 text-xs font-mono tabular-nums',
      s < 300 ? 'text-red-edge animate-pulse' : urgent ? 'text-amber-edge' : 'text-gray-500'
    )}>
      <Clock size={10} />
      {label}
    </div>
  );
}

const SPORT_TABS = [
  { value: 'all' as const, label: 'All Sports' },
  { value: 'nrl' as const, label: 'NRL' },
  { value: 'afl' as const, label: 'AFL' },
  { value: 'soccer' as const, label: 'Soccer' },
  { value: 'nba' as const, label: 'NBA' },
  { value: 'cricket' as const, label: 'Cricket' },
  { value: 'tennis' as const, label: 'Tennis' },
];

const SPORT_COLORS: Partial<Record<Sport | 'all', string>> = {
  nrl: 'text-green-edge border-green-edge/30 bg-green-edge/10',
  afl: 'text-amber-edge border-amber-edge/30 bg-amber-edge/10',
  soccer: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  nba: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  cricket: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  tennis: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

interface SgmResult {
  low_risk: SgmTier;
  medium_risk: SgmTier;
  value_pick: SgmTier & { key_insight?: string };
  odds_available: boolean;
  note?: string;
}

function SgmCard({ tier, label, color }: { tier: SgmTier & { key_insight?: string }; label: string; color: 'green' | 'amber' | 'purple' }) {
  const [open, setOpen] = useState(false);
  const colors = {
    green: { border: 'border-green-edge/30', bg: 'bg-green-edge/5', badge: 'bg-green-edge/20 text-green-edge', odds: 'text-green-edge' },
    amber: { border: 'border-amber-edge/30', bg: 'bg-amber-edge/5', badge: 'bg-amber-edge/20 text-amber-edge', odds: 'text-amber-edge' },
    purple: { border: 'border-purple-400/30', bg: 'bg-purple-400/5', badge: 'bg-purple-400/20 text-purple-400', odds: 'text-purple-400' },
  }[color];

  return (
    <div className={clsx('border rounded-2xl overflow-hidden', colors.border)}>
      <div className={clsx('px-4 py-3 flex items-center justify-between', colors.bg)}>
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-mono font-bold px-2 py-0.5 rounded-full', colors.badge)}>{label}</span>
          <span className="text-sm font-medium text-white">{tier.title}</span>
          <span className="text-xs text-gray-500 font-mono">{sportEmoji(tier.sport as Sport)} {tier.event.split(' v ')[0]}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={clsx('text-lg font-display font-bold', colors.odds)}>${tier.combined_est_odds.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 font-mono">{tier.confidence}% conf</div>
          </div>
          <button onClick={() => setOpen(v => !v)} className="text-gray-500 hover:text-white transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2">
          <div className="flex flex-col gap-1 mb-3">
            {tier.legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between bg-navy-900/60 rounded-lg px-3 py-2">
                <div>
                  <span className="text-[10px] text-gray-500 font-mono uppercase">{leg.market} · </span>
                  <span className="text-sm text-white font-medium">{leg.selection}</span>
                </div>
                <span className="text-sm font-mono text-gray-300">${leg.est_odds.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {tier.key_insight && (
            <p className={clsx('text-xs font-mono mb-2', colors.odds)}>{tier.key_insight}</p>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">{tier.reasoning}</p>
        </div>
      )}
    </div>
  );
}

export function Sports() {
  const { events, loadEvents, isLoadingEvents } = useBettingStore();
  const { triggerScrape, scraperStatus } = useAppStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'confidence'>('time');
  const [sgm, setSgm] = useState<SgmResult | null>(null);
  const [sgmLoading, setSgmLoading] = useState(false);
  const [sgmError, setSgmError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await loadEvents(activeSport === 'all' ? undefined : activeSport);
    const data = await analysesApi.list().catch(() => []);
    setAnalyses(data);
  }, [activeSport]);

  async function generateSgm() {
    setSgmLoading(true);
    setSgmError(null);
    try {
      const result = await sgmApi.generate();
      setSgm(result);
      if (!result) setSgmError('No sports events available — trigger a scrape first');
    } catch (err) {
      setSgmError(err instanceof Error ? err.message : 'Failed to generate SGM');
    } finally {
      setSgmLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [activeSport]);
  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const analysisMap = useMemo(
    () => Object.fromEntries(analyses.map(a => [a.event_id, a])),
    [analyses]
  );

  const sportsEvents = useMemo(() => {
    const filtered = events.filter(e => {
      const isRacing = e.sport.startsWith('horse_racing');
      if (activeSport === 'all') return !isRacing;
      return e.sport === activeSport;
    }).filter(e => new Date(e.event_time).getTime() > Date.now() - 600000);

    if (sortBy === 'confidence') {
      return filtered.sort((a, b) => (analysisMap[b.id]?.confidence || 0) - (analysisMap[a.id]?.confidence || 0));
    }
    return filtered.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
  }, [events, activeSport, analysisMap, sortBy]);

  const eventsBySport = useMemo(() => {
    const counts: Partial<Record<Sport | 'all', number>> = { all: sportsEvents.length };
    for (const e of sportsEvents) {
      counts[e.sport as Sport] = (counts[e.sport as Sport] || 0) + 1;
    }
    return counts;
  }, [sportsEvents]);

  const betCount = sportsEvents.filter(e => analysisMap[e.id]?.ai_recommendation?.recommendation === 'BET').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Sports</h1>
          {betCount > 0 && (
            <p className="text-xs font-mono text-green-edge mt-0.5">
              {betCount} AI bet recommendation{betCount > 1 ? 's' : ''} live
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-navy-800 border border-navy-700 rounded-xl p-0.5">
            {(['time', 'confidence'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  sortBy === s ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white'
                )}>
                {s === 'time' ? 'By Time' : 'By Confidence'}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={isLoadingEvents}
            className="p-2 rounded-xl bg-navy-800 border border-navy-700 text-gray-500 hover:text-white disabled:opacity-40 transition-all">
            <RefreshCw size={14} className={isLoadingEvents ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sport tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SPORT_TABS.map(({ value, label }) => {
          const count = eventsBySport[value] || 0;
          return (
            <button key={value} onClick={() => setActiveSport(value)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono transition-all',
                activeSport === value
                  ? 'bg-green-edge/20 text-green-edge border border-green-edge/30'
                  : 'bg-navy-800 text-gray-400 border border-navy-700 hover:text-white'
              )}>
              {value !== 'all' && sportEmoji(value as Sport)}
              {label}
              {count > 0 && (
                <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-bold',
                  activeSport === value ? 'bg-green-edge/30 text-green-edge' : 'bg-navy-700 text-gray-500'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SGM Builder */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-purple-400" />
            <span className="font-display font-semibold text-white text-sm">AI SGM Builder</span>
            {!sgm?.odds_available && sgm && (
              <span className="text-[10px] font-mono text-amber-edge bg-amber-edge/10 px-2 py-0.5 rounded-full">Est. odds</span>
            )}
          </div>
          <button
            onClick={generateSgm}
            disabled={sgmLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-400/15 border border-purple-400/30 text-purple-400 rounded-xl text-xs font-mono hover:bg-purple-400/20 transition-all disabled:opacity-50"
          >
            {sgmLoading ? <><RefreshCw size={12} className="animate-spin" />Analysing...</> : <><Sparkles size={12} />Generate SGM</>}
          </button>
        </div>

        {sgmError && (
          <p className="text-xs text-red-edge font-mono bg-red-edge/10 rounded-xl p-3">{sgmError}</p>
        )}

        {!sgm && !sgmLoading && !sgmError && (
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-400/10 flex items-center justify-center shrink-0">
              <Layers size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Same Game Multi recommendations</p>
              <p className="text-xs text-gray-500 font-mono">Get AI-generated SGM suggestions across 3 risk tiers — low, medium, and value pick</p>
            </div>
          </div>
        )}

        {sgm && (
          <div className="flex flex-col gap-2">
            <SgmCard tier={sgm.low_risk} label="Low Risk" color="green" />
            <SgmCard tier={sgm.medium_risk} label="Medium Risk" color="amber" />
            <SgmCard tier={sgm.value_pick} label="Value Pick" color="purple" />
            {sgm.note && (
              <p className="text-xs text-gray-500 font-mono px-1">{sgm.note}</p>
            )}
            {!sgm.odds_available && (
              <p className="text-xs text-amber-edge/70 font-mono px-1">
                Odds estimates only — add ODDS_API_KEY to Railway for real-time AU odds
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoadingEvents ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-navy-800 border border-navy-700 rounded-2xl animate-pulse" />)}
        </div>
      ) : sportsEvents.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">{activeSport !== 'all' ? sportEmoji(activeSport as Sport) : '🏆'}</div>
          <p className="text-gray-500 font-mono text-sm mb-4">No events available</p>
          <button onClick={() => { triggerScrape(); setTimeout(refresh, 4000); }}
            disabled={scraperStatus?.running}
            className="px-4 py-2 bg-green-edge/20 text-green-edge rounded-xl text-sm font-mono hover:bg-green-edge/30 transition-all disabled:opacity-50">
            {scraperStatus?.running ? 'Scraping...' : 'Trigger Scrape'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sportsEvents.map(event => (
            <MatchCard key={event.id} event={event} analysis={analysisMap[event.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ event, analysis }: { event: Event; analysis?: Analysis }) {
  const [expanded, setExpanded] = useState(false);
  const rec = analysis?.ai_recommendation;
  const d = event.raw_data;
  const sportStyle = SPORT_COLORS[event.sport as Sport] || 'text-gray-400 border-gray-400/30 bg-gray-400/10';

  const homeProb = d?.home_odds && d.home_odds > 0 ? (1 / d.home_odds) : 0;
  const drawProb = d?.draw_odds && d.draw_odds > 0 ? (1 / d.draw_odds) : 0;
  const awayProb = d?.away_odds && d.away_odds > 0 ? (1 / d.away_odds) : 0;
  const total = homeProb + drawProb + awayProb;
  const homeW = total > 0 ? (homeProb / total) * 100 : 50;
  const drawW = total > 0 ? (drawProb / total) * 100 : 0;
  const awayW = total > 0 ? (awayProb / total) * 100 : 50;

  const isHomeRec = rec?.selection?.toLowerCase().includes(d?.home_team?.toLowerCase() || '##');
  const isAwayRec = rec?.selection?.toLowerCase().includes(d?.away_team?.toLowerCase() || '##');

  return (
    <div className={clsx('bg-navy-800 border rounded-2xl overflow-hidden transition-all',
      rec?.recommendation === 'BET' ? 'border-green-edge/30' :
      rec?.recommendation === 'WATCH' ? 'border-amber-edge/30' :
      'border-navy-700'
    )}>
      {/* Top bar: sport + time */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full border', sportStyle)}>
            {event.sport.toUpperCase()}
          </span>
          {rec?.recommendation === 'BET' && (
            <span className="flex items-center gap-1 text-xs font-mono bg-green-edge/20 text-green-edge px-2 py-0.5 rounded-full">
              <Zap size={10} />BET
            </span>
          )}
        </div>
        <MatchCountdown eventTime={event.event_time} />
      </div>

      <div className="p-4">
        {/* Teams vs odds */}
        {d?.home_team && d?.away_team ? (
          <div className="mb-4">
            {/* Team comparison */}
            <div className="flex items-center gap-2 mb-3">
              {/* Home */}
              <div className={clsx('flex-1 flex flex-col items-center p-3 rounded-xl transition-all',
                isHomeRec ? 'bg-green-edge/10 border border-green-edge/20' : 'bg-navy-900/50'
              )}>
                <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold mb-1.5',
                  isHomeRec ? 'bg-green-edge/20 text-green-edge' : 'bg-navy-700 text-gray-300'
                )}>
                  {d.home_team.substring(0, 2).toUpperCase()}
                </div>
                <div className={clsx('text-sm font-medium text-center truncate w-full', isHomeRec ? 'text-green-edge' : 'text-white')}>
                  {d.home_team}
                </div>
                {d.home_odds ? (
                  <div className={clsx('text-lg font-mono font-bold mt-1', isHomeRec ? 'text-green-edge' : 'text-white')}>
                    ${d.home_odds.toFixed(2)}
                  </div>
                ) : <span className="text-gray-600 text-sm">—</span>}
                <div className="text-xs text-gray-500 font-mono">{homeW.toFixed(0)}%</div>
              </div>

              {/* vs / draw */}
              <div className="flex flex-col items-center shrink-0">
                {d.draw_odds ? (
                  <div className="bg-navy-900 rounded-xl p-2 text-center">
                    <div className="text-xs text-gray-500 font-mono mb-0.5">Draw</div>
                    <div className="text-sm font-mono font-bold text-gray-300">${d.draw_odds.toFixed(2)}</div>
                    <div className="text-xs text-gray-600 font-mono">{drawW.toFixed(0)}%</div>
                  </div>
                ) : (
                  <span className="text-gray-600 font-mono text-sm px-2">VS</span>
                )}
              </div>

              {/* Away */}
              <div className={clsx('flex-1 flex flex-col items-center p-3 rounded-xl transition-all',
                isAwayRec ? 'bg-green-edge/10 border border-green-edge/20' : 'bg-navy-900/50'
              )}>
                <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold mb-1.5',
                  isAwayRec ? 'bg-green-edge/20 text-green-edge' : 'bg-navy-700 text-gray-300'
                )}>
                  {d.away_team.substring(0, 2).toUpperCase()}
                </div>
                <div className={clsx('text-sm font-medium text-center truncate w-full', isAwayRec ? 'text-green-edge' : 'text-white')}>
                  {d.away_team}
                </div>
                {d.away_odds ? (
                  <div className={clsx('text-lg font-mono font-bold mt-1', isAwayRec ? 'text-green-edge' : 'text-white')}>
                    ${d.away_odds.toFixed(2)}
                  </div>
                ) : <span className="text-gray-600 text-sm">—</span>}
                <div className="text-xs text-gray-500 font-mono">{awayW.toFixed(0)}%</div>
              </div>
            </div>

            {/* Probability bar */}
            {total > 0 && (
              <div>
                <div className="flex h-2 rounded-full overflow-hidden gap-px">
                  <div style={{ width: `${homeW}%` }}
                    className={clsx('transition-all', isHomeRec ? 'bg-green-edge' : 'bg-blue-500')} />
                  {drawW > 0 && <div style={{ width: `${drawW}%` }} className="bg-gray-500" />}
                  <div style={{ width: `${awayW}%` }}
                    className={clsx('transition-all', isAwayRec ? 'bg-green-edge' : 'bg-purple-500')} />
                </div>
                <div className="flex justify-between text-xs text-gray-600 font-mono mt-1">
                  <span>{d.home_team?.split(' ').pop()}</span>
                  {drawW > 0 && <span>Draw</span>}
                  <span>{d.away_team?.split(' ').pop()}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <h3 className="text-white font-medium text-sm">{event.event_name}</h3>
          </div>
        )}

        {/* AI section */}
        {rec && (
          <div className={clsx('rounded-xl p-3 border',
            rec.recommendation === 'BET' ? 'bg-green-edge/5 border-green-edge/15' :
            rec.recommendation === 'WATCH' ? 'bg-amber-edge/5 border-amber-edge/15' :
            'bg-navy-900/50 border-navy-700/50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full',
                  rec.recommendation === 'BET' ? 'bg-green-edge/20 text-green-edge' :
                  rec.recommendation === 'WATCH' ? 'bg-amber-edge/20 text-amber-edge' :
                  'bg-navy-700 text-gray-400'
                )}>{rec.recommendation}</span>
                <span className="text-xs text-gray-300 font-medium">{rec.selection}</span>
                {rec.expected_value !== undefined && (
                  <span className={clsx('text-xs font-mono',
                    (rec.expected_value || 0) >= 0 ? 'text-green-edge' : 'text-red-edge'
                  )}>
                    EV {((rec.expected_value || 0) * 100) >= 0 ? '+' : ''}{((rec.expected_value || 0) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceGauge value={analysis!.confidence} size={44} showLabel={false} />
                <button onClick={() => setExpanded(v => !v)}
                  className="text-xs font-mono text-gray-500 hover:text-white transition-colors">
                  {expanded ? '▲' : '▾'}
                </button>
              </div>
            </div>

            {expanded && (
              <div className="mt-3 pt-3 border-t border-navy-700/50 space-y-2">
                <p className="text-xs text-gray-400 leading-relaxed">{rec.reasoning}</p>
                {rec.risk_flags && rec.risk_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.risk_flags.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-amber-edge/10 text-amber-edge rounded-full">
                        <AlertTriangle size={9} />{f}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <div>
                    <span className="text-xs text-gray-500 font-mono">Confidence: </span>
                    <span className="text-xs font-mono text-white">{analysis!.confidence}%</span>
                  </div>
                  {rec.suggested_stake && (
                    <div>
                      <span className="text-xs text-gray-500 font-mono">Stake: </span>
                      <span className="text-xs font-mono text-white">{formatCurrency(rec.suggested_stake)}</span>
                    </div>
                  )}
                  {event.tab_url && (
                    <a href={event.tab_url} target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-xs font-mono text-green-edge hover:underline">
                      Open TAB ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!rec && (
          <div className="bg-navy-900/40 border border-navy-700/50 rounded-xl p-3 flex items-center gap-2">
            <Zap size={12} className="text-gray-600" />
            <span className="text-xs text-gray-600 font-mono">Awaiting AI analysis</span>
          </div>
        )}
      </div>
    </div>
  );
}
