#!/usr/bin/env node
/**
 * Sube los avatares locales al API remota (Railway) para que las fotos de usuario se vean en producción.
 *
 * Uso (desde la raíz del repo):
 *   REMOTE_API_ORIGIN=https://tu-api.up.railway.app \
 *   ADMIN_EMAIL=admin@ejemplo.com ADMIN_PASSWORD=tu-password \
 *   node scripts/sync-avatars-to-remote.js
 *
 * O con token: REMOTE_API_ORIGIN=... ADMIN_TOKEN=eyJ... node scripts/sync-avatars-to-remote.js
 *
 * Requiere: la BD local con users.avatar_url y los archivos en apps/api/uploads/avatars/
 */

const fs = require('fs');
const path = require('path');

// En monorepo, pg está en apps/api; cargar por ruta absoluta
const apiNodeModules = path.join(__dirname, '..', 'apps', 'api', 'node_modules');
const pgPath = path.join(apiNodeModules, 'pg');
const { Client } = require(fs.existsSync(pgPath) ? pgPath : 'pg');

const REMOTE_API_ORIGIN = process.env.REMOTE_API_ORIGIN || 'https://elio-production-f9ea.up.railway.app';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://mauriciohuentelaf@localhost:5432/elio';

const uploadsDir = path.join(__dirname, '..', 'apps', 'api', 'uploads', 'avatars');
// Base sin /api: si REMOTE_API_ORIGIN es https://xxx/api, queda https://xxx para armar /api/auth/login y /api/users/...
const apiBase = REMOTE_API_ORIGIN.replace(/\/api\/?$/, '').replace(/\/$/, '');

async function getToken() {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'Definí REMOTE_API_ORIGIN y o bien ADMIN_TOKEN o bien ADMIN_EMAIL + ADMIN_PASSWORD (para que el script inicie sesión y obtenga el token).'
    );
  }
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login falló (${res.status}): ${text}`);
  }
  const data = await res.json();
  const token = data.accessToken ?? data.access_token;
  if (!token) throw new Error('La respuesta de login no incluyó accessToken ni access_token');
  return token;
}

async function main() {
  const token = await getToken();

  const client = new Client({ connectionString: LOCAL_DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(`
      SELECT DISTINCT avatar_url
      FROM users
      WHERE avatar_url IS NOT NULL
        AND avatar_url <> ''
        AND avatar_url LIKE '/uploads/avatars/%'
      ORDER BY avatar_url
    `);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of result.rows) {
      const avatarUrl = row.avatar_url;
      const filename = path.basename(avatarUrl);
      const localPath = path.join(uploadsDir, filename);

      if (!fs.existsSync(localPath)) {
        console.warn(`skip (no existe local): ${filename}`);
        skipped += 1;
        continue;
      }

      const ext = path.extname(filename).toLowerCase();
      const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'image/jpeg';
      const buffer = fs.readFileSync(localPath);
      const blob = new Blob([buffer], { type: mime });

      const form = new FormData();
      form.append('file', blob, filename);

      const res = await fetch(`${apiBase}/api/users/sync-avatar?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`error ${filename}: ${res.status} ${text}`);
        if (res.status === 404 && failed === 0) {
          console.error(
            'Hint: Si la API remota devuelve 404 en POST /api/users/sync-avatar, redeployá la API en Railway para que incluya este endpoint.'
          );
        }
        failed += 1;
        continue;
      }

      uploaded += 1;
      console.log(`uploaded: ${filename}`);
    }

    console.log(
      JSON.stringify(
        { remoteApiOrigin: apiBase, totalReferenced: result.rows.length, uploaded, skipped, failed },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
