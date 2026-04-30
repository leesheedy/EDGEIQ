import React, { useState, useEffect, useCallback } from 'react';
import {
  Tv, ExternalLink, RefreshCw, ChevronRight, Play,
  X, Radio, Globe, Youtube, MapPin, Hash, Clock,
} from 'lucide-react';
import { streamsApi } from '../lib/api';
import { clsx } from '../lib/utils';

export interface RaceInfo {
  venue?: string;
  raceNo?: number;
  raceName?: string;
  distance?: string;
  startTime?: string;
}

export interface StreamSource {
  id: string;
  name: string;
  description: string;
  type: 'greyhounds' | 'horses' | 'harness' | 'all';
  states: string[];
  platform: 'youtube' | 'website';
  handle?: string;
  channelId?: string;
  liveUrl: string;
  website: string;
  accent: string;
  free: boolean;
  note?: string;
  liveVideoId?: string;
  isLive?: boolean;
  currentRace?: RaceInfo;
}

type Filter = 'all' | 'greyhounds' | 'horses' | 'harness';

const FILTER_TABS: { id: Filter; label: string; emoji: string }[] = [
  { id: 'all',        label: 'All',     emoji: '📺' },
  { id: 'greyhounds', label: 'Dogs',    emoji: '🐕' },
  { id: 'horses',     label: 'Horses',  emoji: '🐎' },
  { id: 'harness',    label: 'Harness', emoji: '🏇' },
];

const ACCENT: Record<string, { bg: string; border: string; text: string; pill: string; liveRing: string }> = {
  blue:   { bg: 'from-blue-950 to-indigo-950',   border: 'border-blue-500/30',   text: 'text-blue-400',   pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30',   liveRing: 'ring-blue-500/40' },
  indigo: { bg: 'from-indigo-950 to-violet-950',  border: 'border-indigo-500/30', text: 'text-indigo-400', pill: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', liveRing: 'ring-indigo-500/40' },
  maroon: { bg: 'from-red-950 to-rose-950',       border: 'border-red-500/30',    text: 'text-red-400',    pill: 'bg-red-500/20 text-red-300 border-red-500/30',    liveRing: 'ring-red-500/40' },
  red:    { bg: 'from-red-950 to-red-900',        border: 'border-red-500/30',    text: 'text-red-400',    pill: 'bg-red-500/20 text-red-300 border-red-500/30',    liveRing: 'ring-red-500/40' },
  green:  { bg: 'from-green-950 to-emerald-950',  border: 'border-green-500/30',  text: 'text-green-400',  pill: 'bg-green-500/20 text-green-300 border-green-500/30', liveRing: 'ring-green-500/40' },
  orange: { bg: 'from-orange-950 to-amber-950',   border: 'border-orange-500/30', text: 'text-orange-400', pill: 'bg-orange-500/20 text-orange-300 border-orange-500/30', liveRing: 'ring-orange-500/40' },
  sky:    { bg: 'from-sky-950 to-cyan-950',       border: 'border-sky-500/30',    text: 'text-sky-400',    pill: 'bg-sky-500/20 text-sky-300 border-sky-500/30',    liveRing: 'ring-sky-500/40' },
};

function a(s: StreamSource) { return ACCENT[s.accent] ?? ACCENT.blue; }
function typeEmoji(t: StreamSource['type']) {
  return t === 'greyhounds' ? '🐕' : t === 'horses' ? '🐎' : t === 'harness' ? '🏇' : '📺';
}

// ─── Race info strip ──────────────────────────────────────────────────────────
function RaceInfoStrip({ race, accent }: { race: RaceInfo; accent: string }) {
  const ac = ACCENT[accent] ?? ACCENT.blue;
  return (
    <div className={clsx('flex flex-wrap items-center gap-3 px-4 py-2.5 bg-black/30 border-t', ac.border.replace('/30', '/20'))}>
      {race.venue && (
        <div className="flex items-center gap-1">
          <MapPin size={10} className={ac.text} />
          <span className={clsx('text-xs font-mono font-semibold', ac.text)}>{race.venue}</span>
        </div>
      )}
      {race.raceNo && (
        <div className="flex items-center gap-1">
          <Hash size={10} className="text-gray-500" />
          <span className="text-xs font-mono text-gray-400">Race {race.raceNo}</span>
        </div>
      )}
      {race.distance && (
        <span className="text-xs font-mono text-gray-500">{race.distance}</span>
      )}
      {race.raceName && (
        <span className="text-xs font-mono text-gray-400 truncate flex-1">{race.raceName}</span>
      )}
      {race.startTime && (
        <div className="flex items-center gap-1 ml-auto">
          <Clock size={10} className="text-gray-600" />
          <span className="text-[10px] font-mono text-gray-600">
            {new Date(race.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Inline embed card ────────────────────────────────────────────────────────
function EmbedCard({ stream, onClose }: { stream: StreamSource; onClose: () => void }) {
  const ac = a(stream);
  const embedSrc = stream.liveVideoId
    ? `https://www.youtube-nocookie.com/embed/${stream.liveVideoId}?autoplay=1&rel=0&modestbranding=1`
    : null;

  return (
    <div className={clsx('rounded-2xl border overflow-hidden', ac.border, `ring-2 ${ac.liveRing}`)}>
      {/* Header */}
      <div className={clsx('bg-gradient-to-r px-4 py-3 flex items-center gap-3', ac.bg)}>
        <span className="text-2xl">{typeEmoji(stream.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white text-sm">{stream.name}</span>
            {stream.isLive && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/50 font-mono truncate">{stream.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <a href={stream.liveUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-black/20 text-white/60 hover:text-white transition-all">
            <ExternalLink size={13} />
          </a>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-black/20 text-white/60 hover:text-white transition-all">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Player */}
      {embedSrc ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedSrc}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={stream.name}
          />
        </div>
      ) : (
        <div className={clsx('bg-gradient-to-br flex flex-col items-center justify-center gap-4 py-12', ac.bg)}>
          <div className="text-5xl">{typeEmoji(stream.type)}</div>
          <div className="text-center px-4">
            <p className="text-white/60 text-sm font-mono mb-1">Stream not detected live right now</p>
            {stream.note && <p className="text-amber-400 text-xs font-mono">{stream.note}</p>}
          </div>
          <a href={stream.liveUrl} target="_blank" rel="noopener noreferrer"
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm text-white border transition-all', ac.border, 'bg-black/30 hover:bg-black/50')}>
            <Play size={14} />
            Open Stream ↗
          </a>
        </div>
      )}

      {/* Race info */}
      {stream.currentRace && <RaceInfoStrip race={stream.currentRace} accent={stream.accent} />}

      {/* Bottom bar */}
      <div className="bg-navy-900 px-4 py-2.5 flex items-center gap-3">
        {stream.platform === 'youtube' ? (
          <div className="flex items-center gap-1.5">
            <Youtube size={11} className="text-red-400" />
            <span className="text-[10px] font-mono text-gray-500">YouTube</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Globe size={11} className="text-gray-500" />
            <span className="text-[10px] font-mono text-gray-500">{stream.website.replace('https://', '').split('/')[0]}</span>
          </div>
        )}
        <div className="flex gap-1 flex-wrap">
          {stream.states.slice(0, 4).map(st => (
            <span key={st} className={clsx('text-[9px] font-mono px-1.5 py-0.5 rounded-full border', ac.pill)}>{st}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stream list card ─────────────────────────────────────────────────────────
function StreamCard({ stream, onSelect }: { stream: StreamSource; onSelect: () => void }) {
  const ac = a(stream);
  return (
    <button onClick={onSelect}
      className={clsx('w-full rounded-2xl border overflow-hidden text-left transition-all hover:scale-[1.01] active:scale-[0.99]',
        stream.isLive ? `${ac.border} ring-1 ${ac.liveRing}` : 'border-navy-700')}>
      <div className={clsx('bg-gradient-to-r px-4 py-4 flex items-center gap-3', stream.isLive ? ac.bg : 'from-navy-800 to-navy-800')}>
        <div className="text-3xl shrink-0">{typeEmoji(stream.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-display font-bold text-white text-sm">{stream.name}</span>
            {stream.isLive && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                LIVE
              </span>
            )}
            {!stream.free && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">PAID</span>
            )}
          </div>
          <p className={clsx('text-xs font-mono leading-snug truncate', stream.isLive ? 'text-white/70' : 'text-gray-500')}>
            {stream.description}
          </p>
          {/* Race info inline on card */}
          {stream.currentRace?.venue && (
            <div className="flex items-center gap-2 mt-1">
              <MapPin size={9} className={ac.text} />
              <span className={clsx('text-[10px] font-mono font-semibold', ac.text)}>{stream.currentRace.venue}</span>
              {stream.currentRace.raceNo && (
                <span className="text-[10px] font-mono text-gray-500">R{stream.currentRace.raceNo}</span>
              )}
              {stream.currentRace.distance && (
                <span className="text-[10px] font-mono text-gray-600">{stream.currentRace.distance}</span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={16} className="text-white/30 shrink-0" />
      </div>

      <div className="bg-navy-800/80 px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {stream.platform === 'youtube' ? (
            <Youtube size={10} className="text-red-400" />
          ) : (
            <Globe size={10} className="text-gray-500" />
          )}
          <span className="text-[10px] font-mono text-gray-500 capitalize">{stream.platform}</span>
        </div>
        <div className="flex gap-1 flex-wrap flex-1">
          {stream.states.slice(0, 3).map(st => (
            <span key={st} className={clsx('text-[9px] font-mono px-1.5 py-0.5 rounded-full border', ac.pill)}>{st}</span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Play size={10} className={stream.isLive ? ac.text : 'text-gray-600'} />
          <span className={clsx('text-[10px] font-mono font-bold', stream.isLive ? ac.text : 'text-gray-600')}>
            {stream.isLive ? 'Watch Live' : 'Watch'}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function Watch() {
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (forceRefresh) {
        // Tell backend to bust its cache
        const base = `${import.meta.env.VITE_API_URL ?? 'https://edgeiq-production-6e47.up.railway.app'}/api`;
        await fetch(`${base}/streams/refresh`, { method: 'POST' }).catch(() => {});
      }
      const data = await streamsApi.list();
      setStreams(data);
      setLastRefresh(new Date());
      // Check if any stream is live and auto-expand first live stream
      const firstLive = data.find(s => s.isLive);
      if (firstLive && !expanded) setExpanded(firstLive.id);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  useEffect(() => { load(); }, []);

  // Poll every 3 minutes
  useEffect(() => {
    const t = setInterval(() => load(), 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = streams.filter(s =>
    filter === 'all' ? true : s.type === filter || s.type === 'all'
  );

  const liveStreams = filtered.filter(s => s.isLive);
  const otherStreams = filtered.filter(s => !s.isLive);
  const totalLive = streams.filter(s => s.isLive).length;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Tv size={22} className="text-red-400" />
            <h1 className="font-display font-bold text-2xl text-white">Watch</h1>
            {totalLive > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {totalLive} live
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            AU racing streams · {lastRefresh ? lastRefresh.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : 'loading...'}
            </p>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="p-2.5 rounded-xl bg-navy-800 border border-navy-700 text-gray-500 hover:text-white disabled:opacity-40 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-navy-800 border border-navy-700 rounded-xl p-1">
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={clsx('flex-1 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1',
              filter === t.id ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white')}>
            <span>{t.emoji}</span><span className="hidden xs:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-navy-800 border border-navy-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <Tv size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-mono text-sm">No streams for this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Live streams — shown as expanded embed cards */}
          {liveStreams.length > 0 && (
            <>
              <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={10} className="animate-pulse" />
                Live now
              </p>
              {liveStreams.map(s => (
                <div key={s.id}>
                  {expanded === s.id ? (
                    <EmbedCard stream={s} onClose={() => setExpanded(null)} />
                  ) : (
                    <StreamCard stream={s} onSelect={() => setExpanded(s.id)} />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Other streams */}
          {otherStreams.length > 0 && (
            <>
              {liveStreams.length > 0 && (
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mt-2">All streams</p>
              )}
              {otherStreams.map(s => (
                <div key={s.id}>
                  {expanded === s.id ? (
                    <EmbedCard stream={s} onClose={() => setExpanded(null)} />
                  ) : (
                    <StreamCard stream={s} onSelect={() => setExpanded(s.id)} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Info footer */}
      {!loading && (
        <div className="mt-5 bg-navy-800 border border-navy-700 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
            Streams auto-detected every 3 min. Tap refresh to check now.
            Add <span className="text-gray-400">YOUTUBE_API_KEY</span> to backend .env for more reliable live detection.
          </p>
        </div>
      )}
    </div>
  );
}
