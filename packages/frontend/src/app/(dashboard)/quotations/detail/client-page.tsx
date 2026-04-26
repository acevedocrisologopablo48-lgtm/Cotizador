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
      <div className="hidden print:block text-[10pt] text-gray-900 font-sans">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-gray-700 pb-4 mb-6">
          <div className="flex items-center gap-4">
            {companySettings?.logoUrl && (
              <img src={companySettings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-[16pt] font-bold">{companySettings?.name || 'FYM Technologies'}</h1>
              <p className="text-[9pt] text-gray-500">
                {companySettings?.ruc && `RUC: ${companySettings.ruc} | `}
                {companySettings?.phone && `${companySettings.phone} | `}
                {companySettings?.email}
              </p>
              {companySettings?.address && <p className="text-[9pt] text-gray-500">{companySettings.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[14pt] font-bold">{quotation.quotationNumber}</p>
            <p className="text-[9pt] text-gray-500">
              Fecha: {new Date(quotation.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Client + details */}
        <div className="grid grid-cols-2 gap-8 mb-6 text-[9pt]">
          <div>
            <p className="font-semibold text-gray-500 uppercase text-[8pt] mb-1">Cliente</p>
            <p className="font-bold text-[10pt]">{quotation.company?.businessName || '—'}</p>
            {quotation.company?.ruc && <p>RUC: {quotation.company.ruc}</p>}
            {quotation.contact && <p>Attn: {quotation.contact.firstName} {quotation.contact.lastName}</p>}
          </div>
          <div>
            <p className="font-semibold text-gray-500 uppercase text-[8pt] mb-1">Detalles</p>
            <table className="text-[9pt]">
              <tbody>
                <tr><td className="pr-3 text-gray-500">Moneda</td><td className="font-medium">{currency}</td></tr>
                <tr><td className="pr-3 text-gray-500">Validez</td><td className="font-medium">{quotation.validityDays || 30} días</td></tr>
                <tr><td className="pr-3 text-gray-500">Estado</td><td className="font-medium">{quotation.status}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h2 className="text-[11pt] font-bold">{quotation.title}</h2>
          {quotation.description && <p className="text-[9pt] text-gray-600 mt-1">{quotation.description}</p>}
        </div>

        {/* Introduction */}
        {quotation.introductionText && (
          <div className="mb-5 text-[9pt] text-gray-700">
            <p className="font-semibold mb-1">Descripción / Alcance</p>
            <p className="leading-relaxed">{quotation.introductionText}</p>
          </div>
        )}

        {/* Sections */}
        {(quotation.sections || []).map((section: any, si: number) => (
          <div key={section.id} className="mb-5">
            <div className="bg-gray-100 px-3 py-1.5 mb-1">
              <h3 className="text-[9pt] font-bold text-gray-700 uppercase tracking-wide">
                {String.fromCharCode(65 + si)}. {section.name}
              </h3>
            </div>
            <table className="w-full text-[9pt] border-collapse">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="text-left py-1.5 px-2 font-semibold">Descripción</th>
                  <th className="text-center py-1.5 px-2 font-semibold w-14">Und.</th>
                  <th className="text-right py-1.5 px-2 font-semibold w-20">Cant.</th>
                  <th className="text-right py-1.5 px-2 font-semibold w-24">P. Unit.</th>
                  <th className="text-right py-1.5 px-2 font-semibold w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(section.items || []).map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-1 px-2">{item.description}</td>
                    <td className="py-1 px-2 text-center text-gray-600">{item.unit}</td>
                    <td className="py-1 px-2 text-right font-mono">{Number(item.quantity).toFixed(2)}</td>
                    <td className="py-1 px-2 text-right font-mono">{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-1 px-2 text-right font-mono font-semibold">
                      {Number(item.subtotal ?? Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Totals */}
        <div className="flex justify-end mt-4 mb-6">
          <div className="w-56 border border-gray-200 rounded">
            <div className="flex justify-between px-4 py-2 border-b border-gray-100 text-[9pt]">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">{fmt(quotation.subtotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 border-b border-gray-100 text-[9pt]">
              <span className="text-gray-600">IGV (18%)</span>
              <span className="font-mono">{fmt(quotation.igv)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-[10pt] font-bold bg-gray-50">
              <span>TOTAL</span>
              <span className="font-mono">{fmt(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Terms and Settings */}
        <div className="text-[8pt] text-gray-600 border-t border-gray-200 pt-3 mt-4 space-y-4">
          {quotation.termsAndConditions && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Condiciones Comerciales</p>
              <p className="leading-relaxed whitespace-pre-wrap">{quotation.termsAndConditions}</p>
            </div>
          )}
          {companySettings?.notes && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Notas Generales</p>
              <p className="leading-relaxed whitespace-pre-wrap">{companySettings.notes}</p>
            </div>
          )}
          {companySettings?.bankDetails && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Cuentas Bancarias</p>
              <p className="leading-relaxed whitespace-pre-wrap">{companySettings.bankDetails}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-gray-200 flex justify-between text-[8pt] text-gray-400">
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
