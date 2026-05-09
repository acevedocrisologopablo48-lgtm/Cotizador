import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectQueryAuditAction, ProjectQueryPriority, ProjectQueryStatus } from '@fym/shared';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProjectQueriesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get queriesCol() {
    return this.firebase.db.collection('projectQueries');
  }

  private get auditCol() {
    return this.firebase.db.collection('projectQueryAudit');
  }

  private projectRef(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId);
  }

  private messagesCol(queryId: string) {
    return this.queriesCol.doc(queryId).collection('messages');
  }

  private async assertProjectAccess(projectId: string, user: any) {
    const projectDoc = await this.projectRef(projectId).get();
    if (!projectDoc.exists || projectDoc.data()?.deletedAt) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    if (user?.role === 'CLIENT') {
      const allowed = Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [];
      if (!allowed.includes(projectId)) {
        throw new ForbiddenException('No tienes acceso a este proyecto');
      }
    }
  }

  private async assertQueryAccess(projectId: string, queryId: string, user: any) {
    const doc = await this.queriesCol.doc(queryId).get();
    if (!doc.exists) throw new NotFoundException('Consulta no encontrada');
    const data = doc.data() as any;
    if (data.projectId !== projectId) throw new NotFoundException('Consulta no encontrada en el proyecto');
    if (user?.role === 'CLIENT') {
      const allowed = Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [];
      if (!allowed.includes(projectId)) {
        throw new ForbiddenException('No tienes acceso a esta consulta');
      }
    }
    return this.firebase.docToObj(doc) as any;
  }

  private async logAudit(params: {
    projectId: string;
    queryId: string;
    action: ProjectQueryAuditAction;
    actorId: string;
    actorName: string;
    actorRole: string;
    metadata?: Record<string, any>;
  }) {
    const id = this.firebase.generateId();
    await this.auditCol.doc(id).set({
      ...params,
      createdAt: new Date(),
    });
  }

  private async pushNotifications(params: {
    projectId: string;
    queryId: string;
    title: string;
    body: string;
    excludeUserId?: string;
  }) {
    const queryDoc = await this.queriesCol.doc(params.queryId).get();
    if (!queryDoc.exists) return;
    const queryData = queryDoc.data() as any;
    const projectDoc = await this.projectRef(params.projectId).get();
    const projectData = projectDoc.data() as any;
    const recipients = new Set<string>();
    if (queryData.createdBy) recipients.add(String(queryData.createdBy));
    if (queryData.assignedTo) recipients.add(String(queryData.assignedTo));
    if (projectData?.managerId) recipients.add(String(projectData.managerId));
    if (params.excludeUserId) recipients.delete(params.excludeUserId);
    const now = new Date();
    const batch = this.firebase.db.batch();
    for (const userId of recipients) {
      const id = this.firebase.generateId();
      batch.set(this.firebase.db.collection('notifications').doc(id), {
        userId,
        type: 'PROJECT_QUERY',
        projectId: params.projectId,
        queryId: params.queryId,
        title: params.title,
        body: params.body,
        read: false,
        createdAt: now,
      });
      const emailId = this.firebase.generateId();
      batch.set(this.firebase.db.collection('emailQueue').doc(emailId), {
        userId,
        channel: 'PROJECT_QUERY',
        subject: params.title,
        body: params.body,
        projectId: params.projectId,
        queryId: params.queryId,
        status: 'PENDING',
        createdAt: now,
      });
    }
    await batch.commit();
  }

  async findAll(projectId: string, user: any, params: { status?: string; priority?: string }) {
    await this.assertProjectAccess(projectId, user);
    let query: FirebaseFirestore.Query = this.queriesCol.where('projectId', '==', projectId);
    if (params.status) query = query.where('status', '==', params.status);
    if (params.priority) query = query.where('priority', '==', params.priority);
    const snap = await query.orderBy('updatedAt', 'desc').limit(200).get();
    return this.firebase.docsToArray(snap.docs);
  }

  async findOne(projectId: string, queryId: string, user: any) {
    await this.assertProjectAccess(projectId, user);
    const queryData = await this.assertQueryAccess(projectId, queryId, user);
    const messagesSnap = await this.messagesCol(queryId).orderBy('createdAt', 'asc').get();
    await this.logAudit({
      projectId,
      queryId,
      action: ProjectQueryAuditAction.QUERY_READ,
      actorId: user.id,
      actorName: user.fullName || user.email || 'Usuario',
      actorRole: user.role,
    });
    return { ...queryData, messages: this.firebase.docsToArray(messagesSnap.docs) };
  }

  async create(projectId: string, dto: any, user: any) {
    await this.assertProjectAccess(projectId, user);
    const title = String(dto.title || '').trim();
    const description = String(dto.description || '').trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    if (!description) throw new BadRequestException('La descripción es obligatoria');
    const priority = Object.values(ProjectQueryPriority).includes(dto.priority)
      ? dto.priority
      : ProjectQueryPriority.MEDIUM;
    const id = this.firebase.generateId();
    const now = new Date();
    const payload = {
      projectId,
      title,
      description,
      status: ProjectQueryStatus.OPEN,
      priority,
      createdBy: user.id,
      createdByName: user.fullName || user.email || 'Usuario',
      createdByRole: user.role,
      assignedTo: dto.assignedTo || null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      statusHistory: [
        {
          from: null,
          to: ProjectQueryStatus.OPEN,
          changedAt: now,
          changedBy: user.id,
        },
      ],
    };
    await this.queriesCol.doc(id).set(payload);
    await this.logAudit({
      projectId,
      queryId: id,
      action: ProjectQueryAuditAction.QUERY_CREATED,
      actorId: user.id,
      actorName: user.fullName || user.email || 'Usuario',
      actorRole: user.role,
      metadata: { title },
    });
    await this.pushNotifications({
      projectId,
      queryId: id,
      title: `Nueva consulta: ${title}`,
      body: description.slice(0, 220),
      excludeUserId: user.id,
    });
    return { id, ...payload };
  }

  async addMessage(projectId: string, queryId: string, dto: any, user: any) {
    await this.assertProjectAccess(projectId, user);
    await this.assertQueryAccess(projectId, queryId, user);
    const body = String(dto.body || '').trim();
    if (!body) throw new BadRequestException('El mensaje es obligatorio');
    const now = new Date();
    const messageId = this.firebase.generateId();
    await this.messagesCol(queryId).doc(messageId).set({
      queryId,
      projectId,
      body,
      authorId: user.id,
      authorName: user.fullName || user.email || 'Usuario',
      authorRole: user.role,
      createdAt: now,
    });
    await this.queriesCol.doc(queryId).update({
      updatedAt: now,
      lastMessageAt: now,
    });
    await this.logAudit({
      projectId,
      queryId,
      action: ProjectQueryAuditAction.MESSAGE_SENT,
      actorId: user.id,
      actorName: user.fullName || user.email || 'Usuario',
      actorRole: user.role,
    });
    await this.pushNotifications({
      projectId,
      queryId,
      title: 'Nueva respuesta en consulta',
      body: body.slice(0, 220),
      excludeUserId: user.id,
    });
    return { id: messageId, body, createdAt: now };
  }

  async updateStatus(projectId: string, queryId: string, dto: any, user: any) {
    await this.assertProjectAccess(projectId, user);
    const queryData = await this.assertQueryAccess(projectId, queryId, user);
    const nextStatus = dto.status;
    if (!Object.values(ProjectQueryStatus).includes(nextStatus)) {
      throw new BadRequestException('Estado inválido');
    }
    const now = new Date();
    await this.queriesCol.doc(queryId).update({
      status: nextStatus,
      updatedAt: now,
      statusHistory: [
        ...(Array.isArray(queryData.statusHistory) ? queryData.statusHistory : []),
        {
          from: queryData.status,
          to: nextStatus,
          changedAt: now,
          changedBy: user.id,
        },
      ],
    });
    await this.logAudit({
      projectId,
      queryId,
      action: ProjectQueryAuditAction.QUERY_STATUS_CHANGED,
      actorId: user.id,
      actorName: user.fullName || user.email || 'Usuario',
      actorRole: user.role,
      metadata: { from: queryData.status, to: nextStatus },
    });
    await this.pushNotifications({
      projectId,
      queryId,
      title: `Estado actualizado a ${nextStatus}`,
      body: `La consulta "${queryData.title}" cambió de estado.`,
      excludeUserId: user.id,
    });
    return { ok: true };
  }
}
