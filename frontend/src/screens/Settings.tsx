import React, { useEffect, useState } from 'react';
import { Save, TestTube, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { settingsApi } from '../lib/api';
import { clsx } from '../lib/utils';

interface FormState {
  // AI
  anthropic_api_key: string;
  // TAB
  tab_username: string;
  tab_password: string;
  // Thresholds
  confidence_threshold: string;
  sms_confidence_threshold: string;
  max_stake_percent: string;
  staking_mode: string;
  // Twilio
  sms_enabled: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_from: string;
  twilio_to: string;
  // App
  sound_enabled: string;
  scrape_interval_minutes: string;
  learning_enabled: string;
}

export function Settings() {
  const { settings, updateSettings, addToast } = useAppStore();
  const [form, setForm] = useState<FormState>({
    anthropic_api_key: '',
    tab_username: '',
    tab_password: '',
    confidence_threshold: '65',
    sms_confidence_threshold: '80',
    max_stake_percent: '5',
    staking_mode: 'kelly',
    sms_enabled: 'false',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from: '',
    twilio_to: '',
    sound_enabled: 'true',
    scrape_interval_minutes: '3',
    learning_enabled: 'true',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTabPw, setShowTabPw] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [testingSmS, setTestingSms] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm((f) => ({
        ...f,
        confidence_threshold: settings.confidence_threshold || '65',
        sms_confidence_threshold: settings.sms_confidence_threshold || '80',
        max_stake_percent: settings.max_stake_percent || '5',
        staking_mode: settings.staking_mode || 'kelly',
        sms_enabled: settings.sms_enabled || 'false',
        sound_enabled: settings.sound_enabled || 'true',
        scrape_interval_minutes: settings.scrape_interval_minutes || '3',
        learning_enabled: settings.learning_enabled || 'true',
      }));
    }
  }, [settings]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateSettings(form as unknown as Record<string, string>);
      addToast('success', 'Settings saved');
    } catch {
      addToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function testSms() {
    setTestingSms(true);
    setSmsTestResult(null);
    try {
      const result = await settingsApi.testSms({
        twilio_account_sid: form.twilio_account_sid,
        twilio_auth_token: form.twilio_auth_token,
        twilio_from: form.twilio_from,
        twilio_to: form.twilio_to,
      });
      setSmsTestResult(result);
    } catch (err) {
      setSmsTestResult({ success: false, error: String(err) });
    } finally {
      setTestingSms(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Settings</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-edge text-navy-950 rounded-xl text-sm font-display font-semibold hover:bg-green-dim disabled:opacity-50 transition-all"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* AI Section */}
        <Section title="AI Engine" subtitle="Anthropic Claude configuration">
          <Field label="Anthropic API Key">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={form.anthropic_api_key}
                onChange={(e) => set('anthropic_api_key', e.target.value)}
                placeholder={settings?.anthropic_key_set === 'true' ? '••••••••••• (key set)' : 'sk-ant-...'}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
        </Section>

        {/* TAB Section */}
        <Section title="TAB Australia" subtitle="Credentials for the automated scraper">
          <Field label="TAB Username / Email">
            <input
              type="text"
              value={form.tab_username}
              onChange={(e) => set('tab_username', e.target.value)}
              placeholder={settings?.tab_username_set === 'true' ? '(username set)' : 'your@email.com'}
              className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
            />
          </Field>
          <Field label="TAB Password">
            <div className="relative">
              <input
                type={showTabPw ? 'text' : 'password'}
                value={form.tab_password}
                onChange={(e) => set('tab_password', e.target.value)}
                placeholder={settings?.tab_username_set === 'true' ? '••••••••' : 'password'}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
              />
              <button
                type="button"
                onClick={() => setShowTabPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showTabPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
        </Section>

        {/* Bankroll & Thresholds */}
        <Section title="Bankroll & Staking" subtitle="Risk management configuration">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Confidence Threshold (%)">
              <input
                type="number"
                value={form.confidence_threshold}
                onChange={(e) => set('confidence_threshold', e.target.value)}
                min={50}
                max={95}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-green-edge/50"
              />
            </Field>
            <Field label="Max Stake (% bankroll)">
              <input
                type="number"
                value={form.max_stake_percent}
                onChange={(e) => set('max_stake_percent', e.target.value)}
                min={1}
                max={25}
                step={0.5}
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-green-edge/50"
              />
            </Field>
          </div>
          <Field label="Staking Mode">
            <div className="flex gap-2">
              {['kelly', 'flat'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('staking_mode', mode)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl text-sm font-mono capitalize transition-all',
                    form.staking_mode === mode
                      ? 'bg-green-edge/20 text-green-edge border border-green-edge/30'
                      : 'bg-navy-900 text-gray-400 border border-navy-600 hover:text-white'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Scraper */}
        <Section title="Scraper" subtitle="Data collection settings">
          <Field label="Scrape Interval (minutes)">
            <input
              type="number"
              value={form.scrape_interval_minutes}
              onChange={(e) => set('scrape_interval_minutes', e.target.value)}
              min={1}
              max={60}
              className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-green-edge/50"
            />
          </Field>
        </Section>

        {/* Twilio */}
        <Section title="SMS Alerts" subtitle="Twilio SMS for high-confidence bets">
          <Field label="">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set('sms_enabled', form.sms_enabled === 'true' ? 'false' : 'true')}
                className={clsx(
                  'w-10 h-5 rounded-full transition-all relative cursor-pointer',
                  form.sms_enabled === 'true' ? 'bg-green-edge' : 'bg-navy-700'
                )}
              >
                <div
                  className={clsx(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                    form.sms_enabled === 'true' ? 'left-5' : 'left-0.5'
                  )}
                />
              </div>
              <span className="text-sm text-gray-300">Enable SMS alerts</span>
            </label>
          </Field>

          {form.sms_enabled === 'true' && (
            <>
              <Field label="SMS Confidence Threshold (%)">
                <input
                  type="number"
                  value={form.sms_confidence_threshold}
                  onChange={(e) => set('sms_confidence_threshold', e.target.value)}
                  min={50}
                  max={100}
                  className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-green-edge/50"
                />
              </Field>
              <Field label="Account SID">
                <input
                  type="text"
                  value={form.twilio_account_sid}
                  onChange={(e) => set('twilio_account_sid', e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxx"
                  className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                />
              </Field>
              <Field label="Auth Token">
                <div className="relative">
                  <input
                    type={showTwilioToken ? 'text' : 'password'}
                    value={form.twilio_auth_token}
                    onChange={(e) => set('twilio_auth_token', e.target.value)}
                    placeholder="your auth token"
                    className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTwilioToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showTwilioToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From (Twilio number)">
                  <input
                    type="text"
                    value={form.twilio_from}
                    onChange={(e) => set('twilio_from', e.target.value)}
                    placeholder="+61400000000"
                    className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                  />
                </Field>
                <Field label="To (your number)">
                  <input
                    type="text"
                    value={form.twilio_to}
                    onChange={(e) => set('twilio_to', e.target.value)}
                    placeholder="+61400000001"
                    className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={testSms}
                  disabled={testingSmS || !form.twilio_account_sid}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 border border-navy-600 rounded-xl text-sm font-mono text-gray-300 hover:text-white disabled:opacity-50 transition-all"
                >
                  <TestTube size={14} />
                  {testingSmS ? 'Sending...' : 'Test SMS'}
                </button>
                {smsTestResult && (
                  <div
                    className={clsx(
                      'flex items-center gap-2 text-sm font-mono',
                      smsTestResult.success ? 'text-green-edge' : 'text-red-edge'
                    )}
                  >
                    {smsTestResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {smsTestResult.success ? 'SMS sent!' : smsTestResult.error}
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* App */}
        <Section title="Application" subtitle="UI preferences">
          <div className="flex flex-col gap-3">
            <Toggle
              label="Sound notifications"
              value={form.sound_enabled === 'true'}
              onChange={(v) => set('sound_enabled', v ? 'true' : 'false')}
            />
            <Toggle
              label="Learning system"
              value={form.learning_enabled === 'true'}
              onChange={(v) => set('learning_enabled', v ? 'true' : 'false')}
              description="Inject past performance into AI prompts"
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5">
      <h2 className="font-display font-semibold text-white text-base mb-0.5">{title}</h2>
      <p className="text-xs text-gray-500 font-mono mb-4">{subtitle}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-mono text-gray-400 mb-1.5">{label}</label>
      )}
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        {description && <div className="text-xs text-gray-600 font-mono">{description}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        className={clsx(
          'w-10 h-5 rounded-full transition-all relative cursor-pointer shrink-0',
          value ? 'bg-green-edge' : 'bg-navy-700'
        )}
      >
        <div
          className={clsx(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
            value ? 'left-5' : 'left-0.5'
          )}
        />
      </div>
    </label>
  );
}
