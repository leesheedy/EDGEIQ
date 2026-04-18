import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';
import { healthApi } from '../lib/api';

export function Layout() {
  const { loadBankroll, loadSettings, loadScraperStatus, setBackendConnected, addToast } =
    useAppStore();
  const { loadPending, loadActiveBets } = useBettingStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-navy-700 bg-navy-900 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-800 transition-all"
          >
            <Menu size={20} />
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

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
