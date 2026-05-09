import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { webhookCallback } from 'grammy';
import { TelegramBotService } from './services/telegram-bot.service';

/**
 * Webhook controller for Telegram Bot updates.
 * Receives POST requests from Telegram and forwards them to the grammY bot.
 *
 * This endpoint is intentionally NOT guarded by FirebaseAuthGuard
 * because Telegram sends webhook updates directly (server-to-server).
 * Security is handled by the bot token validation within grammY.
 */
@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly botService: TelegramBotService) {}

  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const bot = this.botService.getBot();
    if (!bot) {
      this.logger.warn('Bot not initialized, ignoring webhook');
      return res.sendStatus(200);
    }

    try {
      const handler = webhookCallback(bot, 'express');
      await handler(req, res);
    } catch (error) {
      this.logger.error(`Webhook error: ${error}`);
      // Always respond 200 to Telegram to prevent retries
      if (!res.headersSent) {
        res.sendStatus(200);
      }
    }
  }
}
