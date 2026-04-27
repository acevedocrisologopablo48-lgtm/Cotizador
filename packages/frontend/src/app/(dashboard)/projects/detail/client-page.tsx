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
    <div className="space-y-8 font-jakarta animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header Section */}
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 rounded-2xl bg-white/5 dark:bg-slate-900/50 border border-white/5 hover:bg-white/10 transition-all group shrink-0" 
            onClick={() => router.push('/projects')}
          >
            <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
          </Button>
          
          <div className="space-y-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="px-3 py-1 bg-slate-950 border border-white/10 rounded-lg shadow-xl">
                <span className="text-2xl font-black font-mono tracking-tighter text-white">{project.projectCode}</span>
              </div>
              <div className="h-2 w-2 rounded-full bg-slate-700" />
              <StatusBadge status={project.status} size="lg" className="h-8 px-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em]" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-none uppercase">
                {project.name}
              </h1>
              {project.company && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest">
                    Cliente Partner
                  </div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{project.company.businessName}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/20 p-2 rounded-[1.5rem] border border-white/[0.05] backdrop-blur-xl self-start md:self-center shadow-2xl">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5"
            onClick={openEditProject}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Ajustar
          </Button>

          <div className="w-px h-6 bg-white/5 mx-1 hidden sm:block" />

          {project.status === 'PLANNING' && (
            <Button 
              size="sm" 
              className="h-10 px-8 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90"
              onClick={() => updateStatus('IN_PROGRESS')}
            >
              Lanzar Ejecución
            </Button>
          )}
          {project.status === 'IN_PROGRESS' && (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-10 px-6 rounded-xl text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 font-black text-[10px] uppercase tracking-widest"
                onClick={() => updateStatus('ON_HOLD')}
              >
                Pausar
              </Button>
              <Button 
                size="sm" 
                className="h-10 px-8 rounded-xl bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:opacity-90"
                onClick={() => updateStatus('COMPLETED')}
              >
                Finalizar
              </Button>
            </div>
          )}
          {project.status === 'ON_HOLD' && (
            <Button 
              size="sm" 
              className="h-10 px-8 rounded-xl bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:opacity-90"
              onClick={() => updateStatus('IN_PROGRESS')}
            >
              Reanudar Flujo
            </Button>
          )}
        </div>
      </div>

      {/* Industrial Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden group shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                    <DollarSign className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="px-2 py-0.5 rounded bg-slate-950/50 text-[8px] font-black text-slate-500 uppercase tracking-widest">Target</div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Presupuesto Asignado</p>
                  <p className="text-3xl font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tighter">
                    <span className="text-xs font-bold text-slate-400 mr-2">S/</span>
                    {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(summary.budget)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden group shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border group-hover:scale-110 transition-transform ${budgetPercent > 90 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                    <div className={`h-6 w-6 ${budgetPercent > 90 ? 'text-rose-500' : 'text-amber-500'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14V11z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/><path d="M11.3 11a3 3 0 1 0-2.8 4"/><path d="M2 13h1"/></svg>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-slate-950/50 text-[8px] font-black text-slate-500 uppercase tracking-widest">Real Time</div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Inversión Ejecutada</p>
                  <p className={`text-3xl font-black font-mono tabular-nums tracking-tighter ${budgetPercent > 90 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                    <span className="text-xs font-bold text-slate-400 mr-2">S/</span>
                    {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(summary.totalSpent)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden group shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border group-hover:scale-110 transition-transform ${summary.remaining < 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <div className={`h-6 w-6 ${summary.remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 10-4 4-4-4"/></svg>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-slate-950/50 text-[8px] font-black text-slate-500 uppercase tracking-widest">Flow</div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Diferencial Operativo</p>
                  <p className={`text-3xl font-black font-mono tabular-nums tracking-tighter ${summary.remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    <span className="text-xs font-bold text-slate-400 mr-2">S/</span>
                    {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(summary.remaining)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-white/[0.05] backdrop-blur-xl rounded-[2rem] overflow-hidden group shadow-xl transition-all ${budgetPercent > 90 ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-900 dark:bg-slate-950'}`}>
            <CardContent className="p-8">
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ratio de Eficiencia</p>
                    <div className={`px-2 py-1 rounded-lg font-mono font-black text-xs ${budgetPercent > 90 ? 'bg-rose-500 text-white' : 'bg-primary text-white'}`}>
                      {budgetPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-4 w-full rounded-full bg-slate-800/50 overflow-hidden border border-white/5 p-1">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${
                        budgetPercent > 95 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 
                        budgetPercent > 75 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 
                        'bg-gradient-to-r from-primary to-indigo-600'
                      }`}
                      style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-6 text-right">Utilización del Recurso</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Operations Tabs */}
      <Tabs defaultValue="expenses" className="w-full space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <TabsList className="bg-slate-950/20 border border-white/[0.05] p-1.5 rounded-2xl h-auto self-start">
            <TabsTrigger value="expenses" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <DollarSign className="mr-2 h-4 w-4" />
              Insumos & Gastos
            </TabsTrigger>
            <TabsTrigger value="workforce" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Users className="mr-2 h-4 w-4" />
              Recurso Humano
            </TabsTrigger>
            <TabsTrigger value="equipment" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Wrench className="mr-2 h-4 w-4" />
              Maquinaria & Activos
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-4">
            <TabsContent value="expenses" className="m-0">
              <Button 
                onClick={() => { setExpenseForm({ expenseCategory: 'MATERIAL', description: '', amount: '', supplierName: '', documentType: 'NONE', documentNumber: '', paymentMethod: 'CASH', expenseDate: new Date().toISOString().split('T')[0] }); setExpenseDialog(true); }}
                className="h-12 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-5 w-5" />
                Registrar Gasto
              </Button>
            </TabsContent>
            <TabsContent value="workforce" className="m-0">
              <Button 
                onClick={() => { setWorkforceForm({ workerName: '', workerRole: 'OPERARIO', workDate: new Date().toISOString().split('T')[0], hoursRegular: '8', hoursOvertime: '0', dailyRate: '', overtimeRate: '0' }); setWorkforceDialog(true); }}
                className="h-12 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-5 w-5" />
                Nueva Jornada
              </Button>
            </TabsContent>
            <TabsContent value="equipment" className="m-0">
              <Button 
                onClick={() => { setEquipmentForm({ equipmentName: '', supplierName: '', rentalType: 'DAILY', startDate: new Date().toISOString().split('T')[0], dailyRate: '' }); setEquipmentDialog(true); }}
                className="h-12 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-5 w-5" />
                Vincular Activo
              </Button>
            </TabsContent>
          </div>
        </div>

        <TabsContent value="expenses" className="mt-0 animate-in fade-in slide-in-from-left-4 duration-500 focus-visible:outline-none">
          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/20 border-b border-white/[0.05]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pl-8">Cronología</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Ecosistema</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Descripción Operativa</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Proveedor Partner</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pr-8">Inversión (S/)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(project.expenses || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 text-slate-400">
                        <div className="flex flex-col items-center gap-4 opacity-50">
                          <div className="p-4 bg-slate-950/30 rounded-full border border-white/5">
                            <DollarSign className="h-8 w-8 text-slate-600" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Cero registros detectados</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : project.expenses.map((e: any) => (
                    <TableRow key={e.id} className="border-white/[0.03] hover:bg-white/5 transition-colors group">
                      <TableCell className="py-6 pl-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                            {new Date(e.expenseDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">{new Date(e.expenseDate).getFullYear()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex px-3 py-1 bg-slate-950/50 rounded-lg border border-white/5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {e.expenseCategory}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight uppercase tracking-tight">{e.description}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{e.supplierName || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tighter">
                          {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(e.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="workforce" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none">
          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/20 border-b border-white/[0.05]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pl-8">Fecha</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Trabajador</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Rol Técnico</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Carga Horaria</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pr-8">Costo Total (S/)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(project.workforceLogs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 text-slate-400">
                        <div className="flex flex-col items-center gap-4 opacity-50">
                          <div className="p-4 bg-slate-950/30 rounded-full border border-white/5">
                            <Users className="h-8 w-8 text-slate-600" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin registros de personal</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : project.workforceLogs.map((w: any) => (
                    <TableRow key={w.id} className="border-white/[0.03] hover:bg-white/5 transition-colors group">
                      <TableCell className="py-6 pl-8 font-bold text-slate-500 uppercase text-xs">
                        {new Date(w.workDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center font-black text-white text-sm">
                            {w.workerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{w.workerName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex px-3 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                          {w.workerRole}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black font-mono text-slate-700 dark:text-slate-300">Reg: {w.hoursRegular}h</span>
                          {w.hoursOvertime > 0 && <span className="text-[9px] font-black font-mono text-amber-500">Ext: +{w.hoursOvertime}h</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tighter">
                          {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(w.totalCost)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500 focus-visible:outline-none">
          <Card className="border-white/[0.05] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/20 border-b border-white/[0.05]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pl-8">Activo / Equipo</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Proveedor</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Periodo Operativo</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] text-slate-500 py-6">Tarifa Diaria</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] text-slate-500 py-6 pr-8">Costo Total (S/)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(project.equipmentLogs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 text-slate-400">
                        <div className="flex flex-col items-center gap-4 opacity-50">
                          <div className="p-4 bg-slate-950/30 rounded-full border border-white/5">
                            <Wrench className="h-8 w-8 text-slate-600" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">No se han vinculado activos</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : project.equipmentLogs.map((eq: any) => (
                    <TableRow key={eq.id} className="border-white/[0.03] hover:bg-white/5 transition-colors group">
                      <TableCell className="py-6 pl-8">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                            <Wrench className="h-5 w-5 opacity-50" />
                          </div>
                          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{eq.equipmentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{eq.supplierName || 'Propio'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-1 bg-slate-950/50 rounded-lg text-[9px] font-black font-mono text-slate-400 border border-white/5">
                            {new Date(eq.startDate).toLocaleDateString('es-PE')}
                          </div>
                          <ArrowLeft className="h-3 w-3 rotate-180 text-slate-700" />
                          {eq.endDate ? (
                            <div className="px-2 py-1 bg-slate-950/50 rounded-lg text-[9px] font-black font-mono text-slate-400 border border-white/5">
                              {new Date(eq.endDate).toLocaleDateString('es-PE')}
                            </div>
                          ) : (
                            <div className="px-2 py-1 bg-emerald-500/10 rounded-lg text-[8px] font-black text-emerald-500 border border-emerald-500/20 uppercase tracking-widest animate-pulse">
                              Active Usage
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-black font-mono text-slate-500 tabular-nums tracking-tighter">
                          S/ {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(eq.dailyRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tighter">
                          {Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(eq.totalCost)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modernized Dialogs */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border border-white/10 shadow-2xl bg-white dark:bg-slate-950">
          <div className="bg-gradient-to-br from-slate-900 to-black px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-2xl border border-primary/30 backdrop-blur-md shadow-xl shadow-primary/20">
                  <DollarSign className="h-7 w-7 text-primary" />
                </div>
                Registrar Gasto
              </DialogTitle>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-4 opacity-70">
                Afectación Directa al Presupuesto Operativo
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Clasificación</Label>
                <Select value={expenseForm.expenseCategory} onValueChange={v => setExpenseForm(f => ({ ...f, expenseCategory: v }))}>
                  <SelectTrigger className="h-12 bg-slate-950/50 border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-white/10 bg-slate-950 text-white">
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="rounded-xl focus:bg-primary text-[10px] font-black uppercase tracking-widest py-3">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fecha Contable</Label>
                <Input type="date" className="h-12 bg-slate-950/50 border-white/5 rounded-xl font-mono text-sm font-bold text-center" value={expenseForm.expenseDate} onChange={e => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Descripción de la Transacción</Label>
              <Input className="h-12 bg-slate-950/50 border-white/5 rounded-xl text-sm font-bold" placeholder="Ej: Aceros Arequipa - Lote 500 unidades" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Valor Bruto (PEN)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-sm">S/</span>
                  <Input type="number" step="0.01" className="h-14 bg-slate-950 border-primary/20 rounded-xl pl-10 font-mono text-xl font-black focus:ring-primary/20" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identidad Proveedor</Label>
                <Input className="h-14 bg-slate-950/50 border-white/5 rounded-xl text-sm font-bold uppercase tracking-tight" placeholder="Nombre comercial" value={expenseForm.supplierName} onChange={e => setExpenseForm(f => ({ ...f, supplierName: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-950/50 border-t border-white/5 flex gap-3">
            <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-white/5" onClick={() => setExpenseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addExpense} className="h-14 flex-1 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/30 hover:opacity-90">
              Ejecutar Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workforce Dialog Modernized */}
      <Dialog open={workforceDialog} onOpenChange={setWorkforceDialog}>
        <DialogContent className="max-w-lg rounded-[2.5rem] p-0 overflow-hidden border border-white/10 shadow-2xl bg-white dark:bg-slate-950">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-950 px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 backdrop-blur-md shadow-xl shadow-indigo-500/20">
                  <Users className="h-7 w-7 text-indigo-400" />
                </div>
                Reporte de Jornada
              </DialogTitle>
              <p className="text-indigo-300/70 font-bold text-xs uppercase tracking-widest mt-4 opacity-70">
                Monitoreo de Capital Humano en Operaciones
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre del Operador</Label>
                <Input className="h-12 bg-slate-950/50 border-white/5 rounded-xl text-sm font-bold uppercase" placeholder="Apellido, Nombre" value={workforceForm.workerName} onChange={e => setWorkforceForm(f => ({ ...f, workerName: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Especialidad</Label>
                <Select value={workforceForm.workerRole} onValueChange={v => setWorkforceForm(f => ({ ...f, workerRole: v }))}>
                  <SelectTrigger className="h-12 bg-slate-950/50 border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-950 border-white/10 text-white">
                    {WORKER_ROLES.map(r => (
                      <SelectItem key={r} value={r} className="rounded-xl focus:bg-indigo-600 text-[10px] font-black uppercase tracking-widest py-3">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fecha</Label>
                <Input type="date" className="h-12 bg-slate-950/50 border-white/5 rounded-xl font-mono text-sm font-bold text-center" value={workforceForm.workDate} onChange={e => setWorkforceForm(f => ({ ...f, workDate: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horas Base</Label>
                <Input type="number" className="h-12 bg-slate-950 border-white/10 rounded-xl font-mono text-lg font-black text-center focus:ring-indigo-500/20" value={workforceForm.hoursRegular} onChange={e => setWorkforceForm(f => ({ ...f, hoursRegular: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Overtime</Label>
                <Input type="number" className="h-12 bg-slate-950 border-amber-500/20 rounded-xl font-mono text-lg font-black text-center text-amber-500 focus:ring-amber-500/10" value={workforceForm.hoursOvertime} onChange={e => setWorkforceForm(f => ({ ...f, hoursOvertime: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Costo/Día Base (S/)</Label>
                <Input type="number" step="0.01" className="h-14 bg-slate-950 border-white/5 rounded-xl font-mono text-xl font-black text-center" value={workforceForm.dailyRate} onChange={e => setWorkforceForm(f => ({ ...f, dailyRate: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Extra Hr Rate (S/)</Label>
                <Input type="number" step="0.01" className="h-14 bg-slate-950 border-white/5 rounded-xl font-mono text-xl font-black text-center text-amber-500" value={workforceForm.overtimeRate} onChange={e => setWorkforceForm(f => ({ ...f, overtimeRate: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-950/50 border-t border-white/5 flex gap-3">
            <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-white/5" onClick={() => setWorkforceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addWorkforce} className="h-14 flex-1 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-indigo-500/30 hover:opacity-90">
              Validar Jornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Dialog Modernized */}
      <Dialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border border-white/10 shadow-2xl bg-white dark:bg-slate-950">
          <div className="bg-gradient-to-br from-slate-900 to-black px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-700/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
                  <Wrench className="h-7 w-7 text-slate-400" />
                </div>
                Asignación de Activo
              </DialogTitle>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-4 opacity-70">
                Control de Despliegue de Maquinaria
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identificación del Activo</Label>
              <Input className="h-14 bg-slate-950/50 border-white/5 rounded-xl text-sm font-bold uppercase tracking-tight" placeholder="Ej: Compresor de Aire Industrial" value={equipmentForm.equipmentName} onChange={e => setEquipmentForm(f => ({ ...f, equipmentName: e.target.value }))} />
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Entidad de Alquiler / Propiedad</Label>
              <Input className="h-12 bg-slate-950/50 border-white/5 rounded-xl text-sm font-bold uppercase" placeholder="Empresa arrendadora o 'Propio'" value={equipmentForm.supplierName} onChange={e => setEquipmentForm(f => ({ ...f, supplierName: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fecha de Inicio</Label>
                <Input type="date" className="h-12 bg-slate-950/50 border-white/5 rounded-xl font-mono text-sm font-bold text-center" value={equipmentForm.startDate} onChange={e => setEquipmentForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Fee Diario (S/)</Label>
                <Input type="number" step="0.01" className="h-12 bg-slate-950 border-white/10 rounded-xl font-mono text-lg font-black text-center focus:ring-slate-500/20" value={equipmentForm.dailyRate} onChange={e => setEquipmentForm(f => ({ ...f, dailyRate: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-950/50 border-t border-white/5 flex gap-3">
            <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-white/5" onClick={() => setEquipmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addEquipment} className="h-14 flex-1 rounded-2xl bg-white text-slate-950 font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-slate-200">
              Vincular Activo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog Modernized */}
      <Dialog open={editProjectDialog} onOpenChange={setEditProjectDialog}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border border-white/10 shadow-2xl bg-white dark:bg-slate-950">
          <div className="bg-slate-950/50 border-b border-white/5 px-8 py-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-4 text-slate-900 dark:text-white uppercase tracking-tighter">
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                  <Pencil className="h-6 w-6 text-primary" />
                </div>
                Gestión de Ficha
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="proj-name" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Denominación del Proyecto</Label>
              <Input id="proj-name" className="h-14 bg-slate-950 border-white/10 rounded-xl text-base font-bold uppercase tracking-tight" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <Label htmlFor="proj-desc" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Memoria Descriptiva / Alcance</Label>
              <textarea 
                id="proj-desc" 
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-primary/20 min-h-[160px] resize-none leading-relaxed text-slate-300" 
                value={projectForm.description} 
                onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} 
                placeholder="Detalle los objetivos técnicos y límites del proyecto..."
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-950/50 border-t border-white/5 flex gap-3">
            <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500" onClick={() => setEditProjectDialog(false)}>
              Descartar
            </Button>
            <Button onClick={saveProject} className="h-14 flex-1 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/30">
              Sincronizar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
