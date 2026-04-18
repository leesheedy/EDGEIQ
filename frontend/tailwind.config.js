/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a0e1a',
          900: '#0d1221',
          800: '#111827',
          700: '#1a2235',
          600: '#1e2a3a',
        },
        green: {
          edge: '#00ff88',
          dim: '#00cc6a',
        },
        red: {
          edge: '#ff4444',
          dim: '#cc3333',
        },
        amber: {
          edge: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['DM Mono', 'Fira Code', 'monospace'],
        display: ['Syne', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulseGreen 1.5s ease-in-out infinite',
        'pulse-red': 'pulseRed 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 136, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0, 255, 136, 0)' },
        },
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 68, 68, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255, 68, 68, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
