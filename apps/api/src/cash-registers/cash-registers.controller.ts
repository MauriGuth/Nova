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
import { CashRegistersService } from './cash-registers.service';
import { OpenRegisterDto } from './dto/open-register.dto';
import { CloseRegisterDto } from './dto/close-register.dto';

@Controller('cash-registers')
@UseGuards(JwtAuthGuard)
export class CashRegistersController {
  constructor(
    private readonly cashRegistersService: CashRegistersService,
  ) {}

  @Get()
  findAll(@Query('locationId') locationId: string) {
    return this.cashRegistersService.findAll(locationId);
  }

  @Get('current/:locationId')
  getCurrentOpen(@Param('locationId') locationId: string) {
    return this.cashRegistersService.getCurrentOpen(locationId);
  }

  @Get('reports/:locationId')
  getReport(
    @Param('locationId') locationId: string,
    @Query('type') type: 'daily' | 'weekly' | 'monthly',
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.cashRegistersService.getReport(
      locationId,
      type,
      dateFrom,
      dateTo,
    );
  }

  @Get(':id/shift-metrics')
  getShiftMetrics(@Param('id') id: string) {
    return this.cashRegistersService.getShiftMetrics(id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.cashRegistersService.findById(id);
  }

  @Post('open')
  openRegister(
    @Body() dto: OpenRegisterDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashRegistersService.openRegister(dto, userId);
  }

  @Post(':id/close')
  closeRegister(
    @Param('id') id: string,
    @Body() dto: CloseRegisterDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashRegistersService.closeRegister(id, dto, userId);
  }
}
