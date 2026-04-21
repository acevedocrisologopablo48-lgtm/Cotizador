import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class PerformanceRatesService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('performanceRates');
  }

  async findAll(params: { specialty?: string; search?: string }) {
    let query: FirebaseFirestore.Query = this.col.where('isActive', '==', true);
    if (params.specialty) {
      query = query.where('specialty', '==', params.specialty);
    }
    
    const snap = await query.orderBy('name', 'asc').get();
    let data = this.firebase.docsToArray(snap.docs);

    if (params.search) {
      const s = params.search.toLowerCase();
      data = data.filter((item: any) => 
        (item.name || '').toLowerCase().includes(s) ||
        (item.code || '').toLowerCase().includes(s)
      );
    }

    return data;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Rendimiento no encontrado');
    return this.firebase.docToObj(doc);
  }

  async create(data: any) {
    const id = this.firebase.generateId();
    const docData = { ...data, isActive: true, createdAt: new Date() };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Rendimiento no encontrado');
    await this.col.doc(id).update(data);
    return { id, ...doc.data(), ...data };
  }

  async softDelete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Rendimiento no encontrado');
    await this.col.doc(id).update({ isActive: false });
    return { message: 'Rendimiento desactivado' };
  }
}
