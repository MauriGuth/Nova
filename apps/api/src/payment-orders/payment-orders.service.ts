import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class PaymentOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    supplierId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      supplierId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, paymentMethod: true } },
          goodsReceipt: {
            select: {
              id: true,
              receiptNumber: true,
              invoiceNumber: true,
              locationId: true,
              createdAt: true,
              location: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.paymentOrder.count({ where }),
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
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        goodsReceipt: {
          include: {
            location: { select: { id: true, name: true, type: true } },
            items: {
              include: {
                product: {
                  select: { id: true, sku: true, name: true, unit: true },
                },
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Payment order with ID "${id}" not found`);
    }
    return order;
  }

  async markAsPaid(id: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Payment order with ID "${id}" not found`);
    }
    if (order.status === 'paid') {
      return this.findById(id);
    }
    if (!order.paymentProofPath?.trim()) {
      throw new BadRequestException(
        'Para marcar como pagada primero debe cargar el comprobante de pago.',
      );
    }
    await this.prisma.paymentOrder.update({
      where: { id },
      data: { status: 'paid', accountSettledAt: new Date() },
    });
    return this.findById(id);
  }

  async uploadPaymentProof(
    id: string,
    file: Express.Multer.File,
  ) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Payment order with ID "${id}" not found`);
    }
    const relativePath = `payment-proofs/${file.filename}`;
    await this.prisma.paymentOrder.update({
      where: { id },
      data: {
        paymentProofPath: relativePath,
        paymentProofFileName: file.originalname || file.filename,
        status: 'paid',
        accountSettledAt: new Date(),
      },
    });
    return this.findById(id);
  }
}
