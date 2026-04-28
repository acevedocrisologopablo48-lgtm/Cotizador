'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera, Clock, LogIn, LogOut, AlertCircle, RefreshCw,
  CheckCircle2, Search,
} from 'lucide-react';
import { AttendanceType } from '@fym/shared';
import { Input } from '@/components/ui/input';
import type { Employee, Attendance } from '@/lib/types/hr';

// ─── Camera capture hook ───────────────────────────────────────────────────────
function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Attach stream to video element after React renders the <video> node
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const start = useCallback(async () => {
    setCameraError(null);
    setCaptured(null);
    setIsStarting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setStream(s);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Por favor, habilita la cámara en tu navegador.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró ninguna cámara en este dispositivo.');
      } else {
        setCameraError(`Error de cámara: ${err.message}`);
      }
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCaptured(null);
  }, [stream]);

  const capture = useCallback((): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) return reject(new Error('Video no disponible'));
      const canvas = document.createElement('canvas');
      canvas.width  = videoRef.current.videoWidth  || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('No se pudo capturar la imagen'));
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const result = { blob, dataUrl };
        setCaptured(result);
        resolve(result);
      }, 'image/jpeg', 0.85);
    });
  }, []);

  const retake = useCallback(() => {
    setCaptured(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  return { videoRef, stream, cameraError, captured, isStarting, start, stop, capture, retake };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HrAttendancesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const camera = useCameraCapture();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [attendanceType, setAttendanceType] = useState<AttendanceType>(AttendanceType.CHECK_IN);
  const [submitting, setSubmitting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // History
  const [history, setHistory] = useState<Attendance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchEmp, setSearchEmp] = useState('');

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<{ data: Employee[] }>('/hr/employees?status=ACTIVE', token);
      setEmployees(res.data);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  }, [token, addToast]);

  const loadHistory = useCallback(async (empId?: string) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const params = new URLSearchParams({
        pageSize: '40',
        dateFrom: today,
        dateTo: today,
      });
      if (empId) params.set('employeeId', empId);
      const res = await api.get<{ data: Attendance[] }>(`/hr/attendances?${params}`, token);
      setHistory(res.data);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    if (token) { loadEmployees(); loadHistory(); }
  }, [token, loadEmployees, loadHistory]);

  // Open register dialog
  const openRegister = (type: AttendanceType) => {
    setAttendanceType(type);
    setRegisterOpen(true);
    camera.start();
  };

  const closeRegister = () => {
    camera.stop();
    setRegisterOpen(false);
    setSelectedEmployee(null);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      addToast('Selecciona un empleado', 'error');
      return;
    }
    if (!camera.captured && !camera.stream) {
      addToast('Inicia la cámara y toma la foto antes de continuar', 'error');
      return;
    }

    if (!camera.captured) {
      addToast('Debes tomar una foto antes de registrar', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Upload photo to Firebase Storage
      const path = `hr/attendances/${selectedEmployee.id}/${Date.now()}.jpg`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, camera.captured.blob, { contentType: 'image/jpeg' });
      const photoUrl = await getDownloadURL(fileRef);

      // Register attendance
      await api.post('/hr/attendances', {
        employeeId: selectedEmployee.id,
        type: attendanceType,
        photoUrl,
      }, token!);

      addToast(
        attendanceType === AttendanceType.CHECK_IN
          ? `Entrada registrada para ${selectedEmployee.fullName}`
          : `Salida registrada para ${selectedEmployee.fullName}`,
        'success'
      );
      closeRegister();
      loadHistory();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((e) =>
    !searchEmp || e.fullName.toLowerCase().includes(searchEmp.toLowerCase()) || e.documentNumber.includes(searchEmp)
  );

  const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Control de Asistencias</h1>
          <p className="text-slate-500 dark:text-slate-400">Registro biométrico visual para personal en planta y campo</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-2.5 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{now}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 pl-3">En Tiempo Real</span>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card
          className="group cursor-pointer border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
          onClick={() => openRegister(AttendanceType.CHECK_IN)}
        >
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
          <CardContent className="flex items-center gap-6 p-8 relative">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm border border-emerald-100 dark:border-emerald-500/20">
              <LogIn className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Registrar Entrada</h3>
              <p className="text-slate-500 font-medium">CHECK IN con validación fotográfica</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
          onClick={() => openRegister(AttendanceType.CHECK_OUT)}
        >
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-colors" />
          <CardContent className="flex items-center gap-6 p-8 relative">
            <div className="h-16 w-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm border border-rose-100 dark:border-rose-500/20">
              <LogOut className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Registrar Salida</h3>
              <p className="text-slate-500 font-medium">CHECK OUT con validación fotográfica</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4 border-b">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Registros de Hoy</CardTitle>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Últimos movimientos detectados</p>
            </div>
            <Button size="sm" variant="outline" className="h-9 px-4 rounded-full bg-white dark:bg-slate-950 shadow-sm" onClick={() => loadHistory()}>
              <RefreshCw className="h-3.5 w-3.5 mr-2 text-primary" /> Sincronizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 pl-6">Colaborador</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Tipo de Marcación</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Fecha y Hora</TableHead>
                <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300 pr-6">Evidencia Visual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-10 w-10 ml-auto rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Clock className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">Sin marcaciones detectadas</p>
                      <p className="text-sm">Inicia los registros operativos para ver data aquí</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((att) => {
                  const emp = employees.find((e) => e.id === att.employeeId);
                  return (
                    <TableRow key={att.id} className="group hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-200 dark:border-slate-700">
                            {emp?.fullName.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{emp?.fullName ?? 'Colaborador Desconocido'}</span>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter leading-none">{emp?.position || 'N/A'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={att.type === AttendanceType.CHECK_IN ? 'success' : 'destructive'}
                          className="rounded-full px-3 py-0.5 border-none"
                        >
                          {att.type === AttendanceType.CHECK_IN ? 'Entrada' : 'Salida'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{att.date}</span>
                          <span className="text-xs font-mono text-slate-400">
                            {att.timestamp
                              ? new Date(att.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Lima' })
                              : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {att.photoUrl ? (
                          <a href={att.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-block relative">
                            <div className="h-10 w-10 rounded-full border-2 border-white dark:border-slate-900 shadow-md overflow-hidden hover:scale-110 transition-transform">
                              <img
                                src={att.photoUrl}
                                alt="foto"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full border border-white dark:border-slate-900">
                              <Search className="h-2 w-2" />
                            </div>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Register dialog */}
      <Dialog open={registerOpen} onOpenChange={(open) => { if (!open) closeRegister(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {attendanceType === AttendanceType.CHECK_IN
                ? <><LogIn className="h-5 w-5 text-emerald-600" /> Registrar Entrada</>
                : <><LogOut className="h-5 w-5 text-rose-600" /> Registrar Salida</>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Empleado <span className="text-destructive">*</span></label>
              <div className="relative mb-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre o documento…"
                  value={searchEmp}
                  onChange={(e) => setSearchEmp(e.target.value)}
                />
              </div>
              <Select
                value={selectedEmployee?.id ?? ''}
                onValueChange={(id) => setSelectedEmployee(filteredEmployees.find((e) => e.id === id) ?? null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado…" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {filteredEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName} — {e.documentType} {e.documentNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Camera area */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Foto obligatoria <span className="text-destructive">*</span></label>

              {camera.cameraError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{camera.cameraError}</span>
                </div>
              )}

              {/* Preview / video */}
              <div className="relative rounded-lg overflow-hidden bg-muted border aspect-video flex items-center justify-center">
                {camera.captured ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={camera.captured.dataUrl} alt="Captura" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </>
                ) : camera.stream ? (
                  <video ref={camera.videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                    <Camera className="h-10 w-10 opacity-30" />
                    <span>Cámara no iniciada</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!camera.stream && !camera.captured && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={camera.start}
                    disabled={camera.isStarting}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {camera.isStarting ? 'Iniciando…' : 'Iniciar cámara'}
                  </Button>
                )}
                {camera.stream && !camera.captured && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      try { await camera.capture(); }
                      catch (e: any) { addToast(e.message, 'error'); }
                    }}
                  >
                    <Camera className="mr-2 h-4 w-4" /> Tomar foto
                  </Button>
                )}
                {camera.captured && (
                  <Button variant="outline" className="flex-1" onClick={camera.retake}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Repetir foto
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRegister} disabled={submitting}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedEmployee || !camera.captured}
              className={attendanceType === AttendanceType.CHECK_IN ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {submitting ? 'Registrando…' : attendanceType === AttendanceType.CHECK_IN ? 'Confirmar Entrada' : 'Confirmar Salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
