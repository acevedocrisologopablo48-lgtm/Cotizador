/**
 * Configuración corporativa persistida en Firestore (_config/companySettings).
 * Compartida entre backend y frontend para tipado consistente.
 */
export interface CompanySettings {
  name: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankDetails: string;
  notes: string;
  logoUrl: string;
  slogan: string;
  legalRepresentative: string;
  legalRepresentativeRole: string;
  defaultCurrency: string;
  defaultValidityDays: number;
  defaultIgvPercentage: number;
  signatureUrl: string;
  maxPhotosPerProgress: number;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
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
  signatureUrl: '',
  maxPhotosPerProgress: 3,
};
