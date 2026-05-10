import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

const DOCUMENT_TYPES = new Set(['ORDER', 'INVOICE', 'REPORT', 'GUIDE', 'OTHER']);

@Injectable()
export class ProjectDocumentsService {
  constructor(private firebase: FirebaseService) {}

  private projectRef(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId);
  }

  private col(projectId: string) {
    return this.projectRef(projectId).collection('documents');
  }

  private async assertProject(projectId: string) {
    const doc = await this.projectRef(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) throw new NotFoundException('Proyecto no encontrado');
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    const snap = await this.col(projectId).orderBy('createdAt', 'desc').get();
    return this.firebase.docsToArray(snap.docs);
  }

  async create(projectId: string, data: any, userId: string) {
    await this.assertProject(projectId);
    const type = String(data.type || 'OTHER').toUpperCase();
    if (!DOCUMENT_TYPES.has(type)) throw new BadRequestException('Tipo de documento invalido');
    const name = String(data.name || '').trim();
    const url = String(data.url || '').trim();
    if (!name || !url) throw new BadRequestException('Nombre y URL del archivo son obligatorios');

    const id = this.firebase.generateId();
    const now = new Date();
    const docData = {
      type,
      name,
      url,
      storagePath: typeof data.storagePath === 'string' ? data.storagePath.trim() : null,
      mimeType: typeof data.mimeType === 'string' ? data.mimeType.trim() : null,
      size: Number(data.size) || 0,
      notes: typeof data.notes === 'string' ? data.notes.trim() : null,
      uploadedBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData };
  }

  async delete(projectId: string, id: string) {
    await this.assertProject(projectId);
    const ref = this.col(projectId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Documento no encontrado');
    await ref.delete();
    return { id };
  }
}
