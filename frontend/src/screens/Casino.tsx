import React, { useState, useEffect, useMemo } from 'react';
import {
  Dices, TrendingUp, TrendingDown, Clock, PlusCircle, X,
  ChevronDown, ChevronUp, BarChart3, Target, AlertTriangle, CheckCircle,
  Info, DollarSign, Zap,
} from 'lucide-react';
import { clsx, formatCurrency } from '../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type GameType = 'pokies' | 'roulette' | 'blackjack';
type BetOutcome = 'win' | 'loss' | 'push';

interface CasinoBet {
  id: string;
  amount: number;
  outcome: BetOutcome;
  details?: string;
  ts: number;
}

interface CasinoSession {
  id: string;
  game: GameType;
  venue: string;
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';
  startTime: number;
  endTime?: number;
  buyIn: number;
  cashOut: number;
  bets: CasinoBet[];
  notes: string;
  machineId?: string;
  denomination?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NSW_VIC_REGS = {
  NSW: {
    maxBet: 10,
    spinInterval: 3,
    dailyLimit: null,
    selfExclusion: 'BetSafeNSW',
    note: 'NSW: $10 max bet per spin, 3s min spin interval on Class B/C machines. 500 max machines per club.',
  },
  VIC: {
    maxBet: 5,
    spinInterval: 3,
    dailyLimit: 350,
    selfExclusion: 'Gambler\'s Help',
    note: 'VIC: $5 max bet, $350/day pre-commitment limit, 3s min spin interval. Pre-commitment mandatory.',
  },
};

const GAME_CONFIGS = {
  pokies: {
    label: 'Pokies',
    emoji: '🎰',
    houseEdge: { min: 10, max: 15, typical: 12 },
    description: 'Electronic gaming machines (EGMs)',
    denominationsNSW: [1, 2, 5, 10, 20, 50, 100],
    rtpRange: '85–90%',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
  },
  roulette: {
    label: 'Roulette',
    emoji: '🎡',
    houseEdge: { min: 2.7, max: 5.26, typical: 2.7 },
    description: 'European (2.7%) or American (5.26%) roulette',
    rtpRange: '94.74–97.3%',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
  },
  blackjack: {
    label: 'Blackjack',
    emoji: '🃏',
    houseEdge: { min: 0.5, max: 2, typical: 0.5 },
    description: 'With basic strategy: house edge ~0.5%',
    rtpRange: '98–99.5% (basic strategy)',
    color: 'text-green-edge',
    bgColor: 'bg-green-edge/10',
    borderColor: 'border-green-edge/30',
  },
};

const BJ_STRATEGY: Record<string, Record<string, string>> = {
  '8-9': { '2': 'H', '3': 'H', '4': 'H', '5': 'Dh', '6': 'Dh', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
  '10': { '2': 'Dh', '3': 'Dh', '4': 'Dh', '5': 'Dh', '6': 'Dh', '7': 'Dh', '8': 'Dh', '9': 'Dh', '10': 'H', 'A': 'H' },
  '11': { '2': 'Dh', '3': 'Dh', '4': 'Dh', '5': 'Dh', '6': 'Dh', '7': 'Dh', '8': 'Dh', '9': 'Dh', '10': 'Dh', 'A': 'H' },
  '12': { '2': 'H', '3': 'H', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
  '13-14': { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'H', 'A': 'H' },
  '15': { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'H', '10': 'Rh', 'A': 'H' },
  '16': { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'H', '8': 'H', '9': 'Rh', '10': 'Rh', 'A': 'Rh' },
  '17+': { '2': 'S', '3': 'S', '4': 'S', '5': 'S', '6': 'S', '7': 'S', '8': 'S', '9': 'S', '10': 'S', 'A': 'S' },
};

const BJ_ACTIONS: Record<string, { label: string; color: string }> = {
  H: { label: 'Hit', color: 'bg-blue-500/80' },
  S: { label: 'Stand', color: 'bg-navy-700' },
  Dh: { label: 'Double/Hit', color: 'bg-green-edge/80' },
  Rh: { label: 'Surrender/Hit', color: 'bg-red-500/80' },
  SP: { label: 'Split', color: 'bg-amber-edge/80' },
};

const DEALER_CARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

const VENUES_NSW = ['Crown Sydney', 'The Star Sydney', 'Local Club', 'RSL Club', 'Leagues Club', 'Other'];
const VENUES_VIC = ['Crown Melbourne', 'The Star Melbourne', 'Local Club', 'Hotel', 'Other'];

// ─── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'edgeiq-casino-sessions';

function loadSessions(): CasinoSession[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveSessions(sessions: CasinoSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─── Main Component ──────────────────────────────────────────────────────────

type Tab = 'sessions' | 'new' | 'stats' | 'strategy';

export function Casino() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [sessions, setSessions] = useState<CasinoSession[]>(loadSessions);

  function updateSessions(s: CasinoSession[]) {
    setSessions(s);
    saveSessions(s);
  }

  const totalPnl = sessions.reduce((acc, s) => acc + (s.cashOut - s.buyIn), 0);
  const wonSessions = sessions.filter(s => s.cashOut > s.buyIn).length;
  const activeSessions = sessions.filter(s => !s.endTime);

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'sessions', label: 'Sessions', icon: <Clock size={14} /> },
    { id: 'new', label: activeSessions.length ? `Active (${activeSessions.length})` : 'New Session', icon: <PlusCircle size={14} /> },
    { id: 'stats', label: 'Analytics', icon: <BarChart3 size={14} /> },
    { id: 'strategy', label: 'Strategy', icon: <Target size={14} /> },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Dices size={22} className="text-purple-400" />
            <h1 className="font-display font-bold text-2xl text-white">Casino</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">NSW / VIC in-person session tracker</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-500 font-mono">All-time P&L</div>
            <div className={clsx('font-display font-bold text-lg', totalPnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-navy-800 border border-navy-700 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-mono transition-all',
              tab === t.id ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-white'
            )}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'sessions' && (
        <SessionsList sessions={sessions} onUpdate={updateSessions} />
      )}
      {tab === 'new' && (
        <NewSession sessions={sessions} onUpdate={s => { updateSessions(s); setTab('sessions'); }} />
      )}
      {tab === 'stats' && (
        <CasinoStats sessions={sessions} />
      )}
      {tab === 'strategy' && (
        <StrategyGuide />
      )}
    </div>
  );
}

// ─── Sessions List ────────────────────────────────────────────────────────────

function SessionsList({ sessions, onUpdate }: { sessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function endSession(id: string, cashOut: number) {
    onUpdate(sessions.map(s => s.id === id ? { ...s, endTime: Date.now(), cashOut } : s));
  }

  function deleteSession(id: string) {
    onUpdate(sessions.filter(s => s.id !== id));
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
        <Dices size={40} className="text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 font-mono text-sm mb-1">No sessions recorded yet</p>
        <p className="text-gray-600 font-mono text-xs">Track your casino visits to analyse your play</p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="space-y-3">
      {sorted.map(s => {
        const pnl = s.cashOut - s.buyIn;
        const isActive = !s.endTime;
        const cfg = GAME_CONFIGS[s.game];
        const duration = isActive
          ? Math.floor((Date.now() - s.startTime) / 60000)
          : s.endTime ? Math.floor((s.endTime - s.startTime) / 60000) : 0;

        return (
          <div key={s.id} className={clsx('border rounded-2xl overflow-hidden',
            isActive ? 'border-amber-edge/30 bg-amber-edge/5' : pnl >= 0 ? 'border-green-edge/20 bg-navy-800' : 'border-navy-700 bg-navy-800'
          )}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{cfg.label}</span>
                      <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full border', cfg.bgColor, cfg.color, cfg.borderColor)}>
                        {s.state}
                      </span>
                      {isActive && (
                        <span className="text-xs font-mono bg-amber-edge/20 text-amber-edge px-2 py-0.5 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{s.venue}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 font-mono flex-wrap">
                      <span>{new Date(s.startTime).toLocaleDateString('en-AU')}</span>
                      <span>{new Date(s.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500 font-mono">Buy-in → Cash-out</div>
                  <div className="text-sm font-mono text-gray-300">
                    {formatCurrency(s.buyIn)} → {formatCurrency(s.cashOut)}
                  </div>
                  <div className={clsx('text-lg font-display font-bold', pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-white transition-colors">
                  {expanded === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded === s.id ? 'Less' : 'Details'}
                </button>
                {isActive && (
                  <EndSessionButton session={s} onEnd={cashOut => endSession(s.id, cashOut)} />
                )}
                <button onClick={() => deleteSession(s.id)}
                  className="ml-auto text-xs font-mono text-gray-600 hover:text-red-edge transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {expanded === s.id && (
              <div className="border-t border-navy-700/50 p-4 space-y-3">
                {s.notes && <p className="text-xs text-gray-400 font-mono">{s.notes}</p>}
                {s.game === 'pokies' && s.denomination && (
                  <div className="text-xs text-gray-500 font-mono">Denomination: {s.denomination}c</div>
                )}
                {s.machineId && (
                  <div className="text-xs text-gray-500 font-mono">Machine: {s.machineId}</div>
                )}
                <HourlyRate session={s} />
                {s.game !== 'pokies' && <SessionROI session={s} />}
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
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 bg-amber-edge/20 text-amber-edge rounded-lg hover:bg-amber-edge/30 transition-all">
      <CheckCircle size={12} />End Session
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">Cash out:</span>
      <input
        type="number"
        value={cashOut}
        onChange={e => setCashOut(e.target.value)}
        className="w-24 bg-navy-900 border border-navy-600 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-green-edge/50"
      />
      <button onClick={() => onEnd(parseFloat(cashOut) || 0)}
        className="text-xs font-mono px-2.5 py-1 bg-green-edge/20 text-green-edge rounded-lg hover:bg-green-edge/30 transition-all">
        Save
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-600 hover:text-white">
        <X size={12} />
      </button>
    </div>
  );
}

function HourlyRate({ session }: { session: CasinoSession }) {
  const end = session.endTime || Date.now();
  const hours = (end - session.startTime) / 3600000;
  if (hours < 0.05) return null;
  const pnl = session.cashOut - session.buyIn;
  const rate = pnl / hours;
  return (
    <div className="text-xs text-gray-500 font-mono">
      Hourly rate: <span className={clsx(rate >= 0 ? 'text-green-edge' : 'text-red-edge')}>
        {rate >= 0 ? '+' : ''}{formatCurrency(rate)}/hr
      </span>
    </div>
  );
}

function SessionROI({ session }: { session: CasinoSession }) {
  if (!session.buyIn) return null;
  const roi = ((session.cashOut - session.buyIn) / session.buyIn) * 100;
  return (
    <div className="text-xs text-gray-500 font-mono">
      Session ROI: <span className={clsx(roi >= 0 ? 'text-green-edge' : 'text-red-edge')}>
        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── New Session ──────────────────────────────────────────────────────────────

function NewSession({ sessions, onUpdate }: { sessions: CasinoSession[]; onUpdate: (s: CasinoSession[]) => void }) {
  const [game, setGame] = useState<GameType>('pokies');
  const [state, setState] = useState<'NSW' | 'VIC'>('NSW');
  const [venue, setVenue] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [denomination, setDenomination] = useState('10');
  const [machineId, setMachineId] = useState('');
  const [notes, setNotes] = useState('');

  const regs = NSW_VIC_REGS[state];
  const cfg = GAME_CONFIGS[game];
  const venues = state === 'NSW' ? VENUES_NSW : VENUES_VIC;

  function startSession() {
    if (!buyIn || !venue) return;
    const session: CasinoSession = {
      id: Math.random().toString(36).slice(2),
      game,
      venue: venue || 'Unknown',
      state,
      startTime: Date.now(),
      buyIn: parseFloat(buyIn),
      cashOut: parseFloat(buyIn),
      bets: [],
      notes,
      machineId: machineId || undefined,
      denomination: game === 'pokies' ? parseInt(denomination) : undefined,
    };
    onUpdate([...sessions, session]);
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* Game selector */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(GAME_CONFIGS) as Array<[GameType, typeof GAME_CONFIGS['pokies']]>).map(([key, cfg]) => (
          <button key={key} onClick={() => setGame(key)}
            className={clsx('p-4 rounded-2xl border text-center transition-all',
              game === key ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}` : 'bg-navy-800 border-navy-700 text-gray-400 hover:text-white'
            )}>
            <div className="text-2xl mb-1">{cfg.emoji}</div>
            <div className="text-sm font-display font-semibold">{cfg.label}</div>
            <div className="text-xs font-mono mt-1 opacity-70">HE: {cfg.houseEdge.typical}%</div>
          </button>
        ))}
      </div>

      {/* State */}
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">State / Territory</label>
        <div className="flex gap-2">
          {(['NSW', 'VIC'] as const).map(s => (
            <button key={s} onClick={() => setState(s)}
              className={clsx('flex-1 py-2.5 rounded-xl text-sm font-mono border transition-all',
                state === s ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-400 border-navy-700 hover:text-white'
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Regs banner */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 font-mono leading-relaxed">{regs.note}</p>
      </div>

      {/* Venue */}
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Venue</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {venues.map(v => (
            <button key={v} onClick={() => setVenue(v)}
              className={clsx('text-xs font-mono px-2.5 py-1 rounded-lg border transition-all',
                venue === v ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white'
              )}>
              {v}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or type venue name..."
          value={venue}
          onChange={e => setVenue(e.target.value)}
          className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
        />
      </div>

      {/* Buy-in */}
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Buy-in ($)</label>
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-gray-500 shrink-0" />
          <input
            type="number"
            placeholder="100"
            value={buyIn}
            onChange={e => setBuyIn(e.target.value)}
            className="flex-1 bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
          />
        </div>
      </div>

      {/* Pokies extras */}
      {game === 'pokies' && (
        <>
          <div>
            <label className="text-xs font-mono text-gray-400 block mb-1.5">Denomination (cents)</label>
            <div className="flex flex-wrap gap-1.5">
              {GAME_CONFIGS.pokies.denominationsNSW.map(d => (
                <button key={d} onClick={() => setDenomination(String(d))}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                    denomination === String(d) ? 'bg-purple-400/20 text-purple-400 border-purple-400/30' : 'bg-navy-800 text-gray-500 border-navy-700 hover:text-white'
                  )}>
                  {d}c
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-400 block mb-1.5">Machine ID (optional)</label>
            <input
              type="text"
              placeholder="e.g. EGM-042"
              value={machineId}
              onChange={e => setMachineId(e.target.value)}
              className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
            />
          </div>
        </>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs font-mono text-gray-400 block mb-1.5">Notes (optional)</label>
        <textarea
          placeholder="Table conditions, machine feel, etc."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50 resize-none"
        />
      </div>

      {/* Responsible gambling */}
      <div className="bg-amber-edge/5 border border-amber-edge/20 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-edge shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-edge font-mono font-semibold mb-1">Responsible Gambling</p>
            <p className="text-xs text-gray-500 font-mono leading-relaxed">
              Set a loss limit before you start. {state === 'VIC' ? 'VIC mandatory pre-commitment limit: $350/day.' : 'Use BetSafeNSW or call Gambling Help: 1800 858 858.'}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={startSession}
        disabled={!buyIn || !venue}
        className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim disabled:opacity-40 transition-all">
        Start Session
      </button>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function CasinoStats({ sessions }: { sessions: CasinoSession[] }) {
  const completed = sessions.filter(s => !!s.endTime);

  if (sessions.length === 0) {
    return (
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-12 text-center">
        <BarChart3 size={40} className="text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 font-mono text-sm">No sessions to analyse yet</p>
      </div>
    );
  }

  const totalPnl = sessions.reduce((a, s) => a + (s.cashOut - s.buyIn), 0);
  const totalBuyIn = sessions.reduce((a, s) => a + s.buyIn, 0);
  const winSessions = sessions.filter(s => s.cashOut > s.buyIn).length;
  const totalHours = completed.reduce((a, s) => a + (s.endTime! - s.startTime) / 3600000, 0);

  const byGame: Partial<Record<GameType, { pnl: number; sessions: number; hours: number }>> = {};
  for (const s of sessions) {
    if (!byGame[s.game]) byGame[s.game] = { pnl: 0, sessions: 0, hours: 0 };
    byGame[s.game]!.pnl += s.cashOut - s.buyIn;
    byGame[s.game]!.sessions++;
    if (s.endTime) byGame[s.game]!.hours += (s.endTime - s.startTime) / 3600000;
  }

  const byVenue: Record<string, { pnl: number; sessions: number }> = {};
  for (const s of sessions) {
    if (!byVenue[s.venue]) byVenue[s.venue] = { pnl: 0, sessions: 0 };
    byVenue[s.venue].pnl += s.cashOut - s.buyIn;
    byVenue[s.venue].sessions++;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total P&L" value={formatCurrency(totalPnl)} color={totalPnl >= 0 ? 'green' : 'red'} />
        <StatBox label="Sessions" value={String(sessions.length)} color="white" sub={`${winSessions} winning`} />
        <StatBox label="Win Rate" value={`${sessions.length ? ((winSessions / sessions.length) * 100).toFixed(0) : 0}%`} color="amber" />
        <StatBox label="Hourly" value={totalHours > 0 ? formatCurrency(totalPnl / totalHours) : '—'} color={totalPnl >= 0 ? 'green' : 'red'} sub="/hr" />
      </div>

      {/* By game */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Performance by Game</h3>
        <div className="space-y-3">
          {(Object.entries(byGame) as Array<[GameType, { pnl: number; sessions: number; hours: number }]>).map(([game, data]) => {
            const cfg = GAME_CONFIGS[game];
            const roi = totalBuyIn > 0 ? (data.pnl / (sessions.filter(s => s.game === game).reduce((a, s) => a + s.buyIn, 0))) * 100 : 0;
            return (
              <div key={game} className="flex items-center gap-3">
                <span className="text-xl w-7">{cfg.emoji}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white font-medium">{cfg.label}</span>
                    <span className={clsx('font-mono font-bold', data.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                      {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 font-mono">
                    <span>{data.sessions} sessions</span>
                    <span>ROI: {roi.toFixed(1)}%</span>
                    {data.hours > 0 && <span>{data.hours.toFixed(1)}h played</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By venue */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Performance by Venue</h3>
        <div className="space-y-2">
          {Object.entries(byVenue).sort((a, b) => b[1].pnl - a[1].pnl).map(([v, d]) => (
            <div key={v} className="flex items-center justify-between py-1.5 border-b border-navy-700/40 last:border-0">
              <div>
                <span className="text-sm text-white">{v}</span>
                <span className="text-xs text-gray-500 font-mono ml-2">{d.sessions}x</span>
              </div>
              <span className={clsx('text-sm font-mono font-bold', d.pnl >= 0 ? 'text-green-edge' : 'text-red-edge')}>
                {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* EV warning for pokies */}
      <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
        <h3 className="font-display font-semibold text-white text-sm mb-2 flex items-center gap-2">
          <Zap size={14} className="text-amber-edge" />
          Expected Value Reality Check
        </h3>
        <div className="space-y-2">
          {(Object.entries(GAME_CONFIGS) as Array<[GameType, typeof GAME_CONFIGS['pokies']]>).map(([game, cfg]) => (
            <div key={game} className="flex items-center gap-3 text-xs font-mono">
              <span className="w-7">{cfg.emoji}</span>
              <span className="text-gray-400 w-20">{cfg.label}</span>
              <span className="text-red-400">HE: {cfg.houseEdge.typical}%</span>
              <span className="text-gray-500 mx-1">·</span>
              <span className="text-gray-400">RTP: {cfg.rtpRange}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 font-mono mt-3 leading-relaxed">
          Long-run expected loss per $100 wagered: Pokies ~$12, Roulette ~$2.70, Blackjack ~$0.50 (with basic strategy).
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-edge', red: 'text-red-edge', amber: 'text-amber-edge', white: 'text-white',
  };
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 text-center">
      <div className={clsx('text-xl font-display font-bold', colors[color] || 'text-white')}>{value}</div>
      {sub && <div className="text-xs text-gray-500 font-mono">{sub}</div>}
      <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
    </div>
  );
}

// ─── Strategy Guide ───────────────────────────────────────────────────────────

function StrategyGuide() {
  const [game, setGame] = useState<GameType>('blackjack');
  const [bjHand, setBjHand] = useState('');
  const [dealerCard, setDealerCard] = useState('');

  const action = bjHand && dealerCard ? getBJAction(bjHand, dealerCard) : null;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Game tabs */}
      <div className="flex gap-2">
        {(Object.entries(GAME_CONFIGS) as Array<[GameType, typeof GAME_CONFIGS['pokies']]>).map(([key, cfg]) => (
          <button key={key} onClick={() => setGame(key)}
            className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono border transition-all',
              game === key ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}` : 'bg-navy-800 text-gray-400 border-navy-700 hover:text-white'
            )}>
            {cfg.emoji} {cfg.label}
          </button>
        ))}
      </div>

      {game === 'blackjack' && (
        <div className="space-y-4">
          {/* Quick lookup */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <h3 className="font-display font-semibold text-white text-sm mb-3">Basic Strategy Lookup</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-mono text-gray-400 block mb-1.5">Your hand total</label>
                <input
                  type="number"
                  placeholder="e.g. 15"
                  value={bjHand}
                  onChange={e => setBjHand(e.target.value)}
                  min={5} max={21}
                  className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-gray-400 block mb-1.5">Dealer upcard</label>
                <div className="flex flex-wrap gap-1">
                  {DEALER_CARDS.map(c => (
                    <button key={c} onClick={() => setDealerCard(c)}
                      className={clsx('w-8 h-8 rounded-lg text-xs font-mono font-bold border transition-all',
                        dealerCard === c ? 'bg-green-edge/20 text-green-edge border-green-edge/30' : 'bg-navy-900 text-gray-400 border-navy-700 hover:text-white'
                      )}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {action && (
              <div className={clsx('flex items-center gap-3 p-3 rounded-xl border',
                action.key === 'H' ? 'bg-blue-500/10 border-blue-500/30' :
                action.key === 'S' ? 'bg-navy-700 border-navy-600' :
                action.key === 'Dh' ? 'bg-green-edge/10 border-green-edge/20' :
                'bg-red-500/10 border-red-500/30'
              )}>
                <div className={clsx('text-2xl font-display font-bold w-10 h-10 rounded-xl flex items-center justify-center text-navy-950', BJ_ACTIONS[action.key]?.color || 'bg-navy-700')}>
                  {action.key === 'H' ? 'H' : action.key === 'S' ? 'S' : action.key === 'Dh' ? 'D' : 'R'}
                </div>
                <div>
                  <div className="text-white font-display font-semibold">{BJ_ACTIONS[action.key]?.label}</div>
                  <div className="text-xs text-gray-400 font-mono">Hand {bjHand} vs dealer {dealerCard}</div>
                </div>
              </div>
            )}
          </div>

          {/* Full strategy chart */}
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4 overflow-x-auto">
            <h3 className="font-display font-semibold text-white text-sm mb-3">Full Basic Strategy Chart (Hard Hands)</h3>
            <table className="text-xs font-mono w-full">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 text-gray-500">Hand</th>
                  {DEALER_CARDS.map(c => (
                    <th key={c} className="px-1 py-1 text-gray-400">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(BJ_STRATEGY).map(([hand, actions]) => (
                  <tr key={hand} className="border-t border-navy-700/30">
                    <td className="py-1 pr-3 text-gray-400">{hand}</td>
                    {DEALER_CARDS.map(c => {
                      const a = actions[c];
                      return (
                        <td key={c} className="px-1 py-1 text-center">
                          <span className={clsx('px-1 py-0.5 rounded text-xs font-bold text-navy-950 inline-block w-6',
                            a === 'H' ? 'bg-blue-500' :
                            a === 'S' ? 'bg-gray-500' :
                            a === 'Dh' ? 'bg-green-500' :
                            a === 'Rh' ? 'bg-red-500' : 'bg-gray-700 text-gray-400'
                          )}>
                            {a}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(BJ_ACTIONS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1 text-xs font-mono">
                  <span className={clsx('w-5 h-5 rounded flex items-center justify-center text-navy-950 text-xs font-bold', v.color)}>{k}</span>
                  <span className="text-gray-400">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {game === 'roulette' && (
        <div className="space-y-3">
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <h3 className="font-display font-semibold text-white text-sm mb-3">Roulette Bet Reference</h3>
            <div className="space-y-2">
              {[
                { bet: 'Single number', payout: '35:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '2.63%' },
                { bet: 'Split (2 numbers)', payout: '17:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '5.26%' },
                { bet: 'Street (3 numbers)', payout: '11:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '7.89%' },
                { bet: 'Corner (4 numbers)', payout: '8:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '10.53%' },
                { bet: 'Six line (6 numbers)', payout: '5:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '15.79%' },
                { bet: 'Dozen / Column', payout: '2:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '31.58%' },
                { bet: 'Red / Black', payout: '1:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '47.37%' },
                { bet: 'Even / Odd', payout: '1:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '47.37%' },
                { bet: 'High / Low', payout: '1:1', edge_eu: '2.7%', edge_us: '5.26%', prob: '47.37%' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-navy-700/30 last:border-0 text-xs font-mono">
                  <span className="text-white">{row.bet}</span>
                  <span className="text-gray-400">{row.payout}</span>
                  <span className="text-gray-500">{row.prob}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 bg-amber-edge/10 border border-amber-edge/20 rounded-xl">
              <p className="text-xs text-amber-edge font-mono">
                All bets have the same house edge. Play European (single zero) over American (double zero) — house edge 2.7% vs 5.26%.
              </p>
            </div>
          </div>
        </div>
      )}

      {game === 'pokies' && (
        <div className="space-y-3">
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <h3 className="font-display font-semibold text-white text-sm mb-3">NSW/VIC Pokies — What You Need to Know</h3>
            <div className="space-y-3 text-xs font-mono">
              {[
                { label: 'NSW Max Bet', value: '$10 per spin (Class B/C EGMs)', color: 'text-gray-300' },
                { label: 'VIC Max Bet', value: '$5 per spin', color: 'text-gray-300' },
                { label: 'Min Spin Interval', value: '3 seconds (both states)', color: 'text-gray-300' },
                { label: 'Typical RTP', value: '85–90% (set by regulation)', color: 'text-red-400' },
                { label: 'House Edge', value: '10–15% of every dollar wagered', color: 'text-red-400' },
                { label: 'Expected loss/hr', value: '~$40–80/hr at $5/spin', color: 'text-red-400' },
                { label: 'VIC Pre-Commitment', value: 'Mandatory $350/day cap', color: 'text-amber-edge' },
                { label: 'Help Line', value: '1800 858 858 (24/7)', color: 'text-green-edge' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between border-b border-navy-700/30 last:border-0 pb-2">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={row.color}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-edge/5 border border-red-edge/20 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-display font-semibold mb-1">Pokies have the worst odds in the venue</p>
                <p className="text-xs text-gray-400 font-mono leading-relaxed">
                  Unlike blackjack (0.5% HE with basic strategy), pokies have a 10–15% house edge with no strategy to reduce it. Every spin is independent — there is no such thing as a "hot" or "due" machine.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getBJAction(handStr: string, dealer: string): { key: string } | null {
  const hand = parseInt(handStr);
  if (isNaN(hand)) return null;

  let row: string;
  if (hand <= 9) row = '8-9';
  else if (hand === 10) row = '10';
  else if (hand === 11) row = '11';
  else if (hand === 12) row = '12';
  else if (hand <= 14) row = '13-14';
  else if (hand === 15) row = '15';
  else if (hand === 16) row = '16';
  else row = '17+';

  const action = BJ_STRATEGY[row]?.[dealer];
  if (!action) return null;
  return { key: action };
}
