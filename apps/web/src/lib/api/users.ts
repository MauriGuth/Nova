import { api } from '../api';

export const usersApi = {
  getAll: (params?: { search?: string; role?: string; locationId?: string; isActive?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number; page: number; limit: number }>('/users', params),

  getById: (id: string) => api.get<any>(`/users/${id}`),

  create: (data: any) => api.post<any>('/users', data),

  update: (id: string, data: any) => api.patch<any>(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ url: string }>('/users/upload-avatar', form);
  },
};
