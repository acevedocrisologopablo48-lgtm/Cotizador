import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type InvoiceExtraction = {
  supplierName: string | null;
  supplierRuc: string | null;
  storeName: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  paymentMethod: string | null;
  totalAmount: number | null;
  currency: string | null;
  confidence: number;
  notes: string[];
};

@Injectable()
export class ProjectAiService {
  private readonly logger = new Logger(ProjectAiService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey() {
    return this.config.get<string>('OPENAI_API_KEY');
  }

  private get model() {
    return this.config.get<string>('OPENAI_MODEL') || 'gpt-5.4-mini';
  }

  async improveFieldNote(rawText: string, context: string): Promise<{ improvedText: string; aiApplied: boolean }> {
    const cleaned = String(rawText || '').trim();
    if (!cleaned) return { improvedText: '', aiApplied: false };
    if (!this.apiKey) return { improvedText: this.localPolish(cleaned), aiApplied: false };

    try {
      const response = await this.createResponse({
        model: this.model,
        instructions:
          'Eres un asistente tecnico de obra. Corrige ortografia y redaccion de reportes diarios de campo en espanol peruano. Mantén el sentido original, no inventes datos, no agregues porcentajes ni materiales no mencionados. Devuelve solo el texto final.',
        input: `Contexto: ${context}\n\nTexto de campo:\n${cleaned}`,
      });

      const text = this.extractOutputText(response).trim();
      return { improvedText: text || this.localPolish(cleaned), aiApplied: Boolean(text) };
    } catch (error) {
      this.logger.warn(`No se pudo mejorar texto con IA: ${error instanceof Error ? error.message : String(error)}`);
      return { improvedText: this.localPolish(cleaned), aiApplied: false };
    }
  }

  async extractInvoice(imageDataUrl: string): Promise<{ extraction: InvoiceExtraction; aiApplied: boolean }> {
    const fallback: InvoiceExtraction = {
      supplierName: null,
      supplierRuc: null,
      storeName: null,
      documentNumber: null,
      issueDate: null,
      paymentMethod: null,
      totalAmount: null,
      currency: 'PEN',
      confidence: 0,
      notes: ['No se pudo aplicar OCR automaticamente. Revise y complete los campos manualmente.'],
    };

    if (!imageDataUrl) {
      return {
        extraction: {
          ...fallback,
          notes: ['No se recibio una imagen valida para leer la factura.'],
        },
        aiApplied: false,
      };
    }

    if (this.apiKey) {
      try {
        const response = await this.createResponse({
          model: this.model,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text:
                    'Extrae datos de esta factura, boleta o comprobante peruano. Devuelve solo JSON valido con estas claves: supplierName, supplierRuc, storeName, documentNumber, issueDate (YYYY-MM-DD o null), paymentMethod, totalAmount (numero o null), currency, confidence (0 a 1), notes (array de strings). Usa storeName para la tienda o comercio. No inventes valores.',
                },
                this.isPdfDataUrl(imageDataUrl)
                  ? { type: 'input_file', filename: 'factura.pdf', file_data: imageDataUrl }
                  : { type: 'input_image', image_url: imageDataUrl },
              ],
            },
          ],
        });

        const text = this.extractOutputText(response);
        const parsed = this.parseJsonObject(text);
        return {
          extraction: {
            supplierName: this.nullableString(parsed.supplierName),
            supplierRuc: this.nullableString(parsed.supplierRuc),
            storeName: this.nullableString(parsed.storeName) || this.nullableString(parsed.supplierName),
            documentNumber: this.nullableString(parsed.documentNumber),
            issueDate: this.nullableString(parsed.issueDate),
            paymentMethod: this.nullableString(parsed.paymentMethod),
            totalAmount: this.nullableNumber(parsed.totalAmount),
            currency: this.nullableString(parsed.currency) || 'PEN',
            confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
            notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
          },
          aiApplied: true,
        };
      } catch (error) {
        this.logger.warn(`No se pudo extraer factura con IA; se intentara OCR local: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      return await this.extractInvoiceWithLocalOcr(imageDataUrl);
    } catch (error) {
      this.logger.warn(`No se pudo extraer factura con OCR local: ${error instanceof Error ? error.message : String(error)}`);
      return { extraction: fallback, aiApplied: false };
    }
  }

  private async createResponse(body: Record<string, unknown>): Promise<any> {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${msg.slice(0, 300)}`);
    }

    return res.json();
  }

  private extractOutputText(response: any): string {
    if (typeof response?.output_text === 'string') return response.output_text;
    const chunks: string[] = [];
    for (const item of response?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === 'string') chunks.push(content.text);
      }
    }
    return chunks.join('\n');
  }

  private parseJsonObject(text: string): Record<string, any> {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return {};
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return {};
    }
  }

  private nullableString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private nullableNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private async extractInvoiceWithLocalOcr(imageDataUrl: string): Promise<{ extraction: InvoiceExtraction; aiApplied: boolean }> {
    if (this.isPdfDataUrl(imageDataUrl)) {
      return {
        extraction: {
          supplierName: null,
          supplierRuc: null,
          storeName: null,
          documentNumber: null,
          issueDate: null,
          paymentMethod: null,
          totalAmount: null,
          currency: 'PEN',
          confidence: 0,
          notes: ['La lectura local de PDF no esta disponible; complete los campos manualmente o configure IA.'],
        },
        aiApplied: false,
      };
    }
    const { recognize } = await import('tesseract.js');
    const image = this.dataUrlToBuffer(imageDataUrl);
    const result = await recognize(image, 'eng');
    const text = String(result?.data?.text || '');
    const confidence = Math.max(0, Math.min(1, Number(result?.data?.confidence || 0) / 100));
    const extraction = this.parseInvoiceText(text, confidence);
    const hasUsefulData = Boolean(
      extraction.supplierRuc ||
      extraction.documentNumber ||
      extraction.issueDate ||
      extraction.totalAmount ||
      extraction.supplierName,
    );

    return {
      extraction: {
        ...extraction,
        notes: hasUsefulData
          ? ['Lectura automatica aplicada con OCR local. Revise los campos antes de guardar.']
          : ['No se detectaron datos claros en la imagen. Pruebe con una foto mas nitida o complete manualmente.'],
      },
      aiApplied: hasUsefulData,
    };
  }

  private dataUrlToBuffer(imageDataUrl: string): Buffer {
    const match = imageDataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!match?.[1]) throw new Error('Formato de imagen invalido');
    return Buffer.from(match[1], 'base64');
  }

  private isPdfDataUrl(dataUrl: string) {
    return /^data:application\/pdf;base64,/i.test(dataUrl);
  }

  private parseInvoiceText(text: string, confidence: number): InvoiceExtraction {
    const normalized = text
      .replace(/\r/g, '\n')
      .replace(/[|]+/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    const lines = normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const compact = normalized.replace(/\s+/g, ' ');

    const supplierRuc = compact.match(/\b(?:10|20)\d{9}\b/)?.[0] || null;
    const documentNumber = this.extractDocumentNumber(compact);
    const issueDate = this.extractIssueDate(compact);
    const totalAmount = this.extractTotalAmount(lines, compact);
    const supplierName = this.extractSupplierName(lines, supplierRuc);

    return {
      supplierName,
      supplierRuc,
      storeName: supplierName,
      documentNumber,
      issueDate,
      paymentMethod: this.extractPaymentMethod(compact),
      totalAmount,
      currency: /US\$|USD|DOLAR/i.test(compact) ? 'USD' : 'PEN',
      confidence,
      notes: [],
    };
  }

  private extractDocumentNumber(text: string): string | null {
    const patterns = [
      /\b(?:F|B|E)\d{3}[-\s]?\d{1,10}\b/i,
      /\b(?:FACTURA|BOLETA|RECIBO)[^\w]{0,12}([A-Z0-9]{1,4}[-\s]?\d{1,10})\b/i,
      /\b(?:NRO|N°|NUMERO|NO\.?)[^\w]{0,8}([A-Z0-9]{1,4}[-\s]?\d{1,10})\b/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = match?.[1] || match?.[0];
      if (value) return value.replace(/\s+/g, '').toUpperCase();
    }
    return null;
  }

  private extractIssueDate(text: string): string | null {
    const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);
    if (!match) {
      const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
      if (!iso) return null;
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  private extractTotalAmount(lines: string[], compact: string): number | null {
    const amountPattern = /(?:S\/|PEN|TOTAL|IMPORTE|MONTO)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2}))/gi;
    const totalLine = [...lines].reverse().find((line) => /\b(TOTAL|IMPORTE TOTAL|MONTO TOTAL|A PAGAR)\b/i.test(line));
    const source = totalLine || compact;
    const amounts = Array.from(source.matchAll(amountPattern))
      .map((match) => this.parseMoney(match[1]))
      .filter((value): value is number => value !== null && value > 0);
    if (amounts.length > 0) return amounts[amounts.length - 1];

    const allAmounts = Array.from(compact.matchAll(amountPattern))
      .map((match) => this.parseMoney(match[1]))
      .filter((value): value is number => value !== null && value > 0);
    return allAmounts.length ? Math.max(...allAmounts) : null;
  }

  private extractPaymentMethod(text: string): string | null {
    const direct = text.match(/\b(YAPE|PLIN)\b/i)?.[1];
    if (direct) return direct.toUpperCase();
    if (/TRANSFERENCIA|DEPOSITO|DEP[OÓ]SITO/i.test(text)) return 'TRANSFERENCIA';
    if (/VISA|MASTERCARD|TARJETA|CREDITO|CR[ÉE]DITO|DEBITO|D[ÉE]BITO/i.test(text)) return 'TARJETA';
    if (/EFECTIVO|CASH/i.test(text)) return 'EFECTIVO';
    return null;
  }

  private parseMoney(value: string): number | null {
    const cleaned = value.trim();
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const normalized = cleaned
      .replace(new RegExp(`\\${decimalSeparator === ',' ? '.' : ','}`, 'g'), '')
      .replace(decimalSeparator, '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  private extractSupplierName(lines: string[], supplierRuc: string | null): string | null {
    if (supplierRuc) {
      const rucIndex = lines.findIndex((line) => line.includes(supplierRuc));
      for (let i = Math.max(0, rucIndex - 3); i < rucIndex; i++) {
        const candidate = this.cleanSupplierCandidate(lines[i]);
        if (candidate) return candidate;
      }
    }

    for (const line of lines.slice(0, 8)) {
      const candidate = this.cleanSupplierCandidate(line);
      if (candidate) return candidate;
    }
    return null;
  }

  private cleanSupplierCandidate(line: string): string | null {
    const value = line.replace(/[^A-ZÁÉÍÓÚÑ0-9 .,&-]/gi, '').replace(/\s+/g, ' ').trim();
    if (value.length < 4) return null;
    if (/\b(RUC|FACTURA|BOLETA|RECIBO|ELECTRONICA|TOTAL|FECHA|DIRECCION|TELEFONO)\b/i.test(value)) return null;
    if (/^\d+([.,]\d+)?$/.test(value)) return null;
    return value;
  }

  private localPolish(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
