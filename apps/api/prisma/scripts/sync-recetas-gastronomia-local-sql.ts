import 'dotenv/config';
import * as fs from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

type ProductCategory = 'RECETA' | 'INSUMOS';

type RecipeIngredientSeed = {
  productName: string;
  qtyPerYield: number;
  unit: string;
  notes?: string;
  category: ProductCategory;
};

type RecipeSeed = {
  name: string;
  category: string;
  ingredients: RecipeIngredientSeed[];
  source: 'final' | 'sub';
};

type ExistingRecipe = {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
  createdById: string;
  _count: { ingredients: number };
};

const SOURCE_FILE =
  process.env.GASTRO_SQL_PATH || '/Users/mauriciohuentelaf/Downloads/recetas_gastronomia_local.sql';
const DRY_RUN = process.env.DRY_RUN === '1';

const RECIPE_NAME_OVERRIDES = new Map<string, string>([
  ['OMELLETE ESPINACA -KETO', 'OMELETTE ESPINACA - KETO'],
  ['DESA. AMERICANO ( HUE-PANC-SALCH-TOST)', 'DESA. AMERICANO (HUE-PANC-SALCH-TOST)'],
  ['PLATO -DORADO', 'PLATO - DORADO'],
]);

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function canonicalName(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  return RECIPE_NAME_OVERRIDES.get(trimmed) ?? trimmed;
}

function compositeKey(name: string, category: string | null | undefined): string {
  return `${normalizeKey(name)}||${normalizeKey(category || '')}`;
}

function unquote(value: string): string | null {
  if (value === 'NULL') return null;
  return value.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'");
}

function normalizeUnit(unit: string | null | undefined): string {
  const value = normalizeKey(unit || '');
  if (!value) return 'unidad';
  if (['UNIDAD', 'UNIDADES', 'UN', 'U'].includes(value)) return 'unidad';
  if (['KG', 'KGS', 'KILO', 'KILOS'].includes(value)) return 'kg';
  if (['GR', 'GRAMO', 'GRAMOS', 'G'].includes(value)) return 'g';
  if (['LT', 'LTS', 'LITRO', 'LITROS', 'L'].includes(value)) return 'lt';
  if (['ML', 'CC'].includes(value)) return 'ml';
  return unit?.trim().toLowerCase() || 'unidad';
}

function categoryFromRaw(value: string | null | undefined): ProductCategory {
  return normalizeKey(value || '').includes('RECETA') ? 'RECETA' : 'INSUMOS';
}

function skuFromName(name: string, usedSkus: Set<string>): string {
  const base =
    normalizeKey(name)
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'RECETA';

  let candidate = base;
  let suffix = 1;
  while (usedSkus.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  usedSkus.add(candidate);
  return candidate;
}

function dedupeIngredients(ingredients: RecipeIngredientSeed[]): RecipeIngredientSeed[] {
  const seen = new Set<string>();
  const output: RecipeIngredientSeed[] = [];

  for (const ingredient of ingredients) {
    const key = [
      normalizeKey(ingredient.productName),
      ingredient.qtyPerYield,
      ingredient.unit,
      normalizeKey(ingredient.notes || ''),
      ingredient.category,
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(ingredient);
  }

  return output;
}

function parseSqlSeeds(sql: string) {
  const componentRe =
    /INSERT INTO receta_gastro_componente \(plato_nombre, hoja, ingrediente, cantidad, unidad, tipo, elaboracion\) VALUES \('((?:''|[^'])*)', '((?:''|[^'])*)', '((?:''|[^'])*)', (NULL|[-0-9.]+), (NULL|'(?:''|[^'])*'), (NULL|'(?:''|[^'])*'), (NULL|'(?:''|[^'])*')\);/g;
  const subRe =
    /INSERT INTO receta_gastro_subreceta_ingrediente \(plato_nombre, hoja, sub_receta, insumo, cantidad, unidad, tipo, area_elaboracion\) VALUES \('((?:''|[^'])*)', '((?:''|[^'])*)', '((?:''|[^'])*)', '((?:''|[^'])*)', (NULL|[-0-9.]+), (NULL|'(?:''|[^'])*'), (NULL|'(?:''|[^'])*'), (NULL|'(?:''|[^'])*')\);/g;

  const finalSeeds = new Map<string, RecipeSeed>();
  const subSeeds = new Map<string, RecipeSeed>();
  let match: RegExpExecArray | null;

  while ((match = componentRe.exec(sql))) {
    const name = canonicalName(unquote(`'${match[1]}'`));
    const category = canonicalName(unquote(`'${match[2]}'`)) || 'Sin hoja';
    const ingredientName = canonicalName(unquote(`'${match[3]}'`));
    const qty = match[4] === 'NULL' ? null : Number(match[4]);

    if (!name || !ingredientName || qty === null || !Number.isFinite(qty)) continue;

    const key = compositeKey(name, category);
    const seed = finalSeeds.get(key) || {
      name,
      category,
      ingredients: [],
      source: 'final' as const,
    };

    seed.ingredients.push({
      productName: ingredientName,
      qtyPerYield: qty,
      unit: normalizeUnit(unquote(match[5])),
      notes: unquote(match[7]) || undefined,
      category: categoryFromRaw(unquote(match[6])),
    });

    finalSeeds.set(key, seed);
  }

  while ((match = subRe.exec(sql))) {
    const name = canonicalName(unquote(`'${match[3]}'`));
    const category = canonicalName(unquote(`'${match[2]}'`)) || 'Sin hoja';
    const ingredientName = canonicalName(unquote(`'${match[4]}'`));
    const qty = match[5] === 'NULL' ? null : Number(match[5]);

    if (!name || !ingredientName || qty === null || !Number.isFinite(qty)) continue;

    const key = compositeKey(name, category);
    const seed = subSeeds.get(key) || {
      name,
      category,
      ingredients: [],
      source: 'sub' as const,
    };

    seed.ingredients.push({
      productName: ingredientName,
      qtyPerYield: qty,
      unit: normalizeUnit(unquote(match[6])),
      notes: unquote(match[8]) || undefined,
      category: categoryFromRaw(unquote(match[7])),
    });

    subSeeds.set(key, seed);
  }

  for (const seed of finalSeeds.values()) {
    seed.ingredients = dedupeIngredients(seed.ingredients);
  }

  for (const seed of subSeeds.values()) {
    seed.ingredients = dedupeIngredients(seed.ingredients);
  }

  return { finalSeeds, subSeeds };
}

async function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`No existe el archivo fuente: ${SOURCE_FILE}`);
  }

  const sql = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const { finalSeeds, subSeeds } = parseSqlSeeds(sql);
  const selectedSeeds = new Map<string, RecipeSeed>();

  for (const [key, seed] of finalSeeds.entries()) {
    selectedSeeds.set(key, seed);
  }

  for (const [key, seed] of subSeeds.entries()) {
    if (!selectedSeeds.has(key)) {
      selectedSeeds.set(key, seed);
    }
  }

  const [recipeCategory, ingredientCategory, users, existingProducts, existingRecipes] = await Promise.all([
    prisma.category.findFirst({ where: { slug: 'tipo-receta' }, select: { id: true } }),
    prisma.category.findFirst({ where: { slug: 'tipo-insumos' }, select: { id: true } }),
    prisma.user.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        categoryId: true,
        isSellable: true,
        isIngredient: true,
        isProduced: true,
      },
    }),
    prisma.recipe.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        isActive: true,
        createdById: true,
        updatedAt: true,
        _count: { select: { ingredients: true } },
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    }),
  ]);

  if (!recipeCategory || !ingredientCategory) {
    throw new Error('Faltan las categorías base `tipo-receta` o `tipo-insumos`.');
  }

  if (users.length === 0) {
    throw new Error('No hay usuarios creados para asignar `createdById` a las recetas.');
  }

  const systemUserId = users[0].id;
  const usedSkus = new Set(existingProducts.map((item) => item.sku));
  const productByName = new Map(existingProducts.map((item) => [normalizeKey(item.name), item]));
  const recipeByComposite = new Map<string, ExistingRecipe>();

  for (const recipe of existingRecipes) {
    const key = compositeKey(recipe.name, recipe.category);
    if (!recipeByComposite.has(key)) {
      recipeByComposite.set(key, recipe);
    }
  }

  let dryProductId = 0;
  const counters = {
    createdProducts: 0,
    updatedProducts: 0,
    createdRecipes: 0,
    updatedRecipes: 0,
    reactivatedRecipes: 0,
    finalRecipes: finalSeeds.size,
    subRecipesRecovered: 0,
  };

  const ensureProduct = async (name: string, category: ProductCategory, unit: string) => {
    const key = normalizeKey(name);
    const existing = productByName.get(key);
    const desiredCategoryId = category === 'RECETA' ? recipeCategory.id : ingredientCategory.id;
    const desiredFlags =
      category === 'RECETA'
        ? { isSellable: true, isIngredient: true, isProduced: true }
        : { isSellable: false, isIngredient: true, isProduced: false };

    if (existing) {
      const needsPromotion =
        category === 'RECETA' &&
        (existing.categoryId !== desiredCategoryId ||
          !existing.isSellable ||
          !existing.isIngredient ||
          !existing.isProduced);

      if (needsPromotion && !DRY_RUN) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            categoryId: desiredCategoryId,
            unit: existing.unit || unit,
            ...desiredFlags,
          },
        });
      }

      if (needsPromotion) {
        counters.updatedProducts += 1;
        const promoted = {
          ...existing,
          categoryId: desiredCategoryId,
          isSellable: desiredFlags.isSellable,
          isIngredient: desiredFlags.isIngredient,
          isProduced: desiredFlags.isProduced,
        };
        productByName.set(key, promoted);
        return promoted;
      }

      return existing;
    }

    const payload = {
      sku: skuFromName(name, usedSkus),
      name,
      categoryId: desiredCategoryId,
      unit,
      ...desiredFlags,
      isActive: true,
      avgCost: 0,
      lastCost: 0,
      salePrice: 0,
    };

    counters.createdProducts += 1;

    if (DRY_RUN) {
      const created = { id: `dry-product-${++dryProductId}`, ...payload };
      productByName.set(key, created);
      return created;
    }

    const created = await prisma.product.create({ data: payload });
    productByName.set(key, created);
    return created;
  };

  for (const [key, recipeSeed] of selectedSeeds.entries()) {
    const recipeProduct = await ensureProduct(recipeSeed.name, 'RECETA', 'unidad');

    const ingredients: Array<{
      productId: string;
      qtyPerYield: number;
      unit: string;
      notes?: string;
      sortOrder: number;
    }> = [];

    for (let index = 0; index < recipeSeed.ingredients.length; index += 1) {
      const ingredient = recipeSeed.ingredients[index];
      const product = await ensureProduct(ingredient.productName, ingredient.category, ingredient.unit);
      ingredients.push({
        productId: product.id,
        qtyPerYield: ingredient.qtyPerYield,
        unit: ingredient.unit,
        notes: ingredient.notes,
        sortOrder: index,
      });
    }

    const existingRecipe = recipeByComposite.get(key);
    const baseData = {
      name: recipeSeed.name,
      description: 'Sincronizada desde recetas_gastronomia_local.sql',
      category: recipeSeed.category,
      yieldQty: 1,
      yieldUnit: 'unidad',
      productId: recipeProduct.id,
      isActive: true,
    };

    if (!existingRecipe) {
      counters.createdRecipes += 1;
      if (recipeSeed.source === 'sub') counters.subRecipesRecovered += 1;

      if (!DRY_RUN) {
        const created = await prisma.recipe.create({
          data: {
            ...baseData,
            createdById: systemUserId,
            ingredients: { create: ingredients },
          },
          select: {
            id: true,
            name: true,
            category: true,
            isActive: true,
            createdById: true,
            _count: { select: { ingredients: true } },
          },
        });
        recipeByComposite.set(key, created);
      }

      continue;
    }

    counters.updatedRecipes += 1;
    if (!existingRecipe.isActive || existingRecipe._count.ingredients === 0) {
      counters.reactivatedRecipes += 1;
      if (recipeSeed.source === 'sub') counters.subRecipesRecovered += 1;
    }

    if (!DRY_RUN) {
      await prisma.recipe.update({
        where: { id: existingRecipe.id },
        data: {
          ...baseData,
          createdById: existingRecipe.createdById || systemUserId,
          ingredients: {
            deleteMany: {},
            create: ingredients,
          },
        },
      });
    }
  }

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Archivo analizado:', SOURCE_FILE);
  console.log('Recetas finales detectadas:', finalSeeds.size);
  console.log('Subrecetas detectadas:', subSeeds.size);
  console.log('Recetas seleccionadas para sincronizar:', selectedSeeds.size);
  console.log('Productos creados:', counters.createdProducts);
  console.log('Productos promovidos a receta:', counters.updatedProducts);
  console.log('Recetas creadas:', counters.createdRecipes);
  console.log('Recetas actualizadas:', counters.updatedRecipes);
  console.log('Recetas reactivadas/completadas:', counters.reactivatedRecipes);
  console.log('Subrecetas recuperadas:', counters.subRecipesRecovered);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
