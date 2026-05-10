import { Controller, DefaultValuePipe, Delete, Get, ParseIntPipe, Patch, Post, Put, Body, Param, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { QuotationsService } from '../services/quotations.service';
import { QuotationPdfService } from '../services/quotation-pdf.service';
import { getQuotationExportWarnings } from '@fym/shared';

@Controller('quotations')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly quotationPdfService: QuotationPdfService,
  ) {}

  private buildPdfFilename(quotation: any, fallbackId: string) {
    const rawTitle = String(quotation?.title || '').trim();
    const rawSubject = String(quotation?.referenceSubject || rawTitle || 'Propuesta').trim();
    const subject = rawSubject
      .replace(/^SLA\s*[–-]\s*/i, '')
      .replace(/\s*N[°º]\s*[A-Z]+-\d{4}-\d{3}\s*$/i, '')
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Propuesta';
    const number = String(quotation?.quotationNumber || fallbackId)
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .trim();
    return `SLA – ${subject} N°${number}.pdf`;
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('tipo') tipo?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('contactId') contactId?: string,
  ) {
    return this.quotationsService.findAll({
      page,
      pageSize,
      search,
      status,
      companyId,
      tipo,
      dateFrom,
      dateTo,
      contactId,
    });
  }

  @Get(':id/pdf')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  async downloadPdf(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Res() res: Response,
  ) {
    const quotation = await this.quotationsService.findOne(id);
    if (force !== '1' && force !== 'true') {
      const warnings = getQuotationExportWarnings({
        documentMode: quotation.documentMode,
        referenceSubject: quotation.referenceSubject,
        title: quotation.title,
        commercialTerms: quotation.commercialTerms,
        technicalSections: quotation.technicalSections,
        sections: quotation.sections,
      });
      if (warnings.length > 0) {
        throw new BadRequestException({
          message: 'El documento tiene información incompleta. Corríjala o use ?force=true para descargar de todas formas.',
          warnings,
        });
      }
    }
    const buffer = await this.quotationPdfService.generatePdfBuffer(id, quotation);
    const filename = this.buildPdfFilename(quotation, id);
    const asciiFallback = filename
      .normalize('NFD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/["\\]/g, '')
      .replace(/[/:*?<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || `SLA-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER')
  async findOne(@Param('id') id: string) {
    const data = await this.quotationsService.findOne(id);
    return { data };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.quotationsService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.quotationsService.update(id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  patch(@Param('id') id: string, @Body() dto: any) {
    return this.quotationsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.quotationsService.updateStatus(id, status, user.id);
  }

  @Post(':id/recalculate')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  recalculate(@Param('id') id: string) {
    return this.quotationsService.recalculate(id);
  }

  @Patch(':id/total')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  setManualTotal(
    @Param('id') id: string,
    @Body('manualTotal') manualTotal: number | null,
  ) {
    return this.quotationsService.setManualTotal(id, manualTotal);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'MANAGER', 'ENGINEER')
  duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotationsService.duplicate(id, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string) {
    return this.quotationsService.delete(id);
  }
}
