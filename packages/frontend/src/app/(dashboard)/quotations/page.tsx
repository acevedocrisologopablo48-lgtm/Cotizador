'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Plus, Search, ExternalLink, X, FileText, CheckCircle2, Loader2, Filter, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type ToneKey = 'primary' | 'slate' | 'amber' | 'sky' | 'indigo' | 'emerald' | 'rose';

const STATUS_LABELS: Record<string, { label: string; color: ToneKey }> = {
  DRAFT: { label: 'Borrador', color: 'slate' },
  REVIEW: { label: 'En Revisión', color: 'amber' },
  APPROVED: { label: 'Aceptada', color: 'sky' },
  SENT: { label: 'Enviada', color: 'indigo' },
  FOLLOW_UP: { label: 'Seguimiento', color: 'indigo' },
  STAND_BY: { label: 'Stand By', color: 'amber' },
  INVOICED: { label: 'Facturada', color: 'emerald' },
  REJECTED: { label: 'Rechazada', color: 'rose' },
  EXPIRED: { label: 'Expirada', color: 'rose' },
};

const STATUS_TONE_CLASSES: Record<ToneKey, { wrapper: string; pingBg: string; dotBg: string; text: string }> = {
  primary: {
    wrapper: 'bg-primary/10 border border-primary/25 group-hover:border-primary/50',
    pingBg: 'bg-primary/70',
    dotBg: 'bg-primary',
    text: 'text-primary',
  },
  slate: {
    wrapper: 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 group-hover:border-slate-400',
    pingBg: 'bg-slate-400',
    dotBg: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-300',
  },
  amber: {
    wrapper: 'bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 group-hover:border-amber-400',
    pingBg: 'bg-amber-400',
    dotBg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  sky: {
    wrapper: 'bg-sky-50 dark:bg-sky-900/30 border border-sky-300 dark:border-sky-700 group-hover:border-sky-400',
    pingBg: 'bg-sky-400',
    dotBg: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-400',
  },
  indigo: {
    wrapper: 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 group-hover:border-indigo-400',
    pingBg: 'bg-indigo-400',
    dotBg: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-400',
  },
  emerald: {
    wrapper: 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 group-hover:border-emerald-400',
    pingBg: 'bg-emerald-400',
    dotBg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  rose: {
    wrapper: 'bg-rose-50 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700 group-hover:border-rose-400',
    pingBg: 'bg-rose-400',
    dotBg: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
  },
};

const STAT_TONE_CLASSES: Record<ToneKey, { glow: string; iconWrap: string; iconText: string; suffixText: string; bar: string }> = {
  primary: {
    glow: 'from-primary/20 to-transparent',
    iconWrap: 'bg-primary/10 border border-primary/20',
    iconText: 'text-primary',
    suffixText: 'text-primary/70',
    bar: 'bg-primary',
  },
  slate: {
    glow: 'from-slate-500/20 to-transparent',
    iconWrap: 'bg-slate-500/10 border border-slate-500/20',
    iconText: 'text-slate-500',
    suffixText: 'text-slate-500/70',
    bar: 'bg-slate-500',
  },
  amber: {
    glow: 'from-amber-500/20 to-transparent',
    iconWrap: 'bg-amber-500/10 border border-amber-500/20',
    iconText: 'text-amber-500',
    suffixText: 'text-amber-500/70',
    bar: 'bg-amber-500',
  },
  sky: {
    glow: 'from-sky-500/20 to-transparent',
    iconWrap: 'bg-sky-500/10 border border-sky-500/20',
    iconText: 'text-sky-500',
    suffixText: 'text-sky-500/70',
    bar: 'bg-sky-500',
  },
  indigo: {
    glow: 'from-indigo-500/20 to-transparent',
    iconWrap: 'bg-indigo-500/10 border border-indigo-500/20',
    iconText: 'text-indigo-500',
    suffixText: 'text-indigo-500/70',
    bar: 'bg-indigo-500',
  },
  emerald: {
    glow: 'from-emerald-500/20 to-transparent',
    iconWrap: 'bg-emerald-500/10 border border-emerald-500/20',
    iconText: 'text-emerald-500',
    suffixText: 'text-emerald-500/70',
    bar: 'bg-emerald-500',
  },
  rose: {
    glow: 'from-rose-500/20 to-transparent',
    iconWrap: 'bg-rose-500/10 border border-rose-500/20',
    iconText: 'text-rose-500',
    suffixText: 'text-rose-500/70',
    bar: 'bg-rose-500',
  },
};

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <QuotationsPageInner />
    </Suspense>
  );
}

function QuotationsPageInner() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  // Soporta deep-linking desde Dashboard / módulos relacionados (?status=DRAFT, etc.)
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [tipoFilter, setTipoFilter] = useState(() => searchParams.get('tipo') || '');
  const [companyFilter, setCompanyFilter] = useState(() => searchParams.get('companyId') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [quotationTypes, setQuotationTypes] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState(() => searchParams.get('contactId') || '');
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    api.get<any>('/companies?pageSize=200', token).then(r => setCompanies(r.data || [])).catch(() => {});
    api.get<string[]>('/config/quotation-types', token).then(r => setQuotationTypes(r || [])).catch(() => {});
  }, [token]);

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

  const fmt = (val: number | string, currency = 'PEN') => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(Number(val));
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

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setIsDeleting(true);
    try {
      await api.delete(`/quotations/${deleteTarget.id}`, token);
      addToast('Cotización eliminada correctamente', 'success');
      setDeleteTarget(null);
      load(meta.page);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 font-jakarta animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Premium Industrial Header */}
      <div className="relative">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white dark:bg-slate-900/40 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Animated Background Element */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="h-px w-8 bg-gradient-to-r from-primary/50 to-transparent"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Commercial Intelligence</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Centro de <span className="text-primary">Cotizaciones</span>
            </h1>
            
            <div className="flex items-center gap-4 mt-6">
              <p className="text-slate-500 dark:text-slate-400 max-w-xl text-sm leading-relaxed border-l-2 border-primary/25 pl-4">
                Plataforma avanzada para la ingeniería de costos, despliegue de propuestas comerciales y optimización de márgenes operativos.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => router.push('/quotations/new')} 
              className="h-11 px-6 rounded-xl font-semibold"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva propuesta técnica
            </Button>
          </div>
        </div>
      </div>

      {/* Glassmorphic Stats Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        {([
          { label: 'Proyectos Cotizados', value: meta.total, icon: FileText, color: 'primary' as ToneKey, suffix: 'Expedientes' },
          { label: 'Auditoría Pendiente', value: quotations.filter(q => q.status === 'REVIEW').length, icon: Loader2, color: 'amber' as ToneKey, suffix: 'Revisiones' },
          { label: 'Propuestas Ganadas', value: quotations.filter(q => q.status === 'APPROVED').length, icon: CheckCircle2, color: 'emerald' as ToneKey, suffix: 'Aprobados' },
          { label: 'Borradores Locales', value: quotations.filter(q => q.status === 'DRAFT').length, icon: Search, color: 'slate' as ToneKey, suffix: 'Ediciones' },
        ]).map((stat, i) => {
          const tone = STAT_TONE_CLASSES[stat.color];
          return (
            <div key={i} className="group relative">
              <div className={`absolute -inset-0.5 bg-gradient-to-br ${tone.glow} rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500`}></div>
              <Card className="relative border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-3xl transition-all duration-500 group-hover:translate-y-[-4px] overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className={`p-4 rounded-2xl ${tone.iconWrap} ${tone.iconText} shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                      <stat.icon className={`h-6 w-6 ${stat.color === 'amber' ? 'animate-spin-slow' : ''}`} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">{stat.label}</p>
                      <div className="flex items-baseline justify-end gap-2 mt-2">
                        <p className="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">{stat.value}</p>
                      </div>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${tone.suffixText} mt-1`}>{stat.suffix}</p>
                    </div>
                  </div>
                  <div className="mt-6 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${tone.bar} w-1/3 rounded-full group-hover:w-full transition-all duration-1000`}></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Advanced Command Filter Bar */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-slate-200/50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-[2.5rem] blur opacity-25"></div>
        <Card className="relative border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] shadow-xl overflow-hidden">
          <CardContent className="p-10">
            <div className="flex items-center gap-3 mb-8">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white">Panel de Control de Consultas</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-slate-800 to-transparent"></div>
            </div>

            <div className="grid gap-8 md:grid-cols-12">
              <div className="md:col-span-5 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identificador o Título del Proyecto</label>
                <div className="relative group/input">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within/input:text-primary group-focus-within/input:scale-110 transition-all duration-300" />
                  <Input 
                    placeholder="Ej: COT-2024-001 o Planta Industrial..." 
                    className="pl-14 bg-slate-100/50 dark:bg-slate-950/50 border-white/10 rounded-2xl h-14 text-sm font-bold focus-visible:ring-primary/20 focus-visible:bg-white dark:focus-visible:bg-slate-900 transition-all shadow-inner" 
                    value={search}
                    onChange={e => setSearch(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && load(1)} 
                  />
                </div>
              </div>

              <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 text-center block">Estado Maestro</label>
                  <Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
                    <SelectTrigger className="w-full bg-slate-100/50 dark:bg-slate-950/50 border-white/10 rounded-2xl h-14 text-[10px] font-black uppercase tracking-[0.15em] shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-white rounded-2xl p-2">
                      <SelectItem value="ALL" className="rounded-xl focus:bg-primary/20">TODOS LOS ESTADOS</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-[10px] font-black uppercase tracking-widest rounded-xl focus:bg-primary/20">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 text-center block">Rango de Inicio</label>
                  <Input type="date" className="w-full bg-slate-100/50 dark:bg-slate-950/50 border-white/10 rounded-2xl h-14 font-mono text-[11px] font-black tracking-tighter shadow-inner" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 text-center block">Rango de Cierre</label>
                  <Input type="date" className="w-full bg-slate-100/50 dark:bg-slate-950/50 border-white/10 rounded-2xl h-14 font-mono text-[11px] font-black tracking-tighter shadow-inner" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mt-10 pt-8 border-t border-slate-200 dark:border-white/5">
              <div className="flex flex-wrap gap-8 items-center">
                {companies.length > 0 && (
                  <div className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-950/50 px-6 py-3 rounded-2xl border border-white/10 shadow-inner group-hover:border-primary/30 transition-colors">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Asociación por Cliente:</label>
                    <Select value={companyFilter || 'ALL'} onValueChange={v => setCompanyFilter(v === 'ALL' ? '' : v)}>
                      <SelectTrigger className="w-[200px] bg-transparent border-none shadow-none h-6 font-black text-[11px] uppercase tracking-wide hover:text-primary transition-colors focus:ring-0">
                        <SelectValue placeholder="TODOS LOS CLIENTES" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-white rounded-2xl">
                        <SelectItem value="ALL" className="rounded-xl focus:bg-primary/20">TODOS LOS CLIENTES</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id} className="text-[10px] font-bold rounded-xl focus:bg-primary/20">{c.tradeName || c.businessName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all">
                    <X className="mr-2 h-4 w-4" /> Resetear Parámetros
                  </Button>
                )}
                <Button onClick={() => load(1)} className="bg-primary text-white hover:bg-primary/90 h-14 px-12 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-primary/20 group">
                  Sincronizar Datos <ArrowRight className="ml-3 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Industrial Data Matrix (Table) */}
      <Card className="relative border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] shadow-2xl overflow-hidden border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/80">
                  <TableHead className="w-[180px] font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8 px-10">Folio Técnico</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8">Descripción del Proyecto</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8">Entidad / Cliente</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8">Configuración</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8">Estado Actual</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300 py-8 pr-10">Valuación Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={8} columns={6} />
                ) : loadError ? (
                  <TableError colSpan={6} message={loadError} onRetry={() => load(meta.page)} />
                ) : quotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="flex flex-col items-center gap-6">
                        <div className="h-24 w-24 rounded-[2rem] bg-slate-950/40 flex items-center justify-center border border-white/5 shadow-inner animate-pulse">
                          <FileText className="h-10 w-10 text-slate-700" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Sin Registros en Matriz</p>
                          <p className="text-[10px] font-medium text-slate-600 uppercase tracking-widest italic">Inicie una nueva propuesta técnica para comenzar.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  quotations.map((q, idx) => {
                    const status = STATUS_LABELS[q.status] || { label: q.status, color: 'slate' as ToneKey };
                    const tone = STATUS_TONE_CLASSES[status.color] || STATUS_TONE_CLASSES.slate;

                    return (
                      <TableRow 
                        key={q.id} 
                        className="group hover:bg-white/5 dark:hover:bg-white/5 transition-all duration-500 cursor-pointer border-b border-white/[0.03]" 
                        onClick={() => router.push(`/quotations/detail?id=${q.id}`)}
                      >
                        <TableCell className="px-10 py-8">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-white/10 shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
                              <span className="font-mono text-xs font-black">{idx + 1 + (meta.page - 1) * meta.pageSize}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[13px] font-black text-primary tracking-widest uppercase group-hover:scale-105 transition-transform origin-left">
                                {q.quotationNumber}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Ref ID: {q.id.slice(-8).toUpperCase()}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white group-hover:translate-x-2 transition-transform duration-500 ease-out">{q.title}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="h-1 w-1 rounded-full bg-slate-400" />
                              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Creación: {new Date(q.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-white/10">
                              <span className="font-black text-[10px] text-slate-500">{(q.company?.tradeName || q.company?.businessName || '?')[0]}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900 dark:text-slate-300 uppercase tracking-tight">{q.company?.tradeName || q.company?.businessName || 'Entidad no definida'}</span>
                              <span className="text-[10px] text-slate-500 font-bold mt-0.5 italic">{q.contact?.fullName || 'Pendiente de asignar'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Badge variant="outline" className="w-fit font-black text-[9px] uppercase tracking-widest px-3 py-1 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 group-hover:border-primary/50 group-hover:text-primary transition-all">
                              {q.tipo || 'General'}
                            </Badge>
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{q.currency} / {q.igvPercentage}% IGV</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl ${tone.wrapper} transition-all duration-500`}>
                            <div className={`relative flex h-2 w-2`}>
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tone.pingBg} opacity-75`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${tone.dotBg}`}></span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tone.text}`}>{status.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-primary transition-colors">
                                {fmt(q.total || 0, q.currency)}
                              </span>
                              <div className="flex items-center gap-2 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-[-4px] transition-all duration-500">
                                <span className="text-[9px] font-black uppercase tracking-widest">Abrir Expediente</span>
                                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                  <ExternalLink className="h-3 w-3" />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                              className="opacity-0 group-hover:opacity-100 transition-all ml-2 h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-10 py-8 bg-slate-950/40 border-t border-white/10">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-primary/40" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{meta.total} Entradas en Sistema</span>
              </div>
              
              <div className="flex items-center gap-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={meta.page <= 1} 
                  onClick={(e) => { e.stopPropagation(); load(meta.page - 1); }}
                  className="h-12 border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl disabled:opacity-30"
                >
                  Regresar
                </Button>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bloque</span>
                  <div className="flex h-12 w-20 items-center justify-center rounded-xl bg-slate-950 border border-white/10">
                    <span className="font-mono text-sm font-black text-primary">{meta.page}</span>
                    <span className="mx-2 text-slate-700">/</span>
                    <span className="font-mono text-sm font-black text-slate-500">{meta.totalPages}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={meta.page >= meta.totalPages} 
                  onClick={(e) => { e.stopPropagation(); load(meta.page + 1); }}
                  className="h-12 border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl disabled:opacity-30"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ¿Estás seguro de que deseas eliminar esta cotización?
            </p>
            <p className="font-bold text-slate-900 dark:text-slate-100">
              {deleteTarget?.quotationNumber} — {deleteTarget?.title}
            </p>
            <p className="text-xs text-slate-500 pt-1">
              Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
