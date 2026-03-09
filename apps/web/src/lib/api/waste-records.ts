import { api } from '../api';

export const wasteRecordsApi = {
  getAll: (params?: { locationId?: string; productId?: string; type?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/waste-records', params),

  getById: (id: string) => api.get<any>(`/waste-records/${id}`),

  runWasteAnalysis: () =>
    api.post<{ summary: any; aiEvent: any }>('/waste-records/run-analysis'),

  create: (data: { locationId: string; productId: string; type: string; reason?: string; quantity: number; unit?: string; notes?: string }) =>
    api.post<any>('/waste-records', data),
};
