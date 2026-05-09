import { ProjectQueryPriority, ProjectQueryStatus } from '@fym/shared';
import { api } from './api';

export type ProjectQueryItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: ProjectQueryStatus;
  priority: ProjectQueryPriority;
  createdByName: string;
  updatedAt: string;
  lastMessageAt: string;
};

export type ProjectQueryMessage = {
  id: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
};

export const queriesApi = {
  listByProject(projectId: string, token: string, filters?: { status?: string; priority?: string }) {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.priority && filters.priority !== 'ALL') params.set('priority', filters.priority);
    const query = params.toString();
    return api.get<ProjectQueryItem[]>(`/projects/${projectId}/queries${query ? `?${query}` : ''}`, token);
  },

  detail(projectId: string, queryId: string, token: string) {
    return api.get<ProjectQueryItem & { messages: ProjectQueryMessage[] }>(`/projects/${projectId}/queries/${queryId}`, token);
  },

  create(projectId: string, token: string, payload: { title: string; description: string; priority: ProjectQueryPriority }) {
    return api.post<ProjectQueryItem>(`/projects/${projectId}/queries`, payload, token);
  },

  addMessage(projectId: string, queryId: string, token: string, payload: { body: string }) {
    return api.post(`/projects/${projectId}/queries/${queryId}/messages`, payload, token);
  },

  updateStatus(projectId: string, queryId: string, token: string, status: ProjectQueryStatus) {
    return api.patch(`/projects/${projectId}/queries/${queryId}/status`, { status }, token);
  },
};
