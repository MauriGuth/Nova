import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRegisterDto } from './dto/open-register.dto';
import { CloseRegisterDto } from './dto/close-register.dto';

/** Normaliza método de pago (UI puede enviar "efectivo"/"tarjeta"/"transferencia" o "cash"/"card"/"transfer"). */
function normalizePaymentMethod(method: string): string {
  const m = (method || 'cash').toLowerCase();
  if (m === 'efectivo') return 'cash';
  if (m === 'tarjeta') return 'card';
  if (m === 'transferencia') return 'transfer';
  return m;
}

/** Convierte paymentBreakdown (array o objeto con índices) a array de { method, amount } para sumar por medio de pago. */
function paymentBreakdownToItems(raw: unknown): { method: string; amount: number }[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((p: any) => ({
      method: String(p?.method ?? 'cash').trim() || 'cash',
      amount: Number(p?.amount) || 0,
    }));
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, any>;
    return Object.values(obj).map((p: any) => ({
      method: String(p?.method ?? 'cash').trim() || 'cash',
      amount: Number(p?.amount) || 0,
    }));
  }
  return [];
}

@Injectable()
export class CashRegistersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(locationId: string) {
    return this.prisma.cashRegister.findMany({
      where: { locationId },
      include: {
        location: { select: { id: true, name: true, type: true } },
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, type: true } },
        openedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        cashMovements: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!register) {
      throw new NotFoundException(`Cash register with ID "${id}" not found`);
    }

    return register;
  }

  async openRegister(data: OpenRegisterDto, userId: string) {
    // Check if there's already an open register at this location
    const existingOpen = await this.prisma.cashRegister.findFirst({
      where: {
        locationId: data.locationId,
        status: 'open',
      },
    });

    if (existingOpen) {
      throw new BadRequestException(
        'There is already an open cash register at this location',
      );
    }

    return this.prisma.cashRegister.create({
      data: {
        locationId: data.locationId,
        name: data.name ?? 'Caja Principal',
        status: 'open',
        shift: data.shift ?? undefined,
        openedAt: new Date(),
        openedById: userId,
        openingAmount: data.openingAmount,
      },
      include: {
        location: { select: { id: true, name: true } },
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async closeRegister(id: string, data: CloseRegisterDto, userId: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
    });

    if (!register) {
      throw new NotFoundException(`Cash register with ID "${id}" not found`);
    }

    if (register.status !== 'open') {
      throw new BadRequestException('Cash register is not open');
    }

    // Si viene conteo por denominación, calcular caja real (efectivo) como suma de valor × cantidad
    let closingAmount = data.closingAmount;
    let closingDenominations: Record<string, number> | null = null;
    if (data.denominations && typeof data.denominations === 'object' && Object.keys(data.denominations).length > 0) {
      closingDenominations = data.denominations as Record<string, number>;
      closingAmount = 0;
      for (const [denomStr, qty] of Object.entries(closingDenominations)) {
        const denom = parseFloat(denomStr);
        const n = typeof qty === 'number' ? qty : parseInt(String(qty), 10) || 0;
        if (!Number.isNaN(denom) && n >= 0) closingAmount += denom * n;
      }
      closingAmount = Math.round(closingAmount * 100) / 100;
    }

    // Ventas por medio de pago desde órdenes cerradas en este turno (excluir mesas errores de comandas y tacho de basura)
    const orders = await this.prisma.order.findMany({
      where: {
        locationId: register.locationId,
        status: 'closed',
        closedAt: {
          gte: register.openedAt!,
        },
        OR: [
          { tableId: null },
          { table: { tableType: { notIn: ['errors', 'trash'] } } },
        ],
      },
      select: {
        total: true,
        paymentMethod: true,
        paymentBreakdown: true,
      },
    });

    let salesCash = 0;
    let salesDebit = 0;
    let salesCredit = 0;
    let salesCard = 0;
    let salesQr = 0;
    let salesTransfer = 0;
    let totalSales = 0;

    for (const order of orders) {
      totalSales += order.total;
      const items = paymentBreakdownToItems(order.paymentBreakdown);
      if (items.length > 0) {
        for (const p of items) {
          const method = normalizePaymentMethod(p.method);
          const amount = p.amount;
          switch (method) {
            case 'cash': salesCash += amount; break;
            case 'debit': salesDebit += amount; break;
            case 'credit': salesCredit += amount; break;
            case 'card': salesCard += amount; break;
            case 'qr': salesQr += amount; break;
            case 'transfer': salesTransfer += amount; break;
            default: salesCash += amount;
          }
        }
      } else {
        const method = normalizePaymentMethod(order.paymentMethod || 'cash');
        switch (method) {
          case 'cash': salesCash += order.total; break;
          case 'debit': salesDebit += order.total; break;
          case 'credit': salesCredit += order.total; break;
          case 'card': salesCard += order.total; break;
          case 'qr': salesQr += order.total; break;
          case 'transfer': salesTransfer += order.total; break;
          default: salesCash += order.total;
        }
      }
    }

    // Gastos, retiros e ingresos extra del turno (movimientos ligados a esta caja)
    const movements = await this.prisma.cashMovement.findMany({
      where: { cashRegisterId: id },
      select: { type: true, amount: true },
    });

    let totalCashExpenses = 0;
    let totalWithdrawals = 0;
    let totalExtraIncome = 0;
    for (const m of movements) {
      if (m.type === 'expense' || m.type === 'out') totalCashExpenses += m.amount;
      else if (m.type === 'withdrawal') totalWithdrawals += m.amount;
      else if (m.type === 'extra_income' || m.type === 'in') totalExtraIncome += m.amount;
    }

    // ─── Fórmulas obligatorias ───
    // Caja Esperada = Saldo Inicial + Tarjetas + Transferencias y QR + Efectivo - Gastos y Retiros + Ingresos Extra
    const opening = register.openingAmount ?? 0;
    const expectedAmount =
      Math.round((opening + salesCard + salesTransfer + salesQr + salesCash - totalCashExpenses - totalWithdrawals + totalExtraIncome) * 100) / 100;
    // Diferencia = Caja Real (conteo físico) - Caja Esperada
    const difference = Math.round((closingAmount - expectedAmount) * 100) / 100;

    const closingReconciliation =
      data.closingCardsTotal != null || data.closingTransferTotal != null || data.closingQrTotal != null
        ? {
            cards: data.closingCardsTotal ?? 0,
            transfer: data.closingTransferTotal ?? 0,
            qr: data.closingQrTotal ?? 0,
          }
        : undefined;

    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        status: 'closed',
        shift: data.shift ?? register.shift,
        closedAt: new Date(),
        closedById: userId,
        closingAmount,
        expectedAmount,
        difference,
        closingDenominations: closingDenominations ?? undefined,
        closingReconciliation: closingReconciliation ?? undefined,
        salesCash: Math.round(salesCash * 100) / 100,
        salesDebit: Math.round(salesDebit * 100) / 100,
        salesCredit: Math.round(salesCredit * 100) / 100,
        salesCard: Math.round(salesCard * 100) / 100,
        salesQr: Math.round(salesQr * 100) / 100,
        salesTransfer: Math.round(salesTransfer * 100) / 100,
        totalSales: Math.round(totalSales * 100) / 100,
        totalCashExpenses: Math.round(totalCashExpenses * 100) / 100,
        totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
        totalExtraIncome: Math.round(totalExtraIncome * 100) / 100,
        totalOrders: orders.length,
        salesNoTicket: data.salesNoTicket ?? 0,
        internalConsumption: data.internalConsumption ?? 0,
        notes: data.notes ?? undefined,
        closedBySignature: data.closedBySignature ?? undefined,
      },
      include: {
        location: { select: { id: true, name: true } },
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async getCurrentOpen(locationId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        locationId,
        status: 'open',
      },
      include: {
        location: { select: { id: true, name: true } },
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!register || !register.openedAt) {
      return register;
    }

    // Totales en vivo: órdenes cerradas en este turno (excluir mesas errores de comandas y tacho de basura)
    const orders = await this.prisma.order.findMany({
      where: {
        locationId: register.locationId,
        status: 'closed',
        closedAt: { gte: register.openedAt },
        OR: [
          { tableId: null },
          { table: { tableType: { notIn: ['errors', 'trash'] } } },
        ],
      },
      select: { total: true, paymentMethod: true, paymentBreakdown: true },
    });

    let salesCash = 0;
    let salesDebit = 0;
    let salesCredit = 0;
    let salesCard = 0;
    let salesQr = 0;
    let salesTransfer = 0;
    let totalSales = 0;
    for (const order of orders) {
      totalSales += order.total;
      const items = paymentBreakdownToItems(order.paymentBreakdown);
      if (items.length > 0) {
        for (const p of items) {
          const method = normalizePaymentMethod(p.method);
          const amount = p.amount;
          switch (method) {
            case 'cash': salesCash += amount; break;
            case 'debit': salesDebit += amount; break;
            case 'credit': salesCredit += amount; break;
            case 'card': salesCard += amount; break;
            case 'qr': salesQr += amount; break;
            case 'transfer': salesTransfer += amount; break;
            default: salesCash += amount;
          }
        }
      } else {
        const method = normalizePaymentMethod(order.paymentMethod || 'cash');
        switch (method) {
          case 'cash': salesCash += order.total; break;
          case 'debit': salesDebit += order.total; break;
          case 'credit': salesCredit += order.total; break;
          case 'card': salesCard += order.total; break;
          case 'qr': salesQr += order.total; break;
          case 'transfer': salesTransfer += order.total; break;
          default: salesCash += order.total;
        }
      }
    }

    // Movimientos del turno (gastos, retiros, ingresos extra)
    const movements = await this.prisma.cashMovement.findMany({
      where: { cashRegisterId: register.id },
      select: { type: true, amount: true },
    });
    let totalCashExpenses = 0;
    let totalWithdrawals = 0;
    let totalExtraIncome = 0;
    for (const m of movements) {
      if (m.type === 'expense' || m.type === 'out') totalCashExpenses += m.amount;
      else if (m.type === 'withdrawal') totalWithdrawals += m.amount;
      else if (m.type === 'extra_income' || m.type === 'in') totalExtraIncome += m.amount;
    }

    return {
      ...register,
      salesCash: Math.round(salesCash * 100) / 100,
      salesDebit: Math.round(salesDebit * 100) / 100,
      salesCredit: Math.round(salesCredit * 100) / 100,
      salesCard: Math.round(salesCard * 100) / 100,
      salesQr: Math.round(salesQr * 100) / 100,
      salesTransfer: Math.round(salesTransfer * 100) / 100,
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders: orders.length,
      totalCashExpenses: Math.round(totalCashExpenses * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      totalExtraIncome: Math.round(totalExtraIncome * 100) / 100,
    };
  }

  /** Reportes: diario, semanal, mensual */
  async getReport(
    locationId: string,
    type: 'daily' | 'weekly' | 'monthly',
    dateFrom: string,
    dateTo: string,
  ) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const closures = await this.prisma.cashRegister.findMany({
      where: {
        locationId,
        status: 'closed',
        closedAt: { gte: from, lte: to },
      },
      include: {
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { closedAt: 'asc' },
    });

    const totalSales = closures.reduce((s, c) => s + (c.totalSales ?? 0), 0);
    const totalExpected = closures.reduce((s, c) => s + (c.expectedAmount ?? 0), 0);
    const totalReal = closures.reduce((s, c) => s + (c.closingAmount ?? 0), 0);
    const totalDifference = closures.reduce((s, c) => s + (c.difference ?? 0), 0);
    const totalExpenses = closures.reduce((s, c) => s + (c.totalCashExpenses ?? 0) + (c.totalWithdrawals ?? 0), 0);
    const totalExtra = closures.reduce((s, c) => s + (c.totalExtraIncome ?? 0), 0);

    return {
      type,
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      closures,
      summary: {
        totalClosures: closures.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalReal: Math.round(totalReal * 100) / 100,
        totalDifference: Math.round(totalDifference * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalExtraIncome: Math.round(totalExtra * 100) / 100,
        dailyResult: Math.round((totalSales - totalExpenses) * 100) / 100,
      },
    };
  }
}
