import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  safelist: [
    'bg-indigo-50',
    'bg-sky-50',
    'bg-violet-50',
    'bg-emerald-50',
    'dark:bg-indigo-500/10',
    'dark:bg-sky-500/10',
    'dark:bg-violet-500/10',
    'dark:bg-emerald-500/10',
    'border-indigo-100',
    'border-sky-100',
    'border-violet-100',
    'border-emerald-100',
    'dark:border-indigo-500/20',
    'dark:border-sky-500/20',
    'dark:border-violet-500/20',
    'dark:border-emerald-500/20',
    'text-indigo-600',
    'text-sky-600',
    'text-violet-600',
    'text-emerald-600',
    'dark:text-indigo-400',
    'dark:text-sky-400',
    'dark:text-violet-400',
    'dark:text-emerald-400',
    'bg-indigo-500/5',
    'bg-sky-500/5',
    'bg-violet-500/5',
    'bg-emerald-500/5',
    { pattern: /(bg|text|border|from|to)-(primary|amber|emerald|slate|indigo|rose|sky)-(50|100|200|400|500|600|700)/ },
    { pattern: /(bg|text|border)-(primary|amber|emerald|slate|indigo|rose|sky)-500\/(5|10|20|30)/ },
    { pattern: /(bg|text|border)-(primary|amber|emerald|slate|indigo|rose|sky)-[0-9]+\/[0-9]+/, variants: ['dark', 'hover', 'group-hover'] },
  ],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
