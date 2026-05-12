import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { existsSync } from 'node:fs';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { EmployeeStatus } from '@fym/shared';

@Injectable()
export class EmployeesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('employees');
  }

  async findAll(status?: string, search?: string) {
    let query: FirebaseFirestore.Query = this.col;

    if (status) {
      query = query.where('status', '==', status).orderBy('fullName', 'asc');
    } else {
      query = query.orderBy('fullName', 'asc');
    }

    const snap = await query.get();
    let employees = this.firebase.docsToArray(snap.docs);

    // In-memory text search (Firestore doesn't support native full-text search)
    if (search) {
      const lower = search.toLowerCase();
      employees = employees.filter(
        (e: any) =>
          e.fullName?.toLowerCase().includes(lower) ||
          e.documentNumber?.includes(search) ||
          e.position?.toLowerCase().includes(lower) ||
          e.department?.toLowerCase().includes(lower),
      );
    }

    return employees;
  }

  async exportSctrExcel(employeeIds?: string[]): Promise<Buffer> {
    let employees = await this.findAll('ACTIVE');
    const selected = this.normalizeIds(employeeIds);
    if (selected.length > 0) {
      const allowed = new Set(selected);
      employees = employees.filter((employee: any) => allowed.has(employee.id));
    }
    const current = employees.filter((employee: any) => employee.personnelGroup !== 'BACKUP');
    const backup = employees.filter((employee: any) => employee.personnelGroup === 'BACKUP');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ZAURAK';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('SCTR');
    sheet.columns = [
      { key: 'documentType', width: 10 },
      { key: 'documentNumber', width: 14 },
      { key: 'paternalLastName', width: 18 },
      { key: 'maternalLastName', width: 18 },
      { key: 'names', width: 22 },
      { key: 'fullName', width: 38 },
      { key: 'birthDate', width: 14 },
      { key: 'salary', width: 12 },
    ];

    const header = ['TipDoc', 'NumDoc', 'ApePaterno', 'ApeMaterno', 'Nombres', 'NombreCompleto', 'Nacimiento', 'Sueldo'];
    const addSection = (title: string, rows: any[], fill: string) => {
      const titleRow = sheet.addRow([title]);
      titleRow.font = { bold: true, size: 14 };
      titleRow.getCell(1).alignment = { horizontal: 'left' };

      const headerRow = sheet.addRow(header);
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      for (const employee of rows) {
        const parsed = this.parseEmployeeNames(employee);
        const row = sheet.addRow([
          employee.documentType || 'DNI',
          employee.documentNumber || '',
          employee.paternalLastName || parsed.paternalLastName,
          employee.maternalLastName || parsed.maternalLastName,
          employee.names || parsed.names,
          employee.fullName || '',
          this.formatDate(employee.birthDate),
          Number(employee.sctrSalary ?? 1130),
        ]);
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          cell.alignment = { vertical: 'middle' };
        });
        row.getCell(8).numFmt = '0.00';
      }
      sheet.addRow([]);
    };

    addSection('PERSONAL ACTUAL', current, 'FFFFE4D6');
    addSection('PERSONAL EN BACKUP', backup, 'FFB7F7CE');

    sheet.views = [{ state: 'frozen', ySplit: 0 }];
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exportProjectPersonnelPdf(projectId: string, employeeIds: string[], userId: string): Promise<{ buffer: Buffer; filename: string }> {
    if (!projectId) throw new BadRequestException('Selecciona un proyecto');
    const selectedIds = this.normalizeIds(employeeIds);
    if (selectedIds.length === 0) throw new BadRequestException('Selecciona al menos un trabajador');

    const projectDoc = await this.firebase.db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists || projectDoc.data()?.deletedAt) throw new NotFoundException('Proyecto no encontrado');
    const project = this.firebase.docToObj(projectDoc) as any;
    let company: any = null;
    if (project.companyId) {
      const companyDoc = await this.firebase.db.collection('companies').doc(project.companyId).get();
      company = companyDoc.exists ? this.firebase.docToObj(companyDoc) : null;
    }

    const refs = selectedIds.map((id) => this.col.doc(id));
    const docs = await this.firebase.db.getAll(...refs);
    const employees = docs
      .filter((doc) => doc.exists)
      .map((doc) => this.firebase.docToObj(doc) as any)
      .filter((employee) => employee.status === EmployeeStatus.ACTIVE);
    if (employees.length === 0) throw new BadRequestException('No se encontraron trabajadores activos para exportar');

    const html = this.renderProjectPersonnelHtml(project, company, employees);
    const buffer = await this.renderPdf(html);
    const safeCode = String(project.projectCode || project.id || 'proyecto').replace(/[^\w-]+/g, '-');
    const filename = `personal-zaurak-${safeCode}.pdf`;
    const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
    const docId = this.firebase.generateId();
    const now = new Date();
    await this.firebase.db.collection('projects').doc(projectId).collection('documents').doc(docId).set({
      type: 'REPORT',
      name: filename,
      url: dataUrl,
      storagePath: null,
      mimeType: 'application/pdf',
      size: buffer.length,
      notes: 'Listado de personal para ejecucion de proyecto generado desde RRHH',
      uploadedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return { buffer, filename };
  }

  private normalizeIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map(String).map((id) => id.trim()).filter(Boolean)));
  }

  private isSupervisorRole(employee: any): boolean {
    const text = `${employee.position || ''} ${employee.department || ''}`.toLowerCase();
    return ['supervisor', 'coordinador', 'prevencion', 'sst', 'jefe', 'residente'].some((word) => text.includes(word));
  }

  private renderProjectPersonnelHtml(project: any, company: any, employees: any[]) {
    const supervisors = employees.filter((employee) => this.isSupervisorRole(employee));
    const operators = employees.filter((employee) => !this.isSupervisorRole(employee));
    let item = 1;
    const rows = (items: any[]) => items.map((employee) => `
      <tr>
        <td class="center">${item++}</td>
        <td>${this.escapeHtml(employee.fullName || '')}</td>
        <td class="center">${this.escapeHtml(employee.position || '')}</td>
        <td class="center">${this.escapeHtml(employee.documentNumber || '')}</td>
      </tr>
    `).join('');
    const section = (title: string, items: any[]) => `
      <table>
        <thead>
          <tr class="section"><th colspan="4">${title}</th></tr>
          <tr class="head"><th>ITEM</th><th>NOMBRES Y APELLIDOS</th><th>CARGO</th><th>DNI/CE</th></tr>
        </thead>
        <tbody>${items.length ? rows(items) : '<tr><td colspan="4" class="center muted">Sin personal seleccionado</td></tr>'}</tbody>
      </table>
    `;
    const client = company?.businessName || company?.tradeName || (project.isInternal ? 'ZAURAK' : 'Sin cliente asociado');
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#1f2937;background:white}
            main{padding:28px 42px}
            header{display:grid;grid-template-columns:130px 1fr 130px;align-items:start;margin-bottom:24px}
            .brand{font-size:28px;font-weight:900;color:#17395c;letter-spacing:1px}
            .title{text-align:center}
            h1{font-size:20px;letter-spacing:1px;margin:12px 0 10px;color:#111827}
            .meta{font-size:14px;line-height:1.55;text-align:left;display:inline-block;color:#475569}
            .code{text-align:right;font-size:13px;color:#334155;margin-top:72px}
            table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
            th,td{border:1px solid #111827;padding:5px 7px}
            .section th{background:#2f3f52;color:white;font-size:14px;letter-spacing:.8px;text-align:center}
            .head th{background:#d7dde5;color:#111827;font-weight:800;text-align:center}
            .center{text-align:center}
            .muted{color:#64748b;font-style:italic}
          </style>
        </head>
        <body>
          <main>
            <header>
              <div class="brand">ZAURAK</div>
              <div class="title">
                <h1>PERSONAL ZAURAK - EJECUCION DE PROYECTO</h1>
                <div class="meta">
                  <div>CLIENTE : ${this.escapeHtml(client)}</div>
                  <div>PROYECTO: ${this.escapeHtml(project.name || '')}</div>
                </div>
              </div>
              <div class="code">${this.escapeHtml(project.projectCode || '')}</div>
            </header>
            ${section('SUPERVISORES', supervisors)}
            ${section('EQUIPO OPERARIO', operators)}
          </main>
        </body>
      </html>`;
  }

  private async renderPdf(html: string): Promise<Buffer> {
    let puppeteerLib: typeof import('puppeteer');
    try {
      puppeteerLib = await import('puppeteer');
    } catch {
      throw new ServiceUnavailableException('Generacion de PDF no disponible en este entorno');
    }
    const browser = await puppeteerLib.default.launch({
      headless: true,
      executablePath: this.getChromiumExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 120_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private getChromiumExecutablePath(): string | undefined {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
      process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    ].filter(Boolean) as string[];
    return candidates.find((candidate) => existsSync(candidate));
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private parseEmployeeNames(employee: any) {
    const parts = String(employee.fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      paternalLastName: parts[0] || '',
      maternalLastName: parts[1] || '',
      names: parts.slice(2).join(' '),
    };
  }

  private formatDate(value: unknown) {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Lima',
    });
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');
    return this.firebase.docToObj(doc);
  }

  async create(dto: CreateEmployeeDto, userId: string) {
    // Enforce unique documentNumber across all employees
    const existing = await this.col
      .where('documentNumber', '==', dto.documentNumber)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new ConflictException(
        `Ya existe un empleado registrado con el documento ${dto.documentNumber}`,
      );
    }

    const id = this.firebase.generateId();
    const now = new Date();

    const docData = {
      ...dto,
      status: EmployeeStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');

    // If documentNumber is being changed, check uniqueness
    if (dto.documentNumber && dto.documentNumber !== doc.data()?.documentNumber) {
      const existing = await this.col
        .where('documentNumber', '==', dto.documentNumber)
        .limit(1)
        .get();
      if (!existing.empty) {
        throw new ConflictException(
          `Ya existe un empleado registrado con el documento ${dto.documentNumber}`,
        );
      }
    }

    const updateData = { ...dto, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);

    return this.firebase.docToObj(await this.col.doc(id).get());
  }

  /** Soft-delete: marks employee as INACTIVE */
  async deactivate(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');

    await this.col.doc(id).update({
      status: EmployeeStatus.INACTIVE,
      updatedAt: new Date(),
    });

    return { id, status: EmployeeStatus.INACTIVE };
  }
}
