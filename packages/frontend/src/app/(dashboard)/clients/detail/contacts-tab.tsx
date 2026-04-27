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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Mail, Phone, ShieldCheck, UserPlus, MoreVertical, Contact2 } from 'lucide-react';
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

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card className="border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/10 dark:bg-slate-950/20 px-10 py-8">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Directorio Focal de Contactos</CardTitle>
          <p className="text-xs font-medium text-slate-400 mt-1">Interlocutores registrados para gestiones operativas</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 transition-all">
            <UserPlus className="mr-2 h-4 w-4" />
            Vincular Nodo
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {contacts.length === 0 ? (
          <div className="py-32 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="h-20 w-20 rounded-3xl bg-slate-900/5 flex items-center justify-center border border-slate-200 dark:border-white/5">
                <Contact2 className="h-10 w-10 text-slate-300" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No se han registrado nodos de contacto para este socio.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5 pl-10">Colaborador / Rango</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Identidad Digital</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 py-5">Canal Telefónico</TableHead>
                {canEdit && <TableHead className="w-[120px] pr-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="group border-white/5 hover:bg-white/60 dark:hover:bg-white/5 transition-all">
                  <TableCell className="pl-10 py-6">
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:rotate-3 transition-transform">
                        {contact.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{contact.fullName}</span>
                          {contact.isPrimary && (
                            <Badge className="text-[8px] font-black uppercase tracking-widest bg-blue-500 text-white border-none px-2 py-0.5 rounded-md">Master</Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500/70">{contact.position || 'Standard Account'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-6">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 text-xs font-mono font-medium text-slate-500 hover:text-blue-600 transition-colors">
                        <div className="p-1.5 bg-blue-500/5 rounded-lg border border-blue-500/10">
                          <Mail className="h-3 w-3" />
                        </div>
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300 italic">No registrado</span>
                    )}
                  </TableCell>
                  <TableCell className="py-6">
                    {contact.phone ? (
                      <span className="flex items-center gap-2.5 text-xs font-mono font-black text-slate-700 dark:text-slate-300">
                        <div className="p-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                          <Phone className="h-3 w-3 text-emerald-500" />
                        </div>
                        {contact.phone}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 italic">No registrado</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="pr-10 py-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(contact)} className="h-10 w-10 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm">
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)} className="h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-all">
                          <Trash2 className="h-4 w-4" />
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

      {/* ── Contact Management Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl font-jakarta">
          <div className="bg-slate-950 px-8 py-10 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-full bg-blue-500/10 -skew-x-12" />
            <DialogHeader className="relative">
              <DialogTitle className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                  {editingId ? <Pencil className="h-6 w-6 text-orange-400" /> : <UserPlus className="h-6 w-6 text-blue-400" />}
                </div>
                {editingId ? 'Editar Nodo de Contacto' : 'Vinculación de Nuevo Nodo'}
              </DialogTitle>
              <p className="text-slate-400 font-medium text-sm mt-3 leading-relaxed max-w-sm">
                Gestione la identidad y canales de comunicación del interlocutor corporativo.
              </p>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white dark:bg-slate-950">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Identidad Completa *</Label>
              <Input 
                value={form.fullName} 
                onChange={setField('fullName')} 
                placeholder="Nombre y Apellidos del colaborador" 
                className="h-14 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-bold text-base focus:ring-blue-500/20" 
              />
            </div>
            
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Rango / Cargo Corporativo</Label>
              <Input 
                value={form.position} 
                onChange={setField('position')} 
                placeholder="Ej: Gerente de Proyectos, Jefe de Compras..." 
                className="h-14 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-medium text-sm focus:ring-blue-500/20" 
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type="email" 
                    value={form.email} 
                    onChange={setField('email')} 
                    placeholder="mail@empresa.com" 
                    className="h-12 pl-12 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-xs font-bold" 
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Canal de Voz / Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    value={form.phone} 
                    onChange={setField('phone')} 
                    placeholder="+51 000 000 000" 
                    className="h-12 pl-12 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 font-mono text-xs font-bold" 
                  />
                </div>
              </div>
            </div>

            <div 
              className={`flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                form.isPrimary 
                  ? 'bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/10' 
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 hover:border-blue-500/20'
              }`}
              onClick={() => setForm(f => ({ ...f, isPrimary: !f.isPrimary }))}
            >
              <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${
                form.isPrimary ? 'bg-blue-500 shadow-lg' : 'bg-slate-100 dark:bg-white/10'
              }`}>
                {form.isPrimary && <ShieldCheck className="h-4 w-4 text-white" />}
              </div>
              <div className="space-y-0.5">
                <Label className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight cursor-pointer">Definir como Interlocutor Maestro</Label>
                <p className="text-[10px] font-medium text-slate-500">Este contacto aparecerá por defecto en propuestas y comunicaciones.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 gap-3">
            <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-all" onClick={() => setDialogOpen(false)}>CANCELAR</Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="h-14 px-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-slate-200 dark:shadow-none transition-all active:scale-95"
            >
              {isSaving ? 'GUARDANDO...' : editingId ? 'CONFIRMAR CAMBIOS' : 'ESTABLECER VÍNCULO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
