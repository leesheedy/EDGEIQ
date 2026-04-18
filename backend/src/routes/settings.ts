import { Router } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { testSms } from '../services/notifications';

const router = Router();

// Safe keys — never return sensitive values to frontend directly
const SAFE_KEYS = [
  'confidence_threshold',
  'sms_confidence_threshold',
  'max_stake_percent',
  'staking_mode',
  'sms_enabled',
  'sound_enabled',
  'dark_mode',
  'scrape_interval_minutes',
  'starting_bankroll',
  'learning_enabled',
  'tab_username_set',
  'twilio_configured',
  'anthropic_key_set',
];

router.get('/', async (_req, res) => {
  const all = await db.getAllSettings();
  // Mask sensitive values
  const safe: Record<string, string> = {};
  for (const key of SAFE_KEYS) {
    if (all[key] !== undefined) safe[key] = all[key];
  }
  // Indicate if sensitive keys exist without exposing values
  safe.anthropic_key_set = all.anthropic_api_key ? 'true' : 'false';
  safe.tab_username_set = all.tab_username ? 'true' : 'false';
  safe.twilio_configured = (all.twilio_account_sid && all.twilio_from && all.twilio_to) ? 'true' : 'false';
  res.json({ data: safe });
});

router.put('/', async (req, res) => {
  const settings = req.body as Record<string, string>;

  // Validate numeric fields
  const numericFields = ['confidence_threshold', 'sms_confidence_threshold', 'max_stake_percent', 'scrape_interval_minutes', 'starting_bankroll', 'sms_confidence_threshold'];
  for (const field of numericFields) {
    if (settings[field] !== undefined && isNaN(Number(settings[field]))) {
      return res.status(400).json({ error: `${field} must be a number` });
    }
  }

  await db.setSettings(settings);
  res.json({ data: { updated: Object.keys(settings).length } });
});

router.post('/test-sms', async (req, res) => {
  const schema = z.object({
    twilio_account_sid: z.string(),
    twilio_auth_token: z.string(),
    twilio_from: z.string(),
    twilio_to: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { twilio_account_sid, twilio_auth_token, twilio_from, twilio_to } = parsed.data;
  const result = await testSms(twilio_account_sid, twilio_auth_token, twilio_from, twilio_to);
  res.json({ data: result });
});

export default router;
