import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

const DRY_RUN = process.env.DRY_RUN === '1';

function normalizeForKey(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.*]/g, ' ')
    .replace(/\b(de|del|la|las|el|los|y|al)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function duplicateKey(value: string): string {
  return normalizeForKey(value)
    .split(' ')
    .filter(Boolean)
    .map(singularizeWord)
    .join(' ');
}

function canonicalScore(name: string): number {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  let score = 0;
  if (normalized.includes('*')) score += 100;
  score += (normalized.match(/[.,]/g) || []).length * 5;
  if (/\bDE\b|\bDEL\b/.test(normalized)) score -= 3;
  score += normalized.length / 1000;
  return score;
}

function pickCanonical<T extends { name: string; createdAt: Date }>(items: T[]): T {
  return [...items].sort((a, b) => {
    const scoreDiff = canonicalScore(a.name) - canonicalScore(b.name);
    if (scoreDiff !== 0) return scoreDiff;
    const lengthDiff = a.name.length - b.name.length;
    if (lengthDiff !== 0) return lengthDiff;
    const nameDiff = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

async function mergeStockLevels(duplicateProductId: string, canonicalProductId: string) {
  const duplicateRows = await prisma.stockLevel.findMany({
    where: { productId: duplicateProductId },
  });

  for (const row of duplicateRows) {
    const existing = await prisma.stockLevel.findUnique({
      where: {
        productId_locationId: {
          productId: canonicalProductId,
          locationId: row.locationId,
        },
      },
    });

    if (!existing) {
      await prisma.stockLevel.update({
        where: { id: row.id },
        data: { productId: canonicalProductId },
      });
      continue;
    }

    await prisma.stockLevel.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + row.quantity,
        minQuantity: Math.max(existing.minQuantity, row.minQuantity),
        salePrice: existing.salePrice ?? row.salePrice,
      },
    });

    await prisma.stockLevel.delete({
      where: { id: row.id },
    });
  }
}

async function mergeProductSuppliers(duplicateProductId: string, canonicalProductId: string) {
  const duplicateLinks = await prisma.productSupplier.findMany({
    where: { productId: duplicateProductId },
  });

  for (const row of duplicateLinks) {
    const existing = await prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId: canonicalProductId,
          supplierId: row.supplierId,
        },
      },
    });

    if (!existing) {
      await prisma.productSupplier.update({
        where: { id: row.id },
        data: { productId: canonicalProductId },
      });
      continue;
    }

    await prisma.productSupplier.update({
      where: { id: existing.id },
      data: {
        supplierSku: existing.supplierSku ?? row.supplierSku,
        unitCost: existing.unitCost ?? row.unitCost,
        minOrderQty: existing.minOrderQty ?? row.minOrderQty,
        leadTimeDays: Math.min(existing.leadTimeDays, row.leadTimeDays),
        isPreferred: existing.isPreferred || row.isPreferred,
        lastPurchase: existing.lastPurchase ?? row.lastPurchase,
      },
    });

    await prisma.productSupplier.delete({
      where: { id: row.id },
    });
  }
}

async function mergeDuplicateIntoCanonical(duplicateId: string, canonicalId: string) {
  await mergeStockLevels(duplicateId, canonicalId);
  await mergeProductSuppliers(duplicateId, canonicalId);

  await prisma.stockMovement.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.goodsReceiptItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.recipe.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.recipeIngredient.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.productionOrderItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.shipmentItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.orderItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.supplierPriceHistory.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.wasteRecord.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.productionBatch.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.stockReconciliationItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });
  await prisma.purchaseOrderItem.updateMany({
    where: { productId: duplicateId },
    data: { productId: canonicalId },
  });

  await prisma.product.delete({
    where: { id: duplicateId },
  });
}

async function renumberSkus() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  });

  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { sku: `TMP-${product.id.slice(-8).toUpperCase()}` },
    });
  }

  const reordered = await prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  for (let index = 0; index < reordered.length; index += 1) {
    const product = reordered[index];
    const finalSku = `PROD-${String(index + 1).padStart(3, '0')}`;
    await prisma.product.update({
      where: { id: product.id },
      data: { sku: finalSku },
    });
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      familia: true,
      description: true,
      categoryId: true,
      unit: true,
      avgCost: true,
      lastCost: true,
      salePrice: true,
      isSellable: true,
      isIngredient: true,
      isProduced: true,
      isPerishable: true,
      isActive: true,
      createdAt: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const groups = new Map<string, typeof products>();
  for (const product of products) {
    const key = duplicateKey(product.name);
    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  const safeGroups = [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .filter(([, group]) => new Set(group.map((item) => item.categoryId)).size === 1);

  console.log('Modo:', DRY_RUN ? 'DRY RUN' : 'EJECUCION REAL');
  console.log('Productos actuales:', products.length);
  console.log('Grupos duplicados seguros:', safeGroups.length);
  for (const [key, group] of safeGroups) {
    console.log(`- ${key}: ${group.map((item) => item.name).join(' | ')}`);
  }

  if (DRY_RUN) return;

  let removedDuplicates = 0;
  for (const [, group] of safeGroups) {
    const canonical = pickCanonical(group);
    const duplicates = group.filter((item) => item.id !== canonical.id);

    for (const duplicate of duplicates) {
      await prisma.product.update({
        where: { id: canonical.id },
        data: {
          familia: canonical.familia ?? duplicate.familia,
          description: canonical.description ?? duplicate.description,
          unit: canonical.unit || duplicate.unit,
          avgCost: canonical.avgCost || duplicate.avgCost,
          lastCost: canonical.lastCost || duplicate.lastCost,
          salePrice: canonical.salePrice || duplicate.salePrice,
          isSellable: canonical.isSellable || duplicate.isSellable,
          isIngredient: canonical.isIngredient || duplicate.isIngredient,
          isProduced: canonical.isProduced || duplicate.isProduced,
          isPerishable: canonical.isPerishable || duplicate.isPerishable,
          isActive: canonical.isActive || duplicate.isActive,
        },
      });

      await mergeDuplicateIntoCanonical(duplicate.id, canonical.id);
      removedDuplicates += 1;
    }
  }

  await renumberSkus();

  console.log('\n✅ Limpieza finalizada');
  console.log('Duplicados eliminados:', removedDuplicates);
}

main()
  .catch((error) => {
    console.error('❌ Error en deduplicación/renumeración:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
