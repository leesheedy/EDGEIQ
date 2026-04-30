import React, { useState, useMemo } from 'react';
import {
  Dices, ChevronLeft, ChevronDown, ChevronUp, PlusCircle, X,
  BarChart3, AlertTriangle, CheckCircle, Info, DollarSign, Zap, Star,
  ChevronRight, Trophy, TrendingUp, TrendingDown, RefreshCw, Trash2,
  Clock,
} from 'lucide-react';
import { clsx, formatCurrency } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type GameType = 'pokies' | 'roulette' | 'blackjack';
type View = 'hub' | GameType;

interface CasinoSession {
  id: string; game: GameType; venue: string;
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';
  startTime: number; endTime?: number; buyIn: number; cashOut: number;
  notes: string; machineId?: string; denomination?: number;
}

interface BjHand {
  id: string;
  bet: number;
  outcome: 'win' | 'blackjack' | 'push' | 'loss';
  pnl: number;
  desc?: string;
  ts: number;
}

// ─── Pokies data ──────────────────────────────────────────────────────────────
interface PokieMachine {
  name: string; maker: string; emoji: string; bg: string; accent: string;
  border: string; denom: string; maxBet: string; ways: string; rtp: string;
  edgeRating: number; tip: string; bestPlay: string; feature: string;
  avoid?: string; tag?: string;
}

const MACHINES: PokieMachine[] = [
  { name: 'Bull Rush', maker: 'Aristocrat', emoji: '🐂', bg: 'from-red-950 via-red-900 to-amber-950', accent: 'text-amber-400', border: 'border-amber-600/40', denom: '1c', maxBet: '$10', ways: '243 Ways', rtp: '~87–92%', edgeRating: 5, tag: '⭐ EdgeIQ Pick', tip: '1c denomination + $10 max bet activates all 243 ways and full bonus multipliers. Bull Rush free spins pay 50–200x bet. High feature frequency in NSW/VIC clubs.', bestPlay: '1c denom · MAX BET $10 · all 243 ways active', feature: 'Bull Rush Free Spins + Rolling Reels', avoid: 'Never play fewer than max lines — bonus unavailable' },
  { name: 'Dragon Train', maker: 'Aristocrat', emoji: '🐉', bg: 'from-red-900 via-orange-900 to-yellow-950', accent: 'text-yellow-400', border: 'border-yellow-600/30', denom: '1c–2c', maxBet: '$7.50–$10', ways: '243 Ways', rtp: '~88–91%', edgeRating: 4, tip: 'Linked progressive jackpot — jackpot contribution lowers base RTP slightly. Feature triggers with 3+ scatter train symbols paying stacked wilds.', bestPlay: '1c denom · max bet · progressive eligible', feature: 'Dragon Train Free Spins + Linked Jackpot', avoid: 'Only play when jackpot is large — small jackpot = worse RTP' },
  { name: 'Lightning Link', maker: 'Aristocrat', emoji: '⚡', bg: 'from-yellow-950 via-amber-900 to-orange-950', accent: 'text-yellow-300', border: 'border-yellow-500/30', denom: '1c', maxBet: '$7.50', ways: '243 Ways', rtp: '~88–90%', edgeRating: 4, tag: 'Popular', tip: '4 jackpot tiers (Mini/Minor/Major/Grand). Hold & Spin bonus: collect lightning bolt symbols to fill all 15 positions for Grand jackpot.', bestPlay: '1c denom · max bet $7.50 · jackpot eligible', feature: 'Hold & Spin + 4-tier Linked Jackpot' },
  { name: '5 Dragons', maker: 'Aristocrat', emoji: '🐲', bg: 'from-red-950 via-rose-900 to-red-950', accent: 'text-red-400', border: 'border-red-500/30', denom: '1c–5c', maxBet: '$1.25–$2.50', ways: '243 Ways', rtp: '~88–92%', edgeRating: 3, tip: 'Classic low-volatility machine. Good for longer sessions on smaller budgets. Consistent small wins with occasional feature payouts.', bestPlay: '1c denom · lower max bet = better session longevity', feature: '15 Free Games with up to 3x multiplier' },
  { name: 'Mustang Money', maker: 'Ainsworth', emoji: '🐎', bg: 'from-sky-950 via-blue-900 to-indigo-950', accent: 'text-sky-400', border: 'border-sky-500/30', denom: '1c–5c', maxBet: '$5', ways: '243 Ways', rtp: '~87–91%', edgeRating: 3, tag: 'Ainsworth', tip: 'Higher volatility than Aristocrat. Mustang Wild on reel 3 is key. Budget $100–200 to reliably trigger the feature.', bestPlay: '1c denom · max bet $5 · watch for Mustang Wild', feature: 'Free Spins + Expanding Wild on Reel 3' },
  { name: 'Thunder Cash', maker: 'Konami', emoji: '💥', bg: 'from-blue-950 via-indigo-900 to-purple-950', accent: 'text-blue-400', border: 'border-blue-500/30', denom: '1c', maxBet: '$5–$7.50', ways: '243 Ways', rtp: '~88–91%', edgeRating: 4, tip: 'Konami flagship in AU clubs. Xtra Reward Free Spins: 8 free spins with all thunder symbols becoming stacked wilds. Good hit frequency.', bestPlay: '1c denom · max bet · wait for Xtra Reward feature', feature: 'Xtra Reward Free Spins + Stacked Wilds' },
  { name: 'Wonder 4 Jackpots', maker: 'Aristocrat', emoji: '🌟', bg: 'from-purple-950 via-violet-900 to-indigo-950', accent: 'text-purple-400', border: 'border-purple-500/30', denom: '1c', maxBet: '$10', ways: '4 × 243 Ways', rtp: '~87–90%', edgeRating: 4, tag: 'Jackpot', tip: '4-in-1 (Buffalo, 5 Dragons, Indian Dreaming, More Chilli). Super Free Games across all 4 screens. Grand Jackpot requires max bet on all 4.', bestPlay: '1c denom · max bet $10 · all 4 screens active', feature: 'Super Free Games across 4 screens + Grand Jackpot', avoid: 'Max bet required for Grand Jackpot eligibility' },
  { name: 'Zorro', maker: 'Aristocrat', emoji: '🗡️', bg: 'from-slate-900 via-gray-900 to-slate-950', accent: 'text-gray-300', border: 'border-gray-500/30', denom: '5c', maxBet: '$2', ways: '9 Lines', rtp: '~87–89%', edgeRating: 2, tip: 'Older classic machine — lower RTP than modern 243-ways. Still popular for nostalgia but modern machines offer better returns.', bestPlay: '5c · max lines (9) · lower budget machine', feature: 'Zorro Bonus + Free Spins' },
];

// ─── BJ tables ────────────────────────────────────────────────────────────────
const BJ_HARD: Record<string, Record<string, string>> = {
  '8-9':  {'2':'H','3':'H','4':'H','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H'},
  '10':   {'2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'H','A':'H'},
  '11':   {'2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'Dh','A':'H'},
  '12':   {'2':'H','3':'H','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'H','A':'H'},
  '13-14':{'2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'H','A':'H'},
  '15':   {'2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'Rh','A':'H'},
  '16':   {'2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'Rh','10':'Rh','A':'Rh'},
  '17+':  {'2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S'},
};
const BJ_SOFT: Record<string, Record<string, string>> = {
  'A,2-3':{'2':'H','3':'H','4':'H','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H'},
  'A,4-5':{'2':'H','3':'H','4':'Dh','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H'},
  'A,6':  {'2':'H','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H'},
  'A,7':  {'2':'Ds','3':'Ds','4':'Ds','5':'Ds','6':'Ds','7':'S','8':'S','9':'H','10':'H','A':'H'},
  'A,8-9':{'2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S'},
};
const BJ_PAIRS: Record<string, Record<string, string>> = {
  'A,A': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'SP','9':'SP','10':'SP','A':'SP'},
  '10,10':{'2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S'},
  '9,9': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'S','8':'SP','9':'SP','10':'S','A':'S'},
  '8,8': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'SP','9':'SP','10':'SP','A':'SP'},
  '7,7': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H'},
  '6,6': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'H','8':'H','9':'H','10':'H','A':'H'},
  '5,5': {'2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'H','A':'H'},
  '4,4': {'2':'H','3':'H','4':'H','5':'SP','6':'SP','7':'H','8':'H','9':'H','10':'H','A':'H'},
  '3,3': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H'},
  '2,2': {'2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H'},
};
const BJ_ACTIONS: Record<string, { label: string; color: string; bg: string }> = {
  H:  { label: 'Hit',           color: 'text-blue-300',   bg: 'from-blue-600 to-blue-700' },
  S:  { label: 'Stand',         color: 'text-slate-300',  bg: 'from-slate-600 to-slate-700' },
  Dh: { label: 'Double / Hit',  color: 'text-green-300',  bg: 'from-green-600 to-emerald-700' },
  Ds: { label: 'Double / Stand',color: 'text-emerald-300',bg: 'from-emerald-600 to-teal-700' },
  Rh: { label: 'Surrender / Hit',color:'text-red-300',    bg: 'from-red-600 to-red-700' },
  SP: { label: 'Split',         color: 'text-amber-300',  bg: 'from-amber-500 to-orange-600' },
};
const DEALER_CARDS = ['2','3','4','5','6','7','8','9','10','A'];
const CARD_VALS = ['A','2','3','4','5','6','7','8','9','10'] as const;
type CardVal = typeof CARD_VALS[number];

// ─── Storage ──────────────────────────────────────────────────────────────────
const SESSIONS_KEY = 'edgeiq-casino-sessions';
const BJ_HANDS_KEY = 'edgeiq-bj-hands';

function loadSessions(): CasinoSession[] { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } }
function saveSessions(s: CasinoSession[]) { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)); }
function loadBjHands(): BjHand[] { try { return JSON.parse(localStorage.getItem(BJ_HANDS_KEY) || '[]'); } catch { return []; } }
function saveBjHands(h: BjHand[]) { localStorage.setItem(BJ_HANDS_KEY, JSON.stringify(h)); }

// ─── Hand info helper ─────────────────────────────────────────────────────────
function getHandInfo(c1: CardVal | null, c2: CardVal | null): {
  mode: 'hard' | 'soft' | 'pairs'; key: string; label: string; isBlackjack?: boolean;
} | null {
  if (!c1 || !c2) return null;
  if (c1 === c2) return { mode: 'pairs', key: `${c1},${c1}`, label: `Pair of ${c1}s` };
  if (c1 === 'A' || c2 === 'A') {
    const other = c1 === 'A' ? c2 : c1;
    if (other === '10') return { mode: 'hard', key: '17+', label: 'Blackjack! 21', isBlackjack: true };
    const v = parseInt(other);
    const key = v <= 3 ? 'A,2-3' : v <= 5 ? 'A,4-5' : v === 6 ? 'A,6' : v === 7 ? 'A,7' : 'A,8-9';
    return { mode: 'soft', key, label: `Soft ${11 + v}` };
  }
  const total = (c1 === '10' ? 10 : parseInt(c1)) + (c2 === '10' ? 10 : parseInt(c2));
  const key = total <= 9 ? '8-9' : total === 10 ? '10' : total === 11 ? '11' : total === 12 ? '12' : total <= 14 ? '13-14' : total === 15 ? '15' : total === 16 ? '16' : '17+';
  return { mode: 'hard', key, label: `Hard ${total}` };
}

// ─── Multi-card hand helpers ──────────────────────────────────────────────────
function calcHandTotal(cards: CardVal[]): { total: number; soft: boolean; bust: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c === 'A') { aces++; total += 11; }
    else { total += c === '10' ? 10 : parseInt(c); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0, bust: total > 21 };
}

function getMultiCardAction(cards: CardVal[], dealerCard: CardVal): string {
  const { total, soft, bust } = calcHandTotal(cards);
  if (bust) return 'BUST';
  if (total >= 21) return 'S';
  let raw: string;
  if (soft && total <= 18) {
    const key = total <= 14 ? 'A,2-3' : total <= 16 ? 'A,4-5' : total === 17 ? 'A,6' : 'A,7';
    raw = BJ_SOFT[key]?.[dealerCard] ?? 'S';
  } else {
    const key = total <= 9 ? '8-9' : total === 10 ? '10' : total === 11 ? '11'
      : total === 12 ? '12' : total <= 14 ? '13-14' : total === 15 ? '15'
      : total === 16 ? '16' : '17+';
    raw = BJ_HARD[key]?.[dealerCard] ?? 'S';
  }
  if (raw === 'Dh' || raw === 'Rh') return 'H';
  if (raw === 'Ds') return 'S';
  return raw;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function Casino() {
  const [view, setView] = useState<View>('hub');
  const [sessions, setSessions] = useState<CasinoSession[]>(loadSessions);
  const [bjHands, setBjHands] = useState<BjHand[]>(loadBjHands);

  function updateSessions(s: CasinoSession[]) { setSessions(s); saveSessions(s); }
  function updateBjHands(h: BjHand[]) { setBjHands(h); saveBjHands(h); }

  if (view === 'pokies')    return <PokiesScreen    sessions={sessions.filter(s => s.game === 'pokies')}    allSessions={sessions} onUpdateSessions={updateSessions} onBack={() => setView('hub')} />;
  if (view === 'roulette')  return <RouletteScreen  sessions={sessions.filter(s => s.game === 'roulette')}  allSessions={sessions} onUpdateSessions={updateSessions} onBack={() => setView('hub')} />;
  if (view === 'blackjack') return <BlackjackScreen sessions={sessions.filter(s => s.game === 'blackjack')} allSessions={sessions} onUpdateSessions={updateSessions} bjHands={bjHands} onUpdateBjHands={updateBjHands} onBack={() => setView('hub')} />;

  const totalPnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);
  const bjPnl    = bjHands.reduce((a, h) => a + h.pnl, 0);
  const combinedPnl = totalPnl + bjPnl;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Dices size={22} className="text-purple-400" />
            <h1 className="font-display font-bold text-2xl text-white">Casino</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Strategy · tracking · best odds</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 font-mono">All-time P&L</div>
          <div className={clsx('font-display font-bold text-xl', combinedPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
            {combinedPnl >= 0 ? '+' : ''}{formatCurrency(combinedPnl)}
          </div>
        </div>
      </div>

      {/* Best odds banner */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-3 mb-5">
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">House edge ranking — lower is better for you</p>
        <div className="flex gap-2">
          {[
            { label: 'Blackjack', he: '0.5%', color: 'text-green-edge', bg: 'bg-green-edge/10', border: 'border-green-edge/30', badge: 'BEST' },
            { label: 'Roulette', he: '2.7%', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', badge: '' },
            { label: 'Pokies', he: '10–15%', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', badge: 'WORST' },
          ].map((r, i) => (
            <div key={r.label} className={clsx('flex-1 rounded-xl p-2 text-center border', r.bg, r.border)}>
              <div className="text-xs font-mono text-gray-400">{i + 1}</div>
              <div className={clsx('text-xs font-display font-bold', r.color)}>{r.label}</div>
              <div className={clsx('text-[10px] font-mono', r.color)}>HE {r.he}</div>
              {r.badge && <div className={clsx('text-[9px] font-mono font-bold mt-0.5', r.color)}>{r.badge}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Game cards */}
      <div className="flex flex-col gap-3 mb-6">
        <GameHubCard
          game="blackjack" label="Blackjack" emoji="🃏"
          he="0.5%" heLabel="House Edge"
          desc="Perfect basic strategy · hand-by-hand tracking · win/loss recording"
          badge="BEST ODDS" badgeColor="text-green-edge bg-green-edge/15 border-green-edge/30"
          gradient="from-green-950 to-emerald-950" border="border-green-edge/20"
          sessions={sessions.filter(s => s.game === 'blackjack')}
          bjHands={bjHands}
          onNavigate={() => setView('blackjack')}
        />
        <GameHubCard
          game="roulette" label="Roulette" emoji="🎡"
          he="2.7%" heLabel="House Edge (EU)"
          desc="European single-zero · La Partage rule · bet guide"
          badge="GOOD ODDS" badgeColor="text-amber-400 bg-amber-400/15 border-amber-400/30"
          gradient="from-red-950 to-rose-950" border="border-red-500/20"
          sessions={sessions.filter(s => s.game === 'roulette')}
          onNavigate={() => setView('roulette')}
        />
        <GameHubCard
          game="pokies" label="Pokies" emoji="🎰"
          he="10–15%" heLabel="House Edge"
          desc="Machine guide · 1c denom tips · Bull Rush & more"
          badge="WORST ODDS" badgeColor="text-gray-400 bg-gray-700/30 border-gray-600/30"
          gradient="from-purple-950 to-violet-950" border="border-purple-500/20"
          sessions={sessions.filter(s => s.game === 'pokies')}
          onNavigate={() => setView('pokies')}
        />
      </div>
    </div>
  );
}

// ─── Hub card ─────────────────────────────────────────────────────────────────
function GameHubCard({ label, emoji, he, heLabel, desc, badge, badgeColor, gradient, border, sessions, bjHands, onNavigate }: {
  game: GameType; label: string; emoji: string; he: string; heLabel: string;
  desc: string; badge: string; badgeColor: string; gradient: string; border: string;
  sessions: CasinoSession[]; bjHands?: BjHand[]; onNavigate: () => void;
}) {
  const sessionPnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);
  const bjPnl = bjHands?.reduce((a, h) => a + h.pnl, 0) ?? 0;
  const pnl = sessionPnl + bjPnl;
  const count = sessions.length + (bjHands?.length ?? 0);

  return (
    <button
      onClick={onNavigate}
      className={clsx('w-full rounded-2xl border overflow-hidden text-left transition-all hover:scale-[1.01] active:scale-[0.99]', border)}
    >
      <div className={clsx('bg-gradient-to-r px-4 py-4 flex items-center gap-4', gradient)}>
        <span className="text-4xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display font-bold text-white text-lg">{label}</span>
            <span className={clsx('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', badgeColor)}>{badge}</span>
          </div>
          <p className="text-xs text-white/50 font-mono leading-snug">{desc}</p>
        </div>
        <ChevronRight size={18} className="text-white/40 shrink-0" />
      </div>
      <div className="bg-navy-800 px-4 py-2.5 flex items-center gap-4">
        <div>
          <span className="text-[10px] text-gray-500 font-mono">{heLabel}</span>
          <span className="text-xs font-mono font-bold text-white ml-1.5">{he}</span>
        </div>
        <div className="flex-1" />
        {count > 0 && (
          <div className="text-right">
            <div className={clsx('text-sm font-mono font-bold', pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">{count} sessions/hands</div>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Page wrapper / back header ───────────────────────────────────────────────
function GamePageHeader({ emoji, label, color, pnl, onBack, children }: {
  emoji: string; label: string; color: string; pnl: number; onBack: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="p-2.5 rounded-xl bg-navy-800 border border-navy-700 text-gray-400 hover:text-white transition-all">
        <ChevronLeft size={18} />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h1 className={clsx('font-display font-bold text-xl', color)}>{label}</h1>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-gray-500 font-mono">P&L</div>
        <div className={clsx('font-display font-bold text-base', pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
        </div>
      </div>
      {children}
    </div>
  );
}

function GameTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 mb-5 bg-navy-800 border border-navy-700 rounded-xl p-1">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('flex-1 py-2 rounded-lg text-xs font-mono transition-all',
            active === t.id ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Pokies Screen ────────────────────────────────────────────────────────────
function PokiesScreen({ sessions, allSessions, onUpdateSessions, onBack }: {
  sessions: CasinoSession[]; allSessions: CasinoSession[];
  onUpdateSessions: (s: CasinoSession[]) => void; onBack: () => void;
}) {
  const [tab, setTab] = useState('guide');
  const [selected, setSelected] = useState<PokieMachine | null>(null);
  const pnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <GamePageHeader emoji="🎰" label="Pokies" color="text-purple-400" pnl={pnl} onBack={onBack} />
      <GameTabs tabs={[{ id: 'guide', label: 'Machine Guide' }, { id: 'session', label: 'New Session' }, { id: 'history', label: 'History' }]} active={tab} onChange={setTab} />

      {tab === 'guide' && (
        <div className="space-y-4">
          {/* EdgeIQ tips */}
          <div className="bg-navy-800 border border-purple-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-purple-400" />
              <h3 className="font-display font-semibold text-white text-sm">EdgeIQ Pokies Rules</h3>
            </div>
            {[
              { tip: 'Always MAX BET', why: 'Required for bonus eligibility', ok: true },
              { tip: '1c denomination = best RTP', why: 'More ways per dollar than higher denoms', ok: true },
              { tip: '243 Ways > Fixed Lines', why: 'More ways to win per spin', ok: true },
              { tip: 'Avoid small linked progressives', why: 'Jackpot contribution lowers base RTP', ok: false },
              { tip: 'No hot/cold machine — all RNG', why: 'Every spin is fully independent', ok: false },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-navy-700/40 last:border-0">
                <span className={clsx('text-xs font-mono font-bold shrink-0', r.ok ? 'text-green-edge' : 'text-red-400')}>{r.ok ? '✓' : '✗'}</span>
                <div><span className={clsx('text-xs font-mono font-semibold', r.ok ? 'text-green-edge' : 'text-red-400')}>{r.tip}</span><span className="text-xs text-gray-600 font-mono"> — {r.why}</span></div>
              </div>
            ))}
          </div>

          {/* Machine grid */}
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Popular AU Machines — tap for guide</p>
          <div className="grid grid-cols-2 gap-3">
            {MACHINES.map(m => (
              <button key={m.name} onClick={() => setSelected(selected?.name === m.name ? null : m)}
                className={clsx('rounded-2xl overflow-hidden border text-left transition-all', m.border, selected?.name === m.name ? 'ring-2 ring-green-edge/60' : '')}>
                <div className={clsx('bg-gradient-to-b p-4 flex flex-col items-center gap-1', m.bg)} style={{ minHeight: 90 }}>
                  {m.tag && <span className={clsx('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-black/40', m.accent)}>{m.tag}</span>}
                  <div className="text-3xl">{m.emoji}</div>
                  <div className={clsx('text-xs font-display font-bold text-center', m.accent)}>{m.name}</div>
                  <div className="text-[9px] font-mono text-white/40">{m.maker}</div>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({length:5}).map((_,i) => <Star key={i} size={7} className={i < m.edgeRating ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />)}
                  </div>
                </div>
                <div className="bg-navy-900 px-3 py-2">
                  <div className="flex justify-between"><span className="text-[9px] text-gray-600 font-mono">Best bet</span><span className={clsx('text-[9px] font-mono font-semibold', m.accent)}>{m.maxBet}</span></div>
                  <div className="flex justify-between"><span className="text-[9px] text-gray-600 font-mono">Denom</span><span className={clsx('text-[9px] font-mono font-semibold', m.accent)}>{m.denom}</span></div>
                </div>
              </button>
            ))}
          </div>

          {/* Machine detail */}
          {selected && (
            <div className={clsx('border rounded-2xl overflow-hidden', selected.border)}>
              <div className={clsx('bg-gradient-to-r p-4 flex items-center gap-3', selected.bg)}>
                <span className="text-3xl">{selected.emoji}</span>
                <div className="flex-1">
                  <h3 className={clsx('font-display font-bold text-base', selected.accent)}>{selected.name}</h3>
                  <p className="text-xs text-white/50 font-mono">{selected.maker} · {selected.ways} · {selected.rtp} RTP</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg bg-black/20 text-white/60 hover:text-white"><X size={13} /></button>
              </div>
              <div className="bg-navy-800 p-4 space-y-3">
                <div className="bg-green-edge/5 border border-green-edge/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5"><Zap size={11} className="text-green-edge" /><span className="text-[10px] font-mono font-bold text-green-edge uppercase">EdgeIQ Best Play</span></div>
                  <p className={clsx('text-sm font-mono font-bold mb-1.5', selected.accent)}>{selected.bestPlay}</p>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed">{selected.tip}</p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-navy-900 rounded-xl">
                  <Zap size={11} className="text-purple-400 mt-0.5 shrink-0" />
                  <div><p className="text-[9px] font-mono text-gray-500 uppercase">Key Feature</p><p className="text-xs text-white font-mono mt-0.5">{selected.feature}</p></div>
                </div>
                {selected.avoid && (
                  <div className="flex items-start gap-2 p-3 bg-red-edge/5 border border-red-edge/20 rounded-xl">
                    <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-400 font-mono">{selected.avoid}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'session' && <NewSession game="pokies" allSessions={allSessions} onUpdate={s => { onUpdateSessions(s); setTab('history'); }} />}
      {tab === 'history' && <SessionsList sessions={sessions} allSessions={allSessions} onUpdate={onUpdateSessions} />}
    </div>
  );
}

// ─── Roulette Screen ──────────────────────────────────────────────────────────
function RouletteScreen({ sessions, allSessions, onUpdateSessions, onBack }: {
  sessions: CasinoSession[]; allSessions: CasinoSession[];
  onUpdateSessions: (s: CasinoSession[]) => void; onBack: () => void;
}) {
  const [tab, setTab] = useState('guide');
  const pnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);

  const bets = [
    { bet: 'EU Roulette + La Partage ★★', payout: '1:1 (half back on 0)', he: '1.35%', tier: 'top' },
    { bet: 'Red / Black', payout: '1:1', he: '2.70%', tier: 'best' },
    { bet: 'Even / Odd', payout: '1:1', he: '2.70%', tier: 'best' },
    { bet: 'High / Low', payout: '1:1', he: '2.70%', tier: 'best' },
    { bet: 'Dozen / Column', payout: '2:1', he: '2.70%', tier: 'good' },
    { bet: 'Six line (6 numbers)', payout: '5:1', he: '2.70%', tier: 'same' },
    { bet: 'Corner (4 numbers)', payout: '8:1', he: '2.70%', tier: 'same' },
    { bet: 'Street (3 numbers)', payout: '11:1', he: '2.70%', tier: 'same' },
    { bet: 'Split (2 numbers)', payout: '17:1', he: '2.70%', tier: 'same' },
    { bet: 'Single number', payout: '35:1', he: '2.70%', tier: 'same' },
    { bet: 'American (double 00)', payout: 'varies', he: '5.26%', tier: 'avoid' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <GamePageHeader emoji="🎡" label="Roulette" color="text-red-400" pnl={pnl} onBack={onBack} />
      <GameTabs tabs={[{ id: 'guide', label: 'Bet Guide' }, { id: 'session', label: 'New Session' }, { id: 'history', label: 'History' }]} active={tab} onChange={setTab} />

      {tab === 'guide' && (
        <div className="space-y-4">
          {/* Top rules */}
          <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3"><Zap size={13} className="text-amber-400" /><h3 className="font-display font-semibold text-white text-sm">EdgeIQ Roulette Rules</h3></div>
            {[
              { rule: 'European (single 0) over American (double 00)', why: '2.7% HE vs 5.26%', ok: true },
              { rule: 'Ask for La Partage rule', why: 'Half stake back on even bets when 0 hits — HE drops to 1.35%', ok: true },
              { rule: 'Outside bets (Red/Black, Even/Odd)', why: '~49% win rate — best for longevity', ok: true },
              { rule: "Betting systems (Martingale etc.) don't change EV", why: 'House edge is fixed regardless of system', ok: false },
              { rule: 'Never play American roulette', why: 'Extra 00 nearly doubles house edge', ok: false },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-navy-700/30 last:border-0">
                <span className={clsx('text-xs font-mono font-bold shrink-0', r.ok ? 'text-green-edge' : 'text-red-400')}>{r.ok ? '✓' : '✗'}</span>
                <div><span className="text-xs font-mono text-gray-300">{r.rule}</span><span className="text-xs text-gray-600 font-mono"> — {r.why}</span></div>
              </div>
            ))}
          </div>

          {/* Bet table */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <h3 className="font-display font-semibold text-white text-sm mb-3">All Bets by House Edge</h3>
            <div className="space-y-1">
              {bets.map((row, i) => (
                <div key={i} className={clsx('flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-mono',
                  row.tier === 'top'   ? 'bg-green-edge/10 border border-green-edge/20' :
                  row.tier === 'best'  ? 'bg-amber-400/5 border border-amber-400/10' :
                  row.tier === 'avoid' ? 'bg-red-400/10 border border-red-400/20' : 'bg-navy-900/40'
                )}>
                  <span className={clsx('flex-1',
                    row.tier === 'top'   ? 'text-green-edge' :
                    row.tier === 'best'  ? 'text-amber-400' :
                    row.tier === 'avoid' ? 'text-red-400' : 'text-gray-400'
                  )}>{row.bet}</span>
                  <span className="text-gray-400 w-20 text-right shrink-0">{row.payout}</span>
                  <span className={clsx('w-12 text-right font-bold shrink-0',
                    row.he === '1.35%' ? 'text-green-edge' : row.tier === 'avoid' ? 'text-red-400' : 'text-gray-500'
                  )}>HE {row.he}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 font-mono mt-2">★★ Best bet if La Partage is available</p>
          </div>

          {/* Betting systems */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <h3 className="font-display font-semibold text-white text-sm mb-3">Betting Systems Reality Check</h3>
            {[
              { name: 'Martingale', desc: 'Double after each loss', verdict: 'Dangerous — table limits cause ruin', risk: 'high' },
              { name: "D'Alembert", desc: '+1 unit after loss, -1 after win', verdict: 'Safer but still negative EV', risk: 'med' },
              { name: 'Flat betting', desc: 'Same bet every spin', verdict: 'Best for minimising losses long-term', risk: 'low' },
            ].map(s => (
              <div key={s.name} className="flex items-start gap-3 py-2 border-b border-navy-700/30 last:border-0">
                <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', s.risk === 'high' ? 'bg-red-400' : s.risk === 'med' ? 'bg-amber-400' : 'bg-green-edge')} />
                <div>
                  <span className="text-xs font-mono font-semibold text-white">{s.name}</span>
                  <span className="text-xs text-gray-500 font-mono ml-2">{s.desc}</span>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{s.verdict}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'session' && <NewSession game="roulette" allSessions={allSessions} onUpdate={s => { onUpdateSessions(s); setTab('history'); }} />}
      {tab === 'history' && <SessionsList sessions={sessions} allSessions={allSessions} onUpdate={onUpdateSessions} />}
    </div>
  );
}

// ─── Blackjack Screen ─────────────────────────────────────────────────────────
function BlackjackScreen({ sessions, allSessions, onUpdateSessions, bjHands, onUpdateBjHands, onBack }: {
  sessions: CasinoSession[]; allSessions: CasinoSession[];
  onUpdateSessions: (s: CasinoSession[]) => void;
  bjHands: BjHand[]; onUpdateBjHands: (h: BjHand[]) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState('play');
  const sessionPnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);
  const bjPnl      = bjHands.reduce((a, h) => a + h.pnl, 0);
  const pnl        = sessionPnl + bjPnl;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <GamePageHeader emoji="🃏" label="Blackjack" color="text-green-edge" pnl={pnl} onBack={onBack} />
      <GameTabs
        tabs={[
          { id: 'play',    label: 'Play' },
          { id: 'strategy',label: 'Strategy' },
          { id: 'history', label: 'History' },
        ]}
        active={tab} onChange={setTab}
      />

      {tab === 'play'     && <BjPlay hands={bjHands} onUpdate={onUpdateBjHands} />}
      {tab === 'strategy' && <BjStrategy />}
      {tab === 'history'  && <BjHistory hands={bjHands} sessions={sessions} allSessions={allSessions} onUpdateSessions={onUpdateSessions} onUpdateHands={onUpdateBjHands} />}
    </div>
  );
}

// ─── BJ Play (integrated bet + strategy + live recording) ────────────────────
function BjPlay({ hands, onUpdate }: { hands: BjHand[]; onUpdate: (h: BjHand[]) => void }) {
  const [bet, setBet] = useState('10');
  const [c1, setC1] = useState<CardVal | null>(null);
  const [c2, setC2] = useState<CardVal | null>(null);
  const [d, setD] = useState<CardVal | null>(null);
  const [focus, setFocus] = useState<'c1' | 'c2' | 'd'>('c1');
  const [hitCards, setHitCards] = useState<CardVal[]>([]);
  const [lastResult, setLastResult] = useState<{ outcome: BjHand['outcome']; pnl: number } | null>(null);

  const hand = useMemo(() => getHandInfo(c1, c2), [c1, c2]);
  const action = useMemo(() => {
    if (!hand || !d || hand.isBlackjack) return null;
    const table = hand.mode === 'pairs' ? BJ_PAIRS : hand.mode === 'soft' ? BJ_SOFT : BJ_HARD;
    return table[hand.key]?.[d] ?? null;
  }, [hand, d]);

  const allPlayerCards = useMemo((): CardVal[] => (c1 && c2 ? [c1, c2, ...hitCards] : []), [c1, c2, hitCards]);
  const hitHandInfo = useMemo(() => hitCards.length > 0 ? calcHandTotal(allPlayerCards) : null, [allPlayerCards, hitCards.length]);
  const hitAction = useMemo(() => (hitCards.length > 0 && d ? getMultiCardAction(allPlayerCards, d) : null), [allPlayerCards, hitCards.length, d]);
  const showHitSection = !!d && !!hand && !hand.isBlackjack &&
    ((action === 'H' || action === 'Dh' || action === 'Rh') || hitCards.length > 0);
  const needsAnotherHit = showHitSection && !hitHandInfo?.bust &&
    (hitAction === 'H' || (hitCards.length === 0 && (action === 'H' || action === 'Dh' || action === 'Rh')));

  function pickCard(v: CardVal) {
    if (focus === 'c1') { setC1(v); setFocus('c2'); }
    else if (focus === 'c2') { setC2(v); setFocus('d'); }
    else { setD(v); }
    setLastResult(null);
  }

  function resetHand() { setC1(null); setC2(null); setD(null); setFocus('c1'); setLastResult(null); setHitCards([]); }

  function record(outcome: BjHand['outcome']) {
    const b = parseFloat(bet);
    if (isNaN(b) || b <= 0) return;
    const pnl = outcome === 'win' ? b : outcome === 'blackjack' ? Math.round(b * 1.5 * 100) / 100 : outcome === 'push' ? 0 : -b;
    const handDesc = hand ? `${hand.label}${d ? ` vs ${d}` : ''}` : undefined;
    const h: BjHand = { id: Date.now().toString(36), bet: b, outcome, pnl, desc: handDesc, ts: Date.now() };
    const updated = [h, ...hands].slice(0, 200);
    onUpdate(updated);
    setLastResult({ outcome, pnl });
    setTimeout(resetHand, 800);
  }

  const betNum = parseFloat(bet) || 0;
  const todayHands = hands.filter(h => h.ts > Date.now() - 86400000);
  const sessionPnl = todayHands.reduce((a, h) => a + h.pnl, 0);
  const wins = todayHands.filter(h => h.outcome === 'win' || h.outcome === 'blackjack').length;
  const actionConfig = action ? BJ_ACTIONS[action] : null;

  return (
    <div className="space-y-4">
      {/* Session stats */}
      {todayHands.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 font-mono mb-0.5">SESSION P&L</div>
            <div className={clsx('text-sm font-display font-bold', sessionPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
              {sessionPnl >= 0 ? '+' : ''}{formatCurrency(sessionPnl)}
            </div>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 font-mono mb-0.5">HANDS</div>
            <div className="text-sm font-display font-bold text-white">{todayHands.length}</div>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 font-mono mb-0.5">WIN RATE</div>
            <div className="text-sm font-display font-bold text-white">
              {todayHands.length > 0 ? Math.round((wins / todayHands.length) * 100) : 0}%
            </div>
          </div>
        </div>
      )}

      {/* Bet amount */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <p className="text-xs font-mono text-gray-400 mb-2">Bet Amount</p>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
            <input
              type="number" value={bet} onChange={e => setBet(e.target.value)}
              className="w-full bg-navy-900 border border-navy-600 rounded-xl pl-7 pr-3 py-3 text-white font-display font-bold text-xl focus:outline-none focus:border-green-edge/50"
              placeholder="10"
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[5, 10, 25, 50, 100].map(a => (
            <button key={a} onClick={() => setBet(String(a))}
              className={clsx('flex-1 py-2 rounded-xl text-xs font-mono border transition-all',
                parseFloat(bet) === a ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-900 text-gray-400 border-navy-700 hover:text-white')}>
              ${a}
            </button>
          ))}
        </div>
      </div>

      {/* Card selection */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        <div className="p-4 pb-2">
          <p className="text-xs font-mono text-gray-400 mb-3">Your Hand vs Dealer</p>

          {/* Card slots */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-2 flex-1">
              {([{ key: 'c1' as const, val: c1, label: '1st card' }, { key: 'c2' as const, val: c2, label: '2nd card' }]).map(({ key, val, label }) => (
                <button key={key} onClick={() => setFocus(key)}
                  className={clsx('flex-1 h-16 rounded-xl font-display font-bold text-2xl border-2 transition-all',
                    focus === key && !val ? 'border-green-edge bg-green-edge/10 text-green-edge/60 animate-pulse' :
                    focus === key && val  ? 'border-green-edge bg-green-edge/15 text-green-edge' :
                    val ? 'border-navy-600 bg-navy-900 text-white' :
                    'border-dashed border-navy-700 bg-navy-900/40 text-gray-600'
                  )}>
                  {val || '?'}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-600 font-mono px-1">vs</div>
            <button onClick={() => setFocus('d')}
              className={clsx('w-16 h-16 rounded-xl font-display font-bold text-2xl border-2 transition-all',
                focus === 'd' && !d ? 'border-red-500 bg-red-500/10 text-red-400/60 animate-pulse' :
                focus === 'd' && d  ? 'border-red-400 bg-red-500/15 text-red-300' :
                d ? 'border-navy-600 bg-navy-900 text-white' :
                'border-dashed border-navy-700 bg-navy-900/40 text-gray-600'
              )}>
              {d || '?'}
            </button>
          </div>

          {/* Instruction + hand label */}
          <div className="flex items-center justify-between mb-3">
            <span className={clsx('text-xs font-mono px-2.5 py-1 rounded-full font-bold',
              hand?.mode === 'pairs' ? 'bg-amber-500/20 text-amber-400' :
              hand?.mode === 'soft'  ? 'bg-blue-500/20 text-blue-400' :
              hand ? 'bg-navy-700 text-gray-300' : 'text-gray-600'
            )}>
              {hand ? hand.label : focus === 'c1' ? 'Tap a card ↓' : focus === 'c2' ? 'Tap 2nd card ↓' : 'Tap dealer card ↓'}
            </span>
            {(c1 || c2 || d) && (
              <button onClick={resetHand} className="text-xs font-mono text-gray-600 hover:text-white transition-colors">Clear</button>
            )}
          </div>
        </div>

        {/* Card keyboard */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {CARD_VALS.map(v => (
              <button key={v} onClick={() => pickCard(v)}
                className={clsx('h-13 py-3 rounded-xl font-display font-bold text-xl transition-all active:scale-90 border-2',
                  focus === 'd'
                    ? 'bg-red-950 text-red-200 border-red-900 hover:bg-red-900'
                    : 'bg-navy-900 text-white border-navy-700 hover:border-navy-500 hover:bg-navy-700'
                )}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Action result */}
        {hand?.isBlackjack && (
          <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-500 text-center">
            <div className="text-2xl mb-0.5">🃏</div>
            <div className="font-display font-bold text-white text-2xl">BLACKJACK!</div>
            <div className="text-white/70 text-xs font-mono mt-0.5">3:2 payout</div>
          </div>
        )}
        {action && actionConfig && !hand?.isBlackjack && (
          <div className={clsx('mx-4 mb-4 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r', actionConfig.bg)}>
            <div className="flex-1">
              <div className="font-display font-bold text-white text-2xl">{actionConfig.label}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">{hand?.label} vs dealer {d}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-black/25 flex items-center justify-center shrink-0">
              <span className="font-display font-bold text-white text-lg">{action}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hit card tracking section */}
      {showHitSection && (
        <div className="bg-navy-800 border border-blue-500/30 rounded-2xl overflow-hidden">
          <div className="p-4 pb-2">
            {/* Drawn cards + current total */}
            {hitCards.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {hitCards.map((c, i) => (
                      <div key={i} className="w-9 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center font-display font-bold text-lg text-blue-300">{c}</div>
                    ))}
                  </div>
                  <ChevronRight size={14} className="text-gray-600 shrink-0" />
                  <div className="flex-1">
                    <div className={clsx('text-sm font-mono font-bold', hitHandInfo?.soft ? 'text-blue-400' : 'text-white')}>
                      {hitHandInfo?.bust ? 'BUST' : `${hitHandInfo?.soft ? 'Soft' : 'Hard'} ${hitHandInfo?.total}`}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">{hitCards.length} card{hitCards.length > 1 ? 's' : ''} drawn</div>
                  </div>
                  <button onClick={() => setHitCards(prev => prev.slice(0, -1))} className="text-xs font-mono text-gray-600 hover:text-white transition-colors">Undo</button>
                </div>
                {/* Updated action banner */}
                {hitHandInfo?.bust ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-red-900/40 border border-red-500/30">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <div>
                      <div className="font-display font-bold text-red-400 text-xl">BUST</div>
                      <div className="text-red-400/60 text-xs font-mono">{hitHandInfo.total} — over 21</div>
                    </div>
                  </div>
                ) : hitAction && BJ_ACTIONS[hitAction] ? (
                  <div className={clsx('flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r', BJ_ACTIONS[hitAction].bg)}>
                    <div className="flex-1">
                      <div className="font-display font-bold text-white text-xl">{BJ_ACTIONS[hitAction].label}</div>
                      <div className="text-white/60 text-xs font-mono">{hitHandInfo?.soft ? 'Soft' : 'Hard'} {hitHandInfo?.total} vs dealer {d}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center shrink-0">
                      <span className="font-display font-bold text-white text-base">{hitAction}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {/* Card picker for next hit */}
            {needsAnotherHit && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                <p className="text-xs font-mono text-blue-400 font-semibold">
                  {hitCards.length === 0 ? 'You hit — tap the card you received:' : 'Hit again — tap the new card:'}
                </p>
              </div>
            )}
          </div>
          {needsAnotherHit && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-5 gap-2">
                {CARD_VALS.map(v => (
                  <button key={v} onClick={() => { setHitCards(prev => [...prev, v]); setLastResult(null); }}
                    className="py-3 rounded-xl font-display font-bold text-xl transition-all active:scale-90 border-2 bg-blue-950 text-blue-200 border-blue-900 hover:bg-blue-900">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last result flash */}
      {lastResult && (
        <div className={clsx('flex items-center justify-center gap-2 py-3 rounded-2xl font-display font-bold text-lg transition-all',
          lastResult.outcome === 'win' || lastResult.outcome === 'blackjack' ? 'bg-green-edge/20 text-green-edge' :
          lastResult.outcome === 'push' ? 'bg-gray-700/50 text-gray-300' : 'bg-red-edge/20 text-red-edge'
        )}>
          {lastResult.outcome === 'blackjack' ? '🃏 Blackjack! ' : ''}
          {lastResult.pnl >= 0 ? '+' : ''}{formatCurrency(lastResult.pnl)} recorded
        </div>
      )}

      {/* Outcome buttons */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <p className="text-xs font-mono text-gray-400 mb-3">Record Hand Result</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => record('win')}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-green-edge/15 border border-green-edge/30 text-green-edge hover:bg-green-edge/25 active:scale-95 transition-all">
            <TrendingUp size={22} className="mb-1" />
            <span className="font-display font-bold text-base">WIN</span>
            {betNum > 0 && <span className="text-xs font-mono opacity-70">+{formatCurrency(betNum)}</span>}
          </button>
          <button onClick={() => record('blackjack')}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 active:scale-95 transition-all">
            <span className="text-xl mb-1">🃏</span>
            <span className="font-display font-bold text-base">BLACKJACK</span>
            {betNum > 0 && <span className="text-xs font-mono opacity-70">+{formatCurrency(Math.round(betNum * 1.5 * 100) / 100)}</span>}
          </button>
          <button onClick={() => record('push')}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-navy-900 border border-navy-600 text-gray-400 hover:text-white hover:border-navy-500 active:scale-95 transition-all">
            <CheckCircle size={22} className="mb-1" />
            <span className="font-display font-bold text-base">PUSH</span>
            <span className="text-xs font-mono opacity-70">$0.00</span>
          </button>
          <button onClick={() => record('loss')}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-red-edge/15 border border-red-edge/30 text-red-edge hover:bg-red-edge/25 active:scale-95 transition-all">
            <TrendingDown size={22} className="mb-1" />
            <span className="font-display font-bold text-base">LOSS</span>
            {betNum > 0 && <span className="text-xs font-mono opacity-70">-{formatCurrency(betNum)}</span>}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 font-mono mt-2 text-center">Select your cards above for strategy, then record result</p>
      </div>

      {/* Recent hands */}
      {hands.slice(0, 5).length > 0 && (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Recent Hands</p>
          <div className="space-y-1">
            {hands.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-navy-700/30 last:border-0">
                <span className={clsx('text-xs font-mono font-bold w-20 shrink-0',
                  h.outcome === 'win' || h.outcome === 'blackjack' ? 'text-green-edge' :
                  h.outcome === 'push' ? 'text-gray-400' : 'text-red-edge'
                )}>
                  {h.outcome === 'blackjack' ? 'BLACKJACK' : h.outcome.toUpperCase()}
                </span>
                <span className="flex-1 text-xs text-gray-500 font-mono truncate">{h.desc || '—'}</span>
                <span className={clsx('text-xs font-mono font-bold shrink-0', h.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                  {h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BJ Strategy (pure lookup) ────────────────────────────────────────────────
function BjStrategy() {
  const [c1, setC1] = useState<CardVal | null>(null);
  const [c2, setC2] = useState<CardVal | null>(null);
  const [d, setD] = useState<CardVal | null>(null);
  const [focus, setFocus] = useState<'c1' | 'c2' | 'd'>('c1');
  const [showChart, setShowChart] = useState(false);

  const hand = useMemo(() => getHandInfo(c1, c2), [c1, c2]);
  const action = useMemo(() => {
    if (!hand || !d || hand.isBlackjack) return null;
    const table = hand.mode === 'pairs' ? BJ_PAIRS : hand.mode === 'soft' ? BJ_SOFT : BJ_HARD;
    return table[hand.key]?.[d] ?? null;
  }, [hand, d]);

  function pick(v: CardVal) {
    if (focus === 'c1') { setC1(v); setFocus('c2'); }
    else if (focus === 'c2') { setC2(v); setFocus('d'); }
    else { setD(v); }
  }

  function reset() { setC1(null); setC2(null); setD(null); setFocus('c1'); }
  const actionConfig = action ? BJ_ACTIONS[action] : null;

  return (
    <div className="space-y-4">
      {/* Key rules */}
      <div className="bg-green-edge/5 border border-green-edge/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2"><Zap size={13} className="text-green-edge" /><h3 className="font-display font-semibold text-white text-sm">Key Rules</h3></div>
        {[[true,'Always split Aces + 8s'],[true,'Double on 10/11 vs dealer 2–9'],[false,'Never take insurance (8% HE)'],[false,'Never split 10s — you have 20'],[true,'S17 table = 0.2% less house edge']].map(([ok, rule], i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className={clsx('text-xs font-mono font-bold shrink-0', ok ? 'text-green-edge' : 'text-red-400')}>{ok ? '✓' : '✗'}</span>
            <span className="text-xs font-mono text-gray-300">{rule as string}</span>
          </div>
        ))}
      </div>

      {/* Strategy lookup */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-2 flex-1">
              {([{k:'c1' as const,v:c1},{k:'c2' as const,v:c2}]).map(({k,v}) => (
                <button key={k} onClick={() => setFocus(k)}
                  className={clsx('flex-1 h-14 rounded-xl font-display font-bold text-2xl border-2 transition-all',
                    focus === k && !v ? 'border-green-edge bg-green-edge/10 text-green-edge/50 animate-pulse' :
                    focus === k && v  ? 'border-green-edge bg-green-edge/15 text-green-edge' :
                    v ? 'border-navy-600 bg-navy-900 text-white' : 'border-dashed border-navy-700 bg-navy-900/40 text-gray-600'
                  )}>{v || '?'}</button>
              ))}
            </div>
            <span className="text-xs text-gray-600 font-mono px-1">vs</span>
            <button onClick={() => setFocus('d')}
              className={clsx('w-14 h-14 rounded-xl font-display font-bold text-2xl border-2 transition-all',
                focus === 'd' && !d ? 'border-red-500 bg-red-500/10 text-red-400/50 animate-pulse' :
                focus === 'd' && d  ? 'border-red-400 bg-red-500/15 text-red-300' :
                d ? 'border-navy-600 bg-navy-900 text-white' : 'border-dashed border-navy-700 bg-navy-900/40 text-gray-600'
              )}>{d || '?'}</button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className={clsx('text-xs font-mono font-bold px-2.5 py-1 rounded-full',
              hand?.mode === 'pairs' ? 'bg-amber-500/20 text-amber-400' :
              hand?.mode === 'soft'  ? 'bg-blue-500/20 text-blue-400' :
              hand ? 'bg-navy-700 text-gray-300' : 'text-gray-600'
            )}>{hand ? hand.label : focus === 'c1' ? 'Tap a card ↓' : focus === 'c2' ? 'Tap 2nd card ↓' : 'Tap dealer card ↓'}</span>
            {(c1||c2||d) && <button onClick={reset} className="text-xs font-mono text-gray-600 hover:text-white">Clear</button>}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {CARD_VALS.map(v => (
              <button key={v} onClick={() => pick(v)}
                className={clsx('py-3 rounded-xl font-display font-bold text-xl transition-all active:scale-90 border-2',
                  focus === 'd' ? 'bg-red-950 text-red-200 border-red-900 hover:bg-red-900' : 'bg-navy-900 text-white border-navy-700 hover:border-navy-500 hover:bg-navy-700'
                )}>{v}</button>
            ))}
          </div>
        </div>
        {hand?.isBlackjack && (
          <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-500 text-center">
            <div className="font-display font-bold text-white text-2xl">🃏 BLACKJACK! 3:2</div>
          </div>
        )}
        {action && actionConfig && !hand?.isBlackjack && (
          <div className={clsx('mx-4 mb-4 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r', actionConfig.bg)}>
            <div className="flex-1">
              <div className="font-display font-bold text-white text-2xl">{actionConfig.label}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">{hand?.label} vs dealer {d}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-black/25 flex items-center justify-center">
              <span className="font-display font-bold text-white text-xl">{action}</span>
            </div>
          </div>
        )}
      </div>

      {/* Full chart collapsible */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        <button onClick={() => setShowChart(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
          <span className="font-display font-semibold text-white text-sm">Full Strategy Charts</span>
          {showChart ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>
        {showChart && (
          <div className="border-t border-navy-700 p-4 space-y-4 overflow-x-auto">
            {[['Hard Hands', BJ_HARD],['Soft Hands (Ace)', BJ_SOFT],['Pairs', BJ_PAIRS]].map(([title, table]) => (
              <div key={title as string}>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">{title as string}</p>
                <table className="text-xs font-mono w-full min-w-[300px]">
                  <thead><tr><th className="text-left py-1 pr-2 text-gray-500 text-[9px]">Hand</th>{DEALER_CARDS.map(c => <th key={c} className="px-0.5 py-1 text-gray-500 w-6 text-[9px]">{c}</th>)}</tr></thead>
                  <tbody>
                    {Object.entries(table as Record<string,Record<string,string>>).map(([hand, actions]) => (
                      <tr key={hand} className="border-t border-navy-700/30">
                        <td className="py-0.5 pr-2 text-gray-400 text-[10px] whitespace-nowrap">{hand}</td>
                        {DEALER_CARDS.map(c => { const a = (actions as Record<string,string>)[c]; return (
                          <td key={c} className="px-0.5 py-0.5 text-center">
                            <span className={clsx('rounded text-[9px] font-bold text-white inline-flex items-center justify-center w-5 h-5',
                              a==='H'?'bg-blue-600':a==='S'?'bg-slate-600':a?.startsWith('D')?'bg-green-600':a==='SP'?'bg-amber-500':a?.startsWith('R')?'bg-red-600':'bg-navy-700 text-gray-500'
                            )}>{a||'—'}</span>
                          </td>
                        );})}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {Object.entries(BJ_ACTIONS).map(([k,v]) => (
                <div key={k} className="flex items-center gap-1 text-[10px] font-mono">
                  <span className={clsx('w-5 h-5 rounded flex items-center justify-center text-white font-bold', v.bg.includes('blue') ? 'bg-blue-600' : v.bg.includes('slate') ? 'bg-slate-600' : v.bg.includes('green') ? 'bg-green-600' : v.bg.includes('emerald') ? 'bg-emerald-600' : v.bg.includes('amber') ? 'bg-amber-500' : 'bg-red-600')}>{k}</span>
                  <span className="text-gray-500">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table rules */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Table Rules</h3>
        {[
          [true, 'Blackjack pays 3:2', 'Standard'],
          [true, 'Dealer stands soft 17 (S17)', '-0.22% HE'],
          [true, 'Double after split (DAS)', '-0.14% HE'],
          [false,'Blackjack pays 6:5', '+1.39% HE'],
          [false,'Dealer hits soft 17 (H17)', '+0.22% HE'],
        ].map(([ok, rule, impact], i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-navy-700/30 last:border-0">
            <span className={clsx('text-xs font-mono font-bold w-4 shrink-0', ok ? 'text-green-edge' : 'text-red-400')}>{ok ? '✓' : '✗'}</span>
            <span className="text-xs font-mono text-gray-300 flex-1">{rule as string}</span>
            <span className={clsx('text-xs font-mono font-bold shrink-0', ok ? 'text-green-edge' : 'text-red-400')}>{impact as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BJ History ───────────────────────────────────────────────────────────────
function BjHistory({ hands, sessions, allSessions, onUpdateSessions, onUpdateHands }: {
  hands: BjHand[]; sessions: CasinoSession[]; allSessions: CasinoSession[];
  onUpdateSessions: (s: CasinoSession[]) => void; onUpdateHands: (h: BjHand[]) => void;
}) {
  const [showSessions, setShowSessions] = useState(false);
  const totalPnl = hands.reduce((a, h) => a + h.pnl, 0);
  const wins = hands.filter(h => h.outcome === 'win' || h.outcome === 'blackjack').length;
  const bj = hands.filter(h => h.outcome === 'blackjack').length;

  return (
    <div className="space-y-4">
      {hands.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 text-center col-span-2">
              <div className="text-xs text-gray-500 font-mono mb-0.5">ALL-TIME P&L</div>
              <div className={clsx('text-2xl font-display font-bold', totalPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
              </div>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500 font-mono mb-0.5">HANDS</div>
              <div className="text-lg font-display font-bold text-white">{hands.length}</div>
              <div className="text-[10px] text-gray-500 font-mono">{wins}W / {hands.length - wins}L</div>
            </div>
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-500 font-mono mb-0.5">WIN RATE</div>
              <div className="text-lg font-display font-bold text-white">{Math.round((wins / hands.length) * 100)}%</div>
              <div className="text-[10px] text-gray-500 font-mono">{bj} blackjacks</div>
            </div>
          </div>

          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">All Hands</p>
              <button onClick={() => { onUpdateHands([]); }} className="flex items-center gap-1 text-xs font-mono text-gray-600 hover:text-red-edge transition-colors">
                <Trash2 size={11} />Clear all
              </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {hands.map(h => (
                <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-navy-700/30 last:border-0">
                  <span className={clsx('text-xs font-mono font-bold w-20 shrink-0',
                    h.outcome === 'win' || h.outcome === 'blackjack' ? 'text-green-edge' :
                    h.outcome === 'push' ? 'text-gray-400' : 'text-red-edge'
                  )}>
                    {h.outcome === 'blackjack' ? 'BJ' : h.outcome.toUpperCase()}
                  </span>
                  <span className="flex-1 text-xs text-gray-500 font-mono truncate">${h.bet.toFixed(2)} · {h.desc || '—'}</span>
                  <span className={clsx('text-xs font-mono font-bold shrink-0', h.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                    {h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
          <Trophy size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 font-mono text-sm">No hands recorded yet</p>
          <p className="text-gray-600 font-mono text-xs mt-1">Go to the Play tab to start tracking</p>
        </div>
      )}

      <button onClick={() => setShowSessions(v => !v)} className="w-full flex items-center justify-between py-3 px-4 bg-navy-800 border border-navy-700 rounded-2xl">
        <span className="text-sm font-mono text-gray-400">Casino Sessions ({sessions.length})</span>
        {showSessions ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {showSessions && <SessionsList sessions={sessions} allSessions={allSessions} onUpdate={onUpdateSessions} />}
    </div>
  );
}

// ─── Shared: Session List ─────────────────────────────────────────────────────
function SessionsList({ sessions, allSessions, onUpdate }: {
  sessions: CasinoSession[]; allSessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function endSession(id: string, cashOut: number) {
    onUpdate(allSessions.map(s => s.id === id ? { ...s, endTime: Date.now(), cashOut } : s));
  }
  function deleteSession(id: string) { onUpdate(allSessions.filter(s => s.id !== id)); }

  if (!sessions.length) return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-10 text-center">
      <Clock size={32} className="text-gray-600 mx-auto mb-3" />
      <p className="text-gray-500 font-mono text-sm">No sessions recorded</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {[...sessions].sort((a, b) => b.startTime - a.startTime).map(s => {
        const pnl = s.cashOut - s.buyIn;
        const isActive = !s.endTime;
        const duration = isActive
          ? Math.floor((Date.now() - s.startTime) / 60000)
          : s.endTime ? Math.floor((s.endTime - s.startTime) / 60000) : 0;

        return (
          <div key={s.id} className={clsx('border rounded-2xl bg-navy-800',
            isActive ? 'border-amber-400/30' : pnl >= 0 ? 'border-green-edge/20' : 'border-navy-700'
          )}>
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{s.venue}</span>
                    {isActive && <span className="text-[10px] font-mono bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">
                    {new Date(s.startTime).toLocaleDateString('en-AU')} · {duration < 60 ? `${duration}m` : `${Math.floor(duration/60)}h ${duration%60}m`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500 font-mono">{formatCurrency(s.buyIn)} → {formatCurrency(s.cashOut)}</div>
                  <div className={clsx('text-base font-display font-bold', pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-xs font-mono text-gray-600 hover:text-white transition-colors flex items-center gap-1">
                  {expanded === s.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}Details
                </button>
                {isActive && <EndSessionButton session={s} onEnd={co => endSession(s.id, co)} />}
                <button onClick={() => deleteSession(s.id)} className="ml-auto text-gray-600 hover:text-red-edge transition-colors"><X size={13} /></button>
              </div>
            </div>
            {expanded === s.id && s.notes && (
              <div className="border-t border-navy-700/50 px-4 py-3">
                <p className="text-xs text-gray-400 font-mono">{s.notes}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EndSessionButton({ session, onEnd }: { session: CasinoSession; onEnd: (c: number) => void }) {
  const [open, setOpen] = useState(false);
  const [cashOut, setCashOut] = useState(String(session.buyIn));
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 bg-amber-400/20 text-amber-400 rounded-lg hover:bg-amber-400/30 transition-all">
      <CheckCircle size={11} />End
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 font-mono">Cash:</span>
      <input type="number" value={cashOut} onChange={e => setCashOut(e.target.value)}
        className="w-20 bg-navy-900 border border-navy-600 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none" />
      <button onClick={() => onEnd(parseFloat(cashOut) || 0)} className="text-xs font-mono px-2 py-1 bg-green-edge/20 text-green-edge rounded-lg">Save</button>
      <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white"><X size={11} /></button>
    </div>
  );
}

// ─── Shared: New Session ──────────────────────────────────────────────────────
const VENUES_NSW = ['Crown Sydney', 'The Star Sydney', 'Local Club', 'RSL Club', 'Leagues Club', 'Other'];
const VENUES_VIC = ['Crown Melbourne', 'The Star Melbourne', 'Local Club', 'Hotel', 'Other'];

function NewSession({ game, allSessions, onUpdate }: {
  game: GameType; allSessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void;
}) {
  const [state, setState] = useState<'NSW' | 'VIC'>('NSW');
  const [venue, setVenue] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [denomination, setDenomination] = useState('1');
  const [machineId, setMachineId] = useState('');
  const [notes, setNotes] = useState('');
  const venues = state === 'NSW' ? VENUES_NSW : VENUES_VIC;

  function start() {
    if (!buyIn || !venue) return;
    const session: CasinoSession = {
      id: Math.random().toString(36).slice(2), game, venue, state,
      startTime: Date.now(), buyIn: parseFloat(buyIn), cashOut: parseFloat(buyIn),
      notes, machineId: game === 'pokies' ? machineId || undefined : undefined,
      denomination: game === 'pokies' ? parseInt(denomination) : undefined,
    };
    onUpdate([...allSessions, session]);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex gap-2">
        {(['NSW', 'VIC'] as const).map(s => (
          <button key={s} onClick={() => setState(s)} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-mono border transition-all',
            state === s ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-400 border-navy-700 hover:text-white')}>
            {s}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Venue</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {venues.map(v => (
            <button key={v} onClick={() => setVenue(v)} className={clsx('text-xs font-mono px-2.5 py-1 rounded-lg border transition-all',
              venue === v ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>
              {v}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Or type venue..." value={venue} onChange={e => setVenue(e.target.value)}
          className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50" />
      </div>
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Buy-in ($)</label>
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-gray-500 shrink-0" />
          <input type="number" placeholder="100" value={buyIn} onChange={e => setBuyIn(e.target.value)}
            className="flex-1 bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50" />
        </div>
      </div>
      {game === 'pokies' && (
        <div>
          <label className="text-xs font-mono text-gray-400 block mb-1.5">Denomination (cents) — EdgeIQ recommends 1c</label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 5, 10, 20, 50].map(d => (
              <button key={d} onClick={() => setDenomination(String(d))} className={clsx('px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                denomination === String(d) ? d <= 2 ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-purple-400/20 text-purple-400 border-purple-400/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>
                {d}c{d <= 2 && ' ★'}
              </button>
            ))}
          </div>
        </div>
      )}
      {game === 'pokies' && (
        <div>
          <label className="text-xs font-mono text-gray-400 block mb-1.5">Machine (optional)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MACHINES.slice(0, 4).map(m => (
              <button key={m.name} onClick={() => setMachineId(m.name)} className={clsx('text-xs font-mono px-2.5 py-1 rounded-lg border transition-all',
                machineId === m.name ? 'bg-purple-400/20 text-purple-400 border-purple-400/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>
                {m.emoji} {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50 resize-none" />
      <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 font-mono">{state === 'VIC' ? 'VIC: $350/day pre-commitment limit.' : 'Gambling Help: 1800 858 858.'}</p>
      </div>
      <button onClick={start} disabled={!buyIn || !venue}
        className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim disabled:opacity-40 transition-all">
        Start Session
      </button>
    </div>
  );
}
