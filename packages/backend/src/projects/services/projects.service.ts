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
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 20));

    let query: FirebaseFirestore.Query = this.col;
    if (status) query = query.where('status', '==', status);

    query = query.orderBy('createdAt', 'desc');

    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    let data = this.firebase.docsToArray(docs);

    // Exclude soft-deleted records
    data = data.filter((item: any) => !item.deletedAt);

    // Batch reads de companies y quotations relacionadas para evitar N+1.
    const companyIds = Array.from(new Set(data.map((p: any) => p.companyId).filter(Boolean)));
    const quotationIds = Array.from(new Set(data.map((p: any) => p.quotationId).filter(Boolean)));

    const companyRefs = companyIds.map(id => this.firebase.db.collection('companies').doc(id));
    const quotationRefs = quotationIds.map(id => this.firebase.db.collection('quotations').doc(id));

    const [companyDocs, quotationDocs] = await Promise.all([
      companyRefs.length ? this.firebase.db.getAll(...companyRefs) : Promise.resolve([]),
      quotationRefs.length ? this.firebase.db.getAll(...quotationRefs) : Promise.resolve([]),
    ]);

    const companyMap = new Map(
      companyDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]),
    );
    const quotationMap = new Map(
      quotationDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]),
    );

    for (const item of data) {
      const c = item.companyId ? companyMap.get(item.companyId) : null;
      if (c) item.company = { id: item.companyId, tradeName: c.tradeName };
      const q = item.quotationId ? quotationMap.get(item.quotationId) : null;
      if (q) item.quotation = { id: item.quotationId, quotationNumber: q.quotationNumber, total: q.total };
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

  async create(data: any) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('El nombre del proyecto es obligatorio');
    }

    const code = await this.generateProjectCode();
    const id = this.firebase.generateId();
    const now = new Date();
    const docData: Record<string, any> = {
      projectCode: code,
      quotationId: null,
      companyId: data.companyId || null,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      approvedBudget: Number(data.approvedBudget) || 0,
      status: 'PLANNING',
      plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
      plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
      actualStartDate: null,
      actualEndDate: null,
      managerId: data.managerId || null,
      memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
      taskSummary: null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.col.doc(id).set(docData);
    return { id, ...docData };
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
    const docData: Record<string, any> = {
      projectCode: code,
      quotationId,
      companyId: quotation.companyId,
      name: quotation.title,
      description: null,
      approvedBudget: quotation.total || 0,
      status: 'PLANNING',
      plannedStartDate: null,
      plannedEndDate: null,
      actualStartDate: null,
      actualEndDate: null,
      managerId: null,
      memberIds: [],
      taskSummary: null,
      tags: [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');

    // Allowlist explícita: nadie puede sobrescribir status, projectCode, companyId,
    // quotationId, deletedAt, createdAt, etc. desde el body.
    const ALLOWED_FIELDS = ['name', 'description', 'approvedBudget', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'managerId', 'memberIds', 'tags'];
    const updateData: Record<string, any> = { updatedAt: new Date() };

    for (const key of ALLOWED_FIELDS) {
      if (!(key in data)) continue;
      const value = data[key];

      if (key === 'name' || key === 'description') {
        if (value !== null && typeof value !== 'string') {
          throw new BadRequestException(`Campo "${key}" debe ser texto`);
        }
        updateData[key] = typeof value === 'string' ? value.trim() : value;
        continue;
      }

      if (key === 'approvedBudget') {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestException('approvedBudget debe ser un número ≥ 0');
        }
        updateData[key] = n;
        continue;
      }

      if (key === 'plannedStartDate' || key === 'plannedEndDate' || key === 'actualStartDate') {
        if (value === null || value === '') {
          updateData[key] = null;
          continue;
        }
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException(`Campo "${key}" no es una fecha válida`);
        }
        updateData[key] = d;
        continue;
      }

      if (key === 'managerId') {
        if (value) {
          const userDoc = await this.firebase.db.collection('users').doc(value).get();
          if (!userDoc.exists) throw new BadRequestException('Gerente de proyecto no encontrado');
        }
        updateData[key] = value || null;
        continue;
      }

      if (key === 'memberIds') {
        updateData[key] = Array.isArray(value) ? value : [];
        continue;
      }

      if (key === 'tags') {
        updateData[key] = Array.isArray(value) ? value : [];
        continue;
      }
    }

    if (updateData.name === '') {
      throw new BadRequestException('El nombre del proyecto no puede quedar vacío');
    }

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
