import { api } from '../api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010/api';

export const paymentOrdersApi = {
  getAll: (params?: { status?: string; supplierId?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number; page?: number; limit?: number }>('/payment-orders', params),

  getById: (id: string) => api.get<any>(`/payment-orders/${id}`),

  markAsPaid: (id: string) =>
    api.patch<any>(`/payment-orders/${id}`, { status: 'paid' }),

  uploadPaymentProof: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const token = api.getToken();
    const res = await fetch(`${API_URL}/payment-orders/${id}/payment-proof`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || 'Error al subir comprobante');
    }
    return res.json();
  },
};
