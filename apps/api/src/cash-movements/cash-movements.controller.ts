import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CashMovementsService } from './cash-movements.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Controller('cash-movements')
@UseGuards(JwtAuthGuard)
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @Get()
  findAll(
    @Query('locationId') locationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.cashMovementsService.findAll(
      locationId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('by-day')
  getByDay(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.cashMovementsService.getByDay({
      dateFrom,
      dateTo,
      locationId: locationId || undefined,
    });
  }

  @Post()
  create(
    @Body() dto: CreateCashMovementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashMovementsService.create(dto, userId);
  }
}
