'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil } from 'lucide-react';
import type { Agreement } from './client-page';

interface AgreementsTabProps {
  companyId: string;
  agreements: Agreement[];
  canEdit: boolean;
  onRefresh: () => void;
}

const emptyForm = {
  creditDays: '30',
  warrantyDays: '365',
  paymentMethod: 'TRANSFER',
  billingCurrency: 'PEN',
  retentionPercentage: '0',
  specialConditions: '',
  validFrom: '',
  validUntil: '',
};

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  LETTER_OF_CREDIT: 'Carta de crédito',
};

const CURRENCIES: Record<string, string> = {
  PEN: 'Soles (PEN)',
  USD: 'Dólares (USD)',
};

export function AgreementsTab({ companyId, agreements, canEdit, onRefresh }: AgreementsTabProps) {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (agreement: Agreement) => {
    setEditingId(agreement.id);
    setForm({
      creditDays: String(agreement.creditDays),
      warrantyDays: String(agreement.warrantyDays),
      paymentMethod: agreement.paymentMethod,
      billingCurrency: agreement.billingCurrency,
      retentionPercentage: String(agreement.retentionPercentage),
      specialConditions: agreement.specialConditions || '',
      validFrom: agreement.validFrom ? agreement.validFrom.slice(0, 10) : '',
      validUntil: agreement.validUntil ? agreement.validUntil.slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        creditDays: parseInt(form.creditDays) || 0,
        warrantyDays: parseInt(form.warrantyDays) || 0,
        paymentMethod: form.paymentMethod,
        billingCurrency: form.billingCurrency,
        retentionPercentage: parseFloat(form.retentionPercentage) || 0,
        specialConditions: form.specialConditions || undefined,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
      };

      if (editingId) {
        await api.put(`/companies/${companyId}/agreements/${editingId}`, payload, token!);
        addToast('Acuerdo actualizado', 'success');
      } else {
        await api.post(`/companies/${companyId}/agreements`, payload, token!);
        addToast('Acuerdo creado', 'success');
      }
      setDialogOpen(false);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Error al guardar acuerdo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Acuerdos comerciales</CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar acuerdo' : 'Nuevo acuerdo comercial'}</DialogTitle>
                <DialogDescription>Condiciones comerciales pactadas con el cliente</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Días de crédito</Label>
                    <Input type="number" min="0" value={form.creditDays} onChange={set('creditDays')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Días de garantía</Label>
                    <Input type="number" min="0" value={form.warrantyDays} onChange={set('warrantyDays')} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Método de pago</Label>
                    <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHODS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select value={form.billingCurrency} onValueChange={v => setForm(f => ({ ...f, billingCurrency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CURRENCIES).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Retención (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.retentionPercentage}
                    onChange={set('retentionPercentage')}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Vigencia desde</Label>
                    <Input type="date" value={form.validFrom} onChange={set('validFrom')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vigencia hasta</Label>
                    <Input type="date" value={form.validUntil} onChange={set('validUntil')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Condiciones especiales</Label>
                  <Textarea
                    value={form.specialConditions}
                    onChange={set('specialConditions')}
                    placeholder="Detalles adicionales..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay acuerdos comerciales registrados
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método de pago</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-center">Crédito</TableHead>
                <TableHead className="text-center">Garantía</TableHead>
                <TableHead className="text-center">Retención</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                {canEdit && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((ag) => (
                <TableRow key={ag.id}>
                  <TableCell>{PAYMENT_METHODS[ag.paymentMethod] || ag.paymentMethod}</TableCell>
                  <TableCell>{CURRENCIES[ag.billingCurrency] || ag.billingCurrency}</TableCell>
                  <TableCell className="text-center">{ag.creditDays} días</TableCell>
                  <TableCell className="text-center">{ag.warrantyDays} días</TableCell>
                  <TableCell className="text-center">{ag.retentionPercentage}%</TableCell>
                  <TableCell>
                    {ag.validFrom ? (
                      <span className="text-xs">
                        {new Date(ag.validFrom).toLocaleDateString('es-PE')} — {ag.validUntil ? new Date(ag.validUntil).toLocaleDateString('es-PE') : 'Indefinido'}
                      </span>
                    ) : 'Sin definir'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ag.isActive ? 'default' : 'secondary'}>
                      {ag.isActive ? 'Vigente' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
