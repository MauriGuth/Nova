import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    locationId?: string;
    type?: string;
    priority?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      locationId,
      type,
      priority,
      status,
      page = 1,
      limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (locationId) where.locationId = locationId;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          location: { select: { id: true, name: true } },
          readBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, type: true } },
        readBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    return alert;
  }

  async create(data: CreateAlertDto) {
    return this.prisma.alert.create({
      data: {
        locationId: data.locationId,
        type: data.type,
        priority: data.priority ?? 'medium',
        title: data.title,
        message: data.message,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        readById: userId,
        readAt: new Date(),
      },
    });
  }

  async resolve(id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });
  }

  async dismiss(id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: { status: 'dismissed' },
    });
  }

  async getActiveCount(locationId?: string) {
    const where: any = { status: 'active' };
    if (locationId) where.locationId = locationId;

    const count = await this.prisma.alert.count({ where });
    return { count };
  }

  async checkStockAlerts(locationId?: string) {
    const where: any = {};
    if (locationId) where.locationId = locationId;

    const stockLevels = await this.prisma.stockLevel.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
      },
    });

    const alerts: any[] = [];

    for (const sl of stockLevels) {
      const isCritical = sl.quantity <= sl.minQuantity;
      const isLow =
        !isCritical && sl.quantity <= sl.minQuantity * 1.5;

      if (!isCritical && !isLow) continue;

      // Check if an active alert already exists for this stock level
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          referenceType: 'stock_level',
          referenceId: sl.id,
          status: 'active',
        },
      });

      if (existingAlert) continue;

      const priority = isCritical ? 'critical' : 'high';
      const type = isCritical ? 'stock_critical' : 'stock_low';
      const title = isCritical
        ? `Stock cr\u00edtico: ${sl.product.name}`
        : `Stock bajo: ${sl.product.name}`;
      const message = `${sl.product.name} (${sl.product.sku}) en ${sl.location.name}: ${sl.quantity} unidades (m\u00ednimo: ${sl.minQuantity})`;

      const alert = await this.prisma.alert.create({
        data: {
          locationId: sl.locationId,
          type,
          priority,
          title,
          message,
          referenceType: 'stock_level',
          referenceId: sl.id,
        },
      });

      alerts.push(alert);
    }

    return {
      created: alerts.length,
      alerts,
    };
  }
}
