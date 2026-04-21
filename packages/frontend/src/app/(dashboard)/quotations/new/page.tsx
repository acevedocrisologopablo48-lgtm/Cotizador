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
import { useToast } from '@/components/ui/toast';
import { ArrowLeft } from 'lucide-react';

export default function NewQuotationPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyId: '', contactId: '', title: '', description: '',
    validityDays: '15', currency: 'PEN',
    generalExpensesPercentage: '10', profitMarginPercentage: '15',
    introductionText: '', termsAndConditions: '', deliveryTimeDays: '', warrantyText: '',
  });

  useEffect(() => {
    api.get<any>('/companies?pageSize=100', token!).then(r => setCompanies(r.data)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (form.companyId) {
      api.get<any>(`/companies/${form.companyId}`, token!).then(r => setContacts(r.contacts || [])).catch(() => {});
    } else {
      setContacts([]);
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
      if (form.contactId) body.contactId = form.contactId;
      if (form.introductionText) body.introductionText = form.introductionText;
      if (form.termsAndConditions) body.termsAndConditions = form.termsAndConditions;
      if (form.deliveryTimeDays) body.deliveryTimeDays = parseInt(form.deliveryTimeDays);
      if (form.warrantyText) body.warrantyText = form.warrantyText;

      const created = await api.post<any>('/quotations', body, token!);
      addToast('Cotización creada', 'success');
      router.push(`/quotations/${created.id}`);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
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
              <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v, contactId: '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contacto</Label>
              <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin contacto</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
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
    </div>
  );
}
