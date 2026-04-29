import React, { useState, useEffect } from 'react';
import { Zap, Delete } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { clsx } from '../lib/utils';

const APP_PASSWORD = '1530';
const PIN_LENGTH = 4;

const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

export function Onboarding() {
  const { unlock } = useAppStore();
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      if (digits === APP_PASSWORD) {
        unlock();
      } else {
        setShake(true);
        setError('Try again');
        setTimeout(() => {
          setDigits('');
          setShake(false);
          setError('');
        }, 600);
      }
    }
  }, [digits]);

  function press(key: string) {
    if (shake) return;
    if (key === 'del') {
      setDigits(d => d.slice(0, -1));
      setError('');
    } else if (digits.length < PIN_LENGTH) {
      setDigits(d => d + key);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-navy-950 flex flex-col items-center justify-center p-6 select-none" style={{ paddingTop: 'max(env(safe-area-inset-top, 44px), 24px)' }}>
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-14">
        <div className="w-16 h-16 rounded-2xl bg-green-edge flex items-center justify-center shadow-lg shadow-green-edge/30">
          <Zap size={28} className="text-navy-950" />
        </div>
        <span className="font-display font-bold text-4xl text-white tracking-tight">
          Edge<span className="text-green-edge">IQ</span>
        </span>
      </div>

      {/* PIN dots */}
      <div className={clsx('flex gap-5 mb-3 transition-transform', shake && 'animate-shake')}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'w-4 h-4 rounded-full border-2 transition-all duration-150',
              i < digits.length
                ? 'bg-green-edge border-green-edge scale-110'
                : 'bg-transparent border-navy-600'
            )}
          />
        ))}
      </div>

      {/* Error */}
      <p className={clsx(
        'text-sm font-mono text-red-edge mb-10 h-5 transition-opacity',
        error ? 'opacity-100' : 'opacity-0'
      )}>
        {error || ' '}
      </p>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {PAD.flat().map((key, i) => {
          if (!key) return <div key={i} />;
          return (
            <button
              key={i}
              onClick={() => press(key)}
              disabled={shake}
              className={clsx(
                'h-16 rounded-2xl font-display font-semibold text-2xl transition-all active:scale-90',
                key === 'del'
                  ? 'bg-navy-800 text-gray-400 flex items-center justify-center'
                  : 'bg-navy-800 text-white hover:bg-navy-700'
              )}
            >
              {key === 'del' ? <Delete size={20} /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
