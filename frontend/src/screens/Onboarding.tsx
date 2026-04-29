import React, { useState, useRef } from 'react';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { clsx } from '../lib/utils';

const APP_PASSWORD = '1530';

export function Onboarding() {
  const { unlock } = useAppStore();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      unlock();
    } else {
      setError('Incorrect password');
      setPassword('');
      inputRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-green-edge flex items-center justify-center shadow-lg shadow-green-edge/30">
            <Zap size={28} className="text-navy-950" />
          </div>
          <span className="font-display font-bold text-4xl text-white tracking-tight">
            Edge<span className="text-green-edge">IQ</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              autoFocus
              className="w-full bg-navy-800 border border-navy-700 rounded-2xl px-4 py-4 text-white font-mono text-xl text-center placeholder-gray-600 focus:outline-none focus:border-green-edge/50 pr-12 tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-edge text-sm font-mono text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!password}
            className={clsx(
              'w-full py-4 rounded-2xl font-display font-bold text-lg transition-all',
              !password
                ? 'bg-navy-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-edge text-navy-950 hover:bg-green-dim active:scale-95'
            )}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
