import twilio from 'twilio';
import { config } from '../config';
import { db } from '../database';
import type { Analysis } from '../types';

let smsEnabled = false;

export async function checkSmsEnabled(): Promise<boolean> {
  const val = await db.getSetting('sms_enabled');
  return val === 'true';
}

export async function sendSmsAlert(analysis: Analysis): Promise<boolean> {
  const enabled = await checkSmsEnabled();
  if (!enabled) return false;

  const sid = await db.getSetting('twilio_account_sid') || config.twilio.accountSid;
  const token = await db.getSetting('twilio_auth_token') || config.twilio.authToken;
  const from = await db.getSetting('twilio_from') || config.twilio.from;
  const to = await db.getSetting('twilio_to') || config.twilio.to;

  if (!sid || !token || !from || !to) {
    console.warn('Twilio not fully configured');
    return false;
  }

  const rec = analysis.ai_recommendation;
  const message = [
    `🎯 EdgeIQ Alert`,
    `${rec.recommendation}: ${rec.selection}`,
    `Confidence: ${rec.confidence_score}%`,
    `EV: ${(rec.expected_value * 100).toFixed(1)}%`,
    `Stake: $${rec.suggested_stake.toFixed(2)}`,
    `Bet type: ${rec.bet_type}`,
  ].join('\n');

  try {
    const client = twilio(sid, token);
    await client.messages.create({ body: message, from, to });
    console.log(`SMS sent for analysis ${analysis.id}`);
    return true;
  } catch (err) {
    console.error('SMS send failed:', err);
    return false;
  }
}

export async function testSms(
  sid: string,
  token: string,
  from: string,
  to: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = twilio(sid, token);
    await client.messages.create({
      body: '✅ EdgeIQ SMS test successful! Your alerts are configured correctly.',
      from,
      to,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function notifyHighConfidenceBets(
  analyses: Analysis[],
  smsThreshold: number
): Promise<void> {
  for (const analysis of analyses) {
    if (analysis.confidence >= smsThreshold) {
      await sendSmsAlert(analysis);
    }
  }
}
