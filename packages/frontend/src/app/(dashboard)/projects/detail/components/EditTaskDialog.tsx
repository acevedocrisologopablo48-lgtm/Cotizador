'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TaskPriority, TaskStatus } from '@fym/shared';
import { useProjectMilestones } from '../../hooks/useProjectMilestones';
import { ProjectTask } from '../../hooks/useProjectTasks';
import { format } from 'date-fns';

interface EditTaskDialogProps {
  projectId: string;
  task: ProjectTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditTaskDialog({ projectId, task, open, onOpenChange, onSuccess }: EditTaskDialogProps) {
  const { toast } = useToast();
  const { milestones } = useProjectMilestones(projectId);
  const [users, setUsers] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('unassigned');
  const [milestoneId, setMilestoneId] = useState<string>('none');

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setStartDate(task.startDate ? format(new Date(task.startDate.seconds * 1000), 'yyyy-MM-dd') : '');
      setDueDate(task.dueDate ? format(new Date(task.dueDate.seconds * 1000), 'yyyy-MM-dd') : '');
      setAssigneeId(task.assigneeId || 'unassigned');
      setMilestoneId(task.milestoneId || 'none');
    }
  }, [task]);

  const loadUsers = async () => {
    try {
      const res = await api.get<any>('/auth/users/assignable');
      setUsers(Array.isArray(res) ? res : res.data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    if (!title) {
      toast({ title: 'El título es obligatorio', variant: 'destructive' });
      return;
    }

    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      toast({ title: 'La fecha de fin no puede ser anterior a la fecha de inicio', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await api.put(`/projects/${projectId}/tasks/${task.id}`, {
        title,
        description: description || null,
        priority,
        status,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId !== 'unassigned' ? assigneeId : null,
        milestoneId: milestoneId !== 'none' ? milestoneId : null,
      });

      toast({ title: 'Tarea actualizada con éxito' });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar cotización #123"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales sobre la tarea..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskPriority.LOW}>Baja</SelectItem>
                  <SelectItem value={TaskPriority.MEDIUM}>Media</SelectItem>
                  <SelectItem value={TaskPriority.HIGH}>Alta</SelectItem>
                  <SelectItem value={TaskPriority.URGENT}>Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskStatus.TODO}>Por Hacer</SelectItem>
                  <SelectItem value={TaskStatus.IN_PROGRESS}>En Progreso</SelectItem>
                  <SelectItem value={TaskStatus.IN_REVIEW}>En Revisión</SelectItem>
                  <SelectItem value={TaskStatus.DONE}>Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.displayName || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hito asociado</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Fecha de inicio</Label>
              <Input
                id="edit-startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dueDate">Fecha de fin</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
