'use client';

import { useProjectActivityLog, ProjectActivityLog } from '../../hooks/useProjectActivityLog';
import { ProjectActivityAction } from '@fym/shared';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, CheckCircle, Clock, Edit, FilePlus, UserPlus, UserMinus, Play } from 'lucide-react';

interface ProjectActivityProps {
  projectId: string;
  refreshKey?: number;
}

const ACTION_LABELS: Record<ProjectActivityAction, string> = {
  [ProjectActivityAction.TASK_CREATED]: 'creó la tarea',
  [ProjectActivityAction.TASK_UPDATED]: 'actualizó la tarea',
  [ProjectActivityAction.TASK_STATUS_CHANGED]: 'cambió el estado de la tarea',
  [ProjectActivityAction.TASK_ASSIGNED]: 'asignó la tarea',
  [ProjectActivityAction.TASK_DELETED]: 'eliminó la tarea',
  [ProjectActivityAction.MILESTONE_CREATED]: 'creó el hito',
  [ProjectActivityAction.MILESTONE_COMPLETED]: 'completó el hito',
  [ProjectActivityAction.MILESTONE_UPDATED]: 'actualizó el hito',
  [ProjectActivityAction.PROJECT_STATUS_CHANGED]: 'cambió el estado del proyecto a',
  [ProjectActivityAction.PROJECT_UPDATED]: 'actualizó el proyecto',
  [ProjectActivityAction.MEMBER_ADDED]: 'añadió al miembro',
  [ProjectActivityAction.MEMBER_REMOVED]: 'removió al miembro',
};

const getActionIcon = (action: ProjectActivityAction) => {
  switch (action) {
    case ProjectActivityAction.TASK_CREATED:
    case ProjectActivityAction.MILESTONE_CREATED:
      return <FilePlus className="h-4 w-4 text-emerald-400" />;
    case ProjectActivityAction.TASK_STATUS_CHANGED:
      return <Play className="h-4 w-4 text-blue-400" />;
    case ProjectActivityAction.MILESTONE_COMPLETED:
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case ProjectActivityAction.TASK_ASSIGNED:
    case ProjectActivityAction.MEMBER_ADDED:
      return <UserPlus className="h-4 w-4 text-indigo-400" />;
    case ProjectActivityAction.MEMBER_REMOVED:
      return <UserMinus className="h-4 w-4 text-red-400" />;
    default:
      return <Edit className="h-4 w-4 text-slate-400" />;
  }
};

export function ProjectActivity({ projectId, refreshKey = 0 }: ProjectActivityProps) {
  const { logs, loading } = useProjectActivityLog(projectId, 50, refreshKey);

  if (loading) {
    return (
      <div className="flex justify-center p-8 text-slate-500">
        <Activity className="h-5 w-5 animate-spin mr-2" />
        Cargando actividad...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-white/5">
        No hay actividad reciente en este proyecto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative border-l border-white/10 ml-3 space-y-8 pb-4">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-6">
            <div className="absolute -left-[17px] top-1 p-1 bg-slate-950 border border-white/10 rounded-full">
              {getActionIcon(log.action)}
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-sm text-slate-300">
                <span className="font-semibold text-white">{log.userName}</span>{' '}
                {ACTION_LABELS[log.action]}{' '}
                {log.details.entityTitle && (
                  <span className="font-medium text-white">&quot;{log.details.entityTitle}&quot;</span>
                )}
              </div>
              
              {/* Detalles adicionales (e.g. cambios de estado) */}
              {log.action === ProjectActivityAction.TASK_STATUS_CHANGED && log.details.oldValue && log.details.newValue && (
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">{log.details.oldValue}</span>
                  <span>→</span>
                  <span className="bg-primary/20 text-primary px-2 py-0.5 rounded">{log.details.newValue}</span>
                </div>
              )}

              <div className="flex items-center text-[10px] text-slate-500 mt-1">
                <Clock className="h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(log.createdAt.seconds * 1000), { addSuffix: true, locale: es })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
