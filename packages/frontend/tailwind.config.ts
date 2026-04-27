import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  safelist: [
    // stat card backgrounds
    'bg-blue-50', 'bg-sky-50', 'bg-amber-50', 'bg-emerald-50',
    'border-blue-100', 'border-sky-100', 'border-amber-100', 'border-emerald-100',
    'text-blue-700', 'text-sky-700', 'text-amber-700', 'text-emerald-700',
    'bg-blue-500/10', 'bg-sky-500/10', 'bg-amber-500/10', 'bg-emerald-500/10',
    'bg-blue-500/5', 'bg-sky-500/5', 'bg-amber-500/5', 'bg-emerald-500/5',
    // legacy indigo/violet kept for old references
    'bg-indigo-50', 'bg-violet-50',
    'text-indigo-600', 'text-violet-600', 'text-sky-600', 'text-emerald-600',
    { pattern: /(bg|text|border|from|to)-(primary|blue|amber|emerald|slate|indigo|rose|sky|violet)-(50|100|200|400|500|600|700|800)/ },
    { pattern: /(bg|text|border)-(primary|blue|amber|emerald|slate|indigo|rose|sky)-500\/(5|10|20|30)/ },
    { pattern: /(bg|text|border)-(primary|blue|amber|emerald|slate|sky|rose)-[0-9]+\/[0-9]+/, variants: ['dark', 'hover', 'group-hover'] },
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
