import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { QuotationCalculatorService } from './quotation-calculator.service';

import { AppConfigService } from '../../app-config/app-config.service';

@Injectable()
export class QuotationsService {
  constructor(
    private firebase: FirebaseService,
    private calculator: QuotationCalculatorService,
    private configService: AppConfigService,
  ) {}

  private get col() {
    return this.firebase.db.collection('quotations');
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    companyId?: string;
    tipo?: string;
    dateFrom?: string;
    dateTo?: string;
    contactId?: string;
  }) {
    const { page: rawPage, pageSize: rawPageSize, search, status, companyId, tipo, dateFrom, dateTo, contactId } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    let query: FirebaseFirestore.Query = this.col;
    if (status) query = query.where('status', '==', status);
    if (companyId) query = query.where('companyId', '==', companyId);

    query = query.orderBy('createdAt', 'desc');

    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    let data = this.firebase.docsToArray(docs);

    // Populate company and users
    for (const item of data) {
      if (item.companyId) {
        const c = await this.firebase.db.collection('companies').doc(item.companyId).get();
        if (c.exists) item.company = { id: c.id, tradeName: c.data()?.tradeName, ruc: c.data()?.ruc };
      }
      if (item.contactId) {
        const c = await this.firebase.db.collection('contacts').doc(item.contactId).get();
        if (c.exists) item.contact = { id: c.id, fullName: c.data()?.fullName };
      }
      if (item.createdBy) {
        const u = await this.firebase.db.collection('users').doc(item.createdBy).get();
        if (u.exists) item.creator = { id: u.id, fullName: u.data()?.fullName };
      }
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter((item: any) => 
        (item.quotationNumber || '').toLowerCase().includes(s) ||
        (item.title || '').toLowerCase().includes(s) ||
        (item.company?.tradeName || '').toLowerCase().includes(s)
      );
    }

    if (tipo) {
      data = data.filter((item: any) => item.tipo === tipo);
    }

    if (contactId) {
      data = data.filter((item: any) => item.contactId === contactId);
    }

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : null;
      data = data.filter((item: any) => {
        const created = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
        if (from && created < from) return false;
        if (to && created > to) return false;
        return true;
      });
    }

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    const quotation = this.firebase.docToObj(doc);

    // Populate company, contact, agreement
    if (quotation.companyId) {
      const c = await this.firebase.db.collection('companies').doc(quotation.companyId).get();
      if (c.exists) quotation.company = this.firebase.docToObj(c);
    }
    if (quotation.contactId) {
      const c = await this.firebase.db.collection('contacts').doc(quotation.contactId).get();
      if (c.exists) quotation.contact = this.firebase.docToObj(c);
    }
    if (quotation.agreementId) {
      const c = await this.firebase.db.collection('agreements').doc(quotation.agreementId).get();
      if (c.exists) quotation.agreement = this.firebase.docToObj(c);
    }
    if (quotation.createdBy) {
      const u = await this.firebase.db.collection('users').doc(quotation.createdBy).get();
      if (u.exists) quotation.creator = { id: u.id, fullName: u.data()?.fullName, email: u.data()?.email };
    }
    if (quotation.approvedBy) {
      const u = await this.firebase.db.collection('users').doc(quotation.approvedBy).get();
      if (u.exists) quotation.approver = { id: u.id, fullName: u.data()?.fullName };
    }

    // Populate sections and items (subcollections)
    const sectionsSnap = await this.col.doc(id).collection('sections').orderBy('sortOrder', 'asc').get();
    quotation.sections = this.firebase.docsToArray(sectionsSnap.docs);

    for (const section of quotation.sections) {
      const itemsSnap = await this.col.doc(id).collection('sections').doc(section.id).collection('items').orderBy('sortOrder', 'asc').get();
      section.items = this.firebase.docsToArray(itemsSnap.docs);

      for (const item of section.items) {
        if (item.supplyId) {
          const s = await this.firebase.db.collection('supplies').doc(item.supplyId).get();
          if (s.exists) item.supply = { id: s.id, code: s.data()?.code, name: s.data()?.name };
        }
        if (item.performanceRateId) {
          const p = await this.firebase.db.collection('performanceRates').doc(item.performanceRateId).get();
          if (p.exists) item.performanceRate = { id: p.id, code: p.data()?.code, name: p.data()?.name };
        }
      }
    }

    return quotation;
  }

  async create(data: any, userId: string) {
    const number = await this.generateQuotationNumber();
    const id = this.firebase.generateId();
    const now = new Date();

    const companySettings = await this.configService.getCompanySettings();

    const docData = {
      ...data,
      validityDays: data.validityDays ?? companySettings.defaultValidityDays ?? 15,
      currency: data.currency ?? companySettings.defaultCurrency ?? 'PEN',
      igvPercentage: data.igvPercentage ?? companySettings.defaultIgvPercentage ?? 18,
      quotationNumber: number,
      status: 'DRAFT',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: any) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    const isOnlyAttachments = Object.keys(data).every(k => ['pdfUrl', 'pdfName', 'xlsxUrl', 'xlsxName'].includes(k));
    if (doc.data()?.status !== 'DRAFT' && !isOnlyAttachments) {
      throw new BadRequestException('Solo se pueden editar cotizaciones en borrador');
    }
    const updateData = { ...data, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async updateStatus(id: string, newStatus: string, userId: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    const quotation = doc.data()!;

    const data: any = { status: newStatus, updatedAt: new Date() };
    if (newStatus === 'APPROVED') {
      data.approvedBy = userId;
      data.approvedAt = new Date();
    }
    if (newStatus === 'SENT') {
      data.sentAt = new Date();
      data.expiresAt = new Date(Date.now() + (quotation.validityDays || 15) * 86400000);
    }

    await this.col.doc(id).update(data);
    return { id, ...quotation, ...data };
  }

  async recalculate(id: string) {
    return this.calculator.recalculateQuotation(id);
  }

  async duplicate(id: string, userId: string) {
    const original = await this.findOne(id);
    const number = await this.generateQuotationNumber();
    const newId = this.firebase.generateId();
    const now = new Date();

    const batch = this.firebase.db.batch();

    const newQRef = this.col.doc(newId);
    batch.set(newQRef, {
      quotationNumber: number,
      companyId: original.companyId,
      contactId: original.contactId,
      agreementId: original.agreementId,
      title: `${original.title} (copia)`,
      description: original.description,
      specialties: original.specialties,
      validityDays: original.validityDays,
      currency: original.currency,
      generalExpensesPercentage: original.generalExpensesPercentage,
      profitMarginPercentage: original.profitMarginPercentage,
      igvPercentage: original.igvPercentage,
      introductionText: original.introductionText,
      termsAndConditions: original.termsAndConditions,
      deliveryTimeDays: original.deliveryTimeDays,
      warrantyText: original.warrantyText,
      parentQuotationId: original.id,
      version: (original.version || 1) + 1,
      status: 'DRAFT',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    for (const section of original.sections) {
      const newSectionRef = newQRef.collection('sections').doc();
      batch.set(newSectionRef, {
        name: section.name,
        sortOrder: section.sortOrder,
      });

      for (const item of section.items) {
        const newItemRef = newSectionRef.collection('items').doc();
        batch.set(newItemRef, {
          sortOrder: item.sortOrder,
          description: item.description,
          supplyId: item.supplyId,
          performanceRateId: item.performanceRateId,
          unitOfMeasure: item.unitOfMeasure,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          notes: item.notes,
        });
      }
    }

    await batch.commit();
    return await this.findOne(newId);
  }

  private async generateQuotationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    // In Firestore, counting with startsWith is hard. 
    // We'll use an atomic counter doc in a _counters collection.
    const counterRef = this.firebase.db.collection('_counters').doc(`quotations_${year}`);
    const res = await this.firebase.db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const count = doc.exists ? doc.data()?.count + 1 : 1;
      t.set(counterRef, { count }, { merge: true });
      return count;
    });
    return `COT-${year}-${String(res).padStart(4, '0')}`;
  }
}
