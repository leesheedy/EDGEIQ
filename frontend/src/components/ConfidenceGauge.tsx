import React from 'react';
import { confidenceColor } from '../lib/utils';

interface Props {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function ConfidenceGauge({ value, size = 80, strokeWidth = 6, showLabel = true }: Props) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = Math.PI * radius; // Half circle
  const progress = (value / 100) * circumference;
  const color = confidenceColor(value);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${cy}`}
          fill="none"
          stroke="#1e2a3a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{
            filter: `drop-shadow(0 0 4px ${color}66)`,
            transition: 'stroke-dasharray 0.6s ease',
          }}
        />
        {showLabel && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill={color}
            fontSize={size * 0.2}
            fontFamily="DM Mono, monospace"
            fontWeight="500"
          >
            {value}
          </text>
        )}
      </svg>
      {showLabel && (
        <span className="text-xs text-gray-500 font-mono -mt-1">CONF</span>
      )}
    </div>
  );
}
