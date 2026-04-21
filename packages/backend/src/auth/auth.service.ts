import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(private firebase: FirebaseService) {}

  async getProfile(userId: string) {
    const doc = await this.firebase.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Usuario no encontrado');

    const user = this.firebase.docToObj(doc);
    const { passwordHash, firebaseUid, ...safeUser } = user as any;
    return safeUser;
  }

  async createUser(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role: string;
  }) {
    // Check if user already exists in Firestore
    const existing = await this.firebase.db
      .collection('users')
      .where('email', '==', data.email)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new ConflictException('El email ya está registrado');
    }

    // Create user in Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await this.firebase.auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.fullName,
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException('El email ya está registrado en Firebase Auth');
      }
      throw error;
    }

    // Create user profile in Firestore
    const userId = this.firebase.generateId();
    const now = new Date();
    const userData = {
      email: data.email,
      fullName: data.fullName,
      phone: data.phone || null,
      role: data.role,
      isActive: true,
      firebaseUid: firebaseUser.uid,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.firebase.db.collection('users').doc(userId).set(userData);

    // Set custom claims for role
    await this.firebase.auth.setCustomUserClaims(firebaseUser.uid, { role: data.role });

    return {
      id: userId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      createdAt: now.toISOString(),
    };
  }

  async updateLastLogin(userId: string) {
    await this.firebase.db.collection('users').doc(userId).update({
      lastLoginAt: new Date(),
    });
  }

  async listUsers() {
    const snap = await this.firebase.db
      .collection('users')
      .where('isActive', '==', true)
      .orderBy('fullName')
      .get();

    return this.firebase.docsToArray(snap.docs).map(({ passwordHash, firebaseUid, ...u }: any) => u);
  }
}
