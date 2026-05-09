import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { QuotationCalculatorService } from './quotation-calculator.service';
import {
  QuotationStatus,
  QUOTATION_STATUS_TRANSITIONS,
  QuotationDocumentMode,
  normalizeQuotationDocumentMode,
  DEFAULT_PROJECT_TECHNICAL_SECTIONS,
  type CommercialTerms,
  type TechnicalSection,
} from '@fym/shared';

import { AppConfigService } from '../../app-config/app-config.service';

@Injectable()
export class QuotationsService {
  private static readonly EDITABLE_STATUSES = new Set<string>([
    'DRAFT',
    'REVIEW',
    'FOLLOW_UP',
    'STAND_BY',
  ]);

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
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 20));

    let query: FirebaseFirestore.Query = this.col.where('deletedAt', '==', null);
    if (status) query = query.where('status', '==', status);
    if (companyId) query = query.where('companyId', '==', companyId);

    query = query.orderBy('createdAt', 'desc');

    const requiresInMemoryFiltering =
      Boolean(search?.trim()) || Boolean(tipo) || Boolean(dateFrom) || Boolean(dateTo) || Boolean(contactId);

    let data: any[] = [];
    let total = 0;
    if (requiresInMemoryFiltering) {
      const snap = await query.get();
      data = this.firebase.docsToArray(snap.docs);
    } else {
      const { docs, total: queryTotal } = await this.firebase.paginatedQuery(query, page, pageSize, query);
      data = this.firebase.docsToArray(docs);
      total = queryTotal;
    }

    // Batch reads de relaciones (company / contact / creator) para evitar N+1.
    const companyIds = Array.from(new Set(data.map((q: any) => q.companyId).filter(Boolean)));
    const contactIds = Array.from(new Set(data.map((q: any) => q.contactId).filter(Boolean)));
    const userIds = Array.from(new Set(data.map((q: any) => q.createdBy).filter(Boolean)));

    const companyRefs = companyIds.map(id => this.firebase.db.collection('companies').doc(id));
    const contactRefs = contactIds.map(id => this.firebase.db.collection('contacts').doc(id));
    const userRefs = userIds.map(id => this.firebase.db.collection('users').doc(id));

    const [companyDocs, contactDocs, userDocs] = await Promise.all([
      companyRefs.length ? this.firebase.db.getAll(...companyRefs) : Promise.resolve([]),
      contactRefs.length ? this.firebase.db.getAll(...contactRefs) : Promise.resolve([]),
      userRefs.length ? this.firebase.db.getAll(...userRefs) : Promise.resolve([]),
    ]);

    const companyMap = new Map(companyDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));
    const contactMap = new Map(contactDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));
    const userMap = new Map(userDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));

    for (const item of data) {
      const c = item.companyId ? companyMap.get(item.companyId) : null;
      if (c) item.company = { id: item.companyId, tradeName: c.tradeName, ruc: c.ruc };
      const ct = item.contactId ? contactMap.get(item.contactId) : null;
      if (ct) item.contact = { id: item.contactId, fullName: ct.fullName };
      const u = item.createdBy ? userMap.get(item.createdBy) : null;
      if (u) item.creator = { id: item.createdBy, fullName: u.fullName };
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

    if (requiresInMemoryFiltering) {
      total = data.length;
      data = this.firebase.paginateArray(data, page, pageSize);
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

    const supplyRefs: FirebaseFirestore.DocumentReference[] = [];
    const perfRateRefs: FirebaseFirestore.DocumentReference[] = [];

    // Collect all items and refs
    for (const section of quotation.sections) {
      const itemsSnap = await this.col.doc(id).collection('sections').doc(section.id).collection('items').orderBy('sortOrder', 'asc').get();
      section.items = this.firebase.docsToArray(itemsSnap.docs);

      for (const item of section.items) {
        if (item.supplyId) {
          supplyRefs.push(this.firebase.db.collection('supplies').doc(item.supplyId));
        }
        if (item.performanceRateId) {
          perfRateRefs.push(this.firebase.db.collection('performanceRates').doc(item.performanceRateId));
        }
      }
    }

    // Deduplicate and fetch in parallel
    const uniqueSupplyRefs = Array.from(new Set(supplyRefs.map(r => r.path))).map(p => this.firebase.db.doc(p));
    const uniquePerfRateRefs = Array.from(new Set(perfRateRefs.map(r => r.path))).map(p => this.firebase.db.doc(p));

    const [supplyDocs, perfRateDocs] = await Promise.all([
      uniqueSupplyRefs.length ? this.firebase.db.getAll(...uniqueSupplyRefs) : Promise.resolve([]),
      uniquePerfRateRefs.length ? this.firebase.db.getAll(...uniquePerfRateRefs) : Promise.resolve([]),
    ]);

    const supplyMap = new Map(supplyDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));
    const perfRateMap = new Map(perfRateDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));

    // Populate items
    for (const section of quotation.sections) {
      for (const item of section.items) {
        if (item.supplyId && supplyMap.has(item.supplyId)) {
          const s = supplyMap.get(item.supplyId);
          item.supply = { id: item.supplyId, code: s.code, name: s.name };
        }
        if (item.performanceRateId && perfRateMap.has(item.performanceRateId)) {
          const p = perfRateMap.get(item.performanceRateId);
          item.performanceRate = { id: item.performanceRateId, code: p.code, name: p.name };
        }
      }
    }

    return quotation;
  }

  /**
   * Valida campos numéricos comunes de cotización (porcentajes, días).
   * Lanza BadRequestException si algún valor está fuera de rango razonable.
   */
  private validateNumericFields(data: any) {
    const checks: Array<[string, number, number]> = [
      ['validityDays', 0, 365],
      ['igvPercentage', 0, 100],
      ['generalExpensesPercentage', 0, 100],
      ['profitMarginPercentage', 0, 100],
      ['deliveryTimeDays', 0, 3650],
    ];
    for (const [field, min, max] of checks) {
      if (data[field] === undefined || data[field] === null || data[field] === '') continue;
      const n = Number(data[field]);
      if (!Number.isFinite(n) || n < min || n > max) {
        throw new BadRequestException(`Campo "${field}" fuera de rango (${min}-${max})`);
      }
    }
    // Validate manualTotalOverride separately: must be positive if provided
    if (data.manualTotalOverride !== undefined && data.manualTotalOverride !== null && data.manualTotalOverride !== '') {
      const override = Number(data.manualTotalOverride);
      if (!Number.isFinite(override) || override < 0) {
        throw new BadRequestException('El monto manual debe ser un valor numérico positivo');
      }
    }
  }

  /**
   * Verifica que companyId/contactId/agreementId existan y sean coherentes entre sí.
   * Lanza BadRequestException si la relación es inválida (ej: contacto de otra empresa).
   */
  private sanitizeCommercialTerms(raw: unknown): CommercialTerms {
    if (!raw || typeof raw !== 'object') return {};
    const o = raw as Record<string, unknown>;
    const slice = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
    const out: CommercialTerms = {};
    const pm = slice(o.paymentMethod, 800);
    const pt = slice(o.paymentTerms, 4000);
    const el = slice(o.executionLocation, 800);
    const et = slice(o.executionTime, 800);
    const an = slice(o.additionalNotes, 8000);
    if (pm) out.paymentMethod = pm;
    if (pt) out.paymentTerms = pt;
    if (el) out.executionLocation = el;
    if (et) out.executionTime = et;
    if (an) out.additionalNotes = an;
    return out;
  }

  private sanitizeTechnicalSections(raw: unknown): TechnicalSection[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((s, i) => ({
      order: typeof s?.order === 'number' && Number.isFinite(s.order) ? s.order : i + 1,
      title: String(s?.title ?? '').trim().slice(0, 400),
      body: String(s?.body ?? '').slice(0, 120000),
    }));
  }

  private sanitizeCoverUrls(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((u): u is string => typeof u === 'string').map(u => u.trim().slice(0, 4000)).slice(0, 5);
  }

  /** Campos de documento comercial; solo incluye claves presentes en `data` (parche parcial). */
  private patchDocumentFieldsFromBody(data: Record<string, unknown>): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if ('documentMode' in data) {
      patch.documentMode = normalizeQuotationDocumentMode(data.documentMode);
    }
    if ('referenceSubject' in data) {
      patch.referenceSubject =
        typeof data.referenceSubject === 'string' ? data.referenceSubject.trim().slice(0, 500) : '';
    }
    if ('issuePlace' in data) {
      patch.issuePlace = typeof data.issuePlace === 'string' ? data.issuePlace.trim().slice(0, 400) : '';
    }
    if ('issueDate' in data) {
      const v = data.issueDate;
      patch.issueDate =
        v === null || v === ''
          ? null
          : typeof v === 'string'
            ? v.slice(0, 40)
            : v instanceof Date
              ? v.toISOString().slice(0, 10)
              : null;
    }
    if ('revisionLabel' in data) {
      patch.revisionLabel =
        typeof data.revisionLabel === 'string' ? data.revisionLabel.trim().slice(0, 80) : '';
    }
    if ('showTaxBreakdown' in data) {
      patch.showTaxBreakdown = data.showTaxBreakdown !== false;
    }
    if ('pricesIncludeIgv' in data) {
      patch.pricesIncludeIgv = !!data.pricesIncludeIgv;
    }
    if ('commercialTerms' in data) {
      patch.commercialTerms = this.sanitizeCommercialTerms(data.commercialTerms);
    }
    if ('technicalSections' in data) {
      patch.technicalSections = this.sanitizeTechnicalSections(data.technicalSections);
    }
    if ('projectCoverImageUrls' in data) {
      patch.projectCoverImageUrls = this.sanitizeCoverUrls(data.projectCoverImageUrls);
    }
    return patch;
  }

  private applyDocumentModeSideEffects(
    updatePayload: Record<string, unknown>,
    current: Record<string, unknown>,
  ) {
    const mode = updatePayload.documentMode ?? normalizeQuotationDocumentMode(current.documentMode);
    if (mode === QuotationDocumentMode.SIMPLE) {
      updatePayload.technicalSections = [];
      return;
    }
    if (mode !== QuotationDocumentMode.PROJECT) return;

    if ('technicalSections' in updatePayload) {
      const ts = updatePayload.technicalSections as TechnicalSection[];
      if (Array.isArray(ts) && ts.length === 0) {
        updatePayload.technicalSections = [...DEFAULT_PROJECT_TECHNICAL_SECTIONS];
      }
      return;
    }

    const existing = current.technicalSections;
    if (!Array.isArray(existing) || existing.length === 0) {
      updatePayload.technicalSections = [...DEFAULT_PROJECT_TECHNICAL_SECTIONS];
    }
  }

  private async validateRelations(data: { companyId?: string; contactId?: string; agreementId?: string }) {
    if (data.companyId) {
      const c = await this.firebase.db.collection('companies').doc(data.companyId).get();
      if (!c.exists) throw new BadRequestException('Empresa no encontrada');
    }
    if (data.contactId) {
      const c = await this.firebase.db.collection('contacts').doc(data.contactId).get();
      if (!c.exists) throw new BadRequestException('Contacto no encontrado');
      if (data.companyId && c.data()?.companyId !== data.companyId) {
        throw new BadRequestException('El contacto no pertenece a la empresa indicada');
      }
    }
    if (data.agreementId) {
      const a = await this.firebase.db.collection('agreements').doc(data.agreementId).get();
      if (!a.exists) throw new BadRequestException('Convenio no encontrado');
      if (data.companyId && a.data()?.companyId !== data.companyId) {
        throw new BadRequestException('El convenio no pertenece a la empresa indicada');
      }
    }
  }

  async create(data: any, userId: string) {
    if (!data?.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new BadRequestException('El título de la cotización es obligatorio');
    }
    this.validateNumericFields(data);
    await this.validateRelations(data);

    const number = await this.generateQuotationNumber();
    const id = this.firebase.generateId();
    const now = new Date();

    const companySettings = await this.configService.getCompanySettings();

    const documentMode = normalizeQuotationDocumentMode(data.documentMode);
    const commercialTerms = this.sanitizeCommercialTerms(data.commercialTerms);
    let technicalSections = this.sanitizeTechnicalSections(data.technicalSections);
    if (documentMode === QuotationDocumentMode.PROJECT && technicalSections.length === 0) {
      technicalSections = [...DEFAULT_PROJECT_TECHNICAL_SECTIONS];
    }
    if (documentMode === QuotationDocumentMode.SIMPLE) {
      technicalSections = [];
    }

    const docData = {
      ...data,
      documentMode,
      referenceSubject: typeof data.referenceSubject === 'string' ? data.referenceSubject.trim().slice(0, 500) : '',
      issuePlace: typeof data.issuePlace === 'string' ? data.issuePlace.trim().slice(0, 400) : '',
      issueDate:
        data.issueDate === null || data.issueDate === undefined || data.issueDate === ''
          ? null
          : String(data.issueDate).slice(0, 40),
      revisionLabel: typeof data.revisionLabel === 'string' ? data.revisionLabel.trim().slice(0, 80) : '',
      showTaxBreakdown: data.showTaxBreakdown !== false,
      pricesIncludeIgv: !!data.pricesIncludeIgv,
      commercialTerms,
      technicalSections,
      projectCoverImageUrls: this.sanitizeCoverUrls(data.projectCoverImageUrls),
      validityDays: data.validityDays ?? companySettings.defaultValidityDays ?? 15,
      currency: data.currency ?? companySettings.defaultCurrency ?? 'PEN',
      igvPercentage: data.igvPercentage ?? companySettings.defaultIgvPercentage ?? 18,
      quotationNumber: number,
      status: 'DRAFT',
      createdBy: userId,
      // Marcador explícito para futuro filtrado server-side de soft-delete.
      deletedAt: null,
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
    const currentStatus = doc.data()?.status;
    if (!QuotationsService.EDITABLE_STATUSES.has(currentStatus) && !isOnlyAttachments) {
      throw new BadRequestException('Solo se pueden editar cotizaciones en Borrador, Revisión, Seguimiento o Stand By');
    }

    // Si la actualización toca empresa/contacto/convenio, validar coherencia con
    // los valores resultantes (mezcla update + datos actuales).
    const touchesRelations = ['companyId', 'contactId', 'agreementId'].some(k => k in data);
    if (touchesRelations) {
      const current = doc.data() || {};
      await this.validateRelations({
        companyId: data.companyId ?? current.companyId,
        contactId: data.contactId ?? current.contactId,
        agreementId: data.agreementId ?? current.agreementId,
      });
    }

    if ('title' in data && (typeof data.title !== 'string' || !data.title.trim())) {
      throw new BadRequestException('El título no puede quedar vacío');
    }
    this.validateNumericFields(data);

    const docPatch = this.patchDocumentFieldsFromBody(data);
    const updateData: any = { ...data, updatedAt: new Date(), ...docPatch };
    this.applyDocumentModeSideEffects(updateData, doc.data() || {});

    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  async updateStatus(id: string, newStatus: string, userId: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    const quotation = doc.data()!;

    const validStatuses = Object.values(QuotationStatus) as string[];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException(`Estado inválido: ${newStatus}`);
    }

    const currentStatus = (quotation.status || QuotationStatus.DRAFT) as string;
    const allowed = new Set<string>(
      QUOTATION_STATUS_TRANSITIONS[currentStatus as QuotationStatus] || [],
    );
    if (currentStatus !== newStatus && !allowed.has(newStatus)) {
      throw new BadRequestException(
        `Transición no permitida: ${currentStatus} → ${newStatus}`,
      );
    }

    const data: any = { status: newStatus, updatedAt: new Date() };
    if (newStatus === QuotationStatus.APPROVED) {
      data.approvedBy = userId;
      data.approvedAt = new Date();
    }
    if (newStatus === QuotationStatus.SENT) {
      data.sentAt = new Date();
      data.expiresAt = new Date(Date.now() + (quotation.validityDays || 15) * 86400000);
    }

    await this.col.doc(id).update(data);
    return { id, ...quotation, ...data };
  }

  async recalculate(id: string) {
    // When recalculating from items, clear any manual override so the
    // computed total takes precedence going forward.
    await this.col.doc(id).update({ manualTotalOverride: null, updatedAt: new Date() });
    return this.calculator.recalculateQuotation(id);
  }

  /**
   * Sets a manual total override for a quotation without touching items.
   * Pass null to clear the override and revert to auto-calculation.
   */
  async setManualTotal(id: string, manualTotal: number | null) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    if (manualTotal !== null) {
      if (!Number.isFinite(manualTotal) || manualTotal < 0) {
        throw new BadRequestException('El monto manual debe ser un valor positivo');
      }
    }
    const updateData: any = {
      manualTotalOverride: manualTotal,
      updatedAt: new Date(),
    };
    // If setting an override, immediately reflect it in `total`
    if (manualTotal !== null) {
      updateData.total = manualTotal;
    }
    await this.col.doc(id).update(updateData);
    // Trigger full recalculation to keep subtotal/igv in sync
    return this.calculator.recalculateQuotation(id);
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Cotización no encontrada');
    await this.col.doc(id).update({ deletedAt: new Date(), updatedAt: new Date() });
    return { id };
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
      tipo: original.tipo,
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
      documentMode: original.documentMode ?? QuotationDocumentMode.SIMPLE,
      referenceSubject: original.referenceSubject ?? '',
      issuePlace: original.issuePlace ?? '',
      issueDate: original.issueDate ?? null,
      revisionLabel: original.revisionLabel ?? '',
      showTaxBreakdown: original.showTaxBreakdown !== false,
      pricesIncludeIgv: !!original.pricesIncludeIgv,
      commercialTerms: original.commercialTerms ?? {},
      technicalSections: Array.isArray(original.technicalSections) ? original.technicalSections : [],
      projectCoverImageUrls: Array.isArray(original.projectCoverImageUrls)
        ? original.projectCoverImageUrls
        : [],
      parentQuotationId: original.id,
      version: (original.version || 1) + 1,
      status: 'DRAFT',
      createdBy: userId,
      deletedAt: null,
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
          unit: item.unit,
          supplyId: item.supplyId,
          performanceRateId: item.performanceRateId,
          unitOfMeasure: item.unitOfMeasure,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
          longDescription: item.longDescription,
          subtotal: item.subtotal,
          notes: item.notes,
        });
      }
    }

    await batch.commit();
    return await this.findOne(newId);
  }

  private async generateQuotationNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(year).slice(-2);
    // Counter per year+month so each month restarts the sequence
    const counterKey = `quotations_${year}${month}`;
    const counterRef = this.firebase.db.collection('_counters').doc(counterKey);
    const res = await this.firebase.db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const count = doc.exists ? doc.data()?.count + 1 : 1;
      t.set(counterRef, { count }, { merge: true });
      return count;
    });
    return `COT-${yy}${month}-${String(res).padStart(3, '0')}`;
  }


}
