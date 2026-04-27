import { Badge, type BadgeProps } from './badge';

type BadgeVariant = BadgeProps['variant'];

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Quotation statuses
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  REVIEW: { label: 'En Revisión', variant: 'warning' },
  APPROVED: { label: 'Aprobada', variant: 'info' },
  SENT: { label: 'Enviada', variant: 'purple' },
  ACCEPTED: { label: 'Aceptada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  EXPIRED: { label: 'Expirada', variant: 'destructive' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },

  // Project statuses
  PLANNING: { label: 'Planificación', variant: 'secondary' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'info' },
  ON_HOLD: { label: 'En Pausa', variant: 'warning' },
  COMPLETED: { label: 'Completado', variant: 'success' },

  // Petty cash / agreement statuses
  OPEN: { label: 'Abierta', variant: 'success' },
  CLOSED: { label: 'Cerrada', variant: 'secondary' },
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
