import { Badge, type BadgeProps } from './badge';

type BadgeVariant = BadgeProps['variant'];

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Quotation statuses (aligned with @fym/shared QuotationStatus)
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  REVIEW: { label: 'En Revisión', variant: 'warning' },
  SENT: { label: 'Enviada', variant: 'purple' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  EXPIRED: { label: 'Expirada', variant: 'destructive' },
  INVOICED: { label: 'Facturada', variant: 'info' },

  // Project statuses (aligned with @fym/shared ProjectStatus)
  PLANNING: { label: 'Planificación', variant: 'secondary' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'info' },
  PAUSED: { label: 'En Pausa', variant: 'warning' },
  COMPLETED: { label: 'Completado', variant: 'success' },

  // Petty cash / agreement statuses
  OPEN: { label: 'Abierta', variant: 'success' },
  CLOSED: { label: 'Cerrada', variant: 'secondary' },
  RECONCILING: { label: 'Conciliando', variant: 'warning' },
  ACTIVE: { label: 'Activo', variant: 'success' },
  INACTIVE: { label: 'Inactivo', variant: 'secondary' },

  // HR statuses
  PRESENT: { label: 'Presente', variant: 'success' },
  INCOMPLETE: { label: 'Incompleto', variant: 'warning' },
  ABSENT: { label: 'Ausente', variant: 'destructive' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-[11px] px-2.5 py-0.5',
  lg: 'text-xs px-3 py-1',
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'outline' as BadgeVariant };
  return (
    <Badge variant={config.variant} className={`${SIZE_CLASS[size]} ${className ?? ''}`.trim()}>
      {config.label}
    </Badge>
  );
}

export { STATUS_MAP };
