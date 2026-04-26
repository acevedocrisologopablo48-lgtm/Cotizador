'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Plus, DollarSign, Users, Wrench, Pencil } from 'lucide-react';



const EXPENSE_CATEGORIES = [
  'MATERIAL', 'EQUIPMENT', 'LABOR', 'SUBCONTRACT', 'TRANSPORT',
  'LODGING', 'FOOD', 'FUEL', 'TOOLS', 'PERMITS', 'OTHER',
];

const WORKER_ROLES = [
  'OPERARIO', 'OFICIAL', 'PEON', 'MAESTRO_OBRA', 'SUPERVISOR',
  'SOLDADOR', 'ELECTRICISTA', 'PINTOR', 'RIGGER', 'ARENADOR',
];

export default function ProjectDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { token } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [workforceDialog, setWorkforceDialog] = useState(false);
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [editProjectDialog, setEditProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });

  const [expenseForm, setExpenseForm] = useState({
    expenseCategory: 'MATERIAL', description: '', amount: '', supplierName: '',
    documentType: 'NONE', documentNumber: '', paymentMethod: 'CASH', expenseDate: '',
  });
  const [workforceForm, setWorkforceForm] = useState({
    workerName: '', workerRole: 'OPERARIO', workDate: '',
    hoursRegular: '8', hoursOvertime: '0', dailyRate: '', overtimeRate: '0',
  });
  const [equipmentForm, setEquipmentForm] = useState({
    equipmentName: '', supplierName: '', rentalType: 'DAILY', startDate: '', dailyRate: '',
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [proj, summ] = await Promise.all([
        api.get<any>(`/projects/${id}`, token!),
        api.get<any>(`/projects/${id}/summary`, token!),
      ]);
      setProject(proj);
      setSummary(summ);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, token, addToast]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (status: string) => {
    try {
      await api.patch(`/projects/${id}/status`, { status }, token!);
      addToast('Estado actualizado', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openEditProject = () => {
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
    });
    setEditProjectDialog(true);
  };

  const saveProject = async () => {
    try {
      await api.patch(`/projects/${id}`, projectForm, token!);
      addToast('Proyecto actualizado', 'success');
      setEditProjectDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addExpense = async () => {
    try {
      await api.post(`/projects/${id}/expenses`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        expenseDate: new Date(expenseForm.expenseDate).toISOString(),
      }, token!);
      addToast('Gasto registrado', 'success');
      setExpenseDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addWorkforce = async () => {
    try {
      await api.post(`/projects/${id}/workforce`, {
        ...workforceForm,
        dailyRate: parseFloat(workforceForm.dailyRate),
        overtimeRate: parseFloat(workforceForm.overtimeRate),
        hoursRegular: parseFloat(workforceForm.hoursRegular),
        hoursOvertime: parseFloat(workforceForm.hoursOvertime),
        workDate: new Date(workforceForm.workDate).toISOString(),
      }, token!);
      addToast('Registro agregado', 'success');
      setWorkforceDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addEquipment = async () => {
    try {
      await api.post(`/projects/${id}/equipment`, {
        ...equipmentForm,
        dailyRate: parseFloat(equipmentForm.dailyRate),
        startDate: new Date(equipmentForm.startDate).toISOString(),
      }, token!);
      addToast('Equipo registrado', 'success');
      setEquipmentDialog(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!project) return <p className="text-center py-8 text-muted-foreground">Proyecto no encontrado</p>;

  const budgetPercent = summary?.percentUsed || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => router.push('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{project.projectCode}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground mt-0.5">{project.name}</p>
            {project.company && (
              <p className="text-sm text-muted-foreground">{project.company.businessName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={openEditProject}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          {project.status === 'PLANNING' && (
            <Button size="sm" onClick={() => updateStatus('IN_PROGRESS')}>Iniciar</Button>
          )}
          {project.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" size="sm" onClick={() => updateStatus('ON_HOLD')}>Pausar</Button>
              <Button size="sm" onClick={() => updateStatus('COMPLETED')}>Completar</Button>
            </>
          )}
          {project.status === 'ON_HOLD' && (
            <Button size="sm" onClick={() => updateStatus('IN_PROGRESS')}>Reanudar</Button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Presupuesto</p>
              <p className="font-mono text-xl font-bold">PEN {summary.budget.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Gastado</p>
              <p className={`font-mono text-xl font-bold ${budgetPercent > 90 ? 'text-destructive' : ''}`}>
                PEN {summary.totalSpent.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Restante</p>
              <p className={`font-mono text-xl font-bold ${summary.remaining < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                PEN {summary.remaining.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className={budgetPercent > 90 ? 'border-destructive/30 bg-destructive/5' : ''}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Uso del Presupuesto</p>
              <p className="font-mono text-xl font-bold">{budgetPercent.toFixed(1)}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${budgetPercent > 90 ? 'bg-destructive' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses"><DollarSign className="mr-1 h-4 w-4" />Gastos</TabsTrigger>
          <TabsTrigger value="workforce"><Users className="mr-1 h-4 w-4" />Mano de Obra</TabsTrigger>
          <TabsTrigger value="equipment"><Wrench className="mr-1 h-4 w-4" />Equipos</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setExpenseForm({ expenseCategory: 'MATERIAL', description: '', amount: '', supplierName: '', documentType: 'NONE', documentNumber: '', paymentMethod: 'CASH', expenseDate: new Date().toISOString().split('T')[0] }); setExpenseDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />Registrar Gasto
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead>
                <TableHead>Proveedor</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Registrado por</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(project.expenses || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin gastos registrados</TableCell></TableRow>
                ) : project.expenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.expenseDate).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell><Badge variant="outline">{e.expenseCategory}</Badge></TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{e.supplierName || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell>{e.registeredByUser?.fullName || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="workforce" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setWorkforceForm({ workerName: '', workerRole: 'OPERARIO', workDate: new Date().toISOString().split('T')[0], hoursRegular: '8', hoursOvertime: '0', dailyRate: '', overtimeRate: '0' }); setWorkforceDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />Registrar Jornada
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fecha</TableHead><TableHead>Trabajador</TableHead><TableHead>Rol</TableHead>
                <TableHead className="text-right">Hrs</TableHead><TableHead className="text-right">Hrs Extra</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(project.workforceLogs || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin registros</TableCell></TableRow>
                ) : project.workforceLogs.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell>{new Date(w.workDate).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell>{w.workerName}</TableCell>
                    <TableCell><Badge variant="outline">{w.workerRole}</Badge></TableCell>
                    <TableCell className="text-right">{Number(w.hoursRegular)}</TableCell>
                    <TableCell className="text-right">{Number(w.hoursOvertime)}</TableCell>
                    <TableCell className="text-right font-mono">{Number(w.totalCost).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEquipmentForm({ equipmentName: '', supplierName: '', rentalType: 'DAILY', startDate: new Date().toISOString().split('T')[0], dailyRate: '' }); setEquipmentDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />Registrar Equipo
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Equipo</TableHead><TableHead>Proveedor</TableHead><TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead><TableHead className="text-right">Tarifa/Día</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(project.equipmentLogs || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin registros</TableCell></TableRow>
                ) : project.equipmentLogs.map((eq: any) => (
                  <TableRow key={eq.id}>
                    <TableCell>{eq.equipmentName}</TableCell>
                    <TableCell>{eq.supplierName || '—'}</TableCell>
                    <TableCell>{new Date(eq.startDate).toLocaleDateString('es-PE')}</TableCell>
                    <TableCell>{eq.endDate ? new Date(eq.endDate).toLocaleDateString('es-PE') : 'En uso'}</TableCell>
                    <TableCell className="text-right font-mono">{Number(eq.dailyRate).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{Number(eq.totalCost).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Expense Dialog */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Gasto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Select value={expenseForm.expenseCategory} onValueChange={v => setExpenseForm(f => ({ ...f, expenseCategory: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Fecha</Label><Input type="date" value={expenseForm.expenseDate} onChange={e => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
            </div>
            <div><Label>Descripción</Label><Input value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monto</Label><Input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Proveedor</Label><Input value={expenseForm.supplierName} onChange={e => setExpenseForm(f => ({ ...f, supplierName: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>Cancelar</Button>
            <Button onClick={addExpense}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workforce Dialog */}
      <Dialog open={workforceDialog} onOpenChange={setWorkforceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Jornada</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Trabajador</Label><Input value={workforceForm.workerName} onChange={e => setWorkforceForm(f => ({ ...f, workerName: e.target.value }))} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={workforceForm.workerRole} onValueChange={v => setWorkforceForm(f => ({ ...f, workerRole: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WORKER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Fecha</Label><Input type="date" value={workforceForm.workDate} onChange={e => setWorkforceForm(f => ({ ...f, workDate: e.target.value }))} /></div>
              <div><Label>Hrs Regulares</Label><Input type="number" value={workforceForm.hoursRegular} onChange={e => setWorkforceForm(f => ({ ...f, hoursRegular: e.target.value }))} /></div>
              <div><Label>Hrs Extra</Label><Input type="number" value={workforceForm.hoursOvertime} onChange={e => setWorkforceForm(f => ({ ...f, hoursOvertime: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tarifa Diaria</Label><Input type="number" step="0.01" value={workforceForm.dailyRate} onChange={e => setWorkforceForm(f => ({ ...f, dailyRate: e.target.value }))} /></div>
              <div><Label>Tarifa HE</Label><Input type="number" step="0.01" value={workforceForm.overtimeRate} onChange={e => setWorkforceForm(f => ({ ...f, overtimeRate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkforceDialog(false)}>Cancelar</Button>
            <Button onClick={addWorkforce}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Dialog */}
      <Dialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Equipo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Equipo</Label><Input value={equipmentForm.equipmentName} onChange={e => setEquipmentForm(f => ({ ...f, equipmentName: e.target.value }))} /></div>
              <div><Label>Proveedor</Label><Input value={equipmentForm.supplierName} onChange={e => setEquipmentForm(f => ({ ...f, supplierName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fecha Inicio</Label><Input type="date" value={equipmentForm.startDate} onChange={e => setEquipmentForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>Tarifa Diaria</Label><Input type="number" step="0.01" value={equipmentForm.dailyRate} onChange={e => setEquipmentForm(f => ({ ...f, dailyRate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipmentDialog(false)}>Cancelar</Button>
            <Button onClick={addEquipment}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectDialog} onOpenChange={setEditProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Proyecto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="proj-name">Nombre del Proyecto</Label>
              <Input id="proj-name" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="proj-desc">Descripción</Label>
              <Input id="proj-desc" value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del alcance del proyecto" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProjectDialog(false)}>Cancelar</Button>
            <Button onClick={saveProject}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
