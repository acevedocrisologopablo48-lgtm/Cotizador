import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

const ALLOWED_TX_TYPES = new Set(['EXPENSE', 'INCOME', 'REFUND', 'ADJUSTMENT']);
const MAX_AMOUNT = 1_000_000;

function toFiniteNumber(value: unknown, fallback?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    if (fallback !== undefined) return fallback;
    throw new BadRequestException('Valor numérico inválido');
  }
  return n;
}

@Injectable()
export class PettyCashService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('pettyCash');
  }

  async findAll(projectId?: string) {
    let query: FirebaseFirestore.Query = this.col;
    if (projectId) query = query.where('projectId', '==', projectId);

    query = query.orderBy('createdAt', 'desc');

    const snap = await query.get();
    const data = this.firebase.docsToArray(snap.docs);

    // Batch reads de projects/users + counts en paralelo (evita N+1).
    const projectIds = Array.from(new Set(data.map((p: any) => p.projectId).filter(Boolean)));
    const userIds = Array.from(new Set(data.map((p: any) => p.responsibleUserId).filter(Boolean)));

    const projectRefs = projectIds.map(id => this.firebase.db.collection('projects').doc(id));
    const userRefs = userIds.map(id => this.firebase.db.collection('users').doc(id));

    const [projectDocs, userDocs, txCounts] = await Promise.all([
      projectRefs.length ? this.firebase.db.getAll(...projectRefs) : Promise.resolve([]),
      userRefs.length ? this.firebase.db.getAll(...userRefs) : Promise.resolve([]),
      Promise.all(
        data.map(item =>
          this.col.doc(item.id).collection('transactions').count().get()
            .then(s => [item.id, s.data().count] as const)
            .catch(() => [item.id, 0] as const),
        ),
      ),
    ]);

    const projectMap = new Map(projectDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));
    const userMap = new Map(userDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));
    const countMap = new Map(txCounts);

    for (const item of data) {
      const p = item.projectId ? projectMap.get(item.projectId) : null;
      if (p) item.project = { id: item.projectId, projectCode: p.projectCode, name: p.name };
      const u = item.responsibleUserId ? userMap.get(item.responsibleUserId) : null;
      if (u) item.responsibleUser = { id: item.responsibleUserId, fullName: u.fullName, email: u.email };
      item._count = { transactions: countMap.get(item.id) ?? 0 };
    }

    return data;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Caja chica no encontrada');
    const fund = this.firebase.docToObj(doc);

    if (fund.projectId) {
      const p = await this.firebase.db.collection('projects').doc(fund.projectId).get();
      if (p.exists) fund.project = { id: p.id, projectCode: p.data()?.projectCode, name: p.data()?.name };
    }
    if (fund.responsibleUserId) {
      const u = await this.firebase.db.collection('users').doc(fund.responsibleUserId).get();
      if (u.exists) fund.responsibleUser = { id: u.id, fullName: u.data()?.fullName, email: u.data()?.email };
    }

    const tSnap = await this.col.doc(id).collection('transactions').orderBy('transactionDate', 'desc').limit(50).get();
    fund.transactions = this.firebase.docsToArray(tSnap.docs);

    for (const t of fund.transactions) {
      if (t.registeredBy) {
        const u = await this.firebase.db.collection('users').doc(t.registeredBy).get();
        if (u.exists) t.registeredByUser = { id: u.id, fullName: u.data()?.fullName };
      }
      if (t.approvedBy) {
        const u = await this.firebase.db.collection('users').doc(t.approvedBy).get();
        if (u.exists) t.approvedByUser = { id: u.id, fullName: u.data()?.fullName };
      }
    }

    return fund;
  }

  async create(data: {
    name: string;
    projectId?: string;
    initialBalance: number;
    currency?: string;
    responsibleUserId: string;
  }) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (typeof data.responsibleUserId !== 'string' || !data.responsibleUserId.trim()) {
      throw new BadRequestException('responsibleUserId es obligatorio');
    }

    const initialBalance = toFiniteNumber(data.initialBalance);
    if (initialBalance < 0) {
      throw new BadRequestException('El saldo inicial no puede ser negativo');
    }
    if (initialBalance > MAX_AMOUNT) {
      throw new BadRequestException('Saldo inicial fuera de rango razonable');
    }

    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      name: data.name.trim(),
      projectId: data.projectId || null,
      initialBalance,
      currentBalance: initialBalance,
      currency: data.currency || 'PEN',
      responsibleUserId: data.responsibleUserId,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };
    
    await this.col.doc(id).set(docData);
    
    const resDoc = await this.findOne(id);
    return resDoc;
  }

  async close(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Caja chica no encontrada');
    if (doc.data()?.status === 'CLOSED') throw new BadRequestException('Ya está cerrada');

    await this.col.doc(id).update({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() });
    return { id, message: 'Caja chica cerrada' };
  }

  async update(id: string, data: { name?: string }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Caja chica no encontrada');

    // Allowlist: solo permitimos cambiar el nombre. status/balances no se editan vía update.
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new BadRequestException('El nombre debe ser un texto no vacío');
      }
      updates.name = data.name.trim();
    }

    await this.col.doc(id).update(updates);
    return this.findOne(id);
  }

  async addTransaction(
    pettyCashId: string,
    data: {
      transactionType: string;
      description: string;
      amount: number;
      transactionDate: string;
      projectId?: string;
      notes?: string;
    },
    userId: string,
  ) {
    const fundRef = this.col.doc(pettyCashId);
    
    if (!ALLOWED_TX_TYPES.has(data.transactionType)) {
      throw new BadRequestException(`Tipo de transacción inválido: ${data.transactionType}`);
    }
    if (typeof data.description !== 'string' || !data.description.trim()) {
      throw new BadRequestException('La descripción es obligatoria');
    }
    if (data.transactionDate) {
      const d = new Date(data.transactionDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('transactionDate no es una fecha válida');
      }
    }
    const amount = toFiniteNumber(data.amount);
    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }
    if (amount > MAX_AMOUNT) {
      throw new BadRequestException('Monto fuera de rango razonable');
    }

    return this.firebase.db.runTransaction(async (t) => {
      const fundDoc = await t.get(fundRef);
      if (!fundDoc.exists) throw new NotFoundException('Caja chica no encontrada');
      const fund = fundDoc.data()!;

      if (fund.status === 'CLOSED') throw new BadRequestException('Caja chica cerrada');

      const isExpense = data.transactionType === 'EXPENSE';

      let balanceAfter = toFiniteNumber(fund.currentBalance, 0);
      if (isExpense) {
        balanceAfter -= amount;
      } else {
        balanceAfter += amount;
      }

      if (isExpense && balanceAfter < 0) {
        throw new BadRequestException('Saldo insuficiente');
      }

      const txRef = fundRef.collection('transactions').doc();
      const txData = {
        projectId: data.projectId || null,
        transactionType: data.transactionType,
        description: data.description,
        amount,
        balanceAfter,
        registeredBy: userId,
        transactionDate: new Date(data.transactionDate),
        notes: data.notes || null,
        createdAt: new Date()
      };

      t.set(txRef, txData);
      t.update(fundRef, { currentBalance: balanceAfter, updatedAt: new Date() });

      return { id: txRef.id, ...txData };
    });
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Caja chica no encontrada');

    // Delete all transactions in subcollection first
    const txSnap = await this.col.doc(id).collection('transactions').get();
    if (!txSnap.empty) {
      const docs = txSnap.docs;
      // Firestore batch limit is 500 operations
      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        const batch = this.firebase.db.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    await this.col.doc(id).delete();
  }

  async getTransactions(pettyCashId: string, rawPage?: number, rawPageSize?: number) {
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    const query = this.col.doc(pettyCashId).collection('transactions').orderBy('transactionDate', 'desc');
    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    for (const t of data) {
      if (t.registeredBy) {
        const u = await this.firebase.db.collection('users').doc(t.registeredBy).get();
        if (u.exists) t.registeredByUser = { id: u.id, fullName: u.data()?.fullName };
      }
      if (t.approvedBy) {
        const u = await this.firebase.db.collection('users').doc(t.approvedBy).get();
        if (u.exists) t.approvedByUser = { id: u.id, fullName: u.data()?.fullName };
      }
    }

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }
}
