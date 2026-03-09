import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WASTE_THRESHOLD_7D = 50; // unidades en 7 días para considerar "mermas elevadas"
const DELAY_THRESHOLD_MIN = 30; // minutos de retraso en envío

export interface IncidentFinding {
  type: string;
  message: string;
  priority: string;
  referenceType?: string;
  referenceId?: string;
  locationId?: string | null;
}

export interface IncidentsReportResult {
  findings: IncidentFinding[];
  alertsCreated: number;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta detección de incidentes (Fase 6):
   * - Mermas elevadas en últimos 7 días por local
   * - Envíos con retraso > 30 min (estimado vs real)
   * Crea Alert por cada hallazgo y devuelve resumen.
   */
  async runReport(): Promise<IncidentsReportResult> {
    const findings: IncidentFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // 1) Mermas: total por ubicación en últimos 7 días
    const wasteByLocation = await this.prisma.wasteRecord.groupBy({
      by: ['locationId'],
      where: {
        recordedAt: { gte: since },
      },
      _sum: { quantity: true },
      _count: { id: true },
    });

    for (const row of wasteByLocation) {
      const total = row._sum.quantity ?? 0;
      if (total >= WASTE_THRESHOLD_7D && row.locationId) {
        const location = await this.prisma.location.findUnique({
          where: { id: row.locationId },
          select: { name: true },
        });
        const name = location?.name ?? row.locationId;
        findings.push({
          type: 'waste_high',
          message: `Mermas elevadas en ${name}: ${Math.round(total)} unidades en los últimos 7 días. Revisar causas.`,
          priority: total >= WASTE_THRESHOLD_7D * 2 ? 'high' : 'medium',
          referenceType: 'location',
          referenceId: row.locationId,
          locationId: row.locationId,
        });
      }
    }

    // 2) Envíos con retraso (estimatedArrival vs receivedAt)
    const shipmentsReceived = await this.prisma.shipment.findMany({
      where: {
        status: { in: ['received', 'received_with_diff', 'closed', 'delivered'] },
        estimatedArrival: { not: null },
        receivedAt: { not: null },
      },
      select: {
        id: true,
        shipmentNumber: true,
        estimatedArrival: true,
        receivedAt: true,
        destinationId: true,
        destination: { select: { name: true } },
      },
    });

    for (const s of shipmentsReceived) {
      const est = s.estimatedArrival!.getTime();
      const real = s.receivedAt!.getTime();
      const delayMin = Math.round((real - est) / 60000);
      if (delayMin > DELAY_THRESHOLD_MIN) {
        findings.push({
          type: 'shipment_delay',
          message: `Envío ${s.shipmentNumber} llegó con ${delayMin} min de retraso (destino: ${s.destination?.name ?? '—'}).`,
          priority: delayMin > 60 ? 'high' : 'medium',
          referenceType: 'shipment',
          referenceId: s.id,
          locationId: s.destinationId,
        });
      }
    }

    // Crear Alert por cada hallazgo (evitar duplicados activos del mismo ref)
    let alertsCreated = 0;
    for (const f of findings) {
      const existing = await this.prisma.alert.findFirst({
        where: {
          referenceType: f.referenceType ?? undefined,
          referenceId: f.referenceId ?? undefined,
          type: f.type,
          status: 'active',
        },
      });
      if (existing) continue;

      await this.prisma.alert.create({
        data: {
          locationId: f.locationId ?? null,
          type: f.type,
          priority: f.priority,
          title: f.type === 'waste_high' ? 'Mermas elevadas' : 'Envío con retraso',
          message: f.message,
          referenceType: f.referenceType ?? null,
          referenceId: f.referenceId ?? null,
          status: 'active',
        },
      });
      alertsCreated++;
    }

    return {
      findings,
      alertsCreated,
    };
  }
}
