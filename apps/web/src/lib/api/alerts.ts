import { api } from '../api';

export const alertsApi = {
  getAll: (params?: { locationId?: string; type?: string; priority?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/alerts', params),

  getById: (id: string) => api.get<any>(`/alerts/${id}`),

  getCount: (locationId?: string) => api.get<{ count: number }>('/alerts/count', locationId ? { locationId } : undefined),

  create: (data: any) => api.post<any>('/alerts', data),

  markAsRead: (id: string) => api.post<any>(`/alerts/${id}/read`),

  resolve: (id: string) => api.post<any>(`/alerts/${id}/resolve`),

  dismiss: (id: string) => api.post<any>(`/alerts/${id}/dismiss`),

  checkStock: (locationId?: string) =>
    api.post<any>('/alerts/check-stock', undefined, {
      params: locationId ? { locationId } : undefined,
    }),
};
