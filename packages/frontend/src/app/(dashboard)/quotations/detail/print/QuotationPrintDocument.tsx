'use client';

/* eslint-disable @next/next/no-img-element */

import { QuotationDocumentMode, normalizeQuotationDocumentMode } from '@fym/shared';
import { QuotationPrintSimple } from './QuotationPrintSimple';
import { QuotationPrintProject } from './QuotationPrintProject';

export function QuotationPrintDocument({
  quotation,
  companySettings,
  quotationId,
}: {
  quotation: any;
  companySettings: any;
  quotationId: string;
}) {
  const mode = normalizeQuotationDocumentMode(quotation?.documentMode);
  if (mode === QuotationDocumentMode.PROJECT) {
    return (
      <QuotationPrintProject quotation={quotation} companySettings={companySettings} quotationId={quotationId} />
    );
  }
  return <QuotationPrintSimple quotation={quotation} companySettings={companySettings} quotationId={quotationId} />;
}
