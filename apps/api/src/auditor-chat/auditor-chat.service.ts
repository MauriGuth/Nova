import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { AuditorChatDto } from './dto/auditor-chat.dto';

/** Límites para mantener el contexto dentro de ventana del modelo */
const LIMITS = {
  products: 800,
  stockLevels: 2000,
  recipes: 300,
  recipeIngredientsPerRecipe: 50,
  goodsReceipts: 80,
  stockMovements: 150,
  closures: 200,
  productionOrders: 200,
  shipments: 120,
  orders: 600,
  purchaseOrders: 80,
  wasteRecords: 100,
};

@Injectable()
export class AuditorChatService {
  private readonly logger = new Logger(AuditorChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new BadRequestException(
        'OPENAI_API_KEY no configurada. Agregá tu API key en apps/api/.env',
      );
    }
    return new OpenAI({ apiKey });
  }

  /**
   * Construye el contexto completo de la empresa con datos actuales de la base.
   * Se ejecuta en cada mensaje del chat para que la IA siempre tenga datos al día.
   */
  async buildCompanyContext(): Promise<Record<string, unknown>> {
    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 7);
    last7Start.setHours(0, 0, 0, 0);
    const last14Start = new Date(now);
    last14Start.setDate(last14Start.getDate() - 14);
    last14Start.setHours(0, 0, 0, 0);
    const last30Start = new Date(now);
    last30Start.setDate(last30Start.getDate() - 30);
    last30Start.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [
      locations,
      categories,
      products,
      stockLevels,
      recipesWithIngredients,
      suppliers,
      goodsReceipts,
      stockMovements,
      closures,
      productionOrders,
      shipments,
      orders,
      tables,
      alerts,
      purchaseOrders,
      wasteRecords,
    ] = await Promise.all([
      this.prisma.location.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          address: true,
          phone: true,
          isProduction: true,
          hasTables: true,
          _count: {
            select: { stockLevels: true, tables: true, users: true, orders: true },
          },
        },
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          _count: { select: { products: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          avgCost: true,
          lastCost: true,
          salePrice: true,
          isSellable: true,
          isIngredient: true,
          isProduced: true,
          isPerishable: true,
          category: { select: { name: true } },
        },
        take: LIMITS.products,
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockLevel.findMany({
        include: {
          product: { select: { name: true, sku: true, unit: true, avgCost: true } },
          location: { select: { name: true } },
        },
        take: LIMITS.stockLevels,
      }),
      this.prisma.recipe.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          version: true,
          yieldQty: true,
          yieldUnit: true,
          category: true,
          product: { select: { name: true, sku: true } },
          ingredients: {
            take: LIMITS.recipeIngredientsPerRecipe,
            select: {
              qtyPerYield: true,
              unit: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
        take: LIMITS.recipes,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          legalName: true,
          rubro: true,
          paymentMethod: true,
          _count: { select: { goodsReceipts: true } },
        },
      }),
      this.prisma.goodsReceipt.findMany({
        where: { createdAt: { gte: last30Start } },
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          supplier: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.goodsReceipts,
      }),
      this.prisma.stockMovement.findMany({
        where: { createdAt: { gte: last30Start } },
        select: {
          type: true,
          quantity: true,
          unitCost: true,
          createdAt: true,
          product: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.stockMovements,
      }),
      this.prisma.cashRegister.findMany({
        where: {
          status: 'closed',
          closedAt: { gte: last14Start, lte: now },
        },
        select: {
          id: true,
          closedAt: true,
          totalSales: true,
          expectedAmount: true,
          closingAmount: true,
          difference: true,
          location: { select: { name: true } },
        },
        orderBy: { closedAt: 'desc' },
        take: LIMITS.closures,
      }),
      this.prisma.productionOrder.findMany({
        where: { plannedDate: { gte: last7Start, lte: now } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          plannedQty: true,
          actualQty: true,
          actualCost: true,
          plannedDate: true,
          completedAt: true,
          recipe: { select: { name: true } },
          location: { select: { name: true } },
        },
        take: LIMITS.productionOrders,
        orderBy: { plannedDate: 'desc' },
      }),
      this.prisma.shipment.findMany({
        where: { createdAt: { gte: last14Start } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          dispatchedAt: true,
          receivedAt: true,
          estimatedDurationMin: true,
          origin: { select: { name: true } },
          destination: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.shipments,
      }),
      this.prisma.order.findMany({
        where: { closedAt: { gte: last7Start, lte: now } },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          closedAt: true,
          location: { select: { name: true } },
        },
        take: LIMITS.orders,
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.table.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          zone: true,
          status: true,
          tableType: true,
          capacity: true,
          location: { select: { name: true } },
        },
      }),
      this.prisma.alert.findMany({
        where: { status: 'active' },
        select: { type: true, priority: true, title: true, message: true, locationId: true },
        take: 50,
      }),
      this.prisma.purchaseOrder.findMany({
        where: { createdAt: { gte: last30Start } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          location: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.purchaseOrders,
      }),
      this.prisma.wasteRecord.findMany({
        where: { recordedAt: { gte: last30Start } },
        select: {
          type: true,
          quantity: true,
          unit: true,
          reason: true,
          recordedAt: true,
          product: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take: LIMITS.wasteRecords,
      }),
    ]);

    // Resúmenes y agregados
    const stockByLocation: Record<string, { critical: number; totalValue: number; products: number }> = {};
    let stockCriticalTotal = 0;
    let stockValueTotal = 0;
    for (const sl of stockLevels) {
      const locName = sl.location.name;
      if (!stockByLocation[locName]) stockByLocation[locName] = { critical: 0, totalValue: 0, products: 0 };
      stockByLocation[locName].products++;
      const val = sl.quantity * (sl.product.avgCost ?? 0);
      stockByLocation[locName].totalValue += val;
      stockValueTotal += val;
      if (sl.quantity <= sl.minQuantity) {
        stockByLocation[locName].critical++;
        stockCriticalTotal++;
      }
    }

    const closuresByLocation: Record<string, { count: number; totalSales: number; totalReal: number }> = {};
    let totalClosuresSales = 0;
    let totalClosuresReal = 0;
    for (const c of closures) {
      const name = c.location.name;
      if (!closuresByLocation[name]) closuresByLocation[name] = { count: 0, totalSales: 0, totalReal: 0 };
      closuresByLocation[name].count++;
      closuresByLocation[name].totalSales += c.totalSales ?? 0;
      closuresByLocation[name].totalReal += c.closingAmount ?? 0;
      totalClosuresSales += c.totalSales ?? 0;
      totalClosuresReal += c.closingAmount ?? 0;
    }

    const movementsByType: Record<string, number> = {};
    const movementsByTypeQty: Record<string, number> = {};
    for (const m of stockMovements) {
      movementsByType[m.type] = (movementsByType[m.type] ?? 0) + 1;
      movementsByTypeQty[m.type] = (movementsByTypeQty[m.type] ?? 0) + Math.abs(m.quantity);
    }

    const shipmentsByStatus: Record<string, number> = {};
    const dispatchDurations: number[] = [];
    for (const s of shipments) {
      shipmentsByStatus[s.status] = (shipmentsByStatus[s.status] ?? 0) + 1;
      if (s.dispatchedAt && s.receivedAt) {
        dispatchDurations.push((s.receivedAt.getTime() - s.dispatchedAt.getTime()) / 60000);
      }
    }

    const ordersByLocation: Record<string, { count: number; total: number }> = {};
    let ordersTotal = 0;
    for (const o of orders) {
      const name = o.location.name;
      if (!ordersByLocation[name]) ordersByLocation[name] = { count: 0, total: 0 };
      ordersByLocation[name].count++;
      ordersByLocation[name].total += o.total ?? 0;
      ordersTotal += o.total ?? 0;
    }

    const productionByStatus: Record<string, number> = {};
    let productionCostWeek = 0;
    for (const p of productionOrders) {
      productionByStatus[p.status] = (productionByStatus[p.status] ?? 0) + 1;
      if (p.actualCost) productionCostWeek += p.actualCost;
    }

    const wasteByType: Record<string, { count: number; quantity: number }> = {};
    for (const w of wasteRecords) {
      if (!wasteByType[w.type]) wasteByType[w.type] = { count: 0, quantity: 0 };
      wasteByType[w.type].count++;
      wasteByType[w.type].quantity += w.quantity;
    }

    const poByStatus: Record<string, number> = {};
    for (const po of purchaseOrders) {
      poByStatus[po.status] = (poByStatus[po.status] ?? 0) + 1;
    }

    return {
      nota: 'Este contexto se genera en cada consulta con los datos actuales de la base de datos. Siempre está actualizado.',
      fechaHoraConsulta: now.toISOString(),
      locales: locations.map((l) => ({
        id: l.id,
        nombre: l.name,
        slug: l.slug,
        tipo: l.type,
        direccion: l.address,
        telefono: l.phone,
        esProduccion: l.isProduction,
        tieneMesas: l.hasTables,
        productosEnStock: l._count.stockLevels,
        mesas: l._count.tables,
        usuarios: l._count.users,
        pedidosTotal: l._count.orders,
      })),
      categorias: categories.map((c) => ({
        id: c.id,
        nombre: c.name,
        slug: c.slug,
        padreId: c.parentId,
        cantidadProductos: c._count.products,
      })),
      productos: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        nombre: p.name,
        categoria: p.category?.name,
        unidad: p.unit,
        costoPromedio: p.avgCost,
        ultimoCosto: p.lastCost,
        precioVenta: p.salePrice,
        esVendible: p.isSellable,
        esIngrediente: p.isIngredient,
        esProducido: p.isProduced,
        esPerecedero: p.isPerishable,
      })),
      stockPorProductoYLocal: stockLevels.map((sl) => ({
        producto: sl.product.name,
        sku: sl.product.sku,
        local: sl.location.name,
        cantidad: sl.quantity,
        minimo: sl.minQuantity,
        critico: sl.quantity <= sl.minQuantity,
        valorAprox: Math.round((sl.quantity * (sl.product.avgCost ?? 0)) * 100) / 100,
      })),
      resumenStock: {
        totalRegistrosStock: stockLevels.length,
        productosCriticos: stockCriticalTotal,
        valorTotalAprox: Math.round(stockValueTotal * 100) / 100,
        porLocal: stockByLocation,
      },
      recetas: recipesWithIngredients.map((r) => ({
        id: r.id,
        nombre: r.name,
        version: r.version,
        rinde: `${r.yieldQty} ${r.yieldUnit}`,
        categoria: r.category,
        productoResultado: r.product?.name ?? null,
        ingredientes: r.ingredients.map((i) => ({
          producto: i.product.name,
          cantidadPorRendicion: i.qtyPerYield,
          unidad: i.unit,
        })),
      })),
      proveedores: suppliers.map((s) => ({
        id: s.id,
        nombre: s.name,
        razonSocial: s.legalName,
        rubro: s.rubro,
        metodoPago: s.paymentMethod,
        ingresosAsociados: s._count.goodsReceipts,
      })),
      ingresosMercaderia: {
        ultimos30Dias: goodsReceipts.length,
        resumen: goodsReceipts.slice(0, 40).map((gr) => ({
          numero: gr.receiptNumber,
          proveedor: gr.supplier.name,
          local: gr.location.name,
          monto: gr.totalAmount,
          estado: gr.status,
          fecha: gr.createdAt.toISOString().split('T')[0],
        })),
      },
      movimientosStock: {
        ultimos30Dias: {
          cantidad: stockMovements.length,
          porTipo: movementsByType,
          cantidadesPorTipo: movementsByTypeQty,
        },
        ultimos: stockMovements.slice(0, 50).map((m) => ({
          producto: m.product.name,
          local: m.location.name,
          tipo: m.type,
          cantidad: m.quantity,
          costoUnit: m.unitCost,
          fecha: m.createdAt.toISOString().split('T')[0],
        })),
      },
      cajaCierres: {
        ultimos14Dias: {
          totalCierres: closures.length,
          ventasTotales: Math.round(totalClosuresSales * 100) / 100,
          montoRealDeclarado: Math.round(totalClosuresReal * 100) / 100,
          porLocal: Object.entries(closuresByLocation).map(([nombre, d]) => ({
            local: nombre,
            cierres: d.count,
            ventas: Math.round(d.totalSales * 100) / 100,
            real: Math.round(d.totalReal * 100) / 100,
          })),
        },
        detalle: closures.slice(0, 30).map((c) => ({
          local: c.location.name,
          fecha: c.closedAt?.toISOString() ?? '',
          ventas: c.totalSales,
          esperado: c.expectedAmount,
          real: c.closingAmount,
          diferencia: c.difference,
        })),
      },
      produccion: {
        ultimos7Dias: {
          porEstado: productionByStatus,
          costoTotalCompletadas: Math.round(productionCostWeek * 100) / 100,
        },
        detalle: productionOrders.slice(0, 40).map((p) => ({
          numero: p.orderNumber,
          receta: p.recipe.name,
          local: p.location.name,
          estado: p.status,
          cantidadPlaneada: p.plannedQty,
          cantidadReal: p.actualQty,
          costoReal: p.actualCost,
          fechaPlaneada: p.plannedDate.toISOString().split('T')[0],
          fechaCompletada: p.completedAt?.toISOString().split('T')[0] ?? null,
        })),
      },
      despachos: {
        ultimos14Dias: {
          porEstado: shipmentsByStatus,
          cantidadTotal: shipments.length,
          tiempoPromedioDespachoMinutos:
            dispatchDurations.length > 0
              ? Math.round(dispatchDurations.reduce((a, b) => a + b, 0) / dispatchDurations.length)
              : null,
        },
        detalle: shipments.slice(0, 30).map((s) => ({
          origen: s.origin.name,
          destino: s.destination.name,
          estado: s.status,
          enviado: s.dispatchedAt?.toISOString() ?? null,
          recibido: s.receivedAt?.toISOString() ?? null,
          duracionEstimadaMin: s.estimatedDurationMin,
        })),
      },
      ventasPedidos: {
        ultimos7Dias: {
          totalPedidosCerrados: orders.length,
          montoTotal: Math.round(ordersTotal * 100) / 100,
          porLocal: Object.entries(ordersByLocation).map(([nombre, d]) => ({
            local: nombre,
            pedidos: d.count,
            monto: Math.round(d.total * 100) / 100,
          })),
        },
      },
      mesas: tables.map((t) => ({
        local: t.location.name,
        nombre: t.name,
        zona: t.zone,
        estado: t.status,
        tipo: t.tableType,
        capacidad: t.capacity,
      })),
      pedidosCompra: {
        ultimos30Dias: {
          cantidad: purchaseOrders.length,
          porEstado: poByStatus,
        },
        detalle: purchaseOrders.slice(0, 25).map((po) => ({
          numero: po.orderNumber,
          local: po.location.name,
          proveedor: po.supplier.name,
          estado: po.status,
          monto: po.totalAmount,
          fecha: po.createdAt.toISOString().split('T')[0],
        })),
      },
      mermas: {
        ultimos30Dias: {
          cantidadRegistros: wasteRecords.length,
          porTipo: wasteByType,
        },
        detalle: wasteRecords.slice(0, 40).map((w) => ({
          producto: w.product.name,
          local: w.location.name,
          tipo: w.type,
          cantidad: w.quantity,
          unidad: w.unit,
          motivo: w.reason,
          fecha: w.recordedAt.toISOString().split('T')[0],
        })),
      },
      alertasActivas: alerts.map((a) => ({
        tipo: a.type,
        prioridad: a.priority,
        titulo: a.title,
        mensaje: a.message,
      })),
    };
  }

  /**
   * Métricas para mostrar en gráficos y resumen en el chat del auditor.
   */
  async getMetrics(): Promise<{
    summary: Record<string, number | string>;
    charts: Array<{
      id: string;
      type: 'bar' | 'line' | 'pie';
      title: string;
      dataKey?: string;
      data: Array<Record<string, unknown>>;
    }>;
  }> {
    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 7);
    last7Start.setHours(0, 0, 0, 0);
    const last14Start = new Date(now);
    last14Start.setDate(last14Start.getDate() - 14);
    last14Start.setHours(0, 0, 0, 0);

    const [
      locations,
      stockLevels,
      closures,
      orders,
      productionOrders,
      shipments,
      alerts,
      wasteRecords,
    ] = await Promise.all([
      this.prisma.location.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.stockLevel.findMany({
        select: { quantity: true, minQuantity: true },
      }),
      this.prisma.cashRegister.findMany({
        where: {
          status: 'closed',
          closedAt: { gte: last14Start, lte: now },
        },
        select: {
          closedAt: true,
          totalSales: true,
          closingAmount: true,
          locationId: true,
          location: { select: { name: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { closedAt: { gte: last7Start, lte: now } },
        select: { total: true, locationId: true, location: { select: { name: true } } },
      }),
      this.prisma.productionOrder.findMany({
        where: { plannedDate: { gte: last7Start, lte: now } },
        select: { status: true },
      }),
      this.prisma.shipment.findMany({
        where: { createdAt: { gte: last14Start } },
        select: { status: true },
      }),
      this.prisma.alert.findMany({
        where: { status: 'active' },
        select: { id: true },
      }),
      this.prisma.wasteRecord.findMany({
        where: { recordedAt: { gte: last14Start } },
        select: { quantity: true },
      }),
    ]);

    let stockCritical = 0;
    let stockMedium = 0;
    let stockNormal = 0;
    let stockValue = 0;
    for (const sl of stockLevels) {
      if (sl.quantity <= sl.minQuantity) stockCritical++;
      else if (sl.quantity <= sl.minQuantity * 1.5) stockMedium++;
      else stockNormal++;
    }

    const ventasPorLocal: Record<string, number> = {};
    const pedidosPorLocal: Record<string, number> = {};
    for (const o of orders) {
      const name = o.location.name;
      ventasPorLocal[name] = (ventasPorLocal[name] ?? 0) + (o.total ?? 0);
      pedidosPorLocal[name] = (pedidosPorLocal[name] ?? 0) + 1;
    }

    const cierresPorDia: Record<string, { count: number; ventas: number }> = {};
    for (const c of closures) {
      const day = c.closedAt?.toISOString().split('T')[0] ?? '';
      if (!day) continue;
      if (!cierresPorDia[day]) cierresPorDia[day] = { count: 0, ventas: 0 };
      cierresPorDia[day].count++;
      cierresPorDia[day].ventas += c.totalSales ?? 0;
    }
    const cierresPorDiaArr = Object.entries(cierresPorDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, d]) => ({ fecha, cierres: d.count, ventas: Math.round(d.ventas * 100) / 100 }));

    const prodPorEstado: Record<string, number> = {};
    for (const p of productionOrders) {
      prodPorEstado[p.status] = (prodPorEstado[p.status] ?? 0) + 1;
    }
    const despachosPorEstado: Record<string, number> = {};
    for (const s of shipments) {
      despachosPorEstado[s.status] = (despachosPorEstado[s.status] ?? 0) + 1;
    }

    const totalVentas7 = orders.reduce((s, o) => s + (o.total ?? 0), 0);
    const totalCierres14 = closures.length;
    const totalVentasCaja14 = closures.reduce((s, c) => s + (c.totalSales ?? 0), 0);
    const totalMermas = wasteRecords.reduce((s, w) => s + w.quantity, 0);

    const summary = {
      totalLocales: locations.length,
      ventasUltimos7Dias: Math.round(totalVentas7 * 100) / 100,
      cierresUltimos14Dias: totalCierres14,
      ventasCajaUltimos14Dias: Math.round(totalVentasCaja14 * 100) / 100,
      productosConStock: stockLevels.length,
      productosCriticos: stockCritical,
      productosMedio: stockMedium,
      productosNormal: stockNormal,
      alertasActivas: alerts.length,
      ordenesProduccionUltimos7Dias: productionOrders.length,
      despachosUltimos14Dias: shipments.length,
      registrosMermaUltimos14Dias: wasteRecords.length,
      totalMermaCantidad: Math.round(totalMermas * 100) / 100,
    };

    const charts = [
      {
        id: 'ventas_por_local',
        type: 'bar' as const,
        title: 'Ventas por local (últimos 7 días)',
        dataKey: 'ventas',
        data: Object.entries(ventasPorLocal).map(([name, ventas]) => ({ name, ventas: Math.round(ventas * 100) / 100 })),
      },
      {
        id: 'pedidos_por_local',
        type: 'bar' as const,
        title: 'Pedidos cerrados por local (últimos 7 días)',
        dataKey: 'pedidos',
        data: Object.entries(pedidosPorLocal).map(([name, pedidos]) => ({ name, pedidos })),
      },
      {
        id: 'stock_por_estado',
        type: 'pie' as const,
        title: 'Stock por estado',
        data: [
          { name: 'Crítico', value: stockCritical, fill: '#ef4444' },
          { name: 'Medio', value: stockMedium, fill: '#f59e0b' },
          { name: 'Normal', value: stockNormal, fill: '#22c55e' },
        ],
      },
      {
        id: 'cierres_por_dia',
        type: 'line' as const,
        title: 'Cierres de caja por día (últimos 14 días)',
        dataKey: 'cierres',
        data: cierresPorDiaArr,
      },
      {
        id: 'ventas_cierres_por_dia',
        type: 'line' as const,
        title: 'Ventas por día (cierres, últimos 14 días)',
        dataKey: 'ventas',
        data: cierresPorDiaArr,
      },
      {
        id: 'produccion_por_estado',
        type: 'bar' as const,
        title: 'Producción por estado (últimos 7 días)',
        dataKey: 'cantidad',
        data: Object.entries(prodPorEstado).map(([name, cantidad]) => ({ name, cantidad })),
      },
      {
        id: 'despachos_por_estado',
        type: 'pie' as const,
        title: 'Despachos por estado (últimos 14 días)',
        data: Object.entries(despachosPorEstado).map(([name, value]) => ({
          name: name === 'draft' ? 'Borrador' : name === 'dispatched' ? 'Enviado' : name === 'received' ? 'Recibido' : name,
          value,
          fill: name === 'received' ? '#22c55e' : name === 'dispatched' ? '#3b82f6' : '#94a3b8',
        })),
      },
    ];

    return { summary, charts };
  }

  async chat(dto: AuditorChatDto): Promise<{ reply: string }> {
    const openai = this.getOpenAI();
    this.logger.log('Building full company context for auditor chat (live data)...');
    const context = await this.buildCompanyContext();
    const contextStr = JSON.stringify(context, null, 2);

    const systemContent = `Eres un auditor interno de la empresa con acceso a TODOS los datos actuales del sistema.

En cada mensaje recibes un JSON con el estado actual de la base de datos. Ese contexto se genera en el momento de la consulta, por lo que los datos están siempre actualizados. Incluye:

- Locales: todos los locales/sucursales/depósitos con dirección, tipo, mesas, usuarios, pedidos.
- Categorías y productos: catálogo completo con SKU, nombre, categoría, unidad, costos, precios, si es vendible/ingrediente/producido.
- Stock por producto y por local: cantidad actual, mínimo, si está en crítico, valor aproximado.
- Recetas: todas las recetas con ingredientes (producto, cantidad por rendición, unidad) y producto resultante.
- Proveedores: nombre, rubro, método de pago, ingresos asociados.
- Ingresos de mercadería: últimos ingresos con proveedor, local, monto, estado.
- Movimientos de stock: últimos por tipo (entrada, salida, pérdida, etc.) y detalle.
- Cierres de caja: ventas, montos reales, diferencias por local (últimos 14 días).
- Producción: órdenes de producción por estado, receta, local, costos (últimos 7 días).
- Despachos: entre locales, estados, tiempos de envío/recepción.
- Ventas y pedidos cerrados: por local (últimos 7 días).
- Mesas: por local, nombre, zona, estado, tipo (normal/errores/trash).
- Pedidos de compra: últimos por local, proveedor, estado, monto.
- Mermas: registros recientes por producto, local, tipo, cantidad.
- Alertas activas.

Responde SIEMPRE en español, de forma clara y profesional. Basate únicamente en los datos del contexto; si algo no está en el JSON, dilo y no inventes cifras. Puedes citar números, productos, locales y recetas del contexto. Si preguntan por algo que requiere otro período o filtro, explicalo.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemContent,
      },
      {
        role: 'user',
        content: `Datos actuales de la empresa (generados ahora):\n\`\`\`json\n${contextStr}\n\`\`\``,
      },
    ];

    if (dto.history && dto.history.length > 0) {
      const lastHistory = dto.history.slice(-10);
      for (const h of lastHistory) {
        messages.push({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        });
      }
    }

    messages.push({
      role: 'user',
      content: dto.message,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2500,
      messages,
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? 'No pude generar una respuesta. Intentá de nuevo.';
    return { reply };
  }

  // ─── Conversaciones persistentes ─────────────────────────────────────

  async createConversation(userId: string) {
    const conv = await this.prisma.auditorConversation.create({
      data: {
        userId,
        title: 'Nueva conversación',
      },
    });
    return {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  }

  async getConversations(userId: string) {
    const list = await this.prisma.auditorConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return list;
  }

  async getConversationWithMessages(conversationId: string, userId: string) {
    const conv = await this.prisma.auditorConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.userId !== userId) throw new ForbiddenException('No tenés acceso a esta conversación');
    return conv;
  }

  async sendMessage(conversationId: string, content: string, userId: string) {
    const conv = await this.prisma.auditorConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.userId !== userId) throw new ForbiddenException('No tenés acceso a esta conversación');

    const openai = this.getOpenAI();
    this.logger.log(`Auditor chat: sending message in conversation ${conversationId}`);

    const userMsg = await this.prisma.auditorMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: content.trim(),
      },
    });

    const context = await this.buildCompanyContext();
    const contextStr = JSON.stringify(context, null, 2);
    const systemContent = `Eres un auditor interno de la empresa con acceso a TODOS los datos actuales del sistema.

En cada mensaje recibes un JSON con el estado actual de la base de datos. Ese contexto se genera en el momento de la consulta, por lo que los datos están siempre actualizados. Incluye:

- Locales: todos los locales/sucursales/depósitos con dirección, tipo, mesas, usuarios, pedidos.
- Categorías y productos: catálogo completo con SKU, nombre, categoría, unidad, costos, precios, si es vendible/ingrediente/producido.
- Stock por producto y por local: cantidad actual, mínimo, si está en crítico, valor aproximado.
- Recetas: todas las recetas con ingredientes (producto, cantidad por rendición, unidad) y producto resultante.
- Proveedores: nombre, rubro, método de pago, ingresos asociados.
- Ingresos de mercadería: últimos ingresos con proveedor, local, monto, estado.
- Movimientos de stock: últimos por tipo (entrada, salida, pérdida, etc.) y detalle.
- Cierres de caja: ventas, montos reales, diferencias por local (últimos 14 días).
- Producción: órdenes de producción por estado, receta, local, costos (últimos 7 días).
- Despachos: entre locales, estados, tiempos de envío/recepción.
- Ventas y pedidos cerrados: por local (últimos 7 días).
- Mesas: por local, nombre, zona, estado, tipo (normal/errores/trash).
- Pedidos de compra: últimos por local, proveedor, estado, monto.
- Mermas: registros recientes por producto, local, tipo, cantidad.
- Alertas activas.

Responde SIEMPRE en español, de forma clara y profesional. Basate únicamente en los datos del contexto; si algo no está en el JSON, dilo y no inventes cifras. Puedes citar números, productos, locales y recetas del contexto. Si preguntan por algo que requiere otro período o filtro, explicalo.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: `Datos actuales de la empresa (generados ahora):\n\`\`\`json\n${contextStr}\n\`\`\`` },
    ];

    const history = conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const lastHistory = history.slice(-14);
    for (const h of lastHistory) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: content.trim() });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2500,
      messages,
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? 'No pude generar una respuesta. Intentá de nuevo.';

    const assistantMsg = await this.prisma.auditorMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: reply,
      },
    });

    const newTitle =
      conv.title === 'Nueva conversación'
        ? content.trim().slice(0, 50) + (content.trim().length > 50 ? '…' : '')
        : conv.title;

    await this.prisma.auditorConversation.update({
      where: { id: conversationId },
      data: { title: newTitle, updatedAt: new Date() },
    });

    return {
      userMessage: {
        id: userMsg.id,
        role: 'user' as const,
        content: userMsg.content,
        createdAt: userMsg.createdAt,
      },
      assistantMessage: {
        id: assistantMsg.id,
        role: 'assistant' as const,
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt,
      },
    };
  }
}
