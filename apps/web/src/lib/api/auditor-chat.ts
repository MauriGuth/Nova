import { api } from '@/lib/api';

export interface AuditorChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AuditorConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditorMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AuditorConversationWithMessages {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AuditorMessageRecord[];
}

export const auditorChatApi = {
  chat: (params: { message: string; history?: AuditorChatMessage[] }) =>
    api.post<{ reply: string }>('/auditor-chat', params),

  getConversations: () =>
    api.get<AuditorConversationListItem[]>('/auditor-chat/conversations'),

  createConversation: () =>
    api.post<AuditorConversationListItem & { updatedAt: string }>('/auditor-chat/conversations'),

  getConversation: (id: string) =>
    api.get<AuditorConversationWithMessages>(`/auditor-chat/conversations/${id}`),

  sendMessage: (conversationId: string, content: string) =>
    api.post<{
      userMessage: AuditorMessageRecord;
      assistantMessage: AuditorMessageRecord;
    }>(`/auditor-chat/conversations/${conversationId}/messages`, { content }),

  getMetrics: () =>
    api.get<{
      summary: Record<string, number | string>;
      charts: Array<{
        id: string;
        type: 'bar' | 'line' | 'pie';
        title: string;
        dataKey?: string;
        data: Array<Record<string, unknown>>;
      }>;
    }>('/auditor-chat/metrics'),
};
