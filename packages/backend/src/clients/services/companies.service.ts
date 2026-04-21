import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class CompaniesService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('companies');
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { page: rawPage, pageSize: rawPageSize, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    let query: FirebaseFirestore.Query = this.col.where('isActive', '==', true);
    query = query.orderBy(sortBy, sortOrder as FirebaseFirestore.OrderByDirection);

    const { docs, total } = await this.firebase.paginatedQuery(
      query, page, pageSize,
      this.col.where('isActive', '==', true),
    );

    let data = this.firebase.docsToArray(docs);

    // Client-side search filter (Firestore doesn't support OR + contains natively)
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((c: any) =>
        (c.businessName || '').toLowerCase().includes(s) ||
        (c.tradeName || '').toLowerCase().includes(s) ||
        (c.ruc || '').includes(s)
      );
    }

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empresa no encontrada');

    const company = this.firebase.docToObj(doc);

    // Load contacts
    const contactsSnap = await this.firebase.db.collection('contacts')
      .where('companyId', '==', id)
      .get();
    const contacts = this.firebase.docsToArray(contactsSnap.docs)
      .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

    // Load agreements (sort in memory to avoid composite index requirement)
    const agreementsSnap = await this.firebase.db.collection('agreements')
      .where('companyId', '==', id)
      .where('isActive', '==', true)
      .get();
    const agreements = this.firebase.docsToArray(agreementsSnap.docs)
      .sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() ?? new Date(a.createdAt).getTime();
        const bTime = b.createdAt?.toMillis?.() ?? new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

    // Count quotations and projects
    const quotationsCount = (await this.firebase.db.collection('quotations')
      .where('companyId', '==', id).count().get()).data().count;
    const projectsCount = (await this.firebase.db.collection('projects')
      .where('companyId', '==', id).count().get()).data().count;

    return {
      ...company,
      contacts,
      agreements,
      _count: { quotations: quotationsCount, projects: projectsCount },
    };
  }

  async create(data: any) {
    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      ...data,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empresa no encontrada');
    const updateData = { ...data, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async softDelete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empresa no encontrada');
    await this.col.doc(id).update({ isActive: false, updatedAt: new Date() });
    return { id, message: 'Empresa desactivada' };
  }

  async getHistory(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empresa no encontrada');

    const quotationsSnap = await this.firebase.db.collection('quotations')
      .where('companyId', '==', id)
      .orderBy('createdAt', 'desc')
      .get();

    const projectsSnap = await this.firebase.db.collection('projects')
      .where('companyId', '==', id)
      .orderBy('createdAt', 'desc')
      .get();

    return {
      quotations: this.firebase.docsToArray(quotationsSnap.docs),
      projects: this.firebase.docsToArray(projectsSnap.docs),
    };
  }
}
