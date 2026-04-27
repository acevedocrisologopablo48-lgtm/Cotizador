'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Specialty } from '@fym/shared';
import { Plus, Search, Pencil, Trash2, Gauge, Loader2 } from 'lucide-react';

const SPECIALTY_LABELS: Record<string, string> = {
  CIVIL: 'Obras Civiles',
  METALWORK: 'Metalmecánica',
  ELECTRICAL: 'Eléctrico',
  HVAC: 'HVAC / Climatización',
  PLUMBING: 'Plomería',
  GENERAL: 'General',
};

const SPECIALTIES = Object.entries(Specialty).map(([, v]) => ({ value: v, label: SPECIALTY_LABELS[v] || v }));

const UOM_OPTIONS = [
  { value: 'M2', label: 'Metro²' },
  { value: 'M3', label: 'Metro³' },
  { value: 'ML', label: 'Metro Lineal' },
  { value: 'M', label: 'Metro' },
  { value: 'UND', label: 'Unidad' },
  { value: 'KG', label: 'Kilogramo' },
  { value: 'GLB', label: 'Global' },
  { value: 'DIA', label: 'Día' },
  { value: 'HH', label: 'Horas Hombre' },
];

interface PerformanceRate {
  id: string;
  code: string;
  name: string;
  specialty: string;
  unit: string;
  dailyOutput: number;
  dailyWorkHours?: number;
  description?: string;
}

const emptyForm = {
  code: '',
  name: '',
  specialty: 'CIVIL',
  unit: 'M2',
  dailyOutput: '',
  dailyWorkHours: '8',
  description: '',
};

export default function PerformanceRatesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [rates, setRates] = useState<PerformanceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<PerformanceRate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      let url = '/performance-rates';
      const params: string[] = [];
      if (specialtyFilter) params.push(`specialty=${specialtyFilter}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (params.length) url += '?' + params.join('&');
      const data = await api.get<PerformanceRate[]>(url, token);
      setRates(data || []);
    } catch (e: any) {
      addToast(e.message || 'Error al cargar rendimientos', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, search, specialtyFilter, addToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingRate(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (r: PerformanceRate) => {
    setEditingRate(r);
    setForm({
      code: r.code || '',
      name: r.name,
      specialty: r.specialty,
      unit: r.unit,
      dailyOutput: String(r.dailyOutput),
      dailyWorkHours: String(r.dailyWorkHours ?? 8),
      description: r.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.dailyOutput) {
      addToast('Nombre y rendimiento diario son requeridos', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        specialty: form.specialty,
        unit: form.unit,
        dailyOutput: parseFloat(form.dailyOutput),
        dailyWorkHours: parseFloat(form.dailyWorkHours) || 8,
        description: form.description.trim() || undefined,
      };
      if (editingRate) {
        await api.put(`/performance-rates/${editingRate.id}`, payload, token!);
        addToast('Rendimiento actualizado', 'success');
      } else {
        await api.post('/performance-rates', payload, token!);
        addToast('Rendimiento creado', 'success');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: PerformanceRate) => {
    if (!confirm(`¿Eliminar el rendimiento "${r.name}"?`)) return;
    try {
      await api.delete(`/performance-rates/${r.id}`, token!);
      addToast('Rendimiento eliminado', 'success');
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al eliminar', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 font-jakarta">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900/40 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
            <Gauge className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tasas de Rendimiento</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Productividad estándar por especialidad y unidad de obra.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="h-10 px-5 rounded-xl font-semibold">
          <Plus className="mr-2 h-4 w-4" /> Nueva Tasa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            className="pl-10 h-11 rounded-xl"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="h-11 w-48 rounded-xl">
            <SelectValue placeholder="Todas las especialidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las especialidades</SelectItem>
            {SPECIALTIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider pl-6 w-28">Código</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Descripción</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Especialidad</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">Rendimiento Diario</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">Unidad</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">H/día</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No hay tasas de rendimiento registradas.
                </TableCell>
              </TableRow>
            ) : (
              rates.map(r => (
                <TableRow key={r.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <TableCell className="pl-6 font-mono text-xs text-primary font-bold">{r.code || '—'}</TableCell>
                  <TableCell>
                    <p className="font-semibold text-sm">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
                      {SPECIALTY_LABELS[r.specialty] || r.specialty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">{Number(r.dailyOutput).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-xs">{r.unit}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.dailyWorkHours ?? 8}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Gauge className="h-4 w-4 text-amber-600" />
              {editingRate ? 'Editar Tasa de Rendimiento' : 'Nueva Tasa de Rendimiento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Código</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Ej. REN-001" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Especialidad *</Label>
                <Select value={form.specialty} onValueChange={v => setForm(f => ({ ...f, specialty: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Nombre / Descripción *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Encofrado de losa aligerada" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Rendimiento / día *</Label>
                <Input type="number" min="0" step="0.01" value={form.dailyOutput} onChange={e => setForm(f => ({ ...f, dailyOutput: e.target.value }))} placeholder="0.00" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Unidad</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Horas / día</Label>
                <Input type="number" min="1" max="24" value={form.dailyWorkHours} onChange={e => setForm(f => ({ ...f, dailyWorkHours: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Notas adicionales</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Condiciones o aclaraciones..." className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingRate ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
