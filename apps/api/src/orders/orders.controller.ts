import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { CloseOrderDto } from './dto/close-order.dto';
import { UpdateOrderSplitDto } from './dto/update-order-split.dto';
import { ChangeOrderTableDto } from './dto/change-order-table.dto';
import { MoveOrderItemsDto } from './dto/move-order-items.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('waiterId') waiterId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAll({
      locationId,
      status,
      type,
      waiterId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('kitchen/:locationId')
  getKitchenOrders(@Param('locationId') locationId: string) {
    return this.ordersService.getKitchenOrders(locationId);
  }

  @Get('ready-items/:locationId')
  getReadyItems(@Param('locationId') locationId: string) {
    return this.ordersService.getReadyItems(locationId);
  }

  @Get('sales-by-week')
  getSalesByWeek(@Query('locationId') locationId?: string) {
    return this.ordersService.getSalesByWeek(locationId);
  }

  @Get('sales-by-day')
  getSalesByDay(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.ordersService.getSalesByDay({
      dateFrom: dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: dateTo || new Date().toISOString().slice(0, 10),
      locationId,
    });
  }

  @Get('sales-by-day-hour')
  getSalesByDayAndHour(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.ordersService.getSalesByDayAndHour({
      dateFrom: dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: dateTo || new Date().toISOString().slice(0, 10),
      locationId,
    });
  }

  @Get('sales-top-products')
  getTopProductsBySales(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('locationId') locationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getTopProductsBySales({
      dateFrom: dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: dateTo || new Date().toISOString().slice(0, 10),
      locationId,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get('sales-top-categories')
  getTopCategoriesBySales(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('locationId') locationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getTopCategoriesBySales({
      dateFrom: dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: dateTo || new Date().toISOString().slice(0, 10),
      locationId,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/move-items')
  @UseGuards(RolesGuard)
  @Roles(Role.CASHIER, Role.ADMIN)
  moveOrderItems(
    @Param('id') id: string,
    @Body() dto: MoveOrderItemsDto,
  ) {
    return this.ordersService.moveItemsToTable(
      id,
      dto.itemIds,
      dto.newTableId,
    );
  }

  @Patch(':id/change-table')
  @UseGuards(RolesGuard)
  @Roles(Role.CASHIER, Role.ADMIN)
  changeOrderTable(
    @Param('id') id: string,
    @Body() dto: ChangeOrderTableDto,
  ) {
    return this.ordersService.changeOrderTable(id, dto.newTableId);
  }

  @Patch(':id')
  updateSplit(
    @Param('id') id: string,
    @Body() dto: UpdateOrderSplitDto,
  ) {
    return this.ordersService.updateOrderSplit(id, dto);
  }

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.create(dto, userId);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateOrderItemDto,
  ) {
    return this.ordersService.addItem(id, dto);
  }

  @Patch('items/:id/status')
  updateItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.ordersService.updateItemStatus(id, dto);
  }

  @Patch('items/:id')
  updateOrderItem(
    @Param('id') id: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateOrderItem(id, dto);
  }

  @Delete('items/:id')
  removeOrderItem(@Param('id') id: string) {
    return this.ordersService.removeOrderItem(id);
  }

  @Post(':id/close')
  closeOrder(
    @Param('id') id: string,
    @Body() dto: CloseOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.closeOrder(id, dto, userId);
  }

  @Post(':id/cancel')
  cancelOrder(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }
}
