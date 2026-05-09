import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectAiService } from './project-ai.service';

@Injectable()
export class ProjectProgressService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly ai: ProjectAiService,
  ) {}

  private projectRef(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId);
  }

  private activitiesCol(projectId: string) {
    return this.projectRef(projectId).collection('progressActivities');
  }

  private logsCol(projectId: string, activityId: string) {
    return this.activitiesCol(projectId).doc(activityId).collection('dailyLogs');
  }

  private async assertProject(projectId: string, user?: any) {
    const doc = await this.projectRef(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) throw new NotFoundException('Proyecto no encontrado');
    if (user?.role === 'CLIENT') {
      const allowed = Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [];
      if (!allowed.includes(projectId)) {
        throw new ForbiddenException('No tienes acceso a este proyecto');
      }
    }
    return this.firebase.docToObj(doc);
  }

  async findActivities(projectId: string, user?: any) {
    await this.assertProject(projectId, user);
    const snap = await this.activitiesCol(projectId).orderBy('createdAt', 'asc').get();
    const activities = this.firebase.docsToArray(snap.docs);

    for (const activity of activities) {
      const logsSnap = await this.logsCol(projectId, activity.id)
        .orderBy('logDate', 'desc')
        .limit(6)
        .get();
      activity.logs = this.firebase.docsToArray(logsSnap.docs);
      activity.logsCount = (await this.logsCol(projectId, activity.id).count().get()).data().count;
    }

    return activities;
  }

  async createActivity(projectId: string, data: any) {
    await this.assertProject(projectId);
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('El nombre de la partida es obligatorio');
    }

    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      name: data.name.trim(),
      description: typeof data.description === 'string' ? data.description.trim() : null,
      progressPercent: 0,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };

    await this.activitiesCol(projectId).doc(id).set(docData);
    return { id, ...docData };
  }

  async deleteActivity(projectId: string, activityId: string) {
    await this.assertProject(projectId);
    const activityRef = this.activitiesCol(projectId).doc(activityId);
    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) throw new NotFoundException('Partida no encontrada');

    const logsSnap = await this.logsCol(projectId, activityId).get();
    const refs = logsSnap.docs.map((d) => d.ref);
    const chunkSize = 400;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const batch = this.firebase.db.batch();
      for (const ref of refs.slice(i, i + chunkSize)) {
        batch.delete(ref);
      }
      if (i + chunkSize >= refs.length) {
        batch.delete(activityRef);
      }
      await batch.commit();
    }
    if (refs.length === 0) {
      await activityRef.delete();
    }
    return { ok: true };
  }

  async addDailyLog(projectId: string, activityId: string, data: any, userId: string) {
    const project = await this.assertProject(projectId);
    const activityRef = this.activitiesCol(projectId).doc(activityId);
    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) throw new NotFoundException('Partida no encontrada');

    const rawText = String(data.rawText || data.description || '').trim();
    if (!rawText) throw new BadRequestException('La descripcion diaria es obligatoria');

    const progressDelta = Number(data.progressDelta ?? 0);
    if (!Number.isFinite(progressDelta) || progressDelta < 0 || progressDelta > 100) {
      throw new BadRequestException('El avance diario debe estar entre 0 y 100');
    }

    const photos = Array.isArray(data.photos) ? data.photos.filter(Boolean).slice(0, 12) : [];
    const activity = this.firebase.docToObj(activityDoc);
    const aiResult = await this.ai.improveFieldNote(
      rawText,
      `${project.projectCode || ''} ${project.name || ''} - ${activity.name || ''}`,
    );

    const currentProgress = Number(activity.progressPercent || 0);
    const nextProgress = Math.min(100, currentProgress + progressDelta);
    const logId = this.firebase.generateId();
    const now = new Date();
    const logDate = data.logDate ? new Date(data.logDate) : now;
    if (Number.isNaN(logDate.getTime())) throw new BadRequestException('Fecha de registro invalida');

    const logData = {
      rawText,
      improvedText: aiResult.improvedText,
      aiApplied: aiResult.aiApplied,
      progressDelta,
      accumulatedPercent: nextProgress,
      photos,
      logDate,
      createdBy: userId,
      createdAt: now,
    };

    const batch = this.firebase.db.batch();
    batch.set(this.logsCol(projectId, activityId).doc(logId), logData);
    batch.update(activityRef, {
      progressPercent: nextProgress,
      status: nextProgress >= 100 ? 'DONE' : 'OPEN',
      updatedAt: now,
    });
    await batch.commit();

    return { id: logId, ...logData };
  }

  async buildReport(projectId: string, params: { from?: string; to?: string }, user?: any) {
    const project = await this.assertProject(projectId, user);
    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Fecha desde invalida');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Fecha hasta invalida');
    if (to) to.setHours(23, 59, 59, 999);

    const activitiesSnap = await this.activitiesCol(projectId).orderBy('createdAt', 'asc').get();
    const activities = this.firebase.docsToArray(activitiesSnap.docs);

    for (const activity of activities) {
      const logsSnap = await this.logsCol(projectId, activity.id).orderBy('logDate', 'asc').get();
      activity.logs = this.firebase.docsToArray(logsSnap.docs).filter((log: any) => {
        const d = new Date(log.logDate);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      project,
      period: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      point2ProgressSummary: activities.map((activity: any) => ({
        activityId: activity.id,
        name: activity.name,
        progressPercent: Number(activity.progressPercent || 0),
        status: activity.status,
      })),
      activities,
    };
  }
}
