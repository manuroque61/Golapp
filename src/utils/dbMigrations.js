const ensurePlayersEmailColumn = async (pool, databaseName) => {
  const [existing] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players' AND COLUMN_NAME = 'email'`,
    [databaseName]
  );

  if (existing.length === 0) {
    await pool.query(
      "ALTER TABLE players ADD COLUMN email VARCHAR(120) NULL AFTER position"
    );
  }
};

const runMigrations = async (pool, connectionConfig) => {
  await ensurePlayersEmailColumn(pool, connectionConfig.database);
};

module.exports = { runMigrations, ensurePlayersEmailColumn };
