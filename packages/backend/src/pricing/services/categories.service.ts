import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

@Injectable()
export class CategoriesService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('categories');
  }

  async findAll(moduleType?: string) {
    let query: FirebaseFirestore.Query = this.col;
    if (moduleType) {
      query = query.where('moduleType', '==', moduleType);
    }
    const snap = await query.orderBy('sortOrder', 'asc').get();
    const categories = this.firebase.docsToArray(snap.docs);

    // Fetch children (simplified 1-level fetch, normally recursive or flattened)
    for (const cat of categories) {
      const childSnap = await this.col.where('parentId', '==', cat.id).orderBy('sortOrder', 'asc').get();
      cat.children = this.firebase.docsToArray(childSnap.docs);
      
      const suppliesSnap = await this.firebase.db.collection('supplies').where('categoryId', '==', cat.id).count().get();
      cat._count = { supplies: suppliesSnap.data().count };
    }

    return categories;
  }

  async findTree(moduleType?: string) {
    let query: FirebaseFirestore.Query = this.col.where('parentId', '==', null);
    if (moduleType) {
      query = query.where('moduleType', '==', moduleType);
    }
    const snap = await query.orderBy('sortOrder', 'asc').get();
    const rootCats = this.firebase.docsToArray(snap.docs);

    const loadChildren = async (parent: any) => {
      const childSnap = await this.col.where('parentId', '==', parent.id).orderBy('sortOrder', 'asc').get();
      parent.children = this.firebase.docsToArray(childSnap.docs);
      for (const child of parent.children) {
        await loadChildren(child);
      }
      const suppliesSnap = await this.firebase.db.collection('supplies').where('categoryId', '==', parent.id).count().get();
      parent._count = { supplies: suppliesSnap.data().count };
    };

    for (const cat of rootCats) {
      await loadChildren(cat);
      const suppliesSnap = await this.firebase.db.collection('supplies').where('categoryId', '==', cat.id).count().get();
      cat._count = { supplies: suppliesSnap.data().count };
    }

    return rootCats;
  }

  async create(data: { name: string; parentId?: string; moduleType: string; sortOrder?: number }) {
    const id = this.firebase.generateId();
    const docData = { ...data, createdAt: new Date() };
    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, data: { name?: string; sortOrder?: number }) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Categoría no encontrada');
    await this.col.doc(id).update(data);
    return { id, ...doc.data(), ...data };
  }

  async delete(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Categoría no encontrada');
    await this.col.doc(id).delete();
    return { message: 'Categoría eliminada' };
  }
}
