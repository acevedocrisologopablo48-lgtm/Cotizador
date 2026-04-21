import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class SuppliesService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('supplies');
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    supplyType?: string;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page: rawPage, pageSize: rawPageSize, search, supplyType, categoryId, sortBy = 'name', sortOrder = 'asc' } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    let query: FirebaseFirestore.Query = this.col.where('isActive', '==', true);
    if (supplyType) query = query.where('supplyType', '==', supplyType);
    if (categoryId) query = query.where('categoryId', '==', categoryId);

    query = query.orderBy(sortBy, sortOrder);

    const { docs, total } = await this.firebase.paginatedQuery(
      query, page, pageSize,
      this.col.where('isActive', '==', true)
    );

    let data = this.firebase.docsToArray(docs);

    if (search) {
      const s = search.toLowerCase();
      data = data.filter((item: any) =>
        (item.name || '').toLowerCase().includes(s) ||
        (item.code || '').toLowerCase().includes(s) ||
        (item.description || '').toLowerCase().includes(s)
      );
    }

    // Populate category
    for (const item of data) {
      if (item.categoryId) {
        const catDoc = await this.firebase.db.collection('categories').doc(item.categoryId).get();
        if (catDoc.exists) {
          item.category = { id: catDoc.id, name: catDoc.data()?.name };
        }
      }
    }

    return {
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Insumo no encontrado');
    const supply = this.firebase.docToObj(doc);

    if (supply.categoryId) {
      const catDoc = await this.firebase.db.collection('categories').doc(supply.categoryId).get();
      if (catDoc.exists) supply.category = this.firebase.docToObj(catDoc);
    }

    const historySnap = await this.col.doc(id).collection('priceHistory')
      .orderBy('changedAt', 'desc')
      .limit(20)
      .get();
    
    supply.priceHistory = this.firebase.docsToArray(historySnap.docs);

    for (const h of supply.priceHistory) {
      if (h.changedBy) {
        const userDoc = await this.firebase.db.collection('users').doc(h.changedBy).get();
        if (userDoc.exists) h.user = { fullName: userDoc.data()?.fullName };
      }
    }

    return supply;
  }

  async create(data: any) {
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = { ...data, isActive: true, createdAt: now, updatedAt: now };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any, userId: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Insumo no encontrado');
    const current = doc.data()!;

    const priceChanged = data.baseUnitCost !== undefined &&
      Number(data.baseUnitCost) !== Number(current.baseUnitCost);

    const batch = this.firebase.db.batch();

    if (priceChanged) {
      const historyRef = this.col.doc(id).collection('priceHistory').doc();
      batch.set(historyRef, {
        oldPrice: current.baseUnitCost,
        newPrice: data.baseUnitCost,
        changedBy: userId,
        reason: data.priceChangeReason || null,
        changedAt: new Date()
      });
      data.lastPriceUpdate = new Date();
    }
    delete data.priceChangeReason;

    const updateData = { ...data, updatedAt: new Date() };
    batch.update(doc.ref, updateData);
    await batch.commit();

    return { id, ...current, ...updateData };
  }

  async softDelete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Insumo no encontrado');
    await this.col.doc(id).update({ isActive: false, updatedAt: new Date() });
    return { message: 'Insumo desactivado' };
  }
}
