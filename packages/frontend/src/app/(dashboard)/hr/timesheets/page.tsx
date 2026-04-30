'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Download, RefreshCw, CalendarDays, TrendingUp, Clock, UserCheck2,
  UserX2, History,
} from 'lucide-react';
import { TimesheetStatus } from '@fym/shared';
import type { Timesheet, TimesheetSummary } from '@/lib/types/hr';

const STATUS_LABELS: Record<string, string> = {
  [TimesheetStatus.PRESENT]: 'Presente',
  [TimesheetStatus.INCOMPLETE]: 'Incompleto',
  [TimesheetStatus.ABSENT]: 'Ausente',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  [TimesheetStatus.PRESENT]: 'success',
  [TimesheetStatus.INCOMPLETE]: 'warning',
  [TimesheetStatus.ABSENT]: 'destructive',
};

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function HrTimesheetsPage() {
  const { token } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<'records' | 'summary'>('summary');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useRange, setUseRange] = useState(false);

  const [records, setRecords] = useState<Timesheet[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (useRange && dateFrom) p.set('dateFrom', dateFrom);
    if (useRange && dateTo)   p.set('dateTo', dateTo);
    if (!useRange && monthFilter) p.set('month', monthFilter);
    return p.toString();
  }, [useRange, dateFrom, dateTo, monthFilter]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = buildParams();
      const [rRes, sRes] = await Promise.all([
        api.get<{ data: Timesheet[] }>(`/hr/timesheets?${qs}`, token),
        api.get<{ data: TimesheetSummary[] }>(`/hr/timesheets/summary?${qs}`, token),
      ]);
      setRecords(rRes.data);
      setSummary(sRes.data);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, buildParams, addToast]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const qs = buildParams();
      const label = useRange && dateFrom ? `${dateFrom}_${dateTo}` : monthFilter;
      await api.download(`/hr/timesheets/export?${qs}`, `tareo-${label}.xlsx`, token);
      addToast('Reporte descargado', 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Aggregated totals for summary cards
  const totalPresent    = summary.reduce((a, s) => a + s.daysPresent, 0);
  const totalIncomplete = summary.reduce((a, s) => a + s.daysIncomplete, 0);
  const totalHours      = summary.reduce((a, s) => a + s.totalHours, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Tareos y Horas</h1>
          <p className="text-slate-500 dark:text-slate-400">Consolidado de asistencia operativa y cálculo de horas hombre</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 bg-white dark:bg-slate-950 shadow-sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 text-primary ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button className="h-10 shadow-sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" /> {exporting ? 'Generando…' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm bg-slate-50/50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Button
                variant={useRange ? 'ghost' : 'secondary'}
                size="sm"
                className={`rounded-lg px-4 ${!useRange ? 'shadow-sm font-bold' : 'text-slate-500'}`}
                onClick={() => setUseRange(false)}
              >
                Mensual
              </Button>
              <Button
                variant={useRange ? 'secondary' : 'ghost'}
                size="sm"
                className={`rounded-lg px-4 ${useRange ? 'shadow-sm font-bold' : 'text-slate-500'}`}
                onClick={() => setUseRange(true)}
              >
                Rango
              </Button>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

            {!useRange ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-800">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <Input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-48 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-800">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-medium"
                    placeholder="Desde"
                  />
                  <span className="text-slate-300 font-black">—</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-medium"
                    placeholder="Hasta"
                  />
                </div>
              </div>
            )}

            <Button onClick={load} disabled={loading} variant="secondary" className="ml-auto font-bold px-6 border border-slate-200 dark:border-slate-800">
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Personal Activo</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-50 leading-none">{summary.length}</span>
                <span className="text-xs text-indigo-500 font-bold">Colaboradores</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <UserCheck2 className="h-4 w-4 text-indigo-500" />
                </div>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">Registrados en el sistema</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Días Presentes</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 leading-none">{totalPresent}</span>
                <span className="text-xs text-emerald-500 font-bold">Asistencias</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">Total acumulado del periodo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Incompletos</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 leading-none">{totalIncomplete}</span>
                <span className="text-xs text-amber-500 font-bold">Observaciones</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">Sin cierre de jornada o salida</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-sky-500">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Horas Totales</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-600 leading-none">{totalHours.toFixed(1)}</span>
                <span className="text-xs text-sky-500 font-bold font-mono">HH</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-sky-600" />
                </div>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">Horas hombre producidas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'records' | 'summary')} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-12 gap-1 border border-slate-200 dark:border-slate-700">
          <TabsTrigger 
            value="summary" 
            className="rounded-lg px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all"
          >
            Resumen de Periodo
          </TabsTrigger>
          <TabsTrigger 
            value="records" 
            className="rounded-lg px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all"
          >
            Registros Diarios
          </TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="summary">
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="bg-slate-900 dark:bg-black p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Consolidado Mensual</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">HR-SUM-{monthFilter || 'RANGE'}</span>
              </div>
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                    <TableHead className="font-bold text-slate-600 dark:text-slate-400">Colaborador</TableHead>
                    <TableHead className="font-bold text-slate-600 dark:text-slate-400">Cargo</TableHead>
                    <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400">Presentes</TableHead>
                    <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400">Incompletos</TableHead>
                    <TableHead className="text-right font-bold text-slate-600 dark:text-slate-400">Total Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-slate-100 dark:border-slate-800">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : summary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <UserX2 className="h-10 w-10 opacity-20" />
                          <p className="text-sm font-medium">Sin datos consolidados para este periodo</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.map((s, idx) => (
                      <TableRow key={s.employee?.id ?? `summary-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border-slate-200 dark:border-slate-800">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center font-black text-indigo-600 text-[10px]">
                              {s.employee?.fullName.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-slate-200">{s.employee?.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium uppercase tracking-tighter">
                          {s.employee?.position || 'N/A'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded text-xs">
                            {s.daysPresent}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono font-black text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded text-xs">
                            {s.daysIncomplete}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 rounded-lg font-mono font-black border border-sky-100 dark:border-sky-500/20">
                            {s.totalHours.toFixed(2)} <span className="text-[10px] opacity-60">HH</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="bg-slate-900 dark:bg-black p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Eventos de Marcación</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">COUNT: {records.length}</span>
              </div>
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                    <TableHead className="font-bold text-slate-600 dark:text-slate-400">Fecha</TableHead>
                    <TableHead className="font-bold text-slate-600 dark:text-slate-400">Colaborador</TableHead>
                    <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400">Entrada</TableHead>
                    <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400">Salida</TableHead>
                    <TableHead className="text-center font-bold text-slate-600 dark:text-slate-400">Total</TableHead>
                    <TableHead className="text-right font-bold text-slate-600 dark:text-slate-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="border-slate-100 dark:border-slate-800">
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 ml-auto rounded-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <History className="h-10 w-10 opacity-20" />
                          <p className="text-sm font-medium">No se detectaron registros de actividad</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((ts) => (
                      <TableRow key={ts.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border-slate-200 dark:border-slate-800">
                        <TableCell className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          {ts.date}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                              {ts.employee?.fullName ?? ts.employeeId}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              DNI: {ts.employee?.documentNumber ?? '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded">
                            {ts.checkInTime
                              ? new Date(ts.checkInTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
                              : '--:--'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono text-xs font-black px-2 py-1 rounded ${ts.checkOutTime ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-amber-500 animate-pulse bg-amber-50 dark:bg-amber-500/10'}`}>
                            {ts.checkOutTime
                              ? new Date(ts.checkOutTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
                              : 'PEND.'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                            {ts.hoursWorked != null ? ts.hoursWorked.toFixed(2) : '0.00'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={STATUS_VARIANT[ts.status] ?? 'outline'}
                            className="font-bold uppercase text-[9px] tracking-widest px-2 shadow-none border-none h-6 inline-flex items-center justify-center min-w-[80px]"
                          >
                            {STATUS_LABELS[ts.status] ?? ts.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
