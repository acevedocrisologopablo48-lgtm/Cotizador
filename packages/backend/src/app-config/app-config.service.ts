import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

const DEFAULT_QUOTATION_TYPES = [
  'HVAC',
  'IIEE',
  'Montaje',
  'Arquitectura',
  'Civiles',
  'PTAR',
  'Tableros',
];

@Injectable()
export class AppConfigService {
  constructor(private firebase: FirebaseService) {}

  private get configDoc() {
    return this.firebase.db.collection('_config').doc('quotationTypes');
  }

  async getQuotationTypes(): Promise<string[]> {
    const doc = await this.configDoc.get();
    if (!doc.exists) return DEFAULT_QUOTATION_TYPES;
    return doc.data()?.types ?? DEFAULT_QUOTATION_TYPES;
  }

  async updateQuotationTypes(types: string[]): Promise<string[]> {
    const cleaned = types
      .map(t => t.trim())
      .filter(t => t.length > 0)
      // Remove duplicates (case-insensitive)
      .filter((t, i, arr) => arr.findIndex(x => x.toLowerCase() === t.toLowerCase()) === i);

    await this.configDoc.set({ types: cleaned, updatedAt: new Date() }, { merge: true });
    return cleaned;
  }
}
