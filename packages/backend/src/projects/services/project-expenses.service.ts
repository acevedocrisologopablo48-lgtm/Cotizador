import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class ProjectExpensesService {
  private readonly logger = new Logger(ProjectExpensesService.name);
  constructor(private firebase: FirebaseService) {}

  private col(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId).collection('expenses');
  }

  private async assertProject(projectId: string) {
    const doc = await this.firebase.db.collection('projects').doc(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  private redactForSupervisor(item: any) {
    return {
      ...item,
      amount: null,
      unitPrice: null,
      totalAmount: null,
    };
  }

  async findByProject(projectId: string, params: { page?: number; pageSize?: number; category?: string; user?: any }) {
    const { page: rawPage, pageSize: rawPageSize, category, user } = params;
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 20));

    let query: FirebaseFirestore.Query = this.col(projectId);
    if (category) query = query.where('expenseCategory', '==', category);

    query = query.orderBy('expenseDate', 'desc');

    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    // Batch user lookups to avoid N+1 queries
    const userIds = Array.from(new Set(
      data.flatMap((item: any) => [item.registeredBy, item.approvedBy].filter(Boolean)),
    ));
    const userRefs = userIds.map(id => this.firebase.db.collection('users').doc(id));
    const userDocs = userRefs.length ? await this.firebase.db.getAll(...userRefs) : [];
    const userMap = new Map(userDocs.filter(d => d.exists).map(d => [d.id, d.data() as any]));

    for (const item of data) {
      if (item.registeredBy && userMap.has(item.registeredBy)) {
        item.registeredByUser = { fullName: userMap.get(item.registeredBy)!.fullName };
      }
      if (item.approvedBy && userMap.has(item.approvedBy)) {
        item.approvedByUser = { fullName: userMap.get(item.approvedBy)!.fullName };
      }
    }

    const visibleData = user?.role === 'FIELD_SUPERVISOR'
      ? data.map(item => this.redactForSupervisor(item))
      : data;

    return { data: visibleData, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(projectId: string, data: any, userId: string) {
    await this.assertProject(projectId);
    const id = this.firebase.generateId();
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto del gasto debe ser mayor a 0');
    }

    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (!description) {
      throw new BadRequestException('La descripción del gasto es obligatoria');
    }

    const expenseDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      throw new BadRequestException('La fecha del gasto es inválida');
    }

    const allowedCategories = new Set([
      'MATERIAL',
      'EQUIPMENT',
      'LABOR',
      'SUBCONTRACT',
      'TRANSPORT',
      'LODGING',
      'FOOD',
      'FUEL',
      'TOOLS',
      'PERMITS',
      'OTHER',
    ]);
    const expenseCategory = String(data.expenseCategory || 'OTHER');
    if (!allowedCategories.has(expenseCategory)) {
      throw new BadRequestException('Categoría de gasto inválida');
    }

    const docData = {
      expenseCategory,
      description,
      amount,
      supplierName: typeof data.supplierName === 'string' ? data.supplierName.trim() : null,
      supplierRuc: typeof data.supplierRuc === 'string' ? data.supplierRuc.trim() : null,
      paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod.trim() : 'CASH',
      documentType: typeof data.documentType === 'string' ? data.documentType.trim() : 'NONE',
      documentNumber: typeof data.documentNumber === 'string' ? data.documentNumber.trim() : null,
      invoiceNumber:
        (typeof data.invoiceNumber === 'string' ? data.invoiceNumber.trim() : null) ||
        (typeof data.documentNumber === 'string' ? data.documentNumber.trim() : null),
      invoiceImageUrl: typeof data.invoiceImageUrl === 'string' ? data.invoiceImageUrl.trim() : null,
      expenseDate,
      registeredBy: userId,
      paymentStatus: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const batch = this.firebase.db.batch();
    batch.set(this.col(projectId).doc(id), docData);

    if (docData.description && docData.amount > 0) {
      const unitPrice = Number(data.unitPrice);
      const priceRef = this.firebase.db.collection('priceHistory').doc();
      batch.set(priceRef, {
        projectId,
        expenseId: id,
        description: docData.description,
        supplierName: docData.supplierName || null,
        supplierRuc: docData.supplierRuc || null,
        unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : docData.amount,
        totalAmount: docData.amount,
        category: docData.expenseCategory || null,
        documentNumber: docData.invoiceNumber || docData.documentNumber || null,
        recordedAt: new Date(),
        recordedBy: userId,
      });
    }

    await batch.commit();
    return { id, ...docData };
  }

  async approve(projectId: string, id: string, userId: string) {
    const docRef = this.col(projectId).doc(id);
    await docRef.update({ approvedBy: userId, paymentStatus: 'PAID', approvedAt: new Date() });
    return { id, message: 'Aprobado y marcado como pagado' };
  }
}
