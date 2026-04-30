import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:   'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
        destructive: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60',
        outline:     'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900',
        success:     'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
        warning:     'border-amber-200  dark:border-amber-700  bg-amber-50  dark:bg-amber-900/30  text-amber-700  dark:text-amber-300',
        info:        'border-sky-200    dark:border-sky-700    bg-sky-50    dark:bg-sky-900/30    text-sky-700    dark:text-sky-300',
        purple:      'border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
