import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService } from '../google-maps/google-maps.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ReceiveShipmentDto } from './dto/receive-shipment.dto';
import { UpdateShipmentItemDto } from './dto/update-shipment-item.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService,
  ) {}

  async findAll(filters: {
    originId?: string;
    destinationId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      originId,
      destinationId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (originId) where.originId = originId;
    if (destinationId) where.destinationId = destinationId;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          origin: { select: { id: true, name: true, type: true } },
          destination: { select: { id: true, name: true, type: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.shipment.count({ where }),
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
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                avgCost: true,
              },
            },
          },
        },
        origin: { select: { id: true, name: true, type: true, address: true } },
        destination: {
          select: { id: true, name: true, type: true, address: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        dispatchedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        receivedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID "${id}" not found`);
    }

    return shipment;
  }

  async updateItem(
    shipmentId: string,
    itemId: string,
    data: UpdateShipmentItemDto,
  ) {
    const shipment = await this.findById(shipmentId);
    if (shipment.status !== 'draft' && shipment.status !== 'prepared') {
      throw new BadRequestException(
        `Solo se puede editar la cantidad enviada en envíos en borrador o preparados. Estado actual: ${shipment.status}`,
      );
    }
    const item = shipment.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(
        `Item "${itemId}" no pertenece al envío "${shipmentId}"`,
      );
    }
    return this.prisma.shipmentItem.update({
      where: { id: itemId },
      data: { sentQty: data.sentQty },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true },
        },
      },
    });
  }

  /** Por id (cuid), número de envío o qrCode (para vista pública por QR). */
  async findByShipmentNumber(codeOrNumberOrId: string) {
    const param = (codeOrNumberOrId || '').trim();
    if (!param) {
      throw new NotFoundException('Número o código de envío no válido');
    }
    const include = {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              avgCost: true,
            },
          },
        },
      },
      origin: { select: { id: true, name: true, type: true, address: true } },
      destination: {
        select: { id: true, name: true, type: true, address: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      dispatchedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      receivedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    };
    // 1) Por número de envío (ej. SH-20260213-013)
    let shipment = await this.prisma.shipment.findUnique({
      where: { shipmentNumber: param },
      include,
    });
    if (!shipment && param.startsWith('ELIO-SH-')) {
      shipment = await this.prisma.shipment.findFirst({
        where: { qrCode: param },
        include,
      });
    }
    // 2) Por id (cuid): el QR puede llevar el id
    if (!shipment) {
      shipment = await this.prisma.shipment.findUnique({
        where: { id: param },
        include,
      });
    }
    if (!shipment) {
      throw new NotFoundException(
        `Envío con número o código "${param}" no encontrado`,
      );
    }
    return shipment;
  }

  async getEstimateDuration(
    originId?: string,
    destinationId?: string,
  ): Promise<{ durationMin: number | null; reason?: 'no_api_key' | 'no_address' }> {
    if (!originId || !destinationId) {
      return { durationMin: null };
    }
    if (!this.googleMaps.isConfigured()) {
      return { durationMin: null, reason: 'no_api_key' };
    }
    const [origin, destination] = await Promise.all([
      this.prisma.location.findUnique({
        where: { id: originId },
        select: { address: true },
      }),
      this.prisma.location.findUnique({
        where: { id: destinationId },
        select: { address: true },
      }),
    ]);
    if (!origin?.address?.trim() || !destination?.address?.trim()) {
      return { durationMin: null, reason: 'no_address' };
    }
    const durationMin =
      await this.googleMaps.getRouteDurationInMinutes(
        origin.address,
        destination.address,
      );
    return { durationMin };
  }

  async create(data: CreateShipmentDto, userId: string) {
    // Validate origin and destination
    const [origin, destination] = await Promise.all([
      this.prisma.location.findUnique({ where: { id: data.originId } }),
      this.prisma.location.findUnique({ where: { id: data.destinationId } }),
    ]);

    if (!origin) {
      throw new NotFoundException(
        `Origin location with ID "${data.originId}" not found`,
      );
    }
    if (!destination) {
      throw new NotFoundException(
        `Destination location with ID "${data.destinationId}" not found`,
      );
    }
    if (data.originId === data.destinationId) {
      throw new BadRequestException(
        'Origin and destination must be different locations',
      );
    }

    const existingPending = await this.prisma.shipment.findFirst({
      where: {
        originId: data.originId,
        destinationId: data.destinationId,
        status: { in: ['draft', 'prepared', 'dispatched', 'in_transit', 'reception_control'] },
      },
    });
    if (existingPending) {
      throw new BadRequestException(
        'Ya existe un envío pendiente (borrador, preparado o en tránsito) para este origen y destino. No se puede crear el mismo pedido dos veces.',
      );
    }

    let estimatedDurationMin = data.estimatedDurationMin ?? null;
    let routePolyline: string | null = null;
    if (
      origin.address?.trim() &&
      destination.address?.trim()
    ) {
      const details = await this.googleMaps.getRouteDetails(
        origin.address,
        destination.address,
      );
      if (details) {
        if (estimatedDurationMin == null) estimatedDurationMin = details.durationMin;
        if (details.polyline) routePolyline = details.polyline;
      }
    }

    // Generate shipment number: SH-YYYYMMDD-XXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const todayCount = await this.prisma.shipment.count({
      where: {
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    });
    const shipmentNumber = `SH-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`;

    // Generate QR code string
    const qrCode = `ELIO-SH-${shipmentNumber}-${Date.now()}`;

    return this.prisma.shipment.create({
      data: {
        shipmentNumber,
        originId: data.originId,
        destinationId: data.destinationId,
        status: 'draft',
        qrCode,
        estimatedArrival: data.estimatedArrival
          ? new Date(data.estimatedArrival)
          : null,
        estimatedDurationMin: estimatedDurationMin ?? undefined,
        routePolyline: routePolyline ?? undefined,
        totalItems: data.items.length,
        notes: data.notes,
        createdById: userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            sentQty: item.sentQty,
            unitCost: item.unitCost,
            lotNumber: item.lotNumber,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
        origin: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
      },
    });
  }

  async prepare(id: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'draft') {
      throw new BadRequestException(
        `Cannot mark as prepared: shipment status is "${shipment.status}"`,
      );
    }

    return this.prisma.shipment.update({
      where: { id },
      data: { status: 'prepared' },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
        origin: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
      },
    });
  }

  async dispatch(id: string, userId: string) {
    const shipment = await this.findById(id);

    if (shipment.status !== 'draft' && shipment.status !== 'prepared') {
      throw new BadRequestException(
        `Cannot dispatch shipment with status "${shipment.status}"`,
      );
    }

    const originAddress = shipment.origin?.address;
    const destAddress = shipment.destination?.address;
    let estimatedArrival: Date | undefined;
    let estimatedDurationMin: number | undefined;
    let routePolyline: string | undefined;
    if (originAddress && destAddress) {
      const route = await this.googleMaps.getRouteDetailsWithTraffic(
        originAddress,
        destAddress,
      );
      if (route) {
        estimatedDurationMin = route.durationMin;
        estimatedArrival = new Date(
          Date.now() + route.durationMin * 60 * 1000,
        );
        routePolyline = route.polyline || undefined;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Create stock movements (shipment_out) at origin for each item
      for (const item of shipment.items) {
        const stockLevel = await tx.stockLevel.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: shipment.originId,
            },
          },
        });

        const currentQty = stockLevel?.quantity ?? 0;

        await tx.stockLevel.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: shipment.originId,
            },
          },
          update: {
            quantity: currentQty - item.sentQty,
          },
          create: {
            productId: item.productId,
            locationId: shipment.originId,
            quantity: -item.sentQty,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            locationId: shipment.originId,
            type: 'shipment_out',
            quantity: -item.sentQty,
            unitCost: item.unitCost,
            referenceType: 'shipment',
            referenceId: shipment.id,
            userId,
          },
        });
      }

      // Update shipment status y ETA con tráfico (si Google devolvió ruta)
      // Se deja en in_transit para que la línea de tiempo muestre "En Tránsito" al despachar
      const now = new Date();
      return tx.shipment.update({
        where: { id },
        data: {
          status: 'in_transit',
          dispatchedAt: now,
          dispatchedById: userId,
          ...(estimatedArrival && { estimatedArrival }),
          ...(estimatedDurationMin != null && {
            estimatedDurationMin,
          }),
          ...(routePolyline && { routePolyline }),
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          origin: { select: { id: true, name: true } },
          destination: { select: { id: true, name: true } },
        },
      });
    });
  }

  async startReceptionControl(id: string) {
    const shipment = await this.findById(id);
    if (shipment.status !== 'in_transit' && shipment.status !== 'dispatched') {
      throw new BadRequestException(
        `Solo se puede iniciar control de recepción cuando el envío está "Despachado" o "En tránsito". Estado actual: ${shipment.status}`,
      );
    }
    const now = new Date();
    return this.prisma.shipment.update({
      where: { id },
      data: {
        status: 'reception_control',
        receptionControlStartedAt: now,
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
        origin: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
      },
    });
  }

  async receive(id: string, data: ReceiveShipmentDto, userId: string) {
    const shipment = await this.findById(id);

    const allowedStatuses = ['dispatched', 'in_transit', 'reception_control'];
    if (!allowedStatuses.includes(shipment.status)) {
      throw new BadRequestException(
        `No se puede recibir el envío con estado "${shipment.status}"`,
      );
    }

    if (!data.receivedBySignature?.trim()) {
      throw new BadRequestException(
        'La firma es obligatoria para registrar la entrega.',
      );
    }
    if (!data.receivedByName?.trim()) {
      throw new BadRequestException(
        'El nombre de quien recibe es obligatorio.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Process each received item
      for (const receivedItem of data.items) {
        const shipmentItem = shipment.items.find(
          (si) => si.id === receivedItem.itemId,
        );

        if (!shipmentItem) {
          throw new BadRequestException(
            `Shipment item with ID "${receivedItem.itemId}" not found`,
          );
        }

        // Update shipment item with received data
        await tx.shipmentItem.update({
          where: { id: receivedItem.itemId },
          data: {
            receivedQty: receivedItem.receivedQty,
            diffReason: receivedItem.diffReason,
          },
        });

        // Create stock movement (shipment_in) at destination
        const stockLevel = await tx.stockLevel.findUnique({
          where: {
            productId_locationId: {
              productId: shipmentItem.productId,
              locationId: shipment.destinationId,
            },
          },
        });

        const currentQty = stockLevel?.quantity ?? 0;

        await tx.stockLevel.upsert({
          where: {
            productId_locationId: {
              productId: shipmentItem.productId,
              locationId: shipment.destinationId,
            },
          },
          update: {
            quantity: currentQty + receivedItem.receivedQty,
          },
          create: {
            productId: shipmentItem.productId,
            locationId: shipment.destinationId,
            quantity: receivedItem.receivedQty,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: shipmentItem.productId,
            locationId: shipment.destinationId,
            type: 'shipment_in',
            quantity: receivedItem.receivedQty,
            unitCost: shipmentItem.unitCost,
            referenceType: 'shipment',
            referenceId: shipment.id,
            userId,
          },
        });
      }

      // Update shipment status; if was in reception_control, set completion time for control duration
      const now = new Date();
      const wasInReceptionControl = shipment.status === 'reception_control';
      return tx.shipment.update({
        where: { id },
        data: {
          status: 'received',
          receivedAt: now,
          actualArrivalAt: now,
          receivedById: userId,
          receivedByName: data.receivedByName ?? undefined,
          ...(wasInReceptionControl && { receptionControlCompletedAt: now }),
          receivedBySignature: data.receivedBySignature ?? undefined,
          receptionNotes: data.receptionNotes?.trim() || undefined,
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          origin: { select: { id: true, name: true } },
          destination: { select: { id: true, name: true } },
        },
      });
    });
  }

  async cancel(id: string) {
    const shipment = await this.findById(id);

    if (['received', 'cancelled'].includes(shipment.status)) {
      throw new BadRequestException(
        `Cannot cancel shipment with status "${shipment.status}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Si ya salió del depósito (dispatched o in_transit), revertir movimientos en origen
      if (shipment.status === 'dispatched' || shipment.status === 'in_transit') {
        for (const item of shipment.items) {
          const stockLevel = await tx.stockLevel.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: shipment.originId,
              },
            },
          });

          const currentQty = stockLevel?.quantity ?? 0;

          await tx.stockLevel.update({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: shipment.originId,
              },
            },
            data: {
              quantity: currentQty + item.sentQty,
            },
          });
        }
      }

      return tx.shipment.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });
  }
}
