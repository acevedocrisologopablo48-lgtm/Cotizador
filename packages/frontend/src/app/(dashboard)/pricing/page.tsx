'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import { Plus, Search, Edit, Trash2, History } from 'lucide-react';

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
    // Client-side validation
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Matriz de Costos</h1>
          <p className="text-muted-foreground">Gestión de insumos, materiales y rendimientos</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo Insumo</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, nombre..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSupplies(1)}
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'ALL' ? '' : v); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {SUPPLY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v === 'ALL' ? '' : v); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => loadSupplies(1)}>Filtrar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : loadError ? (
                <TableError colSpan={7} message={loadError} onRetry={() => loadSupplies(meta.page)} />
              ) : supplies.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay insumos registrados</TableCell></TableRow>
              ) : (
                supplies.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.code}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{SUPPLY_TYPES.find(t => t.value === s.supplyType)?.label || s.supplyType}</Badge></TableCell>
                    <TableCell>{UOM_LABELS[s.unitOfMeasure] || s.unitOfMeasure}</TableCell>
                    <TableCell className="text-right font-mono">{s.currency} {Number(s.baseUnitCost).toFixed(2)}</TableCell>
                    <TableCell>{s.category?.name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openHistory(s)}><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{meta.total} insumos</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => loadSupplies(meta.page - 1)}>Anterior</Button>
                <span className="flex items-center text-sm">Página {meta.page} de {meta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => loadSupplies(meta.page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supply Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupply ? 'Editar Insumo' : 'Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={e => { setForm(f => ({ ...f, code: e.target.value })); setFormErrors(p => ({ ...p, code: '' })); }}
                  placeholder="MAT-001"
                  className={formErrors.code ? 'border-destructive' : ''}
                />
                {formErrors.code && <p className="mt-1 text-xs text-destructive">{formErrors.code}</p>}
              </div>
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(p => ({ ...p, name: '' })); }}
                  className={formErrors.name ? 'border-destructive' : ''}
                />
                {formErrors.name && <p className="mt-1 text-xs text-destructive">{formErrors.name}</p>}
              </div>
            </div>
            <div><Label>Descripción</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.supplyType} onValueChange={v => setForm(f => ({ ...f, supplyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPLY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select value={form.unitOfMeasure} onValueChange={v => setForm(f => ({ ...f, unitOfMeasure: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(UOM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Costo Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.baseUnitCost}
                  onChange={e => { setForm(f => ({ ...f, baseUnitCost: e.target.value })); setFormErrors(p => ({ ...p, baseUnitCost: '' })); }}
                  className={formErrors.baseUnitCost ? 'border-destructive' : ''}
                />
                {formErrors.baseUnitCost && <p className="mt-1 text-xs text-destructive">{formErrors.baseUnitCost}</p>}
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PEN">PEN (S/)</SelectItem><SelectItem value="USD">USD ($)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editingSupply && (
              <div><Label>Razón del cambio de precio</Label><Input value={form.priceChangeReason} onChange={e => setForm(f => ({ ...f, priceChangeReason: e.target.value }))} placeholder="Actualización de proveedor..." /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingSupply ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Historial de Precios</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Nuevo</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Razón</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceHistory.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Sin cambios registrados</TableCell></TableRow>
              ) : priceHistory.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.changedAt).toLocaleDateString('es-PE')}</TableCell>
                  <TableCell className="text-right font-mono">{Number(h.oldPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(h.newPrice).toFixed(2)}</TableCell>
                  <TableCell>{h.user?.fullName || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{h.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
