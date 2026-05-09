'use client';

import { Badge } from '@/components/ui/badge';
import { ProjectQueryStatus } from '@fym/shared';

const STATUS_META: Record<ProjectQueryStatus, { label: string; className: string }> = {
  OPEN: { label: 'Abierta', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'En progreso', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  RESOLVED: { label: 'Resuelta', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Cerrada', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export function QueryStatusBadge({ status }: { status: ProjectQueryStatus }) {
  const meta = STATUS_META[status] || STATUS_META.OPEN;
  return <Badge className={`rounded-md border ${meta.className}`}>{meta.label}</Badge>;
}
