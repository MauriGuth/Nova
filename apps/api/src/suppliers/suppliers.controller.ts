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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  AddProductSupplierDto,
  UpdateProductSupplierDto,
} from './dto/add-product-supplier.dto';

const PRICE_LIST_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post('parse-price-list')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          PRICE_LIST_ACCEPT.includes(file.mimetype) ||
          /\.(xlsx|xls|pdf|jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(file.originalname);
        if (!ok) {
          return cb(
            new BadRequestException(
              'Formato no soportado. Usá imagen (JPG, PNG), PDF o Excel (.xlsx, .xls).',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async parsePriceList(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    return this.suppliersService.parsePriceListFile(
      file.buffer,
      file.mimetype,
      file.originalname || '',
    );
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.suppliersService.findAll({ search, isActive, page, limit });
  }

  @Get('price-comparison')
  getPriceComparison() {
    return this.suppliersService.getPriceComparison();
  }

  @Post('price-comparison-search')
  getPriceComparisonByProductSearch(@Body('query') query: string) {
    return this.suppliersService.getPriceComparisonByProductSearch(query || '');
  }

  @Get('price-comparison-by-rubro')
  getPriceComparisonByRubro(@Query('rubro') rubro: string) {
    return this.suppliersService.getPriceComparisonByRubro(rubro || '');
  }

  @Post('price-comparison-search-in-lists')
  getPriceComparisonBySearchInLists(@Body('query') query: string) {
    return this.suppliersService.getPriceComparisonBySearchInLists(query || '');
  }

  @Post(':id/price-lists')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          PRICE_LIST_ACCEPT.includes(file.mimetype) ||
          /\.(xlsx|xls|pdf|jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(file.originalname);
        if (!ok) {
          return cb(
            new BadRequestException(
              'Formato no soportado. Usá imagen (JPG, PNG), PDF o Excel (.xlsx, .xls).',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPriceList(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('skipExtraction') skipExtraction?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const skip = skipExtraction === 'true' || skipExtraction === '1';
    return this.suppliersService.uploadAndParsePriceList(
      id,
      file.buffer,
      file.mimetype,
      file.originalname || '',
      { skipExtraction: skip },
    );
  }

  @Get(':id/price-lists')
  getPriceLists(@Param('id') id: string) {
    return this.suppliersService.getPriceLists(id);
  }

  @Get(':id/products')
  getProducts(@Param('id') id: string) {
    return this.suppliersService.getProductsBySupplierId(id);
  }

  @Get(':id/price-history')
  getPriceHistory(
    @Param('id') id: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliersService.getPriceHistory(id, {
      productId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.suppliersService.delete(id);
  }

  @Post(':id/products')
  addProductSupplier(
    @Param('id') id: string,
    @Body() dto: AddProductSupplierDto,
  ) {
    return this.suppliersService.addProductSupplier(id, dto);
  }

  @Patch('product-links/:id')
  updateProductSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateProductSupplierDto,
  ) {
    return this.suppliersService.updateProductSupplier(id, dto);
  }

  @Delete('product-links/:id')
  removeProductSupplier(@Param('id') id: string) {
    return this.suppliersService.removeProductSupplier(id);
  }
}
