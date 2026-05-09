'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import { ProjectQueryStatus } from '@fym/shared';
import { useAuth } from '@/lib/auth';
import { queriesApi } from '@/lib/queries-api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QueryStatusBadge } from '@/components/queries/QueryStatusBadge';
import { QueryThread } from '@/components/queries/QueryThread';
import { ReplyDialog } from '@/components/queries/ReplyDialog';

export default function QueryDetailClientPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const { addToast } = useToast();
  const projectId = search.get('projectId') || '';
  const queryId = search.get('id') || '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyOpen, setReplyOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    if (!projectId || !queryId) {
      setLoading(false);
      setData(null);
      return;
    }
    try {
      setLoading(true);
      const detail = await queriesApi.detail(projectId, queryId, token);
      setData(detail);
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, projectId, queryId, token]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const submitReply = async (body: string) => {
    if (!token) return;
    await queriesApi.addMessage(projectId, queryId, token, { body });
    addToast('Respuesta enviada', 'success');
    await load();
  };

  const updateStatus = async (status: ProjectQueryStatus) => {
    if (!token) return;
    try {
      await queriesApi.updateStatus(projectId, queryId, token, status);
      addToast('Estado actualizado', 'success');
      await load();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">Cargando detalle...</div>;
  if (!data) return <div className="p-8 text-center text-sm text-slate-500">Consulta no encontrada.</div>;

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/queries')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{data.title}</h1>
            <p className="text-sm text-slate-500">Proyecto: {projectId}</p>
          </div>
        </div>
        <Button onClick={() => setReplyOpen(true)}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Responder
        </Button>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Estado de la consulta</CardTitle>
          <QueryStatusBadge status={data.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">{data.description}</p>
          <Select value={data.status} onValueChange={(value) => updateStatus(value as ProjectQueryStatus)}>
            <SelectTrigger className="md:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Abierta</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="RESOLVED">Resuelta</SelectItem>
              <SelectItem value="CLOSED">Cerrada</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hilo de mensajes</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryThread messages={data.messages || []} />
        </CardContent>
      </Card>

      <ReplyDialog open={replyOpen} onOpenChange={setReplyOpen} onSubmit={submitReply} />
    </div>
  );
}
