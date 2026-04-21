import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private firebase: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await this.firebase.auth.verifyIdToken(token);

      // Fetch user profile from Firestore
      const userDoc = await this.firebase.db
        .collection('users')
        .where('firebaseUid', '==', decodedToken.uid)
        .limit(1)
        .get();

      if (userDoc.empty) {
        throw new UnauthorizedException('Usuario no encontrado en el sistema');
      }

      const userData = userDoc.docs[0];
      const user = { id: userData.id, ...userData.data() };

      if (!(user as any).isActive) {
        throw new UnauthorizedException('Usuario desactivado');
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
