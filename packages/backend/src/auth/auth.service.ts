import { Injectable, Logger, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UserRole } from '@fym/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    allowedProjectIds?: string[];
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

    // Create user profile in Firestore + custom claims con compensación si algo falla.
    const userId = this.firebase.generateId();
    const now = new Date();
    const userData = {
      email: data.email,
      fullName: data.fullName,
      phone: data.phone || null,
      role: data.role,
      allowedProjectIds: data.role === 'CLIENT' ? this.normalizeProjectIds(data.allowedProjectIds) : [],
      isActive: true,
      firebaseUid: firebaseUser.uid,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.firebase.db.collection('users').doc(userId).set(userData);
    } catch (firestoreError) {
      // Firestore falló: revertir el usuario creado en Firebase Auth para no dejar huérfano.
      this.logger.error(
        `Firestore set falló al crear ${data.email}; revirtiendo usuario Auth ${firebaseUser.uid}`,
        firestoreError instanceof Error ? firestoreError.stack : String(firestoreError),
      );
      try {
        await this.firebase.auth.deleteUser(firebaseUser.uid);
      } catch (rollbackError) {
        this.logger.error(
          `No se pudo revertir el usuario Auth ${firebaseUser.uid}. Requiere limpieza manual.`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      }
      throw new InternalServerErrorException('No se pudo persistir el usuario');
    }

    try {
      await this.firebase.auth.setCustomUserClaims(firebaseUser.uid, { role: data.role });
    } catch (claimsError) {
      // Los claims fallaron: el usuario quedaría sin rol propagado en token.
      // Loguear con severidad alta y dejar el documento creado para reintento manual de claims.
      this.logger.error(
        `setCustomUserClaims falló para ${firebaseUser.uid} (rol=${data.role}). El usuario existe pero deberá refrescar claims.`,
        claimsError instanceof Error ? claimsError.stack : String(claimsError),
      );
    }

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

  /**
   * Actualiza lastLoginAt sólo si pasaron más de `minMinutes` desde el último registro.
   * Evita saturar Firestore en cada llamada a /auth/me y conserva una señal útil de auditoría.
   */
  async touchLastLoginIfStale(userId: string, minMinutes = 10): Promise<void> {
    try {
      const ref = this.firebase.db.collection('users').doc(userId);
      const doc = await ref.get();
      if (!doc.exists) return;
      const last = doc.data()?.lastLoginAt;
      const lastDate: Date | null = last?.toDate ? last.toDate() : last ? new Date(last) : null;
      const now = new Date();
      const stale = !lastDate || now.getTime() - lastDate.getTime() > minMinutes * 60_000;
      if (stale) {
        await ref.update({ lastLoginAt: now });
      }
    } catch {
      // Falla silenciosa: no bloquear /auth/me por una métrica de auditoría.
    }
  }

  async listUsers() {
    const snap = await this.firebase.db
      .collection('users')
      .orderBy('fullName')
      .get();

    const users = this.firebase.docsToArray(snap.docs).map(({ passwordHash, firebaseUid, ...u }: any) => u);
    await this.attachAllowedProjects(users);
    return users;
  }

  async listAssignableUsers() {
    const assignableRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ENGINEER,
      UserRole.FIELD_SUPERVISOR,
    ];

    const snap = await this.firebase.db
      .collection('users')
      .where('isActive', '==', true)
      .where('role', 'in', assignableRoles)
      .orderBy('fullName')
      .get();

    return this.firebase.docsToArray(snap.docs).map(({ passwordHash, firebaseUid, ...u }: any) => u);
  }

  async updateUserRole(userId: string, role: string) {
    const doc = await this.firebase.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Usuario no encontrado');

    const user = doc.data() as any;
    const previousRole = user.role;
    const updateData: Record<string, any> = { role, updatedAt: new Date() };
    if (role !== 'CLIENT') updateData.allowedProjectIds = [];
    await this.firebase.db.collection('users').doc(userId).update(updateData);

    if (user.firebaseUid) {
      try {
        await this.firebase.auth.setCustomUserClaims(user.firebaseUid, { role });
      } catch (error) {
        // Si los custom claims fallaron, revertimos el rol en Firestore para evitar
        // un usuario con permisos visibles distintos a los de su token.
        this.logger.error(
          `setCustomUserClaims falló para ${user.firebaseUid}; revirtiendo rol en Firestore (${role} → ${previousRole})`,
          error instanceof Error ? error.stack : String(error),
        );
        await this.firebase.db.collection('users').doc(userId).update({
          role: previousRole,
          updatedAt: new Date(),
        });
        throw new InternalServerErrorException('No se pudo actualizar el rol en Firebase Auth');
      }
    }

    return { id: userId, role };
  }

  async updateClientAccess(userId: string, allowedProjectIds: string[]) {
    const doc = await this.firebase.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Usuario no encontrado');

    const user = doc.data() as any;
    if (user.role !== 'CLIENT') {
      throw new ConflictException('Solo los usuarios con rol Cliente pueden tener proyectos asignados');
    }

    const normalized = this.normalizeProjectIds(allowedProjectIds);
    await this.firebase.db.collection('users').doc(userId).update({
      allowedProjectIds: normalized,
      updatedAt: new Date(),
    });

    return { id: userId, allowedProjectIds: normalized };
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const doc = await this.firebase.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Usuario no encontrado');

    const user = doc.data() as any;
    const previousIsActive = user.isActive;
    await this.firebase.db.collection('users').doc(userId).update({ isActive, updatedAt: new Date() });

    if (user.firebaseUid) {
      try {
        await this.firebase.auth.updateUser(user.firebaseUid, { disabled: !isActive });
      } catch (error) {
        // Si Auth no aceptó el cambio, revertimos Firestore para mantener coherencia
        // (de lo contrario un usuario "activo" en UI pero "deshabilitado" en Auth no podría loguear).
        this.logger.error(
          `auth.updateUser falló para ${user.firebaseUid}; revirtiendo isActive (${isActive} → ${previousIsActive})`,
          error instanceof Error ? error.stack : String(error),
        );
        await this.firebase.db.collection('users').doc(userId).update({
          isActive: previousIsActive,
          updatedAt: new Date(),
        });
        throw new InternalServerErrorException('No se pudo actualizar el estado en Firebase Auth');
      }
    }

    return { id: userId, isActive };
  }

  async deleteUser(userId: string) {
    const doc = await this.firebase.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Usuario no encontrado');

    const user = doc.data() as any;

    // Borramos primero en Auth: si Auth falla, mantenemos Firestore (operador puede reintentar).
    // Si Auth borró pero Firestore falla, loguear con severidad para limpieza manual.
    if (user.firebaseUid) {
      try {
        await this.firebase.auth.deleteUser(user.firebaseUid);
      } catch (error: any) {
        // user-not-found en Auth no es un problema: seguimos con la limpieza en Firestore.
        if (error?.code !== 'auth/user-not-found') {
          this.logger.error(
            `Falló deleteUser en Auth para ${user.firebaseUid}`,
            error instanceof Error ? error.stack : String(error),
          );
          throw new InternalServerErrorException('No se pudo eliminar el usuario en Firebase Auth');
        }
      }
    }

    try {
      await this.firebase.db.collection('users').doc(userId).delete();
    } catch (error) {
      this.logger.error(
        `Auth eliminado pero Firestore falló para ${userId}. Requiere limpieza manual del documento.`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Usuario parcialmente eliminado, contacta soporte');
    }

    return { id: userId };
  }

  private normalizeProjectIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map(String).map((id) => id.trim()).filter(Boolean)));
  }

  private async attachAllowedProjects(users: any[]) {
    const projectIds = Array.from(
      new Set(users.flatMap((user) => (Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : []))),
    );
    if (projectIds.length === 0) return;

    const refs = projectIds.map((id) => this.firebase.db.collection('projects').doc(id));
    const docs = await this.firebase.db.getAll(...refs);
    const projectMap = new Map(
      docs.filter((doc) => doc.exists).map((doc) => [doc.id, { id: doc.id, projectCode: doc.data()?.projectCode, name: doc.data()?.name }]),
    );

    for (const user of users) {
      user.allowedProjects = (Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [])
        .map((id: string) => projectMap.get(id))
        .filter(Boolean);
    }
  }
}
