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
    // Acepta naming canónico (FIREBASE_*) y legado (FB_ADMIN_*) para compatibilidad.
    const projectId =
      this.config.get<string>('FIREBASE_PROJECT_ID') ??
      this.config.get<string>('FB_ADMIN_PROJECT_ID');
    const clientEmail =
      this.config.get<string>('FIREBASE_CLIENT_EMAIL') ??
      this.config.get<string>('FB_ADMIN_CLIENT_EMAIL');
    const privateKey =
      this.config.get<string>('FIREBASE_PRIVATE_KEY') ??
      this.config.get<string>('FB_ADMIN_PRIVATE_KEY');

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
    
    const convertTimestamps = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (obj instanceof admin.firestore.Timestamp) {
        return obj.toDate().toISOString();
      }
      if (Array.isArray(obj)) {
        return obj.map(convertTimestamps);
      }
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = convertTimestamps(v);
        }
        return result;
      }
      return obj;
    };

    return { id: doc.id, ...convertTimestamps(data) } as T;
  }

  /** Convert array of docs */
  docsToArray<T = any>(docs: admin.firestore.QueryDocumentSnapshot[]): T[] {
    return docs.map((doc) => this.docToObj<T>(doc)!);
  }

  /** Paginate an in-memory array (used after client-side filtering) */
  paginateArray<T>(data: T[], page: number, pageSize: number): T[] {
    const offset = (page - 1) * pageSize;
    return data.slice(offset, offset + pageSize);
  }

  /** Batch-fetch multiple user docs by ID. Returns a Map<id, data> */
  async batchGetUsers(
    ids: string[],
  ): Promise<Map<string, { fullName?: string; [key: string]: any }>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const refs = unique.map((id) => this._db.collection('users').doc(id));
    const docs = await this._db.getAll(...refs);
    return new Map(
      docs.filter((d) => d.exists).map((d) => [d.id, d.data() as any]),
    );
  }
}
