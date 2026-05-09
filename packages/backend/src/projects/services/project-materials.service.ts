import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

const OPEN_STATUSES = new Set(['REQUESTED', 'REVIEWING', 'PURCHASED', 'IN_TRANSIT']);
const ALL_STATUSES = new Set([
  'REQUESTED',
  'REVIEWING',
  'PURCHASED',
  'IN_TRANSIT',
  'DELIVERED',
  'OBSERVED',
  'CANCELLED',
]);

@Injectable()
export class ProjectMaterialsService {
  constructor(private readonly firebase: FirebaseService) {}

  private projectRef(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId);
  }

  private col(projectId: string) {
    return this.projectRef(projectId).collection('materialRequests');
  }

  private async assertProject(projectId: string) {
    const doc = await this.projectRef(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) throw new NotFoundException('Proyecto no encontrado');
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    const snap = await this.col(projectId).orderBy('createdAt', 'desc').get();
    return this.firebase.docsToArray(snap.docs).map((item: any) => ({
      ...item,
      urgency: this.getUrgency(item),
    }));
  }

  async create(projectId: string, data: any, userId: string) {
    await this.assertProject(projectId);
    const description = String(data.description || '').trim();
    if (!description) throw new BadRequestException('La descripcion del material es obligatoria');

    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    const requiredDate = data.requiredDate ? new Date(data.requiredDate) : null;
    if (!requiredDate || Number.isNaN(requiredDate.getTime())) {
      throw new BadRequestException('La fecha limite es obligatoria');
    }

    const itemNumber = await this.nextItemNumber(projectId);
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      itemNumber,
      type: String(data.type || 'MATERIAL_CIVIL'),
      description,
      quantity,
      requiredDate,
      status: 'REQUESTED',
      deliveredAt: null,
      requestedBy: userId,
      logisticsOwnerId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData, urgency: this.getUrgency(docData) };
  }

  async update(projectId: string, id: string, data: any, userId: string) {
    await this.assertProject(projectId);
    const ref = this.col(projectId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Solicitud de material no encontrada');

    const updateData: Record<string, any> = { updatedAt: new Date(), logisticsOwnerId: userId };
    if (data.status) {
      const nextStatus = String(data.status);
      if (!ALL_STATUSES.has(nextStatus)) {
        throw new BadRequestException('Estado de material inválido');
      }
      updateData.status = nextStatus;
    }
    if ('deliveredAt' in data) {
      updateData.deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : null;
      if (updateData.deliveredAt && Number.isNaN(updateData.deliveredAt.getTime())) {
        throw new BadRequestException('Fecha de entrega invalida');
      }
    }
    if (data.requiredDate) {
      const requiredDate = new Date(data.requiredDate);
      if (Number.isNaN(requiredDate.getTime())) throw new BadRequestException('Fecha limite invalida');
      updateData.requiredDate = requiredDate;
    }

    await ref.update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async deleteRequest(projectId: string, id: string) {
    await this.assertProject(projectId);
    const ref = this.col(projectId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Solicitud de material no encontrada');
    await ref.delete();
    return { ok: true };
  }

  async getProjectAlert(projectId: string) {
    const snap = await this.col(projectId).get();
    const items = this.firebase.docsToArray(snap.docs) as any[];
    const open = items.filter((item) => OPEN_STATUSES.has(item.status));
    const red = open.filter((item) => this.getUrgency(item) === 'RED').length;
    const yellow = open.filter((item) => this.getUrgency(item) === 'YELLOW').length;
    return {
      level: red > 0 ? 'RED' : yellow > 0 ? 'YELLOW' : 'GREEN',
      pending: open.length,
      overdue: red,
      dueSoon: yellow,
    };
  }

  private async nextItemNumber(projectId: string) {
    const counterRef = this.projectRef(projectId).collection('_counters').doc('materials');
    return this.firebase.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      const next = doc.exists ? Number(doc.data()?.count || 0) + 1 : 1;
      transaction.set(counterRef, { count: next }, { merge: true });
      return next;
    });
  }

  private getUrgency(item: any): 'RED' | 'YELLOW' | 'GREEN' {
    if (!OPEN_STATUSES.has(item.status)) return 'GREEN';
    const required = new Date(item.requiredDate);
    if (Number.isNaN(required.getTime())) return 'GREEN';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(required);
    due.setHours(0, 0, 0, 0);
    const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return 'RED';
    if (days <= 2) return 'YELLOW';
    return 'GREEN';
  }
}
