'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewClientPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    ruc: '',
    businessName: '',
    tradeName: '',
    address: '',
    industrySector: '',
    notes: '',
    // Primary contact
    contactName: '',
    contactPosition: '',
    contactEmail: '',
    contactPhone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!/^\d{11}$/.test(form.ruc)) errs.ruc = 'El RUC debe tener 11 dígitos';
    if (!form.businessName.trim()) errs.businessName = 'La razón social es obligatoria';
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errs.contactEmail = 'Email inválido';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const companyRes = await api.post<{ data: { id: string } }>(
        '/companies',
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

      const companyId = companyRes.data.id;

      if (form.contactName.trim()) {
        await api.post(
          `/companies/${companyId}/contacts`,
          {
            fullName: form.contactName,
            position: form.contactPosition || undefined,
            email: form.contactEmail || undefined,
            phone: form.contactPhone || undefined,
            isPrimary: true,
          },
          token!
        );
      }

      addToast(`${form.businessName} registrado exitosamente`, 'success');
      router.push(`/clients/detail?id=${companyId}`);
    } catch (err: any) {
      addToast(err.message || 'Error al crear cliente', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo cliente</h1>
          <p className="text-muted-foreground">Registrar empresa y contacto principal</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos de la empresa</CardTitle>
            <CardDescription>Información legal y comercial del cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ruc">RUC *</Label>
                <Input
                  id="ruc"
                  placeholder="20123456789"
                  maxLength={11}
                  value={form.ruc}
                  onChange={set('ruc')}
                />
                {errors.ruc && <p className="text-xs text-destructive">{errors.ruc}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="industrySector">Sector industrial</Label>
                <Input
                  id="industrySector"
                  placeholder="Minería, Construcción..."
                  value={form.industrySector}
                  onChange={set('industrySector')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Razón social *</Label>
              <Input
                id="businessName"
                placeholder="EMPRESA S.A.C."
                value={form.businessName}
                onChange={set('businessName')}
              />
              {errors.businessName && (
                <p className="text-xs text-destructive">{errors.businessName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeName">Nombre comercial</Label>
              <Input
                id="tradeName"
                placeholder="Nombre comercial (opcional)"
                value={form.tradeName}
                onChange={set('tradeName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                placeholder="Av. Principal 123, Lima"
                value={form.address}
                onChange={set('address')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Observaciones adicionales..."
                value={form.notes}
                onChange={set('notes')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacto principal</CardTitle>
            <CardDescription>Persona de contacto para gestiones comerciales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">Nombre completo</Label>
                <Input
                  id="contactName"
                  placeholder="Juan Pérez"
                  value={form.contactName}
                  onChange={set('contactName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPosition">Cargo</Label>
                <Input
                  id="contactPosition"
                  placeholder="Gerente de operaciones"
                  value={form.contactPosition}
                  onChange={set('contactPosition')}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Correo</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="contacto@empresa.com"
                  value={form.contactEmail}
                  onChange={set('contactEmail')}
                />
                {errors.contactEmail && (
                  <p className="text-xs text-destructive">{errors.contactEmail}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Teléfono</Label>
                <Input
                  id="contactPhone"
                  placeholder="+51 999 888 777"
                  value={form.contactPhone}
                  onChange={set('contactPhone')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Link href="/clients">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Guardando...' : 'Guardar cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
