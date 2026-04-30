'use client';

import { useState } from 'react';
import { useProjectTasks } from '../../hooks/useProjectTasks';
import { useProjectMilestones } from '../../hooks/useProjectMilestones';
import { KanbanBoard } from './KanbanBoard';
import { GanttChart } from './GanttChart';
import { ProjectActivity } from './ProjectActivity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Kanban, BarChartHorizontal, Activity, Target, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateTaskDialog } from './CreateTaskDialog';
import { CreateMilestoneDialog } from './CreateMilestoneDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { ProjectTask } from '../../hooks/useProjectTasks';

interface ProjectManagementModuleProps {
  projectId: string;
}

export function ProjectManagementModule({ projectId }: ProjectManagementModuleProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { tasks, loading: loadingTasks } = useProjectTasks(projectId, refreshKey);
  const { milestones, loading: loadingMilestones } = useProjectMilestones(projectId, refreshKey);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const refreshProjectManagement = () => setRefreshKey((prev) => prev + 1);

  const handleTaskClick = (task: ProjectTask) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="kanban" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList className="bg-slate-950/20 border border-white/[0.05] p-1.5 rounded-2xl h-auto flex flex-wrap gap-2">
          <TabsTrigger value="kanban" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all flex items-center">
            <Kanban className="mr-2 h-4 w-4" />
            Tablero Kanban
          </TabsTrigger>
          <TabsTrigger value="gantt" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all flex items-center">
            <BarChartHorizontal className="mr-2 h-4 w-4" />
            Cronograma Gantt
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all flex items-center">
            <Activity className="mr-2 h-4 w-4" />
            Actividad
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsTaskDialogOpen(true)} className="rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-white font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarea
          </Button>
          <Button onClick={() => setIsMilestoneDialogOpen(true)} disabled={loadingMilestones} variant="outline" className="rounded-xl border-white/[0.1] bg-white/5 hover:bg-white/10 text-white">
            <Target className="mr-2 h-4 w-4" />
            Nuevo Hito
          </Button>
        </div>
      </div>

        <TabsContent value="kanban" className="mt-0 focus-visible:outline-none">
          <div className="h-[600px]">
            {loadingTasks ? (
              <div className="h-full flex items-center justify-center text-slate-500">Cargando tareas...</div>
            ) : (
              <KanbanBoard projectId={projectId} tasks={tasks} onTaskClick={handleTaskClick} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="gantt" className="mt-0 focus-visible:outline-none">
          <div className="h-[600px]">
            {loadingTasks ? (
              <div className="h-full flex items-center justify-center text-slate-500">Cargando tareas...</div>
            ) : (
              <GanttChart tasks={tasks} onTaskClick={handleTaskClick} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-6 max-w-3xl">
            <h3 className="font-semibold text-lg mb-6 text-white">Registro de Actividad</h3>
            <ProjectActivity projectId={projectId} refreshKey={refreshKey} />
          </Card>
        </TabsContent>
      </Tabs>

      <CreateTaskDialog 
        projectId={projectId} 
        open={isTaskDialogOpen} 
        onOpenChange={setIsTaskDialogOpen} 
        onSuccess={refreshProjectManagement}
      />
      
      <CreateMilestoneDialog 
        projectId={projectId} 
        open={isMilestoneDialogOpen} 
        onOpenChange={setIsMilestoneDialogOpen} 
        onSuccess={refreshProjectManagement}
      />

      <EditTaskDialog
        projectId={projectId}
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={refreshProjectManagement}
      />
    </div>
  );
}
