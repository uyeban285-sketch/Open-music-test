import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--palette-bg) / <alpha-value>)',
        foreground: 'rgb(var(--palette-fg) / <alpha-value>)',
        accent: 'rgb(var(--palette-accent) / <alpha-value>)',
        surface: 'rgb(var(--palette-surface) / <alpha-value>)',
        muted: 'rgb(var(--palette-muted) / <alpha-value>)',
      },
      transitionDuration: {
        quick: 'var(--motion-quick)',
        normal: 'var(--motion-normal)',
        slow: 'var(--motion-slow)',
      },
      backdropBlur: {
        glass: '16px',
      },
      backdropSaturate: {
        glass: '150%',
      },
    },
  },
  plugins: [],
};

export default config;
