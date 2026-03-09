import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  AddProductSupplierDto,
  UpdateProductSupplierDto,
} from './dto/add-product-supplier.dto';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import { Prisma } from '../../generated/prisma';

/** Precios discriminados tal como en el listado: Caja Neto, Caja Final, Botella Neto, etc. */
export type PriceBreakdown = Record<string, number>;

/** Nombres estándar para columnas de precio (unificados para la comparación). Listados tipo "Lista Precios Nacional" con Precios por Cajas/Botellas → Neto/Final. */
const PRICE_KEY_ALIASES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /caja\s*neto|neto\s*caja|precios?\s*por\s*cajas?\s*neto|precios?\s*cajas?\s*neto/i, key: 'Caja Neto' },
  { pattern: /caja\s*final|final\s*caja|precios?\s*por\s*cajas?\s*final|precios?\s*cajas?\s*final/i, key: 'Caja Final' },
  { pattern: /botella\s*neto|neto\s*botella|precios?\s*por\s*botellas?\s*neto|precios?\s*botellas?\s*neto/i, key: 'Botella Neto' },
  { pattern: /botella\s*final|final\s*botella|precios?\s*por\s*botellas?\s*final|precios?\s*botellas?\s*final/i, key: 'Botella Final' },
  { pattern: /^neto$|precio\s*neto|sin\s*iva/i, key: 'Neto' },
  { pattern: /^final$|precio\s*final|con\s*iva/i, key: 'Final' },
];

/** Normaliza texto para comparación (minúsculas, sin acentos, espacios colapsados). */
function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte valor de precio a número. Acepta formato argentino (58.885,36) y US (58885.36). */
function parsePriceValue(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = typeof v === 'string' ? v.trim().replace(/\s/g, '') : '';
  if (!s) return null;
  const withoutSymbol = s.replace(/^\$?\s*/, '');
  const hasComma = withoutSymbol.includes(',');
  const hasPoint = withoutSymbol.includes('.');
  let numStr: string;
  if (hasComma && hasPoint) {
    const commaPos = withoutSymbol.lastIndexOf(',');
    const pointPos = withoutSymbol.lastIndexOf('.');
    if (commaPos > pointPos) numStr = withoutSymbol.replace(/\./g, '').replace(',', '.');
    else numStr = withoutSymbol.replace(/,/g, '');
  } else if (hasComma) numStr = withoutSymbol.replace(',', '.');
  else numStr = withoutSymbol;
  const n = parseFloat(numStr);
  return Number.isFinite(n) ? n : null;
}

function normalizePriceBreakdownKeys(breakdown: Record<string, number>): PriceBreakdown {
  const out: PriceBreakdown = {};
  for (const [k, v] of Object.entries(breakdown)) {
    const trimmed = (k || '').trim();
    if (!trimmed || typeof v !== 'number' || !Number.isFinite(v)) continue;
    let key = trimmed;
    for (const { pattern, key: standard } of PRICE_KEY_ALIASES) {
      if (pattern.test(trimmed)) {
        key = standard;
        break;
      }
    }
    if (!out[key] || v !== 0) out[key] = v;
  }
  return out;
}

export interface ParsedPriceItem {
  description: string;
  unitCost: number;
  supplierSku?: string;
  unit?: string;
  quantity?: number;
  suggestedProductId?: string;
  /** Precios tal como en el archivo: neto, final, con IVA, sin IVA, por caja, por botella, etc. */
  priceBreakdown?: PriceBreakdown;
}

/** Tabla para mostrar el listado: encabezados + filas de celdas */
export interface PriceListTable {
  headers: string[];
  rows: (string | number)[][];
}

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { search, isActive, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { legalName: { contains: search } },
        { contactName: { contains: search } },
        { contactEmail: { contains: search } },
        { taxId: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { productSuppliers: true },
          },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        productSuppliers: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                avgCost: true,
                isActive: true,
              },
            },
          },
        },
        goodsReceipts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            receiptNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    }

    return supplier;
  }

  /** Productos vinculados a este proveedor (ProductSupplier + ítems de listados de precios con suggestedProductId) */
  async getProductsBySupplierId(supplierId: string) {
    await this.findById(supplierId);
    const productIds = new Set<string>();

    // 1) Productos explícitamente vinculados (ProductSupplier)
    const links = await this.prisma.productSupplier.findMany({
      where: { supplierId },
      include: {
        product: {
          select: { id: true, sku: true, name: true, unit: true, isActive: true },
        },
      },
    });
    const fromLinks: Array<{ id: string; sku: string; name: string; unit: string }> = [];
    for (const ps of links) {
      if (ps.product?.isActive !== false) {
        productIds.add(ps.product.id);
        fromLinks.push({
          id: ps.product.id,
          sku: ps.product.sku,
          name: ps.product.name,
          unit: ps.product.unit,
        });
      }
    }

    // 2) Productos de listados de precios subidos (foto/archivo analizados por IA: extractedData con suggestedProductId y descripciones)
    const priceLists = await this.prisma.supplierPriceList.findMany({
      where: { supplierId },
      select: { extractedData: true },
    });
    const idsFromLists = new Set<string>();
    const descriptionsWithoutId: string[] = [];
    for (const pl of priceLists) {
      const raw = pl.extractedData as unknown;
      let items: (ParsedPriceItem & { matchedProductId?: string })[] | null = null;
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray((raw as { items: unknown }).items)) {
        items = (raw as { items: (ParsedPriceItem & { matchedProductId?: string })[] }).items;
      }
      if (!items) continue;
      for (const it of items) {
        const row = it as unknown as Record<string, unknown>;
        const id =
          (row?.suggestedProductId as string) ??
          (row?.matchedProductId as string) ??
          (row?.suggested_product_id as string) ??
          (row?.productId as string);
        const desc = ((row?.description as string) || '').trim();
        const idStr = typeof id === 'string' ? id.trim() : '';
        if (idStr) {
          idsFromLists.add(idStr);
        } else if (desc.length >= 2) {
          descriptionsWithoutId.push(desc);
        }
      }
    }

    // 3) Ítems del listado (IA) sin suggestedProductId: matchear por nombre/descripción (fallback, con normalización y criterio amplio)
    if (descriptionsWithoutId.length > 0) {
      const allProducts = await this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sku: true },
      });
      const seenDesc = new Set<string>();
      for (const desc of descriptionsWithoutId) {
        const key = normalizeForMatch(desc).slice(0, 80);
        if (seenDesc.has(key)) continue;
        seenDesc.add(key);
        const d = normalizeForMatch(desc);
        const descWords = d.split(/\s+/).filter((w) => w.length >= 2);
        let best: { id: string; score: number } | null = null;
        for (const p of allProducts) {
          if (!p.name) continue;
          const pName = normalizeForMatch(p.name as string);
          const pSku = normalizeForMatch(p.sku || '');
          if (d.includes(pName) || pName.includes(d.slice(0, 70))) {
            const score = pName.length;
            if (!best || score > best.score) best = { id: p.id, score };
            continue;
          }
          if (pSku && d.includes(pSku)) {
            if (!best || 50 > best.score) best = { id: p.id, score: 50 };
            continue;
          }
          const matchWords = descWords.filter((w) => pName.includes(w) || (pSku && pSku.includes(w)));
          const score = matchWords.length;
          if (score >= 1 && (!best || score > best.score)) best = { id: p.id, score };
        }
        if (best) idsFromLists.add(best.id);
      }
    }

    const extraIds = [...idsFromLists].filter((id) => !productIds.has(id));
    if (extraIds.length > 0) {
      const productsFromLists = await this.prisma.product.findMany({
        where: { id: { in: extraIds }, isActive: true },
        select: { id: true, sku: true, name: true, unit: true },
      });
      for (const p of productsFromLists) {
        if (productIds.has(p.id)) continue;
        productIds.add(p.id);
        fromLinks.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
        });
      }
    }

    return fromLinks.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(data: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data,
    });
  }

  async update(id: string, data: UpdateSupplierDto) {
    await this.findById(id);

    return this.prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productSupplier.deleteMany({ where: { supplierId: id } });
        await tx.supplierPriceList.deleteMany({ where: { supplierId: id } });
        await tx.supplierPriceHistory.deleteMany({ where: { supplierId: id } });
        await tx.supplier.delete({ where: { id } });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Foreign key') || msg.includes('violates foreign key') || msg.includes('referential integrity')) {
        throw new BadRequestException(
          'No se puede eliminar el proveedor: tiene recibos de mercadería u órdenes de pago asociados. Eliminá o reasigná esos registros primero.',
        );
      }
      throw err;
    }
  }

  async getPriceHistory(
    supplierId: string,
    opts: { productId?: string; limit?: number },
  ) {
    const limit = Math.min(opts.limit ?? 100, 500);
    const where: Record<string, unknown> = { supplierId };
    if (opts.productId) where.productId = opts.productId;

    const records = await this.prisma.supplierPriceHistory.findMany({
      where,
      take: limit,
      orderBy: { recordedAt: 'desc' },
      include: {
        product: {
          select: { id: true, sku: true, name: true, unit: true },
        },
      },
    });
    return records;
  }

  async addProductSupplier(supplierId: string, data: AddProductSupplierDto) {
    await this.findById(supplierId);

    return this.prisma.productSupplier.create({
      data: {
        supplierId,
        productId: data.productId,
        supplierSku: data.supplierSku,
        unitCost: data.unitCost,
        minOrderQty: data.minOrderQty,
        leadTimeDays: data.leadTimeDays,
        isPreferred: data.isPreferred,
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
          },
        },
      },
    });
  }

  async updateProductSupplier(id: string, data: UpdateProductSupplierDto) {
    const link = await this.prisma.productSupplier.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException(
        `Product-supplier link with ID "${id}" not found`,
      );
    }

    return this.prisma.productSupplier.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
          },
        },
      },
    });
  }

  async removeProductSupplier(id: string) {
    const link = await this.prisma.productSupplier.findUnique({
      where: { id },
    });

    if (!link) {
      throw new NotFoundException(
        `Product-supplier link with ID "${id}" not found`,
      );
    }

    return this.prisma.productSupplier.delete({
      where: { id },
    });
  }

  private formatPriceListAsText(items: ParsedPriceItem[]): string {
    const lines = items.map((i) => {
      const parts = [i.description, i.unitCost.toFixed(2), i.supplierSku ?? '', i.unit ?? ''].filter(Boolean);
      return parts.join(' | ');
    });
    return lines.join('\n');
  }

  /** Sube listado de precios y lo guarda. Si skipExtraction es true, no se analiza con IA (solo se guarda el archivo). Al actualizar, se eliminan los listados anteriores del proveedor y solo queda el nuevo. */
  async uploadAndParsePriceList(
    supplierId: string,
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    options?: { skipExtraction?: boolean },
  ): Promise<{
    saved: true;
    priceListId: string;
    fileUrl: string;
    items?: ParsedPriceItem[];
    extractedText?: string;
    table?: PriceListTable;
  }> {
    await this.findById(supplierId);

    // Eliminar listados anteriores: solo se mantiene el último que se carga
    const existing = await this.prisma.supplierPriceList.findMany({
      where: { supplierId },
      select: { id: true, filePath: true },
    });
    if (existing.length > 0) {
      await this.prisma.supplierPriceList.deleteMany({ where: { supplierId } });
      const uploadsDir = join(process.cwd(), 'uploads');
      for (const pl of existing) {
        if (pl.filePath) {
          const fullPath = join(uploadsDir, pl.filePath);
          try {
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          } catch {
            // ignorar errores al borrar archivo
          }
        }
      }
    }

    const dir = join(process.cwd(), 'uploads', 'supplier-price-lists');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = originalname.match(/\.[a-z0-9]+$/i)?.[0] || '.bin';
    const filename = `pl-${supplierId}-${Date.now()}${ext}`;
    const filePath = join(dir, filename);
    fs.writeFileSync(filePath, buffer);

    if (options?.skipExtraction) {
      const record = await this.prisma.supplierPriceList.create({
        data: {
          supplierId,
          filePath: `supplier-price-lists/${filename}`,
          fileName: originalname,
          mimeType: mimetype,
          extractedData: [],
          extractedText: null,
          extractedTable: Prisma.JsonNull,
        },
      });
      return {
        saved: true,
        priceListId: record.id,
        fileUrl: `/uploads/${record.filePath}`,
      };
    }

    const { items, transcript, table } = await this.parsePriceListFile(buffer, mimetype, originalname);
    const itemsToSave: ParsedPriceItem[] = items.map((it) => {
      const hasBreakdown = it.priceBreakdown && Object.keys(it.priceBreakdown).length > 0;
      return {
        ...it,
        priceBreakdown: hasBreakdown ? it.priceBreakdown : { Precio: it.unitCost },
      };
    });
    const extractedText = (transcript && transcript.trim()) || this.formatPriceListAsText(itemsToSave);

    const record = await this.prisma.supplierPriceList.create({
      data: {
        supplierId,
        filePath: `supplier-price-lists/${filename}`,
        fileName: originalname,
        mimeType: mimetype,
        extractedData: itemsToSave as unknown as object,
        extractedText,
        extractedTable: table ? (table as object) : undefined,
      },
    });

    return {
      items,
      extractedText,
      table: table ?? undefined,
      saved: true,
      priceListId: record.id,
      fileUrl: `/uploads/${record.filePath}`,
    };
  }

  /** Última lista de precios del proveedor (solo se guarda una por proveedor). */
  async getPriceLists(supplierId: string) {
    await this.findById(supplierId);
    const list = await this.prisma.supplierPriceList.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
        extractedData: true,
        extractedText: true,
        extractedTable: true,
        filePath: true,
      },
    });
    return list;
  }

  /** Comparación de precios: productos ofrecidos por varios proveedores con su precio */
  async getPriceComparison() {
    const links = await this.prisma.productSupplier.findMany({
      where: { supplier: { isActive: true } },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    const byProduct = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string | null;
        unit: string;
        suppliers: Array<{ supplierId: string; supplierName: string; unitCost: number | null }>;
      }
    >();

    for (const ps of links) {
      if (!ps.product) continue;
      const pid = ps.product.id;
      if (!byProduct.has(pid)) {
        byProduct.set(pid, {
          id: pid,
          name: ps.product.name,
          sku: ps.product.sku,
          unit: ps.product.unit,
          suppliers: [],
        });
      }
      byProduct.get(pid)!.suppliers.push({
        supplierId: ps.supplier.id,
        supplierName: ps.supplier.name,
        unitCost: ps.unitCost ?? null,
      });
    }

    return {
      products: Array.from(byProduct.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  /** Comparación de precios filtrada por búsqueda de producto (OpenAI matchea el nombre). */
  async getPriceComparisonByProductSearch(query: string): Promise<{
    products: Array<{
      id: string;
      name: string;
      sku: string | null;
      unit: string;
      suppliers: Array<{ supplierId: string; supplierName: string; unitCost: number | null }>;
    }>;
  }> {
    const q = (query || '').trim();
    const full = await this.getPriceComparison();
    if (!q) {
      return { products: [] };
    }
    if (full.products.length === 0) {
      return full;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      this.logger.warn('OPENAI_API_KEY no configurada; filtrando por texto');
      const lower = q.toLowerCase();
      const filtered = full.products.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.sku && p.sku.toLowerCase().includes(lower)),
      );
      return { products: filtered };
    }

    const productList = full.products.map((p) => `- id: "${p.id}", nombre: "${p.name}"${p.sku ? `, sku: ${p.sku}` : ''}`).join('\n');
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `El usuario busca un producto. Te doy una lista de productos con su "id" y "nombre". Devolvé SOLO los IDs de los productos que coincidan con lo que el usuario busca (mismo producto o nombre muy similar). Responde ÚNICAMENTE con un JSON válido: { "matchedIds": ["id1", "id2", ...] }. Si ninguno coincide, { "matchedIds": [] }. No incluyas explicaciones.`,
        },
        {
          role: 'user',
          content: `Búsqueda del usuario: "${q}"\n\nProductos disponibles:\n${productList}`,
        },
      ],
    });

    const raw = (response.choices[0]?.message?.content || '').trim();
    let jsonStr = raw;
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    let matchedIds: string[] = [];
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.matchedIds)) {
        matchedIds = parsed.matchedIds.filter((id: unknown) => typeof id === 'string');
      }
    } catch {
      this.logger.warn('OpenAI product search parse failed, falling back to text filter');
      const lower = q.toLowerCase();
      matchedIds = full.products
        .filter((p) => p.name.toLowerCase().includes(lower) || (p.sku && p.sku.toLowerCase().includes(lower)))
        .map((p) => p.id);
    }

    const idSet = new Set(matchedIds);
    const products = full.products.filter((p) => idSet.has(p.id));
    return { products };
  }

  /** Comparación por rubro: usa listados de precios extraídos de proveedores del mismo rubro */
  async getPriceComparisonByRubro(rubro: string) {
    const normalizedRubro = (rubro || '').trim().toLowerCase();
    if (!normalizedRubro) {
      return { rubro: '', suppliers: [], priceKeys: [], items: [] };
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        isActive: true,
        rubro: { not: null },
        priceLists: { some: {} },
      },
      select: { id: true, name: true, rubro: true },
    });

    const byRubro = suppliers.filter(
      (s) => (s.rubro || '').toLowerCase() === normalizedRubro,
    );
    if (byRubro.length === 0) {
      return { rubro, suppliers: [], priceKeys: [], items: [] };
    }

    const allLists = await this.prisma.supplierPriceList.findMany({
      where: { supplierId: { in: byRubro.map((s) => s.id) } },
      orderBy: { createdAt: 'desc' },
      select: { supplierId: true, extractedData: true },
    });
    const seen = new Set<string>();
    const priceLists = allLists.filter((pl) => {
      if (seen.has(pl.supplierId)) return false;
      seen.add(pl.supplierId);
      return true;
    });

    type ItemRow = {
      description: string;
      prices: Array<{
        supplierId: string;
        supplierName: string;
        unitCost: number | null;
        priceBreakdown?: PriceBreakdown;
      }>;
    };
    const byKey = new Map<string, ItemRow>();
    const allPriceKeys = new Set<string>();
    const norm = (d: string) =>
      (d || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

    for (const pl of priceLists) {
      const supplier = byRubro.find((s) => s.id === pl.supplierId);
      if (!supplier) continue;
      const items = ((pl.extractedData as unknown) as ParsedPriceItem[]) || [];
      for (const it of items) {
        const breakdown =
          it.priceBreakdown && Object.keys(it.priceBreakdown).length > 0
            ? it.priceBreakdown
            : { Precio: it.unitCost };
        for (const k of Object.keys(breakdown)) allPriceKeys.add(k);
        const key = norm(it.description) || `_${it.unitCost}`;
        if (!byKey.has(key)) {
          byKey.set(key, { description: it.description || key, prices: [] });
        }
        const row = byKey.get(key)!;
        if (!row.prices.some((p) => p.supplierId === supplier.id)) {
          row.prices.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            unitCost: it.unitCost ?? null,
            priceBreakdown: breakdown,
          });
        }
      }
    }

    const items = Array.from(byKey.values()).sort((a, b) =>
      a.description.localeCompare(b.description),
    );
    const priceKeys = Array.from(allPriceKeys).sort((a, b) => a.localeCompare(b));

    return {
      rubro: byRubro[0]?.rubro || rubro,
      suppliers: byRubro.map((s) => ({ id: s.id, name: s.name })),
      priceKeys,
      items,
    };
  }

  /** Busca en los listados de precios subidos (extractedData) por nombre de producto; usa OpenAI para matchear. */
  async getPriceComparisonBySearchInLists(query: string): Promise<{
    suppliers: Array<{ id: string; name: string }>;
    priceKeys: string[];
    items: Array<{
      description: string;
      prices: Array<{
        supplierId: string;
        supplierName: string;
        unitCost: number | null;
        priceBreakdown?: PriceBreakdown;
      }>;
    }>;
    noListsWithData?: boolean;
  }> {
    const q = (query || '').trim();
    const norm = (d: string) => (d || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!q) {
      return { suppliers: [], priceKeys: [], items: [] };
    }

    const lists = await this.prisma.supplierPriceList.findMany({
      where: { supplier: { isActive: true } },
      orderBy: { createdAt: 'desc' },
      select: { supplierId: true, extractedData: true, supplier: { select: { id: true, name: true } } },
    });

    const seenSupplier = new Set<string>();
    const latestBySupplier = lists.filter((pl) => {
      if (seenSupplier.has(pl.supplierId)) return false;
      const items = (pl.extractedData as unknown) as ParsedPriceItem[] | null;
      if (!Array.isArray(items) || items.length === 0) return false;
      seenSupplier.add(pl.supplierId);
      return true;
    });

    if (latestBySupplier.length === 0) {
      return { suppliers: [], priceKeys: [], items: [], noListsWithData: true };
    }

    const allItems: Array<{
      supplierId: string;
      supplierName: string;
      description: string;
      unitCost: number;
      priceBreakdown?: PriceBreakdown;
    }> = [];
    for (const pl of latestBySupplier) {
      const supplier = pl.supplier;
      const items = (pl.extractedData as unknown) as ParsedPriceItem[];
      for (const it of items) {
        if (it && (it.description || '').trim() && typeof it.unitCost === 'number') {
          const breakdown =
            it.priceBreakdown && Object.keys(it.priceBreakdown).length > 0
              ? it.priceBreakdown
              : { Precio: it.unitCost };
          allItems.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            description: (it.description || '').trim(),
            unitCost: it.unitCost,
            priceBreakdown: breakdown,
          });
        }
      }
    }

    if (allItems.length === 0) {
      return {
        suppliers: latestBySupplier.map((pl) => ({ id: pl.supplier.id, name: pl.supplier.name })),
        priceKeys: [],
        items: [],
      };
    }

    const lower = q.toLowerCase();
    const queryWords = lower.split(/\s+/).filter((w) => w.length > 1);

    const apiKey = process.env.OPENAI_API_KEY;
    let matchedDescriptions: string[] = [];
    if (apiKey && apiKey !== 'tu-api-key-aqui') {
      const uniqueDescriptions = [...new Set(allItems.map((i) => i.description))].slice(0, 800);
      const listForAi = uniqueDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: `El usuario busca un producto o categoría (ej: MARGARINAS, malteado, malbec). Devolvé TODOS los ítems que coincidan: misma palabra, singular/plural (MARGARINAS incluye "MARGARINA X", "MARGARINA Y"), variaciones, categoría. Responde ÚNICAMENTE con JSON: { "matchedDescriptions": ["texto exacto 1", "texto exacto 2", ...] }. Copiá cada texto EXACTAMENTE como aparece. Si buscó "MARGARINAS", incluí TODAS las líneas que sean margarinas (cada una por separado). En caso de duda, incluilo.`,
          },
          {
            role: 'user',
            content: `Búsqueda: "${q}"\n\nProductos en los listados:\n${listForAi}`,
          },
        ],
      });
      const raw = (response.choices[0]?.message?.content || '').trim();
      let jsonStr = raw;
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.matchedDescriptions)) {
          matchedDescriptions = parsed.matchedDescriptions.map((d: unknown) => String(d ?? '').trim()).filter(Boolean);
        }
      } catch {
        // fallback below
      }
    }
    if (matchedDescriptions.length === 0) {
      const uniqueDescs = [...new Set(allItems.map((i) => i.description))];
      const descWords = (d: string) => norm(d).split(/\s+/).filter((w) => w.length >= 2);
      matchedDescriptions = uniqueDescs.filter((d) => {
        const dn = norm(d);
        if (dn.includes(lower)) return true;
        if (queryWords.length > 0 && queryWords.some((w) => dn.includes(w))) return true;
        // Búsqueda en profundidad: variaciones (malteado ↔ malteada), substrings, raíz común
        const dWords = descWords(d);
        for (const qw of queryWords) {
          if (qw.length < 2) continue;
          for (const dw of dWords) {
            if (dw.includes(qw) || qw.includes(dw)) return true;
            if (qw.length >= 4 && dw.length >= 4 && (dw.startsWith(qw.slice(0, 4)) || qw.startsWith(dw.slice(0, 4)))) return true;
          }
        }
        return false;
      });
    }

    const matchSet = new Set(matchedDescriptions.map((d) => norm(d)));
    const byKey = new Map<
      string,
      {
        description: string;
        prices: Array<{
          supplierId: string;
          supplierName: string;
          unitCost: number | null;
          priceBreakdown?: PriceBreakdown;
        }>;
      }
    >();
    const allPriceKeys = new Set<string>();
    for (const it of allItems) {
      if (!matchSet.has(norm(it.description))) continue;
      if (it.priceBreakdown) {
        for (const k of Object.keys(it.priceBreakdown)) allPriceKeys.add(k);
      }
      const key = norm(it.description) || `_${it.unitCost}`;
      if (!byKey.has(key)) {
        byKey.set(key, { description: it.description, prices: [] });
      }
      const row = byKey.get(key)!;
      if (!row.prices.some((p) => p.supplierId === it.supplierId)) {
        const breakdown =
          it.priceBreakdown && Object.keys(it.priceBreakdown).length > 0
            ? it.priceBreakdown
            : { Precio: it.unitCost };
        row.prices.push({
          supplierId: it.supplierId,
          supplierName: it.supplierName,
          unitCost: it.unitCost,
          priceBreakdown: breakdown,
        });
      }
    }

    const items = Array.from(byKey.values()).sort((a, b) => a.description.localeCompare(b.description));
    const supplierIds = new Set<string>();
    for (const it of items) {
      for (const p of it.prices) supplierIds.add(p.supplierId);
    }
    const suppliers = latestBySupplier
      .filter((pl) => supplierIds.has(pl.supplier.id))
      .map((pl) => ({ id: pl.supplier.id, name: pl.supplier.name }));

    const priceKeys = Array.from(allPriceKeys).sort((a, b) => a.localeCompare(b));
    return { suppliers, priceKeys, items };
  }

  // ── Parse price list from file (image, PDF, Excel) ─────────────────────

  async parsePriceListFile(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ items: ParsedPriceItem[]; transcript: string; table?: PriceListTable }> {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, sku: true },
    });

    if (mimetype.startsWith('image/')) {
      return this.extractFromImage(buffer, mimetype, products);
    }
    if (
      mimetype === 'application/pdf' ||
      originalname.toLowerCase().endsWith('.pdf')
    ) {
      return this.extractFromPdf(buffer, products);
    }
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      /\.(xlsx|xls)$/i.test(originalname)
    ) {
      return this.extractFromExcel(buffer, products);
    }

    throw new BadRequestException(
      'Formato no soportado. Usá imagen (JPG, PNG), PDF o Excel (.xlsx, .xls).',
    );
  }

  private suggestProductId(
    description: string,
    products: { id: string; name: string; sku: string }[],
  ): string | undefined {
    const d = (description || '').toLowerCase().trim();
    if (!d) return undefined;
    for (const p of products) {
      const name = p.name.toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      if (d.includes(name) || name.includes(d)) return p.id;
      if (sku && d.includes(sku)) return p.id;
    }
    const words = d.split(/\s+/).filter((w) => w.length > 2);
    for (const p of products) {
      const nameWords = p.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const match = words.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw)));
      if (match.length >= Math.min(2, nameWords.length)) return p.id;
    }
    return undefined;
  }

  private async extractFromImage(
    buffer: Buffer,
    mimetype: string,
    products: { id: string; name: string; sku: string }[],
  ): Promise<{ items: ParsedPriceItem[]; transcript: string; table?: PriceListTable }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new BadRequestException(
        'OPENAI_API_KEY no configurada. Agregá tu API key en apps/api/.env',
      );
    }

    const base64 = buffer.toString('base64');
    const mime = mimetype || 'image/jpeg';
    const productList = products
      .map((p) => `- ID: ${p.id}, SKU: ${p.sku}, Nombre: "${p.name}"`)
      .join('\n');

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 12000,
      messages: [
        {
          role: 'system',
          content: `Eres un experto en transcribir listas de precios de imágenes (fotos, catálogos, PDFs escaneados).

OBJETIVO PRINCIPAL: Transcribir el listado EXACTAMENTE como se ve. Los listados suelen tener:
- Precios CON IVA y SIN IVA
- Precios por UNIDAD y por CANTIDAD (caja, pack, kg, etc.)
- Columnas como: Producto, Código, Precio unit., Precio con IVA, Sin IVA, Por 6 un, etc.
No simplifiques ni unifiques: respetá todas las columnas y valores tal cual aparecen. Mantené formatos de número (coma o punto decimal).

IMPORTANTE: Incluí TODOS los ítems que veas en la imagen, SIN OMITIR NINGUNO. Cada fila de producto = un ítem en "items". Si hay varias variantes (ej. varias margarinas, varios aceites), CADA UNA es un ítem distinto. No agrupes ni resumas.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin \`\`\`) con esta estructura:
{
  "transcript": "Transcripción EXACTA del listado. Incluí encabezados si los hay. Cada fila en una línea. Separá columnas con tabulación (\\t) o pipe (|). Incluí TODAS las columnas de precio (con IVA, sin IVA, por unidad, por cantidad) y sus valores tal cual se leen.",
  "table": {
    "headers": ["Columna1", "Columna2", ...],
    "rows": [ ["valor1", "valor2", ...], ... ]
  },
  "items": [
    {
      "description": "nombre del producto",
      "unitCost": numero (precio unitario de referencia, ej. botella o caja),
      "supplierSku": "código o null",
      "unit": "unidad o null",
      "quantity": numero o null,
      "matchedProductId": "id o null",
      "priceBreakdown": { "Caja Neto": numero, "Caja Final": numero, "Botella Neto": numero, "Botella Final": numero, "Neto": numero, "Final": numero }
    }
  ]
}
La tabla debe reflejar EXACTAMENTE el listado: una fila por línea de producto, encabezados con los nombres de cada columna. Incluí todas las columnas de precios que veas.

LISTADOS TIPO "LISTA PRECIOS NACIONAL" (ej. Familia Schroeder, vinos): Suelen tener dos bloques de columnas — "Precios por Cajas" (con subcolumnas Neto y Final) y "Precios por Botellas" (con Neto y Final). Mapeá así: columna bajo "Precios por Cajas" + "Neto" → "Caja Neto"; "Precios por Cajas" + "Final" → "Caja Final"; "Precios por Botellas" + "Neto" → "Botella Neto"; "Precios por Botellas" + "Final" → "Botella Final". Si una sección (ej. ESTUCHES) solo tiene dos columnas de precio (Neto y Final), usá las claves "Neto" y "Final". Incluí en description el nombre del producto y el formato (ej. 6x750cc, 6x500, 1x1500cc).

Para cada ítem en "items": incluir "priceBreakdown" con TODAS las columnas de precio usando EXACTAMENTE: "Caja Neto", "Caja Final", "Botella Neto", "Botella Final", "Neto", "Final". Valores: números (pueden ser con formato argentino 58.885,36 o estándar 58885.36; sin símbolo $).

PRODUCTOS DE REFERENCIA (para matchedProductId si hay coincidencia clara):
${productList}

Si no hay listado legible, devolvé { "transcript": "", "items": [] }.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribí el listado de precios EXACTAMENTE como se ve en la imagen (todas las columnas y precios). Luego extraé los ítems para el array.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' as const },
            },
          ],
        },
      ],
    });

    const raw = (response.choices[0]?.message?.content || '').trim();
    let jsonStr = raw;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    type RawItem = {
      description?: string;
      unitCost?: number;
      supplierSku?: string;
      unit?: string;
      quantity?: number;
      matchedProductId?: string;
      priceBreakdown?: Record<string, number>;
    };
    type ParsedImage = { transcript?: string; items?: RawItem[]; table?: { headers?: string[]; rows?: (string | number)[][] } };
    let parsed: ParsedImage;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      this.logger.warn(`OpenAI image parse failed: ${raw.slice(0, 200)}`);
      throw new BadRequestException('No se pudo interpretar la lista. Probá con una imagen más clara.');
    }

    const items = (parsed.items || []).filter((i) => {
      if (!i || !(i.description || '').trim()) return false;
      const cost = parsePriceValue(i.unitCost);
      return cost !== null && cost >= 0;
    });
    const result: ParsedPriceItem[] = items.map((i) => {
      let breakdown: PriceBreakdown | undefined;
      if (i.priceBreakdown && typeof i.priceBreakdown === 'object') {
        const raw: Record<string, number> = {};
        for (const [k, v] of Object.entries(i.priceBreakdown)) {
          const n = parsePriceValue(v);
          if (n !== null) raw[k] = n;
        }
        breakdown = Object.keys(raw).length > 0 ? normalizePriceBreakdownKeys(raw) : undefined;
      }
      const unitCost = parsePriceValue(i.unitCost) ?? 0;
      return {
        description: (i.description || '').trim(),
        unitCost,
        supplierSku: i.supplierSku?.trim() || undefined,
        unit: i.unit?.trim() || undefined,
        quantity: typeof i.quantity === 'number' ? i.quantity : undefined,
        suggestedProductId:
          i.matchedProductId && products.some((p) => p.id === i.matchedProductId)
            ? i.matchedProductId
            : this.suggestProductId(i.description || '', products),
        ...(breakdown && Object.keys(breakdown).length > 0 ? { priceBreakdown: breakdown } : {}),
      };
    });
    const transcript = (parsed.transcript && String(parsed.transcript).trim()) || this.formatPriceListAsText(result);
    const table = this.normalizeTable(parsed.table);
    return { items: result, transcript, table };
  }

  private normalizeTable(t?: { headers?: string[]; rows?: (string | number)[][] }): PriceListTable | undefined {
    if (!t || !Array.isArray(t.headers) || !Array.isArray(t.rows)) return undefined;
    const headers = t.headers.map((h) => String(h ?? '').trim()).filter(Boolean);
    if (!headers.length) return undefined;
    const rows = t.rows
      .filter((r) => Array.isArray(r))
      .map((r) => r.map((c) => (typeof c === 'number' ? c : String(c ?? '').trim())));
    return { headers, rows };
  }

  private async extractFromPdf(
    buffer: Buffer,
    products: { id: string; name: string; sku: string }[],
  ): Promise<{ items: ParsedPriceItem[]; transcript: string; table?: PriceListTable }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new BadRequestException(
        'OPENAI_API_KEY no configurada. Agregá tu API key en apps/api/.env',
      );
    }

    let text: string;
    try {
      const pdfParseModule = await import('pdf-parse');
      const PDFParseClass = (pdfParseModule as any).PDFParse ?? (pdfParseModule as any).default?.PDFParse ?? (pdfParseModule as any).default;
      const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      text = textResult?.text || '';
      if (typeof (parser as any).destroy === 'function') await (parser as any).destroy();
    } catch (e) {
      this.logger.warn('pdf-parse failed', e);
      throw new BadRequestException(
        'No se pudo leer el PDF. Probá con una imagen (foto) del documento o con un PDF con texto seleccionable.',
      );
    }

    if (!text || text.trim().length < 20) {
      throw new BadRequestException('El PDF no contiene texto legible. Probá con una imagen del documento.');
    }

    const productList = products
      .map((p) => `- ID: ${p.id}, SKU: ${p.sku}, Nombre: "${p.name}"`)
      .join('\n');

    const openai = new OpenAI({ apiKey });
    const pdfText = text.length > 45000 ? text.slice(0, 45000) : text;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 16000,
      messages: [
        {
          role: 'system',
          content: `Transcribí el listado EXACTAMENTE como está (todas las columnas: precios con IVA, sin IVA, neto, final, por caja, por botella). Luego extraé ítems para comparación.

IMPORTANTE: Incluí TODOS los ítems del listado, SIN OMITIR NINGUNO. Cada fila de producto = un ítem en el array "items". Si hay varias variantes de la misma categoría (ej. varias margarinas, varios aceites, varias harinas), CADA UNA debe ser un ítem distinto con su descripción y precios. No agrupes ni resumas.

Responde solo JSON válido (sin markdown):
{
  "transcript": "Texto EXACTO del listado con todas las columnas y valores, cada fila en una línea, columnas separadas por | o tab.",
  "table": { "headers": ["Col1", "Col2", ...], "rows": [ ["v1", "v2", ...], ... ] },
  "items": [
    {
      "description": "nombre del producto",
      "unitCost": numero (precio de referencia),
      "supplierSku": "código o null",
      "unit": "unidad o null",
      "quantity": numero o null,
      "matchedProductId": "id o null",
      "priceBreakdown": { "Caja Neto": numero, "Caja Final": numero, "Botella Neto": numero, "Botella Final": numero, "Neto": numero, "Final": numero }
    }
  ]
}
LISTADOS TIPO "LISTA PRECIOS NACIONAL": Si el PDF tiene "Precios por Cajas" (Neto, Final) y "Precios por Botellas" (Neto, Final), mapeá: Caja Neto, Caja Final, Botella Neto, Botella Final. Si una sección solo tiene Neto y Final, usá "Neto" y "Final". Incluí en description producto + formato (ej. 6x750cc, 1x1500cc).

Para cada ítem incluir "priceBreakdown" con todas las columnas usando EXACTAMENTE: "Caja Neto", "Caja Final", "Botella Neto", "Botella Final", "Neto", "Final". Valores = números (formato argentino 58.885,36 o estándar 58885.36; sin $). PRODUCTOS DE REFERENCIA (matchedProductId): ${productList}
Si no hay lista, { "transcript": "", "table": { "headers": [], "rows": [] }, "items": [] }.`,
        },
        { role: 'user', content: pdfText },
      ],
    });

    const raw = (response.choices[0]?.message?.content || '').trim();
    let jsonStr = raw;
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    type RawItem = {
      description?: string;
      unitCost?: number;
      supplierSku?: string;
      unit?: string;
      quantity?: number;
      matchedProductId?: string;
      priceBreakdown?: Record<string, number>;
    };
    type ParsedPdf = { transcript?: string; items?: RawItem[]; table?: { headers?: string[]; rows?: (string | number)[][] } };
    let parsed: ParsedPdf;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('No se pudo extraer la lista de precios del PDF.');
    }

    const items = (parsed.items || []).filter((i) => {
      if (!i || !(i.description || '').trim()) return false;
      const cost = parsePriceValue(i.unitCost);
      return cost !== null && cost >= 0;
    });
    const result: ParsedPriceItem[] = items.map((i) => {
      let breakdown: PriceBreakdown | undefined;
      if (i.priceBreakdown && typeof i.priceBreakdown === 'object') {
        const rawBreakdown: Record<string, number> = {};
        for (const [k, v] of Object.entries(i.priceBreakdown)) {
          const n = parsePriceValue(v);
          if (n !== null) rawBreakdown[k] = n;
        }
        breakdown = Object.keys(rawBreakdown).length > 0 ? normalizePriceBreakdownKeys(rawBreakdown) : undefined;
      }
      const unitCost = parsePriceValue(i.unitCost) ?? 0;
      return {
        description: (i.description || '').trim(),
        unitCost,
        supplierSku: i.supplierSku?.trim() || undefined,
        unit: i.unit?.trim() || undefined,
        quantity: typeof i.quantity === 'number' ? i.quantity : undefined,
        suggestedProductId:
          i.matchedProductId && products.some((p) => p.id === i.matchedProductId)
            ? i.matchedProductId
            : this.suggestProductId(i.description || '', products),
        ...(breakdown && Object.keys(breakdown).length > 0 ? { priceBreakdown: breakdown } : {}),
      };
    });
    const transcript = (parsed.transcript && String(parsed.transcript).trim()) || this.formatPriceListAsText(result);
    const table = this.normalizeTable(parsed.table);
    return { items: result, transcript, table };
  }

  private async extractFromExcel(
    buffer: Buffer,
    products: { id: string; name: string; sku: string }[],
  ): Promise<{ items: ParsedPriceItem[]; transcript: string; table?: PriceListTable }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new BadRequestException(
        'OPENAI_API_KEY no configurada. Agregá tu API key en apps/api/.env',
      );
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('El archivo Excel no tiene hojas.');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    if (!rows.length) throw new BadRequestException('La hoja está vacía.');

    const headerRow = rows[0] as (string | number)[];
    const dataRows = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== ''));

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `Tenés una hoja de Excel. La primera fila son encabezados: ${JSON.stringify(headerRow)}.
Las filas siguientes son datos. Identificá qué columna (índice 0-based) es el nombre/descripción del producto y cuál el precio unitario.
Nombres típicos: Producto, Descripción, Item, Artículo, Nombre. Precio: Precio, Unitario, P.U., Precio unit., Costo.
Responde SOLO un JSON: { "nameCol": índice, "priceCol": índice } sin explicación.`,
        },
        {
          role: 'user',
          content: `Primeras filas de datos: ${JSON.stringify(dataRows.slice(0, 15))}`,
        },
      ],
    });

    let nameCol = 0;
    let priceCol = 1;
    const raw = (response.choices[0]?.message?.content || '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const cols = JSON.parse(match[0]);
        if (typeof cols.nameCol === 'number') nameCol = cols.nameCol;
        if (typeof cols.priceCol === 'number') priceCol = cols.priceCol;
      } catch {
        // keep defaults
      }
    }

    const result: ParsedPriceItem[] = [];
    for (const row of dataRows) {
      const arr = Array.isArray(row) ? row : [];
      const desc = String(arr[nameCol] ?? '').trim();
      const priceVal = arr[priceCol];
      if (!desc) continue;
      let unitCost = 0;
      if (typeof priceVal === 'number' && !Number.isNaN(priceVal)) unitCost = priceVal;
      else if (priceVal != null) {
        const n = parseFloat(String(priceVal).replace(/,/g, '.').replace(/\s/g, ''));
        if (Number.isFinite(n)) unitCost = n;
      }
      if (unitCost < 0) continue;
      result.push({
        description: desc,
        unitCost,
        suggestedProductId: this.suggestProductId(desc, products),
      });
    }

    // Transcript fiel: encabezados + filas tal cual (todas las columnas)
    const toLine = (row: unknown[]) =>
      (row as (string | number)[]).map((c) => (c == null ? '' : String(c).trim())).join('\t');
    const transcript =
      [toLine(headerRow), ...dataRows.map((r) => toLine(Array.isArray(r) ? r : []))].join('\n') ||
      this.formatPriceListAsText(result);
    const table: PriceListTable = {
      headers: headerRow.map((c) => String(c ?? '').trim()),
      rows: dataRows.map((r) =>
        (Array.isArray(r) ? r : []).map((c) => (typeof c === 'number' ? c : String(c ?? '').trim())),
      ),
    };
    return { items: result, transcript, table };
  }
}
