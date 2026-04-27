'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Upload, FileSpreadsheet, Download, X as XIcon,
  ChevronRight, Calendar, User, Building2, Layers,
  ExternalLink, Copy, CheckCircle2, AlertCircle, Clock,
  FileCheck
} from 'lucide-react';

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
                <div className="flex items-center gap-2.5 text-sm text-slate-300 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                  <Building2 className="h-4 w-4 text-orange-400" />
                  <span className="font-semibold">{quotation.client?.name || 'Carga Directa'}</span>
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
              <div className="flex items-center gap-3 self-end">
                <Button 
                  onClick={handlePrint} 
                  className="bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl px-6 shadow-xl shadow-white/5 transition-all active:scale-95"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Generar PDF
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
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Package className="h-5 w-5 text-orange-500" />
                Desglose de Conceptos
              </h2>
              {canEdit && (
                <Button 
                  onClick={() => setSectionDialog(true)} 
                  variant="outline" 
                  className="rounded-2xl font-bold border-white/20 bg-white/5 backdrop-blur hover:bg-white/10"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir Sección
                </Button>
              )}
            </div>

            {(quotation.sections || []).length === 0 && (
              <div className="bg-white/5 rounded-3xl border-2 border-dashed border-white/10 p-16 text-center space-y-4">
                <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Plus className="h-8 w-8 text-muted-foreground opacity-20" />
                </div>
                <p className="text-muted-foreground font-medium italic">No hay secciones definidas en esta cotización.</p>
                <Button onClick={() => setSectionDialog(true)} variant="link" className="text-orange-500 font-bold">
                  Comienza agregando tu primera sección
                </Button>
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
                        <TableRow key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 border-white/5">
                          <TableCell className="font-medium pl-6 text-sm py-4">
                            {item.description}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground font-mono text-xs">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{Number(item.quantity).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-500">{Number(item.unitPrice).toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              {Number(item.subtotal ?? Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
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
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
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
                
                <div className="space-y-2 pt-2">
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
                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Total Propuesta</span>
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

      {/* ══ Print view (PDF Layout) ═══════════════════════════ */}
      <div className="hidden print:block font-sans bg-white text-black p-0 min-h-screen">
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '3px solid #1e3a5f', paddingBottom: '20px' }}>
          <div>
            {companySettings?.logoUrl && (
              <img src={companySettings.logoUrl} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '12px' }} />
            )}
            <h2 style={{ fontSize: '18pt', fontWeight: '900', color: '#1e3a5f', margin: '0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{companySettings?.name || 'FYM TECHNOLOGIES'}</h2>
            <p style={{ fontSize: '9pt', color: '#6b7280', margin: '2px 0 0' }}>RUC: {companySettings?.ruc || 'XXXXXXXXXXX'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#1e3a5f', color: 'white', padding: '10px 20px', borderRadius: '4px', marginBottom: '8px' }}>
              <p style={{ fontSize: '8pt', fontWeight: '700', margin: '0', textTransform: 'uppercase', opacity: '0.8' }}>Cotización N°</p>
              <p style={{ fontSize: '14pt', fontWeight: '900', margin: '0' }}>{quotation.code || `COT-${id?.slice(0, 5).toUpperCase()}`}</p>
            </div>
            <p style={{ fontSize: '9pt', color: '#111827', margin: '0', fontWeight: '700' }}>Fecha: {new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p style={{ fontSize: '9pt', color: '#6b7280', margin: '2px 0 0' }}>Validez: {quotation.validityDays || 30} días</p>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '32px' }}>
          <div>
            <h4 style={{ fontSize: '8pt', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px', borderBottom: '1px solid #fed7aa', paddingBottom: '4px' }}>Información del Cliente</h4>
            <p style={{ fontSize: '10pt', fontWeight: '800', color: '#111827', margin: '0 0 2px' }}>{quotation.client?.name || 'Venta Directa'}</p>
            <p style={{ fontSize: '9pt', color: '#374151', margin: '0' }}>{quotation.client?.contactName || 'Responsable de Logística'}</p>
            <p style={{ fontSize: '9pt', color: '#6b7280', margin: '2px 0 0' }}>{quotation.client?.email || ''}</p>
          </div>
          <div>
            <h4 style={{ fontSize: '8pt', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px', borderBottom: '1px solid #fed7aa', paddingBottom: '4px' }}>Referencia / Proyecto</h4>
            <p style={{ fontSize: '10pt', fontWeight: '800', color: '#111827', margin: '0 0 2px' }}>{quotation.title || 'Propuesta Comercial'}</p>
            <p style={{ fontSize: '9pt', color: '#374151', margin: '0', lineHeight: '1.4' }}>{quotation.description || 'Suministro y servicios según requerimiento.'}</p>
          </div>
        </div>

        {/* Introduction */}
        {quotation.introductionText && (
          <div style={{ marginBottom: '32px', padding: '14px', background: '#f8fafc', borderLeft: '4px solid #1e3a5f', borderRadius: '0 4px 4px 0' }}>
            <p style={{ fontSize: '9.5pt', color: '#1e293b', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{quotation.introductionText}</p>
          </div>
        )}

        {/* Sections & Items */}
        {(quotation.sections || []).map((section: any) => (
          <div key={section.id} style={{ marginBottom: '28px', breakInside: 'avoid' }}>
            <div style={{ background: '#1e3a5f', color: 'white', padding: '6px 14px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.name}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #1e3a5f' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', color: '#1e3a5f' }}>Descripción</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px', fontWeight: '800', color: '#1e3a5f' }}>Und.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', width: '80px', fontWeight: '800', color: '#1e3a5f' }}>Cant.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', width: '90px', fontWeight: '800', color: '#1e3a5f' }}>P. Unit</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', width: '100px', fontWeight: '800', color: '#1e3a5f' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(section.items || []).map((item: any, ii: number) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: ii % 2 === 0 ? '#ffffff' : '#fcfcfc' }}>
                    <td style={{ padding: '8px 14px', color: '#1e293b', lineHeight: '1.4' }}>{item.description}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{item.unit}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1e293b' }}>{Number(item.quantity).toFixed(2)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1e293b' }}>{Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#111827' }}>
                      {Number(item.subtotal ?? Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Totals Section */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px', breakInside: 'avoid' }}>
          <div style={{ width: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: '600' }}>SUBTOTAL</span>
              <span style={{ fontSize: '9pt', fontFamily: 'monospace', fontWeight: '700' }}>{fmt(quotation.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: '600' }}>IGV ({quotation.igvPercentage ?? 18}%)</span>
              <span style={{ fontSize: '9pt', fontFamily: 'monospace', fontWeight: '700' }}>{fmt(quotation.igv)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#1e3a5f', color: 'white', borderRadius: '0 0 4px 4px shadow-lg' }}>
              <span style={{ fontSize: '11pt', fontWeight: '900', letterSpacing: '0.05em' }}>TOTAL</span>
              <span style={{ fontSize: '11pt', fontFamily: 'monospace', fontWeight: '900' }}>{fmt(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Bank Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px', borderTop: '2px solid #f1f5f9', paddingTop: '24px', breakInside: 'avoid' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {quotation.termsAndConditions && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ fontSize: '8pt', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', margin: '0 0 6px' }}>Términos y Condiciones</h5>
                <p style={{ fontSize: '8.5pt', color: '#475569', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{quotation.termsAndConditions}</p>
              </div>
            )}
            {companySettings?.bankDetails && (
              <div>
                <h5 style={{ fontSize: '8pt', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', margin: '0 0 6px' }}>Información de Pago</h5>
                <p style={{ fontSize: '8.5pt', color: '#475569', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' }}>{companySettings.bankDetails}</p>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '10px' }}>
            {companySettings?.signatureUrl && (
              <img src={companySettings.signatureUrl} alt="Firma" style={{ height: '80px', objectFit: 'contain', marginBottom: '10px' }} />
            )}
            <div style={{ width: '100%', borderTop: '1px solid #94a3b8', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '9pt', fontWeight: '800', color: '#1e293b', margin: '0' }}>{companySettings?.legalRepresentative || companySettings?.name}</p>
              <p style={{ fontSize: '8pt', color: '#64748b', margin: '2px 0 0' }}>{companySettings?.legalRepresentativeRole || 'Representante Legal'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'fixed', bottom: '20px', left: '0', right: '0', borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: '#94a3b8', paddingLeft: '40px', paddingRight: '40px' }}>
          <span>{companySettings?.address || 'Lima, Perú'} — {companySettings?.phone || ''} — {companySettings?.website || ''}</span>
          <span>Página 1 de 1</span>
        </div>
      </div>

      {/* ══ Dialogs ══════════════════════════════════════════ */}

      {/* Edit metadata dialog */}
      <Dialog open={editMetaDialog} onOpenChange={setEditMetaDialog}>
        <DialogContent className="max-w-2xl overflow-hidden p-0 border-none shadow-2xl font-jakarta">
          <DialogHeader className="p-6 bg-slate-900 text-white border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Pencil className="h-6 w-6 text-orange-500" />
              Parámetros de la Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="meta-title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Título del Proyecto/Servicio</Label>
                <Input id="meta-title" className="h-11 rounded-xl border-slate-200 focus:ring-orange-500/20 focus:border-orange-500" value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-desc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Resumen Operativo</Label>
                <Input id="meta-desc" className="h-11 rounded-xl border-slate-200 focus:ring-orange-500/20 focus:border-orange-500" value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-validity" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Validez (días)</Label>
                  <Input id="meta-validity" type="number" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.validityDays} onChange={e => setMetaForm(f => ({ ...f, validityDays: e.target.value }))} />
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
                  <Label htmlFor="meta-igv" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">IGV (%)</Label>
                  <Input id="meta-igv" type="number" step="0.1" className="h-11 rounded-xl border-slate-200 font-mono" value={metaForm.igvPercentage || ''} onChange={e => setMetaForm(f => ({ ...f, igvPercentage: e.target.value }))} />
                </div>
              </div>
            </div>
            
            <div className="space-y-5 pt-2">
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
          <DialogFooter className="p-6 bg-slate-50 dark:bg-white/5 border-t border-white/10">
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
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-lg font-jakarta">
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
                <Input id="item-price" type="number" step="0.01" min="0" className="h-11 rounded-xl font-mono" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setItemDialog(false)}>Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-orange-500/20" onClick={addItem}>Registrar Ítem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
        <DialogContent className="p-0 border-none shadow-2xl overflow-hidden max-w-lg font-jakarta">
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
                <Input id="edit-item-price" type="number" step="0.01" min="0" className="h-11 rounded-xl font-mono" value={editItemForm.unitPrice} onChange={e => setEditItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setEditItemDialog(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 rounded-xl shadow-lg shadow-blue-500/20" onClick={saveEditItem}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
