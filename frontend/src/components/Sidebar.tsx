import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Clock,
  Flag,
  Gamepad2,
  Activity,
  History,
  Settings,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  AlertCircle,
  Dices,
  X,
  Camera,
  DollarSign,
  Lock,
  Check,
} from 'lucide-react';
import { clsx, formatCurrency } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';
import { bankrollApi } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  pulse?: boolean;
  section?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/live', label: 'Live', icon: Radio, pulse: true },
  { to: '/pending', label: 'Pending Bets', icon: Clock },
  { to: '/screenshot', label: 'Screenshot AI', icon: Camera },
  { to: '/racing', label: 'Racing', icon: Flag },
  { to: '/sports', label: 'Sports', icon: Gamepad2 },
  { to: '/active', label: 'Active Bets', icon: Activity },
  { to: '/history', label: 'History', icon: History },
  { to: '/casino', label: 'Casino', icon: Dices, section: 'Casino' },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function BalanceModal({ onClose }: { onClose: () => void }) {
  const { loadBankroll, addToast, bankrollStats } = useAppStore();
  const [value, setValue] = useState(
    bankrollStats ? bankrollStats.current_balance.toFixed(2) : ''
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await bankrollApi.set(amount);
      await loadBankroll();
      addToast('success', `Balance set to ${formatCurrency(amount)}`);
      onClose();
    } catch {
      addToast('error', 'Failed to update balance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-navy-800 border border-navy-700 rounded-2xl p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-green-edge/20 flex items-center justify-center">
            <DollarSign size={18} className="text-green-edge" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white">Update Balance</h3>
            <p className="text-xs text-gray-500 font-mono">Enter your current TAB balance</p>
          </div>
        </div>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full bg-navy-900 border border-navy-600 rounded-xl pl-7 pr-3 py-3 text-white font-mono text-lg focus:outline-none focus:border-green-edge/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !value}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold text-sm hover:bg-green-dim disabled:opacity-50 transition-all"
          >
            <Check size={16} />
            {saving ? 'Saving...' : 'Set Balance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { bankrollStats, backendConnected, triggerScrape, scraperStatus, lock } = useAppStore();
  const { pending } = useBettingStore();
  const [showBalance, setShowBalance] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        'w-56 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col h-[100dvh] top-0 z-40 transition-transform duration-200',
        'fixed lg:relative',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo — inline style so env() isn't overridden by Tailwind utilities */}
        <div className="px-5 border-b border-navy-700 flex items-center justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top, 44px), 20px)', paddingBottom: '20px' }}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-edge flex items-center justify-center">
                <Zap size={14} className="text-navy-950" />
              </div>
              <span className="font-display font-bold text-lg text-white tracking-tight">
                Edge<span className="text-green-edge">IQ</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {backendConnected ? (
                <Wifi size={10} className="text-green-edge" />
              ) : (
                <WifiOff size={10} className="text-red-edge" />
              )}
              <span className="text-xs font-mono text-gray-500">
                {backendConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Bankroll summary + update */}
        <div className="px-4 py-3 border-b border-navy-700">
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Bankroll</div>
            <button
              onClick={() => setShowBalance(true)}
              className="text-xs font-mono text-gray-500 hover:text-green-edge transition-all flex items-center gap-1"
              title="Update balance"
            >
              <DollarSign size={10} />
              Update
            </button>
          </div>
          {bankrollStats ? (
            <>
              <button
                onClick={() => setShowBalance(true)}
                className="font-display font-bold text-lg text-white hover:text-green-edge transition-all"
              >
                {formatCurrency(bankrollStats.current_balance)}
              </button>
              <div className={clsx('text-xs font-mono',
                bankrollStats.net_pnl >= 0 ? 'text-green-edge' : 'text-red-edge'
              )}>
                {bankrollStats.net_pnl >= 0 ? '+' : ''}{formatCurrency(bankrollStats.net_pnl)} P&L
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowBalance(true)}
              className="text-sm font-mono text-gray-500 hover:text-green-edge transition-all"
            >
              Set balance →
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, exact, pulse, section }, idx) => {
            const prevSection = idx > 0 ? NAV[idx - 1].section : undefined;
            const showDivider = section && section !== prevSection;
            return (
              <React.Fragment key={to}>
                {showDivider && (
                  <div className="px-3 pt-3 pb-1">
                    <div className="text-xs font-mono text-gray-600 uppercase tracking-wider">{section}</div>
                  </div>
                )}
                <NavLink
                  to={to}
                  end={exact}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                      isActive
                        ? 'bg-green-edge/15 text-green-edge font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-navy-800'
                    )
                  }
                >
                  <div className="relative">
                    <Icon size={16} />
                    {pulse && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-edge animate-pulse" />}
                  </div>
                  <span>{label}</span>
                  {label === 'Pending Bets' && pending.length > 0 && (
                    <span className="ml-auto bg-green-edge text-navy-950 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                      {pending.length}
                    </span>
                  )}
                  {label === 'Settings' && (scraperStatus?.errors?.length || 0) > 0 && (
                    <AlertCircle size={12} className="ml-auto text-red-edge" />
                  )}
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Scraper status */}
        <div className="px-4 py-3 border-t border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <div className={clsx('w-2 h-2 rounded-full',
                  scraperStatus?.running ? 'bg-green-edge animate-pulse' : 'bg-gray-600'
                )} />
                <span className="text-xs font-mono text-gray-500">
                  {scraperStatus?.running ? 'Scraping...' : 'Scraper idle'}
                </span>
              </div>
              {scraperStatus?.last_run && (
                <div className="text-xs font-mono text-gray-600 mt-0.5">
                  {new Date(scraperStatus.last_run).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => lock()}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-navy-800 transition-all"
                title="Lock app"
              >
                <Lock size={12} />
              </button>
              <button
                onClick={triggerScrape}
                disabled={scraperStatus?.running}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-navy-800 disabled:opacity-40 transition-all"
                title="Trigger manual scrape"
              >
                <RefreshCw size={14} className={scraperStatus?.running ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {showBalance && <BalanceModal onClose={() => setShowBalance(false)} />}
    </>
  );
}
