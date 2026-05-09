import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard, Context } from 'grammy';
import { GeminiVoiceService } from './gemini-voice.service';
import { ConversationService } from './conversation.service';
import { QuotationsService } from '../../quotations/services/quotations.service';
import { QuotationDraft } from '../interfaces/quotation-draft.interface';

/**
 * Main Telegram bot service.
 * Handles incoming messages (voice + text), manages the conversational flow,
 * and creates quotations in the platform via QuotationsService.
 */
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot;
  private readonly botToken: string;

  constructor(
    private config: ConfigService,
    private geminiVoice: GeminiVoiceService,
    private conversation: ConversationService,
    private quotationsService: QuotationsService,
  ) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
      return;
    }

    this.bot = new Bot(this.botToken);
    this.registerHandlers();
    this.logger.log('Telegram bot handlers registered');

    // In local development, use long-polling since Telegram can't reach localhost.
    // In production (Cloud Functions), the webhook controller handles updates.
    const isProduction = process.env.NODE_ENV === 'production' ||
      process.env.K_SERVICE ||       // Cloud Functions v2
      process.env.FUNCTION_TARGET;   // Cloud Functions v1

    if (!isProduction) {
      this.logger.log('Starting Telegram bot in POLLING mode (development)...');
      // Delete any existing webhook before starting polling
      await this.bot.api.deleteWebhook();
      this.bot.start({
        onStart: () => this.logger.log('🤖 Telegram bot polling started!'),
      });
    }
  }

  /** Expose the bot for webhook handling */
  getBot(): Bot {
    return this.bot;
  }

  // ─── Handler Registration ────────────────────────────────────────

  private registerHandlers() {
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('cancelar', (ctx) => this.handleCancel(ctx));
    this.bot.command('estado', (ctx) => this.handleStatus(ctx));

    // Voice messages
    this.bot.on('message:voice', (ctx) => this.handleVoiceMessage(ctx));

    // Text messages (not commands)
    this.bot.on('message:text', (ctx) => {
      if (ctx.message.text?.startsWith('/')) return;
      return this.handleTextMessage(ctx);
    });

    // Callback queries (inline buttons)
    this.bot.on('callback_query:data', (ctx) => this.handleCallback(ctx));

    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message}`, err.stack);
    });
  }

  // ─── Commands ─────────────────────────────────────────────────────

  private async handleStart(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userId = await this.conversation.getLinkedUserId(chatId);
    if (!userId) {
      await ctx.reply(
        '⛔ Este chat no está autorizado.\n\n' +
        'Pide al administrador que vincule tu Telegram desde la configuración de la plataforma.',
      );
      return;
    }

    await ctx.reply(
      '👋 ¡Bienvenido al Bot de Cotizaciones FYM!\n\n' +
      '📋 *Cómo usar:*\n' +
      '1️⃣ Envía un 🎤 *audio* o ✍️ *texto* describiendo la cotización\n' +
      '2️⃣ Revisaré los datos extraídos\n' +
      '3️⃣ Si falta algo, te lo pediré\n' +
      '4️⃣ Confirmas y se crea en la plataforma\n\n' +
      '📌 *Comandos:*\n' +
      '/cancelar — Cancelar cotización en curso\n' +
      '/estado — Ver estado de la conversación\n\n' +
      '¡Envía tu primer audio o mensaje! 🚀',
      { parse_mode: 'Markdown' },
    );
  }

  private async handleCancel(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await this.conversation.resetState(chatId);
    await ctx.reply('❌ Cotización cancelada. Puedes iniciar una nueva en cualquier momento.');
  }

  private async handleStatus(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const state = await this.conversation.getState(chatId);
    if (!state || state.status === 'IDLE') {
      await ctx.reply('💤 No hay cotización en curso. Envía un audio o texto para iniciar.');
      return;
    }

    const draft = state.draft;
    await ctx.reply(
      `📊 *Estado actual: ${state.status}*\n\n` +
      `📝 Título: ${draft.title || '—'}\n` +
      `🏢 Empresa: ${draft.companyName || '—'}\n` +
      `💰 Monto: ${draft.manualTotal ? this.formatMoney(draft.manualTotal, draft.currency) : '—'}\n` +
      `❓ Campos faltantes: ${state.missingFields.length ? state.missingFields.join(', ') : 'ninguno'}`,
      { parse_mode: 'Markdown' },
    );
  }

  // ─── Voice Messages ───────────────────────────────────────────────

  private async handleVoiceMessage(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userId = await this.conversation.getLinkedUserId(chatId);
    if (!userId) {
      await ctx.reply('⛔ Chat no autorizado.');
      return;
    }

    const voice = ctx.message?.voice;
    if (!voice) return;

    // Check duration (max 5 minutes)
    if (voice.duration > 300) {
      await ctx.reply('⚠️ El audio es muy largo (máx 5 minutos). Intenta con un mensaje más corto.');
      return;
    }

    // Reply immediately so Telegram doesn't time out (Gemini can take 5-10 s)
    await ctx.reply('🎧 Procesando audio con IA... un momento ⏳');

    // Process asynchronously — do NOT await inside the handler to avoid
    // Telegram's 30 s webhook timeout killing the processing chain.
    this.processVoiceAsync(ctx, chatId, userId, voice).catch((err) => {
      this.logger.error(`Unhandled voice processing error: ${err}`);
    });
  }

  // ─── Text Messages ────────────────────────────────────────────────

  private async handleTextMessage(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userId = await this.conversation.getLinkedUserId(chatId);
    if (!userId) {
      await ctx.reply('⛔ Chat no autorizado.');
      return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) return;

    await ctx.reply('🔍 Procesando con IA... un momento ⏳');

    this.processTextAsync(ctx, chatId, userId, text).catch((err) => {
      this.logger.error(`Unhandled text processing error: ${err}`);
    });
  }

  // ─── Callback Queries (Inline Buttons) ────────────────────────────

  private async handleCallback(ctx: Context) {
    const chatId = ctx.chat?.id;
    const data = ctx.callbackQuery?.data;
    if (!chatId || !data) return;

    await ctx.answerCallbackQuery();

    switch (data) {
      case 'confirm_create':
        await this.createQuotation(ctx, chatId);
        break;
      case 'add_data':
        await ctx.reply(
          '✍️ Envía un audio o texto con la información adicional.\n' +
          'Puedes decir cosas como:\n' +
          '• "El contacto es Juan Pérez"\n' +
          '• "Validez de 30 días"\n' +
          '• "Son 25 mil dólares"',
        );
        break;
      case 'cancel_draft':
        await this.conversation.resetState(chatId);
        await ctx.reply('❌ Cotización cancelada.');
        break;
      case 'skip_optional':
        await this.createQuotation(ctx, chatId);
        break;
      default:
        this.logger.warn(`Unknown callback: ${data}`);
    }
  }

  // ─── Async Processors (run after immediate reply) ─────────────────

  /**
   * Heavy processing for voice messages — runs after the "Procesando..." reply is sent.
   * Telegram's 30s timeout only applies to the initial handler response, not to
   * subsequent API calls, so we can take as long as needed here.
   */
  private async processVoiceAsync(
    ctx: Context,
    chatId: number,
    userId: string,
    voice: NonNullable<Context['message']>['voice'],
  ) {
    try {
      const file = await ctx.api.getFile(voice!.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to download voice: ${response.status}`);
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      const state = await this.conversation.getState(chatId);
      const companiesList = await this.conversation.getCompaniesListForPrompt();

      let draft: QuotationDraft;

      if (state && state.status !== 'IDLE' && Object.keys(state.draft).length > 0) {
        const newExtraction = await this.geminiVoice.extractFromAudio(audioBuffer, companiesList);
        draft = await this.geminiVoice.mergeAdditionalInfo(
          state.draft,
          JSON.stringify(newExtraction),
          companiesList,
        );
      } else {
        draft = await this.geminiVoice.extractFromAudio(audioBuffer, companiesList);
      }

      await this.processDraft(ctx, chatId, userId, draft);
    } catch (error) {
      this.logger.error(`Voice processing error: ${error}`);
      await ctx.api.sendMessage(
        chatId,
        '❌ Error al procesar el audio. Intenta de nuevo o envía un mensaje de texto.',
      );
    }
  }

  /**
   * Heavy processing for text messages — runs after the "Procesando..." reply is sent.
   */
  private async processTextAsync(
    ctx: Context,
    chatId: number,
    userId: string,
    text: string,
  ) {
    try {
      const state = await this.conversation.getState(chatId);
      const companiesList = await this.conversation.getCompaniesListForPrompt();

      let draft: QuotationDraft;

      if (state && state.status !== 'IDLE' && Object.keys(state.draft).length > 0) {
        draft = await this.geminiVoice.mergeAdditionalInfo(state.draft, text, companiesList);
      } else {
        draft = await this.geminiVoice.extractFromText(text, companiesList);
      }

      await this.processDraft(ctx, chatId, userId, draft);
    } catch (error) {
      this.logger.error(`Text processing error: ${error}`);
      await ctx.api.sendMessage(chatId, '❌ Error al procesar el mensaje. Intenta de nuevo.');
    }
  }

  // ─── Core Logic ───────────────────────────────────────────────────

  /**
   * Process an extracted draft: resolve company/contact, check required fields,
   * and either ask for missing data or show confirmation.
   */
  private async processDraft(
    ctx: Context,
    chatId: number,
    userId: string,
    draft: QuotationDraft,
  ) {
    // Resolve company
    let resolvedCompanyId: string | undefined;
    let resolvedCompanyName: string | undefined;
    if (draft.companyName) {
      const match = await this.conversation.resolveCompany(draft.companyName);
      if (match) {
        resolvedCompanyId = match.id;
        resolvedCompanyName = match.tradeName;
      }
    }

    // Resolve contact
    let resolvedContactId: string | undefined;
    let resolvedContactName: string | undefined;
    if (draft.contactName && resolvedCompanyId) {
      const match = await this.conversation.resolveContact(draft.contactName, resolvedCompanyId);
      if (match) {
        resolvedContactId = match.id;
        resolvedContactName = match.fullName;
      }
    }

    // Check mandatory fields
    const mandatoryMissing: string[] = [];
    if (!draft.title?.trim()) mandatoryMissing.push('título');
    if (!resolvedCompanyId && !draft.companyName?.trim()) mandatoryMissing.push('empresa');

    // Save state — use null instead of undefined so Firestore accepts the document
    await this.conversation.setState(chatId, {
      status: mandatoryMissing.length > 0 ? 'ASKING' : 'CONFIRMING',
      draft,
      resolvedCompanyId: resolvedCompanyId ?? null,
      resolvedContactId: resolvedContactId ?? null,
      missingFields: mandatoryMissing,
      linkedUserId: userId,
      lastActivity: new Date(),
    });

    if (mandatoryMissing.length > 0) {
      // Ask for missing mandatory data
      const keyboard = new InlineKeyboard()
        .text('❌ Cancelar', 'cancel_draft');

      await ctx.reply(
        `⚠️ *Faltan datos obligatorios:*\n\n` +
        mandatoryMissing.map((f) => `• ${f}`).join('\n') +
        `\n\nEnvía un audio o texto con esta información.`,
        { parse_mode: 'Markdown', reply_markup: keyboard },
      );
      return;
    }

    // Show confirmation
    await this.showConfirmation(ctx, draft, resolvedCompanyName, resolvedContactName);
  }

  private async showConfirmation(
    ctx: Context,
    draft: QuotationDraft,
    companyName?: string,
    contactName?: string,
  ) {
    const lines = [
      '━━━━━━━━━━━━━━━━━━━━',
      '📋 *Borrador de Cotización*',
      '━━━━━━━━━━━━━━━━━━━━',
      `📝 *Título:* ${draft.title}`,
      `🏢 *Empresa:* ${companyName || draft.companyName}`,
    ];

    if (contactName || draft.contactName) {
      lines.push(`👤 *Contacto:* ${contactName || draft.contactName}`);
    }
    if (draft.manualTotal) {
      lines.push(`💰 *Monto:* ${this.formatMoney(draft.manualTotal, draft.currency)}`);
    }
    if (draft.executionLocation) {
      lines.push(`📍 *Lugar:* ${draft.executionLocation}`);
    }
    if (draft.deliveryTimeDays) {
      lines.push(`⏱️ *Plazo:* ${draft.deliveryTimeDays} días`);
    }
    if (draft.validityDays) {
      lines.push(`📅 *Validez:* ${draft.validityDays} días`);
    }
    if (draft.description) {
      lines.push(`📄 *Descripción:* ${draft.description}`);
    }

    lines.push(`\n🎯 *Confianza IA:* ${Math.round(draft.confidence * 100)}%`);

    // Check optional missing
    const optionalMissing: string[] = [];
    if (!draft.contactName && !contactName) optionalMissing.push('contacto');
    if (!draft.manualTotal) optionalMissing.push('monto');
    if (!draft.executionLocation) optionalMissing.push('lugar de ejecución');
    if (!draft.deliveryTimeDays) optionalMissing.push('plazo');

    if (optionalMissing.length > 0) {
      lines.push(`\n❓ *Datos opcionales pendientes:*`);
      optionalMissing.forEach((f) => lines.push(`• ${f}`));
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    const keyboard = new InlineKeyboard()
      .text('✅ Crear cotización', 'confirm_create')
      .text('➕ Agregar datos', 'add_data')
      .row()
      .text('❌ Cancelar', 'cancel_draft');

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ─── Quotation Creation ───────────────────────────────────────────

  private async createQuotation(ctx: Context, chatId: number) {
    const state = await this.conversation.getState(chatId);
    if (!state || !state.draft?.title) {
      await ctx.reply('❌ No hay borrador activo. Envía un audio o texto para iniciar.');
      return;
    }

    try {
      const draft = state.draft;

      // If no company was resolved but we have a name, try once more
      let companyId = state.resolvedCompanyId;
      if (!companyId && draft.companyName) {
        const match = await this.conversation.resolveCompany(draft.companyName);
        companyId = match?.id;
      }

      if (!companyId) {
        await ctx.reply(
          '⚠️ No se encontró la empresa en el sistema.\n' +
          'Por favor, primero registra la empresa en la plataforma web, o indica el nombre exacto.',
        );
        return;
      }

      // Create the quotation
      const quotationData: Record<string, unknown> = {
        title: draft.title,
        companyId,
        contactId: state.resolvedContactId || undefined,
        description: draft.description || '',
        currency: draft.currency || 'PEN',
        validityDays: draft.validityDays,
        deliveryTimeDays: draft.deliveryTimeDays,
        source: 'TELEGRAM',
      };

      if (draft.executionLocation) {
        quotationData.commercialTerms = {
          executionLocation: draft.executionLocation,
        };
      }

      const result = await this.quotationsService.create(
        quotationData,
        state.linkedUserId,
      );

      // Set manual total if provided
      if (draft.manualTotal && draft.manualTotal > 0) {
        await this.quotationsService.setManualTotal(result.id, draft.manualTotal);
      }

      // Clean up conversation
      await this.conversation.resetState(chatId);

      // Build the web link
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://cotiza-luis.web.app';

      await ctx.reply(
        `✅ *¡Cotización creada!*\n\n` +
        `📄 *Número:* ${result.quotationNumber}\n` +
        `📝 *Título:* ${draft.title}\n` +
        `💼 *Estado:* Borrador\n\n` +
        `🔗 [Ver en la plataforma](${frontendUrl}/quotations/detail?id=${result.id})\n\n` +
        `_Puedes editar los detalles y agregar ítems desde la plataforma web._`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(`Quotation creation error: ${error}`);
      await ctx.reply(
        '❌ Error al crear la cotización. Verifica los datos e intenta de nuevo.',
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private formatMoney(amount: number, currency?: string): string {
    const curr = currency || 'PEN';
    const symbol = curr === 'USD' ? '$' : 'S/';
    return `${symbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
