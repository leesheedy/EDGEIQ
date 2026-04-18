import React, { useEffect, useMemo, useState } from 'react';
import { useBettingStore } from '../store/useBettingStore';
import { analysesApi } from '../lib/api';
import type { Event, Analysis, Sport } from '../types';
import { formatEventTime, sportEmoji, clsx } from '../lib/utils';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { OddsDisplay } from '../components/OddsDisplay';

const SPORTS: { value: Sport | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sports' },
  { value: 'nrl', label: 'NRL' },
  { value: 'afl', label: 'AFL' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'nba', label: 'NBA' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'tennis', label: 'Tennis' },
];

export function Sports() {
  const { events, loadEvents, isLoadingEvents } = useBettingStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');

  useEffect(() => {
    analysesApi.list().then(setAnalyses).catch(() => {});
  }, []);

  useEffect(() => {
    loadEvents(activeSport === 'all' ? undefined : activeSport);
  }, [activeSport]);

  const sportsEvents = useMemo(
    () =>
      events.filter((e) => {
        const isRacing = e.sport.startsWith('horse_racing');
        if (activeSport === 'all') return !isRacing;
        return e.sport === activeSport;
      }),
    [events, activeSport]
  );

  const analysisMap = useMemo(
    () => Object.fromEntries(analyses.map((a) => [a.event_id, a])),
    [analyses]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-display font-bold text-2xl text-white mb-5">Sports</h1>

      {/* Sport tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SPORTS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveSport(value)}
            className={clsx(
              'px-3 py-2 rounded-xl text-sm font-mono transition-all',
              activeSport === value
                ? 'bg-green-edge/20 text-green-edge border border-green-edge/30'
                : 'bg-navy-800 text-gray-400 border border-navy-700 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Events grid */}
      {isLoadingEvents ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-navy-800 border border-navy-700 rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : sportsEvents.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-3">{activeSport !== 'all' ? sportEmoji(activeSport as Sport) : '🏆'}</div>
          <p className="text-gray-500 font-mono text-sm">No events available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sportsEvents.map((event) => {
            const analysis = analysisMap[event.id];
            return (
              <SportEventCard
                key={event.id}
                event={event}
                analysis={analysis}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SportEventCard({ event, analysis }: { event: Event; analysis?: Analysis }) {
  const [expanded, setExpanded] = useState(false);
  const rec = analysis?.ai_recommendation;
  const d = event.raw_data;

  return (
    <div
      className={clsx(
        'bg-navy-800 border rounded-2xl overflow-hidden transition-all',
        rec?.recommendation === 'BET'
          ? 'border-green-edge/30'
          : rec?.recommendation === 'WATCH'
          ? 'border-amber-edge/30'
          : 'border-navy-700'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{sportEmoji(event.sport)}</span>
            <div className="min-w-0">
              <h3 className="text-white font-medium text-sm truncate">{event.event_name}</h3>
              <p className="text-gray-500 text-xs font-mono">{formatEventTime(event.event_time)}</p>
            </div>
          </div>
          {analysis && (
            <ConfidenceGauge value={analysis.confidence} size={50} showLabel={false} />
          )}
        </div>

        {/* Odds */}
        <div className="mt-3 flex items-center gap-2">
          {d.home_team && (
            <div className="flex-1 bg-navy-900 rounded-xl p-2 text-center">
              <div className="text-xs text-gray-500 font-mono truncate mb-1">{d.home_team}</div>
              {d.home_odds ? (
                <OddsDisplay odds={d.home_odds} size="sm" />
              ) : (
                <span className="text-xs text-gray-600">-</span>
              )}
            </div>
          )}
          {d.draw_odds && (
            <div className="w-16 bg-navy-900 rounded-xl p-2 text-center">
              <div className="text-xs text-gray-500 font-mono mb-1">Draw</div>
              <OddsDisplay odds={d.draw_odds} size="sm" />
            </div>
          )}
          {d.away_team && (
            <div className="flex-1 bg-navy-900 rounded-xl p-2 text-center">
              <div className="text-xs text-gray-500 font-mono truncate mb-1">{d.away_team}</div>
              {d.away_odds ? (
                <OddsDisplay odds={d.away_odds} size="sm" />
              ) : (
                <span className="text-xs text-gray-600">-</span>
              )}
            </div>
          )}
        </div>

        {/* AI badge */}
        {rec && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'text-xs font-mono px-2.5 py-1 rounded-full',
                  rec.recommendation === 'BET'
                    ? 'bg-green-edge/20 text-green-edge'
                    : rec.recommendation === 'WATCH'
                    ? 'bg-amber-edge/20 text-amber-edge'
                    : 'bg-navy-700 text-gray-400'
                )}
              >
                {rec.recommendation}
              </span>
              <span className="text-xs text-gray-400 font-mono">{rec.selection}</span>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-mono text-gray-500 hover:text-white transition-colors"
            >
              {expanded ? 'Less' : 'Analysis ▾'}
            </button>
          </div>
        )}

        {expanded && rec && (
          <div className="mt-3 pt-3 border-t border-navy-700 animate-fade-in">
            <p className="text-xs text-gray-400 leading-relaxed">{rec.reasoning}</p>
            {event.tab_url && (
              <a
                href={event.tab_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-green-edge hover:text-green-dim"
              >
                Open in TAB ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
