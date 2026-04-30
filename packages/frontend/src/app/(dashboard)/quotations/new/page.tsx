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
import { ArrowLeft, Settings2, Plus, Trash2, GripVertical, Users, Briefcase, Calendar, Info, Calculator, DollarSign, FileText, LayoutGrid } from 'lucide-react';
import {
  DEFAULT_PROJECT_TECHNICAL_SECTIONS,
  QuotationDocumentMode,
  normalizeQuotationDocumentMode,
  type TechnicalSection,
} from '@fym/shared';

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
    validityDays: '15', currency: 'PEN', igvPercentage: '18',
    generalExpensesPercentage: '10', profitMarginPercentage: '15',
    introductionText: '', termsAndConditions: '', deliveryTimeDays: '', warrantyText: '',
    documentMode: 'SIMPLE' as 'SIMPLE' | 'PROJECT',
    referenceSubject: '',
    issuePlace: '',
    issueDate: '',
    revisionLabel: '',
    showTaxBreakdown: true,
    pricesIncludeIgv: false,
    commercialTerms: {
      paymentMethod: '',
      paymentTerms: '',
      executionLocation: '',
      executionTime: '',
      additionalNotes: '',
    },
    technicalSections: [] as TechnicalSection[],
    coverUrl1: '',
    coverUrl2: '',
    coverUrl3: '',
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
    api.get<any>('/config/company', token).then(r => {
      setForm(f => ({
        ...f,
        validityDays: String(r.defaultValidityDays ?? 15),
        currency: r.defaultCurrency || 'PEN',
        igvPercentage: String(r.defaultIgvPercentage ?? 18),
        issueDate: f.issueDate || new Date().toISOString().slice(0, 10),
      }));
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (form.companyId && token) {
      api.get<any>(`/companies/${form.companyId}`, token)
        .then(r => {
          setContacts(r.data?.contacts || []);
          setAgreements(r.data?.agreements || []);
          // Auto-suggest title with client name + month/year if still empty
          const tradeName: string = r.data?.tradeName || '';
          if (tradeName) {
            const now = new Date();
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const suggestion = `${tradeName} - ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
            setForm(f => ({ ...f, title: f.title.trim() === '' ? suggestion : f.title }));
          }
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
        igvPercentage: parseFloat(form.igvPercentage) || 18,
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

      const mode =
        normalizeQuotationDocumentMode(form.documentMode) === QuotationDocumentMode.PROJECT
          ? QuotationDocumentMode.PROJECT
          : QuotationDocumentMode.SIMPLE;
      body.documentMode = mode;
      body.referenceSubject = form.referenceSubject.trim();
      body.issuePlace = form.issuePlace.trim();
      body.issueDate = form.issueDate.trim() || null;
      body.revisionLabel = form.revisionLabel.trim();
      body.showTaxBreakdown = form.showTaxBreakdown;
      body.pricesIncludeIgv = form.pricesIncludeIgv;
      body.commercialTerms = {
        paymentMethod: form.commercialTerms.paymentMethod.trim() || undefined,
        paymentTerms: form.commercialTerms.paymentTerms.trim() || undefined,
        executionLocation: form.commercialTerms.executionLocation.trim() || undefined,
        executionTime: form.commercialTerms.executionTime.trim() || undefined,
        additionalNotes: form.commercialTerms.additionalNotes.trim() || undefined,
      };
      const ts =
        mode === QuotationDocumentMode.PROJECT
          ? (form.technicalSections.length ? form.technicalSections : [...DEFAULT_PROJECT_TECHNICAL_SECTIONS])
          : [];
      body.technicalSections = ts;
      const coverUrls = [form.coverUrl1, form.coverUrl2, form.coverUrl3].map(s => s.trim()).filter(Boolean).slice(0, 5);
      body.projectCoverImageUrls = coverUrls;

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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10 rounded-xl border-slate-200 bg-white/50 backdrop-blur-sm hover:bg-white hover:shadow-md transition-all shrink-0" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Nueva Cotización</h1>
          <p className="text-slate-500 font-medium">Configura los parámetros para generar un nuevo presupuesto profesional.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Seleccionar Cliente *</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v, contactId: '', agreementId: '' }))}>
                    <SelectTrigger className="form-select h-11">
                      <SelectValue placeholder="Buscar empresa..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg">
                          <div className="flex flex-col">
                            <span className="font-bold">{c.tradeName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.ruc || 'SIN RUC'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Persona de Contacto</Label>
                  <Select
                    value={form.contactId || '_none'}
                    onValueChange={v => setForm(f => ({ ...f, contactId: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className="form-select h-11" disabled={!form.companyId}>
                      <SelectValue placeholder={form.companyId ? "Seleccionar contacto" : "Primero elija cliente"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="_none">Sin contacto específico</SelectItem>
                      {contacts.map(c => <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {agreements.length > 0 && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Acuerdo Comercial Vigente</Label>
                  <Select value={form.agreementId} onValueChange={v => setForm(f => ({ ...f, agreementId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="form-select h-11 border-indigo-200 bg-indigo-50/30">
                      <SelectValue placeholder="Vincular con un acuerdo previo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="_none">No vincular a acuerdos</SelectItem>
                      {agreements.map(a => (
                        <SelectItem key={a.id} value={a.id} className="rounded-lg">
                          {a.name || a.title || a.type || `Acuerdo ${a.id.slice(-6)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Asunto / Título del Proyecto *</Label>
                <Input 
                  className="form-field h-11 font-bold text-slate-700" 
                  value={form.title} 
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                  placeholder="Se sugiere automáticamente al elegir cliente" 
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Al seleccionar un cliente se sugiere automáticamente: <span className="text-indigo-500 font-bold">Cliente - Mes/Año</span>. Puedes editarlo libremente.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Alcance General (Opcional)</Label>
                <textarea 
                  className="form-textarea min-h-[100px]" 
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                  placeholder="Breve descripción del alcance para referencia interna o externa..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                Textos de la Propuesta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Introducción Personalizada</Label>
                <textarea 
                  className="form-textarea min-h-[80px]" 
                  value={form.introductionText} 
                  onChange={e => setForm(f => ({ ...f, introductionText: e.target.value }))} 
                  placeholder="Estimados, por intermedio de la presente hacemos llegar..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Condiciones del Servicio</Label>
                <textarea 
                  className="form-textarea min-h-[120px]" 
                  value={form.termsAndConditions} 
                  onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} 
                  placeholder="Detalle de formas de pago, exclusiones y responsabilidades..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Garantía del Trabajo</Label>
                <Input 
                  className="form-field" 
                  value={form.warrantyText} 
                  onChange={e => setForm(f => ({ ...f, warrantyText: e.target.value }))} 
                  placeholder="Ej: 12 meses contra defectos de fabricación" 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-sky-100 rounded-lg">
                  <LayoutGrid className="h-4 w-4 text-sky-600" />
                </div>
                Documento PDF (simple / proyecto)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Modo</Label>
                <Select
                  value={form.documentMode}
                  onValueChange={v =>
                    setForm(f => ({
                      ...f,
                      documentMode: v === 'PROJECT' ? 'PROJECT' : 'SIMPLE',
                      technicalSections:
                        v === 'PROJECT' && f.technicalSections.length === 0
                          ? [...DEFAULT_PROJECT_TECHNICAL_SECTIONS]
                          : v === 'SIMPLE'
                            ? []
                            : f.technicalSections,
                    }))
                  }
                >
                  <SelectTrigger className="form-select border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="SIMPLE" className="rounded-lg">Simple</SelectItem>
                    <SelectItem value="PROJECT" className="rounded-lg">Proyecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Referencia</Label>
                  <Input
                    className="form-field"
                    value={form.referenceSubject}
                    onChange={e => setForm(f => ({ ...f, referenceSubject: e.target.value }))}
                    placeholder="Asunto en el PDF"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Revisión</Label>
                  <Input
                    className="form-field font-mono"
                    value={form.revisionLabel}
                    onChange={e => setForm(f => ({ ...f, revisionLabel: e.target.value }))}
                    placeholder="REV1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Lugar emisión</Label>
                  <Input
                    className="form-field"
                    value={form.issuePlace}
                    onChange={e => setForm(f => ({ ...f, issuePlace: e.target.value }))}
                    placeholder="Lima"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Fecha emisión</Label>
                  <Input
                    type="date"
                    className="form-field font-mono"
                    value={form.issueDate}
                    onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 accent-sky-600"
                    checked={form.showTaxBreakdown}
                    onChange={e => setForm(f => ({ ...f, showTaxBreakdown: e.target.checked }))}
                  />
                  Desglose IGV
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 accent-sky-600"
                    checked={form.pricesIncludeIgv}
                    onChange={e => setForm(f => ({ ...f, pricesIncludeIgv: e.target.checked }))}
                  />
                  Precios incluyen IGV
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Forma de pago</Label>
                  <Input
                    className="form-field"
                    value={form.commercialTerms.paymentMethod}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, paymentMethod: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Lugar ejecución</Label>
                  <Input
                    className="form-field"
                    value={form.commercialTerms.executionLocation}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, executionLocation: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Plazo / tiempo ejecución</Label>
                  <Input
                    className="form-field"
                    value={form.commercialTerms.executionTime}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        commercialTerms: { ...f.commercialTerms, executionTime: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              {form.documentMode === 'PROJECT' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-600">Secciones técnicas</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-bold"
                      onClick={() =>
                        setForm(f => ({ ...f, technicalSections: [...DEFAULT_PROJECT_TECHNICAL_SECTIONS] }))
                      }
                    >
                      Plantilla estándar
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500">Podrá editar el contenido en el detalle de la cotización.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
          <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-2xl bg-slate-50/30">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <Settings2 className="h-4 w-4 text-amber-600" />
                </div>
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tipo de Documento</Label>
                  {canManageTypes && (
                    <button 
                      type="button" 
                      onClick={openTypesDialog}
                      className="text-[10px] font-black text-primary hover:underline uppercase tracking-tighter"
                    >
                      Configurar
                    </button>
                  )}
                </div>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="form-select border-slate-200 bg-white">
                    <SelectValue placeholder="Clasificación" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_none">Sin clasificación</SelectItem>
                    {quotationTypes.map(t => <SelectItem key={t} value={t} className="rounded-lg">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Moneda</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger className="form-select border-slate-200 bg-white font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-bold">
                      <SelectItem value="PEN" className="rounded-lg">Soles (PEN)</SelectItem>
                      <SelectItem value="USD" className="rounded-lg">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">IGV (%)</Label>
                  <Input type="number" step="0.1" className="form-field font-mono font-bold bg-white" value={form.igvPercentage} onChange={e => setForm(f => ({ ...f, igvPercentage: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100 mt-2">
                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-600">Vigencia</p>
                    <p className="text-[10px] text-slate-400 font-medium">Días naturales</p>
                  </div>
                  <Input type="number" className="w-20 h-9 rounded-lg border-slate-200 font-mono font-bold text-right" value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} />
                </div>

                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-600">Gastos Generales</p>
                    <p className="text-[10px] text-slate-400 font-medium">Porcentaje (%)</p>
                  </div>
                  <Input type="number" step="0.1" className="w-20 h-9 rounded-lg border-slate-200 font-mono font-bold text-right" value={form.generalExpensesPercentage} onChange={e => setForm(f => ({ ...f, generalExpensesPercentage: e.target.value }))} />
                </div>

                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-600">Utilidad / Margen</p>
                    <p className="text-[10px] text-slate-400 font-medium">Porcentaje (%)</p>
                  </div>
                  <Input type="number" step="0.1" className="w-20 h-9 rounded-lg border-slate-200 font-mono font-bold text-right" value={form.profitMarginPercentage} onChange={e => setForm(f => ({ ...f, profitMarginPercentage: e.target.value }))} />
                </div>

                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-600">Tiempo Entrega</p>
                    <p className="text-[10px] text-slate-400 font-medium">Días hábiles</p>
                  </div>
                  <Input type="number" className="w-20 h-9 rounded-lg border-slate-200 font-mono font-bold text-right" value={form.deliveryTimeDays} onChange={e => setForm(f => ({ ...f, deliveryTimeDays: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              className="w-full rounded-2xl bg-primary h-14 font-black text-lg shadow-xl shadow-primary/20 hover:shadow-2xl hover:scale-[1.02] transition-all"
              onClick={handleSubmit} 
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </div>
              ) : 'CREAR COTIZACIÓN'}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full rounded-2xl h-12 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => router.back()}
            >
              CANCELAR
            </Button>
          </div>
        </div>
      </div>

      {/* ── Manage quotation types dialog ─────────────────── */}
      <Dialog open={typesDialog} onOpenChange={setTypesDialog}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 px-6 py-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                  <Settings2 className="h-6 w-6" />
                </div>
                Tipos de Cotización
              </DialogTitle>
              <p className="text-slate-400 font-medium text-sm mt-2">
                Clasifica tus presupuestos para un mejor orden administrativo.
              </p>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {editingTypes.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-400">Sin tipos configurados</p>
                </div>
              ) : (
                editingTypes.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:border-slate-200 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm font-bold text-slate-700">{t}</span>
                    <button
                      type="button"
                      onClick={() => removeType(i)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Nombre del nuevo tipo..."
                className="form-field font-bold"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewType())}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addNewType} 
                disabled={!newType.trim()}
                className="rounded-xl border-slate-200 hover:bg-slate-50"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 gap-2">
            <Button variant="ghost" className="rounded-xl font-bold text-slate-500" onClick={() => setTypesDialog(false)}>Descartar</Button>
            <Button onClick={saveTypes} disabled={savingTypes} className="rounded-xl bg-slate-900 font-bold px-8 shadow-lg shadow-slate-200 text-white hover:bg-black">
              {savingTypes ? 'Guardando...' : 'Aplicar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
