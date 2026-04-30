import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { renderQuotationPrintHtml } from '@fym/shared';
import { QuotationsService } from './quotations.service';
import { AppConfigService } from '../../app-config/app-config.service';

@Injectable()
export class QuotationPdfService {
  private readonly log = new Logger(QuotationPdfService.name);

  constructor(
    private readonly quotations: QuotationsService,
    private readonly config: AppConfigService,
  ) {}

  async generatePdfBuffer(quotationId: string, preloaded?: any): Promise<Buffer> {
    const quotation = preloaded ?? (await this.quotations.findOne(quotationId));
    const company = await this.config.getCompanySettings();
    const html = renderQuotationPrintHtml(quotation, company);

    let puppeteerLib: typeof import('puppeteer');
    try {
      puppeteerLib = await import('puppeteer');
    } catch (err) {
      this.log.warn(`Puppeteer no disponible: ${err}`);
      throw new ServiceUnavailableException(
        'Generación de PDF no disponible. Instale dependencias del servidor o use imprimir desde el navegador.',
      );
    }

    const browser = await puppeteerLib.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120_000 });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '14mm', left: '11mm', right: '11mm' },
      });
      return Buffer.from(buf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}
