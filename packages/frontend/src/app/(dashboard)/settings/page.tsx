'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/components/ui/toast';
import { Save, Upload, Image as ImageIcon } from 'lucide-react';

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<CompanySettings>('/config/company');
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
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingLogo || uploadingSignature) return;

    setSaving(true);
    try {
      const saved = await api.put<CompanySettings>('/config/company', settings);
      setSettings(saved);
      addToast('Configuraciones guardadas correctamente', 'success');
    } catch (err: any) {
      addToast(err.message || 'Error al guardar configuraciones', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      addToast('Selecciona una imagen válida', 'error');
      return;
    }

    setUploadingLogo(true);
    const storageRef = ref(storage, `company/logo_${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    addToast('Subiendo logo...', 'success'); // using success for lack of loading toast in this simple hook

    task.on(
      'state_changed',
      () => {},
      (error) => {
        setUploadingLogo(false);
        addToast('Error al subir el logo', 'error');
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setSettings(prev => ({ ...prev, logoUrl: url }));
          setUploadingLogo(false);
          addToast('Logo subido correctamente (recuerda guardar los cambios)', 'success');
        } catch (err) {
          setUploadingLogo(false);
          addToast('Error al subir el logo', 'error');
        }
      }
    );
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Selecciona una imagen válida para la firma', 'error');
      return;
    }

    setUploadingSignature(true);
    const storageRef = ref(storage, `company/signature_${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    addToast('Subiendo firma...', 'success');

    task.on(
      'state_changed',
      () => {},
      (error) => {
        setUploadingSignature(false);
        addToast('Error al subir la firma', 'error');
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setSettings(prev => ({ ...prev, signatureUrl: url }));
          setUploadingSignature(false);
          addToast('Firma subida correctamente (recuerda guardar los cambios)', 'success');
        } catch (err) {
          setUploadingSignature(false);
          addToast('Error al subir la firma', 'error');
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de la Empresa</h1>
        <p className="mt-1 text-sm text-gray-500">
          Estos datos se utilizarán para generar los documentos PDF de las cotizaciones.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
        <form onSubmit={handleSave} className="p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
            <div className="md:col-span-1">
              <h2 className="text-base font-semibold leading-7 text-gray-900">Logotipo</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Aparecerá en el encabezado de las cotizaciones.
              </p>

              <div className="mt-6 flex flex-col items-center gap-4">
                {settings.logoUrl ? (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                  </div>
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                
                <label className="relative cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                  <span>{settings.logoUrl ? 'Cambiar logo' : 'Subir logo'}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
              </div>
            </div>

            <div className="md:col-span-1 border-t border-gray-900/5 pt-8 mt-8 md:border-t-0 md:pt-0 md:mt-0">
              <h2 className="text-base font-semibold leading-7 text-gray-900">Firma Digital</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Se usará al final de la cotización.
              </p>

              <div className="mt-6 flex flex-col items-center gap-4">
                {settings.signatureUrl ? (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <img src={settings.signatureUrl} alt="Firma" className="h-full w-full object-contain p-2" />
                  </div>
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                
                <label className="relative cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                  <span>{settings.signatureUrl ? 'Cambiar firma' : 'Subir firma'}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleSignatureUpload}
                    disabled={uploadingSignature}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3 mt-8 pt-8 border-t border-gray-900/10">
            <div className="md:col-span-1">
              <h2 className="text-base font-semibold leading-7 text-gray-900">Datos Generales</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Información básica de la empresa para los documentos.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6 md:col-span-2">
              <div className="sm:col-span-4">
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
                  Razón Social / Nombre de la Empresa
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={settings.name}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ruc" className="block text-sm font-medium leading-6 text-gray-900">
                  RUC
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="ruc"
                    id="ruc"
                    value={settings.ruc}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-full">
                <label htmlFor="slogan" className="block text-sm font-medium leading-6 text-gray-900">
                  Eslogan Comercial (Opcional)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="slogan"
                    id="slogan"
                    value={settings.slogan}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ruc" className="block text-sm font-medium leading-6 text-gray-900">
                  RUC
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="ruc"
                    id="ruc"
                    value={settings.ruc}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-full">
                <label htmlFor="address" className="block text-sm font-medium leading-6 text-gray-900">
                  Dirección
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={settings.address}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="legalRepresentative" className="block text-sm font-medium leading-6 text-gray-900">
                  Representante Legal
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="legalRepresentative"
                    id="legalRepresentative"
                    value={settings.legalRepresentative}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="legalRepresentativeRole" className="block text-sm font-medium leading-6 text-gray-900">
                  Cargo del Representante (Ej. Gerente General)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="legalRepresentativeRole"
                    id="legalRepresentativeRole"
                    value={settings.legalRepresentativeRole}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-900">
                  Teléfono principal
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    value={settings.phone}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                  Correo electrónico
                </label>
                <div className="mt-2">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={settings.email}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-full">
                <label htmlFor="website" className="block text-sm font-medium leading-6 text-gray-900">
                  Sitio Web (Opcional)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="website"
                    id="website"
                    value={settings.website}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3 mt-8 pt-8 border-t border-gray-900/10">
            <div className="md:col-span-1">
              <h2 className="text-base font-semibold leading-7 text-gray-900">Opciones por Defecto</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Valores predeterminados para nuevas cotizaciones.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6 md:col-span-2">
              <div className="sm:col-span-2">
                <label htmlFor="defaultCurrency" className="block text-sm font-medium leading-6 text-gray-900">
                  Moneda por Defecto
                </label>
                <div className="mt-2">
                  <select
                    id="defaultCurrency"
                    name="defaultCurrency"
                    value={settings.defaultCurrency}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="defaultValidityDays" className="block text-sm font-medium leading-6 text-gray-900">
                  Días de Validez
                </label>
                <div className="mt-2">
                  <input
                    type="number"
                    name="defaultValidityDays"
                    id="defaultValidityDays"
                    min="1"
                    value={settings.defaultValidityDays}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="defaultIgvPercentage" className="block text-sm font-medium leading-6 text-gray-900">
                  % IGV
                </label>
                <div className="mt-2">
                  <input
                    type="number"
                    name="defaultIgvPercentage"
                    id="defaultIgvPercentage"
                    min="0"
                    max="100"
                    value={settings.defaultIgvPercentage}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-full mt-4">
                <h3 className="text-sm font-medium text-gray-900">Información para documentos</h3>
                <hr className="mt-2 mb-4" />
              </div>

              <div className="sm:col-span-full">
                <label htmlFor="bankDetails" className="block text-sm font-medium leading-6 text-gray-900">
                  Cuentas Bancarias (Aparecerán al pie de la cotización)
                </label>
                <div className="mt-2">
                  <textarea
                    id="bankDetails"
                    name="bankDetails"
                    rows={4}
                    value={settings.bankDetails}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-full">
                <label htmlFor="notes" className="block text-sm font-medium leading-6 text-gray-900">
                  Términos y Condiciones / Notas por defecto
                </label>
                <div className="mt-2">
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={settings.notes}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end border-t border-gray-900/10 pt-6">
            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingSignature}
              className="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
