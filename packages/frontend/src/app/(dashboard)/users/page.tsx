'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserRole } from '@fym/shared';
import {
  Shield, Plus, UserX, Pencil, Search, Users,
  Mail, Phone, Calendar, CheckCircle2, XCircle, Loader2, Trash2, AlertTriangle,
} from 'lucide-react';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200' },
  MANAGER: { label: 'Gerente', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ENGINEER: { label: 'Ingeniero', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  FIELD_SUPERVISOR: { label: 'Supervisor', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  ACCOUNTANT: { label: 'Contador', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  VIEWER: { label: 'Lector', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  CLIENT: { label: 'Cliente VIP', color: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const ROLES_LIST = Object.entries(UserRole).map(([, value]) => ({
  value,
  label: ROLE_LABELS[value]?.label || value,
}));

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  allowedProjectIds?: string[];
  allowedProjects?: Array<{ id: string; projectCode: string; name: string }>;
}

const emptyForm = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  role: UserRole.VIEWER as string,
  allowedProjectIds: [] as string[],
};

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; projectCode: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editAllowedProjectIds, setEditAllowedProjectIds] = useState<string[]>([]);

  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    if (currentUser && !isAdmin) {
      addToast('Solo administradores pueden gestionar usuarios', 'error');
      router.replace('/dashboard');
    }
  }, [currentUser, isAdmin, router, addToast]);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      setLoading(true);
      const [usersRes, projectsRes] = await Promise.all([
        api.get<any>('/auth/users', token),
        api.get<any>('/projects?page=1&pageSize=100', token),
      ]);
      setUsers(usersRes.data || []);
      setProjects((projectsRes.data || []).map((project: any) => ({
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
      })));
    } catch (e: any) {
      addToast(e.message || 'Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, addToast]);

  useEffect(() => { load(); }, [load]);

  if (currentUser && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-muted-foreground">
        Acceso restringido a administradores.
      </div>
    );
  }

  const filtered = users.filter(u =>
    !search ||
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Nombre requerido';
    if (!form.email.trim()) errs.email = 'Email requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido';
    if (!form.password || form.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (!form.role) errs.role = 'Selecciona un rol';
    if (form.role === 'CLIENT' && form.allowedProjectIds.length === 0) errs.allowedProjectIds = 'Asigna al menos un proyecto';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/auth/users', {
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        allowedProjectIds: form.role === 'CLIENT' ? form.allowedProjectIds : [],
      }, token!);
      addToast('Usuario creado correctamente', 'success');
      setCreateOpen(false);
      setForm(emptyForm);
      setFormErrors({});
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al crear usuario', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditAllowedProjectIds(u.allowedProjectIds || []);
    setEditOpen(true);
  };

  const handleEditRole = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await api.put(`/auth/users/${editingUser.id}/role`, { role: editRole }, token!);
      if (editRole === 'CLIENT') {
        await api.put(`/auth/users/${editingUser.id}/client-access`, { allowedProjectIds: editAllowedProjectIds }, token!);
      }
      addToast('Rol actualizado', 'success');
      setEditOpen(false);
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al actualizar rol', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === currentUser?.id) {
      addToast('No puedes desactivar tu propia cuenta', 'error');
      return;
    }
    if (!confirm(`¿${u.isActive ? 'Desactivar' : 'Reactivar'} a ${u.fullName}?`)) return;
    try {
      await api.put(`/auth/users/${u.id}/status`, { isActive: !u.isActive }, token!);
      addToast(`Usuario ${u.isActive ? 'desactivado' : 'reactivado'}`, 'success');
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al cambiar estado', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await api.delete(`/auth/users/${userToDelete.id}`, token!);
      addToast('Usuario eliminado correctamente', 'success');
      setDeleteUserOpen(false);
      setUserToDelete(null);
      load();
    } catch (e: any) {
      addToast(e.message || 'Error al eliminar usuario', 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 font-jakarta">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900/40 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Administra accesos, roles y permisos del sistema.</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setForm({
                email: 'cliente.vip.prueba@fymtech.local',
                password: 'Cliente123!',
                fullName: 'Cliente VIP de Prueba',
                phone: '',
                role: 'CLIENT',
                allowedProjectIds: projects[0]?.id ? [projects[0].id] : [],
              });
              setFormErrors({});
              setCreateOpen(true);
            }}
            className="h-10 px-5 rounded-xl font-semibold"
          >
            Usuario de prueba
          </Button>
          <Button onClick={() => { setForm(emptyForm); setFormErrors({}); setCreateOpen(true); }} className="h-10 px-5 rounded-xl font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Usuarios', value: users.length, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Activos', value: users.filter(u => u.isActive).length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Inactivos', value: users.filter(u => !u.isActive).length, color: 'text-slate-500', bg: 'bg-slate-100' },
          { label: 'Clientes VIP', value: users.filter(u => u.role === 'CLIENT').length, color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(s => (
          <Card key={s.label} className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                <Users className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-black font-mono ${s.color}`}>{loading ? '—' : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o rol..."
          className="pl-10 h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider pl-6">Usuario</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Contacto</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Rol</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Estado</TableHead>
              <TableHead className="font-bold text-[11px] uppercase tracking-wider">Creado</TableHead>
              {isAdmin && <TableHead className="w-28"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: isAdmin ? 6 : 5 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(u => {
                const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-slate-100 text-slate-600 border-slate-200' };
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id} className={`border-slate-100 dark:border-slate-800 ${!u.isActive ? 'opacity-50' : ''}`}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-xs font-black shadow">
                          {u.fullName?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-none">{u.fullName}</p>
                          {isSelf && <span className="text-[10px] text-primary font-bold">(tú)</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="font-mono">{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                        {u.role === 'CLIENT' && (
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-600">
                            {(u.allowedProjects || []).map(p => p.projectCode).join(', ') || 'Sin proyecto asignado'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <XCircle className="h-3.5 w-3.5" /> Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(u.createdAt).toLocaleDateString('es-PE')}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(u)} title="Cambiar rol">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className={`h-8 w-8 p-0 ${u.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                            title={u.isActive ? 'Desactivar' : 'Reactivar'}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                            onClick={() => { setUserToDelete(u); setDeleteUserOpen(true); }}
                            disabled={isSelf}
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="h-4 w-4 text-primary" /> Crear Nuevo Usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Nombre completo *</Label>
              <Input
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Ej. Juan Pérez López"
                className={`rounded-xl ${formErrors.fullName ? 'border-red-400' : ''}`}
              />
              {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Correo electrónico *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
                className={`rounded-xl ${formErrors.email ? 'border-red-400' : ''}`}
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Contraseña *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className={`rounded-xl ${formErrors.password ? 'border-red-400' : ''}`}
              />
              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Teléfono</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ej. +51 999 888 777"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Rol *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className={`rounded-xl ${formErrors.role ? 'border-red-400' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_LIST.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role && <p className="text-xs text-red-500">{formErrors.role}</p>}
              {form.role === 'FIELD_SUPERVISOR' && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Acceso operativo: proyectos, fotos de partidas, fotos de facturas sin costo total, asistencias y consultas.
                </p>
              )}
            </div>
            {form.role === 'CLIENT' && (
              <ProjectAccessSelector
                projects={projects}
                selectedIds={form.allowedProjectIds}
                onChange={(allowedProjectIds) => setForm(f => ({ ...f, allowedProjectIds }))}
                error={formErrors.allowedProjectIds}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-4 w-4 text-primary" /> Cambiar Rol
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Usuario: <span className="font-semibold text-foreground">{editingUser.fullName}</span>
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Nuevo Rol</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_LIST.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editRole === 'CLIENT' && (
                <ProjectAccessSelector
                  projects={projects}
                  selectedIds={editAllowedProjectIds}
                  onChange={setEditAllowedProjectIds}
                />
              )}
              {editRole === 'FIELD_SUPERVISOR' && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Acceso operativo: proyectos, fotos de partidas, fotos de facturas sin costo total, asistencias y consultas.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleEditRole} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserOpen} onOpenChange={(open) => { if (!deletingUser) { setDeleteUserOpen(open); if (!open) setUserToDelete(null); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <AlertTriangle className="h-4 w-4" /> Eliminar Usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Esta acción es <span className="font-bold text-foreground">permanente</span> y no se puede deshacer.
            </p>
            {userToDelete && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                <p className="font-semibold text-sm">{userToDelete.fullName}</p>
                <p className="text-xs text-muted-foreground font-mono">{userToDelete.email}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteUserOpen(false); setUserToDelete(null); }} disabled={deletingUser} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleDeleteUser} disabled={deletingUser} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              {deletingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectAccessSelector({
  projects,
  selectedIds,
  onChange,
  error,
}: {
  projects: Array<{ id: string; projectCode: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const toggle = (projectId: string) => {
    if (selectedIds.includes(projectId)) {
      onChange(selectedIds.filter((id) => id !== projectId));
      return;
    }
    onChange([...selectedIds, projectId]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700">
        Proyectos visibles para cliente
      </Label>
      {projects.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay proyectos disponibles para asignar.</p>
      ) : (
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {projects.map((project) => (
            <label key={project.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-2 text-xs shadow-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(project.id)}
                onChange={() => toggle(project.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-black text-slate-800">{project.projectCode}</span>
                <span className="ml-2 font-semibold text-slate-600">{project.name}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-[11px] leading-5 text-violet-700">
        El cliente solo podra ver avances e informes de los proyectos seleccionados.
      </p>
    </div>
  );
}
