import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { QuotationCalculatorService } from './quotation-calculator.service';

@Injectable()
export class QuotationItemsService {
  constructor(
    private firebase: FirebaseService,
    private calculator: QuotationCalculatorService,
  ) {}

  private col(quotationId: string, sectionId: string) {
    return this.firebase.db
      .collection('quotations')
      .doc(quotationId)
      .collection('sections')
      .doc(sectionId)
      .collection('items');
  }

  async create(quotationId: string, sectionId: string, data: any) {
    const subtotal = Number(data.quantity) * Number(data.unitCost ?? data.unitPrice ?? 0);
    const id = this.firebase.generateId();
    const existing = await this.col(quotationId, sectionId).get();
    const sortOrder = data.sortOrder ?? existing.size;
    const docData = { ...data, subtotal, sortOrder };
    await this.col(quotationId, sectionId).doc(id).set(docData);
    await this.calculator.recalculateQuotation(quotationId);
    return { id, ...docData };
  }

  async update(quotationId: string, sectionId: string, id: string, data: any) {
    const docRef = this.col(quotationId, sectionId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Item no encontrado');

    const existing = doc.data()!;
    const updateData = { ...data };
    const incomingPrice = data.unitCost ?? data.unitPrice;
    const existingPrice = existing.unitCost ?? existing.unitPrice ?? 0;

    if (data.quantity !== undefined && incomingPrice !== undefined) {
      updateData.subtotal = Number(data.quantity) * Number(incomingPrice);
    } else if (data.quantity !== undefined) {
      updateData.subtotal = Number(data.quantity) * Number(existingPrice);
    } else if (incomingPrice !== undefined) {
      updateData.subtotal = Number(existing.quantity ?? 0) * Number(incomingPrice);
    }

    await docRef.update(updateData);
    await this.calculator.recalculateQuotation(quotationId);
    return { id, ...existing, ...updateData };
  }

  async delete(quotationId: string, sectionId: string, id: string) {
    const docRef = this.col(quotationId, sectionId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Item no encontrado');
    await docRef.delete();
    await this.calculator.recalculateQuotation(quotationId);
    return { message: 'Item eliminado' };
  }

  async reorder(quotationId: string, sectionId: string, orderedIds: string[]) {
    const batch = this.firebase.db.batch();
    orderedIds.forEach((id, i) => {
      const ref = this.col(quotationId, sectionId).doc(id);
      batch.update(ref, { sortOrder: i });
    });
    await batch.commit();
    return { message: 'Reordenado correctamente' };
  }
}
