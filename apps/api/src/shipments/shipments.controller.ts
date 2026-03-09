import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../../generated/prisma';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ReceiveShipmentDto } from './dto/receive-shipment.dto';
import { UpdateShipmentItemDto } from './dto/update-shipment-item.dto';

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  findAll(
    @Query('originId') originId?: string,
    @Query('destinationId') destinationId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.shipmentsService.findAll({
      originId,
      destinationId,
      status,
      dateFrom,
      dateTo,
      page,
      limit,
    });
  }

  @Get('estimate-duration')
  getEstimateDuration(
    @Query('originId') originId?: string,
    @Query('destinationId') destinationId?: string,
  ) {
    return this.shipmentsService.getEstimateDuration(originId, destinationId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.shipmentsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shipmentsService.create(dto, userId);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateShipmentItemDto,
  ) {
    return this.shipmentsService.updateItem(id, itemId, dto);
  }

  @Post(':id/prepare')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  prepare(@Param('id') id: string) {
    return this.shipmentsService.prepare(id);
  }

  @Post(':id/dispatch')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  dispatch(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.shipmentsService.dispatch(id, userId);
  }

  @Post(':id/start-reception-control')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.LOCATION_MANAGER, Role.ADMIN)
  startReceptionControl(@Param('id') id: string) {
    return this.shipmentsService.startReceptionControl(id);
  }

  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.LOCATION_MANAGER, Role.ADMIN)
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shipmentsService.receive(id, dto, userId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.LOGISTICS, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.shipmentsService.cancel(id);
  }
}
