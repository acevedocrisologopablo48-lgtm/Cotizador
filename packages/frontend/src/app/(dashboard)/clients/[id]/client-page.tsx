'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
import { ArrowLeft, Save, Pencil, X } from 'lucide-react';
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
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
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
        businessName: res.data.businessName,
        tradeName: res.data.tradeName || '',
        address: res.data.address || '',
        industrySector: res.data.industrySector || '',
        notes: res.data.notes || '',
      });
    } catch {
      addToast('No se pudo cargar el cliente', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, id, addToast]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(
        `/companies/${id}`,
        {
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

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Cliente no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {company.tradeName || company.businessName}
              </h1>
              <Badge variant={company.isActive ? 'default' : 'secondary'}>
                {company.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono">{company.ruc}</p>
          </div>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="contacts">
            Contactos ({company.contacts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="agreements">
            Acuerdos ({company.agreements?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos de la empresa</CardTitle>
              <CardDescription>
                Registrado el {new Date(company.createdAt).toLocaleDateString('es-PE')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Razón social</Label>
                    <Input value={form.businessName} onChange={set('businessName')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre comercial</Label>
                    <Input value={form.tradeName} onChange={set('tradeName')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input value={form.address} onChange={set('address')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sector industrial</Label>
                    <Input value={form.industrySector} onChange={set('industrySector')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={form.notes} onChange={set('notes')} rows={3} />
                  </div>
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Razón social</dt>
                    <dd className="mt-1">{company.businessName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Nombre comercial</dt>
                    <dd className="mt-1">{company.tradeName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Dirección</dt>
                    <dd className="mt-1">{company.address || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Sector industrial</dt>
                    <dd className="mt-1">{company.industrySector || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-muted-foreground">Notas</dt>
                    <dd className="mt-1">{company.notes || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Cotizaciones</dt>
                    <dd className="mt-1 text-lg font-semibold">{company._count?.quotations ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Proyectos</dt>
                    <dd className="mt-1 text-lg font-semibold">{company._count?.projects ?? 0}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab
            companyId={company.id}
            contacts={company.contacts}
            canEdit={canEdit}
            onRefresh={fetchCompany}
          />
        </TabsContent>

        <TabsContent value="agreements">
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
