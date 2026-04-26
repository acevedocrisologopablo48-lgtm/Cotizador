'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FileText, FolderKanban, Users, Package, ArrowRight } from 'lucide-react';

const STATUS_CHIP: Record<string, string> = {
  DRAFT:       'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  REVIEW:      'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  SENT:        'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  ACCEPTED:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED:    'bg-red-50 text-red-600 ring-1 ring-red-200',
  PLANNING:    'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  IN_PROGRESS: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  COMPLETED:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  ON_HOLD:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', REVIEW: 'Revisión', APPROVED: 'Aprobada',
  SENT: 'Enviada', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada',
  PLANNING: 'Planificación', IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completado', ON_HOLD: 'En Pausa',
};

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
    { label: 'Cotizaciones', value: stats.quotations, icon: FileText, href: '/quotations', iconBg: 'bg-orange-50', iconColor: 'text-primary', topBorder: 'border-t-primary' },
    { label: 'Proyectos activos', value: stats.projects, icon: FolderKanban, href: '/projects', iconBg: 'bg-sky-50', iconColor: 'text-sky-600', topBorder: 'border-t-sky-500' },
    { label: 'Clientes', value: stats.clients, icon: Users, href: '/clients', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', topBorder: 'border-t-violet-500' },
    { label: 'Insumos registrados', value: stats.supplies, icon: Package, href: '/pricing', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', topBorder: 'border-t-emerald-500' },
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{greeting}</p>
          <h1 className="text-[22px] font-bold tracking-tight mt-0.5">{firstName}</h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[12px] text-muted-foreground">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <button
            key={s.label}
            onClick={() => router.push(s.href)}
            className={`group text-left bg-card rounded-xl border border-border border-t-[3px] ${s.topBorder} p-5 shadow-sm hover:shadow-md transition-all duration-200`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-3xl font-bold mt-1.5 tabular-nums">
                  {loading ? <span className="text-muted-foreground/30 animate-pulse">â€”</span> : s.value}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.iconBg} shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.iconColor}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[12px] text-muted-foreground group-hover:text-primary transition-colors">
              <span>Ver {s.label.toLowerCase()}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Recent tables */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Quotations */}
        <Card className="shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold">Cotizaciones recientes</CardTitle>
              <button
                onClick={() => router.push('/quotations')}
                className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/60">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide pl-5">Nº Cot.</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Título</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-right pr-5">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : recentQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center">
                      <FileText className="mx-auto h-7 w-7 mb-2 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">Sin cotizaciones aún</p>
                    </TableCell>
                  </TableRow>
                ) : recentQuotations.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/quotations/detail?id=${q.id}`)}>
                    <TableCell className="font-mono text-xs pl-5">{q.quotationNumber}</TableCell>
                    <TableCell className="text-sm max-w-[130px] truncate">{q.title}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[q.status] || STATUS_CHIP.DRAFT}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right pr-5">{Number(q.total || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold">Proyectos recientes</CardTitle>
              <button
                onClick={() => router.push('/projects')}
                className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/60">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide pl-5">Código</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Nombre</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-right pr-5">Presupuesto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : recentProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center">
                      <FolderKanban className="mx-auto h-7 w-7 mb-2 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">Sin proyectos aún</p>
                    </TableCell>
                  </TableRow>
                ) : recentProjects.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/projects/detail?id=${p.id}`)}>
                    <TableCell className="font-mono text-xs pl-5">{p.projectCode}</TableCell>
                    <TableCell className="text-sm max-w-[130px] truncate">{p.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[p.status] || STATUS_CHIP.PLANNING}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right pr-5">{Number(p.approvedBudget || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
