'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { Search, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

const STATUS_LABELS: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'error' | 'secondary' }> = {
  PLANNING: { label: 'Planificación', variant: 'secondary' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'info' },
  ON_HOLD: { label: 'En Pausa', variant: 'warning' }, // legacy support
  PAUSED: { label: 'En Pausa', variant: 'warning' },
  COMPLETED: { label: 'Completado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'error' }, // legacy support
  CLOSED: { label: 'Cerrado', variant: 'error' },
};

export default function ProjectsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fmt = (val: number | string) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(val));
  };

  const load = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(null);
      let url = `/projects?page=${page}&pageSize=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get<any>(url, token!);
      setProjects(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setLoadError(e.message);
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, addToast]);

  useEffect(() => { load(); }, [load]);

  const statColorClass: Record<string, { wrap: string; icon: string }> = {
    indigo: { wrap: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20', icon: 'text-indigo-600 dark:text-indigo-400' },
    blue: { wrap: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20', icon: 'text-blue-600 dark:text-blue-400' },
    emerald: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    amber: { wrap: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20', icon: 'text-amber-600 dark:text-amber-400' },
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-jakarta">
            Gestión de <span className="text-primary italic">Proyectos</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Supervisión técnica y control presupuestario de obras en ejecución.
          </p>
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Proyectos', value: meta.total, icon: Search, color: 'indigo' },
          { label: 'En Progreso', value: projects.filter(p => p.status === 'IN_PROGRESS').length, icon: Eye, color: 'blue' },
          { label: 'Presupuesto Total', value: fmt(projects.reduce((acc, p) => acc + (p.approvedBudget || 0), 0)), icon: Search, color: 'emerald', isCurrency: true },
          { label: 'Completados', value: projects.filter(p => p.status === 'COMPLETED').length, icon: Eye, color: 'amber' }
        ].map((stat, i) => (
          <Card key={i} className="group relative border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center border shadow-inner group-hover:scale-105 transition-transform ${statColorClass[stat.color].wrap}`}>
                <stat.icon className={`h-5 w-5 ${statColorClass[stat.color].icon}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{stat.label}</p>
                <p className={`font-black font-mono tabular-nums text-slate-900 dark:text-slate-50 ${stat.isCurrency ? 'text-lg' : 'text-2xl'}`}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Código, nombre de proyecto o cliente..." 
                className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-primary/20 transition-all" 
                value={search}
                onChange={e => setSearch(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && load(1)} 
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-[180px] h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="ALL" className="text-xs font-bold uppercase tracking-widest">Todos los estados</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs font-bold uppercase tracking-widest">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => load(1)} className="h-11 px-8 rounded-xl font-bold text-xs uppercase tracking-widest shadow-md">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden transition-all duration-500">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
            <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
              <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-widest py-4">Código</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Información del Proyecto</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Cliente / Entidad</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Estado</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4">Presupuesto Aprob.</TableHead>
              <TableHead className="w-[60px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={8} columns={6} />
            ) : loadError ? (
              <TableError colSpan={6} message={loadError} onRetry={() => load(meta.page)} />
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-72 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                    <div className="h-20 w-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700 shadow-inner">
                      <Search className="h-10 w-10 text-slate-400 opacity-40" />
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-jakarta">Sin coincidencias</p>
                    <p className="text-sm max-w-xs mx-auto font-medium text-slate-400">
                      No se encontraron proyectos activos con los criterios seleccionados.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              projects.map(p => {
                return (
                  <TableRow 
                    key={p.id} 
                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer" 
                    onClick={() => router.push(`/projects/detail?id=${p.id}`)}
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">
                          <Eye className="h-4 w-4 text-slate-400" />
                        </div>
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-200 tabular-nums bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                          {p.projectCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors font-jakarta leading-tight">{p.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Iniciado:</span>
                          <span className="text-[9px] text-slate-500 font-black uppercase tracking-tight">{new Date(p.startDate || p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight leading-tight">{p.company?.tradeName || p.company?.businessName || '—'}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5">{p.quotation?.quotationNumber || 'SIN COTIZACIÓN'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <StatusBadge status={p.status} className="uppercase tracking-wide" />
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        {fmt(p.approvedBudget)}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        {/* Pagination Integration */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {meta.total} Proyectos Identificados
            </p>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={meta.page <= 1} 
                onClick={(e) => { e.stopPropagation(); load(meta.page - 1); }}
                className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-bold text-xs uppercase tracking-widest"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <span className="text-xs font-black font-mono">{meta.page}</span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-black font-mono text-slate-400">{meta.totalPages}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={meta.page >= meta.totalPages} 
                onClick={(e) => { e.stopPropagation(); load(meta.page + 1); }}
                className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-bold text-xs uppercase tracking-widest"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
