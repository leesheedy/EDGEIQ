import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, Zap, LayoutDashboard, Clock, Camera, Activity, Settings } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';
import { healthApi } from '../lib/api';
import { clsx } from '../lib/utils';

const BOTTOM_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { to: '/pending', label: 'Bets', icon: Clock },
  { to: '/screenshot', label: 'Scan', icon: Camera, highlight: true },
  { to: '/active', label: 'Active', icon: Activity },
  { to: '/settings', label: 'More', icon: Settings },
];

export function Layout() {
  const { loadBankroll, loadSettings, loadScraperStatus, setBackendConnected, addToast } =
    useAppStore();
  const { loadPending, loadActiveBets, pending } = useBettingStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function init() {
      try {
        await healthApi.check();
        setBackendConnected(true);
        await Promise.allSettled([
          loadBankroll(),
          loadSettings(),
          loadScraperStatus(),
          loadPending(),
          loadActiveBets(),
        ]);
      } catch {
        setBackendConnected(false);
        addToast('warning', 'Backend offline — check your server');
      }
    }

    init();

    const interval = setInterval(() => {
      loadPending();
      loadBankroll();
      loadScraperStatus();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-[100dvh] bg-navy-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Fills the iOS status bar height so content sits below it */}
        <div className="lg:hidden bg-navy-900 shrink-0" style={{ height: 'env(safe-area-inset-top, 44px)' }} />

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-navy-700 bg-navy-900 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-3 -m-1 rounded-xl text-gray-400 hover:text-white hover:bg-navy-800 transition-all"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-edge flex items-center justify-center">
              <Zap size={12} className="text-navy-950" />
            </div>
            <span className="font-display font-bold text-white tracking-tight">
              Edge<span className="text-green-edge">IQ</span>
            </span>
          </div>
        </div>

        {/* Main content — extra bottom padding on mobile for bottom nav + safe area */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-navy-700 z-50 safe-area-bottom">
          <div className="flex items-stretch">
            {BOTTOM_NAV.map(({ to, label, icon: Icon, exact, highlight }) => {
              const isActive =
                exact ? location.pathname === to : location.pathname.startsWith(to);
              const pendingCount = label === 'Bets' ? pending.length : 0;

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  className="flex-1"
                >
                  <div
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all relative',
                      highlight
                        ? isActive
                          ? 'text-navy-950'
                          : 'text-navy-950'
                        : isActive
                        ? 'text-green-edge'
                        : 'text-gray-500'
                    )}
                  >
                    {highlight ? (
                      <div
                        className={clsx(
                          'w-12 h-12 rounded-2xl flex items-center justify-center -mt-6 shadow-lg transition-all',
                          isActive
                            ? 'bg-green-edge shadow-green-edge/40'
                            : 'bg-green-edge shadow-green-edge/30'
                        )}
                      >
                        <Icon size={22} className="text-navy-950" />
                      </div>
                    ) : (
                      <div className="relative">
                        <Icon size={20} />
                        {pendingCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-edge text-navy-950 text-[9px] font-bold flex items-center justify-center">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </div>
                    )}
                    <span
                      className={clsx(
                        'text-[10px] font-mono leading-none',
                        highlight ? 'text-gray-400 mt-1' : ''
                      )}
                    >
                      {label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>

      <ToastContainer />
    </div>
  );
}
