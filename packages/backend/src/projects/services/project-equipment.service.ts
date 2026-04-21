import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProjectEquipmentService {
  constructor(private firebase: FirebaseService) {}

  private col(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId).collection('equipmentLogs');
  }

  async findByProject(projectId: string, params: { page?: number; pageSize?: number }) {
    const { page: rawPage, pageSize: rawPageSize } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    const query = this.col(projectId).orderBy('startDate', 'desc');
    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(projectId: string, data: any, userId: string) {
    const id = this.firebase.generateId();
    const docData = { ...data, registeredBy: userId, createdAt: new Date() };
    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData };
  }

  async close(projectId: string, id: string) {
    const docRef = this.col(projectId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Registro no encontrado');

    const log = doc.data()!;
    const endDate = new Date();
    const startDate = log.startDate ? new Date(log.startDate) : new Date();
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
    const totalDays = Math.max(1, diffDays);
    const totalCost = totalDays * Number(log.dailyRate || 0);

    const updateData = { endDate, totalDays, totalCost, updatedAt: new Date() };
    await docRef.update(updateData);
    return { id, ...log, ...updateData };
  }
}
