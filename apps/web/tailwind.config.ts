import type { Config } from 'tailwindcss';

// All colour tokens are CSS variables defined in src/app/globals.css.
// They swap automatically based on <html data-theme="light|dark">.
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'rgb(var(--bg-base) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          panel:    'rgb(var(--bg-panel) / <alpha-value>)',
          ring:     'rgb(var(--bg-ring) / <alpha-value>)',
        },
        accent: {
          cyan:   'rgb(var(--accent-cyan) / <alpha-value>)',
          violet: 'rgb(var(--accent-violet) / <alpha-value>)',
          lime:   'rgb(var(--accent-lime) / <alpha-value>)',
          amber:  'rgb(var(--accent-amber) / <alpha-value>)',
          rose:   'rgb(var(--accent-rose) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgb(var(--accent-violet) / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--accent-violet) / 0.06) 1px, transparent 1px)',
        'radial-spot':
          'radial-gradient(800px circle at 0% 0%, rgb(var(--accent-cyan) / 0.10), transparent 50%), radial-gradient(700px circle at 100% 100%, rgb(var(--accent-violet) / 0.10), transparent 50%)',
      },
      boxShadow: {
        glow:   '0 0 0 1px rgb(var(--accent-cyan) / 0.20), 0 12px 60px -10px rgb(var(--accent-cyan) / 0.25)',
        violet: '0 0 0 1px rgb(var(--accent-violet) / 0.30), 0 12px 60px -10px rgb(var(--accent-violet) / 0.35)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        sweep: 'sweep 2.6s linear infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
