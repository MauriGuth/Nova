import { Controller, Get, Param } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

/**
 * Controlador público para consultar un envío por número (sin autenticación).
 * Usado cuando se escanea el QR del envío: devuelve el detalle completo para mostrar en la página pública.
 */
@Controller('shipment')
export class ShipmentPublicController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get(':number')
  getByNumber(@Param('number') number: string) {
    return this.shipmentsService.findByShipmentNumber(number || '');
  }
}
