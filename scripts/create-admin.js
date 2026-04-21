const admin = require('firebase-admin');

const projectId = 'cotiza-luis';
const clientEmail = 'firebase-adminsdk-fbsvc@cotiza-luis.iam.gserviceaccount.com';
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const authAdmin = admin.auth();
const db = admin.firestore();

async function createAdmin() {
  const email = 'admin@cotizador.com';
  const password = 'Admin2026!';
  const fullName = 'Administrador';
  const role = 'ADMIN';

  let uid;

  // 1. Create or get the Firebase Auth user
  try {
    const existing = await authAdmin.getUserByEmail(email);
    uid = existing.uid;
    console.log('User already exists in Auth, uid:', uid);
    // Update password just in case
    await authAdmin.updateUser(uid, { password, displayName: fullName });
    console.log('Password updated');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await authAdmin.createUser({
        email,
        password,
        displayName: fullName,
      });
      uid = newUser.uid;
      console.log('User created in Auth, uid:', uid);
    } else {
      throw err;
    }
  }

  // 2. Set custom claims (role)
  await authAdmin.setCustomUserClaims(uid, { role });
  console.log('Custom claims set:', { role });

  // 3. Create or update user profile in Firestore
  const usersSnap = await db.collection('users').where('email', '==', email).get();

  if (usersSnap.empty) {
    const docId = db.collection('_').doc().id;
    await db.collection('users').doc(docId).set({
      firebaseUid: uid,
      email,
      fullName,
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('User profile created in Firestore');
  } else {
    const doc = usersSnap.docs[0];
    await doc.ref.update({ firebaseUid: uid, role, isActive: true, updatedAt: new Date() });
    console.log('User profile updated in Firestore');
  }

  console.log('\n========================================');
  console.log('  CREDENCIALES DE ACCESO');
  console.log('========================================');
  console.log('  Email:    ', email);
  console.log('  Password: ', password);
  console.log('  Rol:      ', role);
  console.log('  URL:       https://cotiza-luis.web.app');
  console.log('========================================\n');
}

createAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
