import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        success:     'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400',
        warning:     'border-amber-500/30   bg-amber-500/15   text-amber-500  dark:border-amber-500/25  dark:bg-amber-500/10  dark:text-amber-400',
        info:        'border-sky-500/30     bg-sky-500/15     text-sky-500    dark:border-sky-500/25    dark:bg-sky-500/10    dark:text-sky-400',
        purple:      'border-violet-500/30  bg-violet-500/15  text-violet-500 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-400',
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
