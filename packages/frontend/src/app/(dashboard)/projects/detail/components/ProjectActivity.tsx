'use client';

import { useProjectActivityLog } from '../../hooks/useProjectActivityLog';
import { ProjectActivityAction } from '@fym/shared';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, CheckCircle, Clock, Edit, FilePlus, UserPlus, UserMinus, Play } from 'lucide-react';

interface ProjectActivityProps {
  projectId: string;
  refreshKey?: number;
}

const ACTION_LABELS: Record<ProjectActivityAction, string> = {
  [ProjectActivityAction.TASK_CREATED]: 'creo la tarea',
  [ProjectActivityAction.TASK_UPDATED]: 'actualizo la tarea',
  [ProjectActivityAction.TASK_STATUS_CHANGED]: 'cambio el estado de la tarea',
  [ProjectActivityAction.TASK_ASSIGNED]: 'asigno la tarea',
  [ProjectActivityAction.TASK_DELETED]: 'elimino la tarea',
  [ProjectActivityAction.MILESTONE_CREATED]: 'creo el hito',
  [ProjectActivityAction.MILESTONE_COMPLETED]: 'completo el hito',
  [ProjectActivityAction.MILESTONE_UPDATED]: 'actualizo el hito',
  [ProjectActivityAction.PROJECT_STATUS_CHANGED]: 'cambio el estado del proyecto a',
  [ProjectActivityAction.PROJECT_UPDATED]: 'actualizo el proyecto',
  [ProjectActivityAction.MEMBER_ADDED]: 'anadio al miembro',
  [ProjectActivityAction.MEMBER_REMOVED]: 'removio al miembro',
};

const getActionIcon = (action: ProjectActivityAction) => {
  switch (action) {
    case ProjectActivityAction.TASK_CREATED:
    case ProjectActivityAction.MILESTONE_CREATED:
      return <FilePlus className="h-4 w-4 text-emerald-500" />;
    case ProjectActivityAction.TASK_STATUS_CHANGED:
      return <Play className="h-4 w-4 text-blue-500" />;
    case ProjectActivityAction.MILESTONE_COMPLETED:
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case ProjectActivityAction.TASK_ASSIGNED:
    case ProjectActivityAction.MEMBER_ADDED:
      return <UserPlus className="h-4 w-4 text-indigo-500" />;
    case ProjectActivityAction.MEMBER_REMOVED:
      return <UserMinus className="h-4 w-4 text-red-500" />;
    default:
      return <Edit className="h-4 w-4 text-slate-500" />;
  }
};

export function ProjectActivity({ projectId, refreshKey = 0 }: ProjectActivityProps) {
  const { logs, loading } = useProjectActivityLog(projectId, 50, refreshKey);

  if (loading) {
    return (
      <div className="flex justify-center p-8 text-slate-500">
        <Activity className="mr-2 h-5 w-5 animate-spin" />
        Cargando actividad...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
        No hay actividad reciente en este proyecto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative ml-3 space-y-5 border-l border-slate-200 pb-4">
        {logs.map((log) => {
          const actorName = log.userName?.trim() || 'Usuario del sistema';
          const entityTitle = log.details?.entityTitle;

          return (
            <div key={log.id} className="relative pl-7">
              <div className="absolute -left-[17px] top-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {getActionIcon(log.action)}
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-sm text-slate-700">
                  <span className="font-black text-slate-950">{actorName}</span>{' '}
                  <span>{ACTION_LABELS[log.action] || 'registro actividad'}</span>{' '}
                  {entityTitle && (
                    <span className="font-bold text-primary">&quot;{entityTitle}&quot;</span>
                  )}
                </div>

                {log.action === ProjectActivityAction.TASK_STATUS_CHANGED && log.details.oldValue && log.details.newValue && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">{log.details.oldValue}</span>
                    <span>-&gt;</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{log.details.newValue}</span>
                  </div>
                )}

                <div className="mt-1 flex items-center text-[11px] font-semibold text-slate-500">
                  <Clock className="mr-1 h-3 w-3" />
                  {formatDistanceToNow(new Date(log.createdAt.seconds * 1000), { addSuffix: true, locale: es })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
