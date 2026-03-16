import { api } from '../api';

export type ProductForCount = {
  productId: string
  product: { id: string; name: string; sku: string; unit: string; familia?: string }
  unit: string
}

export const stockReconciliationsApi = {
  getProductsForCount: (locationId: string, shiftLabel?: string) =>
    api.get<ProductForCount[]>(
      '/stock-reconciliations/products-for-count',
      shiftLabel ? { locationId, shiftLabel } : { locationId }
    ),

  getOrCreateDraft: (data: { locationId: string; shiftLabel?: string }) =>
    api.post<any>('/stock-reconciliations/draft', data),

  create: (data: { locationId: string; shiftLabel?: string }) =>
    api.post<any>('/stock-reconciliations', data),

  submit: (id: string, data: { items: Array<{ productId: string; countedQuantity: number }> }) =>
    api.post<any>(`/stock-reconciliations/${id}/submit`, data),

  getAll: (params?: { locationId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(
      '/stock-reconciliations',
      params as Record<string, string | number | undefined>
    ),

  getById: (id: string) =>
    api.get<any>(`/stock-reconciliations/${id}`),

  /** Indica si ya se envió el micro balance (turno tarde) para este local hoy. */
  hasAfternoonSubmittedToday: (locationId: string) =>
    api.get<boolean>('/stock-reconciliations', {
      locationId,
      afternoonSubmittedToday: '1',
    }),
};
