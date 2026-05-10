'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Search, Store, Trash2, Pencil, PackagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ContactForm = { name: string; phone: string; email: string; role: string };
type ProductForm = { id?: string; name: string; description: string; unit: string; unitPrice: string; currency: string };

const emptyContact: ContactForm = { name: '', phone: '', email: '', role: '' };
const emptyProduct: ProductForm = { name: '', description: '', unit: 'UND', unitPrice: '', currency: 'PEN' };

export default function ProvidersPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [providers, setProviders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    productLine: '',
    notes: '',
    contacts: [{ ...emptyContact }] as ContactForm[],
    products: [{ ...emptyProduct }] as ProductForm[],
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const url = `/providers?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await api.get<any>(url, token);
      setProviders(res.data || []);
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, search, token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      ruc: '',
      address: '',
      phone: '',
      email: '',
      productLine: '',
      notes: '',
      contacts: [{ ...emptyContact }],
      products: [{ ...emptyProduct }],
    });
    setDialogOpen(true);
  };

  const openEdit = (provider: any) => {
    setEditing(provider);
    setForm({
      name: provider.name || '',
      ruc: provider.ruc || '',
      address: provider.address || '',
      phone: provider.phone || '',
      email: provider.email || '',
      productLine: provider.productLine || '',
      notes: provider.notes || '',
      contacts: provider.contacts?.length ? provider.contacts : [{ ...emptyContact }],
      products: provider.products?.length
        ? provider.products.map((product: any) => ({ ...product, unitPrice: String(product.unitPrice ?? '') }))
        : [{ ...emptyProduct }],
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      addToast('El nombre del proveedor es obligatorio', 'error');
      return;
    }
    try {
      setSaving(true);
      const body = {
        ...form,
        contacts: form.contacts.filter(c => c.name || c.phone || c.email),
        products: form.products
          .filter(p => p.name)
          .map(p => ({ ...p, unitPrice: Number(p.unitPrice) || 0 })),
      };
      if (editing) {
        await api.put(`/providers/${editing.id}`, body, token!);
        addToast('Proveedor actualizado', 'success');
      } else {
        await api.post('/providers', body, token!);
        addToast('Proveedor creado', 'success');
      }
      setDialogOpen(false);
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (provider: any) => {
    if (!confirm(`Desactivar proveedor ${provider.name}?`)) return;
    try {
      await api.delete(`/providers/${provider.id}`, token!);
      addToast('Proveedor desactivado', 'success');
      load();
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Proveedores</h1>
          <p className="text-sm font-medium text-slate-500">Contactos, tiendas y productos con precios reutilizables en cotizaciones.</p>
        </div>
        <Button onClick={openCreate} className="h-11 rounded-xl font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </Button>
      </section>

      <Card className="rounded-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-10" placeholder="Buscar por tienda, RUC, producto o direccion..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            </div>
            <Button variant="outline" onClick={load}>Buscar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200">
        <CardHeader>
          <CardTitle>Directorio comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor / tienda</TableHead>
                <TableHead>Contactos</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Linea</TableHead>
                <TableHead className="w-[96px] text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">Cargando proveedores...</TableCell></TableRow>
              ) : providers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">No hay proveedores registrados.</TableCell></TableRow>
              ) : providers.map(provider => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <p className="font-black text-slate-900">{provider.name}</p>
                    <p className="text-xs text-slate-500">{provider.ruc || 'Sin RUC'} · {provider.address || 'Sin direccion'}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(provider.contacts || []).slice(0, 2).map((contact: any, i: number) => (
                      <p key={i}><span className="font-semibold">{contact.name}</span> {contact.phone ? `· ${contact.phone}` : ''}</p>
                    ))}
                  </TableCell>
                  <TableCell className="text-sm">{provider.products?.length || 0}</TableCell>
                  <TableCell className="text-sm">{provider.productLine || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(provider)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => remove(provider)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Proveedor / tienda"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="RUC"><Input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} /></Field>
            <Field label="Telefono"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Correo"><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Direccion"><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
            <Field label="Productos que vende"><Input value={form.productLine} onChange={e => setForm(f => ({ ...f, productLine: e.target.value }))} /></Field>
            <div className="md:col-span-2"><Field label="Notas"><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field></div>
          </div>

          <EditableList
            title="Contactos"
            rows={form.contacts}
            addLabel="Agregar contacto"
            onAdd={() => setForm(f => ({ ...f, contacts: [...f.contacts, { ...emptyContact }] }))}
            render={(contact, index) => (
              <div className="grid gap-3 md:grid-cols-4">
                <Input placeholder="Nombre" value={contact.name} onChange={e => setForm(f => updateArray(f, 'contacts', index, { name: e.target.value }))} />
                <Input placeholder="Telefono" value={contact.phone} onChange={e => setForm(f => updateArray(f, 'contacts', index, { phone: e.target.value }))} />
                <Input placeholder="Correo" value={contact.email} onChange={e => setForm(f => updateArray(f, 'contacts', index, { email: e.target.value }))} />
                <Input placeholder="Cargo" value={contact.role} onChange={e => setForm(f => updateArray(f, 'contacts', index, { role: e.target.value }))} />
              </div>
            )}
            onRemove={(index) => setForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== index) }))}
          />

          <EditableList
            title="Productos y precios"
            rows={form.products}
            addLabel="Agregar producto"
            onAdd={() => setForm(f => ({ ...f, products: [...f.products, { ...emptyProduct }] }))}
            render={(product, index) => (
              <div className="grid gap-3 md:grid-cols-5">
                <Input placeholder="Producto" value={product.name} onChange={e => setForm(f => updateArray(f, 'products', index, { name: e.target.value }))} />
                <Input placeholder="Descripcion" value={product.description} onChange={e => setForm(f => updateArray(f, 'products', index, { description: e.target.value }))} />
                <Input placeholder="Und." value={product.unit} onChange={e => setForm(f => updateArray(f, 'products', index, { unit: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="Precio" value={product.unitPrice} onChange={e => setForm(f => updateArray(f, 'products', index, { unitPrice: e.target.value }))} />
                <Input placeholder="Moneda" value={product.currency} onChange={e => setForm(f => updateArray(f, 'products', index, { currency: e.target.value }))} />
              </div>
            )}
            onRemove={(index) => setForm(f => ({ ...f, products: f.products.filter((_, i) => i !== index) }))}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar proveedor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function updateArray<T extends Record<string, any>, K extends 'contacts' | 'products'>(
  form: any,
  key: K,
  index: number,
  patch: Partial<T>,
) {
  return { ...form, [key]: form[key].map((item: T, i: number) => i === index ? { ...item, ...patch } : item) };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5"><Label className="text-xs font-bold uppercase tracking-wide">{label}</Label>{children}</label>;
}

function EditableList<T>({ title, rows, addLabel, render, onAdd, onRemove }: {
  title: string;
  rows: T[];
  addLabel: string;
  render: (row: T, index: number) => ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}><PackagePlus className="mr-2 h-4 w-4" />{addLabel}</Button>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-slate-200 p-3">
            <div className="flex gap-3">
              <div className="flex-1">{render(row, index)}</div>
              <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => onRemove(index)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
