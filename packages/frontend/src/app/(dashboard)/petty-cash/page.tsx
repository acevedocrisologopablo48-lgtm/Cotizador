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
  CLOSED: 'bg-gray-100 text-gray-800',
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
    if (!createForm.name || !createForm.initialBalance) {
      addToast('Nombre y saldo inicial son obligatorios', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/petty-cash', {
        name: createForm.name,
        initialBalance: parseFloat(createForm.initialBalance),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja Chica</h1>
          <p className="text-muted-foreground">Gestión de fondos y movimientos de caja chica</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Caja
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : funds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay cajas chicas registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => (
            <Card key={fund.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(fund)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{fund.name}</CardTitle>
                <Badge className={statusColors[fund.status]}>{statusLabels[fund.status]}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(Number(fund.currentBalance), fund.currency)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Inicial: {fmt(Number(fund.initialBalance), fund.currency)}
                </p>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>{fund.responsibleUser.fullName}</span>
                  <span>{fund._count.transactions} movimientos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nueva Caja Chica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Caja chica - Proyecto Cerro Verde" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input type="number" min="0" step="0.01" value={createForm.initialBalance} onChange={(e) => setCreateForm((f) => ({ ...f, initialBalance: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={createForm.currency} onValueChange={(v) => setCreateForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">Soles (PEN)</SelectItem>
                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedFund && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" /> {selectedFund.name}
                  <Badge className={statusColors[selectedFund.status]}>{statusLabels[selectedFund.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 my-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Actual</p>
                    <p className="text-xl font-bold">{fmt(Number(selectedFund.currentBalance), selectedFund.currency)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Inicial</p>
                    <p className="text-xl font-bold">{fmt(Number(selectedFund.initialBalance), selectedFund.currency)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Gastado</p>
                    <p className="text-xl font-bold text-red-600">{fmt(Number(selectedFund.initialBalance) - Number(selectedFund.currentBalance), selectedFund.currency)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2 mb-4">
                {selectedFund.status === 'OPEN' && (
                  <>
                    <Button size="sm" onClick={() => setTxnOpen(true)}>
                      <Plus className="mr-1 h-4 w-4" /> Movimiento
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => closeFund(selectedFund.id)}>
                      <Lock className="mr-1 h-4 w-4" /> Cerrar Caja
                    </Button>
                  </>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin movimientos</TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="text-sm">{new Date(txn.transactionDate).toLocaleDateString('es-PE')}</TableCell>
                        <TableCell>
                          {txn.transactionType === 'EXPENSE' ? (
                            <span className="flex items-center gap-1 text-red-600 text-sm"><ArrowDownCircle className="h-3 w-3" /> Gasto</span>
                          ) : txn.transactionType === 'INCOME' ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm"><ArrowUpCircle className="h-3 w-3" /> Ingreso</span>
                          ) : (
                            <span className="text-sm">{txn.transactionType}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{txn.description}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${txn.transactionType === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {txn.transactionType === 'EXPENSE' ? '-' : '+'}{fmt(Number(txn.amount), selectedFund.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(txn.balanceAfter), selectedFund.currency)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={txnForm.transactionType} onValueChange={(v) => setTxnForm((f) => ({ ...f, transactionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Gasto</SelectItem>
                  <SelectItem value="INCOME">Ingreso</SelectItem>
                  <SelectItem value="REFUND">Reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={txnForm.description} onChange={(e) => setTxnForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ej: Compra de materiales" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" min="0" step="0.01" value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={txnForm.transactionDate} onChange={(e) => setTxnForm((f) => ({ ...f, transactionDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input value={txnForm.notes} onChange={(e) => setTxnForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTransaction} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
