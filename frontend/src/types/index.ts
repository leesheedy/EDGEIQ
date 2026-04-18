export type Sport =
  | 'horse_racing_thoroughbred'
  | 'horse_racing_harness'
  | 'horse_racing_greyhound'
  | 'nrl'
  | 'afl'
  | 'soccer'
  | 'nba'
  | 'cricket'
  | 'tennis'
  | 'rugby'
  | 'other';

export type BetType =
  | 'win'
  | 'place'
  | 'each_way'
  | 'quinella'
  | 'exacta'
  | 'trifecta'
  | 'first4'
  | 'same_game_multi'
  | 'multi'
  | 'head_to_head'
  | 'line'
  | 'total';

export type Recommendation = 'BET' | 'SKIP' | 'WATCH';
export type BetStatus = 'pending_confirmation' | 'confirmed' | 'placed' | 'settled' | 'void';
export type BetOutcome = 'WON' | 'LOST' | 'VOID' | null;

export interface Runner {
  name: string;
  barrier?: number;
  jockey?: string;
  trainer?: string;
  weight?: number;
  odds: number;
  place_odds?: number;
  form?: string[];
  class?: string;
}

export interface RawEventData {
  runners?: Runner[];
  market_type: string;
  track_condition?: string;
  distance?: number;
  weather?: string;
  home_team?: string;
  away_team?: string;
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
  line?: number;
  total?: number;
  venue?: string;
  state?: string;
  race_number?: number;
}

export interface EnrichedData {
  form_last_10?: string[];
  h2h_record?: string;
  injuries?: string[];
  home_away_record?: string;
  track_bias?: string;
  barrier_stats?: Record<number, number>;
  speed_map?: string;
  weather_impact?: string;
}

export interface Event {
  id: string;
  sport: Sport;
  event_name: string;
  event_time: string;
  market_type: string;
  tab_url: string;
  raw_data: RawEventData;
  enriched_data?: EnrichedData;
  scraped_at: string;
}

export interface AiRecommendation {
  recommendation: Recommendation;
  bet_type: BetType;
  selection: string;
  confidence_score: number;
  expected_value: number;
  suggested_stake: number;
  reasoning: string;
  risk_flags: string[];
  learn_notes: string;
  legs?: string[];
}

export interface Analysis {
  id: string;
  event_id: string;
  ai_recommendation: AiRecommendation;
  confidence: number;
  ev: number;
  suggested_stake: number;
  reasoning: string;
  created_at: string;
  events?: Event;
}

export interface Bet {
  id: string;
  event_id: string;
  analysis_id: string;
  selection: string;
  odds: number;
  stake: number;
  bet_type: BetType;
  status: BetStatus;
  placed_at?: string;
  settled_at?: string;
  outcome?: BetOutcome;
  profit_loss?: number;
  tab_url?: string;
  events?: Event;
  analyses?: Analysis;
}

export interface BankrollLog {
  id: string;
  timestamp: string;
  balance: number;
  description: string;
}

export interface BankrollStats {
  current_balance: number;
  total_deposited: number;
  net_pnl: number;
  roi_percent: number;
  win_streak: number;
  loss_streak: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  win_rate: number;
}

export interface LearningSnapshot {
  id: string;
  sport: string;
  bet_type: string;
  sample_size: number;
  win_rate: number;
  avg_ev: number;
  notes: string;
  created_at: string;
}

export interface ScraperStatus {
  running: boolean;
  last_run?: string;
  next_run?: string;
  events_scraped: number;
  errors: string[];
}

export interface Settings {
  confidence_threshold: string;
  sms_confidence_threshold: string;
  max_stake_percent: string;
  staking_mode: string;
  sms_enabled: string;
  sound_enabled: string;
  dark_mode: string;
  scrape_interval_minutes: string;
  starting_bankroll: string;
  learning_enabled: string;
  anthropic_key_set: string;
  tab_username_set: string;
  twilio_configured: string;
  [key: string]: string;
}
