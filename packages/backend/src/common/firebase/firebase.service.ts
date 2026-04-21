import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App;
  private _db: admin.firestore.Firestore;
  private _auth: admin.auth.Auth;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      this._app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Fallback: use GOOGLE_APPLICATION_CREDENTIALS env or default
      this._app = admin.initializeApp();
    }

    this._db = this._app.firestore();
    this._auth = this._app.auth();
    this.logger.log('Firebase Admin SDK initialized');
  }

  get db(): admin.firestore.Firestore {
    return this._db;
  }

  get auth(): admin.auth.Auth {
    return this._auth;
  }

  /** Generate a CUID-like unique ID */
  generateId(): string {
    return this._db.collection('_').doc().id;
  }

  /** Helper: paginated query */
  async paginatedQuery(
    collectionRef: admin.firestore.Query,
    page: number,
    pageSize: number,
    countQuery?: admin.firestore.Query,
  ): Promise<{ docs: admin.firestore.QueryDocumentSnapshot[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // Get total count
    const countRef = countQuery || collectionRef;
    const countSnap = await countRef.count().get();
    const total = countSnap.data().count;

    // Get paginated data
    const snap = await collectionRef.offset(offset).limit(pageSize).get();

    return { docs: snap.docs, total };
  }

  /** Convert Firestore doc to plain object with id */
  docToObj<T = any>(doc: admin.firestore.DocumentSnapshot): T | null {
    if (!doc.exists) return null;
    const data = doc.data()!;
    // Convert Firestore Timestamps to ISO strings
    const converted: any = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof admin.firestore.Timestamp) {
        converted[key] = value.toDate().toISOString();
      } else {
        converted[key] = value;
      }
    }
    return converted as T;
  }

  /** Convert array of docs */
  docsToArray<T = any>(docs: admin.firestore.QueryDocumentSnapshot[]): T[] {
    return docs.map((doc) => this.docToObj<T>(doc)!);
  }
}
