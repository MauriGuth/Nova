import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StockReconciliationsService } from './stock-reconciliations.service';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { SubmitReconciliationDto } from './dto/submit-reconciliation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('stock-reconciliations')
@UseGuards(JwtAuthGuard)
export class StockReconciliationsController {
  constructor(
    private readonly stockReconciliationsService: StockReconciliationsService,
  ) {}

  @Get('products-for-count')
  getProductsForCount(
    @Query('locationId') locationId: string,
    @Query('shiftLabel') shiftLabel?: string,
  ) {
    return this.stockReconciliationsService.getProductsForCount(locationId, shiftLabel);
  }

  @Post('draft')
  getOrCreateDraft(
    @Body() body: { locationId: string; shiftLabel?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.stockReconciliationsService.getOrCreateDraft(
      body.locationId,
      user.id,
      body.shiftLabel,
    );
  }

  @Post()
  create(
    @Body() dto: CreateReconciliationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.stockReconciliationsService.create(dto, user.id);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitReconciliationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.stockReconciliationsService.submit(id, dto, user.id);
  }

  @Get()
  async findAll(
    @Query('locationId') locationId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('afternoonSubmittedToday') afternoonSubmittedToday?: string,
  ) {
    if (afternoonSubmittedToday !== undefined && afternoonSubmittedToday !== '' && locationId) {
      return this.stockReconciliationsService.hasAfternoonSubmittedToday(locationId);
    }
    return this.stockReconciliationsService.findAll({
      locationId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockReconciliationsService.findOne(id);
  }
}
