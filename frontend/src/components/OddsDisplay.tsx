import React, { useEffect, useRef, useState } from 'react';
import { clsx } from '../lib/utils';

interface Props {
  odds: number;
  prevOdds?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function OddsDisplay({ odds, prevOdds, size = 'md' }: Props) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(prevOdds);

  useEffect(() => {
    if (prevRef.current !== undefined && prevRef.current !== odds) {
      setFlash(odds < prevRef.current ? 'down' : 'up');
      const timer = setTimeout(() => setFlash(null), 1500);
      prevRef.current = odds;
      return () => clearTimeout(timer);
    }
    prevRef.current = odds;
  }, [odds]);

  const sizeClasses = {
    sm: 'text-sm px-1.5 py-0.5',
    md: 'text-base px-2 py-1',
    lg: 'text-lg px-3 py-1.5',
  };

  return (
    <span
      className={clsx(
        'font-mono font-medium rounded transition-all duration-300',
        sizeClasses[size],
        flash === 'down'
          ? 'bg-green-edge/20 text-green-edge animate-pulse-green'
          : flash === 'up'
          ? 'bg-red-edge/20 text-red-edge animate-pulse-red'
          : 'bg-navy-700 text-white'
      )}
    >
      ${odds.toFixed(2)}
    </span>
  );
}
