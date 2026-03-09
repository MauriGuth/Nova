import { api } from '../api';

export const tablesApi = {
  getAll: (locationId: string) => api.get<any[]>('/tables', { locationId }),

  getById: (id: string) => api.get<any>(`/tables/${id}`),

  getMap: (locationId: string) => api.get<any>(`/tables/map/${locationId}`),

  create: (data: any) => api.post<any>('/tables', data),

  update: (id: string, data: any) => api.patch<any>(`/tables/${id}`, data),

  updateStatus: (id: string, status: string) => api.patch<any>(`/tables/${id}/status`, { status }),

  delete: (id: string) => api.delete(`/tables/${id}`),
};
