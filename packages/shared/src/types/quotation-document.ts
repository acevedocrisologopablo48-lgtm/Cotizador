/**
 * Modo de documento comercial: una hoja resumida vs. propuesta técnico-económica multipágina.
 */
export enum QuotationDocumentMode {
  SIMPLE = 'SIMPLE',
  PROJECT = 'PROJECT',
}

/** Condiciones comerciales estructuradas (equivalente a tablas de las plantillas Word/PDF de referencia). */
export interface CommercialTerms {
  paymentMethod?: string;
  paymentTerms?: string;
  executionLocation?: string;
  executionTime?: string;
  additionalNotes?: string;
}

export interface TechnicalSection {
  order: number;
  title: string;
  body: string;
}

export const DEFAULT_PROJECT_TECHNICAL_SECTIONS: TechnicalSection[] = [
  { order: 1, title: 'Introducción', body: '' },
  { order: 2, title: 'Objetivo', body: '' },
  { order: 3, title: 'Lugar de trabajo', body: '' },
  { order: 4, title: 'Alcance del servicio', body: '' },
  { order: 5, title: 'Entregables', body: '' },
  { order: 6, title: 'Tiempo de ejecución', body: '' },
  { order: 7, title: 'Personal técnico', body: '' },
  { order: 8, title: 'Exclusiones', body: '' },
  { order: 9, title: 'Notas u observaciones', body: '' },
  { order: 10, title: 'Garantía', body: '' },
  { order: 11, title: 'Acuerdos comerciales', body: '' },
  { order: 12, title: 'Presupuesto', body: '' },
];

export function normalizeQuotationDocumentMode(value: unknown): QuotationDocumentMode {
  if (value === QuotationDocumentMode.PROJECT) return QuotationDocumentMode.PROJECT;
  return QuotationDocumentMode.SIMPLE;
}

/**
 * Avisos de completitud antes de exportar (PDF / impresión). No bloquea guardado en borrador.
 */
export function getQuotationExportWarnings(input: {
  documentMode?: string;
  referenceSubject?: string;
  title?: string;
  commercialTerms?: CommercialTerms | null;
  technicalSections?: TechnicalSection[] | null;
  sections?: Array<{ items?: unknown[] }>;
}): string[] {
  const warnings: string[] = [];
  const mode = normalizeQuotationDocumentMode(input.documentMode);

  if (!input.title?.trim()) {
    warnings.push('Falta el título de la propuesta.');
  }

  if (!input.referenceSubject?.trim()) {
    warnings.push('Falta el campo Referencia / asunto del servicio.');
  }

  const ct = input.commercialTerms || {};
  if (!ct.executionLocation?.trim()) {
    warnings.push('Falta el lugar de ejecución (condiciones comerciales).');
  }
  if (!ct.executionTime?.trim()) {
    warnings.push('Falta el plazo o tiempo de ejecución.');
  }
  if (!ct.paymentMethod?.trim()) {
    warnings.push('Falta la forma de pago.');
  }

  const sections = input.sections || [];
  const itemCount = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  if (itemCount === 0) {
    warnings.push('No hay ítems en el presupuesto.');
  }

  if (mode === QuotationDocumentMode.PROJECT) {
    const ts = input.technicalSections || [];
    if (ts.length === 0) {
      warnings.push('Modo proyecto: no hay secciones técnicas. Use “Cargar plantilla estándar”.');
    } else {
      const emptyBodies = ts.filter(t => !String(t.body || '').trim()).length;
      if (emptyBodies > 0) {
        warnings.push(`Modo proyecto: ${emptyBodies} sección(es) técnica(s) sin contenido.`);
      }
    }
  }

  return warnings;
}
