import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { QuotationCalculatorService } from './quotation-calculator.service';
import { QuotationStatus } from '@fym/shared';

@Injectable()
export class QuotationItemsService {
  private static readonly EDITABLE_STATUSES = new Set<string>([
    QuotationStatus.DRAFT,
    QuotationStatus.REVIEW,
    'FOLLOW_UP',
    'STAND_BY',
  ]);

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

  private async assertEditable(quotationId: string) {
    const qDoc = await this.firebase.db.collection('quotations').doc(quotationId).get();
    if (!qDoc.exists) throw new NotFoundException('Cotización no encontrada');
    const status = qDoc.data()?.status;
    if (!QuotationItemsService.EDITABLE_STATUSES.has(status)) {
      throw new BadRequestException('Solo se pueden modificar ítems en cotizaciones en Borrador, Revisión, Seguimiento o Stand By');
    }
  }

  private sanitizeCostBreakdown(items: any[]) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const quantity = Number(item.quantity);
        const unitCost = Number(item.unitCost);
        const subtotal = Number.isFinite(quantity) && Number.isFinite(unitCost)
          ? quantity * unitCost
          : 0;
        return {
          category: String(item.category || 'Materiales / Insumos').trim(),
          description: String(item.description || '').trim(),
          unit: String(item.unit || 'UND').trim(),
          quantity: Number.isFinite(quantity) ? quantity : 0,
          unitCost: Number.isFinite(unitCost) ? unitCost : 0,
          subtotal,
        };
      })
      .filter((item) => item.description && item.quantity > 0 && item.unitCost >= 0);
  }

  private buildPricingData(data: any, existing?: any) {
    const quantity = Number(data.quantity ?? existing?.quantity ?? 0);
    const costBreakdown = this.sanitizeCostBreakdown(data.costBreakdown ?? existing?.costBreakdown ?? []);
    if (costBreakdown.length === 0) {
      const unitPrice = Number(data.unitCost ?? data.unitPrice ?? existing?.unitPrice ?? existing?.unitCost ?? 0);
      return {
        ...data,
        unitPrice,
        subtotal: quantity * unitPrice,
        costBreakdown: data.costBreakdown === undefined ? existing?.costBreakdown : [],
        profitabilityPercentage: null,
        costTotal: data.costBreakdown === undefined ? (data.costTotal ?? existing?.costTotal ?? null) : null,
        saleTotal: quantity * unitPrice,
      };
    }

    const costTotal = costBreakdown.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const saleTotal = costTotal;
    const unitPrice = quantity > 0 ? saleTotal / quantity : 0;

    return {
      ...data,
      costBreakdown,
      profitabilityPercentage: null,
      costTotal,
      saleTotal,
      unitPrice,
      subtotal: saleTotal,
    };
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private supplyTypeFromCostCategory(category: string) {
    const normalized = this.normalizeName(category);
    if (normalized.includes('mano de obra')) return 'WORKFORCE';
    if (normalized.includes('maquinaria')) return 'EQUIPMENT';
    if (normalized.includes('herramient')) return 'TOOL';
    if (normalized.includes('transporte') || normalized.includes('logistica')) return 'SERVICE';
    return 'MATERIAL';
  }

  private async syncCostBreakdownToSupplies(costBreakdown: any[]) {
    const validRows = this.sanitizeCostBreakdown(costBreakdown);
    if (validRows.length === 0) return;

    const now = new Date();
    const batch = this.firebase.db.batch();

    for (const row of validRows) {
      const normalizedName = this.normalizeName(row.description);
      if (!normalizedName) continue;
      const existing = await this.firebase.db
        .collection('supplies')
        .where('normalizedName', '==', normalizedName)
        .limit(1)
        .get();

      if (existing.empty) {
        const ref = this.firebase.db.collection('supplies').doc(this.firebase.generateId());
        batch.set(ref, {
          code: `APU-${ref.id.slice(-6).toUpperCase()}`,
          name: row.description,
          normalizedName,
          description: row.category,
          supplyType: this.supplyTypeFromCostCategory(row.category),
          unitOfMeasure: row.unit,
          baseUnitCost: row.unitCost,
          currency: 'PEN',
          source: 'QUOTATION_APU',
          isActive: true,
          lastPriceUpdate: now,
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      const doc = existing.docs[0];
      const current = doc.data();
      const priceChanged = Number(current.baseUnitCost || 0) !== Number(row.unitCost || 0);
      batch.update(doc.ref, {
        name: current.name || row.description,
        description: current.description || row.category,
        supplyType: current.supplyType || this.supplyTypeFromCostCategory(row.category),
        unitOfMeasure: row.unit || current.unitOfMeasure || 'UND',
        baseUnitCost: row.unitCost,
        lastPriceUpdate: priceChanged ? now : current.lastPriceUpdate || now,
        updatedAt: now,
      });

      if (priceChanged) {
        const historyRef = doc.ref.collection('priceHistory').doc();
        batch.set(historyRef, {
          oldPrice: current.baseUnitCost ?? null,
          newPrice: row.unitCost,
          reason: 'Actualizacion desde APU de cotizacion',
          changedAt: now,
        });
      }
    }

    await batch.commit();
  }

  async create(quotationId: string, sectionId: string, data: any) {
    await this.assertEditable(quotationId);
    const id = this.firebase.generateId();
    const existing = await this.col(quotationId, sectionId).get();
    const sortOrder = data.sortOrder ?? existing.size;
    const docData = { ...this.buildPricingData(data), sortOrder };
    await this.col(quotationId, sectionId).doc(id).set(docData);
    await this.syncCostBreakdownToSupplies(docData.costBreakdown || []);
    await this.calculator.recalculateQuotation(quotationId);
    return { id, ...docData };
  }

  async update(quotationId: string, sectionId: string, id: string, data: any) {
    await this.assertEditable(quotationId);
    const docRef = this.col(quotationId, sectionId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Item no encontrado');

    const existing = doc.data()!;
    const updateData = this.buildPricingData(data, existing);

    await docRef.update(updateData);
    await this.syncCostBreakdownToSupplies(updateData.costBreakdown || []);
    await this.calculator.recalculateQuotation(quotationId);
    return { id, ...existing, ...updateData };
  }

  async delete(quotationId: string, sectionId: string, id: string) {
    await this.assertEditable(quotationId);
    const docRef = this.col(quotationId, sectionId).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new NotFoundException('Item no encontrado');
    await docRef.delete();
    await this.calculator.recalculateQuotation(quotationId);
    return { message: 'Item eliminado' };
  }

  async reorder(quotationId: string, sectionId: string, orderedIds: string[]) {
    await this.assertEditable(quotationId);
    const batch = this.firebase.db.batch();
    orderedIds.forEach((id, i) => {
      const ref = this.col(quotationId, sectionId).doc(id);
      batch.update(ref, { sortOrder: i });
    });
    await batch.commit();
    return { message: 'Reordenado correctamente' };
  }
}
