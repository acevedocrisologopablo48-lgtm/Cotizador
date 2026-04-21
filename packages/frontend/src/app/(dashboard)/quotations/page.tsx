'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { Plus, Search, Eye } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  REVIEW: { label: 'En Revisión', variant: 'outline' },
  APPROVED: { label: 'Aprobada', variant: 'default' },
  SENT: { label: 'Enviada', variant: 'default' },
  ACCEPTED: { label: 'Aceptada', variant: 'default' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  EXPIRED: { label: 'Expirada', variant: 'destructive' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

export default function QuotationsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(null);
      let url = `/quotations?page=${page}&pageSize=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get<any>(url, token!);
      setQuotations(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setLoadError(e.message);
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-muted-foreground">Gestión de cotizaciones y presupuestos</p>
        </div>
        <Button onClick={() => router.push('/quotations/new')}><Plus className="mr-2 h-4 w-4" />Nueva Cotización</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por número, título, cliente..." className="pl-9" value={search}
                  onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)} />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(1)}>Filtrar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Cotización</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : loadError ? (
                <TableError colSpan={7} message={loadError} onRetry={() => load(meta.page)} />
              ) : quotations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay cotizaciones</TableCell></TableRow>
              ) : (
                quotations.map(q => {
                  const status = STATUS_LABELS[q.status] || { label: q.status, variant: 'outline' as const };
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-sm">{q.quotationNumber}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{q.title}</TableCell>
                      <TableCell>{q.company?.tradeName || '—'}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{q.currency || 'PEN'} {Number(q.total || 0).toFixed(2)}</TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString('es-PE')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/quotations/${q.id}`)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{meta.total} cotizaciones</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>Anterior</Button>
                <span className="flex items-center text-sm">Página {meta.page} de {meta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => load(meta.page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
