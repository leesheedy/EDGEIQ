import React, { useState, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  Loader2,
  Zap,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { screenshotApi, bankrollApi } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { OddsDisplay } from '../components/OddsDisplay';
import {
  clsx,
  formatCurrency,
  formatEV,
  sportEmoji,
  betTypeLabel,
} from '../lib/utils';
import type { Sport, BetType } from '../types';

interface ScreenshotResult {
  tab_balance?: number | null;
  sport: Sport;
  event_name: string;
  event_time?: string;
  venue?: string;
  market_type: string;
  track_condition?: string;
  distance?: number;
  race_number?: number;
  runners?: Array<{
    name: string;
    barrier?: number;
    jockey?: string;
    trainer?: string;
    weight?: number;
    odds: number;
    place_odds?: number;
    form?: string;
  }>;
  home_team?: string;
  away_team?: string;
  home_odds?: number;
  away_odds?: number;
  draw_odds?: number;
  recommendation: {
    recommendation: 'BET' | 'WATCH' | 'SKIP';
    bet_type: BetType;
    selection: string;
    confidence_score: number;
    expected_value: number;
    suggested_stake_percent: number;
    reasoning: string;
    risk_flags: string[];
    key_stat?: string;
  };
}

export function ScreenshotAnalysis() {
  const { addToast, loadBankroll } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  function readFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      setImagePreview(data);
      setImageData(data);
      setImageType(file.type);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith('image/')
    );
    if (item) {
      const file = item.getAsFile();
      if (file) readFile(file);
    }
  }, []);

  async function analyse() {
    if (!imageData) return;
    setLoading(true);
    setError(null);
    try {
      const data = await screenshotApi.analyse(imageData, imageType);
      setResult(data);
      setExpanded(true);

      // Auto-update bankroll if TAB balance was visible in the screenshot
      if (typeof data.tab_balance === 'number' && data.tab_balance > 0) {
        try {
          await bankrollApi.set(data.tab_balance);
          await loadBankroll();
          addToast('success', `Bankroll updated to $${data.tab_balance.toFixed(2)} from TAB balance`);
        } catch {
          // non-critical — don't block result display
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImagePreview(null);
    setImageData(null);
    setResult(null);
    setError(null);
  }

  const rec = result?.recommendation;
  const bestOdds =
    result?.runners?.[0]?.odds || result?.home_odds || result?.away_odds || 2.0;

  return (
    <div
      className="p-4 max-w-2xl mx-auto pb-24"
      onPaste={onPaste}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Screenshot Analysis</h1>
          <p className="text-gray-500 text-sm font-mono mt-0.5">
            Drop a TAB screenshot → get an instant recommendation
          </p>
        </div>
        {(imagePreview || result) && (
          <button
            onClick={reset}
            className="p-2 rounded-xl border border-navy-600 text-gray-400 hover:text-white transition-all"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!imagePreview && (
        <div
          ref={dropZoneRef}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
            dragging
              ? 'border-green-edge bg-green-edge/5'
              : 'border-navy-600 hover:border-navy-500 hover:bg-navy-800/50'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center">
              <Zap size={28} className="text-green-edge" />
            </div>
            <div>
              <p className="font-display font-semibold text-white text-lg mb-1">
                Drop your TAB screenshot here
              </p>
              <p className="text-gray-500 text-sm font-mono">
                or tap to upload · paste with Ctrl+V
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-edge text-navy-950 rounded-xl font-display font-semibold text-sm hover:bg-green-dim transition-all active:scale-95"
              >
                <Camera size={16} />
                Take Photo
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 border border-navy-600 text-gray-300 rounded-xl font-mono text-sm hover:text-white transition-all"
              >
                <Upload size={16} />
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
      />

      {/* Preview + Analyse */}
      {imagePreview && !result && (
        <div className="flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden border border-navy-700 bg-navy-800">
            <img
              src={imagePreview}
              alt="Screenshot preview"
              className="w-full max-h-80 object-contain"
            />
            <button
              onClick={reset}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-navy-900/80 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {error && (
            <p className="text-red-edge text-sm font-mono text-center bg-red-edge/10 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            onClick={analyse}
            disabled={loading}
            className="w-full py-4 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-lg hover:bg-green-dim disabled:opacity-60 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Reading screenshot...
              </>
            ) : (
              <>
                <Zap size={20} />
                Analyse This Bet
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && rec && (
        <div className="flex flex-col gap-4">
          {/* Preview thumbnail */}
          {imagePreview && (
            <div className="flex items-center gap-3 p-3 bg-navy-800 border border-navy-700 rounded-xl">
              <img src={imagePreview} alt="Screenshot" className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-display font-semibold text-sm truncate">{result.event_name}</p>
                <p className="text-gray-500 text-xs font-mono truncate">
                  {sportEmoji(result.sport)} {result.venue || result.sport}
                  {result.event_time ? ` · ${result.event_time}` : ''}
                </p>
              </div>
              <button
                onClick={reset}
                className="text-xs text-gray-500 hover:text-green-edge font-mono"
              >
                New
              </button>
            </div>
          )}

          {/* Main recommendation card */}
          <div
            className={clsx(
              'bg-navy-800 border rounded-2xl overflow-hidden',
              rec.recommendation === 'BET'
                ? 'border-green-edge/40 shadow-lg shadow-green-edge/10'
                : rec.recommendation === 'WATCH'
                ? 'border-amber-edge/40'
                : 'border-navy-700'
            )}
          >
            {/* Badge strip */}
            <div
              className={clsx(
                'px-4 py-2 flex items-center justify-between',
                rec.recommendation === 'BET'
                  ? 'bg-green-edge/10'
                  : rec.recommendation === 'WATCH'
                  ? 'bg-amber-edge/10'
                  : 'bg-navy-900'
              )}
            >
              <span
                className={clsx(
                  'text-xs font-mono font-bold px-3 py-1 rounded-full',
                  rec.recommendation === 'BET'
                    ? 'bg-green-edge/20 text-green-edge'
                    : rec.recommendation === 'WATCH'
                    ? 'bg-amber-edge/20 text-amber-edge'
                    : 'bg-gray-700/50 text-gray-400'
                )}
              >
                {rec.recommendation}
              </span>
              <span className="text-xs text-gray-500 font-mono">{betTypeLabel(rec.bet_type)}</span>
            </div>

            <div className="p-4">
              {/* Selection + gauge */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-white text-xl leading-tight mb-1">
                    {rec.selection}
                  </h2>
                  {rec.key_stat && (
                    <p className="text-green-edge text-xs font-mono">{rec.key_stat}</p>
                  )}
                </div>
                <ConfidenceGauge value={rec.confidence_score} size={70} showLabel />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">ODDS</div>
                  <OddsDisplay odds={bestOdds} size="sm" />
                </div>
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">STAKE %</div>
                  <span className="text-sm font-mono font-medium text-white">
                    {rec.suggested_stake_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">EV</div>
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
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {rec.risk_flags.map((flag, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs font-mono px-2 py-1 bg-amber-edge/10 text-amber-edge rounded-full"
                    >
                      <AlertTriangle size={10} />
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              {/* Reasoning toggle */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white font-mono transition-all mb-2"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Hide' : 'Show'} analysis
              </button>

              {expanded && (
                <div className="bg-navy-900 rounded-xl p-4">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {rec.reasoning}
                  </p>
                </div>
              )}
            </div>

            {/* Runners table (racing) */}
            {result.runners && result.runners.length > 0 && (
              <div className="border-t border-navy-700 px-4 py-3">
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
                  Runners
                </h3>
                <div className="flex flex-col gap-1">
                  {result.runners.map((runner, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-center gap-3 py-2 px-3 rounded-lg',
                        runner.name === rec.selection
                          ? 'bg-green-edge/10 border border-green-edge/20'
                          : 'bg-navy-900/50'
                      )}
                    >
                      {runner.barrier !== undefined && (
                        <span className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center text-xs font-mono text-gray-400 shrink-0">
                          {runner.barrier}
                        </span>
                      )}
                      <span className="flex-1 text-sm text-white font-medium truncate">
                        {runner.name}
                      </span>
                      {runner.jockey && (
                        <span className="text-xs text-gray-500 font-mono hidden sm:block">
                          {runner.jockey}
                        </span>
                      )}
                      {runner.form && (
                        <span className="text-xs text-gray-500 font-mono hidden sm:block">
                          {runner.form}
                        </span>
                      )}
                      <span className="text-sm font-mono text-green-edge shrink-0">
                        ${runner.odds.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open TAB button */}
            <div className="p-4 pt-0">
              <a
                href="https://www.tab.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-base hover:bg-green-dim transition-all active:scale-95"
              >
                <ExternalLink size={18} />
                Open TAB to Place Bet
              </a>
            </div>
          </div>

          {/* Analyse another */}
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 w-full py-3 bg-navy-800 border border-navy-700 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
          >
            <Camera size={16} />
            Analyse Another Screenshot
          </button>
        </div>
      )}
    </div>
  );
}
