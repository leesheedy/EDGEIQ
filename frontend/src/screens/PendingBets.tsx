import React, { useEffect, useState } from 'react';
import { Filter, CheckCircle, RefreshCw } from 'lucide-react';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';
import { BetCard } from '../components/BetCard';
import type { Analysis } from '../types';

type FilterType = 'all' | 'BET' | 'WATCH';
type SortType = 'confidence' | 'ev' | 'time';

export function PendingBets() {
  const { pending, loadPending, isLoadingPending } = useBettingStore();
  const { addToast, settings } = useAppStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('confidence');
  const [bulkThreshold, setBulkThreshold] = useState(80);

  useEffect(() => {
    loadPending();
  }, []);

  const threshold = parseInt(settings?.confidence_threshold || '65', 10);

  const filtered = pending
    .filter((a) => {
      if (filter === 'all') return a.confidence >= threshold;
      return a.ai_recommendation?.recommendation === filter && a.confidence >= threshold;
    })
    .sort((a, b) => {
      if (sort === 'confidence') return b.confidence - a.confidence;
      if (sort === 'ev') return b.ev - a.ev;
      const timeA = new Date(a.events?.event_time || a.created_at).getTime();
      const timeB = new Date(b.events?.event_time || b.created_at).getTime();
      return timeA - timeB;
    });

  const betCount = pending.filter((a) => a.ai_recommendation?.recommendation === 'BET').length;
  const watchCount = pending.filter((a) => a.ai_recommendation?.recommendation === 'WATCH').length;
  const highConfidence = pending.filter((a) => a.confidence >= bulkThreshold).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Pending Bets</h1>
          <p className="text-gray-500 text-sm font-mono mt-0.5">
            AI-analysed opportunities awaiting confirmation
          </p>
        </div>
        <button
          onClick={loadPending}
          disabled={isLoadingPending}
          className="flex items-center gap-2 px-3 py-2 bg-navy-800 border border-navy-600 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw size={14} className={isLoadingPending ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1.5 bg-green-edge/15 text-green-edge text-xs font-mono rounded-full">
          {betCount} BET
        </span>
        <span className="px-3 py-1.5 bg-amber-edge/15 text-amber-edge text-xs font-mono rounded-full">
          {watchCount} WATCH
        </span>
        <span className="px-3 py-1.5 bg-navy-700 text-gray-400 text-xs font-mono rounded-full">
          {pending.length} total above {threshold}% confidence
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-navy-800 border border-navy-700 rounded-xl p-1">
          {(['all', 'BET', 'WATCH'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                filter === f
                  ? 'bg-green-edge/20 text-green-edge'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-navy-800 border border-navy-700 rounded-xl p-1">
          {(['confidence', 'ev', 'time'] as SortType[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                sort === s
                  ? 'bg-navy-700 text-white'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {s === 'ev' ? 'EV' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Bulk confirm */}
        {highConfidence > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-mono text-gray-500">Bulk ≥</span>
            <input
              type="number"
              value={bulkThreshold}
              onChange={(e) => setBulkThreshold(parseInt(e.target.value, 10))}
              className="w-14 bg-navy-800 border border-navy-600 rounded-lg px-2 py-1 text-xs font-mono text-white text-center"
              min={threshold}
              max={100}
            />
            <span className="text-xs font-mono text-gray-500">% ({highConfidence})</span>
          </div>
        )}
      </div>

      {/* Cards */}
      {isLoadingPending ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-navy-800 border border-navy-700 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="font-display font-semibold text-white text-lg mb-2">
            No pending bets
          </h3>
          <p className="text-gray-500 font-mono text-sm">
            {pending.length === 0
              ? 'No analyses yet — trigger a scrape from the dashboard'
              : `All bets are below the ${threshold}% threshold`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((analysis) => (
            <BetCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      )}
    </div>
  );
}
