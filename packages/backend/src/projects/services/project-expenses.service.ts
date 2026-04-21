import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProjectExpensesService {
  constructor(private firebase: FirebaseService) {}

  private col(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId).collection('expenses');
  }

  async findByProject(projectId: string, params: { page?: number; pageSize?: number; category?: string }) {
    const { page: rawPage, pageSize: rawPageSize, category } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    let query: FirebaseFirestore.Query = this.col(projectId);
    if (category) query = query.where('expenseCategory', '==', category);

    query = query.orderBy('expenseDate', 'desc');

    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    for (const item of data) {
      if (item.registeredBy) {
        const u = await this.firebase.db.collection('users').doc(item.registeredBy).get();
        if (u.exists) item.registeredByUser = { fullName: u.data()?.fullName };
      }
      if (item.approvedBy) {
        const u = await this.firebase.db.collection('users').doc(item.approvedBy).get();
        if (u.exists) item.approvedByUser = { fullName: u.data()?.fullName };
      }
    }

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(projectId: string, data: any, userId: string) {
    const id = this.firebase.generateId();
    const docData = { ...data, registeredBy: userId, paymentStatus: 'PENDING', createdAt: new Date() };
    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData };
  }

  async approve(projectId: string, id: string, userId: string) {
    const docRef = this.col(projectId).doc(id);
    await docRef.update({ approvedBy: userId, paymentStatus: 'PAID', approvedAt: new Date() });
    return { id, message: 'Aprobado y marcado como pagado' };
  }
}
