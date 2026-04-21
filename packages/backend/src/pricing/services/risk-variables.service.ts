import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class RiskVariablesService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('riskVariableRules');
  }

  async findAll(variableType?: string) {
    let query: FirebaseFirestore.Query = this.col.where('isActive', '==', true);
    if (variableType) {
      query = query.where('variableType', '==', variableType);
    }
    const snap = await query.orderBy('priority', 'desc').orderBy('name', 'asc').get();
    return this.firebase.docsToArray(snap.docs);
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Regla de riesgo no encontrada');
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
    if (!doc.exists) throw new NotFoundException('Regla de riesgo no encontrada');
    await this.col.doc(id).update(data);
    return { id, ...doc.data(), ...data };
  }

  async softDelete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Regla de riesgo no encontrada');
    await this.col.doc(id).update({ isActive: false });
    return { message: 'Regla desactivada' };
  }
}
