import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.FB_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? process.env.FB_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY ?? process.env.FB_ADMIN_PRIVATE_KEY;
const privateKey = rawPrivateKey?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.warn(`Faltan credenciales de Firebase en el .env. projectId: ${!!projectId}, clientEmail: ${!!clientEmail}, privateKey: ${!!privateKey}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log('🌱 Ejecutando seed para Firebase...');

  // 1. Crear usuario administrador
  const adminEmail = 'admin@welltep.com';
  const adminPassword = 'Password123!';
  const adminRole = 'ADMIN';
  
  let adminUid;
  
  try {
    const userRecord = await auth.getUserByEmail(adminEmail);
    adminUid = userRecord.uid;
    console.log('✅ El usuario admin ya existe en Auth');
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      const userRecord = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'Administrador del Sistema',
      });
      adminUid = userRecord.uid;
      console.log('✅ Usuario admin creado en Auth');
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(adminUid, { role: adminRole });

  // Crear o actualizar en Firestore
  const usersSnap = await db.collection('users').where('email', '==', adminEmail).get();
  
  if (usersSnap.empty) {
    const userDocId = db.collection('_').doc().id; // generate id
    await db.collection('users').doc(userDocId).set({
      firebaseUid: adminUid,
      email: adminEmail,
      fullName: 'Administrador del Sistema',
      role: adminRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Perfil admin creado en Firestore');
  }

  // 2. Crear categorías base
  const categoriesRef = db.collection('categories');
  const catSnap = await categoriesRef.limit(1).get();
  
  if (catSnap.empty) {
    console.log('Creando categorías iniciales...');
    
    // Categorías de equipos (EQUIPMENT)
    const eqCats = [
      { name: 'Maquinaria Pesada', moduleType: 'EQUIPMENT', sortOrder: 1 },
      { name: 'Equipos Livianos', moduleType: 'EQUIPMENT', sortOrder: 2 },
      { name: 'Herramientas', moduleType: 'EQUIPMENT', sortOrder: 3 },
    ];
    
    for (const c of eqCats) {
      await categoriesRef.doc(db.collection('_').doc().id).set({
        ...c,
        parentId: null,
        createdAt: new Date(),
      });
    }

    // Categorías de personal (WORKFORCE)
    const wfCats = [
      { name: 'Personal Administrativo', moduleType: 'WORKFORCE', sortOrder: 1 },
      { name: 'Operarios', moduleType: 'WORKFORCE', sortOrder: 2 },
      { name: 'Técnicos', moduleType: 'WORKFORCE', sortOrder: 3 },
    ];

    for (const c of wfCats) {
      await categoriesRef.doc(db.collection('_').doc().id).set({
        ...c,
        parentId: null,
        createdAt: new Date(),
      });
    }
    
    console.log('✅ Categorías iniciales creadas');
  }

  console.log('✅ Seed completado con éxito');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  });
