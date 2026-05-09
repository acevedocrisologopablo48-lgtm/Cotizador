import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { renderQuotationPrintHtml } from '@fym/shared';
import { existsSync } from 'node:fs';
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
    const company = await this.getPdfCompanySettings();
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

    let browser: Awaited<ReturnType<typeof puppeteerLib.default.launch>>;
    try {
      browser = await puppeteerLib.default.launch({
        headless: true,
        executablePath: this.getChromiumExecutablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });
    } catch (err) {
      this.log.error('No se pudo iniciar Chromium para PDF', err instanceof Error ? err.stack : String(err));
      throw new ServiceUnavailableException('No se pudo iniciar el generador de PDF del servidor.');
    }
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 120_000 });
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

  private async getPdfCompanySettings(): Promise<any> {
    const company = await this.config.getCompanySettings();
    const [logoUrl, signatureUrl] = await Promise.all([
      this.toEmbeddedImage(company.logoUrl, 'logo'),
      this.toEmbeddedImage(company.signatureUrl, 'firma'),
    ]);
    return { ...company, logoUrl, signatureUrl };
  }

  private async toEmbeddedImage(value: unknown, label: string): Promise<string> {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    if (!url) return '';
    if (url.startsWith('data:image/')) return url;
    if (!/^https?:\/\//i.test(url)) return '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FYM-PDF-Renderer/1.0' },
      });
      if (!res.ok) {
        this.log.warn(`Imagen corporativa no disponible para PDF (${label}): HTTP ${res.status}`);
        return '';
      }
      const contentType = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
      if (!contentType.startsWith('image/')) return '';
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) {
        this.log.warn(`Imagen corporativa omitida por tamaño (${label}): ${bytes.length} bytes`);
        return '';
      }
      return `data:${contentType};base64,${bytes.toString('base64')}`;
    } catch (err) {
      this.log.warn(`No se pudo cargar imagen corporativa para PDF (${label}): ${err instanceof Error ? err.message : String(err)}`);
      return '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
