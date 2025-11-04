-- Ajusta una base existente de GolApp que no tenga los campos nuevos
-- Ejecutá este script después de conectarte a tu servidor MySQL:
--   mysql -u TU_USUARIO -p golapp < sql/migrations/20240611_align_existing_schema.sql

USE golapp;

-- Agregar columnas que usa la app actual
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS total_rounds INT NOT NULL DEFAULT 1 AFTER admin_id,
  ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER total_rounds,
  ADD COLUMN IF NOT EXISTS match_time TIME NULL AFTER start_date,
  ADD COLUMN IF NOT EXISTS location VARCHAR(80) NULL AFTER match_time;

-- Alinear longitud del campo location en matches para evitar warnings
ALTER TABLE matches
  MODIFY COLUMN location VARCHAR(80) NULL;

-- Crear índice y foreign key sólo si aún no existen
SET @has_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND index_name = 'idx_tournaments_admin'
);
SET @create_index := IF(@has_index = 0,
  'CREATE INDEX idx_tournaments_admin ON tournaments(admin_id);',
  'SELECT 1;'
);
PREPARE stmt FROM @create_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk := (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND constraint_name = 'fk_tournaments_admin'
);
SET @create_fk := IF(@has_fk = 0,
  'ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE;',
  'SELECT 1;'
);
PREPARE stmt2 FROM @create_fk;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Sincronizar valores por defecto esperados por la app
UPDATE tournaments
SET total_rounds = COALESCE(total_rounds, 1)
WHERE total_rounds IS NULL;
