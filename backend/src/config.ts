import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-5',
  },

  tab: {
    username: process.env.TAB_USERNAME || '',
    password: process.env.TAB_PASSWORD || '',
    baseUrl: 'https://www.tab.com.au',
  },

  oddsApi: {
    key: process.env.ODDS_API_KEY || '',
    baseUrl: 'https://api.the-odds-api.com/v4',
  },

  betfair: {
    appKey: process.env.BETFAIR_APP_KEY || '',
    username: process.env.BETFAIR_USERNAME || '',
    password: process.env.BETFAIR_PASSWORD || '',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
    to: process.env.TWILIO_TO || '',
  },

  scraping: {
    intervalMinutes: parseInt(process.env.SCRAPE_INTERVAL_MINUTES || '3', 10),
  },

  thresholds: {
    confidence: parseInt(process.env.CONFIDENCE_THRESHOLD || '65', 10),
    smsConfidence: parseInt(process.env.SMS_CONFIDENCE_THRESHOLD || '80', 10),
  },

  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
};

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.supabase.url) errors.push('SUPABASE_URL is required');
  if (!config.supabase.serviceKey) errors.push('SUPABASE_SERVICE_KEY is required');
  if (!config.anthropic.apiKey) errors.push('ANTHROPIC_API_KEY is required');
  return errors;
}
