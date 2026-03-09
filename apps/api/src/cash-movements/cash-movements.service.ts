import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Injectable()
export class CashMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locationId: string, limit = 50) {
    return this.prisma.cashMovement.findMany({
      where: { locationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(dto: CreateCashMovementDto, userId: string) {
    return this.prisma.cashMovement.create({
      data: {
        locationId: dto.locationId,
        cashRegisterId: dto.cashRegisterId ?? undefined,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /** Movimientos de caja agregados por día para reportes. amount = suma de montos (positivos entradas, negativos salidas). */
  async getByDay(params: { dateFrom: string; dateTo: string; locationId?: string }) {
    const { dateFrom, dateTo, locationId } = params;
    const from = new Date(dateFrom + 'T00:00:00.000Z');
    const to = new Date(dateTo + 'T23:59:59.999Z');

    const where: any = {
      createdAt: { gte: from, lte: to },
    };
    if (locationId) where.locationId = locationId;

    const movements = await this.prisma.cashMovement.findMany({
      where,
      select: { createdAt: true, amount: true, type: true },
    });

    const dayMap: Record<string, number> = {};
    for (const m of movements) {
      const key = m.createdAt.toISOString().slice(0, 10);
      const sign = m.type === 'in' || m.type === 'extra_income' ? 1 : -1;
      dayMap[key] = (dayMap[key] || 0) + (m.amount ?? 0) * sign;
    }

    const out: { date: string; amount: number }[] = [];
    const curr = new Date(from);
    while (curr <= to) {
      const key = curr.toISOString().slice(0, 10);
      out.push({
        date: key,
        amount: Math.round((dayMap[key] || 0) * 100) / 100,
      });
      curr.setDate(curr.getDate() + 1);
    }
    return out;
  }
}
