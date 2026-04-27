'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FileText, FolderKanban, Users, Package, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
export default function DashboardPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ quotations: 0, projects: 0, clients: 0, supplies: 0 });
  const [recentQuotations, setRecentQuotations] = useState<any[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.get<any>('/quotations?pageSize=5', token).catch(() => ({ data: [], meta: { total: 0 } })),
      api.get<any>('/projects?pageSize=5', token).catch(() => ({ data: [], meta: { total: 0 } })),
      api.get<any>('/companies?pageSize=1', token).catch(() => ({ meta: { total: 0 } })),
      api.get<any>('/supplies?pageSize=1', token).catch(() => ({ meta: { total: 0 } })),
    ]).then(([q, p, c, s]) => {
      setStats({
        quotations: q.meta?.total ?? 0,
        projects: p.meta?.total ?? 0,
        clients: c.meta?.total ?? 0,
        supplies: s.meta?.total ?? 0,
      });
      setRecentQuotations(q.data || []);
      setRecentProjects(p.data || []);
    }).finally(() => setLoading(false));
  }, [token]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  const statCards = [
    { label: 'Cotizaciones', value: stats.quotations, icon: FileText, href: '/quotations', color: 'blue' },
    { label: 'Proyectos', value: stats.projects, icon: FolderKanban, href: '/projects', color: 'sky' },
    { label: 'Clientes', value: stats.clients, icon: Users, href: '/clients', color: 'amber' },
    { label: 'Insumos', value: stats.supplies, icon: Package, href: '/pricing', color: 'emerald' },
  ];
  const cardColorClass: Record<string, { wrap: string; icon: string; glow: string }> = {
    blue: {
      wrap: 'bg-blue-500/10 border-blue-500/20',
      icon: 'text-blue-400',
      glow: 'bg-blue-500/10',
    },
    sky: {
      wrap: 'bg-sky-500/10 border-sky-500/20',
      icon: 'text-sky-400',
      glow: 'bg-sky-500/10',
    },
    amber: {
      wrap: 'bg-amber-500/10 border-amber-500/20',
      icon: 'text-amber-400',
      glow: 'bg-amber-500/10',
    },
    emerald: {
      wrap: 'bg-emerald-500/10 border-emerald-500/20',
      icon: 'text-emerald-400',
      glow: 'bg-emerald-500/10',
    },
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with Dynamic Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-jakarta">Sincronización en tiempo real</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground font-jakarta leading-tight">
            {greeting}, <span className="text-primary italic">{firstName}</span>
          </h1>
          <p className="text-muted-foreground text-base">Control de operaciones e indicadores clave.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-card px-6 py-3 rounded-2xl border border-border shadow-xl hidden md:block group hover:border-primary/50 transition-all duration-500">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Terminal ID: {user?.id?.slice(-8).toUpperCase() || 'SYS-MAIN'}</p>
            <p className="text-lg font-black text-foreground font-mono tabular-nums tracking-tight group-hover:text-primary transition-colors">
              {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards - High Premium Glassmorphism */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <button
            key={s.label}
            onClick={() => router.push(s.href)}
            style={{ animationDelay: `${i * 100}ms` }}
            className="group relative overflow-hidden bg-card rounded-[2rem] border border-border p-8 text-left shadow-sm hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl border shadow-inner group-hover:scale-105 transition-transform duration-300 ${cardColorClass[s.color].wrap}`}>
                  <s.icon className={`h-7 w-7 ${cardColorClass[s.color].icon}`} />
                </div>
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-4 group-hover:translate-x-0">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-2">{s.label}</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-foreground font-mono tabular-nums tracking-tighter">
                    {loading ? '---' : s.value}
                  </span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
            {/* Visual Flair */}
            <div className={`absolute -bottom-10 -right-10 h-32 w-32 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500 ${cardColorClass[s.color].glow}`} />
          </button>
        ))}
      </div>

      {/* Grid for Recent Activities */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Quotations - Industrial Premium Table */}
        <div className="group rounded-[2rem] border border-border bg-card shadow-xl overflow-hidden transition-all duration-500 hover:border-primary/30">
          <div className="bg-muted/50 p-6 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] font-jakarta">Ordenes de Cotización</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Últimas emisiones del sistema</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/quotations')} 
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-[10px] font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest border border-border"
            >
              Ver Todas
            </button>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] pl-8 py-4">ID / Referencia</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] py-4 text-center">Estado</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] py-4 text-right pr-8">Total Estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3} className="py-6 px-8"><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell></TableRow>
                  ))
                ) : recentQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-20 text-center">
                      <FileText className="mx-auto h-12 w-12 mb-4 text-muted opacity-50" />
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sin actividad reciente</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentQuotations.map((q) => (
                    <TableRow key={q.id} className="group/row cursor-pointer hover:bg-muted/30 transition-all duration-300 border-border/50" onClick={() => router.push(`/quotations/detail?id=${q.id}`)}>
                      <TableCell className="pl-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-black text-foreground uppercase tracking-tighter group-hover/row:text-primary transition-colors">{q.quotationNumber}</span>
                          <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px] uppercase mt-0.5 tracking-tight">{q.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={q.status} className="uppercase tracking-wide" />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-black text-right pr-8 text-foreground tabular-nums">
                        S/ {Number(q.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Recent Projects - Industrial Premium Table */}
        <div className="group rounded-[2rem] border border-border bg-card shadow-xl overflow-hidden transition-all duration-500 hover:border-primary/30">
          <div className="bg-muted/50 p-6 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] font-jakarta">Ejecución de Proyectos</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Control de obras activas</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/projects')} 
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-[10px] font-black text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest border border-border"
            >
              Gestionar
            </button>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] pl-8 py-4">Ref. Técnica</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] py-4 text-center">Progreso</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[9px] tracking-[0.15em] py-4 text-right pr-8">Presupuesto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3} className="py-6 px-8"><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell></TableRow>
                  ))
                ) : recentProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-20 text-center">
                      <FolderKanban className="mx-auto h-12 w-12 mb-4 text-muted opacity-50" />
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sin proyectos en curso</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentProjects.map((p) => (
                    <TableRow key={p.id} className="group/row cursor-pointer hover:bg-muted/30 transition-all duration-300 border-border/50" onClick={() => router.push(`/projects/detail?id=${p.id}`)}>
                      <TableCell className="pl-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-black text-foreground uppercase tracking-tighter group-hover/row:text-primary transition-colors">{p.projectCode}</span>
                          <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px] uppercase mt-0.5 tracking-tight">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={p.status} className="uppercase tracking-wide" />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-black text-right pr-8 text-foreground tabular-nums">
                        S/ {Number(p.approvedBudget || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
