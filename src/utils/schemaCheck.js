const REQUIRED_SCHEMA = {
  tournaments: ['admin_id', 'total_rounds', 'start_date', 'match_time', 'location'],
  teams: ['tournament_id', 'captain_user_id'],
  matches: ['round', 'match_date', 'match_time', 'location', 'home_team_id', 'away_team_id', 'status'],
  users: ['role', 'team_id']
};

async function fetchColumns(pool, database, table) {
  const [rows] = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name=?`,
    [database, table]
  );
  return rows.map(r => r.column_name);
}

async function assertCompatibleSchema(pool, database) {
  const missing = {};

  for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
    const availableCols = await fetchColumns(pool, database, table);
    const missingCols = requiredCols.filter(col => !availableCols.includes(col));
    if (missingCols.length) {
      missing[table] = missingCols;
    }
  }

  if (Object.keys(missing).length) {
    const formatted = Object.entries(missing)
      .map(([table, cols]) => `- ${table}: falta(n) ${cols.join(', ')}`)
      .join('\n');

    const error = new Error(
      `La base de datos no tiene todos los campos requeridos.\n${formatted}\n` +
      'Ejecutá el script sql/migrations/20240611_align_existing_schema.sql en tu servidor MySQL para actualizarla.'
    );
    error.code = 'ER_SCHEMA_MISMATCH';
    throw error;
  }
}

module.exports = { assertCompatibleSchema };
