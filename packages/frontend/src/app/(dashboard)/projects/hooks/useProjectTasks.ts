import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TaskStatus, TaskPriority } from '@fym/shared';

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

export interface ProjectTask {
  id: string;
  projectId: string;
  taskCode: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  order: number;
  startDate: { seconds: number; nanoseconds: number } | null;
  dueDate: { seconds: number; nanoseconds: number } | null;
  completedDate: { seconds: number; nanoseconds: number } | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string;
  milestoneId: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  isActive: boolean;
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
}

export function useProjectTasks(projectId: string, refreshKey = 0) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(`/projects/${projectId}/tasks`);
        const raw = Array.isArray(res) ? res : res?.data || [];
        const fetchedTasks: ProjectTask[] = raw.map((task: any) => ({
          ...task,
          startDate: toTimestampLike(task.startDate),
          dueDate: toTimestampLike(task.dueDate),
          completedDate: toTimestampLike(task.completedDate),
          createdAt: toTimestampLike(task.createdAt) || { seconds: 0, nanoseconds: 0 },
          updatedAt: toTimestampLike(task.updatedAt) || { seconds: 0, nanoseconds: 0 },
        }));
        if (!mounted) return;
        setTasks(fetchedTasks);
        setError(null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error('No se pudieron cargar las tareas'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [projectId, refreshKey]);

  return { tasks, loading, error };
}
