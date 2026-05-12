export function fmtPrintMoney(n: number, currency: string): string {
  const code = currency === 'USD' ? 'USD' : 'PEN';
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: code }).format(Number(n) || 0);
  } catch {
    return `${currency} ${Number(n || 0).toFixed(2)}`;
  }
}

export function formatIssueDatePrint(iso: string | undefined, fallback: Date | string | undefined): string {
  let d: Date;
  if (iso) {
    d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  if (fallback) {
    d = fallback instanceof Date ? fallback : new Date(fallback);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  return new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function statusLabelPrint(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Borrador',
    REVIEW: 'En revisión',
    SENT: 'Enviada',
    APPROVED: 'Aprobado',
    REJECTED: 'Denegado',
    EXPIRED: 'Vencida',
    INVOICED: 'Aprobado',
    FOLLOW_UP: 'Seguimiento',
    STAND_BY: 'Stand By',
  };
  return map[status] || status;
}
