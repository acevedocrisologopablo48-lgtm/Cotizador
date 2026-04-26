'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Mail, Phone, Star } from 'lucide-react';
import type { Contact } from './client-page';

interface ContactsTabProps {
  companyId: string;
  contacts: Contact[];
  canEdit: boolean;
  onRefresh: () => void;
}

const emptyForm = {
  fullName: '',
  position: '',
  email: '',
  phone: '',
  isPrimary: false,
};

export function ContactsTab({ companyId, contacts, canEdit, onRefresh }: ContactsTabProps) {
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

  const openEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setForm({
      fullName: contact.fullName,
      position: contact.position || '',
      email: contact.email || '',
      phone: contact.phone || '',
      isPrimary: contact.isPrimary,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      addToast('El nombre es obligatorio', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        position: form.position || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        isPrimary: form.isPrimary,
      };

      if (editingId) {
        await api.put(`/companies/${companyId}/contacts/${editingId}`, payload, token!);
        addToast('Contacto actualizado', 'success');
      } else {
        await api.post(`/companies/${companyId}/contacts`, payload, token!);
        addToast('Contacto creado', 'success');
      }
      setDialogOpen(false);
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Error al guardar contacto', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      await api.delete(`/companies/${companyId}/contacts/${contactId}`, token!);
      addToast('Contacto eliminado', 'success');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Error al eliminar contacto', 'error');
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Contactos</CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Modifica los datos del contacto' : 'Agrega un nuevo contacto para esta empresa'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input value={form.fullName} onChange={set('fullName')} placeholder="Juan Pérez" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={form.position} onChange={set('position')} placeholder="Gerente de operaciones" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Correo</Label>
                    <Input type="email" value={form.email} onChange={set('email')} placeholder="correo@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={form.phone} onChange={set('phone')} placeholder="+51 999 888 777" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={form.isPrimary}
                    onChange={(e) => setForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <Label htmlFor="isPrimary">Contacto principal</Label>
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
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay contactos registrados
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                {canEdit && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {contact.fullName}
                      {contact.isPrimary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          Principal
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{contact.position || '—'}</TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </span>
                    ) : '—'}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(contact)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
