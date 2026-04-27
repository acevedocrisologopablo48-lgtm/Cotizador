'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { 
  Plus, Search, Edit, Trash2, History, Layers, 
  Package, Filter, ChevronRight, Calculator,
  ArrowUpDown, MoreHorizontal, FileText, CheckCircle2,
  AlertCircle, TrendingUp, Info
} from 'lucide-react';

const SUPPLY_TYPES = [
  { value: 'MATERIAL', label: 'Material' },
  { value: 'EQUIPMENT_RENTAL', label: 'Alquiler de Equipo' },
  { value: 'EQUIPMENT_PURCHASE', label: 'Compra de Equipo' },
  { value: 'LABOR', label: 'Mano de Obra' },
  { value: 'SUBCONTRACT', label: 'Subcontrato' },
];

const UOM_LABELS: Record<string, string> = {
  UND: 'Unidad', M: 'Metro', M2: 'Metro²', M3: 'Metro³',
  KG: 'Kilogramo', GLB: 'Global', HH: 'Horas Hombre',
  DIA: 'Día', MES: 'Mes', ML: 'Metro Lineal', JGO: 'Juego',
};

interface Supply {
  id: string;
  code: string;
  name: string;
  description?: string;
  supplyType: string;
  unitOfMeasure: string;
  baseUnitCost: number;
  currency: string;
  category?: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
  moduleType: string;
  _count?: { supplies: number };
  children?: Category[];
}

export default function PricingPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [form, setForm] = useState({
    code: '', name: '', description: '', supplyType: 'MATERIAL',
    unitOfMeasure: 'UND', baseUnitCost: '', currency: 'PEN',
    categoryId: '', supplierReference: '', priceChangeReason: '',
  });

  const loadSupplies = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setLoadError(null);
      let url = `/supplies?page=${page}&pageSize=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filterType) url += `&supplyType=${filterType}`;
      if (filterCategory) url += `&categoryId=${filterCategory}`;
      const res = await api.get<any>(url, token!);
      setSupplies(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setLoadError(e.message);
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, filterType, filterCategory, addToast]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.get<Category[]>('/categories', token!);
      setCategories(data);
    } catch {}
  }, [token]);

  useEffect(() => { loadSupplies(); loadCategories(); }, [loadSupplies, loadCategories]);

  const openCreate = () => {
    setEditingSupply(null);
    setFormErrors({});
    setForm({ code: '', name: '', description: '', supplyType: 'MATERIAL',
      unitOfMeasure: 'UND', baseUnitCost: '', currency: 'PEN',
      categoryId: '', supplierReference: '', priceChangeReason: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Supply) => {
    setEditingSupply(s);
    setFormErrors({});
    setForm({
      code: s.code, name: s.name, description: s.description || '',
      supplyType: s.supplyType, unitOfMeasure: s.unitOfMeasure,
      baseUnitCost: String(s.baseUnitCost), currency: s.currency,
      categoryId: s.category?.id || '', supplierReference: '',
      priceChangeReason: '',
    });
    setDialogOpen(true);
  };

  const openHistory = async (s: Supply) => {
    try {
      const data = await api.get<any>(`/supplies/${s.id}`, token!);
      setPriceHistory(data.priceHistory || []);
      setHistoryOpen(true);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = 'El código es obligatorio';
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    const cost = parseFloat(form.baseUnitCost);
    if (!form.baseUnitCost || isNaN(cost) || cost < 0) errs.baseUnitCost = 'Ingresa un costo válido (≥ 0)';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});

    try {
      setIsSaving(true);
      const body: any = {
        code: form.code.trim(), name: form.name.trim(), description: form.description || undefined,
        supplyType: form.supplyType, unitOfMeasure: form.unitOfMeasure,
        baseUnitCost: cost, currency: form.currency,
        categoryId: form.categoryId || undefined,
        supplierReference: form.supplierReference || undefined,
      };

      if (editingSupply) {
        if (form.priceChangeReason) body.priceChangeReason = form.priceChangeReason;
        await api.put(`/supplies/${editingSupply.id}`, body, token!);
        addToast('Insumo actualizado', 'success');
      } else {
        await api.post('/supplies', body, token!);
        addToast('Insumo creado', 'success');
      }
      setDialogOpen(false);
      loadSupplies(meta.page);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este insumo?')) return;
    try {
      await api.delete(`/supplies/${id}`, token!);
      addToast('Insumo desactivado', 'success');
      loadSupplies(meta.page);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500 font-jakarta">
      
      {/* ── Header Area ── */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-8 py-8 shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-emerald-500/5 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <Calculator className="h-3 w-3 text-blue-500" />
              <span>Finanzas</span>
              <ChevronRight className="h-3 w-3 opacity-30" />
              <span className="text-white">Matriz de Costos</span>
            </div>
            
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Catálogo de Insumos
              </h1>
              <p className="text-slate-400 text-base max-w-2xl leading-relaxed">
                Gestión centralizada de materiales, equipos y rendimientos operativos.
              </p>
            </div>
          </div>

          <Button 
            onClick={openCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl px-8 h-12 shadow-xl shadow-blue-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Recurso
          </Button>
        </div>
      </div>

      {/* ── Command Center Filters ── */}
      <Card className="overflow-hidden border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-xl rounded-3xl">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-12 items-end">
            <div className="md:col-span-5 space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Búsqueda Técnica</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Código, nombre o descripción..."
                  className="h-12 pl-11 rounded-2xl border-white/20 bg-white/50 dark:bg-slate-950/50 focus:ring-blue-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSupplies(1)}
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tipo de Recurso</Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'ALL' ? '' : v); }}>
                <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/50 dark:bg-slate-950/50">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="ALL">Todos los tipos</SelectItem>
                  {SUPPLY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Categoría</Label>
              <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v === 'ALL' ? '' : v); }}>
                <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/50 dark:bg-slate-950/50">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Button 
                className="w-full h-12 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg" 
                onClick={() => loadSupplies(1)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Supplies Table ── */}
      <Card className="overflow-hidden border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl rounded-3xl">
        <Table>
          <TableHeader className="bg-slate-900">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 pl-8">ID / Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Recurso / Especificación</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Tipo de Insumo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 text-center">Und.</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Costo Base</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Categoría</TableHead>
              <TableHead className="w-[140px] text-right pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={8} columns={7} />
            ) : loadError ? (
              <TableError colSpan={7} message={loadError} onRetry={() => loadSupplies(meta.page)} />
            ) : supplies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-80 text-center">
                  <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                    <div className="h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <Search className="h-10 w-10 opacity-20" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Sin resultados</p>
                      <p className="text-sm font-medium">Ajusta los parámetros de búsqueda o crea un nuevo insumo.</p>
                    </div>
                    <Button onClick={openCreate} variant="outline" className="mt-2 rounded-xl font-bold">
                      Registrar Primer Insumo
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              supplies.map((s) => (
                <TableRow key={s.id} className="group transition-all hover:bg-white/60 dark:hover:bg-white/5 border-white/5">
                  <TableCell className="pl-8 py-5">
                    <span className="font-mono text-[11px] font-black tracking-tighter text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                      {s.code}
                    </span>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{s.name}</span>
                      {s.description && (
                        <span className="text-[11px] text-slate-500 truncate max-w-[320px] font-medium italic opacity-70">{s.description}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        s.supplyType === 'MATERIAL' ? 'bg-orange-500' :
                        s.supplyType === 'LABOR' ? 'bg-blue-500' :
                        s.supplyType === 'EQUIPMENT_RENTAL' ? 'bg-purple-500' : 'bg-slate-400'
                      }`} />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {SUPPLY_TYPES.find(t => t.value === s.supplyType)?.label || s.supplyType}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-5">
                    <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200 dark:border-white/10 bg-white/50 dark:bg-transparent">
                      {s.unitOfMeasure}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-5">
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-black text-slate-400">{s.currency}</span>
                        <span className="font-mono font-black text-base text-slate-900 dark:text-white tabular-nums">
                          {Number(s.baseUnitCost).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter flex items-center gap-1">
                        <TrendingUp className="h-2 w-2" />
                        Costo Operativo
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                      {s.category?.name || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-8 py-5">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => openHistory(s)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        onClick={() => openEdit(s)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {/* ── Pagination ── */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/5 bg-slate-50/50 dark:bg-white/5 px-8 py-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Recursos indexados: <span className="text-slate-900 dark:text-white">{meta.total}</span>
            </span>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => loadSupplies(meta.page - 1)}
                className="h-10 rounded-xl font-bold border-white/10"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/50 dark:bg-white/5 rounded-xl border border-white/10">
                <span className="text-sm font-black text-blue-600">{meta.page}</span>
                <span className="text-xs text-slate-400 font-bold">/</span>
                <span className="text-sm font-bold text-slate-500">{meta.totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => loadSupplies(meta.page + 1)}
                className="h-10 rounded-xl font-bold border-white/10"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Supply Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl font-jakarta">
          <div className="bg-slate-900 px-8 py-10 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-500/20 to-transparent" />
            <DialogHeader className="relative">
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                  {editingSupply ? <Edit className="h-6 w-6 text-orange-400" /> : <Plus className="h-6 w-6 text-blue-400" />}
                </div>
                {editingSupply ? 'Editar Recurso Técnico' : 'Alta de Nuevo Insumo'}
              </DialogTitle>
              <p className="text-slate-400 font-medium text-sm mt-3 leading-relaxed max-w-md">
                Configure los parámetros técnicos y costos base para el catálogo maestro de la organización.
              </p>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Código Maestro *</Label>
                <Input
                  value={form.code}
                  onChange={e => { setForm(f => ({ ...f, code: e.target.value })); setFormErrors(p => ({ ...p, code: '' })); }}
                  placeholder="MAT-X001"
                  className={`h-12 rounded-2xl font-mono font-bold tracking-tight ${formErrors.code ? 'border-red-500 bg-red-50/50' : 'border-slate-200'}`}
                />
                {formErrors.code && <p className="text-[10px] font-black text-red-500 uppercase pl-1">{formErrors.code}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Nombre del Recurso *</Label>
                <Input
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(p => ({ ...p, name: '' })); }}
                  className={`h-12 rounded-2xl font-bold tracking-tight ${formErrors.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'}`}
                  placeholder="Ej: Pintura Epóxica Industrial"
                />
                {formErrors.name && <p className="text-[10px] font-black text-red-500 uppercase pl-1">{formErrors.name}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Especificaciones Técnicas</Label>
              <Textarea 
                className="rounded-2xl border-slate-200 min-h-[100px] text-sm" 
                value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                placeholder="Indique marca, modelo, pureza o cualquier detalle técnico relevante..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Naturaleza del Recurso</Label>
                <Select value={form.supplyType} onValueChange={v => setForm(f => ({ ...f, supplyType: v }))}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {SUPPLY_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="font-medium">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Unidad de Medida</Label>
                <Select value={form.unitOfMeasure} onValueChange={v => setForm(f => ({ ...f, unitOfMeasure: v }))}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {Object.entries(UOM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v} ({k})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 ml-1">Costo Unitario Base *</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.baseUnitCost}
                    onChange={e => { setForm(f => ({ ...f, baseUnitCost: e.target.value })); setFormErrors(p => ({ ...p, baseUnitCost: '' })); }}
                    className={`h-12 rounded-2xl font-mono font-black text-lg pl-14 ${formErrors.baseUnitCost ? 'border-red-500 bg-red-50/50' : 'border-slate-200 bg-white'}`}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 border-r border-slate-200 pr-3">
                    {form.currency}
                  </div>
                </div>
                {formErrors.baseUnitCost && <p className="text-[10px] font-black text-red-500 uppercase pl-1">{formErrors.baseUnitCost}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Divisa Matriz</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-black bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="PEN" className="font-bold">Soles (PEN)</SelectItem>
                    <SelectItem value="USD" className="font-bold">Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Clasificación Operativa</Label>
              <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200"><SelectValue placeholder="Sin categoría definida" /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="" className="italic text-slate-400">Sin categoría específica</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id} className="font-medium">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editingSupply && (
              <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Motivo de la Revalorización
                </Label>
                <Input 
                  className="h-11 rounded-xl border-orange-200 bg-white dark:bg-slate-900 text-sm font-medium" 
                  value={form.priceChangeReason} 
                  onChange={e => setForm(f => ({ ...f, priceChangeReason: e.target.value }))} 
                  placeholder="Ej: Ajuste por inflación, cambio de proveedor principal..." 
                />
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 gap-3">
            <Button variant="ghost" className="rounded-2xl font-bold text-slate-500 h-12 px-6" onClick={() => setDialogOpen(false)}>CANCELAR</Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black h-12 px-10 shadow-xl shadow-slate-200 dark:shadow-none transition-all active:scale-95"
            >
              {isSaving ? 'PROCESANDO...' : editingSupply ? 'GUARDAR ACTUALIZACIÓN' : 'REGISTRAR EN MATRIZ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price History Dialog ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl font-jakarta">
          <div className="bg-blue-600 px-8 py-10 text-white relative">
            <div className="absolute top-0 right-0 w-48 h-full bg-white/10 skew-x-12" />
            <DialogHeader className="relative">
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                  <History className="h-6 w-6 text-white" />
                </div>
                Trazabilidad de Precios
              </DialogTitle>
              <p className="text-blue-100 font-medium text-sm mt-3 opacity-80">
                Historial cronológico de cambios en el costo base del recurso.
              </p>
            </DialogHeader>
          </div>

          <div className="p-0 bg-white dark:bg-slate-950 max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow className="border-none">
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-8 py-4">Fecha de Cambio</TableHead>
                  <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest py-4">Anterior</TableHead>
                  <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest py-4">Nuevo Costo</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Responsable</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest pr-8 py-4">Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic font-medium">
                      <div className="flex flex-col items-center gap-2">
                        <Info className="h-8 w-8 opacity-20" />
                        No se han registrado variaciones de precio aún.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : priceHistory.map((h: any) => (
                  <TableRow key={h.id} className="hover:bg-slate-50/50">
                    <TableCell className="pl-8 py-4 font-bold text-xs text-slate-600">
                      {new Date(h.changedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right py-4 font-mono text-xs text-slate-400 line-through">{Number(h.oldPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right py-4">
                      <span className="font-mono font-black text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        {Number(h.newPrice).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 uppercase">
                          {h.user?.fullName?.slice(0, 2) || 'S'}
                        </div>
                        {h.user?.fullName || 'Sistema'}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 pr-8 text-xs text-slate-500 max-w-[200px] truncate italic">
                      {h.reason || 'Sin observación técnica'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button variant="ghost" className="font-bold text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => setHistoryOpen(false)}>
              CERRAR HISTORIAL
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
