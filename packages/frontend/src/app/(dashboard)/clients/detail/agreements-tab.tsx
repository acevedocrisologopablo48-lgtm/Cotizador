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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, Pencil, FileCheck, CreditCard, 
  ShieldCheck, Calendar, DollarSign, Info,
  AlertCircle, ChevronRight, Gavel
} from 'lucide-react';
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
  paymentTerms: '',
  executionLocation: '',
  executionTime: '',
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
      paymentTerms: agreement.paymentTerms || '',
      executionLocation: agreement.executionLocation || '',
      executionTime: agreement.executionTime || '',
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
        paymentTerms: form.paymentTerms || undefined,
        executionLocation: form.executionLocation || undefined,
        executionTime: form.executionTime || undefined,
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

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl font-jakarta">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/10 dark:bg-slate-950/20 px-10 py-8">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Marco de Acuerdos Comerciales</CardTitle>
          <p className="text-xs font-medium text-slate-400 mt-1">Condiciones pactadas y protocolos de pago</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-lg transition-all hover:scale-105">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Acuerdo
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {agreements.length === 0 ? (
          <div className="py-32 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="h-20 w-20 rounded-3xl bg-slate-900/5 flex items-center justify-center border border-slate-200 dark:border-white/5">
                <Gavel className="h-10 w-10 text-slate-300" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No existen protocolos comerciales registrados.</p>
                <p className="text-xs font-medium text-slate-400">Las condiciones por defecto serán aplicadas en cada cotización.</p>
              </div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 pl-10">Metodología / Divisa</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 text-center">Protocolo Crédito</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 text-center">Cobertura Garantía</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 text-center">Retención</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Vigencia Contractual</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Status</TableHead>
                {canEdit && <TableHead className="w-[80px] pr-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((ag) => (
                <TableRow key={ag.id} className="group border-white/5 hover:bg-white/60 dark:hover:bg-white/5 transition-all">
                  <TableCell className="pl-10 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                        {PAYMENT_METHODS[ag.paymentMethod] || ag.paymentMethod}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded w-fit border border-blue-500/10">
                          {CURRENCIES[ag.billingCurrency] || ag.billingCurrency}
                        </span>
                        {ag.executionLocation && (
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded w-fit border border-slate-200">
                            {ag.executionLocation}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-6">
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white tracking-tighter">{ag.creditDays}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Días Pactados</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-6">
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white tracking-tighter">{ag.warrantyDays}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Días de Soporte</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-6">
                    <Badge variant="outline" className="h-8 px-4 rounded-xl border-orange-500/20 bg-orange-500/5 text-xs font-black text-orange-600 font-mono">
                      {ag.retentionPercentage}%
                    </Badge>
                  </TableCell>
                  <TableCell className="py-6">
                    {ag.validFrom ? (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            {new Date(ag.validFrom).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            al {ag.validUntil ? new Date(ag.validUntil).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Temporalidad no definida</span>
                    )}
                  </TableCell>
                  <TableCell className="py-6">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] w-fit ${
                      ag.isActive 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${ag.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                      {ag.isActive ? 'Vigente' : 'Inactivo'}
                    </div>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="pr-10 py-6 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ag)} className="h-10 w-10 rounded-xl hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all shadow-sm">
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

      {/* ── Agreement Configuration Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl h-[92vh] max-h-[92vh] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
          <div className="bg-slate-950 px-10 py-12 text-white relative">
            <div className="absolute top-0 right-0 w-48 h-full bg-emerald-500/10 skew-x-12" />
            <DialogHeader className="relative">
              <DialogTitle className="text-3xl font-black flex items-center gap-4 uppercase tracking-tighter">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                  <FileCheck className="h-8 w-8 text-emerald-400" />
                </div>
                {editingId ? 'Editar Protocolo Comercial' : 'Nueva Estipulación Contractual'}
              </DialogTitle>
              <p className="text-slate-400 font-medium text-base mt-4 leading-relaxed max-w-md">
                Configure los parámetros financieros, de crédito y garantías legales para el socio comercial.
              </p>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 p-10 space-y-10 bg-white dark:bg-slate-950 overflow-y-auto overscroll-contain">
            <div className="grid gap-10 sm:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Protocolo de Crédito (Días)</Label>
                <div className="relative">
                  <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input type="number" min="0" value={form.creditDays} onChange={setField('creditDays')} className="h-16 pl-14 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-lg font-black focus:ring-blue-500/20 shadow-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Cobertura de Garantía (Días)</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input type="number" min="0" value={form.warrantyDays} onChange={setField('warrantyDays')} className="h-16 pl-14 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-lg font-black focus:ring-blue-500/20 shadow-sm" />
                </div>
              </div>
            </div>

            <div className="grid gap-10 sm:grid-cols-2 p-8 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-inner">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Metodología de Pago</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PAYMENT_METHODS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="font-medium">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Divisa Contractual</Label>
                <Select value={form.billingCurrency} onValueChange={v => setForm(f => ({ ...f, billingCurrency: v }))}>
                  <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 font-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(CURRENCIES).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="font-bold">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Condiciones / Términos de Pago</Label>
              <Input
                value={form.paymentTerms}
                onChange={setField('paymentTerms')}
                placeholder="Ej. Facturación a 60 días, 50% adelanto / 50% contra entrega..."
                className="h-14 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-medium shadow-sm"
              />
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Retención de Garantía (%)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.retentionPercentage}
                    onChange={setField('retentionPercentage')}
                    className="h-16 pl-14 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-lg font-black focus:ring-orange-500/20 shadow-sm"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300">%</div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Temporalidad (Vigencia)</Label>
                <div className="flex gap-2">
                  <Input type="date" value={form.validFrom} onChange={setField('validFrom')} className="h-16 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-xs font-bold" />
                  <div className="flex items-center text-slate-300">→</div>
                  <Input type="date" value={form.validUntil} onChange={setField('validUntil')} className="h-16 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-xs font-bold" />
                </div>
              </div>
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Lugar de Ejecución</Label>
                <Input
                  value={form.executionLocation}
                  onChange={setField('executionLocation')}
                  placeholder="Ej. Planta SLA, Nave 5"
                  className="h-14 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-medium shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Tiempo / Plazo de Ejecución</Label>
                <Input
                  value={form.executionTime}
                  onChange={setField('executionTime')}
                  placeholder="Ej. 10 días hábiles"
                  className="h-14 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-medium shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Condiciones Especiales / Cláusulas</Label>
              <div className="relative">
                <Info className="absolute left-5 top-5 h-5 w-5 text-slate-400" />
                <Textarea
                  value={form.specialConditions}
                  onChange={setField('specialConditions')}
                  placeholder="Detalles adicionales, anexos o condiciones específicas pactadas..."
                  rows={4}
                  className="rounded-[2rem] bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 pl-14 pt-5 text-sm font-medium focus:ring-blue-500/20 resize-none shadow-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 sm:p-10 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 gap-4 shrink-0">
            <Button variant="ghost" className="h-16 px-10 rounded-[2rem] font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-all" onClick={() => setDialogOpen(false)}>CANCELAR</Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="h-16 px-14 rounded-[2rem] bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-slate-200 dark:shadow-none transition-all active:scale-95"
            >
              {isSaving ? 'SINCRONIZANDO...' : editingId ? 'ACTUALIZAR MARCO' : 'ESTABLECER ACUERDO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
