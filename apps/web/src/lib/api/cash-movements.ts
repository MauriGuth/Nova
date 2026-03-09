import { api } from '../api';

export const cashMovementsApi = {
  getAll: (locationId: string, limit?: number) =>
    api.get<any[]>('/cash-movements', { locationId, limit }),

  create: (data: {
    locationId: string;
    type: 'in' | 'out' | 'expense' | 'withdrawal' | 'extra_income';
    amount: number;
    reason?: string;
    cashRegisterId?: string;
  }) => api.post<any>('/cash-movements', data),

  getByDay: (params?: { dateFrom: string; dateTo: string; locationId?: string }) =>
    api.get<{ date: string; amount: number }[]>('/cash-movements/by-day', params),
};
