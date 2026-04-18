import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import type { Sport, BetType, Recommendation } from '../types';

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatOdds(odds: number): string {
  return `$${odds.toFixed(2)}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatEV(ev: number): string {
  return `${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(1)}%`;
}

export function formatEventTime(isoString: string): string {
  const date = new Date(isoString);
  if (isToday(date)) return `Today ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow ${format(date, 'h:mm a')}`;
  return format(date, 'EEE d MMM h:mm a');
}

export function timeUntil(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
}

export function sportLabel(sport: Sport): string {
  const labels: Record<Sport, string> = {
    horse_racing_thoroughbred: 'Thoroughbred',
    horse_racing_harness: 'Harness',
    horse_racing_greyhound: 'Greyhound',
    nrl: 'NRL',
    afl: 'AFL',
    soccer: 'Soccer',
    nba: 'NBA',
    cricket: 'Cricket',
    tennis: 'Tennis',
    rugby: 'Rugby',
    other: 'Other',
  };
  return labels[sport] || sport;
}

export function sportEmoji(sport: Sport): string {
  const emojis: Record<Sport, string> = {
    horse_racing_thoroughbred: '🏇',
    horse_racing_harness: '🐎',
    horse_racing_greyhound: '🐕',
    nrl: '🏉',
    afl: '🏈',
    soccer: '⚽',
    nba: '🏀',
    cricket: '🏏',
    tennis: '🎾',
    rugby: '🏉',
    other: '🎯',
  };
  return emojis[sport] || '🎯';
}

export function betTypeLabel(type: BetType): string {
  const labels: Record<BetType, string> = {
    win: 'Win',
    place: 'Place',
    each_way: 'Each Way',
    quinella: 'Quinella',
    exacta: 'Exacta',
    trifecta: 'Trifecta',
    first4: 'First 4',
    same_game_multi: 'SGM',
    multi: 'Multi',
    head_to_head: 'H2H',
    line: 'Line',
    total: 'Total',
  };
  return labels[type] || type;
}

export function recommendationColor(rec: Recommendation): string {
  return rec === 'BET' ? 'text-green-edge' : rec === 'WATCH' ? 'text-amber-edge' : 'text-gray-400';
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 80) return '#00ff88';
  if (confidence >= 65) return '#f59e0b';
  return '#ff4444';
}

export function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-green-edge';
  if (pnl < 0) return 'text-red-edge';
  return 'text-gray-400';
}

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
