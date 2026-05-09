'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquarePlus } from 'lucide-react';
import { ProjectQueryPriority } from '@fym/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { queriesApi, type ProjectQueryItem } from '@/lib/queries-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { QueryTable } from '@/components/queries/QueryTable';

export default function QueriesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProject = searchParams.get('projectId') || '';
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(initialProject);
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [items, setItems] = useState<ProjectQueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: ProjectQueryPriority.MEDIUM });

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<any>('/projects?page=1&pageSize=100', token);
      const list = res.data || [];
      setProjects(list);
      setProjectId((current) => current || list[0]?.id || '');
    } catch (error: any) {
      addToast(error.message, 'error');
      setProjects([]);
      setLoading(false);
    }
  }, [addToast, token]);

  const loadQueries = useCallback(async () => {
    if (!token) return;
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await queriesApi.listByProject(projectId, token, { status, priority });
      setItems(data);
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, priority, projectId, status, token]);

  useEffect(() => {
    loadProjects().catch(() => undefined);
  }, [loadProjects]);

  useEffect(() => {
    loadQueries().catch(() => undefined);
  }, [loadQueries]);

  const metrics = useMemo(() => ({
    open: items.filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length,
    resolved: items.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
  }), [items]);

  const createQuery = async () => {
    if (!token || !projectId) return;
    if (!form.title.trim() || !form.description.trim()) {
      addToast('Completa título y descripción', 'error');
      return;
    }
    try {
      await queriesApi.create(projectId, token, {
        title: form.title,
        description: form.description,
        priority: form.priority,
      });
      addToast('Consulta creada', 'success');
      setCreateOpen(false);
      setForm({ title: '', description: '', priority: ProjectQueryPriority.MEDIUM });
      await loadQueries();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Consultas y cambios</h1>
          <p className="text-sm text-slate-500">Canal único auditado entre FYM y cliente por proyecto.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Nueva consulta
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Abiertas</p><p className="text-2xl font-black">{metrics.open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Resueltas/Cerradas</p><p className="text-2xl font-black">{metrics.resolved}</p></CardContent></Card>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row">
        <Select value={projectId || '__none__'} onValueChange={(value) => setProjectId(value === '__none__' ? '' : value)}>
          <SelectTrigger className="md:w-[320px]"><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin proyecto</SelectItem>
            {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.projectCode} · {project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="OPEN">Abiertas</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="RESOLVED">Resueltas</SelectItem>
            <SelectItem value="CLOSED">Cerradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="md:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las prioridades</SelectItem>
            <SelectItem value="LOW">Baja</SelectItem>
            <SelectItem value="MEDIUM">Media</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="URGENT">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando consultas...</div>
        ) : (
          <QueryTable items={items} onOpen={(queryId) => router.push(`/queries/detail?projectId=${projectId}&id=${queryId}`)} />
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva consulta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as ProjectQueryPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea rows={5} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createQuery}>Crear consulta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
