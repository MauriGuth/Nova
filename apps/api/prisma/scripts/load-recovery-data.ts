import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

type ProductCategory = 'PRODUCTO' | 'RECETA' | 'INSUMOS';

type ProductSeed = {
  name: string;
  category: ProductCategory;
  familia: string | null;
  agrupar: string | null;
  salePrice: number | null;
  stockPrices: {
    coffee: number | null;
    dorado: number | null;
    posada: number | null;
  };
  isProduced: boolean;
  isSellable: boolean;
  isIngredient: boolean;
  unit: string;
  source: string;
  _priority: number;
};

type SupplierSeed = {
  name: string;
  taxId: string | null;
  rubro: string | null;
};

type RecipeIngredientSeed = {
  productName: string;
  qtyPerYield: number;
  unit: string;
  notes?: string;
};

type RecipeSeed = {
  name: string;
  category: string | null;
  yieldQty: number;
  yieldUnit: string;
  productName: string;
  ingredients: RecipeIngredientSeed[];
  description?: string;
  source: string;
};

type ArticuloCarta = {
  nombre: string;
  precio_coffee_store: number | null;
  precio_dorado: number | null;
  precio_posada: number | null;
  tipo: string;
  familia: string;
  agrupar_carta_digital: string | null;
};

type ProductoIdeas = {
  descripcion: string;
  categoria: string;
  familia: string;
};

type DetalleProducto = {
  descripcion: string;
  categoria: string;
  familia: string;
  agrupar_carta_digital: string | null;
  proveedor: string | null;
  cuit: string | null;
};

type ProductoDorado = {
  descripcion: string;
  familia: string;
  categoria: string;
  etiqueta: string;
};

type RecetaBarraFile = {
  recetas_detalle: Array<{
    producto: string;
    familia_producto: string | null;
    insumo: string;
    cantidad: number;
    unidad: string;
    familia_insumo: string | null;
  }>;
};

type RecetaCocina = {
  nombre_plato: string;
  precios?: Record<string, number>;
  componentes_plato?: Array<{
    ingrediente: string;
    cantidad: number;
    unidad: string;
    es_receta: boolean;
  }>;
  componentes?: Array<{
    ingrediente: string;
    cantidad: number;
    unidad: string;
    tipo?: string;
    elaboracion?: string;
  }>;
  sub_recetas?: Array<{
    nombre: string;
    ingredientes: Array<{
      insumo: string;
      cantidad: number;
      unidad: string;
      area_elaboracion?: string;
    }>;
  }>;
  hoja?: string;
  archivo_origen?: string;
};

const DRY_RUN = process.env.LOAD_DRY_RUN === '1';
const ONLY_RECIPES = process.env.LOAD_ONLY_RECIPES === '1';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'sin-nombre';
}

function normalizeUnit(unit: string | null | undefined): string {
  const value = normalizeKey(unit || '');
  if (!value) return 'unidad';
  if (['UNIDAD', 'UNIDADES', 'UN', 'U'].includes(value)) return 'unidad';
  if (['KG', 'KGS', 'KILO', 'KILOS'].includes(value)) return 'kg';
  if (['GR', 'GRAMO', 'GRAMOS', 'G'].includes(value)) return 'g';
  if (['LT', 'LTS', 'LITRO', 'LITROS', 'L'].includes(value)) return 'lt';
  if (['ML', 'CC'].includes(value)) return 'ml';
  if (['PORCION', 'PORCIONES'].includes(value)) return 'porcion';
  if (['LOTE', 'LOTES'].includes(value)) return 'lote';
  return unit!.trim().toLowerCase();
}

function categoryFromRaw(value: string | null | undefined): ProductCategory {
  const normalized = normalizeKey(value || '');
  if (normalized.includes('INSUMO')) return 'INSUMOS';
  if (normalized.includes('RECETA')) return 'RECETA';
  return 'PRODUCTO';
}

function boolsForCategory(category: ProductCategory): Pick<ProductSeed, 'isSellable' | 'isIngredient' | 'isProduced'> {
  if (category === 'INSUMOS') {
    return { isSellable: false, isIngredient: true, isProduced: false };
  }
  if (category === 'RECETA') {
    return { isSellable: true, isIngredient: true, isProduced: true };
  }
  return { isSellable: true, isIngredient: true, isProduced: false };
}

function skuFromName(name: string, used: Set<string>): string {
  const base = normalizeKey(name).replace(/[^A-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'ART';
  let sku = base;
  let n = 1;
  while (used.has(sku)) {
    n += 1;
    sku = `${base}-${n}`;
  }
  used.add(sku);
  return sku;
}

function addIngredientUnique(list: RecipeIngredientSeed[], ingredient: RecipeIngredientSeed) {
  const key = `${normalizeKey(ingredient.productName)}|${ingredient.qtyPerYield}|${ingredient.unit}|${ingredient.notes || ''}`;
  const existing = new Set(list.map((item) => `${normalizeKey(item.productName)}|${item.qtyPerYield}|${item.unit}|${item.notes || ''}`));
  if (!existing.has(key)) list.push(ingredient);
}

function pickFirstNumeric(values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

async function main() {
  const baseDir = '/Users/mauriciohuentelaf/Downloads';
  const files = {
    articulos: path.join(baseDir, 'articulos_carta.json'),
    ideas: path.join(baseDir, 'productos_ideas.json'),
    detalle: path.join(baseDir, 'detalle_insumos_productos_recetas.json'),
    dorado: path.join(baseDir, 'productos_dorado.json'),
    barra: path.join(baseDir, 'recetas_bebidas_barra.json'),
    cocina: path.join(baseDir, 'recetas_cocina.json'),
    gastro2: path.join(baseDir, 'recetas_gastronomia_local_2.json'),
  };

  for (const filePath of Object.values(files)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`No existe el archivo requerido: ${filePath}`);
    }
  }

  const articulos = readJson<ArticuloCarta[]>(files.articulos);
  const ideas = readJson<ProductoIdeas[]>(files.ideas);
  const detalle = readJson<DetalleProducto[]>(files.detalle);
  const dorado = readJson<ProductoDorado[]>(files.dorado);
  const barra = readJson<RecetaBarraFile>(files.barra);
  const cocina = readJson<RecetaCocina[]>(files.cocina);
  const gastro2 = readJson<RecetaCocina[]>(files.gastro2);

  const productSeeds = new Map<string, ProductSeed>();
  const supplierSeeds = new Map<string, SupplierSeed>();
  const productSupplierLinks = new Map<string, { productKey: string; supplierKey: string }>();
  const recipeSeeds = new Map<string, RecipeSeed>();

  const upsertProductSeed = (input: {
    name: string;
    category?: string | null;
    familia?: string | null;
    agrupar?: string | null;
    salePrice?: number | null;
    stockPrices?: Partial<ProductSeed['stockPrices']>;
    isProduced?: boolean;
    isSellable?: boolean;
    isIngredient?: boolean;
    unit?: string | null;
    source: string;
    priority: number;
  }) => {
    const name = input.name.trim();
    if (!name) return;
    const key = normalizeKey(name);
    const category = categoryFromRaw(input.category || 'PRODUCTO');
    const current = productSeeds.get(key);
    const mergedStockPrices = {
      coffee: input.stockPrices?.coffee ?? current?.stockPrices.coffee ?? null,
      dorado: input.stockPrices?.dorado ?? current?.stockPrices.dorado ?? null,
      posada: input.stockPrices?.posada ?? current?.stockPrices.posada ?? null,
    };
    const baseBools = boolsForCategory(category);
    const next: ProductSeed = {
      name: current && current._priority > input.priority ? current.name : name,
      category: current && current._priority > input.priority ? current.category : category,
      familia: current?.familia ?? null,
      agrupar: current?.agrupar ?? null,
      salePrice: current?.salePrice ?? null,
      stockPrices: mergedStockPrices,
      isProduced: current?.isProduced ?? false,
      isSellable: current?.isSellable ?? baseBools.isSellable,
      isIngredient: current?.isIngredient ?? baseBools.isIngredient,
      unit: current?.unit ?? normalizeUnit(input.unit),
      source: current?.source ?? input.source,
      _priority: Math.max(current?._priority ?? 0, input.priority),
    };

    if (input.priority >= (current?._priority ?? 0)) {
      next.category = category;
      next.name = name;
      next.source = input.source;
      next.unit = normalizeUnit(input.unit || current?.unit || 'unidad');
    }

    if (input.familia !== undefined && trimOrNull(input.familia)) {
      next.familia = trimOrNull(input.familia);
    }
    if (input.agrupar !== undefined && trimOrNull(input.agrupar)) {
      next.agrupar = trimOrNull(input.agrupar);
    }
    if (typeof input.salePrice === 'number' && Number.isFinite(input.salePrice)) {
      next.salePrice = input.salePrice;
    } else if (next.salePrice == null) {
      next.salePrice = pickFirstNumeric([mergedStockPrices.coffee, mergedStockPrices.dorado, mergedStockPrices.posada]) ?? 0;
    }
    if (typeof input.isProduced === 'boolean') next.isProduced = next.isProduced || input.isProduced;
    if (typeof input.isSellable === 'boolean') next.isSellable = input.isSellable;
    if (typeof input.isIngredient === 'boolean') next.isIngredient = input.isIngredient;

    productSeeds.set(key, next);
  };

  const upsertRecipeSeed = (input: RecipeSeed) => {
    const name = input.name.trim();
    if (!name) return;
    const key = normalizeKey(name);
    const current = recipeSeeds.get(key);
    if (!current) {
      recipeSeeds.set(key, {
        ...input,
        ingredients: [...input.ingredients],
      });
      return;
    }
    current.category = current.category || input.category;
    current.description = current.description || input.description;
    for (const ingredient of input.ingredients) {
      addIngredientUnique(current.ingredients, ingredient);
    }
  };

  for (const row of articulos) {
    upsertProductSeed({
      name: row.nombre,
      category: row.tipo,
      familia: row.familia,
      agrupar: row.agrupar_carta_digital,
      salePrice: pickFirstNumeric([row.precio_coffee_store, row.precio_dorado, row.precio_posada]),
      stockPrices: {
        coffee: row.precio_coffee_store,
        dorado: row.precio_dorado,
        posada: row.precio_posada,
      },
      source: 'articulos_carta',
      priority: 100,
    });
  }

  for (const row of ideas) {
    upsertProductSeed({
      name: row.descripcion,
      category: row.categoria,
      familia: row.familia,
      source: 'productos_ideas',
      priority: 40,
    });
  }

  for (const row of detalle) {
    upsertProductSeed({
      name: row.descripcion,
      category: row.categoria,
      familia: row.familia,
      agrupar: row.agrupar_carta_digital,
      source: 'detalle_insumos_productos_recetas',
      priority: 80,
    });

    const supplierName = trimOrNull(row.proveedor);
    if (supplierName && normalizeKey(supplierName) !== 'RECETA CARGADA') {
      const supplierKey = trimOrNull(row.cuit) ? `tax:${trimOrNull(row.cuit)}` : `name:${normalizeKey(supplierName)}`;
      if (!supplierSeeds.has(supplierKey)) {
        supplierSeeds.set(supplierKey, {
          name: supplierName,
          taxId: trimOrNull(row.cuit),
          rubro: trimOrNull(row.familia),
        });
      }
      const productKey = normalizeKey(row.descripcion);
      productSupplierLinks.set(`${productKey}|${supplierKey}`, { productKey, supplierKey });
    }
  }

  for (const row of dorado) {
    upsertProductSeed({
      name: row.descripcion,
      category: row.categoria,
      familia: row.familia,
      agrupar: row.etiqueta,
      source: 'productos_dorado',
      priority: 60,
    });
  }

  const barraByProduct = new Map<string, RecetaBarraFile['recetas_detalle']>();
  for (const row of barra.recetas_detalle) {
    const key = normalizeKey(row.producto);
    const list = barraByProduct.get(key) ?? [];
    list.push(row);
    barraByProduct.set(key, list);

    upsertProductSeed({
      name: row.producto,
      category: 'RECETA',
      familia: row.familia_producto,
      isProduced: true,
      isSellable: true,
      isIngredient: true,
      source: 'recetas_bebidas_barra:producto',
      priority: 70,
    });
    upsertProductSeed({
      name: row.insumo,
      category: 'INSUMOS',
      familia: row.familia_insumo,
      isProduced: false,
      isSellable: false,
      isIngredient: true,
      unit: row.unidad,
      source: 'recetas_bebidas_barra:insumo',
      priority: 20,
    });
  }

  for (const rows of barraByProduct.values()) {
    const first = rows[0];
    upsertRecipeSeed({
      name: first.producto,
      category: trimOrNull(first.familia_producto),
      yieldQty: 1,
      yieldUnit: 'unidad',
      productName: first.producto,
      source: 'recetas_bebidas_barra',
      description: 'Receta importada desde bebidas/barra',
      ingredients: rows.map((row, idx) => ({
        productName: row.insumo,
        qtyPerYield: Number(row.cantidad) || 0,
        unit: normalizeUnit(row.unidad),
        notes: row.familia_insumo ? `Familia insumo: ${row.familia_insumo}` : `Orden ${idx + 1}`,
      })),
    });
  }

  const importStructuredRecipeFile = (rows: RecetaCocina[], source: string) => {
    for (const row of rows) {
      const finalName = trimOrNull(row.nombre_plato);
      if (!finalName) continue;

      const price = (() => {
        const values = Object.values(row.precios || {}).filter((v) => typeof v === 'number' && Number.isFinite(v));
        return values.length ? values[0] : null;
      })();

      upsertProductSeed({
        name: finalName,
        category: 'RECETA',
        familia: trimOrNull(row.hoja),
        salePrice: price,
        isProduced: true,
        isSellable: true,
        isIngredient: true,
        source: `${source}:producto`,
        priority: 75,
      });

      const finalIngredients: RecipeIngredientSeed[] = [];

      for (const component of row.componentes_plato || []) {
        upsertProductSeed({
          name: component.ingrediente,
          category: component.es_receta ? 'RECETA' : 'INSUMOS',
          isProduced: component.es_receta,
          isSellable: component.es_receta,
          isIngredient: true,
          unit: component.unidad,
          source: `${source}:componente_plato`,
          priority: 30,
        });
        addIngredientUnique(finalIngredients, {
          productName: component.ingrediente,
          qtyPerYield: Number(component.cantidad) || 0,
          unit: normalizeUnit(component.unidad),
        });
      }

      for (const component of row.componentes || []) {
        const componentCategory = normalizeKey(component.tipo || '').includes('RECETA') ? 'RECETA' : 'INSUMOS';
        upsertProductSeed({
          name: component.ingrediente,
          category: componentCategory,
          isProduced: componentCategory === 'RECETA',
          isSellable: componentCategory === 'RECETA',
          isIngredient: true,
          unit: component.unidad,
          source: `${source}:componente`,
          priority: 30,
        });
        addIngredientUnique(finalIngredients, {
          productName: component.ingrediente,
          qtyPerYield: Number(component.cantidad) || 0,
          unit: normalizeUnit(component.unidad),
          notes: trimOrNull(component.elaboracion) || undefined,
        });
      }

      for (const subReceta of row.sub_recetas || []) {
        const subName = trimOrNull(subReceta.nombre);
        if (!subName) continue;
        upsertProductSeed({
          name: subName,
          category: 'RECETA',
          isProduced: true,
          isSellable: false,
          isIngredient: true,
          source: `${source}:subreceta`,
          priority: 55,
        });

        const subIngredients: RecipeIngredientSeed[] = [];
        for (const ingredient of subReceta.ingredientes || []) {
          upsertProductSeed({
            name: ingredient.insumo,
            category: 'INSUMOS',
            isProduced: false,
            isSellable: false,
            isIngredient: true,
            unit: ingredient.unidad,
            source: `${source}:subreceta_insumo`,
            priority: 25,
          });
          addIngredientUnique(subIngredients, {
            productName: ingredient.insumo,
            qtyPerYield: Number(ingredient.cantidad) || 0,
            unit: normalizeUnit(ingredient.unidad),
            notes: trimOrNull(ingredient.area_elaboracion) || undefined,
          });
        }
        upsertRecipeSeed({
          name: subName,
          category: trimOrNull(row.hoja),
          yieldQty: 1,
          yieldUnit: 'lote',
          productName: subName,
          source,
          description: `Subreceta importada desde ${source}${row.hoja ? ` / ${row.hoja}` : ''}`,
          ingredients: subIngredients,
        });
      }

      upsertRecipeSeed({
        name: finalName,
        category: trimOrNull(row.hoja),
        yieldQty: 1,
        yieldUnit: 'unidad',
        productName: finalName,
        source,
        description: `Receta importada desde ${source}${row.hoja ? ` / ${row.hoja}` : ''}`,
        ingredients: finalIngredients,
      });
    }
  };

  importStructuredRecipeFile(cocina, 'recetas_cocina');
  importStructuredRecipeFile(gastro2, 'recetas_gastronomia_local_2');

  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const recipeAuthor =
    existingUsers.find((user) => user.role === 'ADMIN') ||
    existingUsers[0];
  if (!recipeAuthor) {
    throw new Error('No se encontró ningún usuario para asignar como creador de las recetas.');
  }

  const categoriesToEnsure = new Map<string, { slug: string; name: string }>();
  for (const seed of productSeeds.values()) {
    const categorySlug = `tipo-${slug(seed.category)}`;
    categoriesToEnsure.set(`tipo:${seed.category}`, { slug: categorySlug, name: `Tipo: ${seed.category}` });
    if (seed.familia) {
      categoriesToEnsure.set(`familia:${seed.familia}`, {
        slug: `familia-${slug(seed.familia)}`,
        name: `Familia: ${seed.familia}`,
      });
    }
    if (seed.agrupar) {
      categoriesToEnsure.set(`agrupar:${seed.agrupar}`, {
        slug: `agrupar-${slug(seed.agrupar)}`,
        name: `Agrupar: ${seed.agrupar}`,
      });
    }
  }

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Solo recetas:', ONLY_RECIPES ? 'SI' : 'NO');
  console.log('Productos a consolidar:', productSeeds.size);
  console.log('Recetas a consolidar:', recipeSeeds.size);
  console.log('Proveedores a consolidar:', supplierSeeds.size);
  console.log('Vínculos producto-proveedor:', productSupplierLinks.size);
  console.log('Categorías a asegurar:', categoriesToEnsure.size);

  if (DRY_RUN) {
    return;
  }

  const existingProducts = await prisma.product.findMany({
    select: { id: true, name: true, sku: true },
  });
  const existingProductByName = new Map(existingProducts.map((item) => [normalizeKey(item.name), item]));
  const usedSkus = new Set(existingProducts.map((item) => item.sku));

  const categories = new Map<string, string>();
  for (const item of categoriesToEnsure.values()) {
    let category = await prisma.category.findUnique({ where: { slug: item.slug } });
    if (!category) {
      category = await prisma.category.create({
        data: { name: item.name, slug: item.slug, isActive: true },
      });
    } else if (category.name !== item.name || category.isActive === false) {
      category = await prisma.category.update({
        where: { id: category.id },
        data: { name: item.name, isActive: true },
      });
    }
    categories.set(item.slug, category.id);
  }

  const productIdByKey = new Map<string, string>();
  let createdProducts = 0;
  let updatedProducts = 0;
  let createdSuppliers = 0;
  let updatedSuppliers = 0;
  let productSupplierUpserts = 0;
  let stockUpserts = 0;

  if (!ONLY_RECIPES) {
    const orderedProducts = [...productSeeds.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'es', { sensitivity: 'base' }));
    for (const [key, seed] of orderedProducts) {
      const categoryId = categories.get(`tipo-${slug(seed.category)}`);
      if (!categoryId) throw new Error(`No se encontró categoryId para ${seed.category}`);

      const payload = {
        name: seed.name,
        categoryId,
        familia: seed.familia,
        unit: seed.unit || 'unidad',
        salePrice: seed.salePrice ?? 0,
        isSellable: seed.isSellable,
        isIngredient: seed.isIngredient,
        isProduced: seed.isProduced,
        isActive: true,
      };

      const existing = existingProductByName.get(key);
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: payload,
        });
        productIdByKey.set(key, existing.id);
        updatedProducts += 1;
      } else {
        const created = await prisma.product.create({
          data: {
            sku: skuFromName(seed.name, usedSkus),
            ...payload,
          },
        });
        existingProductByName.set(key, { id: created.id, name: created.name, sku: created.sku });
        productIdByKey.set(key, created.id);
        createdProducts += 1;
      }
    }

    const existingSuppliers = await prisma.supplier.findMany({
      select: { id: true, name: true, taxId: true },
    });
    const existingSupplierByTaxId = new Map(
      existingSuppliers.filter((item) => item.taxId).map((item) => [item.taxId!, item]),
    );
    const existingSupplierByName = new Map(existingSuppliers.map((item) => [normalizeKey(item.name), item]));
    const supplierIdByKey = new Map<string, string>();

    for (const [supplierKey, seed] of supplierSeeds.entries()) {
      const existing =
        (seed.taxId ? existingSupplierByTaxId.get(seed.taxId) : undefined) ||
        existingSupplierByName.get(normalizeKey(seed.name));

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            name: seed.name,
            taxId: seed.taxId,
            rubro: seed.rubro,
            isActive: true,
          },
        });
        supplierIdByKey.set(supplierKey, existing.id);
        updatedSuppliers += 1;
      } else {
        const created = await prisma.supplier.create({
          data: {
            name: seed.name,
            taxId: seed.taxId,
            rubro: seed.rubro,
            isActive: true,
          },
        });
        supplierIdByKey.set(supplierKey, created.id);
        createdSuppliers += 1;
      }
    }

    for (const link of productSupplierLinks.values()) {
      const productId = productIdByKey.get(link.productKey);
      const supplierId = supplierIdByKey.get(link.supplierKey);
      if (!productId || !supplierId) continue;
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId,
            supplierId,
          },
        },
        create: {
          productId,
          supplierId,
          isPreferred: true,
        },
        update: {
          isPreferred: true,
        },
      });
      productSupplierUpserts += 1;
    }

    const activeLocations = await prisma.location.findMany({ where: { isActive: true } });
    const cafes = activeLocations.filter((item) => item.type === 'CAFE');
    const dorados = activeLocations.filter(
      (item) => item.name.toLowerCase().includes('dorado') || item.slug.toLowerCase().includes('dorado'),
    );
    const posadas = activeLocations.filter(
      (item) =>
        item.name.toLowerCase().includes('posada') ||
        item.slug.toLowerCase().includes('posada') ||
        item.name.toLowerCase().includes('dinosaurio') ||
        item.slug.toLowerCase().includes('dinosaurio'),
    );

    for (const [key, seed] of productSeeds.entries()) {
      const productId = productIdByKey.get(key);
      if (!productId) continue;
      if (seed.stockPrices.coffee != null) {
        for (const location of cafes) {
          await prisma.stockLevel.upsert({
            where: {
              productId_locationId: {
                productId,
                locationId: location.id,
              },
            },
            create: {
              productId,
              locationId: location.id,
              quantity: 0,
              minQuantity: 0,
              salePrice: seed.stockPrices.coffee,
            },
            update: {
              salePrice: seed.stockPrices.coffee,
            },
          });
          stockUpserts += 1;
        }
      }
      if (seed.stockPrices.dorado != null) {
        for (const location of dorados) {
          await prisma.stockLevel.upsert({
            where: {
              productId_locationId: {
                productId,
                locationId: location.id,
              },
            },
            create: {
              productId,
              locationId: location.id,
              quantity: 0,
              minQuantity: 0,
              salePrice: seed.stockPrices.dorado,
            },
            update: {
              salePrice: seed.stockPrices.dorado,
            },
          });
          stockUpserts += 1;
        }
      }
      if (seed.stockPrices.posada != null) {
        for (const location of posadas) {
          await prisma.stockLevel.upsert({
            where: {
              productId_locationId: {
                productId,
                locationId: location.id,
              },
            },
            create: {
              productId,
              locationId: location.id,
              quantity: 0,
              minQuantity: 0,
              salePrice: seed.stockPrices.posada,
            },
            update: {
              salePrice: seed.stockPrices.posada,
            },
          });
          stockUpserts += 1;
        }
      }
    }
  } else {
    for (const [key, existing] of existingProductByName.entries()) {
      productIdByKey.set(key, existing.id);
    }
  }

  const existingRecipes = await prisma.recipe.findMany({
    select: { id: true, name: true },
  });
  const existingRecipeByName = new Map(existingRecipes.map((item) => [normalizeKey(item.name), item]));

  let createdRecipes = 0;
  let updatedRecipes = 0;
  const orderedRecipes = [...recipeSeeds.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'es', { sensitivity: 'base' }));
  for (const [key, recipe] of orderedRecipes) {
    const productId = productIdByKey.get(normalizeKey(recipe.productName));
    if (!productId) continue;

    const ingredients = recipe.ingredients
      .map((ingredient, index) => {
        const ingredientProductId = productIdByKey.get(normalizeKey(ingredient.productName));
        if (!ingredientProductId) return null;
        return {
          productId: ingredientProductId,
          qtyPerYield: ingredient.qtyPerYield,
          unit: ingredient.unit,
          notes: ingredient.notes,
          sortOrder: index,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const createData = {
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      yieldQty: recipe.yieldQty,
      yieldUnit: recipe.yieldUnit,
      productId,
      isActive: true,
      ingredients: {
        create: ingredients,
      },
    };

    const updateData = {
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      yieldQty: recipe.yieldQty,
      yieldUnit: recipe.yieldUnit,
      productId,
      isActive: true,
      ingredients: {
        deleteMany: {},
        create: ingredients,
      },
    };

    const existing = existingRecipeByName.get(key);
    if (existing) {
      await prisma.recipe.update({
        where: { id: existing.id },
        data: updateData,
      });
      updatedRecipes += 1;
    } else {
      await prisma.recipe.create({
        data: {
          ...createData,
          createdById: recipeAuthor.id,
        },
      });
      createdRecipes += 1;
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isProduced: true },
    });
  }

  console.log('\n✅ Carga finalizada');
  console.log('Productos creados:', createdProducts);
  console.log('Productos actualizados:', updatedProducts);
  console.log('Proveedores creados:', createdSuppliers);
  console.log('Proveedores actualizados:', updatedSuppliers);
  console.log('Vínculos producto-proveedor:', productSupplierUpserts);
  console.log('Stock upserts:', stockUpserts);
  console.log('Recetas creadas:', createdRecipes);
  console.log('Recetas actualizadas:', updatedRecipes);
}

main()
  .catch((error) => {
    console.error('❌ Error en la carga de recuperación:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
