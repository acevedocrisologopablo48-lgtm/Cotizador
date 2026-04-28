import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectStatus } from '@fym/shared';

@Injectable()
export class ProjectsService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('projects');
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }) {
    const { page: rawPage, pageSize: rawPageSize, search, status } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    let query: FirebaseFirestore.Query = this.col;
    if (status) query = query.where('status', '==', status);

    query = query.orderBy('createdAt', 'desc');

    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    let data = this.firebase.docsToArray(docs);

    // Exclude soft-deleted records
    data = data.filter((item: any) => !item.deletedAt);

    for (const item of data) {
      if (item.companyId) {
        const c = await this.firebase.db.collection('companies').doc(item.companyId).get();
        if (c.exists) item.company = { id: c.id, tradeName: c.data()?.tradeName };
      }
      if (item.quotationId) {
        const q = await this.firebase.db.collection('quotations').doc(item.quotationId).get();
        if (q.exists) item.quotation = { id: q.id, quotationNumber: q.data()?.quotationNumber, total: q.data()?.total };
      }
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter((item: any) =>
        (item.projectCode || '').toLowerCase().includes(s) ||
        (item.name || '').toLowerCase().includes(s) ||
        (item.company?.tradeName || '').toLowerCase().includes(s)
      );
    }

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');
    const project = this.firebase.docToObj(doc);

    if (project.companyId) {
      const c = await this.firebase.db.collection('companies').doc(project.companyId).get();
      if (c.exists) project.company = this.firebase.docToObj(c);
    }
    if (project.quotationId) {
      const q = await this.firebase.db.collection('quotations').doc(project.quotationId).get();
      if (q.exists) project.quotation = { id: q.id, quotationNumber: q.data()?.quotationNumber, total: q.data()?.total, title: q.data()?.title };
    }

    // Populate subcollections
    const expensesSnap = await this.col.doc(id).collection('expenses').orderBy('expenseDate', 'desc').limit(20).get();
    project.expenses = this.firebase.docsToArray(expensesSnap.docs);
    for(const e of project.expenses) {
      if(e.registeredBy) {
        const u = await this.firebase.db.collection('users').doc(e.registeredBy).get();
        if(u.exists) e.registeredByUser = { fullName: u.data()?.fullName };
      }
    }

    const workforceSnap = await this.col.doc(id).collection('workforceLogs').orderBy('workDate', 'desc').limit(20).get();
    project.workforceLogs = this.firebase.docsToArray(workforceSnap.docs);

    const equipmentSnap = await this.col.doc(id).collection('equipmentLogs').orderBy('startDate', 'desc').limit(20).get();
    project.equipmentLogs = this.firebase.docsToArray(equipmentSnap.docs);

    const expCount = (await this.col.doc(id).collection('expenses').count().get()).data().count;
    const wfCount = (await this.col.doc(id).collection('workforceLogs').count().get()).data().count;
    const eqCount = (await this.col.doc(id).collection('equipmentLogs').count().get()).data().count;

    project._count = { expenses: expCount, workforceLogs: wfCount, equipmentLogs: eqCount };

    return project;
  }

  async createFromQuotation(quotationId: string) {
    const qDoc = await this.firebase.db.collection('quotations').doc(quotationId).get();
    if (!qDoc.exists) throw new NotFoundException('Cotización no encontrada');
    const quotation = qDoc.data()!;
    if (quotation.status !== 'APPROVED' && quotation.status !== 'SENT') {
      throw new BadRequestException('La cotización debe estar aprobada o enviada');
    }

    const existingSnap = await this.col.where('quotationId', '==', quotationId).get();
    if (!existingSnap.empty) throw new BadRequestException('Ya existe un proyecto para esta cotización');

    const code = await this.generateProjectCode();
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      projectCode: code,
      quotationId,
      companyId: quotation.companyId,
      name: quotation.title,
      approvedBudget: quotation.total || 0,
      status: 'PLANNING',
      createdAt: now,
      updatedAt: now,
    };

    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');
    const updateData = { ...data, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async updateStatus(id: string, status: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');

    const valid = Object.values(ProjectStatus) as string[];
    if (!valid.includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }

    const data: any = { status, updatedAt: new Date() };
    if (status === ProjectStatus.COMPLETED) data.actualEndDate = new Date();
    await this.col.doc(id).update(data);
    return { id, ...doc.data(), ...data };
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');
    await this.col.doc(id).update({ deletedAt: new Date(), updatedAt: new Date() });
    return { id };
  }

  async getSummary(id: string) {
    const projectDoc = await this.col.doc(id).get();
    if (!projectDoc.exists) throw new NotFoundException('Proyecto no encontrado');
    const project = projectDoc.data()!;

    let totalExpenses = 0;
    const expSnap = await this.col.doc(id).collection('expenses').get();
    expSnap.forEach(d => totalExpenses += Number(d.data().amount || 0));

    let totalWorkforce = 0;
    const wfSnap = await this.col.doc(id).collection('workforceLogs').get();
    wfSnap.forEach(d => totalWorkforce += Number(d.data().totalCost || 0));

    let totalEquipment = 0;
    const eqSnap = await this.col.doc(id).collection('equipmentLogs').get();
    eqSnap.forEach(d => totalEquipment += Number(d.data().totalCost || 0));

    const totalSpent = totalExpenses + totalWorkforce + totalEquipment;
    const budget = Number(project.approvedBudget || 0);

    return {
      budget,
      totalSpent,
      remaining: budget - totalSpent,
      percentUsed: budget > 0 ? (totalSpent / budget) * 100 : 0,
      breakdown: {
        expenses: { total: totalExpenses, count: expSnap.size },
        workforce: { total: totalWorkforce, count: wfSnap.size },
        equipment: { total: totalEquipment, count: eqSnap.size },
      },
    };
  }

  private async generateProjectCode(): Promise<string> {
    const year = new Date().getFullYear();
    const counterRef = this.firebase.db.collection('_counters').doc(`projects_${year}`);
    const res = await this.firebase.db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const count = doc.exists ? doc.data()?.count + 1 : 1;
      t.set(counterRef, { count }, { merge: true });
      return count;
    });
    return `PROY-${year}-${String(res).padStart(4, '0')}`;
  }
}
