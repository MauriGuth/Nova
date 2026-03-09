import { api } from '../api';

export const ordersApi = {
  getAll: (params?: { locationId?: string; status?: string; type?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/orders', params),

  getById: (id: string) => api.get<any>(`/orders/${id}`),

  updateSplit: (id: string, data: { customerCount?: number; splitMode?: boolean; itemPayer?: Record<string, number | Record<number, number>> }) =>
    api.patch<any>(`/orders/${id}`, data),

  getKitchenOrders: (locationId: string) => api.get<any>(`/orders/kitchen/${locationId}`),

  create: (data: any) => api.post<any>('/orders', data),

  addItem: (orderId: string, data: any) => api.post<any>(`/orders/${orderId}/items`, data),

  updateItemStatus: (itemId: string, data: any) => api.patch<any>(`/orders/items/${itemId}/status`, data),

  updateOrderItem: (itemId: string, data: { quantity?: number; notes?: string }) =>
    api.patch<any>(`/orders/items/${itemId}`, data),

  removeOrderItem: (itemId: string) => api.delete<any>(`/orders/items/${itemId}`),

  close: (id: string, data: any) => api.post<any>(`/orders/${id}/close`, data),

  cancel: (id: string) => api.post<any>(`/orders/${id}/cancel`),

  /** Cambio de mesa (solo Cajero/Admin). Mueve la orden a otra mesa. */
  changeTable: (orderId: string, newTableId: string) =>
    api.patch<any>(`/orders/${orderId}/change-table`, { newTableId }),

  /** Mueve ítems seleccionados a otra mesa (solo Cajero/Admin). */
  moveItems: (orderId: string, itemIds: string[], newTableId: string) =>
    api.patch<any>(`/orders/${orderId}/move-items`, { itemIds, newTableId }),

  getReadyItems: (locationId: string) => api.get<any[]>(`/orders/ready-items/${locationId}`),

  getSalesByWeek: (locationId?: string) =>
    api.get<{ day: string; current: number; previous: number }[]>('/orders/sales-by-week', locationId ? { locationId } : undefined),

  getSalesByDay: (params?: { dateFrom: string; dateTo: string; locationId?: string }) =>
    api.get<{ date: string; amount: number }[]>('/orders/sales-by-day', params),

  getSalesByDayAndHour: (params?: { dateFrom: string; dateTo: string; locationId?: string }) =>
    api.get<{ dayOfWeek: number; hour: number; total: number; count: number; ticketAvg: number }[]>('/orders/sales-by-day-hour', params),

  getTopProductsBySales: (params?: { dateFrom: string; dateTo: string; locationId?: string; limit?: number }) =>
    api.get<{ productId: string; name: string; categoryName: string; total: number; quantity: number }[]>('/orders/sales-top-products', params),

  getTopCategoriesBySales: (params?: { dateFrom: string; dateTo: string; locationId?: string; limit?: number }) =>
    api.get<{ categoryId: string; name: string; total: number }[]>('/orders/sales-top-categories', params),
};
