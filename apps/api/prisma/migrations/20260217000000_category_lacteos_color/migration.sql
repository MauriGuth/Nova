-- Mejorar contraste del color de la categoría Lácteos (era #F5F5DC, poco legible)
UPDATE "categories" SET "color" = '#0D9488' WHERE "slug" = 'lacteos';
