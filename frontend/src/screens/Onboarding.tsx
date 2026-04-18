import React, { useState } from 'react';
import { Zap, ChevronRight, DollarSign, Key, MessageSquare, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { bankrollApi, settingsApi } from '../lib/api';
import { clsx } from '../lib/utils';

type Step = 'welcome' | 'bankroll' | 'api_key' | 'twilio' | 'done';

export function Onboarding() {
  const { setOnboardingComplete, addToast } = useAppStore();
  const [step, setStep] = useState<Step>('welcome');
  const [bankroll, setBankroll] = useState('1000');
  const [apiKey, setApiKey] = useState('');
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [twilioData, setTwilioData] = useState({
    sid: '',
    token: '',
    from: '',
    to: '',
  });
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      const amount = parseFloat(bankroll);
      if (!isNaN(amount) && amount > 0) {
        await bankrollApi.init(amount);
      }

      const settings: Record<string, string> = {};
      if (apiKey) settings.anthropic_api_key = apiKey;
      if (twilioEnabled && twilioData.sid) {
        settings.twilio_account_sid = twilioData.sid;
        settings.twilio_auth_token = twilioData.token;
        settings.twilio_from = twilioData.from;
        settings.twilio_to = twilioData.to;
        settings.sms_enabled = 'true';
      }
      if (Object.keys(settings).length > 0) {
        await settingsApi.update(settings);
      }

      setOnboardingComplete(true);
    } catch (err) {
      addToast('error', 'Setup failed — you can configure this in Settings later');
      setOnboardingComplete(true);
    } finally {
      setSaving(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'bankroll', label: 'Bankroll' },
    { key: 'api_key', label: 'API Key' },
    { key: 'twilio', label: 'SMS' },
    { key: 'done', label: 'Ready' },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-green-edge flex items-center justify-center">
            <Zap size={20} className="text-navy-950" />
          </div>
          <span className="font-display font-bold text-3xl text-white">
            Edge<span className="text-green-edge">IQ</span>
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                className={clsx(
                  'w-2 h-2 rounded-full transition-all',
                  i === stepIndex
                    ? 'bg-green-edge w-4'
                    : i < stepIndex
                    ? 'bg-green-edge/50'
                    : 'bg-navy-700'
                )}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-7 animate-slide-up">
          {step === 'welcome' && (
            <div className="text-center">
              <h1 className="font-display font-bold text-2xl text-white mb-3">
                Welcome to EdgeIQ
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                AI-powered betting analysis for Australian markets. We'll fetch odds from TAB,
                run them through Claude AI, and surface high-value opportunities — with full
                reasoning and Kelly criterion staking.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                {[
                  { icon: '🏇', label: 'Racing' },
                  { icon: '⚽', label: 'Sports' },
                  { icon: '🧠', label: 'AI Analysis' },
                ].map(({ icon, label }) => (
                  <div key={label} className="bg-navy-900 rounded-xl p-3">
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="text-xs font-mono text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep('bankroll')}
                className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold hover:bg-green-dim transition-all"
              >
                Get Started →
              </button>
            </div>
          )}

          {step === 'bankroll' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-edge/20 flex items-center justify-center">
                  <DollarSign size={16} className="text-green-edge" />
                </div>
                <h2 className="font-display font-bold text-xl text-white">Set Your Bankroll</h2>
              </div>
              <p className="text-gray-500 text-sm font-mono mb-5">
                Your starting betting bankroll. Used for Kelly criterion staking calculations.
                You can change this any time in Settings.
              </p>
              <div className="relative mb-5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">
                  $
                </span>
                <input
                  type="number"
                  value={bankroll}
                  onChange={(e) => setBankroll(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-navy-900 border border-navy-600 rounded-xl pl-7 pr-3 py-3 text-white font-mono text-lg focus:outline-none focus:border-green-edge/50"
                  min={0}
                />
              </div>
              <div className="flex gap-2 mb-5">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBankroll(String(amt))}
                    className="flex-1 py-2 bg-navy-900 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-navy-700 transition-all"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('api_key')}
                className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold hover:bg-green-dim transition-all flex items-center justify-center gap-2"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}

          {step === 'api_key' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-edge/20 flex items-center justify-center">
                  <Key size={16} className="text-green-edge" />
                </div>
                <h2 className="font-display font-bold text-xl text-white">Anthropic API Key</h2>
              </div>
              <p className="text-gray-500 text-sm font-mono mb-5">
                Required for AI analysis. Get your key from console.anthropic.com.
                Stored securely on the backend — never sent to the browser.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-green-edge/50 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('twilio')}
                  className="flex-1 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => setStep('twilio')}
                  className="flex-1 py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold hover:bg-green-dim transition-all"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 'twilio' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-edge/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-green-edge" />
                </div>
                <h2 className="font-display font-bold text-xl text-white">SMS Alerts</h2>
              </div>
              <p className="text-gray-500 text-sm font-mono mb-4">
                Optional: Receive SMS when a high-confidence bet is found.
                Requires a free Twilio account (twilio.com).
              </p>
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <div
                  onClick={() => setTwilioEnabled((v) => !v)}
                  className={clsx(
                    'w-10 h-5 rounded-full transition-all relative',
                    twilioEnabled ? 'bg-green-edge' : 'bg-navy-700'
                  )}
                >
                  <div
                    className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                      twilioEnabled ? 'left-5' : 'left-0.5'
                    )}
                  />
                </div>
                <span className="text-sm text-gray-300">Enable SMS alerts</span>
              </label>
              {twilioEnabled && (
                <div className="flex flex-col gap-2 mb-4">
                  {['sid', 'token', 'from', 'to'].map((key) => (
                    <input
                      key={key}
                      type={key === 'token' ? 'password' : 'text'}
                      value={twilioData[key as keyof typeof twilioData]}
                      onChange={(e) =>
                        setTwilioData((d) => ({ ...d, [key]: e.target.value }))
                      }
                      placeholder={
                        key === 'sid'
                          ? 'Account SID (ACxxxx)'
                          : key === 'token'
                          ? 'Auth Token'
                          : key === 'from'
                          ? 'From (+61400000000)'
                          : 'To (your number)'
                      }
                      className="w-full bg-navy-900 border border-navy-600 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-edge/50"
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('done')}
                  className="flex-1 py-3 bg-navy-900 border border-navy-600 text-gray-400 rounded-xl font-mono text-sm hover:text-white transition-all"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep('done')}
                  className="flex-1 py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold hover:bg-green-dim transition-all"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-edge/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-edge" />
              </div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                You're all set!
              </h2>
              <p className="text-gray-400 text-sm font-mono mb-6">
                EdgeIQ is ready. The scraper will start collecting odds, and AI analysis
                will surface opportunities for you. Check the Dashboard to get started.
              </p>
              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-3 bg-green-edge text-navy-950 rounded-xl font-display font-bold hover:bg-green-dim disabled:opacity-50 transition-all"
              >
                {saving ? 'Setting up...' : 'Launch EdgeIQ →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
