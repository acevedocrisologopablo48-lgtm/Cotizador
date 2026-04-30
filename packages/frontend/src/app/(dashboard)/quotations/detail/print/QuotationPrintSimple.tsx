'use client';

/* eslint-disable @next/next/no-img-element */

import { Fragment } from 'react';
import { fmtPrintMoney, formatIssueDatePrint, statusLabelPrint } from './print-helpers';

export function QuotationPrintSimple({
  quotation,
  companySettings,
  quotationId,
}: {
  quotation: any;
  companySettings: any;
  quotationId: string;
}) {
  const cur = quotation.currency || 'PEN';
  const fmt = (n: number) => fmtPrintMoney(n, cur);
  const place = quotation.issuePlace?.trim() || companySettings?.address || 'Lima';
  const when = formatIssueDatePrint(quotation.issueDate, quotation.createdAt);
  const clientName =
    quotation.company?.tradeName || quotation.company?.businessName || quotation.client?.name || 'Sin cliente asignado';
  const contactName = quotation.contact?.fullName || quotation.client?.contactName || '—';
  const refLine = quotation.referenceSubject?.trim() || quotation.title || '—';
  const ct = quotation.commercialTerms && typeof quotation.commercialTerms === 'object' ? quotation.commercialTerms : {};
  const showTax = quotation.showTaxBreakdown !== false;
  const includeIgv = quotation.pricesIncludeIgv === true;
  const draft = quotation.status === 'DRAFT' || quotation.status === 'REVIEW';
  const qNum = quotation.quotationNumber || `COT-${quotationId.slice(0, 5).toUpperCase()}`;
  const rev = quotation.revisionLabel ? ` (${quotation.revisionLabel})` : '';

  const taxNote = showTax
    ? includeIgv
      ? 'Los importes mostrados incluyen IGV según el desglose siguiente.'
      : 'Los importes no incluyen IGV. Se muestran subtotal, IGV y total.'
    : 'Total conforme a la propuesta.';

  let itemIdx = 0;
  return (
    <div className="hidden print:block font-sans bg-white text-black min-h-screen relative" style={{ padding: '14mm 15mm 22mm 15mm' }}>
      {draft && (
        <div
          className="pointer-events-none select-none"
          style={{
            position: 'fixed',
            top: '38%',
            left: '18%',
            transform: 'rotate(-24deg)',
            fontSize: '44pt',
            color: 'rgba(148,163,184,0.15)',
            fontWeight: 900,
            zIndex: 0,
          }}
        >
          BORRADOR
        </div>
      )}
      <div className="relative z-[1]">
        <div className="flex justify-between items-start mb-8 border-b-[3px] border-[#1e3a5f] pb-5">
          <div>
            <p className="text-[10pt] m-0">
              {place}, {when}
            </p>
            <h1 className="text-[16pt] font-black text-[#1e3a5f] m-0 mt-2">
              PROPUESTA Nº {qNum}
              {rev}
            </h1>
            <p className="text-[9pt] text-slate-500 m-0 mt-1">{statusLabelPrint(quotation.status)}</p>
          </div>
          {companySettings?.logoUrl && (
            <img src={companySettings.logoUrl} alt="Logo" className="max-h-16 object-contain" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-7">
          <div className="p-3 rounded-md border border-slate-200 bg-slate-50 border-l-4 border-l-orange-500">
            <h4 className="text-[7.5pt] font-extrabold text-orange-600 uppercase tracking-widest m-0 mb-2">Cliente</h4>
            <p className="text-[10pt] font-extrabold m-0">Señores: {clientName}</p>
            <p className="text-[8.5pt] text-slate-700 mt-2 m-0">Atención: {contactName}</p>
            <p className="text-[8.5pt] text-slate-700 mt-2 m-0">Referencia: {refLine}</p>
          </div>
          <div className="p-3 rounded-md border border-slate-200 bg-slate-50 border-l-4 border-l-[#1e3a5f]">
            <h4 className="text-[7.5pt] font-extrabold text-[#1e3a5f] uppercase tracking-widest m-0 mb-2">Condiciones</h4>
            <p className="text-[9pt] m-0">Validez: {quotation.validityDays ?? 30} días</p>
            <p className="text-[9pt] mt-2 m-0">Moneda: {cur}</p>
            <p className="text-[8pt] text-slate-500 mt-2 m-0">{companySettings?.name}</p>
          </div>
        </div>

        {quotation.introductionText && (
          <div className="mb-8 p-3.5 bg-slate-50 border-l-4 border-[#1e3a5f] rounded-r">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-2 border-b-2 border-orange-400 pb-1 inline-block">Alcance</h2>
            <p className="text-[9.5pt] text-slate-800 whitespace-pre-wrap m-0 leading-relaxed">{quotation.introductionText}</p>
          </div>
        )}

        <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-3 border-b-2 border-orange-400 pb-1">Detalle de inversión</h2>
        <table className="w-full border-collapse text-[8.5pt] mb-8">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="text-left p-2 pl-3.5 text-[7.5pt] uppercase tracking-wide">Ítem</th>
              <th className="text-left p-2 text-[7.5pt] uppercase tracking-wide">Descripción</th>
              <th className="text-center p-2 w-14 text-[7.5pt] uppercase">Und.</th>
              <th className="text-right p-2 w-[72px] text-[7.5pt] uppercase">Cant.</th>
              <th className="text-right p-2 w-[88px] text-[7.5pt] uppercase">P. unit.</th>
              <th className="text-right p-2 pr-3.5 w-[96px] text-[7.5pt] uppercase">P. total</th>
            </tr>
          </thead>
          <tbody>
            {(quotation.sections || []).flatMap((section: any) =>
              (section.items || []).map((item: any) => {
                itemIdx += 1;
                const qty = Number(item.quantity || 0);
                const price = Number(item.unitPrice ?? item.unitCost ?? 0);
                const sub = Number(item.subtotal ?? qty * price);
                return (
                  <Fragment key={item.id}>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 pl-3.5">{itemIdx}</td>
                      <td className="p-2 text-slate-800">{item.description}</td>
                      <td className="p-2 text-center font-mono text-[8pt] text-slate-600">{item.unit || item.unitOfMeasure || 'UND'}</td>
                      <td className="p-2 text-right font-mono">{qty.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{fmt(price)}</td>
                      <td className="p-2 pr-3.5 text-right font-mono font-bold">{fmt(sub)}</td>
                    </tr>
                    {item.longDescription?.trim() ? (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 text-[9pt] p-3 px-3.5">
                          <strong>Detalle / alcance</strong>
                          <div className="whitespace-pre-wrap text-slate-700 mt-1">{item.longDescription}</div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              }),
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-8 break-inside-avoid">
          <div className="w-72 border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="flex justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-[9pt]">
              <span className="text-slate-600 font-bold uppercase text-[8.5pt]">Subtotal operativo</span>
              <span className="font-mono font-bold">{fmt(quotation.subtotal || 0)}</span>
            </div>
            {showTax && (
              <div className="flex justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-[9pt]">
                <span className="text-slate-600 font-bold uppercase text-[8.5pt]">IGV ({quotation.igvPercentage ?? 18}%)</span>
                <span className="font-mono font-bold">{fmt(quotation.igv ?? quotation.igvAmount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-3 bg-[#1e3a5f] text-white text-[10.5pt] font-black">
              <span>TOTAL</span>
              <span className="font-mono">{fmt(quotation.total || 0)}</span>
            </div>
            <p className="text-[8pt] text-slate-500 px-3 py-2 m-0">{taxNote}</p>
          </div>
        </div>

        {(ct.paymentMethod || ct.executionLocation) && (
          <>
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-2 border-b-2 border-orange-400 pb-1">Condiciones comerciales</h2>
            <table className="w-full border-collapse text-[9pt] mb-6">
              <tbody>
                {ct.paymentMethod && (
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-semibold w-2/5 align-top">Forma de pago</td>
                    <td className="py-2 whitespace-pre-wrap">{ct.paymentMethod}</td>
                  </tr>
                )}
                {ct.paymentTerms && (
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-semibold align-top">Condiciones de pago</td>
                    <td className="py-2 whitespace-pre-wrap">{ct.paymentTerms}</td>
                  </tr>
                )}
                {ct.executionLocation && (
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-semibold align-top">Lugar de ejecución</td>
                    <td className="py-2 whitespace-pre-wrap">{ct.executionLocation}</td>
                  </tr>
                )}
                {ct.executionTime && (
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-semibold align-top">Plazo de ejecución</td>
                    <td className="py-2 whitespace-pre-wrap">{ct.executionTime}</td>
                  </tr>
                )}
                {ct.additionalNotes && (
                  <tr>
                    <td className="py-2 font-semibold align-top">Notas</td>
                    <td className="py-2 whitespace-pre-wrap">{ct.additionalNotes}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {quotation.termsAndConditions && (
          <div className="mb-6">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-2 border-b-2 border-orange-400 pb-1">Condiciones generales</h2>
            <p className="text-[8pt] text-slate-600 whitespace-pre-wrap leading-relaxed m-0">{quotation.termsAndConditions}</p>
          </div>
        )}

        {quotation.warrantyText && (
          <div className="mb-6">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-2 border-b-2 border-orange-400 pb-1">Garantía</h2>
            <p className="text-[8pt] text-slate-600 whitespace-pre-wrap m-0">{quotation.warrantyText}</p>
          </div>
        )}

        <div className="grid grid-cols-[1.5fr_1fr] gap-5 border-t-2 border-slate-200 pt-5 break-inside-avoid">
          <div className="flex flex-col gap-3">
            {companySettings?.bankDetails && (
              <div className="p-3 bg-slate-50 rounded border-l-4 border-orange-500">
                <h5 className="text-[7.5pt] font-extrabold text-orange-600 uppercase m-0 mb-1">Información de pago</h5>
                <p className="text-[8pt] text-slate-600 whitespace-pre-wrap m-0 leading-relaxed">{companySettings.bankDetails}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-end pb-2">
            {companySettings?.signatureUrl && (
              <img src={companySettings.signatureUrl} alt="Firma" className="max-h-[76px] object-contain mb-2" />
            )}
            <div className="w-4/5 border-t border-slate-400 pt-2 text-center">
              <p className="text-[9pt] font-extrabold text-slate-900 m-0">
                {companySettings?.legalRepresentative || companySettings?.name}
              </p>
              <p className="text-[7.5pt] text-slate-500 m-0 mt-1">
                {companySettings?.legalRepresentativeRole || 'Representante Legal'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t-2 border-slate-200 py-2 px-[15mm] flex justify-between text-[7pt] text-slate-400 bg-white print:fixed"
      >
        <span>{[companySettings?.address, companySettings?.phone, companySettings?.website].filter(Boolean).join(' — ') || 'Lima, Perú'}</span>
        <span>Página 1</span>
      </div>
    </div>
  );
}
