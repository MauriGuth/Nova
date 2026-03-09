-- AlterTable: add shape, scale, table_type to tables (for mesas especiales y plano)
-- SQLite: ADD COLUMN with DEFAULT is supported

ALTER TABLE "tables" ADD COLUMN "shape" TEXT NOT NULL DEFAULT 'square';
ALTER TABLE "tables" ADD COLUMN "scale" REAL NOT NULL DEFAULT 1.0;
ALTER TABLE "tables" ADD COLUMN "table_type" TEXT NOT NULL DEFAULT 'normal';
