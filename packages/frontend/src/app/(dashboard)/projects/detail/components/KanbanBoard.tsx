'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ProjectTask } from '../../hooks/useProjectTasks';
import { TaskStatus, TASK_STATUS_LABELS, TaskPriority, TASK_PRIORITY_LABELS } from '@fym/shared';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Calendar, Clock, AlignLeft, GripVertical } from 'lucide-react';
import { format } from 'date-fns';

interface KanbanBoardProps {
  projectId: string;
  tasks: ProjectTask[];
  onTaskClick?: (task: ProjectTask) => void;
}

const COLUMNS: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
];

export function KanbanBoard({ projectId, tasks, onTaskClick }: KanbanBoardProps) {
  const { toast } = useToast();
  // We keep a local optimistic state for smooth drag and drop
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>(tasks);
  
  useEffect(() => {
    // Sync local tasks with props from Firestore when they update
    // But we might want to avoid overriding during a drag.
    // For simplicity, we sync it directly.
    setLocalTasks(tasks);
  }, [tasks]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const startStatus = source.droppableId as TaskStatus;
    const endStatus = destination.droppableId as TaskStatus;

    // Optimistic UI update
    const newTasks = Array.from(localTasks);
    const draggedTask = newTasks.find((t) => t.id === draggableId);
    
    if (!draggedTask) return;

    // Remove from old array, add to new array
    const startTasks = newTasks.filter(t => t.status === startStatus).sort((a, b) => a.order - b.order);
    const endTasks = startStatus === endStatus ? startTasks : newTasks.filter(t => t.status === endStatus).sort((a, b) => a.order - b.order);

    startTasks.splice(source.index, 1);
    
    if (startStatus === endStatus) {
      startTasks.splice(destination.index, 0, draggedTask);
      // Re-calculate orders for the column
      startTasks.forEach((t, i) => { t.order = i; });
    } else {
      draggedTask.status = endStatus;
      endTasks.splice(destination.index, 0, draggedTask);
      // Re-calculate orders for both columns
      startTasks.forEach((t, i) => { t.order = i; });
      endTasks.forEach((t, i) => { t.order = i; });
    }

    setLocalTasks([...newTasks]);

    try {
      await api.patch(`/projects/${projectId}/tasks/${draggableId}/status`, {
        status: endStatus,
        order: destination.index,
      });
      // Firestore onSnapshot will eventually trigger and update `tasks` prop
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado de la tarea',
        variant: 'destructive',
      });
      // Revert optimistic update
      setLocalTasks(tasks);
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'bg-red-500/10 text-red-500 border-red-500/20';
      case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case TaskPriority.MEDIUM: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case TaskPriority.LOW: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6 h-full items-start overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const columnTasks = localTasks
            .filter((task) => task.status === status)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={status} className="flex-1 min-w-[300px] max-w-[400px] flex flex-col bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                <h3 className="font-semibold text-sm tracking-wider uppercase text-slate-300">
                  {TASK_STATUS_LABELS[status]}
                </h3>
                <Badge variant="outline" className="bg-slate-950/50">{columnTasks.length}</Badge>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-4 flex flex-col gap-3 min-h-[150px] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-primary/5' : ''
                    }`}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onTaskClick?.(task)}
                            className={`group relative bg-slate-950 border border-white/10 rounded-xl p-4 cursor-grab hover:border-primary/50 transition-all ${
                              snapshot.isDragging ? 'shadow-2xl shadow-primary/20 border-primary rotate-2 scale-105 z-50' : 'hover:shadow-lg'
                            }`}
                          >
                            {/* Drag Handle Icon (Optional visual cue) */}
                            <div className="absolute top-4 right-3 opacity-0 group-hover:opacity-50 transition-opacity">
                              <GripVertical className="h-4 w-4" />
                            </div>

                            <div className="flex gap-2 mb-3">
                              <Badge className="text-[10px] uppercase font-bold tracking-wider" variant="secondary">
                                {task.taskCode}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${getPriorityColor(task.priority)}`}>
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </Badge>
                            </div>

                            <h4 className="font-medium text-sm text-white mb-2 leading-tight pr-6">
                              {task.title}
                            </h4>

                            {task.description && (
                              <div className="flex items-center text-xs text-slate-400 mb-4">
                                <AlignLeft className="h-3 w-3 mr-1" />
                                <span className="truncate">{task.description}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                              {task.assigneeName ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-slate-950">
                                    {task.assigneeName.charAt(0)}
                                  </div>
                                  <span className="text-xs text-slate-300 truncate max-w-[100px]">{task.assigneeName}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic">Sin asignar</span>
                              )}

                              {task.dueDate && (
                                <div className={`flex items-center text-xs ${task.status !== TaskStatus.DONE && new Date(task.dueDate.seconds * 1000) < new Date() ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {format(new Date(task.dueDate.seconds * 1000), 'MMM dd')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
