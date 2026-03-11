/**
 * Carga articulos_carta.json en la base de datos:
 * - Crea categorías para cada valor único de tipo, familia y agrupar_carta_digital.
 * - Crea un producto por artículo (categoría = familia).
 * - Crea stock en los locales según precios: coffee_store → todos los CAFE, dorado → local Dorado, posada → La Posada del Dinosaurio.
 *
 * Uso: desde apps/api
 *   ARTICULOS_JSON=/ruta/a/articulos_carta.json npm run prisma:load-articulos
 *   o: node -e "require('dotenv').config(); ..." (el script lee process.env.ARTICULOS_JSON)
 *
 * Si ARTICULOS_JSON no está definido, usa ./prisma/data/articulos_carta.json
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient(adapter ? { adapter } : ({} as never));

interface Articulo {
  nombre: string;
  precio_coffee_store: number | null;
  precio_dorado: number | null;
  precio_posada: number | null;
  tipo: string;
  familia: string;
  agrupar_carta_digital: string | null;
}

function slug(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'sin-nombre';
}

function skuFromName(name: string, used: Set<string>): string {
  const base = name.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
  let sku = base || 'ART';
  let n = 0;
  while (used.has(sku)) {
    n++;
    sku = `${base}-${n}`;
  }
  used.add(sku);
  return sku;
}

async function main() {
  const jsonPath =
    process.env.ARTICULOS_JSON ||
    path.join(process.cwd(), 'prisma', 'data', 'articulos_carta.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('No se encontró el archivo:', jsonPath);
    console.error('Definí ARTICULOS_JSON o colocá articulos_carta.json en prisma/data/');
    process.exit(1);
  }
  const articulos: Articulo[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log('Artículos a cargar:', articulos.length);

  const tipos = new Set(articulos.map((a) => a.tipo));
  const familias = new Set(articulos.map((a) => a.familia));
  const agrupaciones = new Set(
    articulos.map((a) => a.agrupar_carta_digital).filter((v): v is string => v != null && v !== ''),
  );

  // 1) Crear categorías: prefijo para evitar colisiones (tipo-, familia-, agrupar-)
  const categoryByKey = new Map<string, string>(); // key -> categoryId

  for (const valor of [...tipos]) {
    const slugCat = `tipo-${slug(valor)}`;
    let cat = await prisma.category.findFirst({ where: { slug: slugCat } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: `Tipo: ${valor}`, slug: slugCat, isActive: true },
      });
      console.log('  Categoría creada (tipo):', cat.name);
    }
    categoryByKey.set(`tipo:${valor}`, cat.id);
  }
  for (const valor of [...familias]) {
    const slugCat = `familia-${slug(valor)}`;
    let cat = await prisma.category.findFirst({ where: { slug: slugCat } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: `Familia: ${valor}`, slug: slugCat, isActive: true },
      });
      console.log('  Categoría creada (familia):', cat.name);
    }
    categoryByKey.set(`familia:${valor}`, cat.id);
  }
  for (const valor of agrupaciones) {
    const slugCat = `agrupar-${slug(valor)}`;
    let cat = await prisma.category.findFirst({ where: { slug: slugCat } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: `Agrupar: ${valor}`, slug: slugCat, isActive: true },
      });
      console.log('  Categoría creada (agrupar):', cat.name);
    }
    categoryByKey.set(`agrupar:${valor}`, cat.id);
  }

  // 2) Locales: CAFE = coffee_store; nombre con "dorado" = dorado; nombre con "posada" o "dinosaurio" = posada
  const locations = await prisma.location.findMany({ where: { isActive: true } });
  const cafes = locations.filter((l) => l.type === 'CAFE');
  const dorados = locations.filter(
    (l) => l.name.toLowerCase().includes('dorado') || l.slug.toLowerCase().includes('dorado'),
  );
  const posadas = locations.filter(
    (l) =>
      l.name.toLowerCase().includes('posada') ||
      l.slug.toLowerCase().includes('posada') ||
      l.name.toLowerCase().includes('dinosaurio') ||
      l.slug.toLowerCase().includes('dinosaurio'),
  );
  console.log('Locales: CAFE=', cafes.length, 'Dorado=', dorados.length, 'Posada=', posadas.length);

  const usedSkus = new Set<string>();
  const BATCH = 100;
  let created = 0;
  let stockCreated = 0;

  for (let i = 0; i < articulos.length; i += BATCH) {
    const chunk = articulos.slice(i, i + BATCH);
    for (const a of chunk) {
      const categoryId = categoryByKey.get(`tipo:${a.tipo}`);
      if (!categoryId) {
        console.warn('Sin categoría tipo para', a.nombre, a.tipo);
        continue;
      }
      const sku = skuFromName(a.nombre, usedSkus);
      const salePriceGlobal =
        a.precio_coffee_store ?? a.precio_dorado ?? a.precio_posada ?? 0;

      const product = await prisma.product.upsert({
        where: { sku },
        create: {
          sku,
          name: a.nombre.trim(),
          categoryId,
          familia: a.familia.trim() || null,
          unit: 'unidad',
          salePrice: salePriceGlobal,
          isSellable: true,
          isIngredient: true,
        },
        update: {
          name: a.nombre.trim(),
          categoryId,
          familia: a.familia.trim() || null,
          salePrice: salePriceGlobal,
          isSellable: true,
        },
      });
      created++;

      // Stock con precio por local
      const toCreate: { locationId: string; price: number }[] = [];
      if (a.precio_coffee_store != null)
        cafes.forEach((c) => toCreate.push({ locationId: c.id, price: a.precio_coffee_store! }));
      if (a.precio_dorado != null)
        dorados.forEach((d) => toCreate.push({ locationId: d.id, price: a.precio_dorado! }));
      if (a.precio_posada != null)
        posadas.forEach((p) => toCreate.push({ locationId: p.id, price: a.precio_posada! }));

      for (const { locationId, price } of toCreate) {
        await prisma.stockLevel.upsert({
          where: {
            productId_locationId: { productId: product.id, locationId },
          },
          create: {
            productId: product.id,
            locationId,
            quantity: 0,
            minQuantity: 0,
            salePrice: price,
          },
          update: { salePrice: price },
        });
        stockCreated++;
      }
    }
    console.log('  Procesados', Math.min(i + BATCH, articulos.length), '/', articulos.length);
  }

  console.log('\n✅ Productos creados/actualizados:', created);
  console.log('✅ Niveles de stock con precio:', stockCreated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
