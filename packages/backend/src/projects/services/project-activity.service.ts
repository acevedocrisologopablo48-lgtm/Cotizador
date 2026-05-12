import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { ProjectActivityAction } from '@fym/shared';

@Injectable()
export class ProjectActivityService {
  constructor(private firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('projectActivityLog');
  }

  /**
   * Append a log entry to the project activity log.
   * This is fire-and-forget (does not throw on failure to avoid
   * blocking the main operation).
   */
  async log(params: {
    projectId: string;
    action: ProjectActivityAction;
    entityType: 'TASK' | 'MILESTONE' | 'PROJECT';
    entityId: string;
    details: Record<string, any>;
    userId: string;
    userName: string;
  }): Promise<void> {
    try {
      const id = this.firebase.generateId();
      await this.col.doc(id).set({
        ...params,
        createdAt: new Date(),
      });
    } catch (err) {
      // Log errors but don't propagate — activity log is non-critical
      console.error('[ProjectActivityService] Failed to write log entry:', err);
    }
  }

  /**
   * Get recent activity for a project.
   */
  async findByProject(projectId: string, limit = 30) {
    const snap = await this.col
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const logs = this.firebase.docsToArray(snap.docs);
    const missingNameUserIds = Array.from(new Set(
      logs
        .filter((log: any) => !String(log.userName || '').trim() && log.userId)
        .map((log: any) => String(log.userId)),
    ));

    if (missingNameUserIds.length === 0) return logs;

    const refs = missingNameUserIds.map((id) => this.firebase.db.collection('users').doc(id));
    const docs = await this.firebase.db.getAll(...refs);
    const userMap = new Map(
      docs
        .filter((doc) => doc.exists)
        .map((doc) => [doc.id, doc.data() as any]),
    );

    return logs.map((log: any) => {
      if (String(log.userName || '').trim() || !log.userId) return log;
      const user = userMap.get(String(log.userId));
      return {
        ...log,
        userName: user?.fullName || user?.email || 'Usuario del sistema',
      };
    });
  }
}
