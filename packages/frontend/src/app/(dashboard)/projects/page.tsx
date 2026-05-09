'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Archive, Calendar, CircleDollarSign, ClipboardList, FolderKanban, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';

const CLOSED_STATUSES = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);

const ALERT_META: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  RED: {
    label: 'Materiales vencidos',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
  },
  YELLOW: {
    label: 'Materiales urgentes',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  GREEN: {
    label: 'Sin urgencias',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
};

export default function ProjectsPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [accountingMonth, setAccountingMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const isClient = user?.role === 'CLIENT';

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const status = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
      const res = await api.get<any>(`/projects?page=1&pageSize=100${status}`, token);
      setProjects(res.data || []);
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, statusFilter, token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => {
      const haystack = [
        project.projectCode,
        project.name,
        project.description,
        project.company?.tradeName,
        project.company?.businessName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, search]);

  const activeProjects = filtered.filter((project) => !CLOSED_STATUSES.has(project.status));
  const closedProjects = filtered.filter((project) => CLOSED_STATUSES.has(project.status));

  const dashboardStats = [
    { label: 'Vigentes', value: activeProjects.length, icon: FolderKanban },
    { label: 'Cerrados', value: closedProjects.length, icon: Archive },
    isClient
      ? {
          label: 'Informes',
          value: activeProjects.length,
          icon: ClipboardList,
        }
      : {
          label: 'Alertas rojas',
          value: activeProjects.filter((project) => project.materialAlert?.level === 'RED').length,
          icon: AlertTriangle,
        },
    {
      label: 'Avance promedio',
      value: `${Math.round(average(activeProjects.map((project) => project.progressSummary?.averagePercent || 0)))}%`,
      icon: ClipboardList,
    },
  ];

  const exportAccounting = async () => {
    try {
      await api.download(
        `/projects/exports/accounting?month=${encodeURIComponent(accountingMonth)}`,
        `compras-proyectos-${accountingMonth}.csv`,
        token!,
      );
      addToast('Reporte contable exportado', 'success');
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Proyectos</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {isClient ? 'Acceso VIP al cuaderno de obras digital e informes de tus proyectos.' : 'Panel operativo de trabajos vigentes, cerrados, materiales, costos y avance de obra.'}
              </p>
            </div>
          </div>
        </div>

        {!isClient && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="month"
            value={accountingMonth}
            onChange={(event) => setAccountingMonth(event.target.value)}
            className="h-10 w-full sm:w-[160px]"
          />
          <Button variant="outline" onClick={exportAccounting} className="h-10">
            <CircleDollarSign className="mr-2 h-4 w-4" />
            Exportar compras
          </Button>
        </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.label} className="rounded-lg border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por codigo, cliente o descripcion..."
            className="h-11 pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full md:w-[220px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="PLANNING">Planificacion</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="PAUSED">En pausa</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="CLOSED">Cerrado</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <ProjectSection
        title="Vigentes"
        description="Trabajos activos en pantalla principal. Los completados se separan automaticamente en Cerrados."
        projects={activeProjects}
        loading={loading}
        isClient={isClient}
        onOpen={(id) => router.push(`/projects/detail?id=${id}`)}
      />

      <ProjectSection
        title="Cerrados"
        description="Historial de proyectos completados, cerrados o cancelados."
        projects={closedProjects}
        loading={loading}
        muted
        isClient={isClient}
        onOpen={(id) => router.push(`/projects/detail?id=${id}`)}
      />
    </div>
  );
}

function ProjectSection({
  title,
  description,
  projects,
  loading,
  muted,
  isClient,
  onOpen,
}: {
  title: string;
  description: string;
  projects: any[];
  loading: boolean;
  muted?: boolean;
  isClient?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <Badge variant="secondary" className="rounded-md px-3 py-1 text-xs font-black">
          {projects.length}
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-medium text-slate-500">
          No hay proyectos en esta lista.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} muted={muted} onOpen={() => onOpen(project.id)} isClient={isClient} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project, muted, onOpen, isClient }: { project: any; muted?: boolean; onOpen: () => void; isClient?: boolean }) {
  const alert = ALERT_META[project.materialAlert?.level || 'GREEN'];
  const progress = Math.round(project.progressSummary?.averagePercent || 0);
  const client = project.company?.tradeName || project.company?.businessName || (project.isInternal ? 'FYM Technologies' : 'Sin cliente asociado');
  const brief = project.description || project.quotation?.title || 'Sin descripcion registrada';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group rounded-lg border bg-white p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        muted ? 'border-slate-200 opacity-80' : 'border-slate-200'
      }`}
    >
      <div className="flex h-full flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs font-black text-white">
                {project.projectCode}
              </span>
              {project.isInternal && <Badge className="rounded-md bg-indigo-600">Interno</Badge>}
            </div>
            <h3 className="mt-3 line-clamp-2 text-lg font-black leading-tight text-slate-900 group-hover:text-primary">
              {project.name}
            </h3>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cliente</p>
          <p className="truncate text-sm font-bold text-slate-700">{client}</p>
          <p className="line-clamp-2 text-sm leading-6 text-slate-500">{brief}</p>
        </div>

        <div className={`grid gap-3 ${isClient ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avance</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <p className="mt-2 font-mono text-sm font-black text-slate-800">{progress}%</p>
          </div>
          {!isClient && <div className={`rounded-md border p-3 ${alert.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${alert.dot}`} />
              <p className={`text-[10px] font-black uppercase tracking-widest ${alert.text}`}>Semaforo</p>
            </div>
            <p className={`mt-2 text-sm font-black ${alert.text}`}>{alert.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {project.materialAlert?.pending || 0} pendientes
            </p>
          </div>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(project.plannedStartDate || project.actualStartDate || project.createdAt)}
          </span>
          <span className="font-black text-primary">Abrir detalle</span>
        </div>
      </div>
    </button>
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-PE');
}
