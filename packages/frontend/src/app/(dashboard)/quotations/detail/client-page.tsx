'use client';

import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Plus, Trash2, Pencil, Calculator, FileText, 
  Printer, DollarSign, Info, Package, FolderKanban, 
  Upload, FileSpreadsheet, Download, FileDown, X as XIcon,
  ChevronRight, Calendar, User, Building2, Layers,
  ExternalLink, Copy, CheckCircle2, AlertCircle, Clock,
  FileCheck, RefreshCw, LayoutGrid, Sheet
} from 'lucide-react';
import { SpreadsheetEditor } from './spreadsheet';
import { QuotationPrintDocument } from './print/QuotationPrintDocument';
import {
  getQuotationExportWarnings,
  DEFAULT_PROJECT_TECHNICAL_SECTIONS,
  QuotationDocumentMode,
  normalizeQuotationDocumentMode,
  type TechnicalSection,
} from '@fym/shared';

const LEGACY_NEXT_STATUSES: Record<string, { label: string; next: string; variant?: 'default' | 'outline' }[]> = {
  DRAFT: [{ label: 'Enviar a Revisión', next: 'REVIEW', variant: 'default' }],
  REVIEW: [
    { label: 'Devolver a Borrador', next: 'DRAFT', variant: 'outline' },
    { label: 'Marcar como Enviada', next: 'SENT', variant: 'default' },
  ],
  SENT: [
    { label: 'Aceptar', next: 'APPROVED', variant: 'default' },
    { label: 'Rechazar', next: 'REJECTED', variant: 'outline' },
    { label: 'Seguimiento', next: 'FOLLOW_UP', variant: 'outline' },
    { label: 'Stand By', next: 'STAND_BY', variant: 'outline' },
    { label: 'Marcar Vencida', next: 'EXPIRED', variant: 'outline' },
  ],
  FOLLOW_UP: [
    { label: 'Aceptar', next: 'APPROVED', variant: 'default' },
    { label: 'Rechazar', next: 'REJECTED', variant: 'outline' },
    { label: 'Stand By', next: 'STAND_BY', variant: 'outline' },
    { label: 'Reenviar', next: 'SENT', variant: 'outline' },
  ],
  STAND_BY: [
    { label: 'Pasar a Seguimiento', next: 'FOLLOW_UP', variant: 'default' },
    { label: 'Reenviar', next: 'SENT', variant: 'outline' },
    { label: 'Rechazar', next: 'REJECTED', variant: 'outline' },
  ],
  APPROVED: [{ label: 'Marcar Facturada', next: 'INVOICED', variant: 'default' }],
  REJECTED: [
    { label: 'Volver a Borrador', next: 'DRAFT', variant: 'outline' },
    { label: 'Reactivar Seguimiento', next: 'FOLLOW_UP', variant: 'default' },
  ],
  EXPIRED: [
    { label: 'Volver a Borrador', next: 'DRAFT', variant: 'outline' },
    { label: 'Reactivar Seguimiento', next: 'FOLLOW_UP', variant: 'default' },
  ],
};
void LEGACY_NEXT_STATUSES;

const NEXT_STATUSES: Record<string, { label: string; next: string; variant?: 'default' | 'outline' }[]> = {
  DRAFT: [
    { label: 'Enviar a Revision', next: 'REVIEW', variant: 'default' },
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
    { label: 'Denegar', next: 'REJECTED', variant: 'outline' },
  ],
  REVIEW: [
    { label: 'Devolver a Borrador', next: 'DRAFT', variant: 'outline' },
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
    { label: 'Denegar', next: 'REJECTED', variant: 'outline' },
  ],
  SENT: [
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
    { label: 'Denegar', next: 'REJECTED', variant: 'outline' },
  ],
  FOLLOW_UP: [
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
    { label: 'Denegar', next: 'REJECTED', variant: 'outline' },
  ],
  STAND_BY: [
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
    { label: 'Denegar', next: 'REJECTED', variant: 'outline' },
  ],
  APPROVED: [],
  REJECTED: [{ label: 'Volver a Borrador', next: 'DRAFT', variant: 'outline' }],
  EXPIRED: [{ label: 'Volver a Borrador', next: 'DRAFT', variant: 'outline' }],
};

const extractStoragePath = (url: string): string | null => {
  const m = url.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const UNIT_LABELS: Record<string, string> = {
  UND: 'Unidad', KG: 'Kilogramo', M: 'Metro', M2: 'Metro²', M3: 'Metro³',
  GLB: 'Global', HH: 'Hora Hombre', HM: 'Hora Máquina', L: 'Litro',
  DIA: 'Día', MES: 'Mes', ML: 'Metro Lineal', JGO: 'Juego',
};

interface ItemForm {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  longDescription: string;
  costBreakdown: CostBreakdownRow[];
}

interface CostBreakdownRow {
  category: string;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
}

const COST_CATEGORIES = [
  'Materiales / Insumos',
  'Maquinarias - Izaje',
  'Maquinarias - Altura',
  'Maquinarias - Corte',
  'EPPs - Básicos',
  'EPPs - Especiales',
  'Mano de Obra',
  'Transporte y Logística',
  'Herramientas',
];

const emptyCostRows = (): CostBreakdownRow[] =>
  COST_CATEGORIES.map(category => ({ category, description: '', unit: 'UND', quantity: '', unitCost: '' }));

const EMPTY_COST_ROW: CostBreakdownRow = { category: 'Materiales / Insumos', description: '', unit: 'UND', quantity: '', unitCost: '' };
const createEmptyItem = (): ItemForm => ({
  description: '',
  unit: 'UND',
  quantity: '',
  unitPrice: '',
  longDescription: '',
  costBreakdown: emptyCostRows(),
});

const EMPTY_ITEM: ItemForm = createEmptyItem();

const toNumber = (value: string | number | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const costRowSubtotal = (row: CostBreakdownRow) => toNumber(row.quantity) * toNumber(row.unitCost);

const hasValidCostBreakdown = (form: ItemForm) =>
  form.costBreakdown.some(row => row.description.trim() && toNumber(row.quantity) > 0 && toNumber(row.unitCost) >= 0);

const priceSummary = (form: ItemForm) => {
  const hasBreakdown = hasValidCostBreakdown(form);
  const costTotal = form.costBreakdown
    .filter(row => row.description.trim() && toNumber(row.quantity) > 0 && toNumber(row.unitCost) >= 0)
    .reduce((sum, row) => sum + costRowSubtotal(row), 0);
  const saleTotal = hasBreakdown ? costTotal : toNumber(form.quantity) * toNumber(form.unitPrice);
  const unitPrice = toNumber(form.quantity) > 0 ? saleTotal / toNumber(form.quantity) : 0;
  return { costTotal, saleTotal, unitPrice };
};

const hydrateItemForm = (item: any): ItemForm => ({
  description: item.description || '',
  unit: item.unit || 'UND',
  quantity: String(item.quantity ?? ''),
  unitPrice: String(item.unitPrice ?? ''),
  longDescription: String(item.longDescription ?? ''),
  costBreakdown: Array.isArray(item.costBreakdown)
    ? item.costBreakdown.map((row: any) => ({
        category: String(row.category || 'Insumos'),
        description: String(row.description || ''),
        unit: String(row.unit || 'UND'),
        quantity: String(row.quantity ?? ''),
        unitCost: String(row.unitCost ?? ''),
      }))
    : [],
});

const serializeItemForm = (form: ItemForm) => {
  const summary = priceSummary(form);
  const hasBreakdown = hasValidCostBreakdown(form);
  return {
    description: form.description.trim(),
    unit: form.unit,
    quantity: toNumber(form.quantity),
    unitPrice: hasBreakdown ? summary.unitPrice : toNumber(form.unitPrice),
    longDescription: form.longDescription.trim() || undefined,
    costBreakdown: hasBreakdown
      ? form.costBreakdown
          .filter(row => row.description.trim() && toNumber(row.quantity) > 0 && toNumber(row.unitCost) >= 0)
          .map(row => ({
            category: row.category,
            description: row.description.trim(),
            unit: row.unit,
            quantity: toNumber(row.quantity),
            unitCost: toNumber(row.unitCost),
          }))
      : [],
  };
};

function CostBreakdownEditor({
  form,
  onChange,
  currency,
}: {
  form: ItemForm;
  onChange: (next: ItemForm) => void;
  currency: string;
}) {
  const summary = priceSummary(form);
  const hasRows = form.costBreakdown.length > 0;
  const formatMoney = (value: number) =>
    value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const updateRow = (index: number, patch: Partial<CostBreakdownRow>) => {
    onChange({
      ...form,
      costBreakdown: form.costBreakdown.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Precio unitario por costos</p>
          <p className="text-xs text-muted-foreground">Costos, venta y precio unitario sin IGV.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl text-xs font-bold"
          onClick={() => onChange({ ...form, costBreakdown: [...form.costBreakdown, { ...EMPTY_COST_ROW }] })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar costo
        </Button>
      </div>

      {hasRows && (
        <div className="space-y-3">
          <div className="space-y-2">
            {form.costBreakdown.map((row, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 rounded-xl bg-white p-2 border border-slate-200">
                <div className="col-span-12 sm:col-span-2">
                  <Select value={row.category} onValueChange={value => updateRow(index, { category: value })}>
                    <SelectTrigger className="h-10 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="col-span-12 sm:col-span-4 h-10 rounded-lg text-sm"
                  value={row.description}
                  onChange={event => updateRow(index, { description: event.target.value })}
                  placeholder="Recurso o actividad"
                />
                <Input
                  className="col-span-4 sm:col-span-1 h-10 rounded-lg text-xs font-mono"
                  value={row.unit}
                  onChange={event => updateRow(index, { unit: event.target.value.toUpperCase() })}
                  placeholder="Und."
                />
                <Input
                  className="col-span-4 sm:col-span-1 h-10 rounded-lg text-xs font-mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.quantity}
                  onChange={event => updateRow(index, { quantity: event.target.value })}
                  placeholder="Cant."
                />
                <Input
                  className="col-span-4 sm:col-span-2 h-10 rounded-lg text-xs font-mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.unitCost}
                  onChange={event => updateRow(index, { unitCost: event.target.value })}
                  placeholder="Costo"
                />
                <div className="col-span-9 sm:col-span-1 h-10 rounded-lg bg-slate-50 px-2 flex items-center justify-end text-xs font-mono font-bold">
                  {formatMoney(costRowSubtotal(row))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-3 sm:col-span-1 h-10 rounded-lg text-red-500"
                  onClick={() => onChange({ ...form, costBreakdown: form.costBreakdown.filter((_, i) => i !== index) })}
                  title="Eliminar costo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl bg-white p-3 border border-slate-200">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Costo</p>
              <p className="font-mono font-black">{currency} {formatMoney(summary.costTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Venta</p>
              <p className="font-mono font-black text-blue-700">{currency} {formatMoney(summary.saleTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">P. Unitario</p>
              <p className="font-mono font-black text-orange-600">{currency} {formatMoney(summary.unitPrice)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuotationDetailPage({ id: idProp }: { id?: string } = {}) {
  const searchParams = useSearchParams();
  const id = idProp ?? searchParams.get('id');
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);

  // Edit item state
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  // Edit metadata state
  const [editMetaDialog, setEditMetaDialog] = useState(false);
  const [metaForm, setMetaForm] = useState({
    title: '',
    description: '',
    validityDays: '30',
    currency: 'PEN',
    igvPercentage: '18',
    introductionText: '',
    termsAndConditions: '',
    companyId: '',
    contactId: '',
    tipo: '',
    generalExpensesPercentage: '',
    commercialDiscountPercentage: '',
    deliveryTimeDays: '',
    warrantyText: '',
    manualTotalOverride: '',
    useManualTotal: false,
    documentMode: 'SIMPLE' as 'SIMPLE' | 'PROJECT',
    referenceSubject: '',
    issuePlace: '',
    issueDate: '',
    revisionLabel: '',
    showTaxBreakdown: true,
    pricesIncludeIgv: false,
    commercialTerms: {
      paymentMethod: '',
      paymentTerms: '',
      executionLocation: '',
      executionTime: '',
      additionalNotes: '',
    },
    technicalSections: [] as TechnicalSection[],
    coverUrl1: '',
    coverUrl2: '',
    coverUrl3: '',
  });

  const [pdfIncomplete, setPdfIncomplete] = useState<string[] | null>(null);
  const [printWarnings, setPrintWarnings] = useState<string[] | null>(null);

  // Edit section state
  const [editSectionDialog, setEditSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [editSectionForm, setEditSectionForm] = useState({ name: '', description: '' });

  // Companies, contacts & quotation types for meta edit
  const [companies, setCompanies] = useState<any[]>([]);
  const [metaContacts, setMetaContacts] = useState<any[]>([]);
  const [quotationTypes, setQuotationTypes] = useState<string[]>([]);
  const [providerProducts, setProviderProducts] = useState<any[]>([]);

  // Document upload state
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [xlsxProgress, setXlsxProgress] = useState<number | null>(null);

  const [companySettings, setCompanySettings] = useState<any>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const [quotationData, settingsData] = await Promise.all([
        api.get<any>(`/quotations/${id}`, token),
        api.get<any>('/config/company', token).catch(() => null)
      ]);
      setQuotation(quotationData.data);
      if (settingsData) setCompanySettings(settingsData);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, token, addToast]);

  useEffect(() => { load(); }, [load]);

  // Load companies and quotation types once token is available
  useEffect(() => {
    if (!token) return;
    api.get<any>('/companies?pageSize=200', token).then(r => setCompanies(r.data || [])).catch(() => {});
    api.get<any>('/config/quotation-types', token).then(r => setQuotationTypes(Array.isArray(r) ? r : [])).catch(() => {});
    api.get<any[]>('/providers/products', token).then(r => setProviderProducts(Array.isArray(r) ? r : [])).catch(() => {});
  }, [token]);

  const applyProviderProduct = (productId: string) => {
    if (productId === '__manual__') return;
    const product = providerProducts.find(p => p.id === productId);
    if (!product) return;
    setItemForm(f => ({
      ...f,
      description: product.name || f.description,
      longDescription: product.description || `${product.providerName || 'Proveedor'}${product.description ? ` - ${product.description}` : ''}`,
      unit: product.unit || f.unit,
      unitPrice: String(product.unitPrice ?? f.unitPrice),
    }));
  };

  // Load contacts when companyId changes inside the edit meta dialog
  useEffect(() => {
    if (!editMetaDialog || !metaForm.companyId || !token) { setMetaContacts([]); return; }
    api.get<any>(`/companies/${metaForm.companyId}`, token)
      .then(r => setMetaContacts(r.data?.contacts || r.contacts || []))
      .catch(() => setMetaContacts([]));
  }, [metaForm.companyId, editMetaDialog, token]);

  const isDraft = quotation?.status === 'DRAFT';
  const canEdit = ['DRAFT', 'REVIEW', 'FOLLOW_UP', 'STAND_BY'].includes(quotation?.status);

  /* ── Status ──────────────────────────────────────────────── */
  const updateStatus = async (status: string) => {
    try {
      const res = await api.patch<any>(`/quotations/${id}/status`, { status }, token!);
      addToast(res.project ? 'Estado actualizado y proyecto creado' : 'Estado actualizado', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addSection = async () => {
    try {
      await api.post(`/quotations/${id}/sections`, sectionForm, token!);
      addToast('Sección creada', 'success');
      setSectionDialog(false);
      setSectionForm({ name: '', description: '' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('¿Eliminar esta sección y sus ítems?')) return;
    try {
      await api.delete(`/quotations/${id}/sections/${sectionId}`, token!);
      addToast('Sección eliminada', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openItemDialog = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setItemForm(createEmptyItem());
    setItemDialog(true);
  };

  const addItem = async () => {
    if (!itemForm.description.trim()) { addToast('La descripcion es obligatoria', 'error'); return; }
    const qty = parseFloat(itemForm.quantity);
    const summary = priceSummary(itemForm);
    const price = itemForm.costBreakdown.length > 0 ? summary.unitPrice : parseFloat(itemForm.unitPrice);
    if (isNaN(qty) || qty <= 0) { addToast('La cantidad debe ser mayor a 0', 'error'); return; }
    if (itemForm.costBreakdown.length > 0 && !hasValidCostBreakdown(itemForm)) {
      addToast('Completa al menos un costo con descripcion y cantidad', 'error');
      return;
    }
    if (isNaN(price) || price < 0) { addToast('El precio unitario no puede ser negativo', 'error'); return; }
    try {
      await api.post(`/quotations/${id}/sections/${activeSectionId}/items`, serializeItemForm(itemForm), token!);
      addToast('Item agregado', 'success');
      setItemDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const deleteItem = async (sectionId: string, itemId: string) => {
    try {
      await api.delete(`/quotations/${id}/sections/${sectionId}/items/${itemId}`, token!);
      addToast('Ítem eliminado', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  /* ── Edit metadata ───────────────────────────────────────── */
  const openEditMeta = () => {
    const ct =
      quotation.commercialTerms && typeof quotation.commercialTerms === 'object'
        ? (quotation.commercialTerms as Record<string, unknown>)
        : {};
    const ts: TechnicalSection[] = Array.isArray(quotation.technicalSections)
      ? quotation.technicalSections.map((t: TechnicalSection, i: number) => ({
          order: typeof t.order === 'number' ? t.order : i + 1,
          title: String(t.title ?? ''),
          body: String(t.body ?? ''),
        }))
      : [];
    const imgs: string[] = Array.isArray(quotation.projectCoverImageUrls)
      ? quotation.projectCoverImageUrls.filter((u: unknown) => typeof u === 'string')
      : [];
    const mode =
      normalizeQuotationDocumentMode(quotation.documentMode) === QuotationDocumentMode.PROJECT
        ? ('PROJECT' as const)
        : ('SIMPLE' as const);
    setMetaForm({
      title: quotation.title || '',
      description: quotation.description || '',
      validityDays: String(quotation.validityDays || '30'),
      currency: quotation.currency || 'PEN',
      igvPercentage: String(quotation.igvPercentage ?? '18'),
      introductionText: quotation.introductionText || '',
      termsAndConditions: quotation.termsAndConditions || '',
      companyId: quotation.companyId || '',
      contactId: quotation.contactId || '',
      tipo: quotation.tipo || '',
      generalExpensesPercentage: String(quotation.generalExpensesPercentage ?? ''),
      commercialDiscountPercentage: String(quotation.commercialDiscountPercentage ?? ''),
      deliveryTimeDays: String(quotation.deliveryTimeDays || ''),
      warrantyText: quotation.warrantyText || '',
      manualTotalOverride: quotation.manualTotalOverride != null ? String(quotation.manualTotalOverride) : '',
      useManualTotal: quotation.manualTotalOverride != null && Number(quotation.manualTotalOverride) > 0,
      documentMode: mode,
      referenceSubject: quotation.referenceSubject || '',
      issuePlace: quotation.issuePlace || '',
      issueDate: quotation.issueDate ? String(quotation.issueDate).slice(0, 10) : '',
      revisionLabel: quotation.revisionLabel || '',
      showTaxBreakdown: quotation.showTaxBreakdown !== false,
      pricesIncludeIgv: !!quotation.pricesIncludeIgv,
      commercialTerms: {
        paymentMethod: String(ct.paymentMethod ?? ''),
        paymentTerms: String(ct.paymentTerms ?? ''),
        executionLocation: String(ct.executionLocation ?? ''),
        executionTime: String(ct.executionTime ?? ''),
        additionalNotes: String(ct.additionalNotes ?? ''),
      },
      technicalSections: ts,
      coverUrl1: imgs[0] || '',
      coverUrl2: imgs[1] || '',
      coverUrl3: imgs[2] || '',
    });
    setEditMetaDialog(true);
  };

  const saveMeta = async () => {
    if (!metaForm.title.trim()) { addToast('El título es obligatorio', 'error'); return; }
    const igv = parseFloat(metaForm.igvPercentage);
    if (isNaN(igv) || igv < 0 || igv > 100) { addToast('El IGV debe ser un valor entre 0 y 100', 'error'); return; }
    const validity = parseInt(metaForm.validityDays, 10);
    if (isNaN(validity) || validity < 1) { addToast('La validez debe ser al menos 1 día', 'error'); return; }

    // Validate manual override if enabled
    if (metaForm.useManualTotal && metaForm.manualTotalOverride !== '') {
      const overrideVal = parseFloat(metaForm.manualTotalOverride);
      if (isNaN(overrideVal) || overrideVal < 0) {
        addToast('El monto manual debe ser un valor positivo', 'error');
        return;
      }
    }

    try {
      const body: any = {
        title: metaForm.title.trim(),
        description: metaForm.description || undefined,
        validityDays: validity,
        currency: metaForm.currency,
        igvPercentage: igv,
        introductionText: metaForm.introductionText || undefined,
        termsAndConditions: metaForm.termsAndConditions || undefined,
      };
      if (metaForm.companyId) body.companyId = metaForm.companyId;
      // Allow clearing contactId if company changes
      body.contactId = metaForm.contactId || null;
      if (metaForm.tipo) body.tipo = metaForm.tipo;
      if (metaForm.generalExpensesPercentage !== '') {
        const gep = parseFloat(metaForm.generalExpensesPercentage);
        if (!isNaN(gep) && gep >= 0) body.generalExpensesPercentage = gep;
      }
      if (metaForm.commercialDiscountPercentage !== '') {
        const discount = parseFloat(metaForm.commercialDiscountPercentage);
        if (!isNaN(discount) && discount >= 0) body.commercialDiscountPercentage = discount;
      } else {
        body.commercialDiscountPercentage = 0;
      }
      if (metaForm.deliveryTimeDays !== '') {
        const dtd = parseInt(metaForm.deliveryTimeDays, 10);
        if (!isNaN(dtd) && dtd >= 0) body.deliveryTimeDays = dtd;
      }
      if (metaForm.warrantyText) body.warrantyText = metaForm.warrantyText;
      body.documentMode = metaForm.documentMode;
      body.referenceSubject = metaForm.referenceSubject.trim();
      body.issuePlace = metaForm.issuePlace.trim();
      body.issueDate = metaForm.issueDate.trim() || null;
      body.revisionLabel = metaForm.revisionLabel.trim();
      body.showTaxBreakdown = metaForm.showTaxBreakdown;
      body.pricesIncludeIgv = metaForm.pricesIncludeIgv;
      body.commercialTerms = {
        paymentMethod: metaForm.commercialTerms.paymentMethod.trim() || undefined,
        paymentTerms: metaForm.commercialTerms.paymentTerms.trim() || undefined,
        executionLocation: metaForm.commercialTerms.executionLocation.trim() || undefined,
        executionTime: metaForm.commercialTerms.executionTime.trim() || undefined,
        additionalNotes: metaForm.commercialTerms.additionalNotes.trim() || undefined,
      };
      body.technicalSections =
        metaForm.documentMode === 'PROJECT' ? metaForm.technicalSections : [];
      const coverUrls = [metaForm.coverUrl1, metaForm.coverUrl2, metaForm.coverUrl3]
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      body.projectCoverImageUrls = coverUrls;
      await api.patch(`/quotations/${id}`, body, token!);

      // Handle manual total override separately via dedicated endpoint
      if (metaForm.useManualTotal && metaForm.manualTotalOverride !== '') {
        const overrideVal = parseFloat(metaForm.manualTotalOverride);
        await api.patch(`/quotations/${id}/total`, { manualTotal: overrideVal }, token!);
      } else if (!metaForm.useManualTotal) {
        // Clear override: recalculate from items
        await api.patch(`/quotations/${id}/total`, { manualTotal: null }, token!);
        await api.post(`/quotations/${id}/recalculate`, {}, token!);
      } else {
        // Just recalculate margins
        await api.post(`/quotations/${id}/recalculate`, {}, token!).catch(() => {});
      }

      addToast('Cotización actualizada', 'success');
      setEditMetaDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  /* ── Edit section ────────────────────────────────────────── */
  const openEditSection = (section: any) => {
    setEditingSection(section);
    setEditSectionForm({ name: section.name, description: section.description || '' });
    setEditSectionDialog(true);
  };

  const saveEditSection = async () => {
    if (!editSectionForm.name.trim()) { addToast('El nombre de la sección es obligatorio', 'error'); return; }
    try {
      await api.put(
        `/quotations/${id}/sections/${editingSection.id}`,
        { name: editSectionForm.name.trim(), description: editSectionForm.description },
        token!
      );
      addToast('Sección actualizada', 'success');
      setEditSectionDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  /* ── Edit item ───────────────────────────────────────────── */
  const openEditItem = (sectionId: string, item: any) => {
    setEditingSectionId(sectionId);
    setEditingItem(item);
    setEditItemForm(hydrateItemForm(item));
    setEditItemDialog(true);
  };

  const saveEditItem = async () => {
    if (!editItemForm.description.trim()) { addToast('La descripción es obligatoria', 'error'); return; }
    const qty = parseFloat(editItemForm.quantity);
    const summary = priceSummary(editItemForm);
    const price = editItemForm.costBreakdown.length > 0 ? summary.unitPrice : parseFloat(editItemForm.unitPrice);
    if (isNaN(qty) || qty <= 0) { addToast('La cantidad debe ser mayor a 0', 'error'); return; }
    if (editItemForm.costBreakdown.length > 0 && !hasValidCostBreakdown(editItemForm)) {
      addToast('Completa al menos un costo con descripcion y cantidad', 'error');
      return;
    }
    if (isNaN(price) || price < 0) { addToast('El precio unitario no puede ser negativo', 'error'); return; }
    try {
      await api.patch(
        `/quotations/${id}/sections/${editingSectionId}/items/${editingItem.id}`,
        serializeItemForm(editItemForm),
        token!
      );
      addToast('Ítem actualizado', 'success');
      setEditItemDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  /* ── Recalculate ───────────────────────────────────────── */
  const [recalculating, setRecalculating] = useState(false);
  const [spreadsheetMode, setSpreadsheetMode] = useState(true);
  const recalculate = async () => {
    try {
      setRecalculating(true);
      await api.post(`/quotations/${id}/recalculate`, {}, token!);
      addToast('Montos recalculados correctamente', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setRecalculating(false); }
  };

  /* ── Convert to Project ──────────────────────────────────── */
  const convertToProject = async () => {
    if (!confirm('¿Convertir esta cotización en un proyecto? Se creará un nuevo proyecto en estado Planificación.')) return;
    try {
      setConverting(true);
      const project = await api.post<any>(`/projects/from-quotation/${id}`, {}, token!);
      addToast('Proyecto creado correctamente', 'success');
      router.push(`/projects/detail?id=${project.id}`);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setConverting(false);
    }
  };

  /* ── PDF / impresión ───────────────────────────────────── */
  const handlePrint = () => {
    if (!quotation) return;
    const w = getQuotationExportWarnings({
      documentMode: quotation.documentMode,
      referenceSubject: quotation.referenceSubject,
      title: quotation.title,
      commercialTerms: quotation.commercialTerms,
      technicalSections: quotation.technicalSections,
      sections: quotation.sections,
    });
    if (w.length) {
      setPrintWarnings(w);
      return;
    }
    window.print();
  };

  const downloadQuotationPdf = async (force = false) => {
    if (!id || !token) return;
    try {
      await api.downloadQuotationPdf(
        id,
        `cotizacion-${quotation?.quotationNumber || quotation?.code || id}.pdf`,
        token,
        force,
      );
      addToast('PDF descargado', 'success');
      setPdfIncomplete(null);
    } catch (e: unknown) {
      const err = e as Error & { warnings?: string[] };
      if (Array.isArray(err.warnings) && err.warnings.length) {
        setPdfIncomplete(err.warnings);
        return;
      }
      addToast(err?.message || 'Error al generar PDF', 'error');
    }
  };

  /* ── Document upload ─────────────────────────────────────── */
  const uploadDocument = async (
    file: File,
    type: 'pdf' | 'xlsx',
    setProgress: (n: number | null) => void,
  ) => {
    const storageRef = ref(storage, `quotations/${id}/${type}/${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    return new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setProgress(null); addToast(`Error al subir: ${err.message}`, 'error'); reject(err); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const field = type === 'pdf'
            ? { pdfUrl: url, pdfName: file.name }
            : { xlsxUrl: url, xlsxName: file.name };
          await api.patch(`/quotations/${id}`, field, token!);
          setProgress(null);
          addToast(`${type.toUpperCase()} guardado correctamente`, 'success');
          load();
          resolve();
        },
      );
    });
  };

  const handleFileChange = (type: 'pdf' | 'xlsx') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const setProgress = type === 'pdf' ? setPdfProgress : setXlsxProgress;
    await uploadDocument(file, type, setProgress);
  };

  const removeDocument = async (type: 'pdf' | 'xlsx') => {
    if (!confirm(`¿Eliminar el archivo ${type.toUpperCase()} adjunto?`)) return;
    try {
      const url = type === 'pdf' ? quotation.pdfUrl : quotation.xlsxUrl;
      if (url) {
        const path = extractStoragePath(url);
        if (path) {
          const fileRef = ref(storage, path);
          await deleteObject(fileRef).catch(() => {/* already deleted */});
        }
      }
      const field = type === 'pdf'
        ? { pdfUrl: null, pdfName: null }
        : { xlsxUrl: null, xlsxName: null };
      await api.patch(`/quotations/${id}`, field, token!);
      addToast(`Archivo ${type.toUpperCase()} eliminado`, 'success');
      load();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  if (!quotation) return <p className="text-center py-8 text-muted-foreground font-jakarta">Cotización no encontrada</p>;

  const currency = quotation.currency || 'PEN';
  const fmt = (n: number) => `${currency} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      {/* ══ Screen view ══════════════════════════════════════ */}
      <div className="print:hidden space-y-8 pb-20 animate-in fade-in duration-700 font-jakarta">
        
        {/* ── Command Center Header ── */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-10 shadow-2xl border border-white/10">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-orange-500/10 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-500/5 blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 hover:bg-white/10 text-slate-300"
                  onClick={() => router.push('/quotations')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]">
                  <Layers className="h-3 w-3 text-orange-500" />
                  <span>Cotizaciones</span>
                  <ChevronRight className="h-3 w-3 opacity-30" />
                  <span className="text-white">Detalle Operativo</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                    {quotation.code || `COT-${id?.slice(0, 5).toUpperCase()}`}
                  </h1>
                  <StatusBadge status={quotation.status} className="px-3 py-1 text-xs font-bold rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                </div>
                <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
                  {quotation.title || 'Sin título definido'}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 pt-2">
                {/* Backend modela las cotizaciones con company + contact (no `client`).
                    Mostramos primero la empresa real; si no hay, usamos el legacy `client.name`;
                    como último recurso, "Sin cliente asignado". */}
                <div className="flex items-center gap-2.5 text-sm text-slate-300 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                  <Building2 className="h-4 w-4 text-orange-400" />
                  <span className="font-semibold">
                    {quotation.company?.tradeName ||
                      quotation.company?.businessName ||
                      quotation.client?.name ||
                      'Sin cliente asignado'}
                  </span>
                  {quotation.contact?.fullName && (
                    <span className="text-slate-500 text-xs font-medium border-l border-white/10 pl-2.5 ml-1">
                      {quotation.contact.fullName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-slate-300 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">Creado: {new Date(quotation.createdAt).toLocaleDateString()}</span>
                </div>
                {quotation.projectName && (
                  <div className="flex items-center gap-2.5 text-sm text-slate-300 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                    <FolderKanban className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium">Proyecto: {quotation.projectName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-end">
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="border-white/25 bg-white/10 text-white hover:bg-white/20 font-bold rounded-2xl px-6"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadQuotationPdf(false)}
                  className="border-white/25 bg-white/10 text-white hover:bg-white/20 font-bold rounded-2xl px-6"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF servidor
                </Button>
                {canEdit && (
                  <Button 
                    onClick={openEditMeta} 
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl px-6 shadow-xl shadow-orange-500/20 transition-all active:scale-95"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar Datos
                  </Button>
                )}
              </div>
              
              {/* Status Stepper */}
              <div className="flex items-center gap-2 mt-2">
                {(NEXT_STATUSES[quotation.status] || []).map(st => (
                  <Button
                    key={st.next}
                    size="sm"
                    variant={st.variant}
                    onClick={() => updateStatus(st.next)}
                    className={`h-9 px-4 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all ${
                      st.variant === 'default' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20' 
                        : 'border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    {st.label}
                  </Button>
                ))}
                {quotation.status === 'APPROVED' && (
                  <Button
                    size="sm"
                    onClick={convertToProject}
                    disabled={converting}
                    className="h-9 px-4 rounded-xl font-bold text-[11px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                  >
                    {converting ? 'Convirtiendo...' : 'Crear Proyecto'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Financial Stats Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="group relative overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border-white/20 shadow-2xl transition-all hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Subtotal Operativo</p>
                  <h3 className="text-2xl font-black tracking-tight font-mono">{fmt(quotation.subtotal)}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                  <Calculator className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border-white/20 shadow-2xl transition-all hover:-translate-y-1">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Impuestos (IGV {quotation.igvPercentage ?? 18}%)</p>
                  <h3 className="text-2xl font-black tracking-tight font-mono text-orange-600 dark:text-orange-400">{fmt(quotation.igv)}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-slate-900 text-white shadow-2xl transition-all hover:-translate-y-1 border-white/5">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Total Final Propuesta</p>
                  <h3 className="text-3xl font-black tracking-tight font-mono">{fmt(quotation.total)}</h3>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Workspace ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Sections & Items */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Package className="h-5 w-5 text-orange-500" />
                Desglose de Conceptos
              </h2>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={spreadsheetMode ? 'default' : 'outline'}
                    onClick={() => setSpreadsheetMode(true)}
                    className="rounded-xl font-bold text-xs"
                  >
                    <Sheet className="mr-1.5 h-3.5 w-3.5" />
                    Vista Tabla
                  </Button>
                  <Button
                    size="sm"
                    variant={!spreadsheetMode ? 'default' : 'outline'}
                    onClick={() => setSpreadsheetMode(false)}
                    className="rounded-xl font-bold text-xs"
                  >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                    Vista Tarjetas
                  </Button>
                </div>
              )}
            </div>

            {canEdit && spreadsheetMode ? (
              <SpreadsheetEditor
                quotationId={id!}
                sections={quotation.sections || []}
                currency={currency}
                token={token!}
                onRefresh={load}
              />
            ) : (
              <>
            {(quotation.sections || []).length === 0 && (
              <div className="bg-white/5 rounded-3xl border-2 border-dashed border-white/10 p-16 text-center space-y-4">
                <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Plus className="h-8 w-8 text-muted-foreground opacity-20" />
                </div>
                <p className="text-muted-foreground font-medium italic">No hay secciones definidas en esta cotización.</p>
                {canEdit && (
                  <Button onClick={() => setSectionDialog(true)} variant="link" className="text-orange-500 font-bold">
                    Comienza agregando tu primera sección
                  </Button>
                )}
              </div>
            )}

            {(quotation.sections || []).map((section: any) => (
              <Card key={section.id} className="overflow-hidden border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-xl rounded-3xl">
                <div className="bg-gradient-to-r from-slate-100 to-transparent dark:from-white/5 dark:to-transparent px-6 py-4 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-none">{section.name}</h3>
                      {section.description && <p className="text-xs text-muted-foreground mt-1">{section.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 rounded-lg text-xs font-bold hover:bg-orange-500/10 hover:text-orange-500"
                        onClick={() => openItemDialog(section.id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Añadir Ítem
                      </Button>
                    )}
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/10"
                        onClick={() => openEditSection(section)}
                        title="Editar sección"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                        onClick={() => deleteSection(section.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableRow className="hover:bg-transparent border-white/5">
                        <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Descripción del Ítem</TableHead>
                        <TableHead className="w-24 text-center font-bold text-[10px] uppercase tracking-widest">Und.</TableHead>
                        <TableHead className="w-24 text-right font-bold text-[10px] uppercase tracking-widest">Cant.</TableHead>
                        <TableHead className="w-32 text-right font-bold text-[10px] uppercase tracking-widest">P. Unit</TableHead>
                        <TableHead className="w-32 text-right font-bold text-[10px] uppercase tracking-widest pr-6">Subtotal</TableHead>
                        {canEdit && <TableHead className="w-20"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(section.items || []).map((item: any) => (
                        <Fragment key={item.id}>
                          <TableRow className="group hover:bg-slate-50/50 dark:hover:bg-white/5 border-white/5">
                            <TableCell className="font-medium pl-6 text-sm py-4">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground font-mono text-xs">{item.unit}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{Number(item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-slate-500">{Number(item.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                {Number(item.subtotal ?? Number(item.saleTotal ?? Number(item.quantity) * Number(item.unitPrice))).toFixed(2)}
                              </span>
                            </TableCell>
                            {canEdit && (
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditItem(section.id, item)}>
                                    <Pencil className="h-3 w-3 text-blue-500" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deleteItem(section.id, item.id)}>
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          {Array.isArray(item.costBreakdown) && item.costBreakdown.length > 0 && (
                            <TableRow className="bg-slate-50/70 dark:bg-slate-900/60 border-white/5">
                              <TableCell colSpan={canEdit ? 6 : 5} className="px-6 py-3">
                                <div className="space-y-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Costos del item sin IGV</span>
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                                      <span>Costo: {currency} {Number(item.costTotal || 0).toFixed(2)}</span>
                                      <span className="font-bold text-blue-700">Base venta: {currency} {Number(item.saleTotal ?? item.subtotal ?? 0).toFixed(2)}</span>
                                    </div>
                                  </div>
                                  <div className="grid gap-1">
                                    {item.costBreakdown.map((row: any, rowIndex: number) => (
                                      <div key={`${item.id}-cost-${rowIndex}`} className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
                                        <span className="col-span-2 font-bold text-slate-600 dark:text-slate-300">{row.category}</span>
                                        <span className="col-span-4">{row.description}</span>
                                        <span className="col-span-2 text-right font-mono">{row.quantity} {row.unit}</span>
                                        <span className="col-span-2 text-right font-mono">{currency} {Number(row.unitCost || 0).toFixed(2)}</span>
                                        <span className="col-span-2 text-right font-mono font-bold">{currency} {Number(row.subtotal || 0).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
              </>
            )}
          </div>

          {/* Right Column: Assets & Details */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Context & Technical Details */}
            <Card className="overflow-hidden border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-xl rounded-3xl">
              <CardHeader className="border-b border-white/5 py-5 px-6">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
                  <Info className="h-4 w-4 text-blue-500" />
                  Información Técnica
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Moneda</span>
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      {quotation.currency === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Validez</span>
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-orange-500" />
                      {quotation.validityDays || 30} días
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-2">Alcance de la Propuesta</span>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 italic">
                      {quotation.introductionText || 'No se ha definido un texto de introducción técnica.'}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-2">Resumen Operativo</span>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {quotation.description || 'Sin descripción adicional.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card className="overflow-hidden border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-xl rounded-3xl">
              <CardHeader className="border-b border-white/5 py-5 px-6">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
                  <Upload className="h-4 w-4 text-purple-500" />
                  Archivos & Evidencia
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                
                {/* PDF Document */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Formato PDF Firmado</span>
                    {quotation.pdfUrl && (
                      <Badge variant="success" className="text-[9px] h-4 rounded-full">Validado</Badge>
                    )}
                  </div>
                  {quotation.pdfUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-emerald-700 dark:text-emerald-400">{quotation.pdfName || 'cotizacion-formal.pdf'}</p>
                        <p className="text-[10px] text-emerald-600/70">Archivo cargado correctamente</p>
                      </div>
                      <div className="flex gap-1">
                        <a href={quotation.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-600">
                          <Download className="h-4 w-4" />
                        </a>
                        <button onClick={() => removeDocument('pdf')} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => pdfInputRef.current?.click()}
                      className="cursor-pointer group flex flex-col items-center justify-center py-6 px-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 transition-all bg-white/5 hover:bg-emerald-500/5"
                    >
                      {pdfProgress !== null ? (
                        <div className="text-center space-y-2">
                          <p className="text-xs font-bold animate-pulse">{pdfProgress}% Subiendo...</p>
                          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pdfProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500" />
                          </div>
                          <p className="text-xs font-bold group-hover:text-emerald-600">Subir PDF Formal</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">Máximo 10MB</p>
                        </>
                      )}
                      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange('pdf')} />
                    </div>
                  )}
                </div>

                {/* Excel Document */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Anexo Excel / Listas</span>
                  </div>
                  {quotation.xlsxUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-600">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-blue-700 dark:text-blue-400">{quotation.xlsxName || 'anexo-precios.xlsx'}</p>
                        <p className="text-[10px] text-blue-600/70">Documento técnico adjunto</p>
                      </div>
                      <div className="flex gap-1">
                        <a href={quotation.xlsxUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-blue-500/10 rounded-lg text-blue-600">
                          <Download className="h-4 w-4" />
                        </a>
                        <button onClick={() => removeDocument('xlsx')} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => xlsxInputRef.current?.click()}
                      className="cursor-pointer group flex flex-col items-center justify-center py-6 px-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/40 transition-all bg-white/5 hover:bg-blue-500/5"
                    >
                      {xlsxProgress !== null ? (
                        <div className="text-center space-y-2">
                          <p className="text-xs font-bold animate-pulse">{xlsxProgress}% Subiendo...</p>
                          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all" style={{ width: `${xlsxProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-blue-500" />
                          </div>
                          <p className="text-xs font-bold group-hover:text-blue-600">Subir Listado XLSX</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">Para cálculos internos</p>
                        </>
                      )}
                      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange('xlsx')} />
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Actions Card */}
            <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl rounded-3xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight">Cálculos & Resumen</h3>
                    <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-wider">Centro de Control</p>
                  </div>
                </div>
                
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={recalculate}
                    disabled={recalculating}
                    className="h-8 px-3 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                    title="Recalcular montos a partir de los ítems actuales (limpia el ajuste manual si existe)"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recalculating ? 'animate-spin' : ''}`} />
                    {recalculating ? 'Calculando...' : 'Recalcular'}
                  </Button>
                )}
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs text-slate-400">Costo Directo</span>
                    <span className="text-sm font-mono font-bold">{fmt(quotation.directSubtotal ?? quotation.subtotalBeforeDiscount ?? quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs text-slate-400">Gastos + Utilidad ({quotation.generalExpensesPercentage ?? 0}%)</span>
                    <span className="text-sm font-mono font-bold">+{fmt(quotation.generalExpensesAmount ?? 0)}</span>
                  </div>
                  {Number(quotation.commercialDiscountAmount || 0) > 0 && (
                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-xs text-slate-400">Descuento Comercial ({quotation.commercialDiscountPercentage ?? 0}%)</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">-{fmt(quotation.commercialDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs text-slate-400">Subtotal Operativo</span>
                    <span className="text-sm font-mono font-bold">{fmt(quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-xs text-slate-400">IGV ({quotation.igvPercentage ?? 18}%)</span>
                    <span className="text-sm font-mono font-bold text-orange-400">+{fmt(quotation.igv)}</span>
                  </div>
                  <div className="h-px bg-white/10 my-2" />
                  <div className="flex justify-between items-center px-4 py-3 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-400">Total Propuesta</span>
                      {quotation.manualTotalOverride != null && Number(quotation.manualTotalOverride) > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Monto ajustado manualmente
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-mono font-black">{fmt(quotation.total)}</span>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-500 leading-relaxed text-center px-4 pt-2 italic">
                  * Los precios incluyen todos los conceptos detallados en las secciones de la izquierda.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <QuotationPrintDocument quotation={quotation} companySettings={companySettings} quotationId={id!} />

      {/* ══ Dialogs ══════════════════════════════════════════ */}

      {/* Edit metadata dialog */}
      <Dialog open={editMetaDialog} onOpenChange={setEditMetaDialog}>
        <DialogContent className="max-w-4xl h-[92vh] max-h-[92vh] overflow-hidden p-0 border-none shadow-2xl font-jakarta flex flex-col">
          <DialogHeader className="shrink-0 p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Pencil className="h-6 w-6 text-orange-500" />
              Parámetros de la Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto overscroll-contain bg-white dark:bg-slate-950">
            
            {/* ── Cliente & Tipo ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Vinculación Comercial
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-company" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cliente / Empresa</Label>
                  <Select value={metaForm.companyId || '__none__'} onValueChange={v => setMetaForm(f => ({ ...f, companyId: v === '__none__' ? '' : v, contactId: '' }))}>
                    <SelectTrigger id="meta-company" className="h-11 rounded-xl border-slate-200 font-medium"><SelectValue placeholder="Sin cliente asignado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cliente (Carga Directa)</SelectItem>
                      {companies.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.tradeName || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-contact" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Contacto</Label>
                  <Select value={metaForm.contactId || '__none__'} onValueChange={v => setMetaForm(f => ({ ...f, contactId: v === '__none__' ? '' : v }))}>
                    <SelectTrigger id="meta-contact" className="h-11 rounded-xl border-slate-200 font-medium disabled:opacity-50" disabled={!metaForm.companyId}><SelectValue placeholder="Selecciona un contacto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin contacto específico</SelectItem>
                      {metaContacts.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-tipo" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tipo de Cotización</Label>
                <Select value={metaForm.tipo || '__none__'} onValueChange={v => setMetaForm(f => ({ ...f, tipo: v === '__none__' ? '' : v }))}>
                  <SelectTrigger id="meta-tipo" className="h-11 rounded-xl border-slate-200 font-medium"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {quotationTypes.map((t: string) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            {/* ── Documento comercial (simple / proyecto) ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" /> Documento al cliente
              </h3>
              <div className="space-y-2">
                <Label htmlFor="meta-doc-mode" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Modo de documento
                </Label>
                <Select
                  value={metaForm.documentMode}
                  onValueChange={v =>
                    setMetaForm(f => ({
                      ...f,
                      documentMode: v === 'PROJECT' ? 'PROJECT' : 'SIMPLE',
                      technicalSections:
                        v === 'PROJECT' && f.technicalSections.length === 0
                          ? [...DEFAULT_PROJECT_TECHNICAL_SECTIONS]
                          : v === 'SIMPLE'
                            ? []
                            : f.technicalSections,
                    }))
                  }
                >
                  <SelectTrigger id="meta-doc-mode" className="h-11 rounded-xl border-slate-200 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple — resumen comercial</SelectItem>
                    <SelectItem value="PROJECT">Proyecto — propuesta técnica multipágina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-ref" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Referencia / asunto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meta-ref"
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.referenceSubject}
                    onChange={e => setMetaForm(f => ({ ...f, referenceSubject: e.target.value }))}
                    placeholder="Línea de referencia para el PDF"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-rev" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Revisión (ej. REV1)
                  </Label>
                  <Input
                    id="meta-rev"
                    className="h-11 rounded-xl border-slate-200 font-mono"
                    value={metaForm.revisionLabel}
                    onChange={e => setMetaForm(f => ({ ...f, revisionLabel: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-place" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Lugar de emisión
                  </Label>
                  <Input
                    id="meta-place"
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.issuePlace}
                    onChange={e => setMetaForm(f => ({ ...f, issuePlace: e.target.value }))}
                    placeholder="Ej: Lima"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-issue-date" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Fecha de emisión (documento)
                  </Label>
                  <Input
                    id="meta-issue-date"
                    type="date"
                    className="h-11 rounded-xl border-slate-200 font-mono"
                    value={metaForm.issueDate}
                    onChange={e => setMetaForm(f => ({ ...f, issueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 accent-orange-500"
                    checked={metaForm.showTaxBreakdown}
                    onChange={e => setMetaForm(f => ({ ...f, showTaxBreakdown: e.target.checked }))}
                  />
                  Mostrar desglose IGV en documento
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 accent-orange-500"
                    checked={metaForm.pricesIncludeIgv}
                    onChange={e => setMetaForm(f => ({ ...f, pricesIncludeIgv: e.target.checked }))}
                  />
                  Precios incluyen IGV
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Si no marca «incluye IGV», el texto del PDF indicará montos más IGV. Alinee esto con cómo cotiza cada ítem.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Forma de pago
                  </Label>
                  <Input
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.commercialTerms.paymentMethod}
                    onChange={e =>
                      setMetaForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, paymentMethod: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Condiciones / términos de pago
                  </Label>
                  <Input
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.commercialTerms.paymentTerms}
                    onChange={e =>
                      setMetaForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, paymentTerms: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Lugar de ejecución
                  </Label>
                  <Input
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.commercialTerms.executionLocation}
                    onChange={e =>
                      setMetaForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, executionLocation: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Plazo / tiempo de ejecución
                  </Label>
                  <Input
                    className="h-11 rounded-xl border-slate-200"
                    value={metaForm.commercialTerms.executionTime}
                    onChange={e =>
                      setMetaForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, executionTime: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                    Notas comerciales adicionales
                  </Label>
                  <Textarea
                    rows={2}
                    className="rounded-xl border-slate-200 text-sm"
                    value={metaForm.commercialTerms.additionalNotes}
                    onChange={e =>
                      setMetaForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, additionalNotes: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              {metaForm.documentMode === 'PROJECT' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Portada e imágenes (URL)</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      placeholder="Imagen 1 (URL)"
                      className="h-10 rounded-xl text-xs"
                      value={metaForm.coverUrl1}
                      onChange={e => setMetaForm(f => ({ ...f, coverUrl1: e.target.value }))}
                    />
                    <Input
                      placeholder="Imagen 2 (URL)"
                      className="h-10 rounded-xl text-xs"
                      value={metaForm.coverUrl2}
                      onChange={e => setMetaForm(f => ({ ...f, coverUrl2: e.target.value }))}
                    />
                    <Input
                      placeholder="Imagen 3 (URL)"
                      className="h-10 rounded-xl text-xs"
                      value={metaForm.coverUrl3}
                      onChange={e => setMetaForm(f => ({ ...f, coverUrl3: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Secciones técnicas numeradas</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-bold shrink-0"
                      onClick={() =>
                        setMetaForm(f => ({ ...f, technicalSections: [...DEFAULT_PROJECT_TECHNICAL_SECTIONS] }))
                      }
                    >
                      Cargar plantilla estándar
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {metaForm.technicalSections.map((sec, idx) => (
                      <div key={`${sec.order}-${idx}`} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] font-mono font-bold text-slate-400 w-6">{sec.order}.</span>
                          <Input
                            className="h-9 rounded-lg text-sm font-semibold"
                            value={sec.title}
                            onChange={e => {
                              const next = [...metaForm.technicalSections];
                              next[idx] = { ...next[idx], title: e.target.value };
                              setMetaForm(f => ({ ...f, technicalSections: next }));
                            }}
                          />
                        </div>
                        <Textarea
                          rows={3}
                          className="rounded-lg text-xs"
                          placeholder="Contenido de la sección..."
                          value={sec.body}
                          onChange={e => {
                            const next = [...metaForm.technicalSections];
                            next[idx] = { ...next[idx], body: e.target.value };
                            setMetaForm(f => ({ ...f, technicalSections: next }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            {/* ── Datos principales ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Datos del Proyecto
              </h3>
              <div className="space-y-2">
                <Label htmlFor="meta-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Título del Proyecto / Servicio <span className="text-red-500">*</span></Label>
                <Input id="meta-title" className="h-11 rounded-xl border-slate-200 focus:ring-orange-500/20 focus:border-orange-500" value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Resumen Operativo</Label>
                <Textarea id="meta-desc" rows={2} className="rounded-xl border-slate-200 text-sm" value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción del trabajo..." />
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            {/* ── Condiciones financieras ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Condiciones Financieras
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-validity" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Validez (días) <span className="text-red-500">*</span></Label>
                  <Input id="meta-validity" type="number" min="1" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.validityDays} onChange={e => setMetaForm(f => ({ ...f, validityDays: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-currency" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Moneda</Label>
                  <Select value={metaForm.currency} onValueChange={v => setMetaForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger id="meta-currency" className="h-11 rounded-xl border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PEN">Soles (PEN)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-igv" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">IGV (%) <span className="text-red-500">*</span></Label>
                  <Input id="meta-igv" type="number" step="0.1" min="0" max="100" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.igvPercentage} onChange={e => setMetaForm(f => ({ ...f, igvPercentage: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-gep" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Gastos Operativos + Utilidad (%)</Label>
                  <Input id="meta-gep" type="number" step="0.1" min="0" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.generalExpensesPercentage} onChange={e => setMetaForm(f => ({ ...f, generalExpensesPercentage: e.target.value }))} placeholder="Ej: 13" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-discount" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descuento Comercial (%)</Label>
                  <Input id="meta-discount" type="number" step="0.1" min="0" max="100" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.commercialDiscountPercentage} onChange={e => setMetaForm(f => ({ ...f, commercialDiscountPercentage: e.target.value }))} placeholder="Ej: 2" />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            {/* ── Plazos & garantías ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Plazos & Garantías
              </h3>
              <div className="space-y-2">
                <Label htmlFor="meta-delivery" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Plazo de Entrega (días)</Label>
                <Input id="meta-delivery" type="number" min="0" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.deliveryTimeDays} onChange={e => setMetaForm(f => ({ ...f, deliveryTimeDays: e.target.value }))} placeholder="Días calendario desde la aprobación" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-warranty" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Texto de Garantía</Label>
                <Textarea id="meta-warranty" rows={2} className="rounded-xl border-slate-200 text-sm" value={metaForm.warrantyText} onChange={e => setMetaForm(f => ({ ...f, warrantyText: e.target.value }))} placeholder="Ej: Garantía de 12 meses por defectos de fabricación..." />
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            {/* ── Ajuste de Monto Total ── */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Ajuste de Monto Total
              </h3>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-500/20 space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    id="meta-use-manual"
                    type="checkbox"
                    checked={metaForm.useManualTotal}
                    onChange={e => setMetaForm(f => ({ ...f, useManualTotal: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="meta-use-manual" className="text-sm font-bold text-amber-800 dark:text-amber-400 cursor-pointer block">
                      Establecer monto total manualmente
                    </label>
                    <p className="text-[10px] text-amber-600/80 dark:text-amber-500/70 mt-0.5 leading-relaxed">
                      Permite fijar el total de la propuesta independientemente del cálculo automático.
                      Al desactivar, se restaurará el total calculado a partir de los ítems.
                    </p>
                  </div>
                </div>
                {metaForm.useManualTotal && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="meta-manual-total" className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 ml-1">
                      Monto Total ({metaForm.currency}) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-500 pointer-events-none">{metaForm.currency}</span>
                      <Input
                        id="meta-manual-total"
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-12 rounded-xl border-amber-300 dark:border-amber-600 font-mono text-lg font-bold pl-14 focus:ring-amber-500/20 focus:border-amber-500"
                        value={metaForm.manualTotalOverride}
                        onChange={e => setMetaForm(f => ({ ...f, manualTotalOverride: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    {metaForm.manualTotalOverride && (
                      <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Este monto reemplazará el total calculado automáticamente.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5" />

            <div className="space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Textos Técnicos
              </h3>
              <div className="space-y-2">
                <Label htmlFor="meta-intro" className="text-[10px] font-bold uppercase tracking-widest text-blue-500 ml-1">Alcance Técnico</Label>
                <Textarea id="meta-intro" rows={4} className="rounded-2xl border-slate-200 text-sm italic" value={metaForm.introductionText} onChange={e => setMetaForm(f => ({ ...f, introductionText: e.target.value }))} placeholder="Describe el alcance de los trabajos..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-terms" className="text-[10px] font-bold uppercase tracking-widest text-orange-500 ml-1">Condiciones Comerciales</Label>
                <Textarea id="meta-terms" rows={4} className="rounded-2xl border-slate-200 text-sm" value={metaForm.termsAndConditions} onChange={e => setMetaForm(f => ({ ...f, termsAndConditions: e.target.value }))} placeholder="Plazos de entrega, formas de pago, garantías..." />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 p-6 bg-slate-50 dark:bg-white/5 border-t border-white/10">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setEditMetaDialog(false)}>Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-orange-500/20" onClick={saveMeta}>Actualizar Cotización</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New section dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-md font-jakarta">
          <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Plus className="h-6 w-6 text-orange-500" />
              Nueva Sección
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            {providerProducts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Producto de proveedor</Label>
                <Select value="__manual__" onValueChange={applyProviderProduct}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200">
                    <SelectValue placeholder="Buscar producto registrado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Carga manual</SelectItem>
                    {providerProducts.map(product => (
                      <SelectItem key={`${product.providerId}-${product.id}`} value={product.id}>
                        {product.name} - {product.providerName} ({currency} {Number(product.unitPrice || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sec-name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nombre del Grupo</Label>
              <Input id="sec-name" className="h-11 rounded-xl" value={sectionForm.name} onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Materiales Eléctricos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Detalle (Opcional)</Label>
              <Input id="sec-desc" className="h-11 rounded-xl" value={sectionForm.description} onChange={e => setSectionForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve nota sobre esta sección" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setSectionDialog(false)}>Cancelar</Button>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-8 rounded-xl" onClick={addSection}>Crear Sección</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-4xl font-jakarta">
          <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Package className="h-6 w-6 text-orange-500" />
              Añadir Ítem a la Sección
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="item-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descripción del Concepto</Label>
              <Input id="item-desc" className="h-11 rounded-xl" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalla el producto o servicio..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-long" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descripción ampliada / alcance (impresión)</Label>
              <Textarea id="item-long" rows={3} className="rounded-xl border-slate-200 text-sm" value={itemForm.longDescription} onChange={e => setItemForm(f => ({ ...f, longDescription: e.target.value }))} placeholder="Opcional: detalle bajo la fila en documento simple" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Unidad</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-qty" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cantidad</Label>
                <Input id="item-qty" type="number" step="0.01" min="0" className="h-11 rounded-xl font-mono" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-price" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">P. Unitario</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-11 rounded-xl font-mono"
                  value={itemForm.costBreakdown.length > 0 ? priceSummary(itemForm).unitPrice.toFixed(2) : itemForm.unitPrice}
                  readOnly={itemForm.costBreakdown.length > 0}
                  onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))}
                />
              </div>
            </div>
            <CostBreakdownEditor form={itemForm} onChange={setItemForm} currency={currency} />
            {itemForm.quantity && (itemForm.unitPrice || itemForm.costBreakdown.length > 0) && (
              <div className="flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-200/50">
                <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Subtotal estimado</span>
                <span className="font-mono font-black text-orange-700 dark:text-orange-400">
                  {currency} {priceSummary(itemForm).saleTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setItemDialog(false)}>Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-orange-500/20" onClick={addItem}>Registrar Ítem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-4xl font-jakarta">
          <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Pencil className="h-6 w-6 text-blue-500" />
              Editar Concepto
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-item-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descripción del Concepto</Label>
              <Input id="edit-item-desc" className="h-11 rounded-xl" value={editItemForm.description} onChange={e => setEditItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-long" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descripción ampliada / alcance</Label>
              <Textarea id="edit-item-long" rows={3} className="rounded-xl border-slate-200 text-sm" value={editItemForm.longDescription} onChange={e => setEditItemForm(f => ({ ...f, longDescription: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Unidad</Label>
                <Select value={editItemForm.unit} onValueChange={v => setEditItemForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-qty" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cantidad</Label>
                <Input id="edit-item-qty" type="number" step="0.01" min="0" className="h-11 rounded-xl font-mono" value={editItemForm.quantity} onChange={e => setEditItemForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-price" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">P. Unitario</Label>
                <Input
                  id="edit-item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-11 rounded-xl font-mono"
                  value={editItemForm.costBreakdown.length > 0 ? priceSummary(editItemForm).unitPrice.toFixed(2) : editItemForm.unitPrice}
                  readOnly={editItemForm.costBreakdown.length > 0}
                  onChange={e => setEditItemForm(f => ({ ...f, unitPrice: e.target.value }))}
                />
              </div>
            </div>
            <CostBreakdownEditor form={editItemForm} onChange={setEditItemForm} currency={currency} />
            {editItemForm.quantity && (editItemForm.unitPrice || editItemForm.costBreakdown.length > 0) && (
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Subtotal estimado</span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                  {currency} {priceSummary(editItemForm).saleTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setEditItemDialog(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-blue-500/20" onClick={saveEditItem}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit section dialog */}
      <Dialog open={editSectionDialog} onOpenChange={setEditSectionDialog}>
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-md font-jakarta">
          <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Pencil className="h-6 w-6 text-blue-500" />
              Editar Sección
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-sec-name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nombre del Grupo <span className="text-red-500">*</span></Label>
              <Input id="edit-sec-name" className="h-11 rounded-xl" value={editSectionForm.name} onChange={e => setEditSectionForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Materiales Eléctricos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sec-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Detalle (Opcional)</Label>
              <Input id="edit-sec-desc" className="h-11 rounded-xl" value={editSectionForm.description} onChange={e => setEditSectionForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve nota sobre esta sección" />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setEditSectionDialog(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-blue-500/20" onClick={saveEditSection}>Guardar Sección</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfIncomplete !== null} onOpenChange={o => { if (!o) setPdfIncomplete(null); }}>
        <DialogContent className="max-w-lg rounded-2xl font-jakarta">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Falta información para el PDF
            </DialogTitle>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {(pdfIncomplete ?? []).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setPdfIncomplete(null)}>Cerrar</Button>
            <Button
              className="font-bold text-xs bg-slate-900"
              onClick={() => {
                const w = pdfIncomplete;
                setPdfIncomplete(null);
                downloadQuotationPdf(true);
                if (w?.length) addToast('PDF generado con advertencias', 'info');
              }}
            >
              Descargar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printWarnings !== null} onOpenChange={o => { if (!o) setPrintWarnings(null); }}>
        <DialogContent className="max-w-lg rounded-2xl font-jakarta">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Revise antes de imprimir
            </DialogTitle>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {(printWarnings ?? []).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setPrintWarnings(null)}>Corregir datos</Button>
            <Button
              className="font-bold text-xs bg-slate-900"
              onClick={() => {
                setPrintWarnings(null);
                window.print();
              }}
            >
              Imprimir de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
