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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../../generated/prisma';
import { WasteRecordsService } from './waste-records.service';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';

@Controller('waste-records')
@UseGuards(JwtAuthGuard)
export class WasteRecordsController {
  constructor(private readonly wasteRecordsService: WasteRecordsService) {}

  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('productId') productId?: string,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wasteRecordsService.findAll({
      locationId,
      productId,
      type,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('run-analysis')
  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE_MANAGER, Role.LOCATION_MANAGER, Role.ADMIN)
  runWasteAnalysis() {
    return this.wasteRecordsService.runWasteAnalysis();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.wasteRecordsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE_MANAGER, Role.LOCATION_MANAGER, Role.ADMIN)
  create(
    @Body() dto: CreateWasteRecordDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.wasteRecordsService.create(dto, user.id);
  }
}
