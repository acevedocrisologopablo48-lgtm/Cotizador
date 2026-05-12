import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class QuotationCalculatorService {
  private readonly logger = new Logger(QuotationCalculatorService.name);
  constructor(private firebase: FirebaseService) {}

  async recalculateQuotation(quotationId: string) {
    const qRef = this.firebase.db.collection('quotations').doc(quotationId);
    const qDoc = await qRef.get();
    if (!qDoc.exists) return null;

    const quotation = qDoc.data()!;
    const sectionsSnap = await qRef.collection('sections').get();
    const batch = this.firebase.db.batch();

    let directSubtotal = 0;

    for (const sectionDoc of sectionsSnap.docs) {
      const itemsSnap = await sectionDoc.ref.collection('items').get();
      let sectionSubtotal = 0;

      for (const itemDoc of itemsSnap.docs) {
        const item = itemDoc.data();
        const itemSubtotal = Number(item.saleTotal ?? Number(item.quantity || 0) * Number(item.unitPrice ?? item.unitCost ?? 0));
        
        batch.update(itemDoc.ref, { subtotal: itemSubtotal });
        sectionSubtotal += itemSubtotal;
      }

      batch.update(sectionDoc.ref, { subtotal: sectionSubtotal });
      directSubtotal += sectionSubtotal;
    }

    const gePercentage = Number(quotation.generalExpensesPercentage || 0);
    const profitPercentage = Number(quotation.profitMarginPercentage || 0);
    const commercialDiscountPercentage = Number(quotation.commercialDiscountPercentage || 0);

    const geAmount = (directSubtotal * gePercentage) / 100;
    const profitAmount = (directSubtotal * profitPercentage) / 100;
    const subtotalBeforeDiscount = directSubtotal + geAmount + profitAmount;
    const commercialDiscountAmount = (subtotalBeforeDiscount * commercialDiscountPercentage) / 100;
    const subtotal = Math.max(0, subtotalBeforeDiscount - commercialDiscountAmount);
    const igvPercentage = Number(quotation.igvPercentage || 18);
    const igvAmount = (subtotal * igvPercentage) / 100;
    const computedTotal = subtotal + igvAmount;

    // If a manual override is set, use it as the final total.
    // The computed breakdown (subtotal, igv) is still stored for reference.
    const manualOverride = quotation.manualTotalOverride;
    const total = (manualOverride !== undefined && manualOverride !== null && Number(manualOverride) > 0)
      ? Number(manualOverride)
      : computedTotal;

    batch.update(qRef, {
      directSubtotal,
      generalExpensesAmount: geAmount,
      profitAmount,
      subtotalBeforeDiscount,
      commercialDiscountPercentage,
      commercialDiscountAmount,
      subtotal,
      igv: igvAmount,
      igvAmount,
      total,
    });
    await batch.commit();

    return { message: 'Recalculado correctamente', total };
  }
}
