import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Upload, X, Loader2, Zap, AlertTriangle,
  ExternalLink, RefreshCw, ChevronDown, ChevronUp, Plus,
  CheckCircle2, XCircle, MinusCircle, Clock, TrendingUp, TrendingDown, Trash2,
} from 'lucide-react';
import { screenshotApi, bankrollApi, scanDraftsApi } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { OddsDisplay } from '../components/OddsDisplay';
import { clsx, formatEV, formatCurrency, sportEmoji, betTypeLabel } from '../lib/utils';
import type { Sport, BetType } from '../types';

interface ImageItem { preview: string; data: string; type: string; }

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
    name: string; barrier?: number; jockey?: string; trainer?: string;
    weight?: number; odds: number; place_odds?: number; form?: string;
  }>;
  home_team?: string; away_team?: string;
  home_odds?: number; away_odds?: number; draw_odds?: number;
  recommendation: {
    recommendation: 'BET' | 'WATCH' | 'PASS' | 'SKIP';
    bet_type: BetType;
    selection: string;
    confidence_score: number;
    expected_value: number;
    suggested_stake_percent: number;
    reasoning: string;
    risk_flags: string[];
    key_stat?: string;
    professional_verdict?: string;
    pass_reason?: string;
    wait_for?: string;
    probability_table?: Array<{
      runner: string;
      market_odds: number;
      implied_prob: number;
      true_prob: number;
      value_rating: 'good' | 'fair' | 'poor';
    }>;
  };
}

interface ScanDraft {
  id: string;
  created_at: string;
  sport?: string;
  event_name: string;
  event_time?: string;
  venue?: string;
  selection?: string;
  bet_type?: string;
  recommendation?: string;
  odds?: number;
  confidence_score?: number;
  expected_value?: number;
  suggested_stake_percent?: number;
  key_stat?: string;
  status: 'draft' | 'placed' | 'skipped';
  placed_stake?: number;
  outcome?: 'WON' | 'LOST' | 'VOID';
  profit_loss?: number;
}

interface BetSlipData {
  event_name: string;
  event_time?: string;
  venue?: string;
  selection?: string;
  bet_type?: string;
  odds?: number;
  suggested_stake_percent?: number;
  sport?: string;
  race_number?: number;
}

// ── Outcome modal ──────────────────────────────────────────────────────────────
function PlacedModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: ScanDraft;
  onClose: () => void;
  onSaved: (updated: ScanDraft) => void;
}) {
  const [stake, setStake] = useState(draft.placed_stake?.toFixed(2) ?? '');
  const [outcome, setOutcome] = useState<'WON' | 'LOST' | 'VOID' | ''>( draft.outcome ?? '');
  const [saving, setSaving] = useState(false);
  const { addToast, loadBankroll } = useAppStore();

  async function save() {
    if (!outcome) return;
    setSaving(true);
    try {
      const s = parseFloat(stake);
      const updates: Parameters<typeof scanDraftsApi.update>[1] = {
        status: 'placed',
        outcome: outcome as 'WON' | 'LOST' | 'VOID',
        odds: draft.odds,
      };
      if (!isNaN(s) && s > 0) updates.placed_stake = s;
      const updated = await scanDraftsApi.update(draft.id, updates);
      onSaved(updated as ScanDraft);

      // Reflect in bankroll if we know the balance impact
      if (draft.odds && !isNaN(s) && s > 0) {
        const pnl = outcome === 'WON' ? s * (draft.odds - 1) : outcome === 'LOST' ? -s : 0;
        const { loadBankroll: lb } = useAppStore.getState();
        await lb();
        addToast(
          outcome === 'WON' ? 'success' : outcome === 'LOST' ? 'error' : 'info',
          outcome === 'WON'
            ? `Nice! +${formatCurrency(pnl)} on ${draft.selection}`
            : outcome === 'LOST'
            ? `${formatCurrency(pnl)} on ${draft.selection}`
            : `Void — stake returned`
        );
      }
      onClose();
    } catch {
      addToast('error', 'Failed to save outcome');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm bg-navy-800 border border-navy-700 rounded-2xl p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-white mb-1">Record Outcome</h3>
        <p className="text-xs text-gray-500 font-mono mb-4">
          {draft.selection} @ {draft.odds ? `$${draft.odds.toFixed(2)}` : '–'}
        </p>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">Stake $</span>
          <input
            type="number" value={stake} onChange={e => setStake(e.target.value)}
            placeholder="0.00" step="0.01" min="0" autoFocus
            className="w-full bg-navy-900 border border-navy-600 rounded-xl pl-16 pr-3 py-3 text-white font-mono focus:outline-none focus:border-green-edge/50"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {(['WON', 'LOST', 'VOID'] as const).map(o => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={clsx(
                'py-3 rounded-xl font-mono font-bold text-sm transition-all',
                outcome === o
                  ? o === 'WON' ? 'bg-green-edge text-navy-950'
                    : o === 'LOST' ? 'bg-red-edge text-white'
                    : 'bg-gray-600 text-white'
                  : 'bg-navy-900 border border-navy-600 text-gray-400 hover:text-white'
              )}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !outcome}
            className="flex-1 py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bet Slip Modal ─────────────────────────────────────────────────────────────
function BetSlipModal({ data, onClose }: { data: BetSlipData; onClose: () => void }) {
  const { bankrollStats } = useAppStore();
  const suggestedStake = bankrollStats && data.suggested_stake_percent
    ? (bankrollStats.current_balance * data.suggested_stake_percent / 100)
    : null;

  const betTypeDisplay = data.bet_type
    ? betTypeLabel(data.bet_type as Parameters<typeof betTypeLabel>[0])
    : null;

  const betTypeColor =
    data.bet_type === 'quinella' ? 'text-purple-400 bg-purple-400/10' :
    data.bet_type === 'exacta' ? 'text-blue-400 bg-blue-400/10' :
    data.bet_type === 'trifecta' ? 'text-amber-400 bg-amber-400/10' :
    data.bet_type === 'each_way' ? 'text-cyan-400 bg-cyan-400/10' :
    'text-green-edge bg-green-edge/10';

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="w-full max-w-sm bg-navy-800 border border-navy-700 rounded-2xl p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-edge/15 flex items-center justify-center">
            <ExternalLink size={15} className="text-green-edge" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-sm">Bet Slip</h3>
            <p className="text-xs text-gray-500 font-mono">Take this to TAB</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div className="bg-navy-900 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-0.5">Event</p>
            <p className="text-white font-medium text-sm">{data.event_name}</p>
            {(data.event_time || data.venue) && (
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {[data.venue, data.event_time].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {data.selection && (
            <div className="bg-navy-900 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-0.5">Selection</p>
              <p className="text-white font-display font-bold text-xl leading-tight">{data.selection}</p>
              {betTypeDisplay && (
                <span className={clsx('inline-block mt-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full', betTypeColor)}>
                  {betTypeDisplay}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {data.odds && (
              <div className="bg-navy-900 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 font-mono mb-1">ODDS</p>
                <p className="text-green-edge font-display font-bold text-2xl">${data.odds.toFixed(2)}</p>
              </div>
            )}
            {suggestedStake && (
              <div className="bg-navy-900 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 font-mono mb-1">STAKE</p>
                <p className="text-white font-display font-bold text-2xl">${suggestedStake.toFixed(2)}</p>
                <p className="text-[10px] text-gray-600 font-mono">{data.suggested_stake_percent?.toFixed(1)}% bankroll</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all">
            Close
          </button>
          <a
            href="https://www.tab.com.au"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim transition-all"
          >
            <ExternalLink size={16} />Open TAB
          </a>
        </div>
      </div>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────────
function ScanHistory() {
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<ScanDraft | null>(null);
  const [betSlipDraft, setBetSlipDraft] = useState<ScanDraft | null>(null);
  const { addToast } = useAppStore();

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await scanDraftsApi.list();
      setDrafts(data as ScanDraft[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function skip(id: string) {
    await scanDraftsApi.update(id, { status: 'skipped' });
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'skipped' } : d));
  }

  async function remove(id: string) {
    await scanDraftsApi.remove(id);
    setDrafts(prev => prev.filter(d => d.id !== id));
    addToast('info', 'Deleted');
  }

  function onOutcomeSaved(updated: ScanDraft) {
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
    setActiveDraft(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="font-mono text-sm">Loading...</span>
      </div>
    );
  }

  if (loadError) {
    const isMissingTable = loadError.toLowerCase().includes('does not exist') || loadError.toLowerCase().includes('screenshot_analyses');
    const isRlsError = loadError.toLowerCase().includes('permission denied') || loadError.toLowerCase().includes('row-level security') || loadError.toLowerCase().includes('rls');
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="bg-red-edge/10 border border-red-edge/30 rounded-2xl p-4">
          <p className="text-red-400 font-mono text-sm font-semibold mb-1">History unavailable</p>
          <p className="text-gray-400 font-mono text-xs">{loadError}</p>
        </div>
        {(isMissingTable || isRlsError) && (
          <div className="bg-amber-edge/5 border border-amber-edge/20 rounded-2xl p-4">
            <p className="text-amber-edge font-mono text-xs font-semibold mb-2">
              {isRlsError ? 'Permission issue — run this in Supabase SQL editor' : 'Setup required — run this in Supabase SQL editor'}
            </p>
            {isMissingTable && !isRlsError && (
              <p className="text-gray-400 font-mono text-xs mb-2">
                Step 1 — Create the table:
              </p>
            )}
            {isMissingTable && (
              <div className="bg-navy-900 rounded-xl p-3 text-[10px] font-mono text-gray-400 break-all leading-relaxed mb-2">
                {'CREATE TABLE IF NOT EXISTS screenshot_analyses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), sport text, event_name text, event_time text, venue text, selection text, bet_type text, recommendation text, odds numeric, confidence_score numeric, expected_value numeric, suggested_stake_percent numeric, reasoning text, key_stat text, raw_result jsonb, status text DEFAULT \'draft\', placed_stake numeric, outcome text, profit_loss numeric);'}
              </div>
            )}
            <p className="text-gray-400 font-mono text-xs mb-2">
              {isMissingTable && !isRlsError ? 'Step 2 — Disable RLS (row-level security):' : 'Disable RLS on the table:'}
            </p>
            <div className="bg-navy-900 rounded-xl p-3 text-[10px] font-mono text-gray-400 break-all leading-relaxed">
              {'ALTER TABLE screenshot_analyses DISABLE ROW LEVEL SECURITY;'}
            </div>
          </div>
        )}
        <button onClick={load} className="w-full py-2.5 bg-navy-800 border border-navy-700 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all">
          Retry
        </button>
      </div>
    );
  }

  if (!drafts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-navy-800 flex items-center justify-center">
          <Clock size={24} className="text-gray-600" />
        </div>
        <p className="text-gray-500 font-mono text-sm">No scans saved yet</p>
        <p className="text-gray-600 font-mono text-xs">Results auto-save after each analysis</p>
      </div>
    );
  }

  const placed = drafts.filter(d => d.status === 'placed' && d.outcome);
  const totalPnl = placed.reduce((s, d) => s + (d.profit_loss || 0), 0);
  const wins = placed.filter(d => d.outcome === 'WON').length;

  return (
    <div className="flex flex-col gap-3">
      {/* Stats strip */}
      {placed.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">SCAN P&L</div>
            <span className={clsx('text-sm font-mono font-bold', totalPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </span>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">WIN RATE</div>
            <span className="text-sm font-mono font-bold text-white">
              {placed.length > 0 ? Math.round((wins / placed.length) * 100) : 0}%
            </span>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-mono mb-1">BETS</div>
            <span className="text-sm font-mono font-bold text-white">{placed.length}</span>
          </div>
        </div>
      )}

      {/* Draft list */}
      {drafts.map(draft => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onMark={() => setActiveDraft(draft)}
          onSkip={() => skip(draft.id)}
          onDelete={() => remove(draft.id)}
          onOpenBet={() => setBetSlipDraft(draft)}
        />
      ))}

      {activeDraft && (
        <PlacedModal
          draft={activeDraft}
          onClose={() => setActiveDraft(null)}
          onSaved={onOutcomeSaved}
        />
      )}

      {betSlipDraft && (
        <BetSlipModal
          data={{
            event_name: betSlipDraft.event_name,
            event_time: betSlipDraft.event_time,
            venue: betSlipDraft.venue,
            selection: betSlipDraft.selection,
            bet_type: betSlipDraft.bet_type,
            odds: betSlipDraft.odds,
            suggested_stake_percent: betSlipDraft.suggested_stake_percent,
            sport: betSlipDraft.sport,
          }}
          onClose={() => setBetSlipDraft(null)}
        />
      )}
    </div>
  );
}

function DraftCard({
  draft, onMark, onSkip, onDelete, onOpenBet,
}: {
  draft: ScanDraft;
  onMark: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onOpenBet?: () => void;
}) {
  const recColor =
    draft.recommendation === 'BET' ? 'text-green-edge'
    : draft.recommendation === 'WATCH' ? 'text-amber-edge'
    : 'text-gray-500';

  const statusIcon =
    draft.outcome === 'WON' ? <CheckCircle2 size={14} className="text-green-edge" />
    : draft.outcome === 'LOST' ? <XCircle size={14} className="text-red-edge" />
    : draft.outcome === 'VOID' ? <MinusCircle size={14} className="text-gray-400" />
    : draft.status === 'skipped' ? <MinusCircle size={14} className="text-gray-600" />
    : <Clock size={14} className="text-amber-edge" />;

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg">{sportEmoji(draft.sport as Sport)}</span>
            <span className="text-white font-display font-semibold text-sm truncate">{draft.event_name}</span>
          </div>
          {draft.selection && (
            <p className={clsx('text-sm font-mono font-bold', recColor)}>
              {draft.recommendation} · {draft.selection}
            </p>
          )}
          {draft.bet_type && (
            <span className={clsx('inline-block mt-0.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
              draft.bet_type === 'quinella' ? 'text-purple-400 bg-purple-400/10' :
              draft.bet_type === 'exacta' ? 'text-blue-400 bg-blue-400/10' :
              draft.bet_type === 'trifecta' ? 'text-amber-400 bg-amber-400/10' :
              draft.bet_type === 'each_way' ? 'text-cyan-400 bg-cyan-400/10' :
              'text-gray-500 bg-navy-900'
            )}>
              {betTypeLabel(draft.bet_type as Parameters<typeof betTypeLabel>[0])}
            </span>
          )}
          <div className="flex items-center gap-3 mt-1">
            {draft.odds && <span className="text-xs font-mono text-gray-400">${draft.odds.toFixed(2)}</span>}
            {draft.confidence_score && (
              <span className="text-xs font-mono text-gray-500">{draft.confidence_score}% conf</span>
            )}
            {draft.key_stat && (
              <span className="text-xs font-mono text-green-edge/70 truncate max-w-[140px]">{draft.key_stat}</span>
            )}
          </div>
          <p className="text-xs text-gray-600 font-mono mt-1">
            {new Date(draft.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {statusIcon}
            {draft.profit_loss != null && (
              <span className={clsx('text-sm font-mono font-bold', draft.profit_loss >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                {draft.profit_loss >= 0 ? '+' : ''}{formatCurrency(draft.profit_loss)}
              </span>
            )}
          </div>
          <button onClick={onDelete} className="p-1 text-gray-600 hover:text-red-edge transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 mt-3 pt-3 border-t border-navy-700">
        {onOpenBet && (
          <button
            onClick={onOpenBet}
            className="flex items-center justify-center gap-1 py-2 px-2.5 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-xs hover:text-green-edge hover:border-green-edge/30 transition-all"
            title="Open bet slip"
          >
            <ExternalLink size={12} />
          </button>
        )}
        {!draft.outcome && draft.status !== 'skipped' && (
          <>
            <button
              onClick={onMark}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-edge/15 border border-green-edge/30 text-green-edge rounded-xl font-mono text-xs hover:bg-green-edge/20 transition-all"
            >
              <TrendingUp size={13} />
              Placed
            </button>
            <button
              onClick={onSkip}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-xs hover:text-white transition-all"
            >
              <TrendingDown size={13} />
              Skipped
            </button>
          </>
        )}
        {draft.status === 'placed' && !draft.outcome && (
          <button
            onClick={onMark}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-edge/15 border border-amber-edge/30 text-amber-edge rounded-xl font-mono text-xs hover:bg-amber-edge/20 transition-all"
          >
            <Clock size={13} />
            Set outcome
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export function ScreenshotAnalysis() {
  const { addToast, loadBankroll, bankrollStats } = useAppStore();
  const [tab, setTab] = useState<'scan' | 'history'>('scan');
  const [dragging, setDragging] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [placedStatus, setPlacedStatus] = useState<'draft' | 'placed' | 'skipped' | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showBetSlip, setShowBetSlip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = ['Reading screenshots...', 'Researching runners...', 'Calculating edge...', 'Building verdict...'];
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); return; }
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % loadingMessages.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  function readFile(file: File): Promise<ImageItem> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
      const reader = new FileReader();
      reader.onload = e => resolve({ preview: e.target?.result as string, data: e.target?.result as string, type: file.type });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6);
    if (!arr.length) return;
    const items = await Promise.all(arr.map(readFile));
    setImages(prev => [...prev, ...items].slice(0, 6));
    setResult(null); setError(null); setSavedId(null); setPlacedStatus(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items)
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) addFiles(files);
  }, []);

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setResult(null); setSavedId(null); setPlacedStatus(null);
  }

  async function analyse() {
    if (!images.length) return;
    setLoading(true); setError(null);
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
          addToast('success', `Bankroll updated to ${formatCurrency(data.tab_balance)}`);
        } catch { /* non-critical */ }
      }

      // Auto-save as draft
      try {
        const rec = data.recommendation;
        const bestOdds = data.runners?.[0]?.odds || data.home_odds || data.away_odds || null;
        const saved = await scanDraftsApi.save({
          sport: data.sport,
          event_name: data.event_name,
          event_time: data.event_time ?? null,
          venue: data.venue ?? null,
          selection: rec?.selection ?? null,
          bet_type: rec?.bet_type ?? null,
          recommendation: rec?.recommendation ?? null,
          odds: bestOdds,
          confidence_score: rec?.confidence_score ?? null,
          expected_value: rec?.expected_value ?? null,
          suggested_stake_percent: rec?.suggested_stake_percent ?? null,
          reasoning: rec?.reasoning ?? null,
          key_stat: rec?.key_stat ?? null,
          raw_result: data,
        });
        setSavedId(saved.id);
        setPlacedStatus('draft');
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function markPlaced() {
    if (!savedId) return;
    await scanDraftsApi.update(savedId, { status: 'placed' });
    setPlacedStatus('placed');
    setShowOutcomeModal(true);
  }

  async function markSkipped() {
    if (!savedId) return;
    await scanDraftsApi.update(savedId, { status: 'skipped' });
    setPlacedStatus('skipped');
    addToast('info', 'Marked as skipped');
  }

  function reset() {
    setImages([]); setResult(null); setError(null);
    setSavedId(null); setPlacedStatus(null);
  }

  const rec = result?.recommendation;
  const bestOdds = result?.runners?.[0]?.odds || result?.home_odds || result?.away_odds || 2.0;

  const betSlipData: BetSlipData | null = result && rec ? {
    event_name: result.event_name,
    event_time: result.event_time,
    venue: result.venue,
    selection: rec.selection,
    bet_type: rec.bet_type,
    odds: bestOdds,
    suggested_stake_percent: rec.suggested_stake_percent,
    sport: result.sport,
    race_number: result.race_number,
  } : null;

  const draftForModal: ScanDraft | null = savedId && rec ? {
    id: savedId,
    created_at: new Date().toISOString(),
    sport: result?.sport,
    event_name: result?.event_name ?? '',
    selection: rec.selection,
    recommendation: rec.recommendation,
    odds: bestOdds,
    confidence_score: rec.confidence_score,
    status: 'placed',
  } : null;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" onPaste={onPaste}>
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-2xl text-white">Scan</h1>
        <div className="flex bg-navy-800 border border-navy-700 rounded-xl p-1">
          <button
            onClick={() => setTab('scan')}
            className={clsx('px-3 py-1.5 rounded-lg font-mono text-xs transition-all',
              tab === 'scan' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-300')}
          >
            New Scan
          </button>
          <button
            onClick={() => setTab('history')}
            className={clsx('px-3 py-1.5 rounded-lg font-mono text-xs transition-all',
              tab === 'history' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-300')}
          >
            History
          </button>
        </div>
      </div>

      {tab === 'history' ? (
        <ScanHistory />
      ) : (
        <>
          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={clsx(
                'border-2 border-dashed rounded-2xl transition-all',
                dragging ? 'border-green-edge bg-green-edge/5' : 'border-navy-600 hover:border-navy-500',
                images.length === 0 ? 'p-8' : 'p-3'
              )}
            >
              {images.length === 0 ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center">
                    <Zap size={28} className="text-green-edge" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-white text-lg mb-1">Drop TAB screenshots here</p>
                    <p className="text-gray-500 text-sm font-mono">Multiple screenshots · paste · camera · upload</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-edge text-navy-950 rounded-xl font-display font-semibold text-sm hover:bg-green-dim transition-all active:scale-95"
                    >
                      <Camera size={16} />Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 border border-navy-600 text-gray-300 rounded-xl font-mono text-sm hover:text-white transition-all"
                    >
                      <Upload size={16} />Upload
                    </button>
                  </div>
                </div>
              ) : (
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
                        <div className="absolute bottom-1.5 left-1.5 bg-navy-900/80 text-gray-400 text-[10px] font-mono px-1.5 py-0.5 rounded">{i + 1}</div>
                      </div>
                    ))}
                    {images.length < 6 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[9/16] rounded-xl border-2 border-dashed border-navy-600 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400 hover:border-navy-500 transition-all"
                      >
                        <Plus size={20} /><span className="text-[10px] font-mono">Add more</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 flex-1">
                      {images.length} screenshot{images.length !== 1 ? 's' : ''} · Claude reads all at once
                    </span>
                    <button onClick={() => cameraInputRef.current?.click()} className="p-2 rounded-lg border border-navy-600 text-gray-400 hover:text-white transition-all">
                      <Camera size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />

          {error && (
            <p className="mt-3 text-red-edge text-sm font-mono text-center bg-red-edge/10 rounded-xl p-3">{error}</p>
          )}

          {images.length > 0 && !result && (
            <button
              onClick={analyse} disabled={loading}
              className="mt-4 w-full py-4 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-lg hover:bg-green-dim disabled:opacity-60 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {loading
                ? <><Loader2 size={20} className="animate-spin" />{loadingMessages[loadingMsgIdx]}</>
                : <><Zap size={20} />Analyse {images.length} Screenshot{images.length > 1 ? 's' : ''}</>}
            </button>
          )}

          {/* Result */}
          {result && rec && (
            <div className="flex flex-col gap-4">
              {/* Thumbnails strip */}
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
                  {savedId && <p className="text-green-edge/60 text-xs font-mono">Saved to history</p>}
                </div>
                <button onClick={reset} className="shrink-0 text-xs text-gray-500 hover:text-green-edge font-mono px-2">New</button>
              </div>

              {/* Recommendation card */}
              <div className={clsx(
                'bg-navy-800 border rounded-2xl overflow-hidden',
                rec.recommendation === 'BET' ? 'border-green-edge/40 shadow-lg shadow-green-edge/10'
                : rec.recommendation === 'WATCH' ? 'border-amber-edge/40'
                : rec.recommendation === 'PASS' ? 'border-amber-500/30'
                : 'border-navy-700'
              )}>
                {/* Header bar */}
                <div className={clsx(
                  'px-4 py-2 flex items-center justify-between',
                  rec.recommendation === 'BET' ? 'bg-green-edge/10'
                  : rec.recommendation === 'WATCH' ? 'bg-amber-edge/10'
                  : rec.recommendation === 'PASS' ? 'bg-amber-500/10'
                  : 'bg-navy-900'
                )}>
                  <span className={clsx(
                    'text-xs font-mono font-bold px-3 py-1 rounded-full',
                    rec.recommendation === 'BET' ? 'bg-green-edge/20 text-green-edge'
                    : rec.recommendation === 'WATCH' ? 'bg-amber-edge/20 text-amber-edge'
                    : rec.recommendation === 'PASS' ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-gray-700/50 text-gray-400'
                  )}>
                    {rec.recommendation}
                  </span>
                  {rec.recommendation !== 'PASS' && rec.recommendation !== 'SKIP' && (
                    <span className="text-xs text-gray-500 font-mono">{betTypeLabel(rec.bet_type)}</span>
                  )}
                </div>

                <div className="p-4">
                  {(rec.recommendation === 'PASS' || rec.recommendation === 'SKIP') ? (
                    /* ── PASS / SKIP — no value found ── */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                        <h2 className="font-display font-bold text-amber-500 text-lg leading-tight">
                          {rec.recommendation === 'PASS' ? 'No Value Found — Pass This Race' : 'Negative EV — Skip'}
                        </h2>
                      </div>

                      {rec.professional_verdict && (
                        <p className="text-sm text-gray-300 leading-relaxed">{rec.professional_verdict}</p>
                      )}

                      {rec.pass_reason && (
                        <div className="bg-navy-900 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">Why Pass</p>
                          <p className="text-sm text-gray-300">{rec.pass_reason}</p>
                        </div>
                      )}

                      {rec.wait_for && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                          <p className="text-[10px] text-amber-500 font-mono uppercase tracking-wider mb-1">What to Wait For</p>
                          <p className="text-sm text-white">{rec.wait_for}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-navy-900 rounded-xl p-3 text-center">
                          <div className="text-xs text-gray-500 font-mono mb-1">CONFIDENCE</div>
                          <span className="text-sm font-mono font-medium text-gray-400">{rec.confidence_score}%</span>
                        </div>
                        <div className="bg-navy-900 rounded-xl p-3 text-center">
                          <div className="text-xs text-gray-500 font-mono mb-1">EV</div>
                          <span className={clsx('text-sm font-mono font-medium', (rec.expected_value ?? 0) > 0 ? 'text-green-edge' : 'text-red-edge')}>
                            {formatEV(rec.expected_value ?? 0)}
                          </span>
                        </div>
                      </div>

                      {rec.risk_flags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.risk_flags.map((flag, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs font-mono px-2 py-1 bg-amber-edge/10 text-amber-edge rounded-full">
                              <AlertTriangle size={10} />{flag}
                            </span>
                          ))}
                        </div>
                      )}

                      <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white font-mono transition-all">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expanded ? 'Hide' : 'Show'} full analysis
                      </button>
                      {expanded && (
                        <div className="bg-navy-900 rounded-xl p-4">
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{rec.reasoning}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── BET / WATCH ── */
                    <div>
                      {rec.professional_verdict && (
                        <p className="text-xs text-gray-400 font-mono italic mb-3 leading-relaxed">{rec.professional_verdict}</p>
                      )}
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
                          <span className="text-sm font-mono font-medium text-white">{(rec.suggested_stake_percent ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="bg-navy-900 rounded-xl p-3 text-center">
                          <div className="text-xs text-gray-500 font-mono mb-1">EV</div>
                          <span className={clsx('text-sm font-mono font-medium', (rec.expected_value ?? 0) > 0 ? 'text-green-edge' : 'text-red-edge')}>
                            {formatEV(rec.expected_value ?? 0)}
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

                      {rec.wait_for && rec.recommendation === 'WATCH' && (
                        <div className="bg-amber-edge/5 border border-amber-edge/20 rounded-xl p-3 mb-4">
                          <p className="text-[10px] text-amber-edge font-mono uppercase tracking-wider mb-1">What to Watch For</p>
                          <p className="text-xs text-gray-300">{rec.wait_for}</p>
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
                  )}
                </div>

                {/* Runners list */}
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

                {/* Probability table */}
                {rec.probability_table && rec.probability_table.length > 0 && (
                  <div className="border-t border-navy-700 px-4 py-3">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Probability Assessment</h3>
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-[10px] text-gray-600 font-normal">
                          <th className="text-left pb-1.5 font-normal">Runner</th>
                          <th className="text-right pb-1.5 font-normal">Mkt%</th>
                          <th className="text-right pb-1.5 font-normal">True%</th>
                          <th className="text-right pb-1.5 font-normal">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rec.probability_table.map((row, i) => (
                          <tr key={i} className="border-t border-navy-700/50">
                            <td className={clsx('py-1.5 truncate max-w-[120px]',
                              row.value_rating === 'good' ? 'text-green-edge' : row.value_rating === 'poor' ? 'text-red-edge/80' : 'text-gray-400'
                            )}>{row.runner}</td>
                            <td className="text-right text-gray-500">{row.implied_prob.toFixed(1)}%</td>
                            <td className={clsx('text-right font-medium',
                              row.true_prob > row.implied_prob ? 'text-green-edge' : 'text-gray-400'
                            )}>{row.true_prob.toFixed(1)}%</td>
                            <td className={clsx('text-right font-bold',
                              row.value_rating === 'good' ? 'text-green-edge' : row.value_rating === 'poor' ? 'text-red-edge/70' : 'text-gray-500'
                            )}>
                              {row.value_rating === 'good' ? '✓' : row.value_rating === 'poor' ? '✗' : '~'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 pt-2 flex flex-col gap-2">
                  {rec.recommendation !== 'PASS' && rec.recommendation !== 'SKIP' && (
                    <button
                      onClick={() => setShowBetSlip(true)}
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-base hover:bg-green-dim transition-all active:scale-95"
                    >
                      <ExternalLink size={18} />Open Bet in TAB
                    </button>
                  )}
                  {placedStatus === 'draft' && (
                    <div className="flex gap-2">
                      {rec.recommendation !== 'PASS' && rec.recommendation !== 'SKIP' ? (
                        <>
                          <button
                            onClick={markPlaced}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-navy-900 border border-green-edge/30 text-green-edge rounded-xl font-mono text-sm hover:bg-green-edge/10 transition-all"
                          >
                            <CheckCircle2 size={15} />I placed this
                          </button>
                          <button
                            onClick={markSkipped}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
                          >
                            <XCircle size={15} />Skipped it
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={markSkipped}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
                        >
                          <XCircle size={15} />Mark as Passed
                        </button>
                      )}
                    </div>
                  )}
                  {placedStatus === 'placed' && (
                    <p className="text-center text-xs font-mono text-green-edge/70 py-1">
                      Saved — set the outcome in History when it's done
                    </p>
                  )}
                  {placedStatus === 'skipped' && (
                    <p className="text-center text-xs font-mono text-gray-500 py-1">Marked as skipped</p>
                  )}
                </div>
              </div>

              <button onClick={reset} className="flex items-center justify-center gap-2 w-full py-3 bg-navy-800 border border-navy-700 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all">
                <Camera size={16} />Analyse Another
              </button>
            </div>
          )}

          {showOutcomeModal && draftForModal && (
            <PlacedModal
              draft={draftForModal}
              onClose={() => setShowOutcomeModal(false)}
              onSaved={() => { setShowOutcomeModal(false); setPlacedStatus('placed'); }}
            />
          )}

          {showBetSlip && betSlipData && (
            <BetSlipModal
              data={betSlipData}
              onClose={() => setShowBetSlip(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
