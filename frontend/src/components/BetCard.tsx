import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { Analysis } from '../types';
import { ConfidenceGauge } from './ConfidenceGauge';
import { OddsDisplay } from './OddsDisplay';
import {
  formatCurrency,
  formatEV,
  sportEmoji,
  betTypeLabel,
  formatEventTime,
  clsx,
} from '../lib/utils';
import { useBettingStore } from '../store/useBettingStore';
import { useAppStore } from '../store/useAppStore';

interface Props {
  analysis: Analysis;
}

export function BetCard({ analysis }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { confirmBet, skipBet } = useBettingStore();
  const { addToast, loadBankroll } = useAppStore();

  const event = analysis.events;
  const rec = analysis.ai_recommendation;

  const bestOdds =
    event?.raw_data?.runners?.[0]?.odds ||
    event?.raw_data?.home_odds ||
    event?.raw_data?.away_odds ||
    2.0;

  async function handleConfirm() {
    setConfirming(true);
    try {
      const bet = await confirmBet(analysis);
      if (bet) {
        addToast('success', `Bet confirmed: ${rec.selection} — TAB opening...`);
        await loadBankroll();
      } else {
        addToast('error', 'Failed to confirm bet');
      }
    } finally {
      setConfirming(false);
    }
  }

  function handleSkip() {
    skipBet(analysis.id);
    addToast('info', `Skipped: ${rec.selection}`);
  }

  return (
    <div
      className={clsx(
        'bg-navy-800 border rounded-2xl overflow-hidden transition-all duration-200',
        rec.recommendation === 'BET'
          ? 'border-green-edge/30 shadow-lg shadow-green-edge/5'
          : rec.recommendation === 'WATCH'
          ? 'border-amber-edge/30'
          : 'border-navy-700'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl shrink-0 mt-0.5">
              {event ? sportEmoji(event.sport) : '🎯'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={clsx(
                    'text-xs font-mono px-2 py-0.5 rounded-full',
                    rec.recommendation === 'BET'
                      ? 'bg-green-edge/20 text-green-edge'
                      : rec.recommendation === 'WATCH'
                      ? 'bg-amber-edge/20 text-amber-edge'
                      : 'bg-gray-700 text-gray-400'
                  )}
                >
                  {rec.recommendation}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {betTypeLabel(rec.bet_type)}
                </span>
              </div>
              <h3 className="font-display font-semibold text-white text-sm leading-tight truncate">
                {rec.selection}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                {event?.event_name}
                {event && ` · ${formatEventTime(event.event_time)}`}
              </p>
            </div>
          </div>
          <ConfidenceGauge value={analysis.confidence} size={64} showLabel />
        </div>

        {/* Metrics row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="bg-navy-900 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 font-mono mb-0.5">ODDS</div>
            <OddsDisplay odds={bestOdds} size="sm" />
          </div>
          <div className="bg-navy-900 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 font-mono mb-0.5">STAKE</div>
            <span className="text-sm font-mono font-medium text-white">
              {formatCurrency(rec.suggested_stake || analysis.suggested_stake)}
            </span>
          </div>
          <div className="bg-navy-900 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500 font-mono mb-0.5">EV</div>
            <span
              className={clsx(
                'text-sm font-mono font-medium',
                rec.expected_value > 0 ? 'text-green-edge' : 'text-red-edge'
              )}
            >
              {formatEV(rec.expected_value)}
            </span>
          </div>
        </div>

        {/* Risk flags */}
        {rec.risk_flags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {rec.risk_flags.slice(0, 3).map((flag, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-amber-edge/10 text-amber-edge rounded-full"
              >
                <AlertTriangle size={10} />
                {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expandable reasoning */}
      {expanded && (
        <div className="px-4 pb-3 animate-fade-in">
          <div className="border-t border-navy-700 pt-3">
            <h4 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
              AI Analysis
            </h4>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {rec.reasoning}
            </p>
            {rec.learn_notes && (
              <div className="mt-3 p-2 bg-navy-900 rounded-lg">
                <span className="text-xs font-mono text-gray-500">LEARN: </span>
                <span className="text-xs text-gray-400">{rec.learn_notes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-semibold text-sm transition-all',
            confirming
              ? 'bg-green-edge/20 text-green-edge/50 cursor-wait'
              : 'bg-green-edge text-navy-950 hover:bg-green-dim active:scale-95'
          )}
        >
          <ExternalLink size={14} />
          {confirming ? 'Confirming...' : 'Confirm & Open TAB'}
        </button>
        <button
          onClick={handleSkip}
          className="px-3 py-2.5 rounded-xl border border-navy-600 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
          <XCircle size={16} />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-2.5 rounded-xl border border-navy-600 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </div>
  );
}
