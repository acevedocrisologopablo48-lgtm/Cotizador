import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type InvoiceExtraction = {
  supplierName: string | null;
  supplierRuc: string | null;
  documentNumber: string | null;
  issueDate: string | null;
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
      documentNumber: null,
      issueDate: null,
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

    if (!this.apiKey) {
      return {
        extraction: {
          ...fallback,
          notes: ['El servicio de IA no esta configurado en produccion. Complete los campos manualmente.'],
        },
        aiApplied: false,
      };
    }

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
                  'Extrae datos de esta factura o boleta peruana. Devuelve solo JSON valido con estas claves: supplierName, supplierRuc, documentNumber, issueDate (YYYY-MM-DD o null), totalAmount (numero o null), currency, confidence (0 a 1), notes (array de strings). No inventes valores.',
              },
              { type: 'input_image', image_url: imageDataUrl },
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
          documentNumber: this.nullableString(parsed.documentNumber),
          issueDate: this.nullableString(parsed.issueDate),
          totalAmount: this.nullableNumber(parsed.totalAmount),
          currency: this.nullableString(parsed.currency) || 'PEN',
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
          notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
        },
        aiApplied: true,
      };
    } catch (error) {
      this.logger.warn(`No se pudo extraer factura con IA: ${error instanceof Error ? error.message : String(error)}`);
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

  private localPolish(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
