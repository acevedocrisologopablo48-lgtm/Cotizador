import { cn } from '@/lib/utils';
import { TableCell, TableRow } from '@/components/ui/table';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md animate-shimmer', className)} />
  );
}

/** Renders `rows` skeleton rows each with `columns` cells — for table loading states. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j} className="py-3">
              <Skeleton
                className={cn(
                  'h-4',
                  j === 0 ? 'w-3/4' : j === columns - 1 ? 'w-1/2' : 'w-full'
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Inline error row shown inside a table body when a load fails. */
export function TableError({
  colSpan,
  message,
  onRetry,
}: {
  colSpan: number;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5 text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-1 rounded-md px-3 py-1.5 text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
