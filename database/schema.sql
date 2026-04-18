-- EdgeIQ Database Schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table: scraped market data
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport        TEXT NOT NULL,
  event_name   TEXT NOT NULL,
  event_time   TIMESTAMPTZ NOT NULL,
  market_type  TEXT NOT NULL,
  tab_url      TEXT NOT NULL,
  raw_data     JSONB NOT NULL DEFAULT '{}',
  enriched_data JSONB,
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tab_url, event_time)
);

CREATE INDEX IF NOT EXISTS idx_events_sport ON events(sport);
CREATE INDEX IF NOT EXISTS idx_events_event_time ON events(event_time);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at);

-- Analyses table: AI recommendations
CREATE TABLE IF NOT EXISTS analyses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ai_recommendation JSONB NOT NULL DEFAULT '{}',
  confidence        NUMERIC(5,2) NOT NULL DEFAULT 0,
  ev                NUMERIC(8,4) NOT NULL DEFAULT 0,
  suggested_stake   NUMERIC(10,2) NOT NULL DEFAULT 0,
  reasoning         TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_event_id ON analyses(event_id);
CREATE INDEX IF NOT EXISTS idx_analyses_confidence ON analyses(confidence);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);

-- Bets table: confirmed and placed bets
CREATE TABLE IF NOT EXISTS bets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  selection   TEXT NOT NULL,
  odds        NUMERIC(8,2) NOT NULL,
  stake       NUMERIC(10,2) NOT NULL,
  bet_type    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending_confirmation'
              CHECK (status IN ('pending_confirmation','confirmed','placed','settled','void')),
  placed_at   TIMESTAMPTZ,
  settled_at  TIMESTAMPTZ,
  outcome     TEXT CHECK (outcome IN ('WON','LOST','VOID') OR outcome IS NULL),
  profit_loss NUMERIC(10,2),
  tab_url     TEXT
);

CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_placed_at ON bets(placed_at);
CREATE INDEX IF NOT EXISTS idx_bets_outcome ON bets(outcome);

-- Bankroll log: balance history
CREATE TABLE IF NOT EXISTS bankroll_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  balance     NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_bankroll_log_timestamp ON bankroll_log(timestamp);

-- Learning snapshots: periodic performance summaries
CREATE TABLE IF NOT EXISTS learning_snapshots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport       TEXT NOT NULL,
  bet_type    TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  win_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_ev      NUMERIC(8,4) NOT NULL DEFAULT 0,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings: key/value store
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('confidence_threshold', '65'),
  ('sms_confidence_threshold', '80'),
  ('max_stake_percent', '5'),
  ('staking_mode', 'kelly'),
  ('sms_enabled', 'false'),
  ('sound_enabled', 'true'),
  ('dark_mode', 'true'),
  ('scrape_interval_minutes', '3'),
  ('starting_bankroll', '0'),
  ('learning_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Row Level Security (optional for single-user setup)
-- Enable if using Supabase Auth
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bankroll_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE learning_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Grant access to service role (for backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
