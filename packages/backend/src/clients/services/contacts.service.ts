import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ContactsService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('contacts');
  }

  async findByCompany(companyId: string) {
    const snap = await this.col
      .where('companyId', '==', companyId)
      .get();
    return this.firebase.docsToArray(snap.docs)
      .sort((a: any, b: any) => {
        if (b.isPrimary !== a.isPrimary) return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
  }

  async create(companyId: string, data: any) {
    if (data.isPrimary) {
      // Unset other primaries
      const primarySnap = await this.col
        .where('companyId', '==', companyId)
        .where('isPrimary', '==', true)
        .get();
      const batch = this.firebase.db.batch();
      primarySnap.docs.forEach((doc) => {
        batch.update(doc.ref, { isPrimary: false });
      });
      await batch.commit();
    }

    const id = this.firebase.generateId();
    const now = new Date();
    const docData = { ...data, companyId, createdAt: now, updatedAt: now };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Contacto no encontrado');
    const existing = doc.data()!;

    if (data.isPrimary) {
      const primarySnap = await this.col
        .where('companyId', '==', existing.companyId)
        .where('isPrimary', '==', true)
        .get();
      const batch = this.firebase.db.batch();
      primarySnap.docs.forEach((d) => {
        if (d.id !== id) batch.update(d.ref, { isPrimary: false });
      });
      await batch.commit();
    }

    const updateData = { ...data, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);
    return { id, ...existing, ...updateData };
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Contacto no encontrado');
    await this.col.doc(id).delete();
    return { message: 'Contacto eliminado' };
  }
}
