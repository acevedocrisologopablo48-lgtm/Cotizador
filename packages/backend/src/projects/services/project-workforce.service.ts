import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProjectWorkforceService {
  constructor(private firebase: FirebaseService) {}

  private col(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId).collection('workforceLogs');
  }

  async findByProject(projectId: string, params: { page?: number; pageSize?: number }) {
    const { page: rawPage, pageSize: rawPageSize } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    const query = this.col(projectId).orderBy('workDate', 'desc');
    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(projectId: string, data: any, userId: string) {
    const hoursRegular = Number(data.hoursRegular || 8);
    const hoursOvertime = Number(data.hoursOvertime || 0);
    const dailyRate = Number(data.dailyRate);
    const overtimeRate = Number(data.overtimeRate || 0);
    const totalCost = (hoursRegular / 8) * dailyRate + (hoursOvertime / 8) * overtimeRate;

    const id = this.firebase.generateId();
    const docData = {
      ...data,
      registeredBy: userId,
      totalCost,
      createdAt: new Date(),
    };

    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData };
  }
}
