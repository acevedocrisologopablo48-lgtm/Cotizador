const admin = require('firebase-admin');

async function test() {
  const serviceAccount = {
    "type": "service_account",
    "project_id": "cotiza-luis",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6RII9OsDS93Aw\n6Y9cFeyWmTGXADBpESqFk4qetNdspnsav+/i6tIAaaKelBI8C9PSP29w9cB/XGwR\nSlmY4yZ1zDrbETKIAaEv+nXGhg0ggJ/yq7zAHBFW1b2vt/i4C8q1R/uZR07b5/rq\nfGd3OyW7IEd1RmpETp2vO/ZvEBgHTb4yQ7Lu96TTdliydhIBNotb/s33SL6a/kfe\nNOZYZ/NiiXllXHnLI1J+vcTa77J7GYQTWyNk36L2Evsd0UQVFanslF0FfUxI+H0U\n1PJY38c9oo2PpbIXRrHlfScdws47ubbT3UlNlzLxD6NJ4i2eYQ4peslihhdTA0Ck\nw6FYwVM/AgMBAAECggEAFoj+UXEVGLugl6enf/u+YrPzA3Kdk2s6apcLO3Xj5ZG4\nrWemRUelPjE0NZzyyHqigbp0qEUbKRgh55pH/7lk6EsxSFqqyI3wlduROdedqUkr\n0Lyv+nVgMFIYql8xbfbYle5jr/YoF26CoAbgBP/4vyHByMb1nqunjnv3LcBT3+Ig\n9aQvHdkkp2xkTOTAvAZTFUs4197hzT70YMyKAyO9LEstKuc/ZRr+TYDfuIA1JaZP\ncTgTkt1Srf/Lw9fVuOF7SnVZSwBW9n7Usc2VcfFyMLV63q4oEiUIrCIcMT1qu6Qs\nL0PQgJZR/IaVQCULG/h0+T7FvDcvjLsytyB6U738lQKBgQDeEki+CUBBuOx+JBfn\nRPfvbibqHdSF8a6X0qABHC68+Q+zsMkDsaxEUMjIAW8kPt8tFinmubXItu8kdMtz\nQG+NI3jlJRwRV20J0uRxQZHS7AyC5iBPLJ+EqMvK2FnLIM6qoqBOoVWgjATBxges\nJakp3wqlo8rNHebQcMes5azqywKBgQDWudtHqMFMmkrLgaZ8diLnNrNJvVG0w5GT\nli1cn0tJ5tSN7/iaKIUXsC6JrgTbxbKO7PpowjsMpxmqNl95qhJUCq2aVlC7jeLY\neUPxTIy2BrkBlDSKti7TnPV0VdikBHRl0BuFYGctv+hClalFMj0SrlUHni2I9zrh\nqR8S+FGm3QKBgQC2RS2dhPxPtVeuxTM1aF9UDwYzvJ41/kN+a6tWneoiww5HP4AN\n3yP0wpW5y6uMhWoqmHl13dG916B7PL3McAPfRVEySv45oZdmq8lCyD3HcGVofzff\npFGd0enLKT6yQdA/L9ICF9uvNZ2l6kNb4WFyc5ZKlCCdsMBFL3xEhhMidwKBgQCM\nEQSHA//Ddkof4dy2B2HRLQ9apJIttfy6JxZD+uzjsh0o0UZ7WL8oqpZQ3SDyM028\nibz2pOxb3oyRSZKSDGyUQbromDFlhrJYvxGgz2xiOJRqAUEc0qZNB2/diToeE4HS\nACRTpoTnhO1+sZ2PM6w/CVUR+Q5+77aLCQTqHO02SQKBgF1tFPpijx5iflPtM4C5\nTWJweBs4Q1WWeRaw6Y4YUM/Frh+h50STrO0mUv/39KiN0IrTpo2k6tVySJMZvWxm\nBCm8Yo2M4tNlqNdPatiZvi1Tzus4ewr2iIe6o9tzGME9+w1zpcuDJA0vty395l/i\nCUYFfozNX1m0I8zP/6LyikeE\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@cotiza-luis.iam.gserviceaccount.com"
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("Generating custom token...");
  const uid = "2P1XfOQfM1Zp1R5kH2e8S9nK3m42"; // I'll need to find the admin UID, but let's just make a generic query to Firestore directly first to see if it hangs.
  
  const db = admin.firestore();
  console.log("Querying supplies...");
  try {
    const q = db.collection('supplies').where('isActive', '==', true).orderBy('name', 'asc');
    console.log("Getting count...");
    const countRef = db.collection('supplies').where('isActive', '==', true);
    const countSnap = await countRef.count().get();
    console.log("Count is", countSnap.data().count);
    
    console.log("Getting docs...");
    const snap = await q.limit(20).get();
    console.log("Got", snap.size, "docs");
  } catch(e) {
    console.error("Error querying:", e.message);
  }
}
test();
