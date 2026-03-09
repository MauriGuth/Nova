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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../../generated/prisma';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { CreateGoodsReceiptItemDto } from './dto/create-goods-receipt-item.dto';
import { UpdateGoodsReceiptItemDto } from './dto/update-goods-receipt-item.dto';

@Controller('goods-receipts')
@UseGuards(JwtAuthGuard)
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.goodsReceiptsService.findAll({
      locationId,
      supplierId,
      status,
      method,
      dateFrom,
      dateTo,
      page,
      limit,
    });
  }

  @Get(':id/price-comparison')
  getPriceComparison(@Param('id') id: string) {
    return this.goodsReceiptsService.getPriceComparison(id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.goodsReceiptsService.findById(id);
  }

  @Post()
  create(
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.goodsReceiptsService.create(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGoodsReceiptDto) {
    return this.goodsReceiptsService.update(id, dto);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateGoodsReceiptItemDto,
  ) {
    return this.goodsReceiptsService.addItem(id, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateGoodsReceiptItemDto,
  ) {
    return this.goodsReceiptsService.updateItem(id, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.goodsReceiptsService.removeItem(id);
  }

  @Post('ocr-scan')
  @UseInterceptors(
    FileInterceptor('invoice', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `invoice-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|bmp|tiff)$/)) {
          return cb(
            new BadRequestException('Solo se permiten archivos de imagen'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  )
  async ocrScan(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se recibió ninguna imagen');
    }
    return this.goodsReceiptsService.processOcrScan(file.path, file.filename);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE_MANAGER, Role.ADMIN)
  confirm(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.goodsReceiptsService.confirm(id, userId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE_MANAGER, Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.goodsReceiptsService.cancel(id);
  }
}
