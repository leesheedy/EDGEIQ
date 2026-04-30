import React, { useState, useMemo } from 'react';
import {
  Dices, TrendingUp, TrendingDown, Clock, PlusCircle, X,
  ChevronDown, ChevronUp, BarChart3, Target, AlertTriangle, CheckCircle,
  Info, DollarSign, Zap, Star, ChevronRight,
} from 'lucide-react';
import { clsx, formatCurrency } from '../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type GameType = 'pokies' | 'roulette' | 'blackjack';
type BetOutcome = 'win' | 'loss' | 'push';

interface CasinoBet { id: string; amount: number; outcome: BetOutcome; details?: string; ts: number; }
interface CasinoSession {
  id: string; game: GameType; venue: string;
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';
  startTime: number; endTime?: number; buyIn: number; cashOut: number;
  bets: CasinoBet[]; notes: string; machineId?: string; denomination?: number;
}

// ─── Pokies machine data ──────────────────────────────────────────────────────
interface PokieMachine {
  name: string; maker: string; emoji: string; bg: string; accent: string;
  border: string; denom: string; maxBet: string; ways: string; rtp: string;
  edgeRating: number; // 1-5, higher = better player odds
  tip: string; bestPlay: string; feature: string; avoid?: string;
  tag?: string;
}

const MACHINES: PokieMachine[] = [
  {
    name: 'Bull Rush',
    maker: 'Aristocrat',
    emoji: '🐂',
    bg: 'from-red-950 via-red-900 to-amber-950',
    accent: 'text-amber-400',
    border: 'border-amber-600/40',
    denom: '1c',
    maxBet: '$10',
    ways: '243 Ways',
    rtp: '~87–92%',
    edgeRating: 5,
    tag: '⭐ EdgeIQ Pick',
    tip: '1c denomination + $10 max bet is the known sweet spot. At this combo you activate all 243 ways AND are eligible for the full bonus multipliers. High feature frequency in NSW/VIC clubs. Bull Rush free spins can pay 50–200x bet.',
    bestPlay: '1c denom · MAX BET $10 · all 243 ways active',
    feature: 'Bull Rush Free Spins + Rolling Reels',
    avoid: 'Never play fewer than max lines — bonus is unavailable',
  },
  {
    name: 'Dragon Train',
    maker: 'Aristocrat',
    emoji: '🐉',
    bg: 'from-red-900 via-orange-900 to-yellow-950',
    accent: 'text-yellow-400',
    border: 'border-yellow-600/30',
    denom: '1c–2c',
    maxBet: '$7.50–$10',
    ways: '243 Ways',
    rtp: '~88–91%',
    edgeRating: 4,
    tip: 'Linked progressive jackpot — note that jackpot contribution lowers base RTP slightly. 1c denom preferred. Feature triggers with 3+ scatter train symbols paying stacked wilds across reels.',
    bestPlay: '1c denom · max bet · progressive eligible',
    feature: 'Dragon Train Free Spins + Linked Jackpot',
    avoid: 'Progressive jackpot reduces base RTP — only play if jackpot is large',
  },
  {
    name: 'Lightning Link',
    maker: 'Aristocrat',
    emoji: '⚡',
    bg: 'from-yellow-950 via-amber-900 to-orange-950',
    accent: 'text-yellow-300',
    border: 'border-yellow-500/30',
    denom: '1c',
    maxBet: '$7.50',
    ways: '243 Ways',
    rtp: '~88–90%',
    edgeRating: 4,
    tag: 'Popular',
    tip: 'Linked jackpot series — 4 jackpot tiers (Mini/Minor/Major/Grand). Hold & Spin bonus is the main feature: collect lightning bolt symbols to fill all 15 positions for Grand jackpot. Best value comes from hitting the Major/Grand.',
    bestPlay: '1c denom · max bet $7.50 · jackpot eligible',
    feature: 'Hold & Spin + 4-tier Linked Jackpot',
  },
  {
    name: '5 Dragons',
    maker: 'Aristocrat',
    emoji: '🐲',
    bg: 'from-red-950 via-rose-900 to-red-950',
    accent: 'text-red-400',
    border: 'border-red-500/30',
    denom: '1c–5c',
    maxBet: '$1.25–$2.50',
    ways: '243 Ways',
    rtp: '~88–92%',
    edgeRating: 3,
    tip: 'Classic low-volatility machine. Good for longer sessions on smaller budgets. 1c denom keeps cost low. Free spins multiplier goes up to 3x. Consistent small wins with occasional feature payouts.',
    bestPlay: '1c denom · lower max bet = good session longevity',
    feature: '15 Free Games with up to 3x multiplier',
  },
  {
    name: 'Mustang Money',
    maker: 'Ainsworth',
    emoji: '🐎',
    bg: 'from-sky-950 via-blue-900 to-indigo-950',
    accent: 'text-sky-400',
    border: 'border-sky-500/30',
    denom: '1c–5c',
    maxBet: '$5',
    ways: '243 Ways',
    rtp: '~87–91%',
    edgeRating: 3,
    tag: 'Ainsworth',
    tip: 'Ainsworth machines are known for higher volatility than Aristocrat. Mustang Money has a strong free spins bonus — the Mustang Wild on reel 3 is key. Budget: allow $100–200 to trigger the feature.',
    bestPlay: '1c denom · max bet $5 · watch for Mustang Wild',
    feature: 'Free Spins + Expanding Wild on Reel 3',
  },
  {
    name: 'Zorro',
    maker: 'Aristocrat',
    emoji: '🗡️',
    bg: 'from-slate-900 via-gray-900 to-slate-950',
    accent: 'text-gray-300',
    border: 'border-gray-500/30',
    denom: '5c',
    maxBet: '$2',
    ways: '9 Lines',
    rtp: '~87–89%',
    edgeRating: 2,
    tip: 'Older classic machine — lower RTP than modern 243-ways titles. 5c denom, 9 fixed lines. Still found in many clubs. Good for nostalgia but modern machines offer better player returns.',
    bestPlay: '5c · max lines (9) · lower budget machine',
    feature: 'Zorro Bonus + Free Spins',
  },
  {
    name: 'Thunder Cash',
    maker: 'Konami',
    emoji: '💥',
    bg: 'from-blue-950 via-indigo-900 to-purple-950',
    accent: 'text-blue-400',
    border: 'border-blue-500/30',
    denom: '1c',
    maxBet: '$5–$7.50',
    ways: '243 Ways',
    rtp: '~88–91%',
    edgeRating: 4,
    tip: 'Konami\'s flagship in AU clubs. Xtra Reward Free Spins bonus is high-value — 8 free spins with all thunder symbols becoming stacked wilds. 1c denom max bet activates all ways. Good hit frequency on the bonus.',
    bestPlay: '1c denom · max bet · wait for Xtra Reward feature',
    feature: 'Xtra Reward Free Spins + Stacked Wilds',
  },
  {
    name: 'Wonder 4 Jackpots',
    maker: 'Aristocrat',
    emoji: '🌟',
    bg: 'from-purple-950 via-violet-900 to-indigo-950',
    accent: 'text-purple-400',
    border: 'border-purple-500/30',
    denom: '1c',
    maxBet: '$10',
    ways: '4 × 243 Ways',
    rtp: '~87–90%',
    edgeRating: 4,
    tag: 'Jackpot',
    tip: '4-in-1 machine combining Buffalo, 5 Dragons, Indian Dreaming & More Chilli. Play all 4 games simultaneously. The Super Free Games feature can play across all 4 screens. Grand Jackpot requires max bet on all 4.',
    bestPlay: '1c denom · max bet $10 · all 4 screens active',
    feature: 'Super Free Games across 4 screens + Grand Jackpot',
    avoid: 'Max bet required for Grand Jackpot eligibility',
  },
];

// ─── Game configs ─────────────────────────────────────────────────────────────
const GAME_CONFIGS = {
  pokies:    { label: 'Pokies',    emoji: '🎰', houseEdge: { min: 10, max: 15, typical: 12 }, rtpRange: '85–90%', color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-purple-400/30' },
  roulette:  { label: 'Roulette', emoji: '🎡', houseEdge: { min: 2.7, max: 5.26, typical: 2.7 }, rtpRange: '94.74–97.3%', color: 'text-red-400', bgColor: 'bg-red-400/10', borderColor: 'border-red-400/30' },
  blackjack: { label: 'Blackjack', emoji: '🃏', houseEdge: { min: 0.5, max: 2, typical: 0.5 }, rtpRange: '98–99.5%', color: 'text-green-edge', bgColor: 'bg-green-edge/10', borderColor: 'border-green-edge/30' },
};

// ─── Blackjack strategy ───────────────────────────────────────────────────────
const BJ_HARD: Record<string, Record<string, string>> = {
  '8-9':  { '2':'H','3':'H','4':'H','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H' },
  '10':   { '2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'H','A':'H' },
  '11':   { '2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'Dh','A':'H' },
  '12':   { '2':'H','3':'H','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'H','A':'H' },
  '13-14':{ '2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'H','A':'H' },
  '15':   { '2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'H','10':'Rh','A':'H' },
  '16':   { '2':'S','3':'S','4':'S','5':'S','6':'S','7':'H','8':'H','9':'Rh','10':'Rh','A':'Rh' },
  '17+':  { '2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S' },
};
const BJ_SOFT: Record<string, Record<string, string>> = {
  'A,2-3': { '2':'H','3':'H','4':'H','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H' },
  'A,4-5': { '2':'H','3':'H','4':'Dh','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H' },
  'A,6':   { '2':'H','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'H','8':'H','9':'H','10':'H','A':'H' },
  'A,7':   { '2':'Ds','3':'Ds','4':'Ds','5':'Ds','6':'Ds','7':'S','8':'S','9':'H','10':'H','A':'H' },
  'A,8-9': { '2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S' },
};
const BJ_PAIRS: Record<string, Record<string, string>> = {
  'A,A':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'SP','9':'SP','10':'SP','A':'SP' },
  '10,10':{ '2':'S','3':'S','4':'S','5':'S','6':'S','7':'S','8':'S','9':'S','10':'S','A':'S' },
  '9,9':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'S','8':'SP','9':'SP','10':'S','A':'S' },
  '8,8':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'SP','9':'SP','10':'SP','A':'SP' },
  '7,7':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H' },
  '6,6':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'H','8':'H','9':'H','10':'H','A':'H' },
  '5,5':  { '2':'Dh','3':'Dh','4':'Dh','5':'Dh','6':'Dh','7':'Dh','8':'Dh','9':'Dh','10':'H','A':'H' },
  '4,4':  { '2':'H','3':'H','4':'H','5':'SP','6':'SP','7':'H','8':'H','9':'H','10':'H','A':'H' },
  '3,3':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H' },
  '2,2':  { '2':'SP','3':'SP','4':'SP','5':'SP','6':'SP','7':'SP','8':'H','9':'H','10':'H','A':'H' },
};
const BJ_ACTIONS: Record<string, { label: string; color: string }> = {
  H:  { label: 'Hit',          color: 'bg-blue-500' },
  S:  { label: 'Stand',        color: 'bg-slate-600' },
  Dh: { label: 'Double/Hit',   color: 'bg-green-600' },
  Ds: { label: 'Double/Stand', color: 'bg-emerald-600' },
  Rh: { label: 'Surrender/Hit',color: 'bg-red-600' },
  SP: { label: 'Split',        color: 'bg-amber-500' },
};
const DEALER_CARDS = ['2','3','4','5','6','7','8','9','10','A'];

const NSW_VIC_REGS = {
  NSW: { maxBet: 10, spinInterval: 3, dailyLimit: null, selfExclusion: 'BetSafeNSW', note: 'NSW: $10 max bet per spin, 3s min spin interval on Class B/C machines. 500 max machines per club.' },
  VIC: { maxBet: 5, spinInterval: 3, dailyLimit: 350, selfExclusion: "Gambler's Help", note: 'VIC: $5 max bet, $350/day pre-commitment limit, 3s min spin interval. Pre-commitment mandatory.' },
};
const VENUES_NSW = ['Crown Sydney', 'The Star Sydney', 'Local Club', 'RSL Club', 'Leagues Club', 'Other'];
const VENUES_VIC = ['Crown Melbourne', 'The Star Melbourne', 'Local Club', 'Hotel', 'Other'];
const STORAGE_KEY = 'edgeiq-casino-sessions';

function loadSessions(): CasinoSession[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveSessions(s: CasinoSession[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
type Tab = 'sessions' | 'new' | 'stats' | 'strategy';

export function Casino() {
  const [tab, setTab] = useState<Tab>('strategy');
  const [sessions, setSessions] = useState<CasinoSession[]>(loadSessions);

  function updateSessions(s: CasinoSession[]) { setSessions(s); saveSessions(s); }

  const totalPnl = sessions.reduce((acc, s) => acc + (s.cashOut - s.buyIn), 0);
  const activeSessions = sessions.filter(s => !s.endTime);

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'strategy', label: 'Guide', icon: <Target size={14} /> },
    { id: 'new', label: activeSessions.length ? `Active (${activeSessions.length})` : 'New', icon: <PlusCircle size={14} /> },
    { id: 'sessions', label: 'Sessions', icon: <Clock size={14} /> },
    { id: 'stats', label: 'Stats', icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Dices size={22} className="text-purple-400" />
            <h1 className="font-display font-bold text-2xl text-white">Casino</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Best odds · machine guide · strategy</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 font-mono">P&L</div>
          <div className={clsx('font-display font-bold text-lg', totalPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-navy-800 border border-navy-700 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-mono transition-all',
              tab === t.id ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white')}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'strategy' && <StrategyGuide />}
      {tab === 'new' && <NewSession sessions={sessions} onUpdate={s => { updateSessions(s); setTab('sessions'); }} />}
      {tab === 'sessions' && <SessionsList sessions={sessions} onUpdate={updateSessions} />}
      {tab === 'stats' && <CasinoStats sessions={sessions} />}
    </div>
  );
}

// ─── Strategy Guide ───────────────────────────────────────────────────────────
function StrategyGuide() {
  const [game, setGame] = useState<GameType>('pokies');
  const [selectedMachine, setSelectedMachine] = useState<PokieMachine | null>(null);

  return (
    <div className="space-y-4">
      {/* Game selector */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(GAME_CONFIGS) as Array<[GameType, typeof GAME_CONFIGS.pokies]>).map(([key, cfg]) => (
          <button key={key} onClick={() => setGame(key)}
            className={clsx('p-3 rounded-2xl border text-center transition-all',
              game === key ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}` : 'bg-navy-800 border-navy-700 text-gray-400 hover:text-white')}>
            <div className="text-xl mb-0.5">{cfg.emoji}</div>
            <div className="text-xs font-display font-semibold">{cfg.label}</div>
            <div className="text-[10px] font-mono opacity-60 mt-0.5">HE: {cfg.houseEdge.typical}%</div>
          </button>
        ))}
      </div>

      {/* House edge banner */}
      <HouseEdgeBanner game={game} />

      {game === 'pokies' && <PokiesGuide selected={selectedMachine} onSelect={setSelectedMachine} />}
      {game === 'roulette' && <RouletteGuide />}
      {game === 'blackjack' && <BlackjackGuide />}
    </div>
  );
}

function HouseEdgeBanner({ game }: { game: GameType }) {
  const rankings = [
    { g: 'blackjack', label: 'Blackjack', he: '0.5%', rtp: '99.5%', badge: 'BEST ODDS', color: 'text-green-edge', bg: 'bg-green-edge/10', border: 'border-green-edge/30' },
    { g: 'roulette',  label: 'Roulette (EU)', he: '2.7%', rtp: '97.3%', badge: 'GOOD', color: 'text-amber-edge', bg: 'bg-amber-edge/10', border: 'border-amber-edge/30' },
    { g: 'pokies',    label: 'Pokies', he: '10–15%', rtp: '85–90%', badge: 'WORST ODDS', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
  ];
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Best odds ranking</p>
      <div className="flex flex-col gap-2">
        {rankings.map((r, i) => (
          <div key={r.g} className={clsx('flex items-center gap-3 p-2.5 rounded-xl border transition-all',
            r.g === game ? `${r.bg} ${r.border}` : 'bg-navy-900/50 border-transparent')}>
            <span className="text-lg w-5 text-center font-bold text-gray-600">{i + 1}</span>
            <div className="flex-1">
              <span className={clsx('text-sm font-medium', r.g === game ? r.color : 'text-gray-400')}>{r.label}</span>
              <span className="text-xs font-mono text-gray-600 ml-2">HE: {r.he} · RTP: {r.rtp}</span>
            </div>
            <span className={clsx('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full', r.bg, r.color, r.border, 'border')}>
              {r.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pokies Guide ─────────────────────────────────────────────────────────────
function PokiesGuide({ selected, onSelect }: { selected: PokieMachine | null; onSelect: (m: PokieMachine | null) => void }) {
  return (
    <div className="space-y-4">
      {/* EdgeIQ tips header */}
      <div className="bg-navy-800 border border-purple-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-purple-400" />
          <h3 className="font-display font-semibold text-white text-sm">EdgeIQ Pokies Rules</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {[
            { tip: 'Always play MAX BET', why: 'Required for bonus eligibility and jackpot', color: 'text-green-edge' },
            { tip: '1c denomination = best RTP', why: 'More ways/lines active per dollar than higher denoms', color: 'text-green-edge' },
            { tip: '243 Ways > Fixed Lines', why: 'More ways to win per spin — better hit frequency', color: 'text-green-edge' },
            { tip: 'Avoid linked progressives when jackpot is small', why: 'Jackpot contribution lowers base RTP', color: 'text-amber-edge' },
            { tip: 'No hot/cold machine myth', why: 'Every spin is independent — RNG certified', color: 'text-gray-400' },
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2 py-2 border-b border-navy-700/40 last:border-0">
              <ChevronRight size={12} className={clsx('mt-0.5 shrink-0', r.color)} />
              <div>
                <span className={clsx('text-xs font-mono font-semibold', r.color)}>{r.tip}</span>
                <span className="text-xs text-gray-600 font-mono"> — {r.why}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Machine grid */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Popular AU Machines — Tap for full guide</p>
        <div className="grid grid-cols-2 gap-3">
          {MACHINES.map(m => (
            <MachineCard key={m.name} machine={m} onSelect={() => onSelect(selected?.name === m.name ? null : m)} selected={selected?.name === m.name} />
          ))}
        </div>
      </div>

      {/* Machine detail panel */}
      {selected && <MachineDetail machine={selected} onClose={() => onSelect(null)} />}

      {/* Denomination guide */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">NSW Denomination Guide</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-navy-700">
                <th className="text-left pb-2">Denom</th>
                <th className="text-right pb-2">Max Bet</th>
                <th className="text-right pb-2">Cost/hr</th>
                <th className="text-right pb-2">EdgeIQ</th>
              </tr>
            </thead>
            <tbody>
              {[
                { d: '1c', max: '$10', cph: '~$200', rating: '✓ Best', color: 'text-green-edge' },
                { d: '2c', max: '$10', cph: '~$200', rating: '✓ Good', color: 'text-green-edge' },
                { d: '5c', max: '$10', cph: '~$200', rating: '~ OK', color: 'text-amber-edge' },
                { d: '10c', max: '$10', cph: '~$200', rating: '✗ Avoid', color: 'text-red-400' },
                { d: '20c+', max: '$10', cph: '~$200', rating: '✗ Avoid', color: 'text-red-400' },
              ].map(r => (
                <tr key={r.d} className="border-b border-navy-700/30 last:border-0">
                  <td className="py-2 text-gray-300">{r.d}</td>
                  <td className="py-2 text-right text-gray-400">{r.max}</td>
                  <td className="py-2 text-right text-gray-500">{r.cph}</td>
                  <td className={clsx('py-2 text-right font-semibold', r.color)}>{r.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-600 font-mono mt-2">At NSW max $10/spin, 3s min interval = ~1200 spins/hr = $12,000 wagered. At 90% RTP = ~$1,200/hr theoretical loss.</p>
      </div>
    </div>
  );
}

function MachineCard({ machine: m, onSelect, selected }: { machine: PokieMachine; onSelect: () => void; selected: boolean }) {
  return (
    <button onClick={onSelect} className={clsx('rounded-2xl overflow-hidden border text-left transition-all', m.border, selected ? 'ring-2 ring-green-edge/60' : 'hover:ring-1 hover:ring-white/20')}>
      {/* Machine screen */}
      <div className={clsx('bg-gradient-to-b p-4 flex flex-col items-center justify-center gap-1', m.bg)} style={{ minHeight: 100 }}>
        {m.tag && (
          <span className={clsx('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/40', m.accent)}>
            {m.tag}
          </span>
        )}
        <div className="text-4xl leading-none">{m.emoji}</div>
        <div className={clsx('text-xs font-display font-bold text-center leading-tight', m.accent)}>{m.name}</div>
        <div className="text-[10px] font-mono text-white/50">{m.maker}</div>
        {/* EdgeIQ rating */}
        <div className="flex gap-0.5 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={8} className={i < m.edgeRating ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
          ))}
        </div>
      </div>
      {/* Quick stats */}
      <div className="bg-navy-900 px-3 py-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span className="text-[10px] text-gray-600 font-mono">Denom</span>
        <span className={clsx('text-[10px] font-mono font-semibold text-right', m.accent)}>{m.denom}</span>
        <span className="text-[10px] text-gray-600 font-mono">Best Bet</span>
        <span className={clsx('text-[10px] font-mono font-semibold text-right', m.accent)}>{m.maxBet}</span>
        <span className="text-[10px] text-gray-600 font-mono">Ways</span>
        <span className="text-[10px] font-mono text-gray-400 text-right">{m.ways}</span>
      </div>
    </button>
  );
}

function MachineDetail({ machine: m, onClose }: { machine: PokieMachine; onClose: () => void }) {
  return (
    <div className={clsx('border rounded-2xl overflow-hidden animate-slide-up', m.border)}>
      <div className={clsx('bg-gradient-to-r p-4 flex items-center gap-3', m.bg)}>
        <span className="text-4xl">{m.emoji}</span>
        <div>
          <h3 className={clsx('font-display font-bold text-lg', m.accent)}>{m.name}</h3>
          <p className="text-xs text-white/60 font-mono">{m.maker} · {m.ways} · {m.rtp} RTP</p>
        </div>
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg bg-black/20 text-white/60 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="bg-navy-800 p-4 space-y-4">
        {/* EdgeIQ verdict */}
        <div className="bg-green-edge/5 border border-green-edge/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-green-edge" />
            <span className="text-xs font-mono font-bold text-green-edge uppercase tracking-wider">EdgeIQ Best Play</span>
          </div>
          <p className={clsx('text-sm font-display font-bold mb-2', m.accent)}>{m.bestPlay}</p>
          <p className="text-xs text-gray-300 font-mono leading-relaxed">{m.tip}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Denomination', value: m.denom },
            { label: 'Best Bet', value: m.maxBet },
            { label: 'Ways/Lines', value: m.ways },
            { label: 'Est. RTP', value: m.rtp },
            { label: 'Edge Rating', value: '★'.repeat(m.edgeRating) + '☆'.repeat(5 - m.edgeRating) },
            { label: 'Maker', value: m.maker },
          ].map(s => (
            <div key={s.label} className="bg-navy-900 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-gray-500 font-mono mb-1">{s.label}</div>
              <div className={clsx('text-xs font-mono font-semibold', m.accent)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Feature */}
        <div className="flex items-start gap-2 p-3 bg-navy-900 rounded-xl">
          <Zap size={12} className="text-purple-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Key Feature</p>
            <p className="text-xs text-white font-mono mt-0.5">{m.feature}</p>
          </div>
        </div>

        {/* Avoid tip */}
        {m.avoid && (
          <div className="flex items-start gap-2 p-3 bg-red-edge/5 border border-red-edge/20 rounded-xl">
            <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400 font-mono">{m.avoid}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Roulette Guide ───────────────────────────────────────────────────────────
function RouletteGuide() {
  const bets = [
    { bet: 'Single number', payout: '35:1', he: '2.70%', prob: '2.7%', ev: '-2.70%', tier: 'same' },
    { bet: 'Split (2 numbers)', payout: '17:1', he: '2.70%', prob: '5.4%', ev: '-2.70%', tier: 'same' },
    { bet: 'Street (3 numbers)', payout: '11:1', he: '2.70%', prob: '8.1%', ev: '-2.70%', tier: 'same' },
    { bet: 'Corner (4 numbers)', payout: '8:1', he: '2.70%', prob: '10.8%', ev: '-2.70%', tier: 'same' },
    { bet: 'Six line (6 numbers)', payout: '5:1', he: '2.70%', prob: '16.2%', ev: '-2.70%', tier: 'same' },
    { bet: 'Dozen / Column', payout: '2:1', he: '2.70%', prob: '32.4%', ev: '-2.70%', tier: 'same' },
    { bet: 'Red / Black ★', payout: '1:1', he: '2.70%', prob: '48.6%', ev: '-2.70%', tier: 'best' },
    { bet: 'Even / Odd ★', payout: '1:1', he: '2.70%', prob: '48.6%', ev: '-2.70%', tier: 'best' },
    { bet: 'High / Low ★', payout: '1:1', he: '2.70%', prob: '48.6%', ev: '-2.70%', tier: 'best' },
    { bet: 'EU + La Partage ★★', payout: '1:1 (half back on 0)', he: '1.35%', prob: '48.6%', ev: '-1.35%', tier: 'top' },
  ];

  return (
    <div className="space-y-4">
      {/* Top tip */}
      <div className="bg-amber-edge/5 border border-amber-edge/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-amber-edge" />
          <h3 className="font-display font-semibold text-white text-sm">EdgeIQ Roulette Rules</h3>
        </div>
        <div className="space-y-2">
          {[
            { rule: 'European (single 0) over American (double 00)', why: '2.7% HE vs 5.26% — almost half', ok: true },
            { rule: 'Ask for La Partage rule', why: 'Returns half stake on evens bets when 0 hits — HE drops to 1.35%', ok: true },
            { rule: 'Outside bets (Red/Black, Even/Odd)', why: 'Best for session longevity — ~49% win rate', ok: true },
            { rule: "Betting systems (Martingale etc.) don't change EV", why: 'The house edge is fixed regardless of system', ok: false },
            { rule: 'Never play American roulette', why: 'The extra 00 nearly doubles the house edge', ok: false },
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 border-b border-navy-700/30 last:border-0">
              <span className={clsx('text-xs font-mono font-bold mt-0.5 shrink-0', r.ok ? 'text-green-edge' : 'text-red-400')}>{r.ok ? '✓' : '✗'}</span>
              <div>
                <span className="text-xs font-mono text-gray-300">{r.rule}</span>
                <span className="text-xs text-gray-600 font-mono"> — {r.why}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet table */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">All Bets — European Roulette</h3>
        <div className="space-y-1">
          {bets.map((row, i) => (
            <div key={i} className={clsx(
              'flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-mono transition-all',
              row.tier === 'top' ? 'bg-green-edge/10 border border-green-edge/20'
              : row.tier === 'best' ? 'bg-amber-edge/5 border border-amber-edge/10'
              : 'bg-navy-900/50'
            )}>
              <span className={clsx('flex-1 font-medium',
                row.tier === 'top' ? 'text-green-edge'
                : row.tier === 'best' ? 'text-amber-edge'
                : 'text-gray-400'
              )}>{row.bet}</span>
              <span className="text-gray-300 w-12 text-right">{row.payout}</span>
              <span className="text-gray-500 w-10 text-right">{row.prob}</span>
              <span className={clsx('w-14 text-right font-bold',
                row.he === '1.35%' ? 'text-green-edge' : 'text-red-400/70'
              )}>HE {row.he}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 font-mono mt-3">★ Best even-money bets for longevity · ★★ Best bet in the casino if La Partage available</p>
      </div>

      {/* Betting systems */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Betting Systems — Reality Check</h3>
        <div className="space-y-3">
          {[
            { name: 'Martingale', desc: 'Double bet after each loss', verdict: 'Dangerous — table limits cause ruin', risk: 'high' },
            { name: "D'Alembert", desc: 'Increase by 1 unit after loss, decrease by 1 after win', verdict: 'Safer than Martingale, but still negative EV', risk: 'med' },
            { name: 'Fibonacci', desc: 'Follow Fibonacci sequence on losses', verdict: 'Moderate risk, no edge improvement', risk: 'med' },
            { name: 'Flat betting', desc: 'Same bet every spin', verdict: 'Best for minimising losses long-term', risk: 'low' },
          ].map(s => (
            <div key={s.name} className="flex items-start gap-3 py-2 border-b border-navy-700/30 last:border-0">
              <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0',
                s.risk === 'high' ? 'bg-red-400' : s.risk === 'med' ? 'bg-amber-edge' : 'bg-green-edge'
              )} />
              <div>
                <span className="text-xs font-mono font-semibold text-white">{s.name}</span>
                <span className="text-xs text-gray-500 font-mono ml-2">{s.desc}</span>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{s.verdict}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Blackjack Guide ──────────────────────────────────────────────────────────
const CARD_VALS = ['A','2','3','4','5','6','7','8','9','10'] as const;
type CardVal = typeof CARD_VALS[number];

function getHandInfo(c1: CardVal | null, c2: CardVal | null): {
  mode: 'hard' | 'soft' | 'pairs'; key: string; label: string; isBlackjack?: boolean;
} | null {
  if (!c1 || !c2) return null;
  if (c1 === c2) return { mode: 'pairs', key: `${c1},${c1}`, label: `Pair of ${c1}s` };
  if (c1 === 'A' || c2 === 'A') {
    const other = c1 === 'A' ? c2 : c1;
    if (other === '10') return { mode: 'hard', key: '17+', label: 'Blackjack! 21', isBlackjack: true };
    const v = parseInt(other);
    const total = 11 + v;
    const key = v <= 3 ? 'A,2-3' : v <= 5 ? 'A,4-5' : v === 6 ? 'A,6' : v === 7 ? 'A,7' : 'A,8-9';
    return { mode: 'soft', key, label: `Soft ${total}` };
  }
  const v1 = c1 === '10' ? 10 : parseInt(c1);
  const v2 = c2 === '10' ? 10 : parseInt(c2);
  const total = v1 + v2;
  const key = total <= 9 ? '8-9' : total === 10 ? '10' : total === 11 ? '11' : total === 12 ? '12' : total <= 14 ? '13-14' : total === 15 ? '15' : total === 16 ? '16' : '17+';
  return { mode: 'hard', key, label: `Hard ${total}` };
}

function BjChart({ table }: { table: Record<string, Record<string, string>> }) {
  return (
    <table className="text-xs font-mono w-full min-w-[320px]">
      <thead>
        <tr>
          <th className="text-left py-1 pr-2 text-gray-500 text-[10px]">Hand</th>
          {DEALER_CARDS.map(c => <th key={c} className="px-0.5 py-1 text-gray-500 w-7 text-[10px]">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {Object.entries(table).map(([hand, actions]) => (
          <tr key={hand} className="border-t border-navy-700/30">
            <td className="py-1 pr-2 text-gray-400 whitespace-nowrap text-[10px]">{hand}</td>
            {DEALER_CARDS.map(c => {
              const a = actions[c];
              return (
                <td key={c} className="px-0.5 py-0.5 text-center">
                  <span className={clsx('rounded text-[9px] font-bold text-white inline-flex items-center justify-center w-5 h-5',
                    a === 'H' ? 'bg-blue-600' : a === 'S' ? 'bg-slate-600' :
                    a?.startsWith('D') ? 'bg-green-600' : a === 'SP' ? 'bg-amber-500' :
                    a?.startsWith('R') ? 'bg-red-600' : 'bg-navy-700 text-gray-500'
                  )}>{a || '—'}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlackjackGuide() {
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
  const actionBg =
    action === 'H' ? 'from-blue-600 to-blue-700' :
    action === 'S' ? 'from-slate-600 to-slate-700' :
    action?.startsWith('D') ? 'from-green-600 to-emerald-700' :
    action === 'SP' ? 'from-amber-500 to-orange-600' :
    'from-red-600 to-red-700';

  const cardSlot = (val: CardVal | null, active: boolean, label: string, isDealer?: boolean) => (
    <button
      onClick={() => { setFocus(isDealer ? 'd' : label === '1st' ? 'c1' : 'c2'); }}
      className={clsx(
        'flex-1 rounded-xl font-display font-bold text-2xl border-2 transition-all flex items-center justify-center',
        'h-14',
        active && !val
          ? isDealer
            ? 'border-red-500 bg-red-500/10 text-red-400 animate-pulse'
            : 'border-green-edge bg-green-edge/10 text-green-edge animate-pulse'
          : active && val
          ? isDealer
            ? 'border-red-400 bg-red-500/15 text-red-200'
            : 'border-green-edge bg-green-edge/15 text-green-edge'
          : val
          ? 'border-navy-600 bg-navy-800 text-white'
          : 'border-dashed border-navy-700 bg-navy-900/50 text-gray-600'
      )}
    >
      {val || '?'}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Condensed key rules */}
      <div className="bg-green-edge/5 border border-green-edge/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={13} className="text-green-edge" />
          <span className="font-display font-semibold text-white text-sm">Key Rules</span>
        </div>
        <div className="grid grid-cols-1 gap-0.5">
          {[
            [true,  'Always split Aces + 8s'],
            [true,  'Double on 10/11 vs dealer 2–9'],
            [false, 'Never take insurance (8% HE)'],
            [false, 'Never split 10s — you have 20'],
            [true,  'S17 table = 0.2% less house edge'],
          ].map(([ok, rule], i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className={clsx('text-xs font-mono font-bold shrink-0', ok ? 'text-green-edge' : 'text-red-400')}>{ok ? '✓' : '✗'}</span>
              <span className="text-xs font-mono text-gray-300">{rule as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive card lookup */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        {/* Card slots */}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10px] font-mono text-gray-500 shrink-0">Your hand</span>
              {cardSlot(c1, focus === 'c1', '1st')}
              {cardSlot(c2, focus === 'c2', '2nd')}
            </div>
            <span className="text-xs text-gray-600 font-mono shrink-0 px-1">vs</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-gray-500 shrink-0">Dealer</span>
              {cardSlot(d, focus === 'd', 'dealer', true)}
            </div>
          </div>

          {/* Hand label row */}
          <div className="flex items-center justify-between mb-3 min-h-[22px]">
            <span className={clsx('text-xs font-mono font-bold px-2.5 py-1 rounded-full',
              hand?.mode === 'pairs' ? 'bg-amber-500/20 text-amber-400' :
              hand?.mode === 'soft' ? 'bg-blue-500/20 text-blue-400' :
              hand ? 'bg-navy-700 text-gray-300' : 'text-gray-600'
            )}>
              {hand ? hand.label : (
                focus === 'c1' ? 'Tap a card below →'
                : focus === 'c2' ? 'Tap your 2nd card →'
                : 'Tap dealer\'s upcard →'
              )}
            </span>
            {(c1 || c2 || d) && (
              <button onClick={reset} className="text-xs font-mono text-gray-600 hover:text-white transition-colors px-2">
                Clear
              </button>
            )}
          </div>

          {/* Card keyboard */}
          <div className="grid grid-cols-5 gap-2">
            {CARD_VALS.map(v => (
              <button
                key={v}
                onClick={() => pick(v)}
                className={clsx(
                  'h-12 rounded-xl font-display font-bold text-xl transition-all active:scale-90 border-2',
                  focus === 'd'
                    ? 'bg-red-950 text-red-200 border-red-900 hover:bg-red-900 hover:border-red-700'
                    : 'bg-navy-900 text-white border-navy-700 hover:border-navy-500 hover:bg-navy-700'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Action result */}
        {hand?.isBlackjack && (
          <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-500 text-center">
            <div className="text-3xl mb-1">🃏</div>
            <div className="font-display font-bold text-white text-2xl">BLACKJACK!</div>
            <div className="text-white/80 text-xs font-mono mt-1">3:2 payout · never take even money insurance</div>
          </div>
        )}
        {action && actionConfig && !hand?.isBlackjack && (
          <div className={clsx('mx-4 mb-4 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r', actionBg)}>
            <div className="flex-1">
              <div className="font-display font-bold text-white text-3xl leading-tight">{actionConfig.label}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">
                {hand?.label} vs dealer {d}
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-black/25 flex items-center justify-center shrink-0">
              <span className="font-display font-bold text-white text-2xl">{action}</span>
            </div>
          </div>
        )}
      </div>

      {/* Full chart — collapsible */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowChart(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="font-display font-semibold text-white text-sm">Full Strategy Charts</span>
          {showChart ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>
        {showChart && (
          <div className="border-t border-navy-700 p-4 space-y-4 overflow-x-auto">
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Hard Hands</p>
              <BjChart table={BJ_HARD} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Soft Hands (Ace)</p>
              <BjChart table={BJ_SOFT} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Pairs</p>
              <BjChart table={BJ_PAIRS} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(BJ_ACTIONS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1 text-[10px] font-mono">
                  <span className={clsx('w-5 h-5 rounded flex items-center justify-center text-white font-bold', v.color)}>{k}</span>
                  <span className="text-gray-500">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table rules */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Table Rules — What to Look For</h3>
        <div className="space-y-1.5">
          {[
            { rule: 'Blackjack pays 3:2', good: true, impact: 'Standard' },
            { rule: 'Dealer stands soft 17 (S17)', good: true, impact: '-0.22% HE' },
            { rule: 'Double after split (DAS)', good: true, impact: '-0.14% HE' },
            { rule: 'Blackjack pays 6:5', good: false, impact: '+1.39% HE' },
            { rule: 'Dealer hits soft 17 (H17)', good: false, impact: '+0.22% HE' },
            { rule: 'No surrender', good: false, impact: '+0.08% HE' },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-navy-700/30 last:border-0">
              <span className={clsx('text-xs font-mono font-bold w-4 shrink-0', r.good ? 'text-green-edge' : 'text-red-400')}>{r.good ? '✓' : '✗'}</span>
              <span className="text-xs font-mono text-gray-300 flex-1">{r.rule}</span>
              <span className={clsx('text-xs font-mono font-bold shrink-0', r.good ? 'text-green-edge' : 'text-red-400')}>{r.impact}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sessions List ─────────────────────────────────────────────────────────────
function SessionsList({ sessions, onUpdate }: { sessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  function endSession(id: string, cashOut: number) { onUpdate(sessions.map(s => s.id === id ? { ...s, endTime: Date.now(), cashOut } : s)); }
  function deleteSession(id: string) { onUpdate(sessions.filter(s => s.id !== id)); }
  if (sessions.length === 0) return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
      <Dices size={40} className="text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400 font-mono text-sm mb-1">No sessions yet</p>
      <p className="text-gray-600 font-mono text-xs">Start a session to track your play</p>
    </div>
  );
  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);
  return (
    <div className="space-y-3">
      {sorted.map(s => {
        const pnl = s.cashOut - s.buyIn; const isActive = !s.endTime; const cfg = GAME_CONFIGS[s.game];
        const duration = isActive ? Math.floor((Date.now() - s.startTime) / 60000) : s.endTime ? Math.floor((s.endTime - s.startTime) / 60000) : 0;
        return (
          <div key={s.id} className={clsx('border rounded-2xl overflow-hidden', isActive ? 'border-amber-edge/30 bg-amber-edge/5' : pnl >= 0 ? 'border-green-edge/20 bg-navy-800' : 'border-navy-700 bg-navy-800')}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{cfg.label}</span>
                      <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full border', cfg.bgColor, cfg.color, cfg.borderColor)}>{s.state}</span>
                      {isActive && <span className="text-xs font-mono bg-amber-edge/20 text-amber-edge px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{s.venue}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 font-mono flex-wrap">
                      <span>{new Date(s.startTime).toLocaleDateString('en-AU')}</span>
                      <span>{duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500 font-mono">{formatCurrency(s.buyIn)} → {formatCurrency(s.cashOut)}</div>
                  <div className={clsx('text-lg font-display font-bold', pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-white transition-colors">
                  {expanded === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{expanded === s.id ? 'Less' : 'Details'}
                </button>
                {isActive && <EndSessionButton session={s} onEnd={co => endSession(s.id, co)} />}
                <button onClick={() => deleteSession(s.id)} className="ml-auto text-xs font-mono text-gray-600 hover:text-red-edge transition-colors"><X size={14} /></button>
              </div>
            </div>
            {expanded === s.id && (
              <div className="border-t border-navy-700/50 p-4 space-y-2">
                {s.notes && <p className="text-xs text-gray-400 font-mono">{s.notes}</p>}
                {s.game === 'pokies' && s.denomination && <div className="text-xs text-gray-500 font-mono">Denomination: {s.denomination}c</div>}
                {s.machineId && <div className="text-xs text-gray-500 font-mono">Machine: {s.machineId}</div>}
                <HourlyRate session={s} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EndSessionButton({ session, onEnd }: { session: CasinoSession; onEnd: (cashOut: number) => void }) {
  const [open, setOpen] = useState(false);
  const [cashOut, setCashOut] = useState(String(session.buyIn));
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 bg-amber-edge/20 text-amber-edge rounded-lg hover:bg-amber-edge/30 transition-all">
      <CheckCircle size={12} />End Session
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">Cash out:</span>
      <input type="number" value={cashOut} onChange={e => setCashOut(e.target.value)}
        className="w-24 bg-navy-900 border border-navy-600 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-green-edge/50" />
      <button onClick={() => onEnd(parseFloat(cashOut) || 0)} className="text-xs font-mono px-2.5 py-1 bg-green-edge/20 text-green-edge rounded-lg hover:bg-green-edge/30 transition-all">Save</button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-600 hover:text-white"><X size={12} /></button>
    </div>
  );
}

function HourlyRate({ session: s }: { session: CasinoSession }) {
  const end = s.endTime || Date.now(); const hours = (end - s.startTime) / 3600000;
  if (hours < 0.05) return null;
  const rate = (s.cashOut - s.buyIn) / hours;
  return <div className="text-xs text-gray-500 font-mono">Hourly: <span className={clsx(rate >= 0 ? 'text-green-edge' : 'text-red-edge')}>{rate >= 0 ? '+' : ''}{formatCurrency(rate)}/hr</span></div>;
}

// ─── New Session ──────────────────────────────────────────────────────────────
function NewSession({ sessions, onUpdate }: { sessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void }) {
  const [game, setGame] = useState<GameType>('pokies');
  const [state, setState] = useState<'NSW' | 'VIC'>('NSW');
  const [venue, setVenue] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [denomination, setDenomination] = useState('1');
  const [machineId, setMachineId] = useState('');
  const [notes, setNotes] = useState('');
  const regs = NSW_VIC_REGS[state];
  const venues = state === 'NSW' ? VENUES_NSW : VENUES_VIC;

  function startSession() {
    if (!buyIn || !venue) return;
    const session: CasinoSession = { id: Math.random().toString(36).slice(2), game, venue, state, startTime: Date.now(), buyIn: parseFloat(buyIn), cashOut: parseFloat(buyIn), bets: [], notes, machineId: machineId || undefined, denomination: game === 'pokies' ? parseInt(denomination) : undefined };
    onUpdate([...sessions, session]);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(GAME_CONFIGS) as Array<[GameType, typeof GAME_CONFIGS.pokies]>).map(([key, cfg]) => (
          <button key={key} onClick={() => setGame(key)} className={clsx('p-4 rounded-2xl border text-center transition-all', game === key ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}` : 'bg-navy-800 border-navy-700 text-gray-400 hover:text-white')}>
            <div className="text-2xl mb-1">{cfg.emoji}</div>
            <div className="text-sm font-display font-semibold">{cfg.label}</div>
            <div className="text-xs font-mono mt-1 opacity-70">HE: {cfg.houseEdge.typical}%</div>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['NSW', 'VIC'] as const).map(s => (
          <button key={s} onClick={() => setState(s)} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-mono border transition-all', state === s ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-400 border-navy-700 hover:text-white')}>{s}</button>
        ))}
      </div>
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 font-mono leading-relaxed">{regs.note}</p>
      </div>
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Venue</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {venues.map(v => <button key={v} onClick={() => setVenue(v)} className={clsx('text-xs font-mono px-2.5 py-1 rounded-lg border transition-all', venue === v ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>{v}</button>)}
        </div>
        <input type="text" placeholder="Or type venue name..." value={venue} onChange={e => setVenue(e.target.value)} className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50" />
      </div>
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Buy-in ($)</label>
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-gray-500 shrink-0" />
          <input type="number" placeholder="100" value={buyIn} onChange={e => setBuyIn(e.target.value)} className="flex-1 bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50" />
        </div>
      </div>
      {game === 'pokies' && (
        <>
          <div>
            <label className="text-xs font-mono text-gray-400 block mb-1.5">Denomination (cents) — EdgeIQ recommends 1c</label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 5, 10, 20, 50, 100].map(d => (
                <button key={d} onClick={() => setDenomination(String(d))} className={clsx('px-3 py-1.5 rounded-lg text-xs font-mono border transition-all', denomination === String(d) ? d <= 2 ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-purple-400/20 text-purple-400 border-purple-400/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>
                  {d}c{d <= 2 && ' ★'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-400 block mb-1.5">Machine (optional)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MACHINES.slice(0, 4).map(m => <button key={m.name} onClick={() => setMachineId(m.name)} className={clsx('text-xs font-mono px-2.5 py-1 rounded-lg border transition-all', machineId === m.name ? 'bg-purple-400/20 text-purple-400 border-purple-400/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white')}>{m.emoji} {m.name}</button>)}
            </div>
            <input type="text" placeholder="Or type machine name..." value={machineId} onChange={e => setMachineId(e.target.value)} className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50" />
          </div>
        </>
      )}
      <textarea placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50 resize-none" />
      <div className="bg-amber-edge/5 border border-amber-edge/20 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-edge shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 font-mono">{state === 'VIC' ? 'VIC mandatory pre-commitment limit: $350/day.' : 'BetSafeNSW or Gambling Help: 1800 858 858.'}</p>
      </div>
      <button onClick={startSession} disabled={!buyIn || !venue} className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim disabled:opacity-40 transition-all">Start Session</button>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function CasinoStats({ sessions }: { sessions: CasinoSession[] }) {
  if (sessions.length === 0) return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
      <BarChart3 size={40} className="text-gray-600 mx-auto mb-4" />
      <p className="text-gray-500 font-mono text-sm">No sessions to analyse yet</p>
    </div>
  );
  const completed = sessions.filter(s => !!s.endTime);
  const totalPnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);
  const totalBuyIn = sessions.reduce((a, s) => a + s.buyIn, 0);
  const winSessions = sessions.filter(s => s.cashOut > s.buyIn).length;
  const totalHours = completed.reduce((a, s) => a + (s.endTime! - s.startTime) / 3600000, 0);
  const byGame: Partial<Record<GameType, { pnl: number; sessions: number; buyIn: number }>> = {};
  for (const s of sessions) { if (!byGame[s.game]) byGame[s.game] = { pnl: 0, sessions: 0, buyIn: 0 }; byGame[s.game]!.pnl += s.cashOut - s.buyIn; byGame[s.game]!.sessions++; byGame[s.game]!.buyIn += s.buyIn; }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Total P&L" value={formatCurrency(totalPnl)} color={totalPnl >= 0 ? 'green' : 'red'} />
        <StatBox label="Sessions" value={String(sessions.length)} color="white" sub={`${winSessions}W / ${sessions.length - winSessions}L`} />
        <StatBox label="Win Rate" value={`${sessions.length ? ((winSessions / sessions.length) * 100).toFixed(0) : 0}%`} color="amber" />
        <StatBox label="Hourly" value={totalHours > 0 ? formatCurrency(totalPnl / totalHours) : '—'} color={totalPnl >= 0 ? 'green' : 'red'} sub="/hr" />
      </div>
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">By Game</h3>
        <div className="space-y-3">
          {(Object.entries(byGame) as Array<[GameType, { pnl: number; sessions: number; buyIn: number }]>).map(([game, data]) => {
            const cfg = GAME_CONFIGS[game]; const roi = data.buyIn > 0 ? (data.pnl / data.buyIn) * 100 : 0;
            return (
              <div key={game} className="flex items-center gap-3">
                <span className="text-xl w-7">{cfg.emoji}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-0.5"><span className="text-white font-medium">{cfg.label}</span><span className={clsx('font-mono font-bold', data.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>{data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}</span></div>
                  <div className="flex gap-4 text-xs text-gray-500 font-mono"><span>{data.sessions} sessions</span><span>ROI {roi.toFixed(1)}%</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colors: Record<string, string> = { green: 'text-green-edge', red: 'text-red-edge', amber: 'text-amber-edge', white: 'text-white' };
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 text-center">
      <div className={clsx('text-xl font-display font-bold', colors[color] || 'text-white')}>{value}</div>
      {sub && <div className="text-xs text-gray-500 font-mono">{sub}</div>}
      <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
    </div>
  );
}
