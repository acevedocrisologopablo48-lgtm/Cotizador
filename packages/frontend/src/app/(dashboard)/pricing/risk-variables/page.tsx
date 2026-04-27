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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskVariableType } from '@fym/shared';
import { Plus, Search, Pencil, Trash2, ShieldAlert, Loader2 } from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULE: { label: 'Plazo', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  HEIGHT_RISK: { label: 'Riesgo Altura', color: 'bg-red-50 text-red-700 border-red-100' },
  SAFETY_SST: { label: 'Seguridad SST', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  LOCATION: { label: 'Ubicación', color: 'bg-sky-50 text-sky-700 border-sky-100' },
  URGENCY: { label: 'Urgencia', color: 'bg-violet-50 text-violet-700 border-violet-100' },
};

const RISK_TYPES = Object.entries(RiskVariableType).map(([, v]) => ({
  value: v,
  label: TYPE_LABELS[v]?.label || v,
}));

interface RiskVariable {
  id: string;
  name: string;
  variableType: string;
  percentage: number;
  priority: number;
  description?: string;
}

const emptyForm = {
  name: '',
  variableType: 'SCHEDULE',
  percentage: '',
  priority: '0',
  description: '',
};

export default function RiskVariablesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [variables, setVariables] = useState<RiskVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<RiskVariable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      let url = '/risk-variables';
      if (typeFilter) url += `?variableType=${typeFilter}`;
      const data = await api.get<RiskVariable[]>(url, token);
      setVariables(data || []);
    } catch (e: any) {
      addToast(e.message || 'Error al cargar variables', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, typeFilter, addToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingVar(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: RiskVariable) => {
    setEditingVar(v);
    setForm({
      name: v.name,
      variableType: v.variableType,
      percentage: String(v.percentage),
      priority: String(v.priority),
      description: v.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.percentage) {
      addToast('Nombre y porcentaje son requeridos', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        variableType: form.variableType,
        percentage: parseFloat(form.percentage),
        priority: parseInt(form.priority) || 0,
        description: form.description.trim() || undefined,
      };
      if (editingVar) {
        await api.put(`/risk-variables/${editingVar.id}`, payload, token!);
        addToast('Variable actualizada', 'success');
      } else {
        await api.post('/risk-variables', payload, token!);
        addToast('Variable creada', 'success');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: RiskVariable) => {
    if (!confirm(`¿Eliminar la variable "${v.name}"?`)) return;
    try {
      await api.delete(`/risk-variables/${v.id}`, token!);
      addToast('Variable eliminada', 'success');
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
          <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
            <ShieldAlert className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Variables de Riesgo</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Factores de incremento por condiciones de obra y contexto.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="h-10 px-5 rounded-xl font-semibold">
          <Plus className="mr-2 h-4 w-4" /> Nueva Variable
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-11 w-56 rounded-xl">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los tipos</SelectItem>
            {RISK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider pl-6">Nombre</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">% Incremento</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">Prioridad</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Descripción</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : variables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No hay variables de riesgo registradas.
                </TableCell>
              </TableRow>
            ) : (
              variables.map(v => {
                const typeInfo = TYPE_LABELS[v.variableType] || { label: v.variableType, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                return (
                  <TableRow key={v.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <TableCell className="pl-6 font-semibold text-sm">{v.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                        +{Number(v.percentage).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{v.priority}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{v.description || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(v)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => handleDelete(v)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              {editingVar ? 'Editar Variable de Riesgo' : 'Nueva Variable de Riesgo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Trabajo en altura > 3m" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Tipo</Label>
                <Select value={form.variableType} onValueChange={v => setForm(f => ({ ...f, variableType: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">% Incremento *</Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} placeholder="Ej. 5.5" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Prioridad (mayor = se aplica primero)</Label>
              <Input type="number" min="0" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Condiciones de aplicación..." rows={2} className="rounded-xl resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingVar ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
