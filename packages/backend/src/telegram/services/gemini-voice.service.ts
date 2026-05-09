import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { QuotationDraft } from '../interfaces/quotation-draft.interface';
import {
  QUOTATION_EXTRACTION_PROMPT,
  QUOTATION_DRAFT_SCHEMA,
} from '../constants/extraction-prompt';

/**
 * Servicio que usa Gemini 2.5 Flash para:
 *  1. Recibir un audio (Buffer OGG de Telegram)
 *  2. Transcribirlo + extraer datos de cotización en JSON
 *  3. Todo en una sola llamada API (multimodal)
 */
@Injectable()
export class GeminiVoiceService {
  private readonly logger = new Logger(GeminiVoiceService.name);
  private genai: GoogleGenAI;
  private readonly model = 'gemini-2.5-flash';

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — Gemini service disabled');
    }
    this.genai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  /**
   * Extrae datos de cotización desde un archivo de audio.
   * Envía el audio directamente a Gemini (multimodal) que transcribe y extrae en un solo paso.
   */
  async extractFromAudio(
    audioBuffer: Buffer,
    companiesList: string,
  ): Promise<QuotationDraft> {
    this.logger.log('Extracting quotation data from audio via Gemini...');

    const base64Audio = audioBuffer.toString('base64');

    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/ogg',
                data: base64Audio,
              },
            },
            {
              text: this.buildPrompt(companiesList),
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUOTATION_DRAFT_SCHEMA,
      },
    });

    const text = response?.text ?? '{}';
    this.logger.debug(`Gemini raw response: ${text}`);

    try {
      return JSON.parse(text) as QuotationDraft;
    } catch {
      this.logger.error('Failed to parse Gemini JSON response');
      return {
        title: '',
        companyName: '',
        confidence: 0,
        missingFields: ['title', 'companyName'],
      };
    }
  }

  /**
   * Extrae datos de cotización desde un mensaje de texto.
   */
  async extractFromText(
    text: string,
    companiesList: string,
  ): Promise<QuotationDraft> {
    this.logger.log('Extracting quotation data from text via Gemini...');

    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${this.buildPrompt(companiesList)}\n\nMENSAJE DEL ADMINISTRADOR:\n"${text}"`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUOTATION_DRAFT_SCHEMA,
      },
    });

    const raw = response?.text ?? '{}';
    this.logger.debug(`Gemini raw response: ${raw}`);

    try {
      return JSON.parse(raw) as QuotationDraft;
    } catch {
      this.logger.error('Failed to parse Gemini JSON response');
      return {
        title: '',
        companyName: '',
        confidence: 0,
        missingFields: ['title', 'companyName'],
      };
    }
  }

  /**
   * Procesa una respuesta adicional del usuario para completar campos faltantes.
   * Recibe el borrador actual y la nueva información.
   */
  async mergeAdditionalInfo(
    currentDraft: Partial<QuotationDraft>,
    additionalText: string,
    companiesList: string,
  ): Promise<QuotationDraft> {
    this.logger.log('Merging additional info into quotation draft...');

    const mergePrompt = `${QUOTATION_EXTRACTION_PROMPT}

EMPRESAS REGISTRADAS:
${companiesList}

DATOS YA EXTRAÍDOS (borrador actual):
${JSON.stringify(currentDraft, null, 2)}

El administrador ha enviado información adicional para completar o corregir el borrador.
Fusiona los datos nuevos con el borrador existente. Los valores nuevos reemplazan a los anteriores.
Si un campo que antes faltaba ahora fue proporcionado, quítalo de missingFields.

MENSAJE ADICIONAL DEL ADMINISTRADOR:
"${additionalText}"`;

    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: mergePrompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUOTATION_DRAFT_SCHEMA,
      },
    });

    const raw = response?.text ?? '{}';
    this.logger.debug(`Gemini merge response: ${raw}`);

    try {
      return JSON.parse(raw) as QuotationDraft;
    } catch {
      this.logger.error('Failed to parse Gemini merge response');
      return {
        ...(currentDraft as QuotationDraft),
        confidence: currentDraft.confidence ?? 0.5,
        missingFields: currentDraft.missingFields ?? [],
      };
    }
  }

  private buildPrompt(companiesList: string): string {
    return `${QUOTATION_EXTRACTION_PROMPT}

EMPRESAS REGISTRADAS EN EL SISTEMA:
${companiesList || '(No hay empresas registradas aún)'}

Analiza el audio/texto y extrae los datos de cotización en formato JSON.`;
  }
}
