import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertsService.findAll({
      locationId,
      type,
      priority,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('count')
  getActiveCount(@Query('locationId') locationId?: string) {
    return this.alertsService.getActiveCount(locationId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.alertsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateAlertDto) {
    return this.alertsService.create(dto);
  }

  @Post(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.alertsService.markAsRead(id, userId);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }

  @Post(':id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.alertsService.dismiss(id);
  }

  @Post('check-stock')
  checkStockAlerts(@Query('locationId') locationId?: string) {
    return this.alertsService.checkStockAlerts(locationId);
  }
}
