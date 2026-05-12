import { QuotationDocumentMode, normalizeQuotationDocumentMode, type CommercialTerms, type TechnicalSection } from '../types/quotation-document';

export interface QuotationPrintCompanySettings {
  name?: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankDetails?: string;
  logoUrl?: string;
  signatureUrl?: string;
  legalRepresentative?: string;
  legalRepresentativeRole?: string;
}

function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
}

function fmtMoney(n: number, currency: string): string {
  const code = currency === 'USD' ? 'USD' : 'PEN';
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: code }).format(Number(n) || 0);
  } catch {
    return `${currency} ${Number(n || 0).toFixed(2)}`;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Borrador',
    REVIEW: 'En revisión',
    SENT: 'Enviada',
    APPROVED: 'Aprobado',
    REJECTED: 'Denegado',
    EXPIRED: 'Vencida',
    INVOICED: 'Aprobado',
    FOLLOW_UP: 'Seguimiento',
    STAND_BY: 'Stand By',
  };
  return map[status] || status;
}

function formatIssueDate(iso: string | undefined, fallback: Date | string | undefined): string {
  let d: Date;
  if (iso) {
    d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  if (fallback) {
    d = fallback instanceof Date ? fallback : new Date(fallback);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  return new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; font-size: 10pt; line-height: 1.45; margin: 0; }
  .muted { color: #64748b; font-size: 9pt; }
  .brand-bar { background: #1e3a5f; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
  .brand-bar small { opacity: 0.85; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; }
  .page { padding: 14mm 16mm; position: relative; z-index: 1; }
  h1 { font-size: 16pt; margin: 0 0 8px; color: #1e3a5f; }
  h2 { font-size: 11pt; margin: 18px 0 8px; color: #1e3a5f; border-bottom: 2px solid #ea580c; padding-bottom: 4px; }
  table.data { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.data th { background: #1e3a5f; color: #fff; text-align: left; padding: 8px 10px; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }
  table.data td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
  table.data td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 14px; width: 100%; max-width: 320px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  .totals-row.total { background: #1e3a5f; color: #fff; font-weight: 800; font-size: 10pt; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; background: #f8fafc; }
  .card h3 { margin: 0 0 8px; font-size: 9pt; color: #ea580c; text-transform: uppercase; letter-spacing: 0.08em; }
  .section-body { white-space: pre-wrap; font-size: 9.5pt; color: #334155; }
  .cover { min-height: 240mm; display: flex; flex-direction: column; }
  .cover-main { flex: 1; display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px; align-items: start; padding: 20mm 16mm 10mm; }
  .cover-title { font-size: 22pt; font-weight: 900; color: #1e3a5f; line-height: 1.15; margin: 12px 0 16px; }
  .cover-meta { font-size: 11pt; }
  .cover-images { display: flex; flex-direction: column; gap: 10px; }
  .cover-images img { width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
  .brand-logo { display: block; max-width: 210px; width: auto; height: auto; object-fit: contain; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; background: #1e3a5f; color: #fff; padding: 8px 16mm; font-size: 8pt; display: flex; justify-content: space-between; }
  .sig { text-align: center; margin-top: 24px; page-break-inside: avoid; }
  .sig img { max-width: 240px; max-height: 72px; width: auto; height: auto; object-fit: contain; }
  @media print {
    .foot { position: fixed; }
  }
`;

function commercialTermsHtml(ct: CommercialTerms): string {
  const rows: string[] = [];
  if (ct.paymentMethod) rows.push(`<tr><td style="font-weight:600;width:40%">Forma de pago</td><td>${nl2br(ct.paymentMethod)}</td></tr>`);
  if (ct.paymentTerms) rows.push(`<tr><td style="font-weight:600">Condiciones de pago</td><td>${nl2br(ct.paymentTerms)}</td></tr>`);
  if (ct.executionLocation) rows.push(`<tr><td style="font-weight:600">Lugar de ejecución</td><td>${nl2br(ct.executionLocation)}</td></tr>`);
  if (ct.executionTime) rows.push(`<tr><td style="font-weight:600">Plazo de ejecución</td><td>${nl2br(ct.executionTime)}</td></tr>`);
  if (ct.additionalNotes) rows.push(`<tr><td style="font-weight:600">Notas</td><td>${nl2br(ct.additionalNotes)}</td></tr>`);
  if (rows.length === 0) return '';
  return `<h2>Condiciones comerciales</h2><table class="data">${rows.join('')}</table>`;
}

function itemsTableHtml(quotation: any, showDetail: boolean): string {
  const sections = quotation.sections || [];
  let idx = 0;
  const rows: string[] = [];
  for (const sec of sections) {
    const items = sec.items || [];
    for (const it of items) {
      idx += 1;
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice ?? it.unitCost ?? 0);
      const sub = Number(it.subtotal ?? qty * price);
      rows.push(`
        <tr>
          <td>${idx}</td>
          <td>${escapeHtml(String(it.description || ''))}</td>
          <td class="num">${escapeHtml(String(it.unit || it.unitOfMeasure || 'UND'))}</td>
          <td class="num">${qty.toFixed(2)}</td>
          <td class="num">${fmtMoney(price, quotation.currency)}</td>
          <td class="num">${fmtMoney(sub, quotation.currency)}</td>
        </tr>
      `);
      if (showDetail && it.longDescription?.trim()) {
        rows.push(`
          <tr><td colspan="6" style="background:#f8fafc;font-size:9pt;padding:10px 12px;">
            <strong>Detalle / alcance</strong><div class="section-body" style="margin-top:6px">${nl2br(String(it.longDescription))}</div>
          </td></tr>
        `);
      }
    }
  }
  if (rows.length === 0) {
    return '<p class="muted">Sin ítems registrados.</p>';
  }
  return `
    <table class="data">
      <thead><tr><th>Ítem</th><th>Descripción</th><th class="num">Und.</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">P. total</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function totalsHtml(quotation: any): string {
  const cur = quotation.currency || 'PEN';
  const show = quotation.showTaxBreakdown !== false;
  const include = quotation.pricesIncludeIgv === true;
  const directSubtotal = Number(quotation.directSubtotal ?? quotation.subtotalBeforeDiscount ?? quotation.subtotal ?? 0);
  const generalExpensesAmount = Number(quotation.generalExpensesAmount || 0);
  const generalExpensesPercentage = Number(quotation.generalExpensesPercentage || 0);
  const commercialDiscountAmount = Number(quotation.commercialDiscountAmount || 0);
  const commercialDiscountPercentage = Number(quotation.commercialDiscountPercentage || 0);
  let taxNote = '';
  if (show) {
    taxNote = include
      ? 'Los importes mostrados incluyen IGV según el desglose siguiente.'
      : 'Los importes no incluyen IGV. Se muestran subtotal, IGV y total.';
  } else {
    taxNote = 'Total conforme a la propuesta.';
  }
  const parts: string[] = [];
  if (directSubtotal > 0 && (generalExpensesAmount > 0 || commercialDiscountAmount > 0)) {
    parts.push(`<div class="totals-row"><span>Costo directo</span><span>${fmtMoney(directSubtotal, cur)}</span></div>`);
  }
  if (generalExpensesAmount > 0) {
    parts.push(
      `<div class="totals-row"><span>Gastos + utilidad (${generalExpensesPercentage}%)</span><span>${fmtMoney(generalExpensesAmount, cur)}</span></div>`,
    );
  }
  if (commercialDiscountAmount > 0) {
    parts.push(
      `<div class="totals-row"><span>Descuento comercial (${commercialDiscountPercentage}%)</span><span>-${fmtMoney(commercialDiscountAmount, cur)}</span></div>`,
    );
  }
  parts.push(`<div class="totals-row"><span>Subtotal operativo</span><span>${fmtMoney(quotation.subtotal || 0, cur)}</span></div>`);
  if (show) {
    parts.push(
      `<div class="totals-row"><span>IGV (${Number(quotation.igvPercentage ?? 18)}%)</span><span>${fmtMoney(quotation.igv ?? quotation.igvAmount ?? 0, cur)}</span></div>`,
    );
  }
  parts.push(
    `<div class="totals-row total"><span>Total</span><span>${fmtMoney(quotation.total || 0, cur)}</span></div>`,
    `<p class="muted" style="margin:8px 0 0;font-size:8pt;">${escapeHtml(taxNote)}</p>`,
  );
  return `<div class="totals">${parts.join('')}</div>`;
}

function technicalSectionsHtml(sections: TechnicalSection[]): string {
  const sorted = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0));
  return sorted
    .map(
      (s, i) => `
    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <h2 style="margin-bottom:6px;">${s.order || i + 1}. ${escapeHtml(s.title || '')}</h2>
      <div class="section-body">${nl2br(String(s.body || ''))}</div>
    </div>
  `,
    )
    .join('');
}

function bankAndFooterHtml(company: QuotationPrintCompanySettings): string {
  const bank = company.bankDetails ? `<div class="card"><h3>Cuenta / datos bancarios</h3><div class="section-body">${nl2br(company.bankDetails)}</div></div>` : '';
  return `
    <div class="two-col">
      ${bank}
      <div class="card"><h3>Firma</h3>
        ${company.signatureUrl ? `<div class="sig"><img src="${escapeHtml(company.signatureUrl)}" alt="Firma" /></div>` : ''}
        <p style="text-align:center;margin:8px 0 0;font-weight:700">${escapeHtml(company.legalRepresentative || company.name || '')}</p>
        <p class="muted" style="text-align:center;margin:0">${escapeHtml(company.legalRepresentativeRole || 'Representante')}</p>
      </div>
    </div>
  `;
}

export function renderQuotationPrintHtml(quotation: any, company: QuotationPrintCompanySettings): string {
  const mode = normalizeQuotationDocumentMode(quotation.documentMode);
  const qNum = String(quotation.quotationNumber || '');
  const rev = quotation.revisionLabel ? ` (${escapeHtml(quotation.revisionLabel)})` : '';
  const place = quotation.issuePlace?.trim() || company.address || 'Lima';
  const when = formatIssueDate(quotation.issueDate, quotation.createdAt);
  const clientName =
    quotation.company?.tradeName || quotation.company?.businessName || quotation.client?.name || '—';
  const contactName = quotation.contact?.fullName || quotation.client?.contactName || '—';
  const refLine = quotation.referenceSubject?.trim() || quotation.title || '—';
  const ct: CommercialTerms = quotation.commercialTerms && typeof quotation.commercialTerms === 'object' ? quotation.commercialTerms : {};
  const validity = quotation.validityDays != null ? `${quotation.validityDays} días` : '—';

  if (mode === QuotationDocumentMode.PROJECT) {
    const sections = Array.isArray(quotation.technicalSections) ? (quotation.technicalSections as TechnicalSection[]) : [];
    const imgs = Array.isArray(quotation.projectCoverImageUrls) ? quotation.projectCoverImageUrls.filter((u: unknown) => typeof u === 'string') : [];
    const imgHtml = imgs.slice(0, 3).map((u: string) => `<img src="${escapeHtml(u)}" alt="" />`).join('');

    const cover = `
      <div class="cover">
        <div class="brand-bar">
          <div>
            <div style="font-weight:800;font-size:11pt;">PROPUESTA Nº ${escapeHtml(qNum)}${rev}</div>
            <small>${escapeHtml(quotation.title || '')}</small>
          </div>
          <div style="text-align:right"><small>${escapeHtml(when)}</small><div style="font-size:9pt;margin-top:4px;">${escapeHtml(statusLabel(quotation.status))}</div></div>
        </div>
        <div class="cover-main">
          <div>
            ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="Logo" class="brand-logo" style="max-height:56px;margin-bottom:12px" />` : ''}
            <div class="cover-title">PROPUESTA TÉCNICO-ECONÓMICA</div>
            <div class="cover-meta"><strong>Cliente:</strong> ${escapeHtml(clientName)}<br/>
            <strong>Atención:</strong> ${escapeHtml(contactName)}<br/>
            <strong>Referencia:</strong> ${escapeHtml(refLine)}<br/>
            <strong>Validez:</strong> ${escapeHtml(validity)} · <strong>Moneda:</strong> ${escapeHtml(quotation.currency || 'PEN')}
            </div>
          </div>
          <div class="cover-images">${imgHtml || '<div class="muted" style="padding:20px;border:1px dashed #cbd5e1;border-radius:6px">Sin imágenes de portada</div>'}</div>
        </div>
      </div>
    `;

    const body = `
      <div class="page">
        <div class="brand-bar" style="margin-bottom:12px;">
          <div><strong>PROPUESTA Nº ${escapeHtml(qNum)}${rev}</strong><br/><small>${escapeHtml(quotation.title || '')}</small></div>
          <small>${escapeHtml(when)}</small>
        </div>
        <h1 style="text-align:center;font-size:13pt;">PROPUESTA TÉCNICA COMERCIAL</h1>
        <p class="muted" style="text-align:center;margin-top:0">${escapeHtml(quotation.description || '')}</p>
        ${technicalSectionsHtml(sections)}
        <h2>Presupuesto / Inversión</h2>
        ${itemsTableHtml(quotation, true)}
        ${totalsHtml(quotation)}
        ${commercialTermsHtml(ct)}
        ${bankAndFooterHtml(company)}
      </div>
    `;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cotización ${escapeHtml(qNum)}</title><style>${BASE_STYLES}</style></head><body>${cover}${body}
      <div class="foot"><span>${escapeHtml([company.name, company.phone, company.website].filter(Boolean).join(' · '))}</span><span>${escapeHtml(company.name || '')} — Propuesta técnico-económica</span></div>
    </body></html>`;
  }

  // SIMPLE
  const simple = `
    <div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <p style="margin:0;font-size:10pt">${escapeHtml(place)}, ${escapeHtml(when)}</p>
          <h1 style="margin-top:8px;">PROPUESTA Nº ${escapeHtml(qNum)}${rev}</h1>
          <p class="muted" style="margin:4px 0 0">${escapeHtml(statusLabel(quotation.status))}</p>
        </div>
        ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="Logo" class="brand-logo" style="max-height:64px" />` : ''}
      </div>
      <div class="two-col">
        <div class="card">
          <h3>Cliente</h3>
          <p style="margin:0"><strong>Señores:</strong> ${escapeHtml(clientName)}</p>
          <p style="margin:8px 0 0"><strong>Atención:</strong> ${escapeHtml(contactName)}</p>
          <p style="margin:8px 0 0"><strong>Referencia:</strong> ${escapeHtml(refLine)}</p>
        </div>
        <div class="card">
          <h3>Condiciones</h3>
          <p style="margin:0"><strong>Validez:</strong> ${escapeHtml(validity)}</p>
          <p style="margin:8px 0 0"><strong>Moneda:</strong> ${escapeHtml(quotation.currency || 'PEN')}</p>
        </div>
      </div>
      ${quotation.introductionText ? `<h2>Alcance</h2><div class="section-body">${nl2br(String(quotation.introductionText))}</div>` : ''}
      <h2>Detalle de inversión</h2>
      ${itemsTableHtml(quotation, true)}
      ${totalsHtml(quotation)}
      ${commercialTermsHtml(ct)}
      ${quotation.termsAndConditions ? `<h2>Condiciones generales</h2><div class="section-body">${nl2br(String(quotation.termsAndConditions))}</div>` : ''}
      ${quotation.warrantyText ? `<h2>Garantía</h2><div class="section-body">${nl2br(String(quotation.warrantyText))}</div>` : ''}
      ${bankAndFooterHtml(company)}
    </div>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cotización ${escapeHtml(qNum)}</title><style>${BASE_STYLES}</style></head><body>${simple}
    <div class="foot"><span>${escapeHtml([company.address, company.phone].filter(Boolean).join(' — '))}</span><span>Página 1</span></div>
  </body></html>`;
}
