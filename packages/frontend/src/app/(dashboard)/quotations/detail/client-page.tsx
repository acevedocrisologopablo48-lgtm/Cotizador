'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2, Pencil, Calculator, FileText, Printer, DollarSign, Info, Package, FolderKanban, Upload, FileSpreadsheet, Download, X as XIcon } from 'lucide-react';

const NEXT_STATUSES: Record<string, { label: string; next: string; variant?: 'default' | 'outline' }[]> = {
  DRAFT: [{ label: 'Enviar a Revisión', next: 'REVIEW', variant: 'default' }],
  REVIEW: [
    { label: 'Devolver a Borrador', next: 'DRAFT', variant: 'outline' },
    { label: 'Aprobar', next: 'APPROVED', variant: 'default' },
  ],
  APPROVED: [{ label: 'Marcar como Enviada', next: 'SENT', variant: 'default' }],
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
}

const EMPTY_ITEM: ItemForm = { description: '', unit: 'UND', quantity: '', unitPrice: '' };

export default function QuotationDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
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
  });

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
      setQuotation(quotationData);
      if (settingsData) setCompanySettings(settingsData);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, token, addToast]);

  useEffect(() => { load(); }, [load]);

  const isDraft = quotation?.status === 'DRAFT';
  const canEdit = !['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(quotation?.status);

  /* ── Status ──────────────────────────────────────────────── */
  const updateStatus = async (status: string) => {
    try {
      await api.patch(`/quotations/${id}/status`, { status }, token!);
      addToast('Estado actualizado', 'success');
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
    setItemForm(EMPTY_ITEM);
    setItemDialog(true);
  };

  const addItem = async () => {
    try {
      await api.post(`/quotations/${id}/sections/${activeSectionId}/items`, {
        description: itemForm.description,
        unit: itemForm.unit,
        quantity: parseFloat(itemForm.quantity),
        unitPrice: parseFloat(itemForm.unitPrice),
      }, token!);
      addToast('Ítem agregado', 'success');
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
    setMetaForm({
      title: quotation.title || '',
      description: quotation.description || '',
      validityDays: String(quotation.validityDays || '30'),
      currency: quotation.currency || 'PEN',
      igvPercentage: String(quotation.igvPercentage ?? '18'),
      introductionText: quotation.introductionText || '',
      termsAndConditions: quotation.termsAndConditions || '',
    });
    setEditMetaDialog(true);
  };

  const saveMeta = async () => {
    try {
      await api.patch(`/quotations/${id}`, {
        title: metaForm.title,
        description: metaForm.description,
        validityDays: parseInt(metaForm.validityDays, 10) || 30,
        currency: metaForm.currency,
        igvPercentage: parseFloat(metaForm.igvPercentage) || 18,
        introductionText: metaForm.introductionText || undefined,
        termsAndConditions: metaForm.termsAndConditions || undefined,
      }, token!);
      addToast('Cotización actualizada', 'success');
      setEditMetaDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  /* ── Edit item ───────────────────────────────────────────── */
  const openEditItem = (sectionId: string, item: any) => {
    setEditingSectionId(sectionId);
    setEditingItem(item);
    setEditItemForm({
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    });
    setEditItemDialog(true);
  };

  const saveEditItem = async () => {
    try {
      await api.patch(
        `/quotations/${id}/sections/${editingSectionId}/items/${editingItem.id}`,
        {
          description: editItemForm.description,
          unit: editItemForm.unit,
          quantity: parseFloat(editItemForm.quantity),
          unitPrice: parseFloat(editItemForm.unitPrice),
        },
        token!
      );
      addToast('Ítem actualizado', 'success');
      setEditItemDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
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

  /* ── PDF ─────────────────────────────────────────────────── */
  const handlePrint = () => window.print();

  /* ── Document upload ─────────────────────────────────────── */
  const uploadDocument = async (
    file: File,
    type: 'pdf' | 'xlsx',
    setProgress: (n: number | null) => void,
  ) => {
    const ext = type === 'pdf' ? 'pdf' : 'xlsx';
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
        const fileRef = ref(storage, url);
        await deleteObject(fileRef).catch(() => {/* already deleted */});
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
  if (!quotation) return <p className="text-center py-8 text-muted-foreground">Cotización no encontrada</p>;

  const currency = quotation.currency || 'PEN';
  const fmt = (n: number) => `${currency} ${Number(n || 0).toFixed(2)}`;

  return (
    <>
      {/* ══ Screen view ══════════════════════════════════════ */}
      <div className="space-y-6 print:hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => router.push('/quotations')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{quotation.quotationNumber}</h1>
                <StatusBadge status={quotation.status} />
              </div>
              <p className="text-muted-foreground mt-0.5">{quotation.title}</p>
              {quotation.company && (
                <p className="text-sm text-muted-foreground">{quotation.company.businessName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openEditMeta}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {(NEXT_STATUSES[quotation.status] || []).map(({ label, next, variant }) => (
              <Button key={next} variant={variant || 'default'} size="sm" onClick={() => updateStatus(next)}>
                {label}
              </Button>
            ))}
            {quotation.status === 'APPROVED' && (
              <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={convertToProject} disabled={converting}>
                <FolderKanban className="mr-2 h-4 w-4" />
                {converting ? 'Creando...' : 'Convertir a Proyecto'}
              </Button>
            )}
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2">
          {quotation.tipo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {quotation.tipo}
            </span>
          )}
          {quotation.validityDays && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />Validez: {quotation.validityDays} días
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />Moneda: {currency}
          </span>
          {quotation.contact && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />{quotation.contact.firstName} {quotation.contact.lastName}
            </span>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Subtotal</p>
              <p className="font-mono text-xl font-bold">{fmt(quotation.subtotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">IGV (18%)</p>
              <p className="font-mono text-xl font-bold">{fmt(quotation.igv)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-1">Total</p>
              <p className="font-mono text-xl font-bold text-primary">{fmt(quotation.total)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Documentos adjuntos
              </CardTitle>
              <div className="flex gap-2">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange('pdf')}
                />
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange('xlsx')}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pdfProgress !== null}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {pdfProgress !== null ? `${pdfProgress}%` : quotation.pdfUrl ? 'Reemplazar PDF' : 'Subir PDF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={xlsxProgress !== null}
                  onClick={() => xlsxInputRef.current?.click()}
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  {xlsxProgress !== null ? `${xlsxProgress}%` : quotation.xlsxUrl ? 'Reemplazar Excel' : 'Subir Excel'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!quotation.pdfUrl && !quotation.xlsxUrl ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin documentos adjuntos. Sube el PDF o Excel de la cotización.
              </p>
            ) : (
              <div className="space-y-2">
                {quotation.pdfUrl && (
                  <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{quotation.pdfName || 'cotizacion.pdf'}</p>
                        <p className="text-xs text-muted-foreground">PDF</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={quotation.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        title="Eliminar"
                        onClick={() => removeDocument('pdf')}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {quotation.xlsxUrl && (
                  <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{quotation.xlsxName || 'cotizacion.xlsx'}</p>
                        <p className="text-xs text-muted-foreground">Excel</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={quotation.xlsxUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        title="Eliminar"
                        onClick={() => removeDocument('xlsx')}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Secciones e Ítems</h2>
            {isDraft && (
              <Button size="sm" onClick={() => { setSectionForm({ name: '', description: '' }); setSectionDialog(true); }}>
                <Plus className="mr-2 h-4 w-4" />Nueva Sección
              </Button>
            )}
          </div>

          {(quotation.sections || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calculator className="mx-auto h-10 w-10 mb-3 opacity-25" />
                <p className="font-medium">Sin secciones</p>
                <p className="text-sm mt-1">Agrega una sección para comenzar a cotizar.</p>
              </CardContent>
            </Card>
          ) : quotation.sections.map((section: any, si: number) => (
            <Card key={section.id}>
              <CardHeader className="py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      {String.fromCharCode(65 + si)}
                    </span>
                    <CardTitle className="text-base">{section.name}</CardTitle>
                  </div>
                  {isDraft && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openItemDialog(section.id)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Ítem
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => deleteSection(section.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {section.description && (
                  <p className="text-sm text-muted-foreground ml-8">{section.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Descripción</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">P. Unit.</TableHead>
                      <TableHead className="text-right pr-5">Subtotal</TableHead>
                      {isDraft && <TableHead className="w-[80px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(section.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isDraft ? 6 : 5} className="py-4 text-center text-sm text-muted-foreground">
                          Sin ítems — presiona <strong>+ Ítem</strong> para agregar
                        </TableCell>
                      </TableRow>
                    ) : section.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-5 font-medium">{item.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{item.unit}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{Number(item.quantity).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold pr-5">
                          {Number(item.subtotal ?? Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                        </TableCell>
                        {isDraft && (
                          <TableCell className="pr-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(section.id, item)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(section.id, item.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ══ Print / PDF view ═════════════════════════════════ */}
      <div className="hidden print:block font-sans" style={{ fontSize: '10pt', color: '#111827', lineHeight: '1.4' }}>

        {/* ── Top accent stripe ── */}
        <div style={{ height: '5px', background: 'linear-gradient(90deg, #ea580c 0%, #f97316 60%, #fbbf24 100%)', marginBottom: '0' }} />

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 0 14px', borderBottom: '2px solid #ea580c', marginBottom: '18px' }}>
          {/* Left: logo + company info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {companySettings?.logoUrl && (
              <img src={companySettings.logoUrl} alt="Logo" style={{ height: '52px', width: 'auto', objectFit: 'contain' }} />
            )}
            <div>
              <p style={{ fontSize: '15pt', fontWeight: '800', color: '#111827', margin: '0 0 2px' }}>
                {companySettings?.name || 'FYM Technologies'}
              </p>
              {companySettings?.slogan && (
                <p style={{ fontSize: '8pt', color: '#6b7280', fontStyle: 'italic', margin: '0 0 3px' }}>{companySettings.slogan}</p>
              )}
              <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0' }}>
                {[
                  companySettings?.ruc && `RUC: ${companySettings.ruc}`,
                  companySettings?.phone,
                  companySettings?.email,
                ].filter(Boolean).join('  ·  ')}
              </p>
              {companySettings?.address && (
                <p style={{ fontSize: '8pt', color: '#6b7280', margin: '1px 0 0' }}>{companySettings.address}</p>
              )}
            </div>
          </div>

          {/* Right: COTIZACIÓN badge */}
          <div style={{ textAlign: 'right', minWidth: '160px' }}>
            <div style={{ background: '#1e3a5f', color: '#fff', padding: '10px 16px', borderRadius: '6px', display: 'inline-block' }}>
              <p style={{ fontSize: '7pt', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 4px', opacity: '0.75' }}>Cotización</p>
              <p style={{ fontSize: '16pt', fontWeight: '800', margin: '0', letterSpacing: '-0.5px' }}>{quotation.quotationNumber}</p>
              <p style={{ fontSize: '7.5pt', margin: '4px 0 0', opacity: '0.7' }}>
                {new Date(quotation.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* ── Client + Details ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '10px 14px' }}>
            <p style={{ fontSize: '7pt', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Cliente</p>
            <p style={{ fontSize: '11pt', fontWeight: '700', margin: '0 0 3px', color: '#111827' }}>{quotation.company?.businessName || '—'}</p>
            {quotation.company?.ruc && <p style={{ fontSize: '8.5pt', color: '#374151', margin: '1px 0' }}>RUC: {quotation.company.ruc}</p>}
            {quotation.contact && (
              <p style={{ fontSize: '8.5pt', color: '#374151', margin: '1px 0' }}>
                Attn: {quotation.contact.firstName} {quotation.contact.lastName}
              </p>
            )}
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '10px 14px' }}>
            <p style={{ fontSize: '7pt', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Detalles</p>
            <table style={{ fontSize: '8.5pt', borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#6b7280', paddingRight: '12px', paddingBottom: '3px' }}>Moneda</td>
                  <td style={{ fontWeight: '600', color: '#111827' }}>{currency}</td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280', paddingRight: '12px', paddingBottom: '3px' }}>Validez</td>
                  <td style={{ fontWeight: '600', color: '#111827' }}>{quotation.validityDays || 30} días</td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280', paddingRight: '12px' }}>Estado</td>
                  <td style={{ fontWeight: '600', color: '#111827' }}>{quotation.status}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Title & Description ── */}
        <div style={{ borderLeft: '3px solid #ea580c', paddingLeft: '12px', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '12pt', fontWeight: '700', margin: '0 0 3px', color: '#111827' }}>{quotation.title}</h2>
          {quotation.description && (
            <p style={{ fontSize: '9pt', color: '#4b5563', margin: '0' }}>{quotation.description}</p>
          )}
        </div>

        {/* ── Introduction / Scope ── */}
        {quotation.introductionText && (
          <div style={{ marginBottom: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '5px', padding: '10px 14px' }}>
            <p style={{ fontSize: '8pt', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Descripción / Alcance</p>
            <p style={{ fontSize: '9pt', color: '#374151', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-wrap' }}>{quotation.introductionText}</p>
          </div>
        )}

        {/* ── Sections ── */}
        {(quotation.sections || []).map((section: any, si: number) => (
          <div key={section.id} style={{ marginBottom: '18px' }}>
            {/* Section header */}
            <div style={{ background: '#1e3a5f', color: '#fff', padding: '6px 12px', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#ea580c', color: '#fff', borderRadius: '3px', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', fontWeight: '800', flexShrink: '0' as const }}>
                {String.fromCharCode(65 + si)}
              </span>
              <h3 style={{ fontSize: '9pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0' }}>
                {section.name}
              </h3>
            </div>
            {section.description && (
              <p style={{ fontSize: '8pt', color: '#6b7280', margin: '4px 0 6px 4px' }}>{section.description}</p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', border: '1px solid #e5e7eb', borderTop: 'none' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: '600', color: '#374151' }}>Descripción</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: '600', color: '#374151', width: '50px' }}>Und.</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#374151', width: '72px' }}>Cant.</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#374151', width: '88px' }}>P. Unit.</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: '600', color: '#374151', width: '88px' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(section.items || []).map((item: any, ii: number) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: ii % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '5px 10px', color: '#111827' }}>{item.description}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>{item.unit}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#374151' }}>{Number(item.quantity).toFixed(2)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#374151' }}>{Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#111827' }}>
                      {Number(item.subtotal ?? Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* ── Totals ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '220px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #e5e7eb', fontSize: '9pt' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span style={{ fontFamily: 'monospace', color: '#111827' }}>{fmt(quotation.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #e5e7eb', fontSize: '9pt' }}>
              <span style={{ color: '#6b7280' }}>IGV ({quotation.igvPercentage ?? 18}%)</span>
              <span style={{ fontFamily: 'monospace', color: '#111827' }}>{fmt(quotation.igv)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: '10.5pt', fontWeight: '800', background: '#1e3a5f', color: '#fff' }}>
              <span>TOTAL</span>
              <span style={{ fontFamily: 'monospace' }}>{fmt(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Terms, Notes, Bank + Signature ── */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {quotation.termsAndConditions && (
              <div>
                <p style={{ fontSize: '7.5pt', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Condiciones Comerciales</p>
                <p style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{quotation.termsAndConditions}</p>
              </div>
            )}
            {companySettings?.notes && (
              <div>
                <p style={{ fontSize: '7.5pt', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Notas Generales</p>
                <p style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{companySettings.notes}</p>
              </div>
            )}
            {companySettings?.bankDetails && (
              <div>
                <p style={{ fontSize: '7.5pt', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Cuentas Bancarias</p>
                <p style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{companySettings.bankDetails}</p>
              </div>
            )}
          </div>

          {companySettings?.signatureUrl && (
            <div style={{ width: '180px', flexShrink: '0' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '4px' }}>
              <img src={companySettings.signatureUrl} alt="Firma" style={{ height: '64px', objectFit: 'contain', marginBottom: '6px' }} />
              <div style={{ width: '100%', borderTop: '1px solid #6b7280', paddingTop: '6px', textAlign: 'center' }}>
                <p style={{ fontSize: '8.5pt', fontWeight: '700', color: '#111827', margin: '0' }}>
                  {companySettings.legalRepresentative || companySettings.name}
                </p>
                {companySettings.legalRepresentativeRole && (
                  <p style={{ fontSize: '7.5pt', color: '#6b7280', margin: '1px 0 0' }}>{companySettings.legalRepresentativeRole}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: '20px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', color: '#9ca3af' }}>
          <span>{companySettings?.name || 'FYM Technologies'} — Cotización</span>
          <span>Generado el {new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>

      {/* ══ Dialogs ══════════════════════════════════════════ */}

      {/* Edit metadata dialog */}
      <Dialog open={editMetaDialog} onOpenChange={setEditMetaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Editar Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="meta-title">Título</Label>
              <Input id="meta-title" value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="meta-desc">Descripción</Label>
              <Input id="meta-desc" value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meta-validity">Validez (días)</Label>
                <Input id="meta-validity" type="number" value={metaForm.validityDays} onChange={e => setMetaForm(f => ({ ...f, validityDays: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="meta-currency">Moneda</Label>
                <Select value={metaForm.currency} onValueChange={v => setMetaForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger id="meta-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN — Sol</SelectItem>
                    <SelectItem value="USD">USD — Dólar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="meta-igv">IGV (%)</Label>
                <Input id="meta-igv" type="number" step="0.1" value={metaForm.igvPercentage || ''} onChange={e => setMetaForm(f => ({ ...f, igvPercentage: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="meta-intro">Texto de Introducción</Label>
              <Textarea id="meta-intro" rows={3} value={metaForm.introductionText} onChange={e => setMetaForm(f => ({ ...f, introductionText: e.target.value }))} placeholder="Descripción general del alcance del trabajo..." />
            </div>
            <div>
              <Label htmlFor="meta-terms">Términos y Condiciones</Label>
              <Textarea id="meta-terms" rows={3} value={metaForm.termsAndConditions} onChange={e => setMetaForm(f => ({ ...f, termsAndConditions: e.target.value }))} placeholder="Condiciones de pago, plazos, garantías..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMetaDialog(false)}>Cancelar</Button>
            <Button onClick={saveMeta}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New section dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Sección</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="sec-name">Nombre</Label>
              <Input id="sec-name" value={sectionForm.name} onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Trabajos de soldadura" />
            </div>
            <div>
              <Label htmlFor="sec-desc">Descripción (opcional)</Label>
              <Input id="sec-desc" value={sectionForm.description} onChange={e => setSectionForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles adicionales" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(false)}>Cancelar</Button>
            <Button onClick={addSection}>Crear Sección</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Ítem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="item-desc">Descripción</Label>
              <Input id="item-desc" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe el trabajo o material" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unidad</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="item-qty">Cantidad</Label>
                <Input id="item-qty" type="number" step="0.01" min="0" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="item-price">Precio Unit.</Label>
                <Input id="item-price" type="number" step="0.01" min="0" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancelar</Button>
            <Button onClick={addItem}>Agregar Ítem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Ítem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-item-desc">Descripción</Label>
              <Input id="edit-item-desc" value={editItemForm.description} onChange={e => setEditItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unidad</Label>
                <Select value={editItemForm.unit} onValueChange={v => setEditItemForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-item-qty">Cantidad</Label>
                <Input id="edit-item-qty" type="number" step="0.01" min="0" value={editItemForm.quantity} onChange={e => setEditItemForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-item-price">Precio Unit.</Label>
                <Input id="edit-item-price" type="number" step="0.01" min="0" value={editItemForm.unitPrice} onChange={e => setEditItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemDialog(false)}>Cancelar</Button>
            <Button onClick={saveEditItem}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
