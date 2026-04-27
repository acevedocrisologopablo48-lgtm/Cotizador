import { Injectable } from '@nestjs/common';
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

    return timesheets;
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

      if (ts.status === 'PRESENT') {
        byEmployee[empId].daysPresent += 1;
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
        status: STATUS_LABELS[ts.status] ?? ts.status ?? '-',
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
