/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        sidebar: {
          DEFAULT: '#1a0845', // Richer Deep Purple
          dark: '#100330',   // Very Deep Purple
          light: '#2a1060',  // Lighter Deep Purple
        },
        main: 'var(--bg-main)',
        card: 'var(--bg-card)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-purple': 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      },
      boxShadow: {
        'premium': '0 10px 25px -5px rgba(139, 92, 246, 0.1), 0 8px 10px -6px rgba(139, 92, 246, 0.1)',
        'premium-hover': '0 20px 25px -5px rgba(139, 92, 246, 0.15), 0 10px 10px -5px rgba(139, 92, 246, 0.1)',
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0', transform: 'translateY(8px)'  }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 6px 2px rgba(139,92,246,0.35)' },
          '50%':       { boxShadow: '0 0 14px 4px rgba(139,92,246,0.7)'  },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.45s ease both',
        'slide-up': 'slide-up 0.5s ease both',
        'glow':     'glow-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function({ addVariant }) {
      addVariant('light', '.light &');
    },
  ],
}
