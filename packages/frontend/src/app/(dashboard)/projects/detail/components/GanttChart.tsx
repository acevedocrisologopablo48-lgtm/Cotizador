'use client';

import { useMemo } from 'react';
import { ProjectTask } from '../../hooks/useProjectTasks';
import { TaskStatus, TASK_STATUS_LABELS } from '@fym/shared';
import { format, differenceInDays, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface GanttChartProps {
  tasks: ProjectTask[];
  onTaskClick?: (task: ProjectTask) => void;
}

export function GanttChart({ tasks, onTaskClick }: GanttChartProps) {
  // Solo tareas con startDate y dueDate
  const scheduledTasks = useMemo(() => {
    return tasks
      .filter((t) => t.startDate && t.dueDate)
      .sort((a, b) => a.startDate!.seconds - b.startDate!.seconds);
  }, [tasks]);

  const { timelineStart, timelineEnd, totalDays, days } = useMemo(() => {
    if (scheduledTasks.length === 0) {
      const today = startOfDay(new Date());
      return { timelineStart: today, timelineEnd: addDays(today, 30), totalDays: 30, days: [] };
    }

    let minDate = new Date(scheduledTasks[0].startDate!.seconds * 1000);
    let maxDate = new Date(scheduledTasks[0].dueDate!.seconds * 1000);

    scheduledTasks.forEach((t) => {
      const start = new Date(t.startDate!.seconds * 1000);
      const end = new Date(t.dueDate!.seconds * 1000);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    // Añadir un pequeño margen antes y después
    const timelineStart = addDays(startOfDay(minDate), -3);
    const timelineEnd = addDays(startOfDay(maxDate), 7);
    const totalDays = differenceInDays(timelineEnd, timelineStart);

    const days = [];
    for (let i = 0; i <= totalDays; i++) {
      days.push(addDays(timelineStart, i));
    }

    return { timelineStart, timelineEnd, totalDays, days };
  }, [scheduledTasks]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE: return 'bg-green-500';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-500';
      case TaskStatus.IN_REVIEW: return 'bg-purple-500';
      case TaskStatus.TODO: return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  if (scheduledTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-900/50 rounded-2xl border border-white/5">
        <p>No hay tareas programadas con fechas de inicio y fin definidas para mostrar en el Gantt.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-white/5 flex gap-4 items-center bg-slate-900">
        <h3 className="font-semibold text-sm tracking-wider uppercase text-slate-300">
          Cronograma (Gantt)
        </h3>
        <div className="flex gap-4 ml-auto text-xs">
          {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-slate-400">
              <div className={`w-3 h-3 rounded-sm ${getStatusColor(key as TaskStatus)}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        <div className="inline-block min-w-full">
          {/* Header Row (Fechas) */}
          <div className="flex border-b border-white/5 sticky top-0 bg-slate-950 z-10">
            <div className="w-64 min-w-[256px] flex-shrink-0 border-r border-white/5 p-3 font-semibold text-xs text-slate-400 uppercase tracking-widest bg-slate-950">
              Tarea
            </div>
            <div className="flex flex-1">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 w-10 flex flex-col items-center justify-center border-r border-white/5 py-2 text-[10px] ${
                    day.getDay() === 0 || day.getDay() === 6 ? 'bg-white/[0.02] text-slate-500' : 'text-slate-300'
                  } ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-primary/20 text-primary font-bold' : ''}`}
                >
                  <span className="opacity-50">{format(day, 'EE', { locale: es })}</span>
                  <span>{format(day, 'dd')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div className="flex flex-col pb-4">
            {scheduledTasks.map((task) => {
              const start = startOfDay(new Date(task.startDate!.seconds * 1000));
              const end = startOfDay(new Date(task.dueDate!.seconds * 1000));
              
              const offsetDays = differenceInDays(start, timelineStart);
              const durationDays = differenceInDays(end, start) + 1; // Inclusive

              const leftPosition = offsetDays * 40; // 40px por día (w-10)
              const width = durationDays * 40;

              return (
                <div key={task.id} className="flex border-b border-white/5 hover:bg-white/[0.02] group">
                  <div className="w-64 min-w-[256px] flex-shrink-0 border-r border-white/5 p-3 flex flex-col justify-center bg-slate-950 group-hover:bg-slate-900 transition-colors cursor-pointer" onClick={() => onTaskClick?.(task)}>
                    <div className="text-xs font-medium text-white truncate pr-2">{task.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex justify-between items-center pr-2">
                      <span>{task.assigneeName || 'Sin Asignar'}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative min-h-[48px]">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((day, i) => (
                        <div key={i} className={`flex-shrink-0 w-10 border-r border-white/5 ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-white/[0.01]' : ''}`} />
                      ))}
                    </div>

                    {/* Task Bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm cursor-pointer transition-transform hover:scale-[1.02] hover:brightness-110 group flex items-center px-2 z-10"
                      style={{
                        left: `${leftPosition}px`,
                        width: `${width}px`,
                      }}
                      onClick={() => onTaskClick?.(task)}
                    >
                      <div className={`absolute inset-0 rounded-md opacity-20 ${getStatusColor(task.status)}`} />
                      <div className={`absolute inset-0 rounded-md border border-white/20 ${getStatusColor(task.status)}`} />
                      <span className="relative text-[10px] font-bold text-white truncate drop-shadow-md z-10">
                        {durationDays}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
