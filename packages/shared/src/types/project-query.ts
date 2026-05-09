import { ProjectQueryPriority, ProjectQueryStatus, UserRole } from './enums';

export interface ProjectQueryMessage {
  id: string;
  queryId: string;
  projectId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole | string;
  createdAt: string;
}

export interface ProjectQuery {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: ProjectQueryStatus;
  priority: ProjectQueryPriority;
  createdBy: string;
  createdByName: string;
  createdByRole: UserRole | string;
  assignedTo: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}
