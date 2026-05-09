/**
 * One-time setup script for the Telegram bot.
 * Run with: npx ts-node src/telegram/setup-telegram.ts
 *
 * This script:
 *  1. Sets the webhook URL for the Telegram bot
 *  2. Creates the initial Telegram config in Firestore
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function setWebhook(webhookUrl: string) {
  console.log(`\n🔧 Setting Telegram webhook to: ${webhookUrl}\n`);

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Telegram response:', JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log('✅ Webhook set successfully!');
  } else {
    console.error('❌ Failed to set webhook:', data.description);
  }
}

async function getWebhookInfo() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('\n📊 Current webhook info:', JSON.stringify(data, null, 2));
}

async function getBotInfo() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('\n🤖 Bot info:', JSON.stringify(data.result, null, 2));
  return data.result;
}

async function main() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  const command = process.argv[2];

  switch (command) {
    case 'info':
      await getBotInfo();
      await getWebhookInfo();
      break;

    case 'webhook': {
      const webhookUrl = process.argv[3];
      if (!webhookUrl) {
        console.error('Usage: ts-node setup-telegram.ts webhook <URL>');
        console.error('Example: ts-node setup-telegram.ts webhook https://your-backend.com/api/v1/telegram/webhook');
        process.exit(1);
      }
      await setWebhook(webhookUrl);
      break;
    }

    case 'delete-webhook':
      await setWebhook('');
      break;

    default:
      console.log('🤖 Telegram Bot Setup\n');
      console.log('Commands:');
      console.log('  info              — Show bot info and current webhook');
      console.log('  webhook <URL>     — Set webhook URL');
      console.log('  delete-webhook    — Remove webhook (for polling mode)');
      console.log('\nExample:');
      console.log('  npx ts-node src/telegram/setup-telegram.ts info');
      console.log('  npx ts-node src/telegram/setup-telegram.ts webhook https://us-central1-cotiza-luis.cloudfunctions.net/api/api/v1/telegram/webhook');

      // Default: show info
      await getBotInfo();
      await getWebhookInfo();
  }
}

main().catch(console.error);
