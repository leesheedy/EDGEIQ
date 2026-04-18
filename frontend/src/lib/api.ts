import type {
  Event,
  Analysis,
  Bet,
  BankrollStats,
  BankrollLog,
  Settings,
  ScraperStatus,
  LearningSnapshot,
  BetOutcome,
} from '../types';

const BASE = '/api';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data as T;
}

// Events
export const eventsApi = {
  list: (sport?: string) =>
    request<Event[]>(`/events${sport ? `?sport=${sport}` : ''}`),
  get: (id: string) => request<Event>(`/events/${id}`),
};

// Analyses
export const analysesApi = {
  list: (minConfidence?: number) =>
    request<Analysis[]>(`/analyses${minConfidence ? `?min_confidence=${minConfidence}` : ''}`),
  pending: () => request<Analysis[]>('/analyses/pending'),
  analyse: (eventId: string) =>
    request<Analysis>(`/analyses/analyse/${eventId}`, { method: 'POST' }),
};

// Bets
export const betsApi = {
  list: (status?: string) =>
    request<Bet[]>(`/bets${status ? `?status=${status}` : ''}`),
  active: () => request<Bet[]>('/bets/active'),
  history: (limit = 100, offset = 0) =>
    request<Bet[]>(`/bets/history?limit=${limit}&offset=${offset}`),
  create: (data: {
    event_id: string;
    analysis_id: string;
    selection: string;
    odds: number;
    stake: number;
    bet_type: string;
    tab_url?: string;
  }) => request<Bet>('/bets', { method: 'POST', body: JSON.stringify(data) }),
  markPlaced: (id: string) =>
    request<Bet>(`/bets/${id}/placed`, { method: 'PATCH' }),
  settle: (id: string, outcome: 'WON' | 'LOST' | 'VOID') =>
    request<Bet>(`/bets/${id}/settle`, {
      method: 'PATCH',
      body: JSON.stringify({ outcome }),
    }),
  cancel: (id: string) => request<Bet>(`/bets/${id}`, { method: 'DELETE' }),
};

// Bankroll
export const bankrollApi = {
  stats: () => request<BankrollStats>('/bankroll/stats'),
  history: (days = 30) => request<BankrollLog[]>(`/bankroll/history?days=${days}`),
  balance: () => request<{ balance: number }>('/bankroll/balance'),
  init: (amount: number) =>
    request<{ balance: number }>('/bankroll/init', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  deposit: (amount: number) =>
    request<{ balance: number }>('/bankroll/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

// Settings
export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (settings: Partial<Settings>) =>
    request<{ updated: number }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  testSms: (data: {
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_from: string;
    twilio_to: string;
  }) =>
    request<{ success: boolean; error?: string }>('/settings/test-sms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Learning
export const learningApi = {
  snapshots: () => request<LearningSnapshot[]>('/learning/snapshots'),
  calibration: () =>
    request<Array<{ confidence_bucket: number; actual_win_rate: number | null; sample_size: number }>>('/learning/calibration'),
  bySport: () =>
    request<Array<{ sport: string; wins: number; losses: number; total: number; win_rate: number; pnl: number; roi: number }>>('/learning/by-sport'),
  summary: () => request<{ summary: string }>('/learning/summary'),
};

// Scraper
export const scraperApi = {
  status: () => request<ScraperStatus>('/scraper/status'),
  trigger: () => request<ScraperStatus>('/scraper/trigger', { method: 'POST' }),
  errors: () => request<string[]>('/scraper/errors'),
};

// Health
export const healthApi = {
  check: () => request<{ status: string; timestamp: string }>('/health'),
};
