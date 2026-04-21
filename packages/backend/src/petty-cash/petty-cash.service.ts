import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

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

    for (const item of data) {
      if (item.projectId) {
        const p = await this.firebase.db.collection('projects').doc(item.projectId).get();
        if (p.exists) item.project = { id: p.id, projectCode: p.data()?.projectCode, name: p.data()?.name };
      }
      if (item.responsibleUserId) {
        const u = await this.firebase.db.collection('users').doc(item.responsibleUserId).get();
        if (u.exists) item.responsibleUser = { id: u.id, fullName: u.data()?.fullName, email: u.data()?.email };
      }
      
      const tSnap = await this.col.doc(item.id).collection('transactions').count().get();
      item._count = { transactions: tSnap.data().count };
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
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      name: data.name,
      projectId: data.projectId || null,
      initialBalance: Number(data.initialBalance),
      currentBalance: Number(data.initialBalance),
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
    
    return this.firebase.db.runTransaction(async (t) => {
      const fundDoc = await t.get(fundRef);
      if (!fundDoc.exists) throw new NotFoundException('Caja chica no encontrada');
      const fund = fundDoc.data()!;

      if (fund.status === 'CLOSED') throw new BadRequestException('Caja chica cerrada');

      const amount = Number(data.amount);
      const isExpense = data.transactionType === 'EXPENSE';
      
      let balanceAfter = Number(fund.currentBalance);
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
