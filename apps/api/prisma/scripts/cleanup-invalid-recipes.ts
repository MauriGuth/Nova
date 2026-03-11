import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: { select: { ingredients: true, productionOrders: true } },
    },
    orderBy: { name: 'asc' },
  });

  const invalidRecipes = recipes.filter((recipe) => recipe._count.ingredients === 0);

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Recetas totales:', recipes.length);
  console.log('Recetas sin ingredientes:', invalidRecipes.length);

  if (invalidRecipes.length > 0) {
    for (const recipe of invalidRecipes.slice(0, 60)) {
      console.log(
        `- ${recipe.name} | active=${recipe.isActive} | productionOrders=${recipe._count.productionOrders}`,
      );
    }
  }

  if (DRY_RUN || invalidRecipes.length === 0) {
    return;
  }

  await prisma.recipe.updateMany({
    where: { id: { in: invalidRecipes.map((recipe) => recipe.id) } },
    data: { isActive: false },
  });

  console.log('\n✅ Limpieza finalizada');
  console.log('Recetas desactivadas:', invalidRecipes.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
