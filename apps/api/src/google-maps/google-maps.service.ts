import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio opcional para estimar duración de rutas con Google Directions API.
 * Si GOOGLE_MAPS_API_KEY no está definida, todos los métodos retornan null.
 */
@Injectable()
export class GoogleMapsService {
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
  }

  /**
   * Obtiene la duración estimada del trayecto en minutos (solo conducción).
   * @param originAddress Dirección de origen (texto o "lat,lng")
   * @param destinationAddress Dirección de destino (texto o "lat,lng")
   * @returns Duración en minutos, o null si no hay clave, error o sin resultados
   */
  async getRouteDurationInMinutes(
    originAddress: string,
    destinationAddress: string,
  ): Promise<number | null> {
    if (!this.apiKey?.trim()) {
      return null;
    }
    const origin = encodeURIComponent(originAddress.trim());
    const destination = encodeURIComponent(destinationAddress.trim());
    if (!origin || !destination) return null;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.routes?.length) return null;
      const leg = data.routes[0].legs?.[0];
      if (!leg?.duration?.value) return null;
      const seconds = Number(leg.duration.value);
      return Math.round(seconds / 60);
    } catch {
      return null;
    }
  }

  /**
   * Obtiene duración en minutos y polyline de la ruta (para guardar en Shipment).
   */
  async getRouteDetails(
    originAddress: string,
    destinationAddress: string,
  ): Promise<{ durationMin: number; polyline: string } | null> {
    if (!this.apiKey?.trim()) return null;
    const origin = encodeURIComponent(originAddress.trim());
    const destination = encodeURIComponent(destinationAddress.trim());
    if (!origin || !destination) return null;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.routes?.length) return null;
      const route = data.routes[0];
      const leg = route.legs?.[0];
      if (!leg?.duration?.value) return null;
      const seconds = Number(leg.duration.value);
      const durationMin = Math.round(seconds / 60);
      const polyline = route.overview_polyline?.points ?? null;
      return { durationMin, polyline: polyline || '' };
    } catch {
      return null;
    }
  }

  /**
   * Igual que getRouteDetails pero con departure_time=now para que Google devuelva
   * duration_in_traffic (considera tráfico en tiempo real). Usar al despachar envío.
   */
  async getRouteDetailsWithTraffic(
    originAddress: string,
    destinationAddress: string,
  ): Promise<{ durationMin: number; polyline: string } | null> {
    if (!this.apiKey?.trim()) return null;
    const origin = encodeURIComponent(originAddress.trim());
    const destination = encodeURIComponent(destinationAddress.trim());
    if (!origin || !destination) return null;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&departure_time=now&key=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.routes?.length) return null;
      const route = data.routes[0];
      const leg = route.legs?.[0];
      if (!leg?.duration?.value) return null;
      const seconds =
        leg.duration_in_traffic?.value != null
          ? Number(leg.duration_in_traffic.value)
          : Number(leg.duration.value);
      const durationMin = Math.round(seconds / 60);
      const polyline = route.overview_polyline?.points ?? null;
      return { durationMin, polyline: polyline || '' };
    } catch {
      return null;
    }
  }
}
