import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProvidersService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('providers');
  }

  private sanitizeContacts(contacts: any[]) {
    return (Array.isArray(contacts) ? contacts : [])
      .map((contact) => ({
        name: String(contact.name || '').trim(),
        phone: String(contact.phone || '').trim(),
        email: String(contact.email || '').trim(),
        role: String(contact.role || '').trim(),
      }))
      .filter((contact) => contact.name || contact.phone || contact.email);
  }

  private sanitizeProducts(products: any[]) {
    return (Array.isArray(products) ? products : [])
      .map((product) => ({
        id: String(product.id || this.firebase.generateId()),
        name: String(product.name || '').trim(),
        description: String(product.description || '').trim(),
        unit: String(product.unit || 'UND').trim(),
        unitPrice: Number(product.unitPrice) || 0,
        currency: String(product.currency || 'PEN').trim(),
      }))
      .filter((product) => product.name && product.unitPrice >= 0);
  }

  private sanitize(data: any) {
    const name = String(data.name || '').trim();
    if (!name) throw new BadRequestException('El nombre del proveedor es obligatorio');
    return {
      name,
      ruc: String(data.ruc || '').trim() || null,
      address: String(data.address || '').trim() || null,
      phone: String(data.phone || '').trim() || null,
      email: String(data.email || '').trim() || null,
      productLine: String(data.productLine || '').trim() || null,
      notes: String(data.notes || '').trim() || null,
      contacts: this.sanitizeContacts(data.contacts),
      products: this.sanitizeProducts(data.products),
    };
  }

  async findAll(params: { search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const snap = await this.col.where('isActive', '==', true).orderBy('name', 'asc').get();
    let data = this.firebase.docsToArray(snap.docs);
    if (params.search?.trim()) {
      const s = params.search.toLowerCase();
      data = data.filter((provider: any) =>
        [provider.name, provider.ruc, provider.productLine, provider.address]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(s)),
      );
    }
    const total = data.length;
    return {
      data: this.firebase.paginateArray(data, page, pageSize),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findProducts(params: { search?: string }) {
    const snap = await this.col.where('isActive', '==', true).orderBy('name', 'asc').get();
    const products: any[] = [];
    for (const doc of snap.docs) {
      const provider = this.firebase.docToObj(doc);
      for (const product of provider.products || []) {
        products.push({ ...product, providerId: provider.id, providerName: provider.name });
      }
    }
    if (!params.search?.trim()) return products.slice(0, 200);
    const s = params.search.toLowerCase();
    return products
      .filter((product) =>
        [product.name, product.description, product.providerName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(s)),
      )
      .slice(0, 200);
  }

  async create(data: any, userId: string) {
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = { ...this.sanitize(data), isActive: true, createdBy: userId, createdAt: now, updatedAt: now };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proveedor no encontrado');
    const updateData = { ...this.sanitize(data), updatedAt: new Date() };
    await doc.ref.update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Proveedor no encontrado');
    await doc.ref.update({ isActive: false, updatedAt: new Date() });
    return { id };
  }
}
