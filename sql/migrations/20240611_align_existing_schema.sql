-- Ajusta una base existente de GolApp que no tenga los campos nuevos
-- Ejecutá este script después de conectarte a tu servidor MySQL:
--   mysql -u TU_USUARIO -p golapp < sql/migrations/20240611_align_existing_schema.sql

USE golapp;

-- Agregar columnas que usa la app actual, sólo si aún no existen
SET @has_admin_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND column_name = 'admin_id'
);
SET @sql_admin_id := IF(@has_admin_id > 0,
  'SELECT "admin_id ya existe";',
  'ALTER TABLE tournaments ADD COLUMN admin_id INT NULL AFTER status;'
);
PREPARE stmt_admin_id FROM @sql_admin_id;
EXECUTE stmt_admin_id;
DEALLOCATE PREPARE stmt_admin_id;

SET @has_total_rounds := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND column_name = 'total_rounds'
);
SET @sql_total_rounds := IF(@has_total_rounds > 0,
  'SELECT "total_rounds ya existe";',
  'ALTER TABLE tournaments ADD COLUMN total_rounds INT NOT NULL DEFAULT 1 AFTER admin_id;'
);
PREPARE stmt_total_rounds FROM @sql_total_rounds;
EXECUTE stmt_total_rounds;
DEALLOCATE PREPARE stmt_total_rounds;

SET @has_start_date := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND column_name = 'start_date'
);
SET @sql_start_date := IF(@has_start_date > 0,
  'SELECT "start_date ya existe";',
  'ALTER TABLE tournaments ADD COLUMN start_date DATE NULL AFTER total_rounds;'
);
PREPARE stmt_start_date FROM @sql_start_date;
EXECUTE stmt_start_date;
DEALLOCATE PREPARE stmt_start_date;

SET @has_match_time := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND column_name = 'match_time'
);
SET @sql_match_time := IF(@has_match_time > 0,
  'SELECT "match_time ya existe";',
  'ALTER TABLE tournaments ADD COLUMN match_time TIME NULL AFTER start_date;'
);
PREPARE stmt_match_time FROM @sql_match_time;
EXECUTE stmt_match_time;
DEALLOCATE PREPARE stmt_match_time;

SET @has_location := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tournaments'
    AND column_name = 'location'
);
SET @sql_location := IF(@has_location > 0,
  'SELECT "location ya existe";',
  'ALTER TABLE tournaments ADD COLUMN location VARCHAR(80) NULL AFTER match_time;'
);
PREPARE stmt_location FROM @sql_location;
EXECUTE stmt_location;
DEALLOCATE PREPARE stmt_location;

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
PREPARE stmt_index FROM @create_index;
EXECUTE stmt_index;
DEALLOCATE PREPARE stmt_index;

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
PREPARE stmt_fk FROM @create_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Sincronizar valores por defecto esperados por la app
UPDATE tournaments
SET total_rounds = COALESCE(total_rounds, 1)
WHERE total_rounds IS NULL;
