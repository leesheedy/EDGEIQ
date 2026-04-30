import React, { useState, useEffect, useCallback } from 'react';
import {
  Tv, ExternalLink, RefreshCw, ChevronRight, Play,
  X, Radio, Globe, Youtube,
} from 'lucide-react';
import { streamsApi } from '../lib/api';
import { clsx } from '../lib/utils';

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
}

type Filter = 'all' | 'greyhounds' | 'horses' | 'harness';

const FILTER_TABS: { id: Filter; label: string; emoji: string }[] = [
  { id: 'all',         label: 'All',     emoji: '📺' },
  { id: 'greyhounds',  label: 'Dogs',    emoji: '🐕' },
  { id: 'horses',      label: 'Horses',  emoji: '🐎' },
  { id: 'harness',     label: 'Harness', emoji: '🏇' },
];

const ACCENT_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:   { bg: 'from-blue-950 to-indigo-950',   border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300' },
  indigo: { bg: 'from-indigo-950 to-violet-950',  border: 'border-indigo-500/30', text: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300' },
  maroon: { bg: 'from-red-950 to-rose-950',       border: 'border-red-500/30',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300' },
  red:    { bg: 'from-red-950 to-red-900',        border: 'border-red-500/30',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300' },
  green:  { bg: 'from-green-950 to-emerald-950',  border: 'border-green-500/30',  text: 'text-green-400',  badge: 'bg-green-500/20 text-green-300' },
  orange: { bg: 'from-orange-950 to-amber-950',   border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
  sky:    { bg: 'from-sky-950 to-cyan-950',       border: 'border-sky-500/30',    text: 'text-sky-400',    badge: 'bg-sky-500/20 text-sky-300' },
};

function accentOf(s: StreamSource) {
  return ACCENT_STYLES[s.accent] ?? ACCENT_STYLES.blue;
}

function typeEmoji(t: StreamSource['type']) {
  return t === 'greyhounds' ? '🐕' : t === 'horses' ? '🐎' : t === 'harness' ? '🏇' : '📺';
}

// ─── Player modal ─────────────────────────────────────────────────────────────
function PlayerModal({ stream, onClose }: { stream: StreamSource; onClose: () => void }) {
  const a = accentOf(stream);
  const embedSrc = stream.liveVideoId
    ? `https://www.youtube-nocookie.com/embed/${stream.liveVideoId}?autoplay=1&rel=0`
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-900 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className={clsx('w-2 h-2 rounded-full animate-pulse', stream.isLive ? 'bg-red-500' : 'bg-gray-600')} />
          <span className="font-display font-semibold text-white text-sm">{stream.name}</span>
          {stream.isLive && <span className="text-[10px] font-mono text-red-400 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">LIVE</span>}
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-navy-800 text-gray-400 hover:text-white transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-stretch" onClick={e => e.stopPropagation()}>
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full flex-1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={stream.name}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-6xl">{typeEmoji(stream.type)}</div>
            <div className="text-center">
              <h2 className={clsx('font-display font-bold text-xl mb-1', a.text)}>{stream.name}</h2>
              <p className="text-sm text-gray-400 font-mono mb-2">{stream.description}</p>
              {stream.note && <p className="text-xs text-amber-400 font-mono">{stream.note}</p>}
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href={stream.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx('flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl font-display font-bold text-sm text-white transition-all active:scale-95 bg-gradient-to-r', a.bg, 'border', a.border)}
              >
                <Play size={16} />
                Watch Live ↗
              </a>
              <a
                href={stream.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-mono text-sm text-gray-400 bg-navy-800 border border-navy-700 hover:text-white transition-all active:scale-95"
              >
                <Globe size={14} />
                Visit Website
              </a>
            </div>
          </div>
        )}

        {/* Always show open-in-browser when embedded */}
        {embedSrc && (
          <div className="px-4 py-3 border-t border-navy-700 bg-navy-900 flex gap-2 shrink-0">
            <a href={stream.liveUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono text-gray-400 bg-navy-800 border border-navy-700 hover:text-white transition-all">
              <ExternalLink size={12} />
              Open in Browser
            </a>
            <a href={stream.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-mono text-gray-400 bg-navy-800 border border-navy-700 hover:text-white transition-all">
              <Globe size={12} />
              Website
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stream card ──────────────────────────────────────────────────────────────
function StreamCard({ stream, onSelect }: { stream: StreamSource; onSelect: () => void }) {
  const a = accentOf(stream);
  return (
    <button
      onClick={onSelect}
      className={clsx('w-full rounded-2xl border overflow-hidden text-left transition-all hover:scale-[1.01] active:scale-[0.99]', a.border)}
    >
      <div className={clsx('bg-gradient-to-r px-4 py-4 flex items-center gap-3', a.bg)}>
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
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PAID
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 font-mono leading-snug truncate">{stream.description}</p>
        </div>
        <ChevronRight size={16} className="text-white/30 shrink-0" />
      </div>

      <div className="bg-navy-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {stream.platform === 'youtube' ? (
            <Youtube size={11} className="text-red-400" />
          ) : (
            <Globe size={11} className="text-gray-500" />
          )}
          <span className="text-[10px] font-mono text-gray-500 capitalize">{stream.platform}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {stream.states.slice(0, 4).map(st => (
            <span key={st} className={clsx('text-[9px] font-mono px-1.5 py-0.5 rounded-full', a.badge)}>{st}</span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Play size={11} className={a.text} />
          <span className={clsx('text-xs font-mono font-bold', a.text)}>Watch</span>
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
  const [selected, setSelected] = useState<StreamSource | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await streamsApi.list();
      setStreams(data);
      setLastRefresh(new Date());
    } catch {
      // Backend offline — use static fallback
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = streams.filter(s =>
    filter === 'all' ? true : s.type === filter || s.type === 'all'
  );

  const liveCount = streams.filter(s => s.isLive).length;
  const freeCount = streams.filter(s => s.free).length;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Tv size={22} className="text-red-400" />
            <h1 className="font-display font-bold text-2xl text-white">Watch</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            Live racing streams · AU
            {lastRefresh && <span className="ml-2">{lastRefresh.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2.5 rounded-xl bg-navy-800 border border-navy-700 text-gray-500 hover:text-white disabled:opacity-40 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-3 text-center">
          <div className="text-xl font-display font-bold text-white">{streams.length}</div>
          <div className="text-[10px] text-gray-500 font-mono">SOURCES</div>
        </div>
        <div className="bg-navy-800 border border-red-500/20 rounded-2xl p-3 text-center">
          <div className="text-xl font-display font-bold text-red-400">{liveCount > 0 ? liveCount : '—'}</div>
          <div className="text-[10px] text-gray-500 font-mono">LIVE NOW</div>
        </div>
        <div className="bg-navy-800 border border-green-edge/20 rounded-2xl p-3 text-center">
          <div className="text-xl font-display font-bold text-green-edge">{freeCount}</div>
          <div className="text-[10px] text-gray-500 font-mono">FREE</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-navy-800 border border-navy-700 rounded-xl p-1">
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={clsx('flex-1 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1',
              filter === t.id ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white')}>
            <span className="hidden sm:inline">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Live badge */}
      {liveCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 mb-4">
          <Radio size={12} className="text-red-400 animate-pulse" />
          <span className="text-xs font-mono text-red-400">
            {liveCount} stream{liveCount > 1 ? 's' : ''} currently live — tap to watch
          </span>
        </div>
      )}

      {/* Stream list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-navy-800 border border-navy-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <Tv size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-mono text-sm">No streams for this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Live streams first */}
          {filtered.filter(s => s.isLive).length > 0 && (
            <>
              <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                Live now
              </p>
              {filtered.filter(s => s.isLive).map(s => (
                <StreamCard key={s.id} stream={s} onSelect={() => setSelected(s)} />
              ))}
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mt-2">All streams</p>
            </>
          )}
          {filtered.filter(s => !s.isLive).map(s => (
            <StreamCard key={s.id} stream={s} onSelect={() => setSelected(s)} />
          ))}
        </div>
      )}

      {/* Platform note */}
      <div className="mt-5 bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">About streams</p>
        <p className="text-xs text-gray-500 font-mono leading-relaxed">
          YouTube streams open inline. Website streams open in your browser. Live indicators
          require a YouTube API key — add <span className="text-gray-300">YOUTUBE_API_KEY</span> to your backend .env to enable auto-detection.
        </p>
      </div>

      {selected && <PlayerModal stream={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
