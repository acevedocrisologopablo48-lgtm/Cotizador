import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { TimesheetFilterDto } from '../dto/timesheet-filter.dto';

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Presente',
  INCOMPLETE: 'Incompleto',
  ABSENT: 'Ausente',
};

@Injectable()
export class TimesheetsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('timesheets');
  }

  /** Build Firestore query from filter dto (date range OR month) */
  private buildQuery(filters: TimesheetFilterDto): FirebaseFirestore.Query {
    let query: FirebaseFirestore.Query = this.col;

    if (filters.employeeId) {
      query = query.where('employeeId', '==', filters.employeeId);
    }

    // Prefer explicit date range; fall back to month
    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom) query = query.where('date', '>=', filters.dateFrom);
      if (filters.dateTo)   query = query.where('date', '<=', filters.dateTo);
    } else if (filters.month) {
      query = query.where('month', '==', filters.month);
    } else if (filters.week) {
      query = query.where('week', '==', filters.week);
    }

    return query.orderBy('date', 'desc');
  }

  /** Fetch timesheets and enrich with employee snapshot */
  async findAll(filters: TimesheetFilterDto) {
    const snap = await this.buildQuery(filters).get();
    const timesheets = this.firebase.docsToArray(snap.docs) as any[];

    // Batch employee lookups in a single roundtrip (avoid N+1)
    const uniqueEmployeeIds = [...new Set(timesheets.map((ts) => ts.employeeId))];
    const employeeRefs = uniqueEmployeeIds.map((id) =>
      this.firebase.db.collection('employees').doc(id),
    );

    const employeeDocs = employeeRefs.length
      ? await this.firebase.db.getAll(...employeeRefs)
      : [];

    const empCache: Record<string, any> = {};
    for (const empDoc of employeeDocs) {
      empCache[empDoc.id] = empDoc.exists ? this.firebase.docToObj(empDoc) : null;
    }

    for (const ts of timesheets) {
      ts.employee = empCache[ts.employeeId] ?? null;
    }

    await this.attachAttendanceEvidence(timesheets);

    return timesheets;
  }

  private async attachAttendanceEvidence(timesheets: any[]) {
    const attendanceIds = Array.from(new Set(
      timesheets.flatMap((ts) => [ts.checkInId, ts.checkOutId].filter(Boolean)),
    ));
    if (attendanceIds.length === 0) return;

    const refs = attendanceIds.map((id) => this.firebase.db.collection('attendances').doc(id));
    const docs = await this.firebase.db.getAll(...refs);
    const attendanceMap = new Map(
      docs.filter((doc) => doc.exists).map((doc) => [doc.id, this.firebase.docToObj(doc) as any]),
    );

    for (const ts of timesheets) {
      ts.checkInAttendance = ts.checkInId ? attendanceMap.get(ts.checkInId) || null : null;
      ts.checkOutAttendance = ts.checkOutId ? attendanceMap.get(ts.checkOutId) || null : null;
    }
  }

  /** Aggregate summary grouped by employee */
  async getSummary(filters: TimesheetFilterDto) {
    const timesheets = await this.findAll(filters);
    const byEmployee: Record<string, any> = {};

    for (const ts of timesheets) {
      const empId = ts.employeeId;

      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employee: ts.employee,
          daysPresent: 0,
          daysIncomplete: 0,
          daysAbsent: 0,
          totalHours: 0,
          records: [],
        };
      }

      byEmployee[empId].records.push(ts);

      if (ts.status === 'PRESENT' || Number(ts.paidDays || 0) > 0) {
        byEmployee[empId].daysPresent += Number(ts.paidDays || 1);
        byEmployee[empId].totalHours =
          Math.round((byEmployee[empId].totalHours + (ts.hoursWorked ?? 0)) * 100) / 100;
      } else if (ts.status === 'INCOMPLETE') {
        byEmployee[empId].daysIncomplete += 1;
      } else if (ts.status === 'ABSENT') {
        byEmployee[empId].daysAbsent += 1;
      }
    }

    return Object.values(byEmployee);
  }

  async requestPermission(data: any, userId: string) {
    const employeeId = String(data.employeeId || '').trim();
    const date = String(data.date || '').trim();
    const reason = String(data.reason || '').trim();
    if (!employeeId || !date || !reason) {
      throw new BadRequestException('Empleado, fecha y motivo son obligatorios');
    }

    const employeeDoc = await this.firebase.db.collection('employees').doc(employeeId).get();
    if (!employeeDoc.exists) throw new NotFoundException('Empleado no encontrado');

    const existing = await this.col.where('employeeId', '==', employeeId).where('date', '==', date).limit(1).get();
    const now = new Date();
    const payload = {
      employeeId,
      date,
      month: date.slice(0, 7),
      week: this.getISOWeek(date),
      checkInId: null,
      checkOutId: null,
      checkInTime: null,
      checkOutTime: null,
      hoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0,
      paidDays: 0,
      status: 'ABSENT',
      permissionStatus: 'PENDING',
      permissionReason: reason,
      permissionRequestedBy: userId,
      permissionRequestedAt: now,
      updatedAt: now,
    };

    if (existing.empty) {
      const id = this.firebase.generateId();
      await this.col.doc(id).set({ ...payload, createdAt: now });
      return { id, ...payload };
    }

    const id = existing.docs[0].id;
    await this.col.doc(id).update(payload);
    return { id, ...existing.docs[0].data(), ...payload };
  }

  async resolvePermission(id: string, data: any, userId: string) {
    const status = String(data.status || '').toUpperCase();
    if (!['APPROVED', 'DENIED'].includes(status)) {
      throw new BadRequestException('Estado de permiso invalido');
    }
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Tareo no encontrado');
    const now = new Date();
    const updateData = {
      permissionStatus: status,
      permissionResolvedBy: userId,
      permissionResolvedAt: now,
      paidDays: status === 'APPROVED' ? 1 : 0,
      status: 'ABSENT',
      updatedAt: now,
    };
    await this.col.doc(id).update(updateData);
    return { id, ...doc.data(), ...updateData };
  }

  private getISOWeek(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    const thu = new Date(d);
    thu.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${thu.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Generates a structured Excel workbook with the filtered timesheet data.
   * Returns a Buffer ready to be sent as a file download.
   */
  async exportToExcel(filters: TimesheetFilterDto): Promise<Buffer> {
    const timesheets = await this.findAll(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FYM Technologies';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tareo');

    // ── Column definitions ──────────────────────────────────────────────────
    sheet.columns = [
      { header: 'Fecha',            key: 'date',           width: 14 },
      { header: 'Trabajador',       key: 'fullName',        width: 32 },
      { header: 'DNI / Documento',  key: 'documentNumber',  width: 18 },
      { header: 'Cargo',            key: 'position',        width: 22 },
      { header: 'Departamento',     key: 'department',      width: 20 },
      { header: 'Hora Entrada',     key: 'checkIn',         width: 14 },
      { header: 'Hora Salida',      key: 'checkOut',        width: 14 },
      { header: 'Horas Trabajadas', key: 'hours',           width: 18 },
      { header: 'Estado',           key: 'status',          width: 14 },
    ];

    // ── Header styling ──────────────────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      };
    });

    // ── Data rows ───────────────────────────────────────────────────────────
    for (const ts of timesheets) {
      const checkIn  = ts.checkInTime  ? new Date(ts.checkInTime)  : null;
      const checkOut = ts.checkOutTime ? new Date(ts.checkOutTime) : null;

      const row = sheet.addRow({
        date:           ts.date ?? '-',
        fullName:       ts.employee?.fullName ?? '-',
        documentNumber: ts.employee?.documentNumber ?? '-',
        position:       ts.employee?.position ?? '-',
        department:     ts.employee?.department ?? '-',
        checkIn:  checkIn  ? checkIn.toLocaleTimeString('es-PE',  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '-',
        checkOut: checkOut ? checkOut.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '-',
        hours:  ts.hoursWorked != null ? Number(ts.hoursWorked.toFixed(2)) : '-',
        status: ts.permissionStatus === 'APPROVED' ? 'Permiso pagado' : STATUS_LABELS[ts.status] ?? ts.status ?? '-',
      });

      // Alternating row color
      const rowIdx = row.number;
      if (rowIdx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
        });
      }

      // Status coloring
      const statusCell = row.getCell('status');
      if (ts.status === 'PRESENT') {
        statusCell.font = { color: { argb: 'FF166534' }, bold: true };
      } else if (ts.status === 'INCOMPLETE') {
        statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
      } else if (ts.status === 'ABSENT') {
        statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
      }
    }

    // ── Borders on all cells ────────────────────────────────────────────────
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
        cell.alignment = { vertical: 'middle' };
      });
    });

    // ── Summary row ─────────────────────────────────────────────────────────
    const totalHours = timesheets.reduce(
      (acc, ts) => acc + (ts.hoursWorked ?? 0),
      0,
    );

    const summaryRow = sheet.addRow({
      date:      'TOTAL',
      fullName:  `${timesheets.length} registro(s)`,
      hours:     Math.round(totalHours * 100) / 100,
    });
    summaryRow.font = { bold: true };
    summaryRow.getCell('date').fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' },
    };

    // ── Generate buffer ─────────────────────────────────────────────────────
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
