/**
 * Temporary polling script to get the admin's chat ID.
 * Run: npx ts-node src/telegram/get-chat-id.ts
 *
 * Steps:
 *  1. Run this script
 *  2. Open Telegram and send /start to @CotizaLuis_bot
 *  3. The script will print your chat ID
 *  4. Use that chat ID to configure the authorized users
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function pollUpdates() {
  console.log('🤖 Waiting for messages... Send /start to @CotizaLuis_bot in Telegram\n');

  let offset = 0;

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          const msg = update.message;
          if (msg) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📨 Message from:`);
            console.log(`   Chat ID: ${msg.chat.id}`);
            console.log(`   Name: ${msg.from?.first_name} ${msg.from?.last_name || ''}`);
            console.log(`   Username: @${msg.from?.username || 'N/A'}`);
            console.log(`   Text: ${msg.text || '(no text)'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`\n✅ Use this chat ID to configure Firestore:`);
            console.log(`   Chat ID: ${msg.chat.id}\n`);

            // Reply to confirm
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                text: `✅ Tu Chat ID es: ${msg.chat.id}\n\nEste chat será vinculado a tu cuenta de la plataforma.`,
              }),
            });
          }
        }
      }
    } catch (err) {
      console.error('Error polling:', err);
    }

    // Continue polling
    setTimeout(poll, 1000);
  };

  poll();
}

// First, make sure there's no webhook active
async function clearWebhook() {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
}

clearWebhook().then(pollUpdates);
