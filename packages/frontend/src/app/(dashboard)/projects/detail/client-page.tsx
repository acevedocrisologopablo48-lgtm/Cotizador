'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  ClipboardList,
  DollarSign,
  PackageCheck,
  Plus,
  Printer,
  Trash2,
  Upload,
  FileText,
  Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { ProjectManagementModule } from './components/ProjectManagementModule';

const MATERIAL_TYPES = [
  { value: 'TOOL', label: 'Herramienta' },
  { value: 'MATERIAL_CIVIL', label: 'Material obra civil' },
  { value: 'ELECTRICAL', label: 'Material electrico' },
  { value: 'CONSUMABLE', label: 'Consumible' },
  { value: 'OTHER', label: 'Otro' },
];

const MATERIAL_STATUSES = [
  { value: 'REQUESTED', label: 'Solicitado' },
  { value: 'REVIEWING', label: 'En revision' },
  { value: 'PURCHASED', label: 'Comprado' },
  { value: 'IN_TRANSIT', label: 'En camino' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'OBSERVED', label: 'Observado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const EXPENSE_CATEGORIES = ['MATERIAL', 'TOOLS', 'TRANSPORT', 'LABOR', 'SERVICES', 'EQUIPMENT', 'OTHER'];
const PROJECT_DOCUMENT_TYPES = [
  { value: 'ORDER', label: 'Orden' },
  { value: 'INVOICE', label: 'Factura' },
  { value: 'REPORT', label: 'Informe' },
  { value: 'GUIDE', label: 'Guia' },
  { value: 'OTHER', label: 'Otro' },
];

export default function ProjectDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useSearchParams();
  const id = idProp ?? params.get('id');
  const router = useRouter();
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'material'; record: any }
    | { type: 'activity'; record: any }
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const isClient = user?.role === 'CLIENT';
  const isSupervisor = user?.role === 'FIELD_SUPERVISOR';
  const canSeeFinancials = !isClient && !isSupervisor;
  const canManageMaterials = !isClient && !isSupervisor;

  const [expenseForm, setExpenseForm] = useState({
    expenseCategory: 'MATERIAL',
    description: '',
    amount: '',
    supplierName: '',
    supplierRuc: '',
    invoiceNumber: '',
    paymentMethod: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  });
  const [documentType, setDocumentType] = useState('ORDER');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    type: 'MATERIAL_CIVIL',
    description: '',
    quantity: '',
    requiredDate: new Date().toISOString().slice(0, 10),
  });
  const [activityForm, setActivityForm] = useState({
    name: '',
    description: '',
    initialLogText: '',
    initialProgressDelta: '',
    photos: [] as string[],
  });
  const activityPhotosInputRef = useRef<HTMLInputElement>(null);
  const logPhotosInputRef = useRef<HTMLInputElement>(null);
  const [logForm, setLogForm] = useState({
    rawText: '',
    progressDelta: '',
    logDate: new Date().toISOString().slice(0, 10),
    photos: [] as string[],
  });

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      const [projectRes, summaryRes, materialsRes, activitiesRes, documentsRes, settingsRes] = await Promise.all([
        api.get<any>(`/projects/${id}`, token),
        canSeeFinancials ? api.get<any>(`/projects/${id}/summary`, token) : Promise.resolve(null),
        canManageMaterials ? api.get<any[]>(`/projects/${id}/materials`, token) : Promise.resolve([]),
        api.get<any[]>(`/projects/${id}/progress/activities`, token),
        isClient ? Promise.resolve([]) : api.get<any[]>(`/projects/${id}/documents`, token),
        api.get<any>('/config/company', token),
      ]);
      setProject(projectRes.data);
      setSummary(summaryRes);
      setMaterials(materialsRes || []);
      setActivities(activitiesRes || []);
      setDocuments(documentsRes || []);
      setCompanySettings(settingsRes || {});
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, canManageMaterials, canSeeFinancials, id, isClient, token]);

  useEffect(() => {
    load();
  }, [load]);

  const expenses = project?.expenses || [];
  const progressAverage = Math.round(
    summary?.progressSummary?.averagePercent ??
      (activities.length
        ? activities.reduce((sum, activity) => sum + Number(activity.progressPercent || 0), 0) / activities.length
        : 0),
  );
  const pendingMaterials = materials.filter((item) => !['DELIVERED', 'CANCELLED'].includes(item.status)).length;

  const canSubmit = Boolean(token && id);

  const addExpense = async () => {
    if (!canSubmit) return;
    if (!expenseForm.description.trim() || Number(expenseForm.amount) <= 0) {
      addToast('Completa descripcion y monto del gasto', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.post(
        `/projects/${id}/expenses`,
        {
          ...expenseForm,
          amount: Number(expenseForm.amount),
          paymentMethod: expenseForm.paymentMethod || 'CASH',
          documentType: 'INVOICE',
          documentNumber: expenseForm.invoiceNumber,
          expenseDate: new Date(expenseForm.expenseDate).toISOString(),
        },
        token!,
      );
      addToast('Gasto registrado', 'success');
      setExpenseOpen(false);
      setExpenseForm((current) => ({ ...current, description: '', amount: '', supplierName: '', supplierRuc: '', invoiceNumber: '', paymentMethod: '' }));
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const extractInvoice = async (file: File | null) => {
    if (!file || !token || !id) return;
    try {
      setSaving(true);
      const imageDataUrl = await fileToDataUrl(file);
      const res = await api.post<any>(`/projects/${id}/expenses/extract-invoice`, { imageDataUrl }, token);
      const extraction = res.extraction || {};
      const notes = Array.isArray(extraction.notes) ? extraction.notes.filter(Boolean).map(String) : [];
      setExpenseForm((current) => ({
        ...current,
        supplierName: extraction.storeName || extraction.supplierName || current.supplierName,
        supplierRuc: extraction.supplierRuc || current.supplierRuc,
        invoiceNumber: extraction.documentNumber || current.invoiceNumber,
        amount: extraction.totalAmount ? String(extraction.totalAmount) : current.amount,
        expenseDate: extraction.issueDate || current.expenseDate,
        paymentMethod: extraction.paymentMethod || current.paymentMethod,
      }));
      addToast(
        res.aiApplied
          ? 'Factura leida con IA. Revisa los campos antes de guardar.'
          : notes[0] || 'No se pudo leer automaticamente; completa manualmente.',
        res.aiApplied ? 'success' : 'info',
      );
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addMaterial = async () => {
    if (!canSubmit) return;
    if (!materialForm.description.trim() || Number(materialForm.quantity) <= 0) {
      addToast('Completa descripcion y cantidad del material', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.post(`/projects/${id}/materials`, { ...materialForm, quantity: Number(materialForm.quantity) }, token!);
      addToast('Solicitud de material creada', 'success');
      setMaterialOpen(false);
      setMaterialForm((current) => ({ ...current, description: '', quantity: '' }));
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const executePendingDelete = async () => {
    if (!pendingDelete || !token || !id) return;
    try {
      setSaving(true);
      if (pendingDelete.type === 'material') {
        await api.delete(`/projects/${id}/materials/${pendingDelete.record.id}`, token);
        addToast('Solicitud eliminada', 'success');
      } else {
        await api.delete(`/projects/${id}/progress/activities/${pendingDelete.record.id}`, token!);
        addToast('Partida eliminada', 'success');
        if (selectedActivity?.id === pendingDelete.record.id) setSelectedActivity(null);
      }
      setPendingDelete(null);
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateMaterialStatus = async (material: any, status: string) => {
    if (!token || !id) return;
    try {
      await api.patch(
        `/projects/${id}/materials/${material.id}`,
        {
          status,
          deliveredAt: status === 'DELIVERED' ? new Date().toISOString() : material.deliveredAt || null,
        },
        token,
      );
      addToast('Estado de material actualizado', 'success');
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const uploadProjectDocument = async (file: File | null) => {
    if (!file || !token || !id) return;
    try {
      setUploadingDocument(true);
      const storagePath = `projects/${id}/documents/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, storagePath);
      const task = uploadBytesResumable(fileRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, () => resolve());
      });
      const url = await getDownloadURL(task.snapshot.ref);
      await api.post(
        `/projects/${id}/documents`,
        {
          type: documentType,
          name: file.name,
          url,
          storagePath,
          mimeType: file.type || null,
          size: file.size,
        },
        token,
      );
      addToast('Archivo guardado en el proyecto', 'success');
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setUploadingDocument(false);
    }
  };

  const deleteProjectDocument = async (document: any) => {
    if (!token || !id) return;
    if (!confirm(`Eliminar archivo ${document.name}?`)) return;
    try {
      if (document.storagePath) {
        await deleteObject(ref(storage, document.storagePath)).catch(() => undefined);
      }
      await api.delete(`/projects/${id}/documents/${document.id}`, token);
      addToast('Archivo eliminado', 'success');
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const addActivity = async () => {
    if (!canSubmit || !activityForm.name.trim()) return;
    const maxPhotos = effectiveMaxPhotos(companySettings);
    const photos = activityForm.photos.slice(0, maxPhotos);
    const wantsFirstLog =
      photos.length > 0 || Boolean(activityForm.initialLogText.trim()) || Boolean(activityForm.initialProgressDelta && Number(activityForm.initialProgressDelta) > 0);
    try {
      setSaving(true);
      const created = await api.post<{ id: string }>(
        `/projects/${id}/progress/activities`,
        { name: activityForm.name, description: activityForm.description },
        token!,
      );
      if (wantsFirstLog) {
        const delta = Math.min(100, Math.max(0, Number(activityForm.initialProgressDelta || 0)));
        const rawText =
          activityForm.initialLogText.trim() ||
          (photos.length > 0 ? 'Registro inicial de obra con fotografías.' : 'Primer registro de avance.');
        await api.post(
          `/projects/${id}/progress/activities/${created.id}/logs`,
          {
            rawText,
            progressDelta: delta,
            logDate: new Date().toISOString(),
            photos,
          },
          token!,
        );
      }
      addToast('Partida creada', 'success');
      setActivityOpen(false);
      setActivityForm({
        name: '',
        description: '',
        initialLogText: '',
        initialProgressDelta: '',
        photos: [],
      });
      if (activityPhotosInputRef.current) activityPhotosInputRef.current.value = '';
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addDailyLog = async () => {
    if (!canSubmit || !selectedActivity) return;
    if (!logForm.rawText.trim()) {
      addToast('Describe brevemente el trabajo realizado', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.post(
        `/projects/${id}/progress/activities/${selectedActivity.id}/logs`,
        {
          rawText: logForm.rawText,
          progressDelta: Number(logForm.progressDelta || 0),
          logDate: new Date(logForm.logDate).toISOString(),
          photos: logForm.photos,
        },
        token!,
      );
      addToast('Registro diario guardado', 'success');
      setSelectedActivity(null);
      setLogForm({ rawText: '', progressDelta: '', logDate: new Date().toISOString().slice(0, 10), photos: [] });
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    if (!token || !id) return;
    try {
      const report = await api.get<any>(`/projects/${id}/progress/report`, token);
      const popup = window.open('', '_blank');
      if (!popup) {
        addToast('Permite ventanas emergentes para ver el informe', 'error');
        return;
      }
      popup.document.write(renderProgressReport(report));
      popup.document.close();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  const openLogDialog = (activity: any) => {
    setSelectedActivity(activity);
    setLogForm({ rawText: '', progressDelta: '', logDate: new Date().toISOString().slice(0, 10), photos: [] });
  };

  const projectClient = useMemo(() => {
    if (!project) return '';
    return project.company?.tradeName || project.company?.businessName || (project.isInternal ? 'FYM Technologies' : 'Sin cliente asociado');
  }, [project]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-500">Cargando proyecto...</div>;
  }

  if (!project) {
    return <div className="py-12 text-center text-sm text-slate-500">Proyecto no encontrado</div>;
  }

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/projects')} className="h-10 w-10 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-sm font-black text-white">{project.projectCode}</span>
              <StatusBadge status={project.status} />
              {project.isInternal && <Badge className="rounded-md bg-indigo-600">Proyecto Z</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">{project.name}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{projectClient}</p>
            {isClient && (
              <p className="mt-2 inline-flex rounded-md border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary">
                Vista limitada de cliente
              </p>
            )}
            {project.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{project.description}</p>}
          </div>
        </div>

        <Button onClick={generateReport} className="self-start">
          <Printer className="mr-2 h-4 w-4" />
          Generar informe
        </Button>
      </section>

      {canSeeFinancials ? <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Costos ejecutados" value={currency(summary?.totalSpent || 0)} hint={`${Math.round(summary?.percentUsed || 0)}% del presupuesto`} icon={DollarSign} />
        <MetricCard label="Materiales pendientes" value={pendingMaterials} hint={summary?.materialAlert?.level || 'GREEN'} icon={PackageCheck} />
        <MetricCard label="Avance promedio" value={`${progressAverage}%`} hint={`${summary?.progressSummary?.activities || 0} partidas`} icon={ClipboardList} />
      </section> : !isClient ? <section className="grid gap-4 md:grid-cols-2">
        <MetricCard label="Facturas registradas" value={project._count?.expenses || 0} hint="Sin costo total" icon={DollarSign} />
        <MetricCard label="Avance promedio" value={`${progressAverage}%`} hint={`${activities.length} partidas`} icon={ClipboardList} />
      </section> : null}

      <Tabs defaultValue="progress" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-lg border border-slate-200 bg-white p-1">
          <TabsTrigger value="progress" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">
            <ClipboardList className="mr-2 h-4 w-4" />
            Avances
          </TabsTrigger>
          {canManageMaterials && <TabsTrigger value="materials" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">
            <PackageCheck className="mr-2 h-4 w-4" />
            Lista de materiales
          </TabsTrigger>}
          {!isClient && <TabsTrigger value="costs" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">
            <DollarSign className="mr-2 h-4 w-4" />
            {isSupervisor ? 'Facturas' : 'Costos'}
          </TabsTrigger>}
          {!isClient && <TabsTrigger value="documents" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileText className="mr-2 h-4 w-4" />
            Archivos
          </TabsTrigger>}
          {!isClient && <TabsTrigger value="tasks" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">
            <ClipboardList className="mr-2 h-4 w-4" />
            Tareas
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="progress" className="mt-0">
          <Card className="rounded-lg border-slate-200">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Cuaderno de obras digital</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Partidas, fotos diarias, texto mejorado con IA y porcentaje acumulado.</p>
              </div>
              {!isClient && <Button onClick={() => setActivityOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva partida
              </Button>}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                {activities.length === 0 ? (
                  <EmptyState text="Aun no hay partidas registradas." />
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      role={isClient ? undefined : 'button'}
                      tabIndex={isClient ? undefined : 0}
                      onClick={() => !isClient && openLogDialog(activity)}
                      onKeyDown={(e) => {
                        if (isClient) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openLogDialog(activity);
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-slate-900">{activity.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{activity.description || 'Sin descripcion'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!isClient && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-slate-400 hover:text-destructive"
                              title="Eliminar partida"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'activity', record: activity });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <span className="font-mono text-xl font-black text-primary">{Math.round(activity.progressPercent || 0)}%</span>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, activity.progressPercent || 0)}%` }} />
                      </div>
                      <div className="mt-4 space-y-2">
                        {(activity.logs || []).slice(0, 2).map((log: any) => (
                          <div key={log.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                            <p className="font-bold text-slate-800">{formatDate(log.logDate)} · +{log.progressDelta}%</p>
                            <p className="mt-1 line-clamp-2">{log.improvedText}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-0">
          <Card className="rounded-lg border-slate-200">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Lista dinamica de materiales</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Solicitud de campo, seguimiento logistico, fecha limite y entrega real.</p>
              </div>
              <Button onClick={() => setMaterialOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Solicitar material
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Fecha limite</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Entrega real</TableHead>
                    <TableHead className="w-[52px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><EmptyState text="No hay solicitudes de materiales." /></TableCell></TableRow>
                  ) : materials.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-black">{item.itemNumber}</TableCell>
                      <TableCell>{typeLabel(item.type)}</TableCell>
                      <TableCell className="font-semibold">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell><UrgencyBadge item={item} /> {formatDate(item.requiredDate)}</TableCell>
                      <TableCell>
                        <Select value={item.status} onValueChange={(value) => updateMaterialStatus(item, value)}>
                          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MATERIAL_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{item.deliveredAt ? formatDate(item.deliveredAt) : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-destructive"
                          title="Eliminar solicitud"
                          onClick={() => setPendingDelete({ type: 'material', record: item })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-0">
          <Card className="rounded-lg border-slate-200">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{isSupervisor ? 'Facturas del proyecto' : 'Costos y facturacion'}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {isSupervisor
                    ? 'Carga de evidencias y lectura IA de comprobantes, sin acceso al costo total del proyecto.'
                    : 'Gastos del proyecto, OCR de factura y alimentacion de base historica de precios.'}
                </p>
              </div>
              <Button onClick={() => setExpenseOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar gasto
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    {!isSupervisor && <TableHead className="text-right">Monto</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={isSupervisor ? 6 : 7}><EmptyState text="Aun no hay gastos registrados." /></TableCell></TableRow>
                  ) : expenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono font-black">{project.projectCode}</TableCell>
                      <TableCell className="font-semibold">{expense.description}</TableCell>
                      <TableCell>{expense.supplierName || '-'}</TableCell>
                      <TableCell>{expense.supplierRuc || '-'}</TableCell>
                      <TableCell>{expense.invoiceNumber || expense.documentNumber || '-'}</TableCell>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      {!isSupervisor && <TableCell className="text-right font-mono font-black">{currency(expense.amount || 0)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <Card className="rounded-lg border-slate-200">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Archivos del proyecto</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Ordenes, facturas, informes, guias y otros documentos operativos.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_DOCUMENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90">
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingDocument ? 'Subiendo...' : 'Subir archivo'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingDocument}
                    accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => {
                      void uploadProjectDocument(event.target.files?.[0] || null);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[96px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow><TableCell colSpan={4}><EmptyState text="Aun no hay archivos cargados." /></TableCell></TableRow>
                  ) : documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="font-bold">{PROJECT_DOCUMENT_TYPES.find(t => t.value === document.type)?.label || document.type}</TableCell>
                      <TableCell>
                        <a href={document.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{document.name}</a>
                        <p className="text-xs text-slate-500">{document.mimeType || 'Archivo'} · {Math.round((document.size || 0) / 1024)} KB</p>
                      </TableCell>
                      <TableCell>{formatDate(document.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <a href={document.url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => deleteProjectDocument(document)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {!isClient && (
          <TabsContent value="tasks" className="mt-0">
            <Card className="rounded-lg border-slate-200">
              <CardHeader>
                <CardTitle>Gestion de tareas del proyecto</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Asignacion de responsables, tablero Kanban, cronograma e historial de actividad.</p>
              </CardHeader>
              <CardContent>
                <ProjectManagementModule projectId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar gasto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Categoria">
              <Select value={expenseForm.expenseCategory} onValueChange={(value) => setExpenseForm((current) => ({ ...current, expenseCategory: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Fecha">
              <Input type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            </Field>
            <Field label="Descripcion del pago">
              <Input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="Cemento y transporte" />
            </Field>
            <Field label="Monto">
              <Input type="number" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} />
            </Field>
            <Field label="Tienda / proveedor">
              <Input value={expenseForm.supplierName} onChange={(event) => setExpenseForm((current) => ({ ...current, supplierName: event.target.value }))} />
            </Field>
            <Field label="RUC">
              <Input value={expenseForm.supplierRuc} onChange={(event) => setExpenseForm((current) => ({ ...current, supplierRuc: event.target.value }))} />
            </Field>
            <Field label="Numero de factura">
              <Input value={expenseForm.invoiceNumber} onChange={(event) => setExpenseForm((current) => ({ ...current, invoiceNumber: event.target.value }))} />
            </Field>
            <Field label="Modo de pago">
              <Input value={expenseForm.paymentMethod} onChange={(event) => setExpenseForm((current) => ({ ...current, paymentMethod: event.target.value }))} placeholder="Efectivo, transferencia, tarjeta..." />
            </Field>
            <Field label="Foto de factura">
              <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <Upload className="mr-2 h-4 w-4" />
                Leer con IA
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={saving}
                  onChange={(event) => {
                    void extractInvoice(event.target.files?.[0] || null);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={addExpense} disabled={saving}>Guardar gasto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar material</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Tipo">
              <Select value={materialForm.type} onValueChange={(value) => setMaterialForm((current) => ({ ...current, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIAL_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Descripcion / marca / modelo">
              <Input value={materialForm.description} onChange={(event) => setMaterialForm((current) => ({ ...current, description: event.target.value }))} placeholder="Cemento Sol" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cantidad">
                <Input type="number" value={materialForm.quantity} onChange={(event) => setMaterialForm((current) => ({ ...current, quantity: event.target.value }))} />
              </Field>
              <Field label="Fecha limite">
                <Input type="date" value={materialForm.requiredDate} onChange={(event) => setMaterialForm((current) => ({ ...current, requiredDate: event.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialOpen(false)}>Cancelar</Button>
            <Button onClick={addMaterial} disabled={saving}>Crear solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Nueva partida</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Actividad / partida">
              <Input value={activityForm.name} onChange={(event) => setActivityForm((current) => ({ ...current, name: event.target.value }))} placeholder="Demolicion de losetas" />
            </Field>
            <Field label="Descripcion">
              <Textarea value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} placeholder="Alcance tecnico de la partida" />
            </Field>
            <Field label="Primer registro en obra (opcional)">
              <Textarea
                value={activityForm.initialLogText}
                onChange={(event) => setActivityForm((current) => ({ ...current, initialLogText: event.target.value }))}
                placeholder="Describe el trabajo del día; si solo subes fotos, se guardará un texto breve automático."
                rows={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Avance inicial (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={activityForm.initialProgressDelta}
                  onChange={(event) => setActivityForm((current) => ({ ...current, initialProgressDelta: event.target.value }))}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label={`Fotos del primer registro (máx. ${effectiveMaxPhotos(companySettings)})`}>
              <input
                ref={activityPhotosInputRef}
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={async (event) => {
                  const maxAllowed = effectiveMaxPhotos(companySettings);
                  const picked = event.target.files ? Array.from(event.target.files) : [];
                  const files = picked.slice(0, maxAllowed);
                  if (picked.length > maxAllowed) {
                    addToast(`Solo se permiten hasta ${maxAllowed} fotos por avance.`, 'info');
                  }
                  const photos = await filesToDataUrls(files);
                  setActivityForm((current) => ({ ...current, photos }));
                }}
              />
              <Button type="button" variant="outline" className="w-full min-h-24 flex-col gap-2 border-dashed" onClick={() => activityPhotosInputRef.current?.click()}>
                <Camera className="h-5 w-5" />
                Elegir fotografías
              </Button>
            </Field>
            {activityForm.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {activityForm.photos.map((photo, index) => (
                  <img key={index} src={photo} alt="" className="h-20 w-full rounded-md object-cover" />
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityOpen(false)}>Cancelar</Button>
            <Button onClick={addActivity} disabled={saving}>Crear partida</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Registro diario: {selectedActivity?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <Input type="date" value={logForm.logDate} onChange={(event) => setLogForm((current) => ({ ...current, logDate: event.target.value }))} />
              </Field>
              <Field label="Avance del dia (%)">
                <Input type="number" min="0" max="100" value={logForm.progressDelta} onChange={(event) => setLogForm((current) => ({ ...current, progressDelta: event.target.value }))} />
              </Field>
            </div>
            <Field label="Texto rapido del supervisor">
              <Textarea value={logForm.rawText} onChange={(event) => setLogForm((current) => ({ ...current, rawText: event.target.value }))} placeholder="Se avanzo con tuberias empotradas en tramo principal..." />
            </Field>
            <Field label={`Fotos del día (máx. ${effectiveMaxPhotos(companySettings)})`}>
              <input
                ref={logPhotosInputRef}
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={async (event) => {
                  const maxAllowed = effectiveMaxPhotos(companySettings);
                  const picked = event.target.files ? Array.from(event.target.files) : [];
                  const files = picked.slice(0, maxAllowed);
                  if (picked.length > maxAllowed) {
                    addToast(`Solo se permiten hasta ${maxAllowed} fotos por avance.`, 'info');
                  }
                  const photos = await filesToDataUrls(files);
                  setLogForm((current) => ({ ...current, photos }));
                }}
              />
              <Button type="button" variant="outline" className="w-full min-h-24 flex-col gap-2 border-dashed" onClick={() => logPhotosInputRef.current?.click()}>
                <Camera className="h-5 w-5" />
                Elegir fotografías
              </Button>
            </Field>
            {logForm.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {logForm.photos.map((photo, index) => <img key={index} src={photo} alt="" className="h-20 w-full rounded-md object-cover" />)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedActivity(null)}>Cancelar</Button>
            <Button onClick={addDailyLog} disabled={saving}>Guardar avance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingDelete?.type === 'material' ? 'Eliminar solicitud de material' : 'Eliminar partida'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1 text-left text-sm text-slate-600">
                {pendingDelete?.type === 'material' ? (
                  <>
                    <p>¿Seguro que deseas eliminar esta solicitud? Esta acción no se puede deshacer.</p>
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900">
                      {pendingDelete.record.description || 'Sin descripción'}
                    </p>
                  </>
                ) : pendingDelete?.type === 'activity' ? (
                  <p>
                    Se eliminará la partida{' '}
                    <span className="font-black text-slate-900">{pendingDelete.record.name}</span> y todos los registros
                    diarios asociados. Esta acción no se puede deshacer.
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void executePendingDelete()} disabled={saving}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: any }) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          <p className="text-xs font-semibold text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">{text}</div>;
}

function UrgencyBadge({ item }: { item: any }) {
  if (item.urgency === 'RED') return <Badge variant="destructive" className="mr-2 rounded-md">Vencido</Badge>;
  if (item.urgency === 'YELLOW') return <Badge variant="warning" className="mr-2 rounded-md">Urgente</Badge>;
  return <Badge variant="success" className="mr-2 rounded-md">OK</Badge>;
}

function typeLabel(value: string) {
  return MATERIAL_TYPES.find((type) => type.value === value)?.label || value;
}

function currency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-PE');
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function effectiveMaxPhotos(settings: { maxPhotosPerProgress?: number } | null | undefined) {
  const n = Number(settings?.maxPhotosPerProgress);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

async function filesToDataUrls(files: FileList | File[] | null | undefined) {
  if (!files) return [];
  const list = Array.isArray(files) ? files : Array.from(files);
  return Promise.all(list.slice(0, 12).map(fileToDataUrl));
}

function renderProgressReport(report: any) {
  const project = report.project || {};
  const rows = (report.point2ProgressSummary || [])
    .map((item: any) => `<tr><td>${escapeHtml(item.name)}</td><td>${Math.round(item.progressPercent || 0)}%</td><td>${escapeHtml(item.status || '')}</td></tr>`)
    .join('');
  const activities = (report.activities || [])
    .map((activity: any) => {
      const logs = (activity.logs || [])
        .map((log: any) => {
          const photos = (log.photos || []).map((photo: string) => `<img src="${photo}" />`).join('');
          return `<article><h4>${formatDate(log.logDate)} · +${log.progressDelta || 0}%</h4><p>${escapeHtml(log.improvedText || log.rawText || '')}</p><div class="photos">${photos}</div></article>`;
        })
        .join('');
      return `<section><h3>${escapeHtml(activity.name)} <span>${Math.round(activity.progressPercent || 0)}%</span></h3>${logs || '<p>Sin registros en el periodo.</p>'}</section>`;
    })
    .join('');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Informe de avances - ${escapeHtml(project.projectCode || '')}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
        main{max-width:960px;margin:0 auto;background:white;min-height:100vh;padding:44px}
        header{border-bottom:4px solid #0f172a;padding-bottom:24px;margin-bottom:28px}
        h1{font-size:28px;margin:0 0 8px;font-weight:900}
        h2{font-size:18px;margin:30px 0 12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px}
        h3{display:flex;justify-content:space-between;font-size:16px;margin:22px 0 10px}
        h4{margin:0 0 6px;font-size:13px;color:#334155}
        p{line-height:1.55;color:#475569}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #e2e8f0;padding:10px;text-align:left;font-size:13px}
        th{background:#f1f5f9;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
        article{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:10px 0}
        .photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
        img{width:100%;height:150px;object-fit:cover;border-radius:6px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;color:#64748b;font-size:13px}
        @media print{body{background:white}main{padding:24px}.no-print{display:none}}
      </style>
    </head>
    <body>
      <main>
        <button class="no-print" onclick="window.print()">Imprimir / guardar PDF</button>
        <header>
          <h1>Informe de Avances</h1>
          <div class="meta">
            <div><strong>Proyecto:</strong> ${escapeHtml(project.projectCode || '')} - ${escapeHtml(project.name || '')}</div>
            <div><strong>Cliente:</strong> ${escapeHtml(project.company?.tradeName || project.company?.businessName || 'FYM Technologies')}</div>
            <div><strong>Fecha de emision:</strong> ${formatDate(report.generatedAt)}</div>
            <div><strong>Estado:</strong> ${escapeHtml(project.status || '')}</div>
          </div>
        </header>
        <h2>1. Actividades desarrolladas</h2>
        ${activities || '<p>No hay actividades registradas.</p>'}
        <h2>2. Resumen de porcentajes de avance</h2>
        <table><thead><tr><th>Partida</th><th>Avance acumulado</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>
      </main>
    </body>
  </html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
