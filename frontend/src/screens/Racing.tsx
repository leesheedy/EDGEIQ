import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { analysesApi } from '../lib/api';
import type { Event, Analysis, Sport } from '../types';
import {
  formatEventTime,
  formatOdds,
  clsx,
} from '../lib/utils';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { OddsDisplay } from '../components/OddsDisplay';

const RACING_SPORTS: { value: Sport | 'all'; label: string }[] = [
  { value: 'all', label: 'All Racing' },
  { value: 'horse_racing_thoroughbred', label: 'Thoroughbred' },
  { value: 'horse_racing_harness', label: 'Harness' },
  { value: 'horse_racing_greyhound', label: 'Greyhound' },
];

const TRACK_CONDITION_COLORS: Record<string, string> = {
  Firm: 'text-yellow-400',
  Good: 'text-green-edge',
  Soft: 'text-blue-400',
  Heavy: 'text-purple-400',
  Fast: 'text-yellow-300',
  Slow: 'text-orange-400',
};

export function Racing() {
  const { events, loadEvents, isLoadingEvents } = useBettingStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
    analysesApi.list().then(setAnalyses).catch(() => {});
  }, []);

  useEffect(() => {
    loadEvents(activeSport === 'all' ? undefined : activeSport);
  }, [activeSport]);

  const racingEvents = useMemo(
    () =>
      events.filter((e) =>
        activeSport === 'all'
          ? e.sport.startsWith('horse_racing')
          : e.sport === activeSport
      ),
    [events, activeSport]
  );

  const analysisMap = useMemo(
    () =>
      Object.fromEntries(analyses.map((a) => [a.event_id, a])),
    [analyses]
  );

  const groupedByVenue = useMemo(() => {
    const groups: Record<string, Event[]> = {};
    for (const ev of racingEvents) {
      const venue = ev.raw_data?.venue || ev.event_name.split(' Race')[0] || 'Unknown';
      if (!groups[venue]) groups[venue] = [];
      groups[venue].push(ev);
    }
    return groups;
  }, [racingEvents]);

  return (
    <div className="flex h-full">
      {/* Left panel: meetings list */}
      <div className="w-72 shrink-0 border-r border-navy-700 flex flex-col">
        {/* Tabs */}
        <div className="p-3 border-b border-navy-700">
          <div className="flex flex-wrap gap-1">
            {RACING_SPORTS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveSport(value)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                  activeSport === value
                    ? 'bg-green-edge/20 text-green-edge'
                    : 'text-gray-500 hover:text-white hover:bg-navy-800'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoadingEvents ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-navy-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : Object.keys(groupedByVenue).length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm font-mono">
              No racing events
            </div>
          ) : (
            Object.entries(groupedByVenue).map(([venue, evs]) => (
              <div key={venue} className="mb-4">
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider px-1 mb-1">
                  {venue}
                </div>
                {evs
                  .sort(
                    (a, b) =>
                      new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
                  )
                  .map((ev) => {
                    const analysis = analysisMap[ev.id];
                    const raceNum = ev.raw_data?.race_number || '?';
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1 text-left transition-all',
                          selectedEvent?.id === ev.id
                            ? 'bg-navy-700 border border-navy-600'
                            : 'hover:bg-navy-800'
                        )}
                      >
                        <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center text-xs font-mono text-gray-400">
                          R{raceNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-medium truncate">
                            {new Date(ev.event_time).toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {ev.raw_data?.distance || '?'}m ·{' '}
                            <span
                              className={
                                TRACK_CONDITION_COLORS[ev.raw_data?.track_condition || ''] ||
                                'text-gray-500'
                              }
                            >
                              {ev.raw_data?.track_condition || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        {analysis && (
                          <div
                            className={clsx(
                              'text-xs font-mono px-1.5 py-0.5 rounded',
                              analysis.confidence >= 80
                                ? 'bg-green-edge/20 text-green-edge'
                                : analysis.confidence >= 65
                                ? 'bg-amber-edge/20 text-amber-edge'
                                : 'bg-navy-700 text-gray-500'
                            )}
                          >
                            {analysis.confidence}%
                          </div>
                        )}
                        <ChevronRight size={12} className="text-gray-600" />
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: race card detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedEvent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🏇</div>
            <h2 className="font-display font-semibold text-white text-xl mb-2">
              Select a Race
            </h2>
            <p className="text-gray-500 font-mono text-sm">
              Choose a meeting and race from the left panel
            </p>
          </div>
        ) : (
          <RaceCard event={selectedEvent} analysis={analysisMap[selectedEvent.id]} />
        )}
      </div>
    </div>
  );
}

function RaceCard({ event, analysis }: { event: Event; analysis?: Analysis }) {
  const runners = event.raw_data?.runners || [];
  const recommendation = analysis?.ai_recommendation;

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h2 className="font-display font-bold text-xl text-white">{event.event_name}</h2>
        <div className="flex flex-wrap gap-3 mt-1 text-xs font-mono text-gray-500">
          <span>{formatEventTime(event.event_time)}</span>
          {event.raw_data?.distance && <span>{event.raw_data.distance}m</span>}
          {event.raw_data?.track_condition && (
            <span
              className={
                TRACK_CONDITION_COLORS[event.raw_data.track_condition] || 'text-gray-500'
              }
            >
              {event.raw_data.track_condition}
            </span>
          )}
        </div>
      </div>

      {/* AI Recommendation */}
      {recommendation && (
        <div
          className={clsx(
            'mb-4 p-4 rounded-2xl border',
            recommendation.recommendation === 'BET'
              ? 'bg-green-edge/10 border-green-edge/30'
              : 'bg-amber-edge/10 border-amber-edge/30'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  'text-sm font-display font-bold px-3 py-1 rounded-full',
                  recommendation.recommendation === 'BET'
                    ? 'bg-green-edge/20 text-green-edge'
                    : 'bg-amber-edge/20 text-amber-edge'
                )}
              >
                {recommendation.recommendation}
              </span>
              <span className="text-white font-medium">{recommendation.selection}</span>
            </div>
            <ConfidenceGauge value={analysis.confidence} size={60} />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
            {recommendation.reasoning}
          </p>
        </div>
      )}

      {/* Runners table */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs font-mono text-gray-500 px-4 py-2 border-b border-navy-700">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Runner</div>
          <div className="col-span-2">Jockey</div>
          <div className="col-span-1 text-center">Wt</div>
          <div className="col-span-2 text-center">Form</div>
          <div className="col-span-2 text-right">Odds</div>
        </div>
        {runners.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600 font-mono text-sm">
            No runner data available
          </div>
        ) : (
          runners.map((runner, i) => {
            const isSelected =
              recommendation?.selection?.toLowerCase().includes(runner.name.toLowerCase());
            return (
              <div
                key={i}
                className={clsx(
                  'grid grid-cols-12 items-center px-4 py-3 border-b border-navy-700/50 last:border-0 transition-colors',
                  isSelected ? 'bg-green-edge/5' : 'hover:bg-navy-900/50'
                )}
              >
                <div className="col-span-1 font-mono text-gray-500 text-sm">
                  {runner.barrier || i + 1}
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-edge shrink-0" />
                  )}
                  <span
                    className={clsx(
                      'text-sm font-medium truncate',
                      isSelected ? 'text-green-edge' : 'text-white'
                    )}
                  >
                    {runner.name}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-gray-500 font-mono truncate">
                  {runner.jockey || '-'}
                </div>
                <div className="col-span-1 text-xs text-gray-500 font-mono text-center">
                  {runner.weight || '-'}
                </div>
                <div className="col-span-2 text-xs font-mono text-center">
                  {(runner.form || []).slice(0, 5).map((f, fi) => (
                    <span
                      key={fi}
                      className={clsx(
                        f === '1' ? 'text-green-edge' : f === '2' || f === '3' ? 'text-amber-edge' : 'text-gray-600'
                      )}
                    >
                      {f}
                    </span>
                  ))}
                  {(!runner.form || runner.form.length === 0) && '-'}
                </div>
                <div className="col-span-2 text-right">
                  <OddsDisplay odds={runner.odds} size="sm" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
