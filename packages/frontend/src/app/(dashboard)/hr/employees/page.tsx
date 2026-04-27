'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import {
  Users, Plus, Search, Pencil, UserX, UserCheck2,
  Phone, Mail, Calendar, Briefcase, Building2,
} from 'lucide-react';
import { DocumentType, EmployeeStatus } from '@fym/shared';
import type { Employee } from '@/lib/types/hr';

const DEPARTMENTS = [
  'Obras Civiles', 'Administración', 'Logística', 'Seguridad SST',
  'Topografía', 'Instalaciones', 'Metalmecánica', 'Otros',
];

const DOC_TYPES = [DocumentType.DNI, DocumentType.CE, DocumentType.PASAPORTE] as const;

const emptyForm = {
  fullName: '',
  documentType: DocumentType.DNI as typeof DOC_TYPES[number],
  documentNumber: '',
  position: '',
  department: '',
  startDate: new Date().toISOString().slice(0, 10),
  phone: '',
  email: '',
};

export default function HrEmployeesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmployeeStatus.ACTIVE | EmployeeStatus.INACTIVE>(EmployeeStatus.ACTIVE);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Profile view
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEmployees = useCallback(async (q?: string, st?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (st && st !== 'ALL') params.set('status', st);
      if (q) params.set('search', q);
      const res = await api.get<{ data: Employee[] }>(`/hr/employees?${params}`, token);
      setEmployees(res.data);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (token) loadEmployees(search || undefined, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadEmployees(val || undefined, statusFilter);
    }, 400);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val as 'ALL' | EmployeeStatus.ACTIVE | EmployeeStatus.INACTIVE);
    loadEmployees(search || undefined, val);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      fullName: emp.fullName,
      documentType: emp.documentType,
      documentNumber: emp.documentNumber,
      position: emp.position,
      department: emp.department,
      startDate: emp.startDate?.slice(0, 10) ?? '',
      phone: emp.phone ?? '',
      email: emp.email ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName || !form.documentNumber || !form.position || !form.department || !form.startDate) {
      addToast('Completa todos los campos obligatorios', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        phone: form.phone || undefined,
        email: form.email || undefined,
      };
      if (editing) {
        await api.patch(`/hr/employees/${editing.id}`, body, token!);
        addToast('Empleado actualizado', 'success');
      } else {
        await api.post('/hr/employees', body, token!);
        addToast('Empleado registrado', 'success');
      }
      setModalOpen(false);
      loadEmployees(search || undefined, statusFilter);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (emp: Employee) => {
    if (!confirm(`¿Desactivar a ${emp.fullName}? Podrá reactivarle editando su estado.`)) return;
    try {
      await api.patch(`/hr/employees/${emp.id}/deactivate`, {}, token!);
      addToast('Empleado desactivado', 'success');
      loadEmployees(search || undefined, statusFilter);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const handleReactivate = async (emp: Employee) => {
    try {
      await api.patch(`/hr/employees/${emp.id}`, { status: EmployeeStatus.ACTIVE }, token!);
      addToast('Empleado reactivado', 'success');
      loadEmployees(search || undefined, statusFilter);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const field = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Directorio de Empleados</h1>
          <p className="text-slate-500 dark:text-slate-400">Gestión de legajos y expedientes del personal operativo y administrativo</p>
        </div>
        <Button onClick={openCreate} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
        </Button>
      </div>

      {/* Filters & Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-3 border-none shadow-sm bg-slate-50/50 dark:bg-slate-900/50">
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, DNI o cargo…"
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado:</span>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Activos</SelectItem>
                  <SelectItem value="INACTIVE">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">Total Personal</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-50">{employees.length}</span>
              <span className="text-xs text-slate-500 font-medium">empleados</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Empleado</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Identificación</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Cargo / Depto.</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">F. Ingreso</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Estado</TableHead>
                <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[70px] rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-24">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Users className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No se encontraron colaboradores</p>
                      <p className="text-sm">Ajusta los filtros o registra un nuevo empleado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <TableCell
                      className="cursor-pointer"
                      onClick={() => { setProfileEmployee(emp); setProfileOpen(true); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-black border border-slate-200 dark:border-slate-700 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                          {emp.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{emp.fullName}</span>
                          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-tighter">{emp.email || 'Sin correo'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{emp.documentType}</span>
                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{emp.documentNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.position}</span>
                        <span className="text-xs text-slate-500">{emp.department}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {emp.startDate ? new Date(emp.startDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={emp.status === 'ACTIVE' ? 'success' : 'secondary'}
                        className="rounded-full px-3"
                      >
                        {emp.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {emp.status === 'ACTIVE' ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => handleDeactivate(emp)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => handleReactivate(emp)}>
                            <UserCheck2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre completo <span className="text-destructive">*</span></Label>
              <Input value={form.fullName} onChange={(e) => field('fullName', e.target.value)} placeholder="Juan Carlos Pérez López" />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Select value={form.documentType} onValueChange={(v) => field('documentType', v as typeof form.documentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Número de documento <span className="text-destructive">*</span></Label>
              <Input value={form.documentNumber} onChange={(e) => field('documentNumber', e.target.value)} placeholder="12345678" maxLength={20} />
            </div>

            <div className="space-y-1.5">
              <Label>Cargo <span className="text-destructive">*</span></Label>
              <Input value={form.position} onChange={(e) => field('position', e.target.value)} placeholder="Operario de Construcción" />
            </div>

            <div className="space-y-1.5">
              <Label>Departamento <span className="text-destructive">*</span></Label>
              <Select value={form.department} onValueChange={(v) => field('department', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Fecha de ingreso <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.startDate} onChange={(e) => field('startDate', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="+51 987654321" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => field('email', e.target.value)} placeholder="correo@empresa.com" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar empleado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile View Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Perfil del Empleado</DialogTitle>
          </DialogHeader>
          {profileEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
                  {profileEmployee.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-base">{profileEmployee.fullName}</p>
                  <p className="text-sm text-muted-foreground">{profileEmployee.position}</p>
                  <Badge variant={profileEmployee.status === 'ACTIVE' ? 'success' : 'secondary'} className="mt-1">
                    {profileEmployee.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{profileEmployee.documentType} {profileEmployee.documentNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{profileEmployee.department}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Ingreso: {profileEmployee.startDate ? new Date(profileEmployee.startDate).toLocaleDateString('es-PE') : '-'}</span>
                </div>
                {profileEmployee.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{profileEmployee.phone}</span>
                  </div>
                )}
                {profileEmployee.email && (
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{profileEmployee.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Cerrar</Button>
            {profileEmployee && (
              <Button onClick={() => { setProfileOpen(false); openEdit(profileEmployee); }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
