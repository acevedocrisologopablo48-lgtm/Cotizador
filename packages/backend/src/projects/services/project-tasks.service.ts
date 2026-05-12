import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectActivityService } from './project-activity.service';
import { TaskStatus, TaskPriority, ProjectActivityAction } from '@fym/shared';

@Injectable()
export class ProjectTasksService {
  constructor(
    private firebase: FirebaseService,
    private activityLog: ProjectActivityService,
  ) {}

  private get col() {
    return this.firebase.db.collection('projectTasks');
  }

  private async assertProject(projectId: string) {
    const doc = await this.firebase.db.collection('projects').doc(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    return doc;
  }

  private async pushAssignmentNotification(params: {
    projectId: string;
    projectCode?: string | null;
    projectName?: string | null;
    taskId: string;
    taskCode?: string | null;
    taskTitle: string;
    assigneeId?: string | null;
    assignedById: string;
    assignedByName: string;
  }) {
    if (!params.assigneeId || params.assigneeId === params.assignedById) return;

    const id = this.firebase.generateId();
    const initials = (params.assignedByName || 'ZA')
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    await this.firebase.db.collection('notifications').doc(id).set({
      userId: params.assigneeId,
      type: 'TASK_ASSIGNED',
      projectId: params.projectId,
      projectCode: params.projectCode || null,
      projectName: params.projectName || null,
      taskId: params.taskId,
      taskCode: params.taskCode || null,
      title: 'Nueva tarea asignada',
      body: `${params.assignedByName} te asigno: ${params.taskTitle}`,
      assignedById: params.assignedById,
      assignedByName: params.assignedByName,
      assignedByInitials: initials || 'ZA',
      read: false,
      createdAt: new Date(),
    });
  }

  // ─── Queries ─────────────────────────────────────────────────────────

  /**
   * Get all tasks for a project, supporting filtering by status, assignee,
   * milestone, and search.
   */
  async findByProject(projectId: string, params: {
    status?: string;
    assigneeId?: string;
    milestoneId?: string;
    search?: string;
  } = {}) {
    await this.assertProject(projectId);

    let query: FirebaseFirestore.Query = this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId);

    if (params.status) {
      query = query.where('status', '==', params.status);
    }
    if (params.assigneeId) {
      query = query.where('assigneeId', '==', params.assigneeId);
    }
    if (params.milestoneId) {
      query = query.where('milestoneId', '==', params.milestoneId);
    }

    query = query.orderBy('createdAt', 'desc');

    const snap = await query.get();
    let data = this.firebase.docsToArray(snap.docs);

    // Client-side text search (Firestore doesn't support full-text search)
    if (params.search) {
      const s = params.search.toLowerCase();
      data = data.filter((t: any) =>
        (t.title || '').toLowerCase().includes(s) ||
        (t.taskCode || '').toLowerCase().includes(s) ||
        (t.assigneeName || '').toLowerCase().includes(s),
      );
    }

    return data;
  }

  /**
   * Get all tasks grouped by status for Kanban view.
   */
  async findByProjectKanban(projectId: string) {
    await this.assertProject(projectId);

    const snap = await this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = this.firebase.docsToArray(snap.docs);

    // Sort each column by 'order' (the drag & drop position)
    const kanban: Record<string, any[]> = {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.DONE]: [],
    };

    for (const task of tasks) {
      const bucket = kanban[task.status];
      if (bucket) bucket.push(task);
    }

    // Sort each bucket by order
    for (const key of Object.keys(kanban)) {
      kanban[key].sort((a: any, b: any) => (a.order ?? 9999) - (b.order ?? 9999));
    }

    return kanban;
  }

  /**
   * Get tasks with date range for Gantt view.
   */
  async findByProjectGantt(projectId: string) {
    await this.assertProject(projectId);

    const snap = await this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = this.firebase.docsToArray(snap.docs);

    // Sort by startDate for Gantt timeline
    tasks.sort((a: any, b: any) => {
      const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aDate - bDate;
    });

    return tasks;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Tarea no encontrada');
    const task = this.firebase.docToObj(doc);
    if (!task || !task.isActive) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  // ─── Mutations ────────────────────────────────────────────────────────

  async create(projectId: string, data: any, user: { id: string; fullName: string }) {
    const projectDoc = await this.assertProject(projectId);
    const project = projectDoc.data()!;

    // Validate required fields
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new BadRequestException('El título de la tarea es obligatorio');
    }

    // Validate enums
    const validStatuses = Object.values(TaskStatus) as string[];
    const status = data.status || TaskStatus.TODO;
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }

    const validPriorities = Object.values(TaskPriority) as string[];
    const priority = data.priority || TaskPriority.MEDIUM;
    if (!validPriorities.includes(priority)) {
      throw new BadRequestException(`Prioridad inválida: ${priority}`);
    }

    // Validate assignee exists if provided
    let assigneeName: string | null = null;
    if (data.assigneeId) {
      const userDoc = await this.firebase.db.collection('users').doc(data.assigneeId).get();
      if (!userDoc.exists) throw new BadRequestException('Usuario asignado no encontrado');
      assigneeName = userDoc.data()?.fullName || null;
    }

    // Generate task code
    const taskCode = await this.generateTaskCode(project.projectCode || projectId);

    // Calculate max order in the target status column
    const orderSnap = await this.col
      .where('projectId', '==', projectId)
      .where('status', '==', status)
      .where('isActive', '==', true)
      .get();

    const maxOrder = orderSnap.docs.reduce((max, doc) => {
      const order = Number(doc.data().order ?? 0);
      return Number.isFinite(order) && order > max ? order : max;
    }, 0);

    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      projectId,
      taskCode,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status,
      priority,
      order: maxOrder + 1,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedDate: null,
      assigneeId: data.assigneeId || null,
      assigneeName,
      createdById: user.id,
      createdByName: user.fullName,
      milestoneId: data.milestoneId || null,
      estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : null,
      actualHours: null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.col.doc(id).set(docData);

    await this.pushAssignmentNotification({
      projectId,
      projectCode: project.projectCode,
      projectName: project.name,
      taskId: id,
      taskCode,
      taskTitle: docData.title,
      assigneeId: docData.assigneeId,
      assignedById: user.id,
      assignedByName: user.fullName,
    });

    // Update project task summary (fire-and-forget)
    this.updateTaskSummary(projectId).catch(() => {});

    // Log activity
    this.activityLog.log({
      projectId,
      action: ProjectActivityAction.TASK_CREATED,
      entityType: 'TASK',
      entityId: id,
      details: { entityTitle: docData.title },
      userId: user.id,
      userName: user.fullName,
    });

    return { id, ...docData };
  }

  async update(id: string, data: any, user: { id: string; fullName: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Tarea no encontrada');
    const existing = doc.data()!;
    if (!existing.isActive) throw new NotFoundException('Tarea no encontrada');

    const ALLOWED_FIELDS = [
      'title', 'description', 'priority', 'startDate', 'dueDate',
      'assigneeId', 'milestoneId', 'estimatedHours', 'actualHours', 'tags',
    ];

    const updateData: Record<string, any> = { updatedAt: new Date() };
    const changes: string[] = [];

    for (const key of ALLOWED_FIELDS) {
      if (!(key in data)) continue;
      const value = data[key];

      if (key === 'title') {
        if (!value || typeof value !== 'string' || !value.trim()) {
          throw new BadRequestException('El título no puede estar vacío');
        }
        updateData[key] = value.trim();
        if (existing.title !== value.trim()) changes.push('title');
        continue;
      }

      if (key === 'description') {
        updateData[key] = value?.trim() || null;
        continue;
      }

      if (key === 'priority') {
        const validPriorities = Object.values(TaskPriority) as string[];
        if (!validPriorities.includes(value)) {
          throw new BadRequestException(`Prioridad inválida: ${value}`);
        }
        updateData[key] = value;
        if (existing.priority !== value) changes.push('priority');
        continue;
      }

      if (key === 'startDate' || key === 'dueDate') {
        if (value === null || value === '') {
          updateData[key] = null;
        } else {
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) {
            throw new BadRequestException(`Fecha inválida para "${key}"`);
          }
          updateData[key] = d;
        }
        continue;
      }

      if (key === 'assigneeId') {
        if (value) {
          const userDoc = await this.firebase.db.collection('users').doc(value).get();
          if (!userDoc.exists) throw new BadRequestException('Usuario asignado no encontrado');
          updateData.assigneeId = value;
          updateData.assigneeName = userDoc.data()?.fullName || null;
          if (existing.assigneeId !== value) {
            changes.push('assignee');
            // Log assignment separately
            this.activityLog.log({
              projectId: existing.projectId,
              action: ProjectActivityAction.TASK_ASSIGNED,
              entityType: 'TASK',
              entityId: id,
              details: {
                entityTitle: existing.title,
                oldValue: existing.assigneeName,
                newValue: updateData.assigneeName,
              },
              userId: user.id,
              userName: user.fullName,
            });
          }
        } else {
          updateData.assigneeId = null;
          updateData.assigneeName = null;
        }
        continue;
      }

      if (key === 'milestoneId') {
        updateData[key] = value || null;
        continue;
      }

      if (key === 'estimatedHours' || key === 'actualHours') {
        if (value === null || value === '') {
          updateData[key] = null;
        } else {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) {
            throw new BadRequestException(`"${key}" debe ser un número >= 0`);
          }
          updateData[key] = n;
        }
        continue;
      }

      if (key === 'tags') {
        updateData[key] = Array.isArray(value) ? value : [];
        continue;
      }
    }

    await this.col.doc(id).update(updateData);

    if (changes.includes('assignee')) {
      const projectDoc = await this.firebase.db.collection('projects').doc(existing.projectId).get();
      const project = projectDoc.data() as any;
      await this.pushAssignmentNotification({
        projectId: existing.projectId,
        projectCode: project?.projectCode,
        projectName: project?.name,
        taskId: id,
        taskCode: existing.taskCode,
        taskTitle: updateData.title || existing.title,
        assigneeId: updateData.assigneeId,
        assignedById: user.id,
        assignedByName: user.fullName,
      });
    }

    // Log activity
    if (changes.length > 0) {
      this.activityLog.log({
        projectId: existing.projectId,
        action: ProjectActivityAction.TASK_UPDATED,
        entityType: 'TASK',
        entityId: id,
        details: { entityTitle: existing.title, fields: changes },
        userId: user.id,
        userName: user.fullName,
      });
    }

    return { id, ...existing, ...updateData };
  }

  /**
   * Update the status and/or order of a task (used by Kanban drag-and-drop).
   */
  async updateStatus(
    id: string,
    body: { status: string; order?: number },
    user: { id: string; fullName: string },
  ) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Tarea no encontrada');
    const existing = doc.data()!;
    if (!existing.isActive) throw new NotFoundException('Tarea no encontrada');

    const validStatuses = Object.values(TaskStatus) as string[];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException(`Estado inválido: ${body.status}`);
    }

    const updateData: Record<string, any> = {
      status: body.status,
      updatedAt: new Date(),
    };

    if (typeof body.order === 'number') {
      updateData.order = body.order;
    }

    // Mark completed date
    if (body.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
      updateData.completedDate = new Date();
    } else if (body.status !== TaskStatus.DONE) {
      updateData.completedDate = null;
    }

    await this.col.doc(id).update(updateData);

    // Update task summary on project (fire-and-forget)
    this.updateTaskSummary(existing.projectId).catch(() => {});

    // Log activity
    if (existing.status !== body.status) {
      this.activityLog.log({
        projectId: existing.projectId,
        action: ProjectActivityAction.TASK_STATUS_CHANGED,
        entityType: 'TASK',
        entityId: id,
        details: {
          entityTitle: existing.title,
          field: 'status',
          oldValue: existing.status,
          newValue: body.status,
        },
        userId: user.id,
        userName: user.fullName,
      });
    }

    return { id, ...existing, ...updateData };
  }

  /**
   * Batch update order for multiple tasks in a Kanban column.
   * Called after drag-and-drop to reorder tasks.
   */
  async reorder(projectId: string, items: Array<{ id: string; order: number; status: string }>) {
    await this.assertProject(projectId);

    const batch = this.firebase.db.batch();
    const now = new Date();

    for (const item of items) {
      const ref = this.col.doc(item.id);
      batch.update(ref, {
        order: item.order,
        status: item.status,
        updatedAt: now,
      });
    }

    await batch.commit();

    // Update task summary (fire-and-forget)
    this.updateTaskSummary(projectId).catch(() => {});

    return { updated: items.length };
  }

  async delete(id: string, user: { id: string; fullName: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Tarea no encontrada');
    const existing = doc.data()!;

    // Soft delete
    await this.col.doc(id).update({ isActive: false, updatedAt: new Date() });

    // Update task summary (fire-and-forget)
    this.updateTaskSummary(existing.projectId).catch(() => {});

    // Log activity
    this.activityLog.log({
      projectId: existing.projectId,
      action: ProjectActivityAction.TASK_DELETED,
      entityType: 'TASK',
      entityId: id,
      details: { entityTitle: existing.title },
      userId: user.id,
      userName: user.fullName,
    });

    return { id };
  }

  // ─── Alerts ───────────────────────────────────────────────────────────

  /**
   * Get alerts for a project: upcoming deadlines and bottlenecks.
   */
  async getAlerts(projectId: string) {
    await this.assertProject(projectId);

    const snap = await this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId)
      .get();

    const tasks = this.firebase.docsToArray(snap.docs);
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const alerts: Array<{ type: string; severity: string; message: string; taskId?: string; taskTitle?: string }> = [];

    // 1) Deadlines próximas (48 horas) y vencidas
    for (const task of tasks) {
      if (task.status === TaskStatus.DONE) continue;
      if (!task.dueDate) continue;

      const due = new Date(task.dueDate);
      if (due < now) {
        alerts.push({
          type: 'OVERDUE',
          severity: 'error',
          message: `"${task.title}" venció el ${due.toLocaleDateString('es-PE')}`,
          taskId: task.id,
          taskTitle: task.title,
        });
      } else if (due <= in48h) {
        alerts.push({
          type: 'DEADLINE_APPROACHING',
          severity: 'warning',
          message: `"${task.title}" vence el ${due.toLocaleDateString('es-PE')}`,
          taskId: task.id,
          taskTitle: task.title,
        });
      }
    }

    // 2) Cuellos de botella: demasiadas tareas en un solo estado (>5)
    const statusCounts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.status === TaskStatus.DONE) continue;
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }
    for (const [status, count] of Object.entries(statusCounts)) {
      if (count > 5) {
        alerts.push({
          type: 'BOTTLENECK_STATUS',
          severity: 'warning',
          message: `${count} tareas acumuladas en estado "${status}"`,
        });
      }
    }

    // 3) Cuello de botella: usuario con demasiadas tareas activas (>5)
    const userCounts: Record<string, { count: number; name: string }> = {};
    for (const task of tasks) {
      if (task.status === TaskStatus.DONE || !task.assigneeId) continue;
      if (!userCounts[task.assigneeId]) {
        userCounts[task.assigneeId] = { count: 0, name: task.assigneeName || 'Sin nombre' };
      }
      userCounts[task.assigneeId].count++;
    }
    for (const [, info] of Object.entries(userCounts)) {
      if (info.count > 5) {
        alerts.push({
          type: 'BOTTLENECK_USER',
          severity: 'info',
          message: `${info.name} tiene ${info.count} tareas activas asignadas`,
        });
      }
    }

    // Sort: errors first, then warnings, then info
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return alerts;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Generate a sequential task code like "PROY-2026-0001-T001".
   */
  private async generateTaskCode(projectCode: string): Promise<string> {
    const counterRef = this.firebase.db.collection('_counters').doc(`tasks_${projectCode}`);
    const count = await this.firebase.db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const next = doc.exists ? doc.data()!.count + 1 : 1;
      t.set(counterRef, { count: next }, { merge: true });
      return next;
    });
    return `${projectCode}-T${String(count).padStart(3, '0')}`;
  }

  /**
   * Recalculate and update the denormalized taskSummary on the project document.
   */
  async updateTaskSummary(projectId: string): Promise<void> {
    const snap = await this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId)
      .get();

    const byStatus: Record<string, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.IN_REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };

    for (const doc of snap.docs) {
      const status = doc.data().status;
      if (byStatus[status] !== undefined) byStatus[status]++;
    }

    await this.firebase.db.collection('projects').doc(projectId).update({
      taskSummary: {
        total: snap.size,
        byStatus,
      },
      updatedAt: new Date(),
    });
  }
}
