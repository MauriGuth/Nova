import { api } from '../api';

export interface ParsedPriceItem {
  description: string;
  unitCost: number;
  supplierSku?: string;
  suggestedProductId?: string;
}

/** Tabla para mostrar el listado: encabezados + filas */
export interface PriceListTable {
  headers: string[];
  rows: (string | number)[][];
}

export const suppliersApi = {
  getAll: (params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number; page: number; limit: number }>('/suppliers', params),

  getById: (id: string) => api.get<any>(`/suppliers/${id}`),

  /** Productos vinculados a este proveedor (para ingreso manual, etc.) */
  getProducts: (supplierId: string) =>
    api.get<Array<{ id: string; sku: string; name: string; unit: string }>>(`/suppliers/${supplierId}/products`),

  create: (data: any) => api.post<any>('/suppliers', data),

  update: (id: string, data: any) => api.patch<any>(`/suppliers/${id}`, data),

  delete: (id: string) => api.delete(`/suppliers/${id}`),

  addProduct: (supplierId: string, data: any) => api.post<any>(`/suppliers/${supplierId}/products`, data),

  updateProductLink: (id: string, data: any) => api.patch<any>(`/suppliers/product-links/${id}`, data),

  removeProductLink: (id: string) => api.delete(`/suppliers/product-links/${id}`),

  /** Extrae productos y precios de un archivo (sin guardar). Para uso al crear proveedor. */
  parsePriceList: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ items: ParsedPriceItem[]; transcript: string; table?: PriceListTable }>('/suppliers/parse-price-list', form);
  },

  /** Sube listado y lo guarda en el proveedor. Con skipExtraction: true no se analiza con IA. La extracción con IA puede tardar 1–3 min. */
  uploadPriceList: (supplierId: string, file: File, options?: { skipExtraction?: boolean }) => {
    const form = new FormData();
    form.append('file', file);
    const url = options?.skipExtraction
      ? `/suppliers/${supplierId}/price-lists?skipExtraction=true`
      : `/suppliers/${supplierId}/price-lists`;
    type Result = { saved: true; priceListId: string; fileUrl: string; items?: ParsedPriceItem[]; extractedText?: string; table?: PriceListTable };
    if (!options?.skipExtraction) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6 * 60 * 1000); // 6 min para listados grandes
      return api.post<Result>(url, form, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
    }
    return api.post<Result>(url, form);
  },

  getPriceLists: (supplierId: string) =>
    api.get<Array<{
      id: string;
      fileName: string;
      mimeType: string;
      createdAt: string;
      extractedData: ParsedPriceItem[];
      extractedText: string | null;
      extractedTable: PriceListTable | null;
      filePath: string;
    }>>(`/suppliers/${supplierId}/price-lists`),

  /** Comparación por rubro (usa listados extraídos de proveedores del mismo rubro) */
  getPriceComparisonByRubro: (rubro: string) =>
    api.get<{
      rubro: string;
      suppliers: Array<{ id: string; name: string }>;
      priceKeys: string[];
      items: Array<{
        description: string;
        prices: Array<{
          supplierId: string;
          supplierName: string;
          unitCost: number | null;
          priceBreakdown?: Record<string, number>;
        }>;
      }>;
    }>('/suppliers/price-comparison-by-rubro', { rubro: rubro || undefined }),

  /** Buscar en listados de precios subidos (foto/PDF) por producto; usa OpenAI. */
  getPriceComparisonBySearchInLists: (query: string) =>
    api.post<{
      suppliers: Array<{ id: string; name: string }>;
      priceKeys: string[];
      items: Array<{
        description: string;
        prices: Array<{
          supplierId: string;
          supplierName: string;
          unitCost: number | null;
          priceBreakdown?: Record<string, number>;
        }>;
      }>;
      noListsWithData?: boolean;
    }>('/suppliers/price-comparison-search-in-lists', { query: query.trim() }),

  /** Comparación de precios: productos con precios por proveedor */
  getPriceComparison: () =>
    api.get<{
      products: Array<{
        id: string;
        name: string;
        sku: string | null;
        unit: string;
        suppliers: Array<{ supplierId: string; supplierName: string; unitCost: number | null }>;
      }>;
    }>('/suppliers/price-comparison'),

  /** Comparación de precios filtrada por búsqueda de producto (OpenAI). */
  getPriceComparisonByProductSearch: (query: string) =>
    api.post<{
      products: Array<{
        id: string;
        name: string;
        sku: string | null;
        unit: string;
        suppliers: Array<{ supplierId: string; supplierName: string; unitCost: number | null }>;
      }>;
    }>('/suppliers/price-comparison-search', { query: query.trim() }),
};
