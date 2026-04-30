import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectActivityService } from './project-activity.service';
import { MilestoneStatus, ProjectActivityAction, TaskStatus } from '@fym/shared';

@Injectable()
export class ProjectMilestonesService {
  constructor(
    private firebase: FirebaseService,
    private activityLog: ProjectActivityService,
  ) {}

  private get col() {
    return this.firebase.db.collection('projectMilestones');
  }

  private async assertProject(projectId: string) {
    const doc = await this.firebase.db.collection('projects').doc(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  // ─── Queries ─────────────────────────────────────────────────────────

  async findByProject(projectId: string) {
    await this.assertProject(projectId);

    const snap = await this.col
      .where('isActive', '==', true)
      .where('projectId', '==', projectId)
      .orderBy('targetDate', 'asc')
      .get();

    const milestones = this.firebase.docsToArray(snap.docs);

    // Check for overdue milestones and update status if needed
    const now = new Date();
    const batch = this.firebase.db.batch();
    let batchUpdates = 0;

    for (const milestone of milestones) {
      if (
        milestone.status === MilestoneStatus.PENDING &&
        milestone.targetDate &&
        new Date(milestone.targetDate) < now
      ) {
        milestone.status = MilestoneStatus.OVERDUE;
        batch.update(this.col.doc(milestone.id), {
          status: MilestoneStatus.OVERDUE,
          updatedAt: now,
        });
        batchUpdates++;
      }
    }

    if (batchUpdates > 0) {
      await batch.commit();
    }

    return milestones;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Hito no encontrado');
    const milestone = this.firebase.docToObj(doc);
    if (!milestone || !milestone.isActive) throw new NotFoundException('Hito no encontrado');

    // Fetch linked tasks
    const tasksSnap = await this.firebase.db.collection('projectTasks')
      .where('milestoneId', '==', id)
      .where('isActive', '==', true)
      .get();

    milestone.linkedTasks = this.firebase.docsToArray(tasksSnap.docs);

    return milestone;
  }

  // ─── Mutations ────────────────────────────────────────────────────────

  async create(projectId: string, data: any, user: { id: string; fullName: string }) {
    await this.assertProject(projectId);

    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new BadRequestException('El título del hito es obligatorio');
    }

    if (!data.targetDate) {
      throw new BadRequestException('La fecha objetivo es obligatoria');
    }

    const targetDate = new Date(data.targetDate);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Fecha objetivo inválida');
    }

    const id = this.firebase.generateId();
    const now = new Date();
    const status = targetDate < now ? MilestoneStatus.OVERDUE : MilestoneStatus.PENDING;

    const docData = {
      projectId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status,
      targetDate,
      completedDate: null,
      linkedTaskCount: 0,
      completedTaskCount: 0,
      createdById: user.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.col.doc(id).set(docData);

    // Log activity
    this.activityLog.log({
      projectId,
      action: ProjectActivityAction.MILESTONE_CREATED,
      entityType: 'MILESTONE',
      entityId: id,
      details: { entityTitle: docData.title },
      userId: user.id,
      userName: user.fullName,
    });

    return { id, ...docData };
  }

  async update(id: string, data: any, user: { id: string; fullName: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Hito no encontrado');
    const existing = doc.data()!;
    if (!existing.isActive) throw new NotFoundException('Hito no encontrado');

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if ('title' in data) {
      if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
        throw new BadRequestException('El título no puede estar vacío');
      }
      updateData.title = data.title.trim();
    }

    if ('description' in data) {
      updateData.description = data.description?.trim() || null;
    }

    if ('targetDate' in data) {
      if (!data.targetDate) {
        throw new BadRequestException('La fecha objetivo es obligatoria');
      }
      const d = new Date(data.targetDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Fecha objetivo inválida');
      }
      updateData.targetDate = d;

      // Re-evaluate status if the milestone isn't already completed
      if (existing.status !== MilestoneStatus.COMPLETED) {
        updateData.status = d < new Date() ? MilestoneStatus.OVERDUE : MilestoneStatus.PENDING;
      }
    }

    await this.col.doc(id).update(updateData);

    // Log activity
    this.activityLog.log({
      projectId: existing.projectId,
      action: ProjectActivityAction.MILESTONE_UPDATED,
      entityType: 'MILESTONE',
      entityId: id,
      details: { entityTitle: updateData.title || existing.title },
      userId: user.id,
      userName: user.fullName,
    });

    return { id, ...existing, ...updateData };
  }

  /**
   * Mark a milestone as completed.
   */
  async complete(id: string, user: { id: string; fullName: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Hito no encontrado');
    const existing = doc.data()!;
    if (!existing.isActive) throw new NotFoundException('Hito no encontrado');

    if (existing.status === MilestoneStatus.COMPLETED) {
      throw new BadRequestException('El hito ya está completado');
    }

    const now = new Date();
    await this.col.doc(id).update({
      status: MilestoneStatus.COMPLETED,
      completedDate: now,
      updatedAt: now,
    });

    // Log activity
    this.activityLog.log({
      projectId: existing.projectId,
      action: ProjectActivityAction.MILESTONE_COMPLETED,
      entityType: 'MILESTONE',
      entityId: id,
      details: { entityTitle: existing.title },
      userId: user.id,
      userName: user.fullName,
    });

    return { id, status: MilestoneStatus.COMPLETED, completedDate: now };
  }

  async delete(id: string, user: { id: string; fullName: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Hito no encontrado');
    const existing = doc.data()!;

    // Soft delete
    await this.col.doc(id).update({ isActive: false, updatedAt: new Date() });

    // Unlink tasks from this milestone
    const tasksSnap = await this.firebase.db.collection('projectTasks')
      .where('milestoneId', '==', id)
      .where('isActive', '==', true)
      .get();

    if (!tasksSnap.empty) {
      const batch = this.firebase.db.batch();
      for (const taskDoc of tasksSnap.docs) {
        batch.update(taskDoc.ref, { milestoneId: null, updatedAt: new Date() });
      }
      await batch.commit();
    }

    return { id };
  }

  /**
   * Recalculate denormalized task counts on a milestone.
   * Called when tasks are added/removed/completed under this milestone.
   */
  async recalculateTaskCounts(milestoneId: string): Promise<void> {
    const tasksSnap = await this.firebase.db.collection('projectTasks')
      .where('milestoneId', '==', milestoneId)
      .where('isActive', '==', true)
      .get();

    let completedCount = 0;
    for (const doc of tasksSnap.docs) {
      if (doc.data().status === TaskStatus.DONE) completedCount++;
    }

    await this.col.doc(milestoneId).update({
      linkedTaskCount: tasksSnap.size,
      completedTaskCount: completedCount,
      updatedAt: new Date(),
    });
  }
}
