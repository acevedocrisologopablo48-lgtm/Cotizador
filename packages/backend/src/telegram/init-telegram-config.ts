/**
 * Initializes Telegram bot configuration in Firestore.
 * Run: npx ts-node src/telegram/init-telegram-config.ts
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.FB_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? process.env.FB_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY ?? process.env.FB_ADMIN_PRIVATE_KEY;
const privateKey = rawPrivateKey?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }),
});

const db = admin.firestore();

const ADMIN_TELEGRAM_CHAT_ID = '7693726373';

async function main() {
  console.log('🔧 Initializing Telegram config in Firestore...\n');

  // Find admin user
  const usersSnap = await db.collection('users').where('role', '==', 'ADMIN').limit(5).get();
  
  if (usersSnap.empty) {
    console.error('❌ No admin users found in Firestore');
    process.exit(1);
  }

  console.log('📋 Admin users found:');
  const users: Array<{ id: string; fullName: string; email: string }> = [];
  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    users.push({ id: doc.id, fullName: data.fullName, email: data.email });
    console.log(`   - ${doc.id} | ${data.fullName} | ${data.email}`);
  });

  // Use the first admin user
  const adminUser = users[0];
  console.log(`\n🔗 Linking chat ID ${ADMIN_TELEGRAM_CHAT_ID} → ${adminUser.fullName} (${adminUser.id})`);

  // Create/update the telegram config
  await db.collection('config').doc('telegram').set({
    enabled: true,
    authorizedChatIds: {
      [ADMIN_TELEGRAM_CHAT_ID]: adminUser.id,
    },
    maxQuotationsPerHour: 10,
    updatedAt: new Date(),
  }, { merge: true });

  console.log('\n✅ Telegram config created in Firestore (config/telegram)');
  
  // Verify
  const configDoc = await db.collection('config').doc('telegram').get();
  console.log('\n📊 Stored config:', JSON.stringify(configDoc.data(), null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
