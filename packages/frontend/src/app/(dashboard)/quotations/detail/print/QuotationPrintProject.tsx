'use client';

/* eslint-disable @next/next/no-img-element */

import { Fragment } from 'react';
import type { TechnicalSection } from '@fym/shared';
import { fmtPrintMoney, formatIssueDatePrint, statusLabelPrint } from './print-helpers';

export function QuotationPrintProject({
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
  const when = formatIssueDatePrint(quotation.issueDate, quotation.createdAt);
  const clientName =
    quotation.company?.tradeName || quotation.company?.businessName || quotation.client?.name || '—';
  const contactName = quotation.contact?.fullName || quotation.client?.contactName || '—';
  const refLine = quotation.referenceSubject?.trim() || quotation.title || '—';
  const qNum = quotation.quotationNumber || `COT-${quotationId.slice(0, 5).toUpperCase()}`;
  const rev = quotation.revisionLabel ? ` (${quotation.revisionLabel})` : '';
  const sections: TechnicalSection[] = Array.isArray(quotation.technicalSections)
    ? [...quotation.technicalSections].sort((a: TechnicalSection, b: TechnicalSection) => (a.order || 0) - (b.order || 0))
    : [];
  const imgs: string[] = Array.isArray(quotation.projectCoverImageUrls) ? quotation.projectCoverImageUrls.filter((u: unknown) => typeof u === 'string') : [];
  const ct = quotation.commercialTerms && typeof quotation.commercialTerms === 'object' ? quotation.commercialTerms : {};
  const showTax = quotation.showTaxBreakdown !== false;
  const includeIgv = quotation.pricesIncludeIgv === true;
  const draft = quotation.status === 'DRAFT' || quotation.status === 'REVIEW';

  const taxNote = showTax
    ? includeIgv
      ? 'Los importes mostrados incluyen IGV según el desglose siguiente.'
      : 'Los importes no incluyen IGV. Se muestran subtotal, IGV y total.'
    : 'Total conforme a la propuesta.';

  let itemIdx = 0;

  return (
    <div className="hidden print:block font-sans bg-white text-black">
      {draft && (
        <div
          className="pointer-events-none select-none print:block"
          style={{
            position: 'fixed',
            top: '36%',
            left: '16%',
            transform: 'rotate(-24deg)',
            fontSize: '48pt',
            color: 'rgba(148,163,184,0.12)',
            fontWeight: 900,
            zIndex: 50,
          }}
        >
          BORRADOR
        </div>
      )}

      {/* Portada */}
      <div className="min-h-[280mm] flex flex-col break-after-page">
        <div className="bg-[#1e3a5f] text-white px-6 py-4 flex justify-between items-center">
          <div>
            <div className="font-extrabold text-[11pt]">PROPUESTA Nº {qNum}{rev}</div>
            <small className="opacity-90 text-[8pt] uppercase tracking-widest">{quotation.title}</small>
          </div>
          <div className="text-right text-[8pt]">
            <div>{when}</div>
            <div className="mt-1">{statusLabelPrint(quotation.status)}</div>
          </div>
        </div>
        <div className="grid grid-cols-[1.05fr_1fr] gap-8 px-10 py-14 flex-1">
          <div>
            {companySettings?.logoUrl && (
              <img src={companySettings.logoUrl} alt="Logo" className="max-h-14 object-contain mb-4" />
            )}
            <div className="text-[21pt] font-black text-[#1e3a5f] leading-tight mb-4">PROPUESTA TÉCNICO-ECONÓMICA</div>
            <div className="text-[11pt] leading-relaxed">
              <strong>Cliente:</strong> {clientName}
              <br />
              <strong>Atención:</strong> {contactName}
              <br />
              <strong>Referencia:</strong> {refLine}
              <br />
              <strong>Validez:</strong> {quotation.validityDays ?? 30} días · <strong>Moneda:</strong> {cur}
            </div>
            {quotation.description && (
              <p className="text-[9pt] text-slate-600 mt-4 whitespace-pre-wrap">{quotation.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {imgs.slice(0, 3).map((u, i) => (
              <img key={i} src={u} alt="" className="w-full h-[120px] object-cover rounded-md border border-slate-200" />
            ))}
            {imgs.length === 0 && (
              <div className="border border-dashed border-slate-300 rounded-md p-8 text-center text-slate-400 text-sm">
                Sin imágenes de portada
              </div>
            )}
          </div>
        </div>
        <div className="bg-[#1e3a5f] text-white px-6 py-3 text-[8pt] flex justify-between mt-auto">
          <span>{[companySettings?.address, companySettings?.phone].filter(Boolean).join(' — ')}</span>
          <span className="uppercase tracking-widest">Propuesta técnico-económica</span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="relative z-[1]" style={{ padding: '14mm 15mm 22mm 15mm' }}>
        <div className="bg-[#1e3a5f] text-white px-4 py-3 flex justify-between items-center mb-4 print:mb-3">
          <div>
            <strong>PROPUESTA Nº {qNum}{rev}</strong>
            <div className="text-[8pt] opacity-90">{quotation.title}</div>
          </div>
          <small>{when}</small>
        </div>

        <h1 className="text-center text-[13pt] font-black text-[#1e3a5f] m-0">PROPUESTA TÉCNICA COMERCIAL</h1>
        {quotation.description && (
          <p className="text-center text-[9pt] text-slate-500 mt-2 mb-6 whitespace-pre-wrap">{quotation.description}</p>
        )}

        {sections.map((s, i) => (
          <div key={`${s.order}-${i}`} className="mb-4 break-inside-avoid">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-1 border-b-2 border-orange-400 pb-1">
              {s.order || i + 1}. {s.title}
            </h2>
            <div className="text-[9.5pt] text-slate-700 whitespace-pre-wrap leading-relaxed">{s.body || ''}</div>
          </div>
        ))}

        <h2 className="text-[11pt] font-bold text-[#1e3a5f] m-0 mb-3 border-b-2 border-orange-400 pb-1">Presupuesto / Inversión</h2>
        <table className="w-full border-collapse text-[8.5pt] mb-8">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="text-left p-2 pl-3.5 text-[7.5pt] uppercase">Ítem</th>
              <th className="text-left p-2 text-[7.5pt] uppercase">Descripción</th>
              <th className="text-center p-2 w-14 text-[7.5pt] uppercase">Und.</th>
              <th className="text-right p-2 w-[72px] text-[7.5pt] uppercase">Cant.</th>
              <th className="text-right p-2 w-[88px] text-[7.5pt] uppercase">P. unit.</th>
              <th className="text-right p-2 pr-3.5 text-[7.5pt] uppercase">Total</th>
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
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-center font-mono text-[8pt]">{item.unit || item.unitOfMeasure || 'UND'}</td>
                      <td className="p-2 text-right font-mono">{qty.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{fmt(price)}</td>
                      <td className="p-2 pr-3.5 text-right font-mono font-bold">{fmt(sub)}</td>
                    </tr>
                    {item.longDescription?.trim() ? (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 p-3 text-[9pt]">
                          <strong>Detalle</strong>
                          <div className="whitespace-pre-wrap mt-1 text-slate-700">{item.longDescription}</div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              }),
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-72 border border-slate-200 rounded overflow-hidden">
            <div className="flex justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-[9pt]">
              <span className="text-slate-600 font-bold text-[8.5pt] uppercase">Subtotal</span>
              <span className="font-mono font-bold">{fmt(quotation.subtotal || 0)}</span>
            </div>
            {showTax && (
              <div className="flex justify-between px-4 py-2 bg-slate-50 border-b text-[9pt]">
                <span className="text-slate-600 font-bold text-[8.5pt] uppercase">IGV ({quotation.igvPercentage ?? 18}%)</span>
                <span className="font-mono font-bold">{fmt(quotation.igv ?? quotation.igvAmount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-3 bg-[#1e3a5f] text-white font-black text-[10.5pt]">
              <span>TOTAL</span>
              <span className="font-mono">{fmt(quotation.total || 0)}</span>
            </div>
            <p className="text-[8pt] text-slate-500 px-3 py-2 m-0">{taxNote}</p>
          </div>
        </div>

        {(ct.paymentMethod || ct.executionLocation) && (
          <div className="mb-6">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] mb-2 border-b-2 border-orange-400 pb-1">Condiciones comerciales (resumen)</h2>
            <table className="w-full text-[9pt]">
              <tbody>
                {ct.paymentMethod && (
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold w-2/5 align-top">Forma de pago</td>
                    <td className="py-1.5 whitespace-pre-wrap">{ct.paymentMethod}</td>
                  </tr>
                )}
                {ct.executionLocation && (
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold align-top">Lugar</td>
                    <td className="py-1.5 whitespace-pre-wrap">{ct.executionLocation}</td>
                  </tr>
                )}
                {ct.executionTime && (
                  <tr>
                    <td className="py-1.5 font-semibold align-top">Plazo</td>
                    <td className="py-1.5 whitespace-pre-wrap">{ct.executionTime}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {quotation.termsAndConditions && (
          <div className="mb-6">
            <h2 className="text-[11pt] font-bold text-[#1e3a5f] mb-2 border-b-2 border-orange-400 pb-1">Términos adicionales</h2>
            <p className="text-[8pt] text-slate-600 whitespace-pre-wrap m-0">{quotation.termsAndConditions}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 border-t-2 border-slate-200 pt-5 break-inside-avoid">
          {companySettings?.bankDetails && (
            <div className="p-3 bg-slate-50 border-l-4 border-orange-500 rounded">
              <h5 className="text-[7.5pt] font-extrabold text-orange-600 uppercase m-0 mb-1">Datos bancarios</h5>
              <p className="text-[8pt] text-slate-600 whitespace-pre-wrap m-0">{companySettings.bankDetails}</p>
            </div>
          )}
          <div className="flex flex-col items-center justify-end">
            {companySettings?.signatureUrl && (
              <img src={companySettings.signatureUrl} alt="Firma" className="max-h-[72px] object-contain mb-2" />
            )}
            <div className="w-4/5 border-t border-slate-400 pt-2 text-center">
              <p className="text-[9pt] font-extrabold m-0">{companySettings?.legalRepresentative || companySettings?.name}</p>
              <p className="text-[7.5pt] text-slate-500 m-0 mt-1">{companySettings?.legalRepresentativeRole || 'Representante'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1e3a5f] text-white px-[15mm] py-2 flex justify-between text-[8pt] print:fixed">
        <span>{companySettings?.name} — {companySettings?.phone}</span>
        <span>Documento generado desde sistema</span>
      </div>
    </div>
  );
}
