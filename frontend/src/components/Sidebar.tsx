import React from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { clsx, formatCurrency } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';

const NAV: Array<{ to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; exact?: boolean; pulse?: boolean }> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/live', label: 'Live', icon: Radio, pulse: true },
  { to: '/pending', label: 'Pending Bets', icon: Clock },
  { to: '/racing', label: 'Racing', icon: Flag },
  { to: '/sports', label: 'Sports', icon: Gamepad2 },
  { to: '/active', label: 'Active Bets', icon: Activity },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { bankrollStats, backendConnected, triggerScrape, scraperStatus } = useAppStore();
  const { pending } = useBettingStore();

  return (
    <aside className="w-56 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-navy-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-edge flex items-center justify-center">
            <Zap size={14} className="text-navy-950" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Edge<span className="text-green-edge">IQ</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
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

      {/* Bankroll summary */}
      {bankrollStats && (
        <div className="px-4 py-3 border-b border-navy-700">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">
            Bankroll
          </div>
          <div className="font-display font-bold text-lg text-white">
            {formatCurrency(bankrollStats.current_balance)}
          </div>
          <div
            className={clsx(
              'text-xs font-mono',
              bankrollStats.net_pnl >= 0 ? 'text-green-edge' : 'text-red-edge'
            )}
          >
            {bankrollStats.net_pnl >= 0 ? '+' : ''}
            {formatCurrency(bankrollStats.net_pnl)} P&L
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, exact, pulse }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
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
        ))}
      </nav>

      {/* Scraper status + trigger */}
      <div className="px-4 py-3 border-t border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <div
                className={clsx(
                  'w-2 h-2 rounded-full',
                  scraperStatus?.running ? 'bg-green-edge animate-pulse' : 'bg-gray-600'
                )}
              />
              <span className="text-xs font-mono text-gray-500">
                {scraperStatus?.running ? 'Scraping...' : 'Scraper idle'}
              </span>
            </div>
            {scraperStatus?.last_run && (
              <div className="text-xs font-mono text-gray-600 mt-0.5">
                {new Date(scraperStatus.last_run).toLocaleTimeString('en-AU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
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
    </aside>
  );
}
