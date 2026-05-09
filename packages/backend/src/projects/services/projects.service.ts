import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectStatus } from '@fym/shared';
import { ProjectMaterialsService } from './project-materials.service';

@Injectable()
export class ProjectsService {
  constructor(
    private firebase: FirebaseService,
    private materialsService: ProjectMaterialsService,
  ) {}

  private get col() {
    return this.firebase.db.collection('projects');
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    user?: any;
  }) {
    await this.ensureInternalProject();

    const { page: rawPage, pageSize: rawPageSize, search, status, user } = params;
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 20));

    let query: FirebaseFirestore.Query = this.col.where('deletedAt', '==', null);
    if (status) query = query.where('status', '==', status);

    query = query.orderBy('createdAt', 'desc');

    const requiresInMemoryFiltering = Boolean(search?.trim()) || user?.role === 'CLIENT';
    let data: any[] = [];
    let total = 0;

    if (requiresInMemoryFiltering) {
      const snap = await query.get();
      data = this.firebase.docsToArray(snap.docs);
      if (user?.role === 'CLIENT') {
        const allowed = new Set(Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : []);
        data = data.filter((item: any) => allowed.has(item.id));
      }
    } else {
      const { docs, total: queryTotal } = await this.firebase.paginatedQuery(query, page, pageSize, query);
      data = this.firebase.docsToArray(docs);
      total = queryTotal;
    }

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

    await Promise.all(
      data.map(async (item: any) => {
        item.materialAlert =
          user?.role === 'CLIENT'
            ? { level: 'GREEN', pending: 0, overdue: 0, dueSoon: 0 }
            : await this.materialsService.getProjectAlert(item.id);
        item.progressSummary = await this.getProgressSummary(item.id);
      }),
    );

    if (search) {
      const s = search.toLowerCase();
      data = data.filter((item: any) =>
        (item.projectCode || '').toLowerCase().includes(s) ||
        (item.name || '').toLowerCase().includes(s) ||
        (item.company?.tradeName || '').toLowerCase().includes(s)
      );
    }

    if (requiresInMemoryFiltering) {
      total = data.length;
      data = this.firebase.paginateArray(data, page, pageSize);
    }

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string, user?: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proyecto no encontrado');
    this.assertClientProjectAccess(id, user);
    const project = this.firebase.docToObj(doc);

    if (project.companyId) {
      const c = await this.firebase.db.collection('companies').doc(project.companyId).get();
      if (c.exists) project.company = this.firebase.docToObj(c);
    }
    if (project.quotationId) {
      const q = await this.firebase.db.collection('quotations').doc(project.quotationId).get();
      if (q.exists) project.quotation = { id: q.id, quotationNumber: q.data()?.quotationNumber, total: q.data()?.total, title: q.data()?.title };
    }

    if (user?.role === 'CLIENT') {
      return project;
    }

    // Populate subcollections
    const expensesSnap = await this.col.doc(id).collection('expenses').orderBy('expenseDate', 'desc').limit(20).get();
    project.expenses = this.firebase.docsToArray(expensesSnap.docs);
    
    const userRefs: FirebaseFirestore.DocumentReference[] = [];
    for(const e of project.expenses) {
      if(e.registeredBy) userRefs.push(this.firebase.db.collection('users').doc(e.registeredBy));
    }
    
    const uniqueUserRefs = Array.from(new Set(userRefs.map(r => r.path))).map(p => this.firebase.db.doc(p));
    const userDocs = uniqueUserRefs.length ? await this.firebase.db.getAll(...uniqueUserRefs) : [];
    const userMap = new Map(userDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));

    for(const e of project.expenses) {
      if(e.registeredBy && userMap.has(e.registeredBy)) {
        e.registeredByUser = { fullName: userMap.get(e.registeredBy).fullName };
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
    const now = new Date();
    const year = now.getFullYear();
    const counterRef = this.firebase.db.collection('_counters').doc(`projects_${year}`);
    const quotationRef = this.firebase.db.collection('quotations').doc(quotationId);

    return this.firebase.db.runTransaction(async (transaction) => {
      const [qDoc, existingSnap, counterDoc] = await Promise.all([
        transaction.get(quotationRef),
        transaction.get(this.col.where('quotationId', '==', quotationId).limit(1)),
        transaction.get(counterRef),
      ]);

      if (!qDoc.exists) throw new NotFoundException('Cotización no encontrada');
      const quotation = qDoc.data()!;
      if (quotation.status !== 'APPROVED' && quotation.status !== 'SENT') {
        throw new BadRequestException('La cotización debe estar aprobada o enviada');
      }
      if (!existingSnap.empty) {
        throw new BadRequestException('Ya existe un proyecto para esta cotización');
      }

      const count = counterDoc.exists ? Number(counterDoc.data()?.count || 0) + 1 : 1;
      transaction.set(counterRef, { count }, { merge: true });

      const projectCode = `PROY-${year}-${String(count).padStart(4, '0')}`;
      const projectRef = this.col.doc(this.firebase.generateId());
      const docData: Record<string, any> = {
        projectCode,
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

      transaction.set(projectRef, docData);
      return { id: projectRef.id, ...docData };
    });
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
    const materialAlert = await this.materialsService.getProjectAlert(id);
    const progressSummary = await this.getProgressSummary(id);

    return {
      budget,
      totalSpent,
      remaining: budget - totalSpent,
      percentUsed: budget > 0 ? (totalSpent / budget) * 100 : 0,
      materialAlert,
      progressSummary,
      breakdown: {
        expenses: { total: totalExpenses, count: expSnap.size },
        workforce: { total: totalWorkforce, count: wfSnap.size },
        equipment: { total: totalEquipment, count: eqSnap.size },
      },
    };
  }

  async exportAccountingCsv(params: { month?: string }) {
    const month = params.month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('El mes debe tener formato YYYY-MM');
    }

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const projectsSnap = await this.col.where('deletedAt', '==', null).get();
    const rows: string[][] = [[
      'Proyecto',
      'Codigo',
      'Fecha',
      'Proveedor',
      'RUC',
      'Comprobante',
      'Descripcion',
      'Categoria',
      'Monto',
    ]];

    for (const projectDoc of projectsSnap.docs) {
      const project = projectDoc.data();
      const expensesSnap = await projectDoc.ref
        .collection('expenses')
        .where('expenseDate', '>=', start)
        .where('expenseDate', '<', end)
        .orderBy('expenseDate', 'asc')
        .get();

      for (const expenseDoc of expensesSnap.docs) {
        const expense = this.firebase.docToObj(expenseDoc) as any;
        rows.push([
          project.name || '',
          project.projectCode || '',
          expense.expenseDate || '',
          expense.supplierName || '',
          expense.supplierRuc || '',
          expense.invoiceNumber || expense.documentNumber || '',
          expense.description || '',
          expense.expenseCategory || '',
          String(expense.amount || 0),
        ]);
      }
    }

    return rows.map((row) => row.map((cell) => this.csvCell(cell)).join(',')).join('\n');
  }

  private async ensureInternalProject() {
    const existing = await this.col.where('projectCode', '==', 'Z').limit(1).get();
    if (!existing.empty) return;

    const now = new Date();
    await this.col.doc('internal-project-z').set({
      projectCode: 'Z',
      quotationId: null,
      companyId: null,
      name: 'Proyecto Z - Control Interno',
      description: 'Controles internos del equipo, coordinaciones operativas y actividades administrativas propias.',
      approvedBudget: 0,
      status: 'IN_PROGRESS',
      isInternal: true,
      plannedStartDate: null,
      plannedEndDate: null,
      actualStartDate: now,
      actualEndDate: null,
      managerId: null,
      memberIds: [],
      taskSummary: null,
      tags: ['INTERNO'],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async getProgressSummary(projectId: string) {
    const snap = await this.col.doc(projectId).collection('progressActivities').get();
    const activities = this.firebase.docsToArray(snap.docs) as any[];
    const average =
      activities.length > 0
        ? activities.reduce((sum, activity) => sum + Number(activity.progressPercent || 0), 0) / activities.length
        : 0;
    return {
      activities: activities.length,
      averagePercent: average,
      completed: activities.filter((activity) => Number(activity.progressPercent || 0) >= 100).length,
    };
  }

  private csvCell(value: string) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  private assertClientProjectAccess(projectId: string, user?: any) {
    if (user?.role !== 'CLIENT') return;
    const allowed = Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [];
    if (!allowed.includes(projectId)) {
      throw new ForbiddenException('No tienes acceso a este proyecto');
    }
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
