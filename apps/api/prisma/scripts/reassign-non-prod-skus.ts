import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

const DRY_RUN = process.env.DRY_RUN === '1';

function extractProdNumber(sku: string): number | null {
  const match = sku.match(/^PROD-(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function main() {
  const [existingProdSkus, targets] = await Promise.all([
    prisma.product.findMany({
      where: { sku: { startsWith: 'PROD-' } },
      select: { sku: true },
    }),
    prisma.product.findMany({
      where: {
        NOT: { sku: { startsWith: 'PROD-' } },
      },
      select: { id: true, sku: true, name: true },
      orderBy: [{ name: 'asc' }, { sku: 'asc' }],
    }),
  ]);

  const maxProdNumber = existingProdSkus.reduce((max, product) => {
    const value = extractProdNumber(product.sku) ?? 0;
    return Math.max(max, value);
  }, 0);

  const width = Math.max(3, String(maxProdNumber + targets.length).length);
  const assignments = targets.map((product, index) => ({
    ...product,
    newSku: `PROD-${String(maxProdNumber + index + 1).padStart(width, '0')}`,
  }));

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('SKU PROD existentes:', existingProdSkus.length);
  console.log('Productos a reasignar:', assignments.length);
  console.log(
    'Rango nuevo:',
    assignments[0]?.newSku ?? 'sin cambios',
    '->',
    assignments.length > 0 ? assignments[assignments.length - 1].newSku : 'sin cambios',
  );

  for (const item of assignments.slice(0, 60)) {
    console.log(`- ${item.sku} | ${item.name} -> ${item.newSku}`);
  }

  if (DRY_RUN || assignments.length === 0) {
    return;
  }

  for (const item of assignments) {
    await prisma.product.update({
      where: { id: item.id },
      data: { sku: item.newSku },
    });
  }

  console.log('\n✅ Reasignación finalizada');
  console.log('Productos actualizados:', assignments.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
