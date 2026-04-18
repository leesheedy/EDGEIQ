import React from 'react';
import { clsx } from '../lib/utils';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'red' | 'amber' | 'white';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function StatsCard({ label, value, sub, color = 'white', size = 'md', icon }: Props) {
  const colorClass = {
    green: 'text-green-edge',
    red: 'text-red-edge',
    amber: 'text-amber-edge',
    white: 'text-white',
  }[color];

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-mono uppercase tracking-wider">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
      </div>
      <div className={clsx('font-display font-bold', size === 'md' ? 'text-2xl' : 'text-lg', colorClass)}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 font-mono">{sub}</div>}
    </div>
  );
}
