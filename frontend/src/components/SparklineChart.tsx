import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import type { BankrollLog } from '../types';

interface Props {
  data: BankrollLog[];
  height?: number;
  color?: string;
  showTooltip?: boolean;
}

export function SparklineChart({
  data,
  height = 60,
  color = '#00ff88',
  showTooltip = false,
}: Props) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-600 text-xs font-mono"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const chartData = data.map((d) => ({
    balance: d.balance,
    time: new Date(d.timestamp).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
  }));

  const baseline = chartData[0]?.balance || 0;
  const isPositive = (chartData[chartData.length - 1]?.balance || 0) >= baseline;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showTooltip && (
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid #1e2a3a',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'DM Mono, monospace',
            }}
            formatter={(val: number) => [`$${val.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, 'Balance']}
          />
        )}
        <ReferenceLine y={baseline} stroke="#1e2a3a" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={isPositive ? '#00ff88' : '#ff4444'}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
