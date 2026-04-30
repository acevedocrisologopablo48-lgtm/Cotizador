import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MilestoneStatus } from '@fym/shared';

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

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  targetDate: { seconds: number; nanoseconds: number };
  completedDate: { seconds: number; nanoseconds: number } | null;
  linkedTaskCount: number;
  completedTaskCount: number;
  createdById: string;
  isActive: boolean;
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
}

export function useProjectMilestones(projectId: string, refreshKey = 0) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!projectId) {
      setMilestones([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(`/projects/${projectId}/milestones`);
        const raw = Array.isArray(res) ? res : res?.data || [];
        const fetchedMilestones: ProjectMilestone[] = raw.map((milestone: any) => ({
          ...milestone,
          targetDate: toTimestampLike(milestone.targetDate) || { seconds: 0, nanoseconds: 0 },
          completedDate: toTimestampLike(milestone.completedDate),
          createdAt: toTimestampLike(milestone.createdAt) || { seconds: 0, nanoseconds: 0 },
          updatedAt: toTimestampLike(milestone.updatedAt) || { seconds: 0, nanoseconds: 0 },
        }));
        if (!mounted) return;
        setMilestones(fetchedMilestones);
        setError(null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error('No se pudieron cargar los hitos'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [projectId, refreshKey]);

  return { milestones, loading, error };
}
