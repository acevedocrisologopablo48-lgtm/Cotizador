'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, Plus, Eye, ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react';

interface PettyCash {
  id: string;
  name: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: string;
  createdAt: string;
  project?: { id: string; projectCode: string; name: string } | null;
  responsibleUser: { id: string; fullName: string; email: string };
  _count: { transactions: number };
}

interface Transaction {
  id: string;
  transactionType: string;
  description: string;
  amount: number;
  balanceAfter: number;
  transactionDate: string;
  notes?: string;
  registeredByUser: { id: string; fullName: string };
  approvedByUser?: { id: string; fullName: string } | null;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
};

export default function PettyCashPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [funds, setFunds] = useState<PettyCash[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', initialBalance: '', currency: 'PEN' });
  const [saving, setSaving] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<PettyCash | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Transaction dialog
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({
    transactionType: 'EXPENSE',
    description: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const loadFunds = useCallback(async () => {
    try {
      const res = await api.get<{ data: PettyCash[] }>('/petty-cash', token!);
      setFunds(res.data);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (token) loadFunds();
  }, [token, loadFunds]);

  const handleCreate = async () => {
    const initialBalanceNum = parseFloat(createForm.initialBalance);
    if (!createForm.name.trim() || createForm.initialBalance === '' || Number.isNaN(initialBalanceNum) || initialBalanceNum < 0) {
      addToast('Nombre y saldo inicial (≥ 0) son obligatorios', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/petty-cash', {
        name: createForm.name,
        initialBalance: initialBalanceNum,
        currency: createForm.currency,
        responsibleUserId: user!.id,
      }, token!);
      addToast('Caja chica creada', 'success');
      setCreateOpen(false);
      setCreateForm({ name: '', initialBalance: '', currency: 'PEN' });
      loadFunds();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (fund: PettyCash) => {
    setSelectedFund(fund);
    setDetailOpen(true);
    try {
      const res = await api.get<{ data: { transactions: Transaction[] } }>(`/petty-cash/${fund.id}`, token!);
      setTransactions(res.data.transactions);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const closeFund = async (id: string) => {
    try {
      await api.patch('/petty-cash/' + id + '/close', {}, token!);
      addToast('Caja chica cerrada', 'success');
      loadFunds();
      setDetailOpen(false);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedFund || !txnForm.description || !txnForm.amount) {
      addToast('Descripción y monto son obligatorios', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/petty-cash/${selectedFund.id}/transactions`, {
        transactionType: txnForm.transactionType,
        description: txnForm.description,
        amount: parseFloat(txnForm.amount),
        transactionDate: txnForm.transactionDate,
        notes: txnForm.notes || undefined,
      }, token!);
      addToast('Movimiento registrado', 'success');
      setTxnOpen(false);
      setTxnForm({ transactionType: 'EXPENSE', description: '', amount: '', transactionDate: new Date().toISOString().slice(0, 10), notes: '' });
      // Refresh detail
      openDetail(selectedFund);
      loadFunds();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number, currency = 'PEN') =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(v);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-jakarta">
            Caja <span className="text-primary italic">Chica</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Gestión operativa de flujos de efectivo y rendiciones industriales.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl h-11 px-6">
          <Plus className="mr-2 h-5 w-5" /> Aperturar Caja
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-none shadow-sm bg-muted/20 animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : funds.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 rounded-3xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-24 w-24 rounded-3xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700">
              <Wallet className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-jakarta">Sin fondos operativos activos</h3>
            <p className="text-slate-500 max-w-sm mt-3 font-medium text-sm">
              No se han encontrado cajas chicas registradas. Comienza aperturando una para gestionar gastos de campo.
            </p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-8 rounded-xl border-slate-200 dark:border-slate-700 shadow-sm px-8">
              Registrar primera caja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => {
            const usagePercent = Math.min(100, ((Number(fund.initialBalance) - Number(fund.currentBalance)) / Number(fund.initialBalance)) * 100);
            const isOpen = fund.status === 'OPEN';
            
            return (
              <Card 
                key={fund.id} 
                className="group relative border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => openDetail(fund)}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 opacity-10 rounded-full blur-3xl transition-opacity group-hover:opacity-20 ${isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                
                <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isOpen ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <Wallet className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-jakarta line-clamp-1">{fund.name}</span>
                    </div>
                    <Badge 
                      className={`rounded-full font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 border-0 shadow-sm ${
                        isOpen 
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                        : 'bg-slate-500 text-white'
                      }`}
                    >
                      {statusLabels[fund.status]}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                        {fmt(Number(fund.currentBalance), fund.currency)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
                      Saldo Disponible
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium italic">Uso del fondo</span>
                      <span className={`font-black font-mono ${usagePercent > 80 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {usagePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-inner ${
                          usagePercent > 90 ? 'bg-rose-500 shadow-rose-500/50' : 
                          usagePercent > 70 ? 'bg-amber-500 shadow-amber-500/50' : 
                          'bg-primary shadow-primary/50'
                        }`} 
                        style={{ width: `${usagePercent}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm">
                        <span className="font-bold text-[10px] text-slate-700 dark:text-slate-200 uppercase">
                          {fund.responsibleUser.fullName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex flex-col -space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Responsable</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                          {fund.responsibleUser.fullName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-black font-mono text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        {fund._count.transactions} <span className="text-[9px] opacity-40">MVTOS</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-slate-900 dark:bg-black p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-jakarta">Nueva Caja Chica</DialogTitle>
              <p className="text-slate-400 text-xs mt-1 font-medium">Define un nuevo fondo operativo para gestión de campo.</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5 bg-white dark:bg-slate-900">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nombre de la Caja</Label>
              <Input 
                value={createForm.name} 
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} 
                placeholder="Ej: Caja Chica - Mantenimiento Planta" 
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saldo Inicial</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={createForm.initialBalance} 
                    onChange={(e) => setCreateForm((f) => ({ ...f, initialBalance: e.target.value }))}
                    className="pl-8 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-mono"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Moneda</Label>
                <Select value={createForm.currency} onValueChange={(v) => setCreateForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                    <SelectItem value="PEN">Soles (PEN)</SelectItem>
                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl px-8 shadow-lg shadow-primary/20 font-bold text-xs uppercase tracking-widest">
              {saving ? 'Procesando...' : 'Aperturar Caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
          {selectedFund && (
            <>
              <div className="bg-slate-900 dark:bg-black p-6 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Wallet className="h-24 w-24" />
                </div>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-2xl font-black font-jakarta tracking-tight">
                      {selectedFund.name}
                    </DialogTitle>
                    <Badge className={`rounded-full font-bold text-[10px] uppercase tracking-wider px-3 py-1 border-0 ${
                      selectedFund.status === 'OPEN' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                    }`}>
                      {statusLabels[selectedFund.status]}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-sm mt-1 font-medium flex items-center gap-2">
                    Responsable: <span className="text-white font-bold">{selectedFund.responsibleUser.fullName}</span>
                  </p>
                </DialogHeader>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Actual</p>
                    <p className="text-2xl font-black font-mono tabular-nums text-primary tracking-tighter">
                      {fmt(Number(selectedFund.currentBalance), selectedFund.currency)}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Inicial</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {fmt(Number(selectedFund.initialBalance), selectedFund.currency)}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Gastado</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-rose-500">
                      {fmt(Number(selectedFund.initialBalance) - Number(selectedFund.currentBalance), selectedFund.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h4 className="text-sm font-black font-jakarta uppercase tracking-wider text-slate-900 dark:text-slate-100">Historial de Movimientos</h4>
                  <div className="flex gap-2">
                    {selectedFund.status === 'OPEN' && (
                      <>
                        <Button size="sm" onClick={() => setTxnOpen(true)} className="rounded-lg font-bold text-[10px] uppercase tracking-widest h-8 px-4">
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Registrar Gasto
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => closeFund(selectedFund.id)} className="rounded-lg font-bold text-[10px] uppercase tracking-widest h-8 border-slate-200 dark:border-slate-700">
                          <Lock className="mr-1.5 h-3.5 w-3.5" /> Cerrar Caja
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow className="border-b border-slate-100 dark:border-slate-800">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Tipo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Descripción</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-10">Monto</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-10">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 py-12 italic text-sm">No se registran movimientos en esta caja</TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((txn, idx) => {
                          const isExpense = txn.transactionType === 'EXPENSE';
                          const isIncome = txn.transactionType === 'INCOME';
                          return (
                            <TableRow key={txn.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/20'} border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}>
                              <TableCell className="text-xs font-mono py-4">
                                {new Date(txn.transactionDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                {isExpense ? (
                                  <Badge className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 border-rose-100 dark:border-rose-500/20 shadow-none font-bold text-[9px] uppercase tracking-tighter">
                                    <ArrowDownCircle className="h-2.5 w-2.5 mr-1" /> Salida
                                  </Badge>
                                ) : isIncome ? (
                                  <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100 dark:border-emerald-500/20 shadow-none font-bold text-[9px] uppercase tracking-tighter">
                                    <ArrowUpCircle className="h-2.5 w-2.5 mr-1" /> Entrada
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase">{txn.transactionType}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{txn.description}</span>
                                  {txn.notes && <span className="text-[9px] text-slate-400 italic line-clamp-1">{txn.notes}</span>}
                                </div>
                              </TableCell>
                              <TableCell className={`text-right text-xs font-black font-mono tabular-nums ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {isExpense ? '-' : '+'}{fmt(Number(txn.amount), selectedFund.currency)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono tabular-nums text-slate-400">
                                {fmt(Number(txn.balanceAfter), selectedFund.currency)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/50">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest px-8 border-slate-200 dark:border-slate-700 shadow-sm">
                  Cerrar Vista
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-slate-900 dark:bg-black p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-jakarta">Registrar Movimiento</DialogTitle>
              <p className="text-slate-400 text-xs mt-1 font-medium">Registra un nuevo ingreso o salida de efectivo.</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5 bg-white dark:bg-slate-900">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo de Transacción</Label>
              <Select value={txnForm.transactionType} onValueChange={(v) => setTxnForm((f) => ({ ...f, transactionType: v }))}>
                <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="EXPENSE">Gasto / Salida</SelectItem>
                  <SelectItem value="INCOME">Ingreso / Reembolso</SelectItem>
                  <SelectItem value="REFUND">Devolución</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Descripción / Motivo</Label>
              <Input 
                value={txnForm.description} 
                onChange={(e) => setTxnForm((f) => ({ ...f, description: e.target.value }))} 
                placeholder="Ej: Pago de pasajes a obra" 
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monto</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={txnForm.amount} 
                    onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))}
                    className="pl-8 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-mono"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha del Gasto</Label>
                <Input 
                  type="date" 
                  value={txnForm.transactionDate} 
                  onChange={(e) => setTxnForm((f) => ({ ...f, transactionDate: e.target.value }))}
                  className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Observaciones (Opcional)</Label>
              <Input 
                value={txnForm.notes} 
                onChange={(e) => setTxnForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Detalles adicionales..." 
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-primary/20"
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setTxnOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleAddTransaction} disabled={saving} className="rounded-xl px-8 shadow-lg shadow-primary/20 font-bold text-xs uppercase tracking-widest">
              {saving ? 'Guardando...' : 'Registrar Movimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
