import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProjectActivityAction } from '@fym/shared';

export interface ProjectActivityLog {
  id: string;
  projectId: string;
  action: ProjectActivityAction;
  entityType: 'TASK' | 'MILESTONE' | 'PROJECT';
  entityId: string;
  details: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    entityTitle?: string;
  };
  userId: string;
  userName: string;
  createdAt: { seconds: number; nanoseconds: number };
}

type TimestampLike = { seconds: number; nanoseconds: number };

const toTimestampLike = (value: unknown): TimestampLike | null => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const v = value as { seconds: number; nanoseconds?: number };
    return { seconds: Number(v.seconds) || 0, nanoseconds: Number(v.nanoseconds) || 0 };
  }
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
  };
};

export function useProjectActivityLog(projectId: string, limitCount = 50, refreshKey = 0) {
  const [logs, setLogs] = useState<ProjectActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!projectId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(`/projects/${projectId}/activity?limit=${limitCount}`);
        const raw = Array.isArray(res) ? res : res?.data || [];
        const fetchedLogs: ProjectActivityLog[] = raw.map((log: any) => ({
          ...log,
          createdAt: toTimestampLike(log.createdAt) || { seconds: 0, nanoseconds: 0 },
        }));
        if (!mounted) return;
        setLogs(fetchedLogs);
        setError(null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error('No se pudo cargar la actividad'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [projectId, limitCount, refreshKey]);

  return { logs, loading, error };
}
