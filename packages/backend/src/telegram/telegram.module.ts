import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBotService } from './services/telegram-bot.service';
import { GeminiVoiceService } from './services/gemini-voice.service';
import { ConversationService } from './services/conversation.service';
import { QuotationsModule } from '../quotations/quotations.module';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [QuotationsModule, AppConfigModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramBotService, GeminiVoiceService, ConversationService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
