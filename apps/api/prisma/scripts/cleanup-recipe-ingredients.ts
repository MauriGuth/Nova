import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

const DRY_RUN = process.env.DRY_RUN === '1';

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      name: true,
      productId: true,
      ingredients: {
        select: {
          id: true,
          productId: true,
          qtyPerYield: true,
          unit: true,
          notes: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  let recipesTouched = 0;
  let removedSelfRefs = 0;
  let removedDuplicates = 0;
  let mergedGroups = 0;

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Recetas analizadas:', recipes.length);

  for (const recipe of recipes) {
    const selfRefs = recipe.productId
      ? recipe.ingredients.filter((ingredient) => ingredient.productId === recipe.productId)
      : [];

    const remaining = recipe.ingredients.filter(
      (ingredient) => !recipe.productId || ingredient.productId !== recipe.productId,
    );

    const groups = new Map<string, typeof remaining>();
    for (const ingredient of remaining) {
      const key = [
        ingredient.productId,
        normalizeText(ingredient.unit),
        normalizeText(ingredient.notes),
      ].join('|');
      const list = groups.get(key) ?? [];
      list.push(ingredient);
      groups.set(key, list);
    }

    const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
    if (selfRefs.length === 0 && duplicateGroups.length === 0) {
      continue;
    }

    recipesTouched += 1;
    removedSelfRefs += selfRefs.length;
    mergedGroups += duplicateGroups.length;
    removedDuplicates += duplicateGroups.reduce((acc, group) => acc + group.length - 1, 0);

    console.log(
      `- ${recipe.name}: selfRefs=${selfRefs.length}, duplicateGroups=${duplicateGroups.length}`,
    );

    if (DRY_RUN) {
      continue;
    }

    if (selfRefs.length > 0) {
      await prisma.recipeIngredient.deleteMany({
        where: { id: { in: selfRefs.map((item) => item.id) } },
      });
    }

    for (const group of duplicateGroups) {
      const [keeper, ...rest] = group;
      const mergedQty = group.reduce((sum, item) => sum + item.qtyPerYield, 0);

      await prisma.recipeIngredient.update({
        where: { id: keeper.id },
        data: { qtyPerYield: mergedQty },
      });

      if (rest.length > 0) {
        await prisma.recipeIngredient.deleteMany({
          where: { id: { in: rest.map((item) => item.id) } },
        });
      }
    }

    const refreshed = await prisma.recipeIngredient.findMany({
      where: { recipeId: recipe.id },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    for (let index = 0; index < refreshed.length; index += 1) {
      await prisma.recipeIngredient.update({
        where: { id: refreshed[index].id },
        data: { sortOrder: index },
      });
    }
  }

  console.log('\n✅ Revision finalizada');
  console.log('Recetas corregidas:', recipesTouched);
  console.log('Auto-referencias eliminadas:', removedSelfRefs);
  console.log('Grupos consolidados:', mergedGroups);
  console.log('Filas duplicadas eliminadas:', removedDuplicates);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
