import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { PendingBets } from './screens/PendingBets';
import { Racing } from './screens/Racing';
import { Sports } from './screens/Sports';
import { Live } from './screens/Live';
import { Casino } from './screens/Casino';
import { ActiveBets } from './screens/ActiveBets';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';
import { ScreenshotAnalysis } from './screens/ScreenshotAnalysis';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { authenticated } = useAppStore();

  if (!authenticated) {
    return <Onboarding />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pending" element={<PendingBets />} />
        <Route path="/screenshot" element={<ScreenshotAnalysis />} />
        <Route path="/racing" element={<Racing />} />
        <Route path="/sports" element={<Sports />} />
        <Route path="/live" element={<Live />} />
        <Route path="/casino" element={<Casino />} />
        <Route path="/active" element={<ActiveBets />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
