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
  ShieldCheck, CreditCard, Ruler, FileCheck2, Download, FileText,
} from 'lucide-react';
import { DocumentType, EmployeeStatus } from '@fym/shared';
import type { Employee } from '@/lib/types/hr';

const DEPARTMENTS = [
  'Obras Civiles', 'Administración', 'Logística', 'Seguridad SST',
  'Topografía', 'Instalaciones', 'Metalmecánica', 'Otros',
];

const DOC_TYPES = [DocumentType.DNI, DocumentType.CE, DocumentType.PASAPORTE] as const;
const PERSONNEL_GROUPS = [
  { value: 'CURRENT', label: 'Personal actual' },
  { value: 'BACKUP', label: 'Personal en backup' },
];

const emptyForm = {
  fullName: '',
  paternalLastName: '',
  maternalLastName: '',
  names: '',
  documentType: DocumentType.DNI as typeof DOC_TYPES[number],
  documentNumber: '',
  position: '',
  department: '',
  startDate: new Date().toISOString().slice(0, 10),
  birthDate: '',
  gender: '',
  civilStatus: '',
  childrenCount: '',
  address: '',
  mainSkills: '',
  medicalNotes: '',
  hasDriverLicense: false,
  driverLicense: '',
  phone: '',
  email: '',
  bankName: '',
  bankAccountNumber: '',
  cci: '',
  accountType: '',
  yapePlinNumber: '',
  shoeSize: '',
  shirtSize: '',
  pantsSize: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactPhone2: '',
  inductionPassed: false,
  safetyDocumentsDelivered: false,
  sctrSalary: '1130',
  personnelGroup: 'CURRENT',
};

export default function HrEmployeesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [projectExportOpen, setProjectExportOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [exportingProject, setExportingProject] = useState(false);

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

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<{ data: any[] }>('/projects?pageSize=100', token);
      setProjects(res.data || []);
    } catch {
      setProjects([]);
    }
  }, [token]);

  // Lectura inicial de ?search= en la URL para deep-link desde otros módulos (ej: asistencias).
  // Se hace en useEffect (client-only) para evitar requerir Suspense con useSearchParams en SSG.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('search');
    if (initial) {
      setSearch(initial);
      setStatusFilter('ALL');
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadEmployees(search || undefined, statusFilter);
      loadProjects();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, statusFilter]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => employees.some((employee) => employee.id === id)));
  }, [employees]);

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
      ...emptyForm,
      fullName: emp.fullName ?? '',
      paternalLastName: emp.paternalLastName ?? '',
      maternalLastName: emp.maternalLastName ?? '',
      names: emp.names ?? '',
      documentType: emp.documentType ?? DocumentType.DNI,
      documentNumber: emp.documentNumber ?? '',
      position: emp.position ?? '',
      department: emp.department ?? '',
      startDate: emp.startDate?.slice(0, 10) ?? '',
      birthDate: emp.birthDate?.slice(0, 10) ?? '',
      gender: emp.gender ?? '',
      civilStatus: emp.civilStatus ?? '',
      childrenCount: emp.childrenCount != null ? String(emp.childrenCount) : '',
      address: emp.address ?? '',
      mainSkills: emp.mainSkills ?? '',
      medicalNotes: emp.medicalNotes ?? '',
      hasDriverLicense: !!emp.hasDriverLicense,
      driverLicense: emp.driverLicense ?? '',
      phone: emp.phone ?? '',
      email: emp.email ?? '',
      bankName: emp.bankName ?? '',
      bankAccountNumber: emp.bankAccountNumber ?? '',
      cci: emp.cci ?? '',
      accountType: emp.accountType ?? '',
      yapePlinNumber: emp.yapePlinNumber ?? '',
      shoeSize: emp.shoeSize ?? '',
      shirtSize: emp.shirtSize ?? '',
      pantsSize: emp.pantsSize ?? '',
      emergencyContactName: emp.emergencyContactName ?? '',
      emergencyContactPhone: emp.emergencyContactPhone ?? '',
      emergencyContactPhone2: emp.emergencyContactPhone2 ?? '',
      inductionPassed: !!emp.inductionPassed,
      safetyDocumentsDelivered: !!emp.safetyDocumentsDelivered,
      sctrSalary: emp.sctrSalary != null ? String(emp.sctrSalary) : '1130',
      personnelGroup: emp.personnelGroup ?? 'CURRENT',
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
      const numberOrUndefined = (value: string) => {
        if (value === '') return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      };
      const body = {
        ...form,
        phone: form.phone || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate || undefined,
        childrenCount: numberOrUndefined(form.childrenCount),
        sctrSalary: numberOrUndefined(form.sctrSalary),
        paternalLastName: form.paternalLastName || undefined,
        maternalLastName: form.maternalLastName || undefined,
        names: form.names || undefined,
        gender: form.gender || undefined,
        civilStatus: form.civilStatus || undefined,
        address: form.address || undefined,
        mainSkills: form.mainSkills || undefined,
        medicalNotes: form.medicalNotes || undefined,
        driverLicense: form.driverLicense || undefined,
        bankName: form.bankName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        cci: form.cci || undefined,
        accountType: form.accountType || undefined,
        yapePlinNumber: form.yapePlinNumber || undefined,
        shoeSize: form.shoeSize || undefined,
        shirtSize: form.shirtSize || undefined,
        pantsSize: form.pantsSize || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        emergencyContactPhone2: form.emergencyContactPhone2 || undefined,
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

  const exportSctr = async () => {
    try {
      const label = new Date().toISOString().slice(0, 7);
      const employeeIds = selectedIds.length
        ? selectedIds
        : employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => employee.id);
      await api.downloadPost('/hr/employees/exports/sctr', { employeeIds }, `personal-sctr-${label}.xlsx`, token!);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const visibleActiveIds = employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => employee.id);
  const allVisibleSelected = visibleActiveIds.length > 0 && visibleActiveIds.every((id) => selectedIds.includes(id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleActiveIds.includes(id));
      return Array.from(new Set([...current, ...visibleActiveIds]));
    });
  };

  const exportProjectPersonnel = async () => {
    if (!selectedProjectId) {
      addToast('Selecciona un proyecto', 'error');
      return;
    }
    if (selectedIds.length === 0) {
      addToast('Selecciona el personal que asistira al proyecto', 'error');
      return;
    }
    setExportingProject(true);
    try {
      const project = projects.find((item) => item.id === selectedProjectId);
      const filename = `personal-zaurak-${project?.projectCode || selectedProjectId}.pdf`;
      await api.downloadPost('/hr/employees/exports/project-personnel', {
        projectId: selectedProjectId,
        employeeIds: selectedIds,
      }, filename, token!);
      addToast('PDF generado y guardado en archivos del proyecto', 'success');
      setProjectExportOpen(false);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setExportingProject(false);
    }
  };

  const field = (key: keyof typeof form, val: (typeof form)[keyof typeof form]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Directorio de Empleados</h1>
          <p className="text-slate-500 dark:text-slate-400">Gestión de legajos y expedientes del personal operativo y administrativo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setProjectExportOpen(true)} className="shadow-sm">
            <FileText className="mr-2 h-4 w-4" /> PDF Proyecto
          </Button>
          <Button variant="outline" onClick={exportSctr} className="shadow-sm">
            <Download className="mr-2 h-4 w-4" /> Exportar SCTR {selectedIds.length ? `(${selectedIds.length})` : ''}
          </Button>
          <Button onClick={openCreate} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
          </Button>
        </div>
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
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4"
                    aria-label="Seleccionar personal visible"
                  />
                </TableHead>
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
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
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
                  <TableCell colSpan={7} className="text-center py-24">
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
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        disabled={emp.status !== 'ACTIVE'}
                        onChange={() => toggleSelected(emp.id)}
                        className="h-4 w-4"
                        aria-label={`Seleccionar ${emp.fullName}`}
                      />
                    </TableCell>
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
      <Dialog open={projectExportOpen} onOpenChange={setProjectExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Listado de personal para proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Se generara un PDF con {selectedIds.length} trabajador(es), separado por Supervisores y Equipo Operario, y se guardara automaticamente en los archivos del proyecto.
            </div>
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectCode} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectExportOpen(false)}>Cancelar</Button>
            <Button onClick={exportProjectPersonnel} disabled={exportingProject || selectedIds.length === 0}>
              {exportingProject ? 'Generando...' : 'Generar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Datos personales</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre completo <span className="text-destructive">*</span></Label>
                  <Input value={form.fullName} onChange={(e) => field('fullName', e.target.value.toUpperCase())} placeholder="ARRIARAN GUERRA MELISSA" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido paterno</Label>
                  <Input value={form.paternalLastName} onChange={(e) => field('paternalLastName', e.target.value.toUpperCase())} placeholder="ARRIARAN" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido materno</Label>
                  <Input value={form.maternalLastName} onChange={(e) => field('maternalLastName', e.target.value.toUpperCase())} placeholder="GUERRA" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombres</Label>
                  <Input value={form.names} onChange={(e) => field('names', e.target.value.toUpperCase())} placeholder="MELISSA" />
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
                  <Label>Numero de documento <span className="text-destructive">*</span></Label>
                  <Input value={form.documentNumber} onChange={(e) => field('documentNumber', e.target.value)} placeholder="12345678" maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={form.birthDate} onChange={(e) => field('birthDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sexo</Label>
                  <Select value={form.gender || '__none__'} onValueChange={(v) => field('gender', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No especificado</SelectItem>
                      <SelectItem value="MASCULINO">Masculino</SelectItem>
                      <SelectItem value="FEMENINO">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Direccion</Label>
                  <Input value={form.address} onChange={(e) => field('address', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Celular</Label>
                  <Input value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="+51 987654321" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => field('email', e.target.value)} placeholder="correo@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado civil</Label>
                  <Input value={form.civilStatus} onChange={(e) => field('civilStatus', e.target.value)} placeholder="Soltero" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cantidad de hijos</Label>
                  <Input type="number" min="0" value={form.childrenCount} onChange={(e) => field('childrenCount', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo <span className="text-destructive">*</span></Label>
                  <Input value={form.position} onChange={(e) => field('position', e.target.value)} placeholder="Tecnico" />
                </div>
                <div className="space-y-1.5">
                  <Label>Departamento <span className="text-destructive">*</span></Label>
                  <Select value={form.department} onValueChange={(v) => field('department', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
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
                  <Label>Grupo SCTR</Label>
                  <Select value={form.personnelGroup} onValueChange={(v) => field('personnelGroup', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERSONNEL_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Habilidades principales</Label>
                  <Input value={form.mainSkills} onChange={(e) => field('mainSkills', e.target.value)} placeholder="Soldadura, montacargas, electricidad" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Condicion medica importante</Label>
                  <Input value={form.medicalNotes} onChange={(e) => field('medicalNotes', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Datos bancarios y pago</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Input value={form.bankName} onChange={(e) => field('bankName', e.target.value)} placeholder="BCP" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de cuenta</Label>
                  <Input value={form.accountType} onChange={(e) => field('accountType', e.target.value)} placeholder="Ahorros" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nro. cuenta</Label>
                  <Input value={form.bankAccountNumber} onChange={(e) => field('bankAccountNumber', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CCI</Label>
                  <Input value={form.cci} onChange={(e) => field('cci', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Yape / Plin autorizado</Label>
                  <Input value={form.yapePlinNumber} onChange={(e) => field('yapePlinNumber', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sueldo SCTR</Label>
                  <Input type="number" min="0" step="0.01" value={form.sctrSalary} onChange={(e) => field('sctrSalary', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Ruler className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider">EPP y contactos</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Talla zapato</Label><Input value={form.shoeSize} onChange={(e) => field('shoeSize', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Talla polo</Label><Input value={form.shirtSize} onChange={(e) => field('shirtSize', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Talla pantalon</Label><Input value={form.pantsSize} onChange={(e) => field('pantsSize', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Contacto emergencia</Label><Input value={form.emergencyContactName} onChange={(e) => field('emergencyContactName', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Celular emergencia</Label><Input value={form.emergencyContactPhone} onChange={(e) => field('emergencyContactPhone', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Celular 2</Label><Input value={form.emergencyContactPhone2} onChange={(e) => field('emergencyContactPhone2', e.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Validacion documentaria</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium">
                  <input type="checkbox" checked={form.hasDriverLicense} onChange={(e) => field('hasDriverLicense', e.target.checked)} className="h-4 w-4" />
                  Licencia de conducir
                </label>
                <Input value={form.driverLicense} onChange={(e) => field('driverLicense', e.target.value)} placeholder="Categoria / detalle" />
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium">
                  <input type="checkbox" checked={form.inductionPassed} onChange={(e) => field('inductionPassed', e.target.checked)} className="h-4 w-4" />
                  Induccion aprobada
                </label>
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium">
                  <input type="checkbox" checked={form.safetyDocumentsDelivered} onChange={(e) => field('safetyDocumentsDelivered', e.target.checked)} className="h-4 w-4" />
                  Documentos de seguridad entregados
                </label>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar empleado'}
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
                {profileEmployee.birthDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Nacimiento: {new Date(profileEmployee.birthDate).toLocaleDateString('es-PE')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>{profileEmployee.personnelGroup === 'BACKUP' ? 'Backup SCTR' : 'Personal actual'}</span>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-2 pt-2">
                  <Badge variant={profileEmployee.inductionPassed ? 'success' : 'secondary'} className="justify-center">
                    Induccion {profileEmployee.inductionPassed ? 'OK' : 'pendiente'}
                  </Badge>
                  <Badge variant={profileEmployee.safetyDocumentsDelivered ? 'success' : 'secondary'} className="justify-center">
                    Docs SST {profileEmployee.safetyDocumentsDelivered ? 'OK' : 'pendiente'}
                  </Badge>
                </div>
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
