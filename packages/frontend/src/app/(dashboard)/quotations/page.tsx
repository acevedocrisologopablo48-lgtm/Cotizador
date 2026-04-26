'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { Plus, Search, ExternalLink, X } from 'lucide-react';

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
  const searchParams = useSearchParams();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState(() => searchParams.get('companyId') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [quotationTypes, setQuotationTypes] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState(() => searchParams.get('contactId') || '');
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    api.get<any>('/companies?pageSize=200', token).then(r => setCompanies(r.data || [])).catch(() => {});
    api.get<string[]>('/config/quotation-types', token).then(r => setQuotationTypes(r || [])).catch(() => {});
  }, [token]);

  // Load contacts when company filter changes
  // Don't reset contactFilter here — it may have been set from URL params
  useEffect(() => {
    if (!companyFilter || !token) { setContacts([]); return; }
    api.get<any>(`/companies/${companyFilter}`, token)
      .then(r => setContacts(r.data?.contacts || []))
      .catch(() => setContacts([]));
  }, [companyFilter, token]);

  const hasFilters = !!(search || statusFilter || tipoFilter || companyFilter || contactFilter || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTipoFilter('');
    setCompanyFilter('');
    setContactFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const load = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(null);
      let url = `/quotations?page=${page}&pageSize=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (tipoFilter) url += `&tipo=${encodeURIComponent(tipoFilter)}`;
      if (companyFilter) url += `&companyId=${companyFilter}`;
      if (contactFilter) url += `&contactId=${contactFilter}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      const res = await api.get<any>(url, token!);
      setQuotations(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setLoadError(e.message);
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, tipoFilter, companyFilter, contactFilter, dateFrom, dateTo, addToast]);

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
        <CardContent className="p-4 space-y-3">
          {/* Row 1: search + apply + clear */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por número, título, cliente..." className="pl-9" value={search}
                  onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)} />
              </div>
            </div>
            <Button onClick={() => load(1)}>Filtrar</Button>
            {hasFilters && (
              <Button variant="ghost" size="icon" title="Limpiar filtros" onClick={() => { clearFilters(); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Row 2: status, tipo, client, date range */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {quotationTypes.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={tipoFilter || 'ALL'} onValueChange={v => setTipoFilter(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {quotationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {companies.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={companyFilter || 'ALL'} onValueChange={v => setCompanyFilter(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {contacts.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Comprador</Label>
                <Select value={contactFilter || 'ALL'} onValueChange={v => setContactFilter(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" className="w-[160px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" className="w-[160px]" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              Filtros activos —{' '}
              <button className="underline" onClick={clearFilters}>limpiar todos</button>
            </p>
          )}
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
                <TableHead>Comprador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={6} columns={9} />
              ) : loadError ? (
                <TableError colSpan={9} message={loadError} onRetry={() => load(meta.page)} />
              ) : quotations.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay cotizaciones</TableCell></TableRow>
              ) : (
                quotations.map(q => {
                  const status = STATUS_LABELS[q.status] || { label: q.status, variant: 'outline' as const };
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-sm">{q.quotationNumber}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{q.title}</TableCell>
                      <TableCell>{q.company?.tradeName || '—'}</TableCell>
                      <TableCell className="text-sm">{q.contact?.fullName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{q.tipo ? <Badge variant="outline" className="font-normal">{q.tipo}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{q.currency || 'PEN'} {Number(q.total || 0).toFixed(2)}</TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString('es-PE')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/quotations/${q.id}`)}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Ver detalle
                        </Button>
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
