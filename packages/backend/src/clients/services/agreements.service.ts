import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class AgreementsService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('agreements');
  }

  async findByCompany(companyId: string) {
    const snap = await this.col
      .where('companyId', '==', companyId)
      .get();
    return this.firebase.docsToArray(snap.docs)
      .sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() ?? new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toMillis?.() ?? new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
  }

  async create(companyId: string, data: any) {
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = { ...data, companyId, isActive: true, createdAt: now, updatedAt: now };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Acuerdo comercial no encontrado');
    const updateData = { ...data, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }
}
