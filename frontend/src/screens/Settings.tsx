import React, { useEffect, useState } from 'react';
import { Save, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw, TestTube, Database, Lock, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { settingsApi, scraperApi } from '../lib/api';
import { clsx } from '../lib/utils';

interface FormState {
  anthropic_api_key: string;
  tab_username: string;
  tab_password: string;
  odds_api_key: string;
  betfair_app_key: string;
  betfair_username: string;
  betfair_password: string;
  confidence_threshold: string;
  sms_confidence_threshold: string;
  max_stake_percent: string;
  staking_mode: string;
  sms_enabled: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_from: string;
  twilio_to: string;
  sound_enabled: string;
  scrape_interval_minutes: string;
  learning_enabled: string;
}

const DEFAULTS: FormState = {
  anthropic_api_key: '',
  tab_username: '',
  tab_password: '',
  odds_api_key: '',
  betfair_app_key: '',
  betfair_username: '',
  betfair_password: '',
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
};

const INPUT = 'w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50';

export function Settings() {
  const { settings, updateSettings, addToast, scraperStatus, loadScraperStatus, lock } = useAppStore();
  const [scraperErrors, setScraperErrors] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [testingSmS, setTestingSmS] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    scraperApi.errors().then(setScraperErrors).catch(() => {});
    loadScraperStatus();
  }, []);

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

  function toggleShow(key: string) {
    setShow((v) => ({ ...v, [key]: !v[key] }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateSettings(form as unknown as Record<string, string>);
      addToast('success', 'Settings saved to Supabase');
    } catch {
      addToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function hardRefresh() {
    setRefreshing(true);
    try {
      // Unregister any service workers so the next load fetches fresh assets
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // Clear all caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  }

  async function testSms() {
    setTestingSmS(true);
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
      setTestingSmS(false);
    }
  }

  const isSet = (flag: string) => settings?.[flag] === 'true';

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Settings</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Database size={11} className="text-green-edge" />
            <p className="text-xs text-gray-500 font-mono">All keys saved to Supabase</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-edge text-navy-950 rounded-xl text-sm font-display font-semibold hover:bg-green-dim disabled:opacity-50 transition-all"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      <div className="flex flex-col gap-4">

        {/* AI Engine */}
        <Card title="AI Engine" ok={isSet('anthropic_key_set')}>
          <Field label="Anthropic API Key" note="console.anthropic.com" ok={isSet('anthropic_key_set')}>
            <PwInput
              value={form.anthropic_api_key}
              onChange={(v) => set('anthropic_api_key', v)}
              placeholder={isSet('anthropic_key_set') ? '••••••••• (key saved in Supabase)' : 'sk-ant-api03-...'}
              visible={!!show.anthropic}
              onToggle={() => toggleShow('anthropic')}
            />
          </Field>
        </Card>

        {/* TAB Australia */}
        <Card title="TAB Australia" ok={isSet('tab_username_set')}>
          <p className="text-xs text-gray-600 font-mono -mt-2 mb-2">
            Playwright scraper uses these to fetch live odds.
          </p>
          <Field label="Email / Username" ok={isSet('tab_username_set')}>
            <input
              type="text"
              value={form.tab_username}
              onChange={(e) => set('tab_username', e.target.value)}
              placeholder={isSet('tab_username_set') ? '(saved)' : 'your@email.com'}
              className={INPUT}
            />
          </Field>
          <Field label="Password">
            <PwInput
              value={form.tab_password}
              onChange={(v) => set('tab_password', v)}
              placeholder={isSet('tab_username_set') ? '(saved)' : 'password'}
              visible={!!show.tab_pw}
              onToggle={() => toggleShow('tab_pw')}
            />
          </Field>
        </Card>

        {/* Data Sources */}
        <Card title="Data Sources">
          <p className="text-xs text-gray-600 font-mono -mt-2 mb-2">
            Optional — supplements AI analysis with live odds data.
          </p>
          <Field label="The Odds API Key" note="the-odds-api.com" ok={isSet('odds_api_key_set')}>
            <PwInput
              value={form.odds_api_key}
              onChange={(v) => set('odds_api_key', v)}
              placeholder={isSet('odds_api_key_set') ? '(key saved)' : 'api-key...'}
              visible={!!show.odds}
              onToggle={() => toggleShow('odds')}
            />
          </Field>
          <Field label="BetFair App Key" note="developer.betfair.com" ok={isSet('betfair_key_set')}>
            <PwInput
              value={form.betfair_app_key}
              onChange={(v) => set('betfair_app_key', v)}
              placeholder={isSet('betfair_key_set') ? '(key saved)' : 'app-key...'}
              visible={!!show.betfair}
              onToggle={() => toggleShow('betfair')}
            />
          </Field>
          {(form.betfair_app_key || isSet('betfair_key_set')) && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="BetFair Username">
                <input type="text" value={form.betfair_username} onChange={(e) => set('betfair_username', e.target.value)} placeholder="username" className={INPUT} />
              </Field>
              <Field label="BetFair Password">
                <PwInput value={form.betfair_password} onChange={(v) => set('betfair_password', v)} placeholder="password" visible={!!show.bf_pw} onToggle={() => toggleShow('bf_pw')} />
              </Field>
            </div>
          )}
        </Card>

        {/* Bankroll & Staking */}
        <Card title="Bankroll & Staking">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Confidence Threshold (%)">
              <input type="number" value={form.confidence_threshold} onChange={(e) => set('confidence_threshold', e.target.value)} min={50} max={95} className={INPUT} />
            </Field>
            <Field label="Max Stake (% bankroll)">
              <input type="number" value={form.max_stake_percent} onChange={(e) => set('max_stake_percent', e.target.value)} min={1} max={25} step={0.5} className={INPUT} />
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
        </Card>

        {/* Scraper */}
        <Card title="Scraper">
          <div className="flex items-center gap-2 mb-3">
            <div className={clsx('w-2 h-2 rounded-full shrink-0', scraperStatus?.running ? 'bg-green-edge animate-pulse' : 'bg-gray-600')} />
            <span className="text-xs font-mono text-gray-400">
              {scraperStatus?.running ? 'Running...' : scraperStatus?.last_run
                ? `Last: ${new Date(scraperStatus.last_run).toLocaleTimeString('en-AU')}`
                : 'Never run'}
              {scraperStatus?.events_scraped !== undefined && !scraperStatus.running ? ` · ${scraperStatus.events_scraped} events` : ''}
            </span>
            <button onClick={() => { scraperApi.errors().then(setScraperErrors).catch(() => {}); loadScraperStatus(); }} className="ml-auto p-1 rounded text-gray-600 hover:text-white">
              <RefreshCw size={13} />
            </button>
          </div>
          {scraperErrors.map((err, i) => (
            <div key={i} className="mb-2 bg-red-edge/10 border border-red-edge/20 rounded-xl px-3 py-2 text-xs font-mono text-red-400 break-all">{err}</div>
          ))}
          <Field label="Scrape Interval (minutes)">
            <input type="number" value={form.scrape_interval_minutes} onChange={(e) => set('scrape_interval_minutes', e.target.value)} min={1} max={60} className={INPUT} />
          </Field>
        </Card>

        {/* SMS Alerts */}
        <Card title="SMS Alerts" ok={isSet('twilio_configured')}>
          <Toggle label="Enable SMS alerts" description="Twilio SMS for high-confidence bets" value={form.sms_enabled === 'true'} onChange={(v) => set('sms_enabled', v ? 'true' : 'false')} />
          {form.sms_enabled === 'true' && (
            <>
              <Field label="SMS Confidence Threshold (%)">
                <input type="number" value={form.sms_confidence_threshold} onChange={(e) => set('sms_confidence_threshold', e.target.value)} min={50} max={100} className={INPUT} />
              </Field>
              <Field label="Twilio Account SID">
                <input type="text" value={form.twilio_account_sid} onChange={(e) => set('twilio_account_sid', e.target.value)} placeholder="ACxxxxxx" className={INPUT} />
              </Field>
              <Field label="Twilio Auth Token">
                <PwInput value={form.twilio_auth_token} onChange={(v) => set('twilio_auth_token', v)} placeholder="auth token" visible={!!show.twilio_token} onToggle={() => toggleShow('twilio_token')} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From (Twilio #)">
                  <input type="text" value={form.twilio_from} onChange={(e) => set('twilio_from', e.target.value)} placeholder="+61400000000" className={INPUT} />
                </Field>
                <Field label="To (your #)">
                  <input type="text" value={form.twilio_to} onChange={(e) => set('twilio_to', e.target.value)} placeholder="+61400000001" className={INPUT} />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={testSms} disabled={testingSmS || !form.twilio_account_sid} className="flex items-center gap-2 px-4 py-2 bg-navy-900 border border-navy-600 rounded-xl text-sm font-mono text-gray-300 hover:text-white disabled:opacity-50 transition-all">
                  <TestTube size={14} />
                  {testingSmS ? 'Sending...' : 'Test SMS'}
                </button>
                {smsTestResult && (
                  <span className={clsx('flex items-center gap-1.5 text-sm font-mono', smsTestResult.success ? 'text-green-edge' : 'text-red-edge')}>
                    {smsTestResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {smsTestResult.success ? 'SMS sent!' : smsTestResult.error}
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        {/* App */}
        <Card title="Application">
          <Toggle label="Sound notifications" value={form.sound_enabled === 'true'} onChange={(v) => set('sound_enabled', v ? 'true' : 'false')} />
          <Toggle label="Learning system" description="Inject past performance into AI prompts" value={form.learning_enabled === 'true'} onChange={(v) => set('learning_enabled', v ? 'true' : 'false')} />
        </Card>

        {/* Session */}
        <Card title="Session">
          <button
            onClick={hardRefresh}
            disabled={refreshing}
            className="flex items-center gap-3 w-full px-4 py-3 bg-navy-900 border border-navy-600 rounded-xl text-sm font-mono text-gray-300 hover:text-white hover:border-navy-500 transition-all"
          >
            <RotateCcw size={16} className={refreshing ? 'animate-spin text-green-edge' : 'text-gray-500'} />
            <div className="text-left">
              <div>{refreshing ? 'Refreshing…' : 'Check for updates'}</div>
              <div className="text-xs text-gray-600 mt-0.5">Clears cache and reloads the latest version</div>
            </div>
          </button>
          <button
            onClick={lock}
            className="flex items-center gap-3 w-full px-4 py-3 bg-navy-900 border border-navy-600 rounded-xl text-sm font-mono text-gray-300 hover:text-red-400 hover:border-red-edge/30 transition-all"
          >
            <Lock size={16} className="text-gray-500" />
            <div className="text-left">
              <div>Lock app</div>
              <div className="text-xs text-gray-600 mt-0.5">Returns to PIN screen</div>
            </div>
          </button>
        </Card>

      </div>
    </div>
  );
}

function Card({ title, ok, children }: { title: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display font-semibold text-white text-base">{title}</h2>
        {ok !== undefined && (
          ok
            ? <CheckCircle size={14} className="text-green-edge ml-auto" />
            : <AlertCircle size={14} className="text-gray-600 ml-auto" />
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, note, ok, children }: { label?: string; note?: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-mono text-gray-400">{label}</label>
          {note && <span className="text-xs font-mono text-gray-600">{note}</span>}
          {ok !== undefined && (
            <span className={clsx('text-xs font-mono', ok ? 'text-green-edge' : 'text-gray-600')}>
              {ok ? '✓ saved' : 'not set'}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function PwInput({ value, onChange, placeholder, visible, onToggle }: {
  value: string; onChange: (v: string) => void; placeholder?: string; visible: boolean; onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={clsx(INPUT, 'pr-10')} />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function Toggle({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        {description && <div className="text-xs text-gray-600 font-mono">{description}</div>}
      </div>
      <div onClick={() => onChange(!value)} className={clsx('w-10 h-5 rounded-full transition-all relative cursor-pointer shrink-0 ml-4', value ? 'bg-green-edge' : 'bg-navy-700')}>
        <div className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', value ? 'left-5' : 'left-0.5')} />
      </div>
    </label>
  );
}
