import React, { useState, useRef, useCallback } from 'react';
import {
  Camera, Upload, X, Loader2, Zap, AlertTriangle,
  ExternalLink, RefreshCw, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { screenshotApi, bankrollApi } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { OddsDisplay } from '../components/OddsDisplay';
import { clsx, formatEV, sportEmoji, betTypeLabel } from '../lib/utils';
import type { Sport, BetType } from '../types';

interface ImageItem {
  preview: string;
  data: string;
  type: string;
}

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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File): Promise<ImageItem> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
      const reader = new FileReader();
      reader.onload = (e) => resolve({ preview: e.target?.result as string, data: e.target?.result as string, type: file.type });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6);
    if (!arr.length) return;
    const items = await Promise.all(arr.map(readFile));
    setImages(prev => {
      const combined = [...prev, ...items].slice(0, 6);
      return combined;
    });
    setResult(null);
    setError(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const imgItems = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/'));
    const files = imgItems.map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) addFiles(files);
  }, []);

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setResult(null);
  }

  async function analyse() {
    if (!images.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await screenshotApi.analyseMulti(
        images.map(img => ({ image: img.data, mediaType: img.type }))
      );
      setResult(data);
      setExpanded(true);

      if (typeof data.tab_balance === 'number' && data.tab_balance > 0) {
        try {
          await bankrollApi.set(data.tab_balance);
          await loadBankroll();
          addToast('success', `Bankroll updated to $${data.tab_balance.toFixed(2)} from TAB balance`);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImages([]);
    setResult(null);
    setError(null);
  }

  const rec = result?.recommendation;
  const bestOdds = result?.runners?.[0]?.odds || result?.home_odds || result?.away_odds || 2.0;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" onPaste={onPaste}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Screenshot Analysis</h1>
          <p className="text-gray-500 text-sm font-mono mt-0.5">
            Upload up to 6 screenshots — Claude reads them all together
          </p>
        </div>
        {(images.length > 0 || result) && (
          <button onClick={reset} className="p-2 rounded-xl border border-navy-600 text-gray-400 hover:text-white transition-all">
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {/* Drop zone — always visible if no result yet */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'border-2 border-dashed rounded-2xl transition-all',
            dragging ? 'border-green-edge bg-green-edge/5' : 'border-navy-600 hover:border-navy-500',
            images.length === 0 ? 'p-8' : 'p-3'
          )}
        >
          {images.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center">
                <Zap size={28} className="text-green-edge" />
              </div>
              <div>
                <p className="font-display font-semibold text-white text-lg mb-1">
                  Drop TAB screenshots here
                </p>
                <p className="text-gray-500 text-sm font-mono">
                  Multiple screenshots · paste · camera · upload
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-edge text-navy-950 rounded-xl font-display font-semibold text-sm hover:bg-green-dim transition-all active:scale-95"
                >
                  <Camera size={16} />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 border border-navy-600 text-gray-300 rounded-xl font-mono text-sm hover:text-white transition-all"
                >
                  <Upload size={16} />
                  Upload
                </button>
              </div>
            </div>
          ) : (
            /* Thumbnail grid */
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-[9/16] rounded-xl overflow-hidden bg-navy-900">
                    <img src={img.preview} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-navy-900/90 flex items-center justify-center text-gray-300 hover:text-white hover:bg-red-edge/80 transition-all"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 bg-navy-900/80 text-gray-400 text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {i + 1}
                    </div>
                  </div>
                ))}

                {/* Add more slot */}
                {images.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[9/16] rounded-xl border-2 border-dashed border-navy-600 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400 hover:border-navy-500 transition-all"
                  >
                    <Plus size={20} />
                    <span className="text-[10px] font-mono">Add more</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 flex-1">
                  {images.length} screenshot{images.length !== 1 ? 's' : ''} · Claude will read all at once
                </span>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-2 rounded-lg border border-navy-600 text-gray-400 hover:text-white transition-all"
                  title="Add camera photo"
                >
                  <Camera size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />

      {/* Error */}
      {error && (
        <p className="mt-3 text-red-edge text-sm font-mono text-center bg-red-edge/10 rounded-xl p-3">{error}</p>
      )}

      {/* Analyse button */}
      {images.length > 0 && !result && (
        <button
          onClick={analyse}
          disabled={loading}
          className="mt-4 w-full py-4 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-lg hover:bg-green-dim disabled:opacity-60 transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? (
            <><Loader2 size={20} className="animate-spin" />Reading {images.length} screenshot{images.length > 1 ? 's' : ''}...</>
          ) : (
            <><Zap size={20} />Analyse {images.length} Screenshot{images.length > 1 ? 's' : ''}</>
          )}
        </button>
      )}

      {/* Results */}
      {result && rec && (
        <div className="flex flex-col gap-4">
          {/* Source thumbnails strip */}
          <div className="flex items-center gap-2 p-2 bg-navy-800 border border-navy-700 rounded-xl overflow-x-auto">
            {images.map((img, i) => (
              <img key={i} src={img.preview} alt={`${i + 1}`} className="w-12 h-20 rounded-lg object-cover shrink-0" />
            ))}
            <div className="flex-1 min-w-0 pl-1">
              <p className="text-white font-display font-semibold text-sm truncate">{result.event_name}</p>
              <p className="text-gray-500 text-xs font-mono">
                {sportEmoji(result.sport)} {result.venue || result.sport}
                {result.event_time ? ` · ${result.event_time}` : ''}
              </p>
              <p className="text-gray-600 text-xs font-mono">{images.length} screenshot{images.length > 1 ? 's' : ''} analysed</p>
            </div>
            <button onClick={reset} className="shrink-0 text-xs text-gray-500 hover:text-green-edge font-mono px-2">New</button>
          </div>

          {/* Recommendation card */}
          <div className={clsx(
            'bg-navy-800 border rounded-2xl overflow-hidden',
            rec.recommendation === 'BET' ? 'border-green-edge/40 shadow-lg shadow-green-edge/10'
            : rec.recommendation === 'WATCH' ? 'border-amber-edge/40'
            : 'border-navy-700'
          )}>
            {/* Badge strip */}
            <div className={clsx(
              'px-4 py-2 flex items-center justify-between',
              rec.recommendation === 'BET' ? 'bg-green-edge/10'
              : rec.recommendation === 'WATCH' ? 'bg-amber-edge/10'
              : 'bg-navy-900'
            )}>
              <span className={clsx(
                'text-xs font-mono font-bold px-3 py-1 rounded-full',
                rec.recommendation === 'BET' ? 'bg-green-edge/20 text-green-edge'
                : rec.recommendation === 'WATCH' ? 'bg-amber-edge/20 text-amber-edge'
                : 'bg-gray-700/50 text-gray-400'
              )}>
                {rec.recommendation}
              </span>
              <span className="text-xs text-gray-500 font-mono">{betTypeLabel(rec.bet_type)}</span>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-white text-xl leading-tight mb-1">{rec.selection}</h2>
                  {rec.key_stat && <p className="text-green-edge text-xs font-mono">{rec.key_stat}</p>}
                </div>
                <ConfidenceGauge value={rec.confidence_score} size={70} showLabel />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">ODDS</div>
                  <OddsDisplay odds={bestOdds} size="sm" />
                </div>
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">STAKE %</div>
                  <span className="text-sm font-mono font-medium text-white">{rec.suggested_stake_percent.toFixed(1)}%</span>
                </div>
                <div className="bg-navy-900 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 font-mono mb-1">EV</div>
                  <span className={clsx('text-sm font-mono font-medium', rec.expected_value > 0 ? 'text-green-edge' : 'text-red-edge')}>
                    {formatEV(rec.expected_value)}
                  </span>
                </div>
              </div>

              {rec.risk_flags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {rec.risk_flags.map((flag, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs font-mono px-2 py-1 bg-amber-edge/10 text-amber-edge rounded-full">
                      <AlertTriangle size={10} />{flag}
                    </span>
                  ))}
                </div>
              )}

              <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white font-mono transition-all mb-2">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Hide' : 'Show'} analysis
              </button>

              {expanded && (
                <div className="bg-navy-900 rounded-xl p-4">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{rec.reasoning}</p>
                </div>
              )}
            </div>

            {/* Runners */}
            {result.runners && result.runners.length > 0 && (
              <div className="border-t border-navy-700 px-4 py-3">
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Runners</h3>
                <div className="flex flex-col gap-1">
                  {result.runners.map((runner, i) => (
                    <div key={i} className={clsx(
                      'flex items-center gap-2 py-2 px-3 rounded-lg',
                      runner.name === rec.selection ? 'bg-green-edge/10 border border-green-edge/20' : 'bg-navy-900/50'
                    )}>
                      {runner.barrier !== undefined && (
                        <span className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center text-xs font-mono text-gray-400 shrink-0">{runner.barrier}</span>
                      )}
                      <span className="flex-1 text-sm text-white font-medium truncate">{runner.name}</span>
                      {runner.jockey && <span className="text-xs text-gray-500 font-mono hidden sm:block truncate max-w-[80px]">{runner.jockey}</span>}
                      {runner.form && <span className="text-xs text-gray-600 font-mono hidden sm:block">{runner.form}</span>}
                      <span className="text-sm font-mono text-green-edge shrink-0">${runner.odds.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 pt-2">
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

          <button onClick={reset} className="flex items-center justify-center gap-2 w-full py-3 bg-navy-800 border border-navy-700 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all">
            <Camera size={16} />Analyse Another
          </button>
        </div>
      )}
    </div>
  );
}
