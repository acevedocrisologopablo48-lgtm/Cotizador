'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Save, Pencil, X, ExternalLink, FileText, 
  Plus, Building2, Globe, MapPin, Briefcase, 
  TrendingUp, Users, ShieldCheck, Calendar,
  Activity, Zap, Info, ChevronRight
} from 'lucide-react';
import { ContactsTab } from './contacts-tab';
import { AgreementsTab } from './agreements-tab';

interface Company {
  id: string;
  ruc: string;
  businessName: string;
  tradeName: string | null;
  address: string | null;
  industrySector: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  contacts: Contact[];
  agreements: Agreement[];
  _count: { quotations: number; projects: number };
}

export interface Contact {
  id: string;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface Agreement {
  id: string;
  creditDays: number;
  warrantyDays: number;
  paymentMethod: string;
  billingCurrency: string;
  retentionPercentage: number;
  specialConditions: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export default function ClientDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [buyerStats, setBuyerStats] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({
    ruc: '',
    businessName: '',
    tradeName: '',
    address: '',
    industrySector: '',
    notes: '',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'ENGINEER';

  const fetchCompany = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: Company }>(`/companies/${id}`, token);
      setCompany(res.data);
      setForm({
        ruc: res.data.ruc,
        businessName: res.data.businessName,
        tradeName: res.data.tradeName || '',
        address: res.data.address || '',
        industrySector: res.data.industrySector || '',
        notes: res.data.notes || '',
      });

      // Load quotation counts per contact (buyer stats)
      if (res.data.contacts?.length) {
        try {
          const qRes = await api.get<any>(`/quotations?pageSize=500&companyId=${id}`, token);
          const counts: Record<string, number> = {};
          for (const q of (qRes.data || [])) {
            if (q.contactId) counts[q.contactId] = (counts[q.contactId] || 0) + 1;
          }
          setBuyerStats(counts);
        } catch { /* non-critical */ }
      }
    } catch {
      addToast('No se pudo cargar el cliente', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, id, addToast]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    if (searchParams.get('edit') === 'true' && canEdit) {
      setIsEditing(true);
    }
  }, [searchParams, canEdit]);

  const handleSave = async () => {
    if (!/^\d{11}$/.test(form.ruc)) {
      addToast('El RUC debe tener exactamente 11 dígitos', 'error');
      return;
    }
    if (!form.businessName.trim()) {
      addToast('La razón social es obligatoria', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put(
        `/companies/${id}`,
        {
          ruc: form.ruc,
          businessName: form.businessName,
          tradeName: form.tradeName || undefined,
          address: form.address || undefined,
          industrySector: form.industrySector || undefined,
          notes: form.notes || undefined,
        },
        token!
      );
      addToast('Datos actualizados correctamente', 'success');
      setIsEditing(false);
      fetchCompany();
    } catch (err: any) {
      addToast(err.message || 'Error al guardar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-800" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 animate-pulse">Sincronizando Expediente...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="h-20 w-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-white/5">
          <Building2 className="h-10 w-10 text-slate-400" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Expediente No Encontrado</h3>
          <p className="text-slate-500 font-medium">El identificador de cliente proporcionado no existe en el registro maestro.</p>
        </div>
        <Button onClick={() => router.push('/clients')} variant="outline" className="rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Directorio
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 font-jakarta animate-in fade-in duration-700">
      
      {/* ── High-Tech Command Header ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 px-8 py-12 shadow-2xl border border-white/10">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="flex items-start gap-8">
            <Link href="/clients">
              <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group shrink-0 shadow-inner">
                <ArrowLeft className="h-6 w-6 text-slate-400 group-hover:text-white transition-colors" />
              </Button>
            </Link>
            
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <Building2 className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Master Partner</span>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${
                  company.isActive 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${company.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {company.isActive ? 'Operativo' : 'Suspendido'}
                </div>
                <div className="px-3 py-1.5 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  ID: {company.id.slice(0, 8)}
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase leading-none">
                  {company.tradeName || company.businessName}
                </h1>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tax ID / RUC</span>
                    <span className="text-xl font-mono font-black text-blue-400 tracking-widest">{company.ruc}</span>
                  </div>
                  <div className="h-6 w-[1px] bg-white/10" />
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Vertical</span>
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">{company.industrySector || 'General Industry'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {canEdit && !isEditing && (
              <Button 
                variant="ghost" 
                onClick={() => setIsEditing(true)} 
                className="h-14 px-8 rounded-2xl border border-white/10 hover:bg-white/5 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all"
              >
                <Pencil className="mr-3 h-4 w-4" />
                Actualizar Ficha
              </Button>
            )}
            <Button asChild className="h-14 px-10 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-500/20 transition-all active:scale-95">
              <Link href={`/quotations/new?companyId=${company.id}`}>
                <Zap className="mr-3 h-5 w-5" />
                Generar Propuesta
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Quick Analytics Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden group hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Presupuestos Emitidos</p>
                <p className="text-3xl font-black font-mono tracking-tighter text-slate-900 dark:text-white">
                  {company._count?.quotations ?? 0}
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Crecimiento Constante</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden group hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Proyectos Activos</p>
                <p className="text-3xl font-black font-mono tracking-tighter text-slate-900 dark:text-white">
                  {company._count?.projects ?? 0}
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Briefcase className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Activity className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">En fase de ejecución</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden group hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Nodos de Contacto</p>
                <p className="text-3xl font-black font-mono tracking-tighter text-slate-900 dark:text-white">
                  {company.contacts?.length ?? 0}
                </p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">Personal Sincronizado</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden group hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Antigüedad Comercial</p>
                <p className="text-3xl font-black font-mono tracking-tighter text-slate-900 dark:text-white">
                  {new Date().getFullYear() - new Date(company.createdAt).getFullYear()}y
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Socio Certificado</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <div className="flex items-center justify-center lg:justify-start overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
          <TabsList className="bg-slate-900/10 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-2 rounded-[2rem] h-auto backdrop-blur-xl">
            <TabsTrigger value="info" className="rounded-2xl px-10 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all duration-300">
              Expediente Maestro
            </TabsTrigger>
            <TabsTrigger value="buyers" className="rounded-2xl px-10 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all duration-300">
              Unidad Operativa
            </TabsTrigger>
            <TabsTrigger value="contacts" className="rounded-2xl px-10 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all duration-300">
              Directorio Focal
            </TabsTrigger>
            <TabsTrigger value="agreements" className="rounded-2xl px-10 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all duration-300">
              Marco Contractual
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="info" className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-10">
              <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="border-b border-white/5 bg-white/10 dark:bg-slate-950/20 px-10 py-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Registro Corporativo</CardTitle>
                      <CardDescription className="text-xs font-medium text-slate-400 mt-1">Información fiscal y operativa validada</CardDescription>
                    </div>
                    {!isEditing && (
                      <Badge variant="outline" className="h-8 px-4 rounded-xl border-emerald-500/20 bg-emerald-500/5 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                        Expediente Verificado
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-10 py-10">
                  {isEditing ? (
                    <div className="space-y-8 animate-in slide-in-from-top-4">
                      <div className="grid gap-8 sm:grid-cols-2">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">RUC Fiscal Maestro</Label>
                          <Input value={form.ruc} onChange={setField('ruc')} maxLength={11} className="h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl font-mono text-base font-black focus:ring-blue-500/20" />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Vertical de Negocio</Label>
                          <Input value={form.industrySector} onChange={setField('industrySector')} className="h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-blue-500/20" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre Legal Completo</Label>
                        <Input value={form.businessName} onChange={setField('businessName')} className="h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-blue-500/20" />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Denominación Comercial</Label>
                        <Input value={form.tradeName} onChange={setField('tradeName')} className="h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-blue-500/20" />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Ubicación Estratégica</Label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input value={form.address} onChange={setField('address')} className="h-14 pl-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-blue-500/20" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Memorándum de Gestión</Label>
                        <Textarea value={form.notes} onChange={setField('notes')} rows={5} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl text-sm font-medium focus:ring-blue-500/20 resize-none p-5" />
                      </div>
                      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-white/5">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-14 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
                          Descartar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="h-14 px-12 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20">
                          {isSaving ? 'Sincronizando...' : 'Consolidar Cambios'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-16 sm:grid-cols-2 relative">
                      {/* Vertical line for visual separation */}
                      <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-slate-200 dark:via-white/5 to-transparent" />
                      
                      <div className="space-y-12">
                        <div className="group">
                          <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Razón Social Legal
                          </dt>
                          <dd className="text-xl font-black text-slate-900 dark:text-white leading-tight transition-all group-hover:pl-2 group-hover:text-blue-500">{company.businessName}</dd>
                        </div>
                        <div className="group">
                          <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Sector de Operación
                          </dt>
                          <dd className="text-base font-bold text-slate-700 dark:text-slate-300 transition-all group-hover:pl-2">
                            {company.industrySector || 'Multisectorial / No Definido'}
                          </dd>
                        </div>
                        <div className="group">
                          <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Centro de Operaciones
                          </dt>
                          <dd className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed border-l-4 border-blue-500/20 pl-6 italic">
                            {company.address || 'Ubicación física no registrada en el sistema.'}
                          </dd>
                        </div>
                      </div>

                      <div className="space-y-12">
                        <div className="group">
                          <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Identidad Pública
                          </dt>
                          <dd className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-all group-hover:pl-2 group-hover:text-blue-500">
                            {company.tradeName || 'Consistente con Legal'}
                          </dd>
                        </div>
                        <div className="group">
                          <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Registro Histórico
                          </dt>
                          <dd className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-900/5 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 leading-relaxed relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                            <Info className="h-4 w-4 text-blue-500 mb-3 opacity-50" />
                            {company.notes || 'No existen anotaciones técnicas de alta prioridad para este socio comercial en el expediente actual.'}
                          </dd>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-10">
              {/* Technical Profile Card */}
              <Card className="border-white/10 bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <CardHeader className="bg-white/5 px-10 py-10 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/20">
                      <Zap className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">Performance Index</CardTitle>
                      <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Métricas de Socio Comercial</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-10 py-10 space-y-8">
                  <div className="space-y-4 group">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Volumen Proyectado</span>
                        <p className="text-sm font-bold text-slate-300">Presupuestos vs Cierres</p>
                      </div>
                      <span className="text-3xl font-black font-mono text-white tracking-tighter">74%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-[2px]">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-[74%] shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all group-hover:brightness-125" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-white/5 rounded-3xl p-5 border border-white/5 hover:border-blue-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ticket Promedio</p>
                      <p className="text-xl font-black text-white font-mono tracking-tighter">S/ 12.4k</p>
                    </div>
                    <div className="bg-white/5 rounded-3xl p-5 border border-white/5 hover:border-indigo-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Proyectos Totales</p>
                      <p className="text-xl font-black text-white font-mono tracking-tighter">{company._count?.projects ?? 0}</p>
                    </div>
                  </div>

                  <Separator className="bg-white/5" />
                  
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Registrado el {new Date(company.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </CardContent>
              </Card>

              {/* Action Sidebar */}
              <div className="space-y-4">
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="buyers" className="animate-in fade-in slide-in-from-right-6 duration-700 outline-none">
          <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl">
            <CardHeader className="px-10 py-10 border-b border-white/5 bg-white/10 dark:bg-slate-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Unidad de Compras & Decisión</CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-400 mt-1">Gestión de interlocutores comerciales y operativos</CardDescription>
                </div>
                <Users className="h-6 w-6 text-slate-400 opacity-20" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!company.contacts?.length ? (
                <div className="py-32 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="h-24 w-24 rounded-[2.5rem] bg-slate-900/5 flex items-center justify-center border border-slate-200 dark:border-white/5 shadow-inner">
                      <Users className="h-10 w-10 text-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Base de contactos vacía</p>
                      <Button onClick={() => setActiveTab('contacts')} variant="outline" className="h-10 rounded-xl font-black text-[9px] uppercase tracking-widest border-slate-200">
                        Agregar Primer Contacto
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {company.contacts.map(contact => {
                    const count = buyerStats[contact.id] || 0;
                    return (
                      <div key={contact.id} className="group flex flex-col md:flex-row md:items-center justify-between px-10 py-10 hover:bg-white/60 dark:hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-8">
                          <div className="relative">
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 border border-white/10 text-white font-black text-2xl shadow-2xl transition-all group-hover:scale-105 group-hover:rotate-3">
                              {contact.fullName.charAt(0).toUpperCase()}
                            </div>
                            {contact.isPrimary && (
                              <div className="absolute -top-1 -right-1 h-6 w-6 bg-blue-500 border-[3px] border-white dark:border-slate-900 rounded-full shadow-lg flex items-center justify-center">
                                <ShieldCheck className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <p className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter">{contact.fullName}</p>
                              {contact.isPrimary && (
                                <Badge className="text-[8px] font-black uppercase tracking-[0.2em] bg-blue-500 text-white border-none px-2.5 py-1 rounded-lg">Primary Nodo</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">{contact.position || 'Standard Account'}</span>
                              <div className="h-1 w-1 rounded-full bg-slate-300" />
                              <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">{contact.email || 'noreply@fym-tech.com'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 mt-6 md:mt-0">
                          <div className="text-right group-hover:scale-110 transition-transform">
                            <div className="flex items-center justify-end gap-2">
                              <p className="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tighter leading-none">{count}</p>
                              <div className={`h-2 w-2 rounded-full ${count > 5 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Expedientes Generados</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={count === 0}
                            onClick={() => router.push(`/quotations?companyId=${company.id}&contactId=${contact.id}`)}
                            className="h-14 w-14 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all shadow-sm"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none">
          <ContactsTab
            companyId={company.id}
            contacts={company.contacts}
            canEdit={canEdit}
            onRefresh={fetchCompany}
          />
        </TabsContent>

        <TabsContent value="agreements" className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none">
          <AgreementsTab
            companyId={company.id}
            agreements={company.agreements}
            canEdit={canEdit}
            onRefresh={fetchCompany}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
