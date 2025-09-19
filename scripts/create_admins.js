/*
  Usage:
  1) Place your Firebase Admin service account json at ./serviceAccountKey.json
     -or- set GOOGLE_APPLICATION_CREDENTIALS to its absolute path.
  2) Run: npm run seed:admins
*/

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function initAdmin() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../serviceAccountKey.json');
  if (!fs.existsSync(credentialsPath)) {
    console.error('Service account JSON not found. Set GOOGLE_APPLICATION_CREDENTIALS or add serviceAccountKey.json.');
    process.exit(1);
  }
  const serviceAccount = require(credentialsPath);
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

async function main() {
  initAdmin();
  const auth = admin.auth();
  const db = admin.firestore();

  const admins = ['cs1', 'cs2', 'cs3', 'vjack'];
  const password = '11111111';

  for (const name of admins) {
    const email = `${name}@gmail.com`;
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        console.log(`User exists: ${email}`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({ email, password, displayName: name });
          console.log(`Created auth user: ${email}`);
        } else if (e.code === 'auth/invalid-email') {
          throw e;
        } else {
          // Email may exist; try create and catch
          userRecord = await auth.createUser({ email, password, displayName: name });
          console.log(`Created auth user: ${email}`);
        }
      }

      const userDocRef = db.collection('users').doc(userRecord.uid);
      await userDocRef.set({
        uid: userRecord.uid,
        email,
        role: 'admin',
        name,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`Upserted Firestore user doc for ${email} with role=admin`);
    } catch (err) {
      console.error(`Failed for ${email}:`, err.message || err);
    }
  }

  console.log('Done.');
  process.exit(0);
}

main();



