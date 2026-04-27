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

  private get companyDoc() {
    return this.firebase.db.collection('_config').doc('companySettings');
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

  async getCompanySettings(): Promise<any> {
    const doc = await this.companyDoc.get();
    if (!doc.exists) return { 
      name: 'FYM TECHNOLOGIES', 
      ruc: '', 
      address: '', 
      phone: '', 
      email: '', 
      website: '', 
      bankDetails: '', 
      notes: '', 
      logoUrl: '',
      slogan: '',
      legalRepresentative: '',
      legalRepresentativeRole: '',
      defaultCurrency: 'PEN',
      defaultValidityDays: 15,
      defaultIgvPercentage: 18,
      signatureUrl: '' 
    };
    return doc.data() || {};
  }

  async updateCompanySettings(data: any): Promise<any> {
    const sanitized = {
      name: data.name ?? '',
      ruc: data.ruc ?? '',
      address: data.address ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      website: data.website ?? '',
      bankDetails: data.bankDetails ?? '',
      notes: data.notes ?? '',
      logoUrl: data.logoUrl ?? '',
      slogan: data.slogan ?? '',
      legalRepresentative: data.legalRepresentative ?? '',
      legalRepresentativeRole: data.legalRepresentativeRole ?? '',
      defaultCurrency: data.defaultCurrency ?? 'PEN',
      defaultValidityDays: Number(data.defaultValidityDays) || 15,
      defaultIgvPercentage: Number(data.defaultIgvPercentage) || 18,
      signatureUrl: data.signatureUrl ?? '',
      updatedAt: new Date(),
    };
    await this.companyDoc.set(sanitized, { merge: true });
    return sanitized;
  }
}
