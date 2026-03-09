import { Controller, Get, Param } from '@nestjs/common';
import { ProductionService } from './production.service';

/**
 * Controlador público para consultar un lote por código (sin autenticación).
 * Usado cuando se escanea el QR del lote: devuelve toda la info para mostrar en pantalla.
 */
@Controller('batch')
export class BatchPublicController {
  constructor(private readonly productionService: ProductionService) {}

  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.productionService.findBatchByCodeForPublic(code);
  }
}
