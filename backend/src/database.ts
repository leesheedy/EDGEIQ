import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import type {
  Event,
  Analysis,
  Bet,
  BankrollLog,
  LearningSnapshot,
  Setting,
  BankrollStats,
} from './types';

export const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export const db = {
  // Events
  async upsertEvent(event: Omit<Event, 'id'>): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .upsert(
        { ...event, scraped_at: new Date().toISOString() },
        { onConflict: 'tab_url,event_time' }
      )
      .select()
      .single();
    if (error) { console.error('upsertEvent error:', error); return null; }
    return data;
  },

  async getEvents(filters?: { sport?: string; limit?: number }): Promise<Event[]> {
    let query = supabase
      .from('events')
      .select('*')
      .gte('event_time', new Date().toISOString())
      .order('event_time', { ascending: true });

    if (filters?.sport) query = query.eq('sport', filters.sport);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) { console.error('getEvents error:', error); return []; }
    return data || [];
  },

  async getEvent(id: string): Promise<Event | null> {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  // Analyses
  async createAnalysis(analysis: Omit<Analysis, 'id' | 'created_at'>): Promise<Analysis | null> {
    const { data, error } = await supabase
      .from('analyses')
      .insert({ ...analysis, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { console.error('createAnalysis error:', error); return null; }
    return data;
  },

  async getAnalyses(filters?: { min_confidence?: number; limit?: number }): Promise<Analysis[]> {
    let query = supabase
      .from('analyses')
      .select('*, events(*)')
      .order('created_at', { ascending: false });

    if (filters?.min_confidence) query = query.gte('confidence', filters.min_confidence);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) { console.error('getAnalyses error:', error); return []; }
    return data || [];
  },

  async getPendingAnalyses(minConfidence: number): Promise<Analysis[]> {
    const { data, error } = await supabase
      .from('analyses')
      .select('*, events(*)')
      .gte('confidence', minConfidence)
      .not('id', 'in', `(SELECT analysis_id FROM bets WHERE analysis_id IS NOT NULL)`)
      .order('confidence', { ascending: false });

    if (error) { console.error('getPendingAnalyses error:', error); return []; }
    return data || [];
  },

  // Bets
  async createBet(bet: Omit<Bet, 'id'>): Promise<Bet | null> {
    const { data, error } = await supabase
      .from('bets')
      .insert(bet)
      .select('*, events(*), analyses(*)')
      .single();
    if (error) { console.error('createBet error:', error); return null; }
    return data;
  },

  async getBets(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
    sport?: string;
  }): Promise<Bet[]> {
    let query = supabase
      .from('bets')
      .select('*, events(*), analyses(*)')
      .order('placed_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);

    const { data, error } = await query;
    if (error) { console.error('getBets error:', error); return []; }
    return data || [];
  },

  async updateBet(id: string, updates: Partial<Bet>): Promise<Bet | null> {
    const { data, error } = await supabase
      .from('bets')
      .update(updates)
      .eq('id', id)
      .select('*, events(*), analyses(*)')
      .single();
    if (error) { console.error('updateBet error:', error); return null; }
    return data;
  },

  async settleBet(id: string, outcome: 'WON' | 'LOST' | 'VOID'): Promise<Bet | null> {
    const bet = await supabase.from('bets').select('*').eq('id', id).single();
    if (bet.error || !bet.data) return null;

    let profit_loss = 0;
    if (outcome === 'WON') {
      profit_loss = bet.data.stake * (bet.data.odds - 1);
    } else if (outcome === 'LOST') {
      profit_loss = -bet.data.stake;
    }

    return this.updateBet(id, {
      outcome,
      status: 'settled',
      settled_at: new Date().toISOString(),
      profit_loss,
    });
  },

  // Bankroll
  async getBankrollStats(): Promise<BankrollStats> {
    const { data: bets } = await supabase
      .from('bets')
      .select('stake, odds, outcome, profit_loss, status')
      .eq('status', 'settled');

    const settled = bets || [];
    const won = settled.filter((b) => b.outcome === 'WON');
    const lost = settled.filter((b) => b.outcome === 'LOST');
    const net_pnl = settled.reduce((sum, b) => sum + (b.profit_loss || 0), 0);

    const { data: logs } = await supabase
      .from('bankroll_log')
      .select('balance')
      .order('timestamp', { ascending: false })
      .limit(1);

    const current_balance = logs?.[0]?.balance || 0;
    const total_deposited = await this.getTotalDeposited();

    return {
      current_balance,
      total_deposited,
      net_pnl,
      roi_percent: total_deposited > 0 ? (net_pnl / total_deposited) * 100 : 0,
      win_streak: calculateStreak(settled, 'WON'),
      loss_streak: calculateStreak(settled, 'LOST'),
      total_bets: settled.length,
      won_bets: won.length,
      lost_bets: lost.length,
      win_rate: settled.length > 0 ? (won.length / settled.length) * 100 : 0,
    };
  },

  async getTotalDeposited(): Promise<number> {
    const { data } = await supabase
      .from('bankroll_log')
      .select('balance')
      .order('timestamp', { ascending: true })
      .limit(1);
    return data?.[0]?.balance || 0;
  },

  async logBankroll(balance: number, description: string): Promise<void> {
    await supabase.from('bankroll_log').insert({
      timestamp: new Date().toISOString(),
      balance,
      description,
    });
  },

  async getBankrollHistory(days = 30): Promise<BankrollLog[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await supabase
      .from('bankroll_log')
      .select('*')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true });
    return data || [];
  },

  // Settings
  async getSetting(key: string): Promise<string | null> {
    const { data } = await supabase.from('settings').select('value').eq('key', key).single();
    return data?.value || null;
  },

  async getAllSettings(): Promise<Record<string, string>> {
    const { data } = await supabase.from('settings').select('*');
    if (!data) return {};
    return Object.fromEntries(data.map((s: Setting) => [s.key, s.value]));
  },

  async setSetting(key: string, value: string): Promise<void> {
    await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' });
  },

  async setSettings(settings: Record<string, string>): Promise<void> {
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  },

  // Learning
  async getLearningSnapshots(): Promise<LearningSnapshot[]> {
    const { data } = await supabase
      .from('learning_snapshots')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },

  async createLearningSnapshot(
    snapshot: Omit<LearningSnapshot, 'id' | 'created_at'>
  ): Promise<void> {
    await supabase.from('learning_snapshots').insert({
      ...snapshot,
      created_at: new Date().toISOString(),
    });
  },

  async getRecentPerformanceSummary(): Promise<string> {
    const { data: bets } = await supabase
      .from('bets')
      .select('stake, odds, outcome, profit_loss, bet_type, events(sport)')
      .eq('status', 'settled')
      .order('settled_at', { ascending: false })
      .limit(50);

    if (!bets || bets.length === 0) return 'No settled bets yet.';

    const won = bets.filter((b) => b.outcome === 'WON').length;
    const lost = bets.filter((b) => b.outcome === 'LOST').length;
    const pnl = bets.reduce((s, b) => s + (b.profit_loss || 0), 0);

    const byType: Record<string, { w: number; l: number }> = {};
    for (const b of bets) {
      if (!byType[b.bet_type]) byType[b.bet_type] = { w: 0, l: 0 };
      if (b.outcome === 'WON') byType[b.bet_type].w++;
      if (b.outcome === 'LOST') byType[b.bet_type].l++;
    }

    const typeStr = Object.entries(byType)
      .map(([k, v]) => `${k}: ${v.w}W/${v.l}L`)
      .join(', ');

    return `Recent performance (last ${bets.length} bets): ${won}W/${lost}L. Net P&L: $${pnl.toFixed(2)}. By type: ${typeStr}.`;
  },
};

function calculateStreak(bets: Array<{ outcome?: string }>, type: string): number {
  let streak = 0;
  for (let i = bets.length - 1; i >= 0; i--) {
    if (bets[i].outcome === type) streak++;
    else break;
  }
  return streak;
}
