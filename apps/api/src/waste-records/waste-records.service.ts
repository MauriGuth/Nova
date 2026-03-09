import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';

@Injectable()
export class WasteRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    locationId?: string;
    productId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      locationId,
      productId,
      type,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (locationId) where.locationId = locationId;
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      where.recordedAt = {};
      if (dateFrom) (where.recordedAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.recordedAt as any).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.wasteRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { recordedAt: 'desc' },
        include: {
          location: { select: { id: true, name: true, type: true } },
          product: { select: { id: true, sku: true, name: true, unit: true } },
          recordedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.wasteRecord.count({ where }),
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
    const record = await this.prisma.wasteRecord.findUnique({
      where: { id },
      include: {
        location: true,
        product: true,
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!record) {
      throw new NotFoundException(`Waste record with ID "${id}" not found`);
    }
    return record;
  }

  async create(data: CreateWasteRecordDto, userId: string) {
    return this.prisma.wasteRecord.create({
      data: {
        locationId: data.locationId,
        productId: data.productId,
        type: data.type,
        reason: data.reason,
        quantity: data.quantity,
        unit: data.unit ?? 'unidad',
        notes: data.notes,
        recordedById: userId,
      },
      include: {
        location: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true, unit: true } },
        recordedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Fase 2.5 – IA mermas: análisis de patrones (producto, tipo, local, fecha) y sugerencias en AIEvent.
   */
  async runWasteAnalysis(): Promise<{
    summary: { totalQuantity: number; recordCount: number; byLocation: any[]; byProduct: any[]; byType: any[] };
    aiEvent: any;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const records = await this.prisma.wasteRecord.findMany({
      where: { recordedAt: { gte: since } },
      include: {
        location: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    const totalQuantity = records.reduce((s, r) => s + r.quantity, 0);
    const recordCount = records.length;

    const byLocationRaw = await this.prisma.wasteRecord.groupBy({
      by: ['locationId'],
      where: { recordedAt: { gte: since } },
      _sum: { quantity: true },
      _count: { id: true },
    });
    const byLocation = byLocationRaw.sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0));

    const locationIds = [...new Set(byLocation.map((r) => r.locationId))];
    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const locMap = new Map(locations.map((l) => [l.id, l.name]));

    const byProductRaw = await this.prisma.wasteRecord.groupBy({
      by: ['productId'],
      where: { recordedAt: { gte: since } },
      _sum: { quantity: true },
      _count: { id: true },
    });
    const byProduct = byProductRaw.sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0));

    const productIds = [...new Set(byProduct.map((r) => r.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const byTypeRaw = await this.prisma.wasteRecord.groupBy({
      by: ['type'],
      where: { recordedAt: { gte: since } },
      _sum: { quantity: true },
      _count: { id: true },
    });
    const byType = byTypeRaw.sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0));

    const byLocationSummary = byLocation.slice(0, 5).map((r) => ({
      locationId: r.locationId,
      locationName: locMap.get(r.locationId) ?? r.locationId,
      totalQuantity: r._sum.quantity ?? 0,
      recordCount: r._count.id,
    }));

    const byProductSummary = byProduct.slice(0, 5).map((r) => ({
      productId: r.productId,
      productName: prodMap.get(r.productId)?.name ?? r.productId,
      sku: prodMap.get(r.productId)?.sku,
      totalQuantity: r._sum.quantity ?? 0,
      recordCount: r._count.id,
    }));

    const byTypeSummary = byType.map((r) => ({
      type: r.type,
      totalQuantity: r._sum.quantity ?? 0,
      recordCount: r._count.id,
    }));

    const lines: string[] = [];
    lines.push(`Período: últimos 30 días. Total: ${Math.round(totalQuantity)} unidades en ${recordCount} registros.`);
    if (byLocationSummary.length) {
      const top = byLocationSummary[0];
      lines.push(`Local con más merma: ${top.locationName} (${Math.round(top.totalQuantity)} u). Revisar procesos y almacenamiento.`);
    }
    if (byProductSummary.length) {
      const top = byProductSummary[0];
      lines.push(`Producto con más merma: ${top.productName} (${Math.round(top.totalQuantity)} u). Revisar caducidad, manejo y compras.`);
    }
    if (byTypeSummary.length) {
      const topType = byTypeSummary[0];
      lines.push(`Tipo predominante: "${topType.type}" (${Math.round(topType.totalQuantity)} u). Considerar capacitación o mejoras según el tipo.`);
    }
    lines.push('Sugerencia: cruzar con fechas y operarios para detectar patrones por turno o persona.');

    const description = lines.join(' ');
    const title = 'Análisis de mermas (últimos 30 días)';
    const severity = totalQuantity >= 100 ? 'warning' : 'info';

    const aiEvent = await this.prisma.aIEvent.create({
      data: {
        type: 'waste_analysis',
        severity,
        title,
        description,
        data: JSON.stringify({
          totalQuantity,
          recordCount,
          byLocation: byLocationSummary,
          byProduct: byProductSummary,
          byType: byTypeSummary,
        }),
        relatedEntity: 'waste_records',
        status: 'active',
      },
    });

    return {
      summary: {
        totalQuantity,
        recordCount,
        byLocation: byLocationSummary,
        byProduct: byProductSummary,
        byType: byTypeSummary,
      },
      aiEvent,
    };
  }
}
