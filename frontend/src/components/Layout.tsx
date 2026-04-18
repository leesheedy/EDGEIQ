import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { useAppStore } from '../store/useAppStore';
import { useBettingStore } from '../store/useBettingStore';
import { healthApi } from '../lib/api';

export function Layout() {
  const { loadBankroll, loadSettings, loadScraperStatus, setBackendConnected, addToast } =
    useAppStore();
  const { loadPending, loadActiveBets } = useBettingStore();

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

    // Poll for new data every 60 seconds
    const interval = setInterval(() => {
      loadPending();
      loadBankroll();
      loadScraperStatus();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
