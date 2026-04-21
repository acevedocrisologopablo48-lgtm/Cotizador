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
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'outline' as BadgeVariant };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export { STATUS_MAP };
