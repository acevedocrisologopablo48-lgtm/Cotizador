'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Save, Upload, Image as ImageIcon, Building2, FileText,
  CreditCard, Loader2, CheckCircle2, ChevronRight,
} from 'lucide-react';

interface CompanySettings {
  name: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankDetails: string;
  notes: string;
  logoUrl: string;
  slogan: string;
  legalRepresentative: string;
  legalRepresentativeRole: string;
  defaultCurrency: string;
  defaultValidityDays: number;
  defaultIgvPercentage: number;
  signatureUrl: string;
}

export default function SettingsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [settings, setSettings] = useState<CompanySettings>({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    bankDetails: '',
    notes: '',
    logoUrl: '',
    slogan: '',
    legalRepresentative: '',
    legalRepresentativeRole: '',
    defaultCurrency: 'PEN',
    defaultValidityDays: 15,
    defaultIgvPercentage: 18,
    signatureUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [token]);

  const loadSettings = async () => {
    try {
      const data = await api.get<CompanySettings>('/config/company', token ?? undefined);
      setSettings(data);
    } catch (err: any) {
      addToast(err.message || 'Error al cargar configuraciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingLogo || uploadingSignature) return;

    setSaving(true);
    try {
      const saved = await api.put<CompanySettings>('/config/company', settings, token ?? undefined);
      setSettings(saved);
      setSaved(true);
      addToast('Configuraciones guardadas correctamente', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      addToast(err.message || 'Error al guardar configuraciones', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (
    field: 'logoUrl' | 'signatureUrl',
    setUploading: (v: boolean) => void,
    label: string,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Selecciona una imagen válida', 'error');
      return;
    }

    setUploading(true);
    const storageRef = ref(storage, `company/${field}_${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      () => {},
      () => {
        setUploading(false);
        addToast(`Error al subir ${label}`, 'error');
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setSettings(prev => ({ ...prev, [field]: url }));
          setUploading(false);
          setSaved(false);
          addToast(`${label} subido correctamente (recuerda guardar)`, 'success');
        } catch {
          setUploading(false);
          addToast(`Error al obtener URL de ${label}`, 'error');
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Sincronizando Configuración</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 font-jakarta animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Premium Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-8 py-10 md:px-10 md:py-12 shadow-xl border border-white/[0.05]">
        {/* Background Accents */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="h-[1px] w-8 bg-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">System Architecture</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
              Configuración <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-emerald-400">
                Corporativa
              </span>
            </h1>
            <p className="text-slate-400 font-medium max-w-xl text-sm leading-relaxed tracking-wide">
              Parametrización global de la plataforma, identidad de marca y directrices fiscales para la estandarización de procesos comerciales de alto impacto.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md p-2 rounded-2xl border border-white/10">
              {saved && (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl animate-in zoom-in duration-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sincronizado
                </div>
              )}
              <Button
                onClick={(e) => handleSave(e as any)}
                disabled={saving || uploadingLogo || uploadingSignature}
                className="group relative bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[10px] h-14 px-10 rounded-xl transition-all shadow-2xl shadow-primary/20 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                {saving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando Núcleo...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Ejecutar Cambios
                  </div>
                )}
              </Button>
            </div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Última modificación: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-10">
        {/* Visual Identity Section */}
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Logo Card */}
          <Card className="group relative overflow-hidden border-white/[0.05] bg-slate-900/40 backdrop-blur-2xl rounded-[2rem]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2 text-white">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Identidad Visual
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-8">Logo Corporativo Principal</CardDescription>
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-white/5 text-[9px] font-mono text-slate-400 tracking-tighter">BRAND_ID: 001</div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="relative aspect-video w-full overflow-hidden rounded-3xl border-2 border-dashed border-white/5 bg-slate-950/40 flex items-center justify-center group/img hover:border-primary/30 transition-colors duration-500">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-10 transition-transform duration-700 group-hover/img:scale-105" />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center border border-white/5">
                      <ImageIcon className="h-8 w-8 text-slate-700" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Pending Upload</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">UPLOADING...</span>
                    </div>
                  </div>
                )}
              </div>
              <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 px-6 py-4 transition-all duration-300 group/btn">
                <Upload className="h-4 w-4 text-primary group-hover/btn:scale-110 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Subir Nuevo Logo</span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={handleImageUpload('logoUrl', setUploadingLogo, 'Logo')}
                  disabled={uploadingLogo}
                />
              </label>
            </CardContent>
          </Card>

          {/* Signature Card */}
          <Card className="group relative overflow-hidden border-white/[0.05] bg-slate-900/40 backdrop-blur-2xl rounded-[2rem]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2 text-white">
                    <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                    Firma Legal
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-8">Sello de Autorización Comercial</CardDescription>
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-white/5 text-[9px] font-mono text-slate-400 tracking-tighter">SIG_ID: 001</div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="relative aspect-video w-full overflow-hidden rounded-3xl border-2 border-dashed border-white/5 bg-slate-950/40 flex items-center justify-center group/img hover:border-indigo-500/30 transition-colors duration-500">
                {settings.signatureUrl ? (
                  <img src={settings.signatureUrl} alt="Firma" className="h-full w-full object-contain p-10 transition-transform duration-700 group-hover/img:scale-105" />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center border border-white/5">
                      <FileText className="h-8 w-8 text-slate-700" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Pending Upload</span>
                  </div>
                )}
                {uploadingSignature && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">UPLOADING...</span>
                    </div>
                  </div>
                )}
              </div>
              <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 px-6 py-4 transition-all duration-300 group/btn">
                <Upload className="h-4 w-4 text-indigo-400 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Subir Firma Digital</span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={handleImageUpload('signatureUrl', setUploadingSignature, 'Firma')}
                  disabled={uploadingSignature}
                />
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Corporate Data Section */}
        <Card className="border-white/[0.05] bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-10 py-8 border-b border-white/[0.04]">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              Núcleo de Datos Corporativos
            </h3>
          </div>
          <CardContent className="p-10 space-y-10">
            <div className="grid gap-10 md:grid-cols-12">
              <div className="md:col-span-8 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Razón Social Completa</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <input
                    name="name"
                    type="text"
                    value={settings.name}
                    onChange={handleChange}
                    className="relative w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-bold text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Nombre legal de la compañía..."
                  />
                </div>
              </div>
              <div className="md:col-span-4 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">RUC (Registro Único)</label>
                <input
                  name="ruc"
                  type="text"
                  value={settings.ruc}
                  onChange={handleChange}
                  maxLength={11}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black font-mono text-emerald-400 tracking-[0.1em] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Eslogan Estratégico</label>
              <input
                name="slogan"
                type="text"
                value={settings.slogan}
                onChange={handleChange}
                placeholder="Escribe el mensaje institucional..."
                className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-medium text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Domicilio Fiscal</label>
              <input
                name="address"
                type="text"
                value={settings.address}
                onChange={handleChange}
                className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-medium text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="grid gap-10 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Representante Autorizado</label>
                <input
                  name="legalRepresentative"
                  type="text"
                  value={settings.legalRepresentative}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-bold text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Cargo Ejecutivo</label>
                <input
                  name="legalRepresentativeRole"
                  type="text"
                  value={settings.legalRepresentativeRole}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black text-primary tracking-tight focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Contacto Telefónico</label>
                <input
                  name="phone"
                  type="text"
                  value={settings.phone}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black font-mono text-slate-300 tracking-widest focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Correo Electrónico</label>
                <input
                  name="email"
                  type="email"
                  value={settings.email}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-bold text-slate-300 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Portal Corporativo</label>
                <input
                  name="website"
                  type="text"
                  value={settings.website}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all underline decoration-primary/30 underline-offset-4"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Parameters Section */}
        <Card className="border-white/[0.05] bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-10 py-8 border-b border-white/[0.04]">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              Parámetros Financieros & Operativos
            </h3>
          </div>
          <CardContent className="p-10 space-y-10">
            <div className="grid gap-10 md:grid-cols-3">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Divisa de Referencia</label>
                <div className="relative">
                  <select
                    name="defaultCurrency"
                    value={settings.defaultCurrency}
                    onChange={handleChange}
                    className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black text-white tracking-[0.2em] outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none uppercase"
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Vigencia Propuesta (Días)</label>
                <div className="relative">
                  <input
                    name="defaultValidityDays"
                    type="number"
                    min="1"
                    value={settings.defaultValidityDays}
                    onChange={handleChange}
                    className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black font-mono text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-black text-slate-600 uppercase tracking-widest">DAYS</div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Impuesto General (IGV)</label>
                <div className="relative">
                  <input
                    name="defaultIgvPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.defaultIgvPercentage}
                    onChange={handleChange}
                    className="w-full bg-slate-950/50 border-white/[0.05] rounded-2xl px-6 py-4 text-[15px] font-black font-mono text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">% TAX</div>
                </div>
              </div>
            </div>

            <Separator className="bg-white/[0.05]" />

            <div className="grid gap-10 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Canales de Recaudación (Bancos)</label>
                <p className="text-[9px] font-bold uppercase text-slate-600 tracking-wider ml-1 mb-2 italic">Sección informativa para footer de documentos</p>
                <textarea
                  name="bankDetails"
                  rows={6}
                  value={settings.bankDetails}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-3xl px-8 py-6 text-[13px] font-mono font-medium text-emerald-500/80 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none leading-relaxed"
                  placeholder="BCP Soles: 191-XXXXXXXX-X-XX..."
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Términos & Cláusulas Estándar</label>
                <p className="text-[9px] font-bold uppercase text-slate-600 tracking-wider ml-1 mb-2 italic">Notas legales por defecto en propuestas</p>
                <textarea
                  name="notes"
                  rows={6}
                  value={settings.notes}
                  onChange={handleChange}
                  className="w-full bg-slate-950/50 border-white/[0.05] rounded-3xl px-8 py-6 text-[13px] font-medium text-slate-400 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none leading-relaxed"
                  placeholder="1. Tiempo de entrega: 5 días hábiles..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
