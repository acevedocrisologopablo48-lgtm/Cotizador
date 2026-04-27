import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class QuotationSectionsService {
  constructor(private firebase: FirebaseService) {}

  private col(quotationId: string) {
    return this.firebase.db.collection('quotations').doc(quotationId).collection('sections');
  }

  private async assertDraft(quotationId: string) {
    const qDoc = await this.firebase.db.collection('quotations').doc(quotationId).get();
    if (!qDoc.exists) throw new NotFoundException('Cotización no encontrada');
    if (qDoc.data()?.status !== 'DRAFT') {
      throw new BadRequestException('Solo se pueden modificar secciones en cotizaciones en borrador');
    }
  }

  async create(quotationId: string, data: { name: string; sortOrder?: number }) {
    await this.assertDraft(quotationId);
    const id = this.firebase.generateId();
    const existing = await this.col(quotationId).get();
    const sortOrder = data.sortOrder ?? existing.size;
    await this.col(quotationId).doc(id).set({ ...data, sortOrder });
    return { id, ...data, sortOrder };
  }

  async update(quotationId: string, id: string, data: { name?: string; sortOrder?: number }) {
    await this.assertDraft(quotationId);
    const docRef = this.col(quotationId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Sección no encontrada');
    await docRef.update(data);
    return { id, ...doc.data(), ...data };
  }

  async delete(quotationId: string, id: string) {
    await this.assertDraft(quotationId);
    const docRef = this.col(quotationId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Sección no encontrada');
    await docRef.delete();
    return { message: 'Sección eliminada' };
  }

  async reorder(quotationId: string, orderedIds: string[]) {
    await this.assertDraft(quotationId);
    const batch = this.firebase.db.batch();
    orderedIds.forEach((id, i) => {
      const ref = this.col(quotationId).doc(id);
      batch.update(ref, { sortOrder: i });
    });
    await batch.commit();
    return { message: 'Reordenado correctamente' };
  }
}
