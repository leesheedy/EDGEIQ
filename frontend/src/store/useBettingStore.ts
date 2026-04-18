import { create } from 'zustand';
import type { Analysis, Bet, Event } from '../types';
import { analysesApi, betsApi, eventsApi } from '../lib/api';

interface BettingState {
  pending: Analysis[];
  activeBets: Bet[];
  events: Event[];
  isLoadingPending: boolean;
  isLoadingBets: boolean;
  isLoadingEvents: boolean;

  loadPending: () => Promise<void>;
  loadActiveBets: () => Promise<void>;
  loadEvents: (sport?: string) => Promise<void>;

  confirmBet: (analysis: Analysis) => Promise<Bet | null>;
  skipBet: (analysisId: string) => void;
  markPlaced: (betId: string) => Promise<void>;
  settleBet: (betId: string, outcome: 'WON' | 'LOST' | 'VOID') => Promise<void>;
  cancelBet: (betId: string) => Promise<void>;

  skippedIds: Set<string>;
}

export const useBettingStore = create<BettingState>((set, get) => ({
  pending: [],
  activeBets: [],
  events: [],
  isLoadingPending: false,
  isLoadingBets: false,
  isLoadingEvents: false,
  skippedIds: new Set(),

  loadPending: async () => {
    set({ isLoadingPending: true });
    try {
      const analyses = await analysesApi.pending();
      const { skippedIds } = get();
      set({ pending: analyses.filter((a) => !skippedIds.has(a.id)) });
    } catch (err) {
      console.error('loadPending error:', err);
    } finally {
      set({ isLoadingPending: false });
    }
  },

  loadActiveBets: async () => {
    set({ isLoadingBets: true });
    try {
      const bets = await betsApi.active();
      set({ activeBets: bets });
    } catch (err) {
      console.error('loadActiveBets error:', err);
    } finally {
      set({ isLoadingBets: false });
    }
  },

  loadEvents: async (sport?: string) => {
    set({ isLoadingEvents: true });
    try {
      const events = await eventsApi.list(sport);
      set({ events });
    } catch (err) {
      console.error('loadEvents error:', err);
    } finally {
      set({ isLoadingEvents: false });
    }
  },

  confirmBet: async (analysis: Analysis) => {
    try {
      const rec = analysis.ai_recommendation;
      const event = analysis.events;
      if (!event) return null;

      const bestOdds =
        event.raw_data?.runners?.[0]?.odds ||
        event.raw_data?.home_odds ||
        event.raw_data?.away_odds ||
        2.0;

      const bet = await betsApi.create({
        event_id: analysis.event_id,
        analysis_id: analysis.id,
        selection: rec.selection,
        odds: bestOdds,
        stake: rec.suggested_stake || analysis.suggested_stake,
        bet_type: rec.bet_type,
        tab_url: event.tab_url,
      });

      // Open TAB in new tab
      if (event.tab_url) {
        window.open(event.tab_url, '_blank', 'noopener,noreferrer');
      }

      // Remove from pending
      set((s) => ({ pending: s.pending.filter((a) => a.id !== analysis.id) }));

      return bet;
    } catch (err) {
      console.error('confirmBet error:', err);
      return null;
    }
  },

  skipBet: (analysisId: string) => {
    set((s) => ({
      pending: s.pending.filter((a) => a.id !== analysisId),
      skippedIds: new Set([...s.skippedIds, analysisId]),
    }));
  },

  markPlaced: async (betId: string) => {
    await betsApi.markPlaced(betId);
    set((s) => ({
      activeBets: s.activeBets.map((b) =>
        b.id === betId ? { ...b, status: 'placed' } : b
      ),
    }));
  },

  settleBet: async (betId: string, outcome: 'WON' | 'LOST' | 'VOID') => {
    await betsApi.settle(betId, outcome);
    set((s) => ({
      activeBets: s.activeBets.filter((b) => b.id !== betId),
    }));
  },

  cancelBet: async (betId: string) => {
    await betsApi.cancel(betId);
    set((s) => ({
      activeBets: s.activeBets.filter((b) => b.id !== betId),
    }));
  },
}));
