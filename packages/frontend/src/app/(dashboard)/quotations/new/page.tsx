'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Settings2, Plus, Trash2, GripVertical } from 'lucide-react';

export default function NewQuotationPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [quotationTypes, setQuotationTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyId: '', contactId: '', agreementId: '', tipo: '',
    title: '', description: '',
    validityDays: '15', currency: 'PEN',
    generalExpensesPercentage: '10', profitMarginPercentage: '15',
    introductionText: '', termsAndConditions: '', deliveryTimeDays: '', warrantyText: '',
  });

  // Manage types dialog
  const canManageTypes = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [typesDialog, setTypesDialog] = useState(false);
  const [editingTypes, setEditingTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const [savingTypes, setSavingTypes] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<any>('/companies?pageSize=100', token).then(r => setCompanies(r.data || [])).catch(() => {});
    api.get<string[]>('/config/quotation-types', token).then(r => setQuotationTypes(r)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (form.companyId && token) {
      api.get<any>(`/companies/${form.companyId}`, token)
        .then(r => {
          setContacts(r.data?.contacts || []);
          setAgreements(r.data?.agreements || []);
        })
        .catch(() => { setContacts([]); setAgreements([]); });
    } else {
      setContacts([]);
      setAgreements([]);
    }
  }, [form.companyId, token]);

  const handleSubmit = async () => {
    if (!form.companyId || !form.title) {
      addToast('Cliente y título son obligatorios', 'error');
      return;
    }
    try {
      setSaving(true);
      const body: any = {
        companyId: form.companyId,
        title: form.title,
        description: form.description || undefined,
        validityDays: parseInt(form.validityDays),
        currency: form.currency,
        generalExpensesPercentage: parseFloat(form.generalExpensesPercentage),
        profitMarginPercentage: parseFloat(form.profitMarginPercentage),
      };
      if (form.tipo) body.tipo = form.tipo;
      if (form.contactId) body.contactId = form.contactId;
      if (form.agreementId) body.agreementId = form.agreementId;
      if (form.introductionText) body.introductionText = form.introductionText;
      if (form.termsAndConditions) body.termsAndConditions = form.termsAndConditions;
      if (form.deliveryTimeDays) body.deliveryTimeDays = parseInt(form.deliveryTimeDays);
      if (form.warrantyText) body.warrantyText = form.warrantyText;

      const created = await api.post<any>('/quotations', body, token!);
      addToast('Cotización creada', 'success');
      router.push(`/quotations/detail?id=${created.id}`);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openTypesDialog = () => {
    setEditingTypes([...quotationTypes]);
    setNewType('');
    setTypesDialog(true);
  };

  const addNewType = () => {
    const t = newType.trim();
    if (!t) return;
    if (editingTypes.some(x => x.toLowerCase() === t.toLowerCase())) {
      addToast('Ese tipo ya existe', 'error');
      return;
    }
    setEditingTypes(prev => [...prev, t]);
    setNewType('');
  };

  const removeType = (idx: number) => {
    setEditingTypes(prev => prev.filter((_, i) => i !== idx));
  };

  const saveTypes = async () => {
    try {
      setSavingTypes(true);
      const updated = await api.put<string[]>('/config/quotation-types', { types: editingTypes }, token!);
      setQuotationTypes(updated);
      // If the current tipo is no longer in the list, clear it
      if (form.tipo && !updated.includes(form.tipo)) {
        setForm(f => ({ ...f, tipo: '' }));
      }
      addToast('Lista de tipos actualizada', 'success');
      setTypesDialog(false);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSavingTypes(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Nueva Cotización</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Datos Generales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v, contactId: '', agreementId: '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName}{c.ruc ? ` — ${c.ruc}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comprador / Contacto</Label>
              <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar comprador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin comprador</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Tipo de cotización</Label>
              {canManageTypes && (
                <button
                  type="button"
                  onClick={openTypesDialog}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings2 className="h-3 w-3" />
                  Administrar tipos
                </button>
              )}
            </div>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v === '_none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin tipo</SelectItem>
                {quotationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {agreements.length > 0 && (
            <div>
              <Label>Acuerdo Comercial</Label>
              <Select value={form.agreementId} onValueChange={v => setForm(f => ({ ...f, agreementId: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Vincular acuerdo (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin acuerdo</SelectItem>
                  {agreements.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name || a.title || a.type || `Acuerdo ${a.id.slice(-6)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Mantenimiento de infraestructura..." /></div>
          <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Vigencia (días)</Label><Input type="number" value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} /></div>
            <div><Label>Gastos Generales (%)</Label><Input type="number" step="0.1" value={form.generalExpensesPercentage} onChange={e => setForm(f => ({ ...f, generalExpensesPercentage: e.target.value }))} /></div>
            <div><Label>Utilidad (%)</Label><Input type="number" step="0.1" value={form.profitMarginPercentage} onChange={e => setForm(f => ({ ...f, profitMarginPercentage: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PEN">PEN (S/)</SelectItem><SelectItem value="USD">USD ($)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Plazo de entrega (días)</Label><Input type="number" value={form.deliveryTimeDays} onChange={e => setForm(f => ({ ...f, deliveryTimeDays: e.target.value }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Textos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Introducción</Label><Textarea value={form.introductionText} onChange={e => setForm(f => ({ ...f, introductionText: e.target.value }))} rows={3} /></div>
          <div><Label>Términos y Condiciones</Label><Textarea value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} rows={3} /></div>
          <div><Label>Garantía</Label><Textarea value={form.warrantyText} onChange={e => setForm(f => ({ ...f, warrantyText: e.target.value }))} rows={2} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Crear Cotización'}</Button>
      </div>

      {/* ── Manage quotation types dialog ─────────────────── */}
      <Dialog open={typesDialog} onOpenChange={setTypesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Tipos de cotización
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Administra los tipos disponibles en el desplegable. Los cambios aplican a todas las cotizaciones nuevas.
            </p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {editingTypes.length === 0 && (
                <p className="text-sm text-center py-4 text-muted-foreground">Sin tipos configurados</p>
              )}
              {editingTypes.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{t}</span>
                  <button
                    type="button"
                    onClick={() => removeType(i)}
                    className="text-destructive/60 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nuevo tipo..."
                value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewType())}
              />
              <Button type="button" variant="outline" onClick={addNewType} disabled={!newType.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTypesDialog(false)}>Cancelar</Button>
            <Button onClick={saveTypes} disabled={savingTypes}>
              {savingTypes ? 'Guardando...' : 'Guardar lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
