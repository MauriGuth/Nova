import 'dotenv/config';
import * as fs from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

type RawRecipeRow = {
  nombre_plato: string;
  precios?: Record<string, number>;
  componentes?: Array<{
    ingrediente: string;
    cantidad: number;
    unidad: string;
    tipo?: string;
    elaboracion?: string | null;
  }>;
  hoja?: string | null;
};

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
  category: string | null;
  ingredients: RecipeIngredientSeed[];
};

const SOURCE_FILE =
  process.env.GASTRO2_JSON_PATH || '/Users/mauriciohuentelaf/Downloads/recetas_gastronomia_local_2.json';
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

function normalizeUnit(unit: string | null | undefined): string {
  const value = normalizeKey(unit || '');
  if (!value) return 'unidad';
  if (['UNIDAD', 'UNIDADES', 'UN', 'U'].includes(value)) return 'unidad';
  if (['KG', 'KGS', 'KILO', 'KILOS'].includes(value)) return 'kg';
  if (['GR', 'GRAMO', 'GRAMOS', 'G'].includes(value)) return 'g';
  if (['LT', 'LTS', 'LITRO', 'LITROS', 'L'].includes(value)) return 'lt';
  if (['ML', 'CC'].includes(value)) return 'ml';
  return unit!.trim().toLowerCase();
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

function buildRecipeSeeds(rows: RawRecipeRow[]) {
  const recipes = new Map<string, RecipeSeed>();
  const unresolved = new Map<string, { name: string; reason: string; sheet: string | null }>();

  for (const row of rows) {
    const name = canonicalName(row.nombre_plato);
    if (!name) continue;

    const ingredients = (row.componentes || [])
      .filter((item) => (item.ingrediente || '').trim() && Number.isFinite(item.cantidad))
      .map<RecipeIngredientSeed>((item) => ({
        productName: canonicalName(item.ingrediente),
        qtyPerYield: item.cantidad,
        unit: normalizeUnit(item.unidad),
        notes: (item.elaboracion || '').trim() || undefined,
        category: categoryFromRaw(item.tipo),
      }));

    if (ingredients.length === 0) {
      unresolved.set(normalizeKey(name), {
        name,
        reason: 'Sin componentes confiables en el JSON',
        sheet: row.hoja?.trim() || null,
      });
      continue;
    }

    const key = normalizeKey(name);
    const existing = recipes.get(key);
    if (existing) {
      existing.ingredients = dedupeIngredients([...existing.ingredients, ...ingredients]);
      existing.category ||= row.hoja?.trim() || null;
      continue;
    }

    recipes.set(key, {
      name,
      category: row.hoja?.trim() || null,
      ingredients: dedupeIngredients(ingredients),
    });
  }

  return { recipes: [...recipes.values()], unresolved: [...unresolved.values()] };
}

async function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`No existe el archivo fuente: ${SOURCE_FILE}`);
  }

  const rows = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8')) as RawRecipeRow[];
  const { recipes, unresolved } = buildRecipeSeeds(rows);

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
        isActive: true,
        createdById: true,
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
  const productByKey = new Map(existingProducts.map((item) => [normalizeKey(item.name), item]));
  const recipesByKey = new Map<string, (typeof existingRecipes)[number]>();

  for (const recipe of existingRecipes) {
    const key = normalizeKey(recipe.name);
    if (!recipesByKey.has(key)) {
      recipesByKey.set(key, recipe);
    }
  }

  let dryProductId = 0;
  const counters = {
    createdRecipes: 0,
    updatedRecipes: 0,
    reactivatedRecipes: 0,
    createdProducts: 0,
    updatedProducts: 0,
    deactivatedInvalidRecipes: 0,
  };

  const ensureProduct = async (name: string, category: ProductCategory, unit: string) => {
    const key = normalizeKey(name);
    const existing = productByKey.get(key);
    const desiredCategoryId = category === 'RECETA' ? recipeCategory.id : ingredientCategory.id;
    const desiredFlags =
      category === 'RECETA'
        ? { isSellable: true, isIngredient: true, isProduced: true }
        : { isSellable: false, isIngredient: true, isProduced: false };

    if (existing) {
      const needsRecipePromotion =
        category === 'RECETA' &&
        (existing.categoryId !== desiredCategoryId ||
          !existing.isSellable ||
          !existing.isIngredient ||
          !existing.isProduced);

      if (needsRecipePromotion && !DRY_RUN) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            categoryId: desiredCategoryId,
            unit: existing.unit || unit,
            ...desiredFlags,
          },
        });
      }

      if (needsRecipePromotion) {
        counters.updatedProducts += 1;
        const promoted = {
          ...existing,
          categoryId: desiredCategoryId,
          isSellable: desiredFlags.isSellable,
          isIngredient: desiredFlags.isIngredient,
          isProduced: desiredFlags.isProduced,
        };
        productByKey.set(key, promoted);
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
      productByKey.set(key, created);
      return created;
    }

    const created = await prisma.product.create({ data: payload });
    productByKey.set(key, created);
    return created;
  };

  for (const recipeSeed of recipes) {
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

    const existingRecipe = recipesByKey.get(normalizeKey(recipeSeed.name));
    const baseData = {
      name: recipeSeed.name,
      description: 'Sincronizada desde recetas_gastronomia_local_2.json',
      category: recipeSeed.category,
      yieldQty: 1,
      yieldUnit: 'unidad',
      productId: recipeProduct.id,
      isActive: true,
    };

    if (!existingRecipe) {
      counters.createdRecipes += 1;

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
            isActive: true,
            createdById: true,
            _count: { select: { ingredients: true } },
          },
        });
        recipesByKey.set(normalizeKey(recipeSeed.name), created);
      }

      continue;
    }

    counters.updatedRecipes += 1;
    if (!existingRecipe.isActive) {
      counters.reactivatedRecipes += 1;
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

  const unresolvedKeys = new Set(unresolved.map((item) => normalizeKey(item.name)));
  const invalidActiveRecipes = existingRecipes.filter(
    (recipe) =>
      unresolvedKeys.has(normalizeKey(recipe.name)) && recipe.isActive && recipe._count.ingredients === 0,
  );

  if (!DRY_RUN && invalidActiveRecipes.length > 0) {
    await prisma.recipe.updateMany({
      where: { id: { in: invalidActiveRecipes.map((recipe) => recipe.id) } },
      data: { isActive: false },
    });
  }
  counters.deactivatedInvalidRecipes = invalidActiveRecipes.length;

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Archivo analizado:', SOURCE_FILE);
  console.log('Filas del JSON:', rows.length);
  console.log('Recetas finales confiables detectadas:', recipes.length);
  console.log('Recetas sin componentes confiables:', unresolved.length);
  console.log('Productos creados:', counters.createdProducts);
  console.log('Productos promovidos a receta:', counters.updatedProducts);
  console.log('Recetas creadas:', counters.createdRecipes);
  console.log('Recetas actualizadas:', counters.updatedRecipes);
  console.log('Recetas reactivadas:', counters.reactivatedRecipes);
  console.log('Recetas inválidas desactivadas:', counters.deactivatedInvalidRecipes);

  if (unresolved.length > 0) {
    console.log('\nPrimeras recetas no recuperables desde este JSON:');
    for (const item of unresolved.slice(0, 40)) {
      console.log(`- ${item.name} | hoja=${item.sheet || 'sin hoja'} | motivo=${item.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
