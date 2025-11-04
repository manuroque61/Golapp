const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authRequired, roleRequired } = require('../middleware/auth');
const { generateRoundRobin } = require('../utils/fixture');

// Crear torneo
router.post('/', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { name, season } = req.body;
    const [r] = await pool.query('INSERT INTO tournaments (name, season) VALUES (?,?)', [name, season]);
    res.json({ id: r.insertId, name, season, status: 'active' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear torneo' });
  }
});

// Listar torneos
router.get('/', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM tournaments ORDER BY id DESC');
  res.json(rows);
});

// Equipos del torneo
router.get('/:id/teams', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM teams WHERE tournament_id=?', [req.params.id]);
  res.json(rows);
});

// Crear equipo
router.post('/:id/teams', authRequired, roleRequired('admin'), async (req, res) => {
  const { name, emoji } = req.body;
  const [r] = await pool.query('INSERT INTO teams (name, emoji, tournament_id) VALUES (?,?,?)', [name, emoji || '⚽', req.params.id]);
  res.json({ id: r.insertId, name, emoji });
});

// Agregar jugador
router.post('/teams/:teamId/players', authRequired, roleRequired('admin','captain'), async (req, res) => {
  const { name, number, position } = req.body;
  const [r] = await pool.query('INSERT INTO players (team_id, number, name, position) VALUES (?,?,?,?)', [req.params.teamId, number, name, position]);
  res.json({ id: r.insertId, name, number, position });
});

// Eliminar jugador
router.delete('/players/:id', authRequired, roleRequired('admin','captain'), async (req,res) => {
  await pool.query('DELETE FROM players WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Generar fixture
router.post('/:id/generate-fixture', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const { startDate, time = '16:00:00', location = 'Cancha A' } = req.body;
    const [teams] = await pool.query('SELECT id FROM teams WHERE tournament_id=?', [tournamentId]);
    const teamIds = teams.map(t => t.id);
    if (teamIds.length < 2) return res.status(400).json({ error: 'Se necesitan al menos 2 equipos' });

    const rounds = generateRoundRobin(teamIds);
    // Guardar partidos
    let date = new Date(startDate || Date.now());
    for (let r = 0; r < rounds.length; r++) {
      for (const m of rounds[r]) {
        await pool.query(
          'INSERT INTO matches (tournament_id, round, match_date, match_time, location, home_team_id, away_team_id) VALUES (?,?,?,?,?,?,?)',
          [tournamentId, r+1, date.toISOString().slice(0,10), time, location, m.home, m.away]
        );
      }
      // próxima fecha: +7 días
      date.setDate(date.getDate()+7);
    }
    res.json({ ok: true, rounds: rounds.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo generar el fixture' });
  }
});

// Registrar resultado
router.post('/matches/:id/result', authRequired, roleRequired('admin','captain'), async (req,res) => {
  const { home_goals, away_goals } = req.body;
  await pool.query(
    'UPDATE matches SET home_goals=?, away_goals=?, status="played" WHERE id=?',
    [home_goals, away_goals, req.params.id]
  );
  res.json({ ok: true });
});

// Tabla de posiciones
router.get('/:id/table', async (req,res) => {
  const tournamentId = req.params.id;
  const [teams] = await pool.query('SELECT id, name, emoji FROM teams WHERE tournament_id=?', [tournamentId]);
  const [matches] = await pool.query('SELECT * FROM matches WHERE tournament_id=? AND status="played"', [tournamentId]);

  const table = {};
  for (const t of teams) {
    table[t.id] = { team_id: t.id, team: t.name, emoji: t.emoji, PJ:0, G:0, E:0, P:0, GF:0, GC:0, DG:0, PTS:0 };
  }
  for (const m of matches) {
    const h = table[m.home_team_id];
    const a = table[m.away_team_id];
    if (!h || !a) continue;
    h.PJ++; a.PJ++;
    h.GF += m.home_goals; h.GC += m.away_goals;
    a.GF += m.away_goals; a.GC += m.home_goals;
    if (m.home_goals > m.away_goals) { h.G++; a.P++; h.PTS+=3; }
    else if (m.home_goals < m.away_goals) { a.G++; h.P++; a.PTS+=3; }
    else { h.E++; a.E++; h.PTS+=1; a.PTS+=1; }
  }
  for (const t of Object.values(table)) t.DG = t.GF - t.GC;
  const ordered = Object.values(table).sort((x,y)=> y.PTS - x.PTS || y.DG - x.DG || y.GF - x.GF);
  res.json(ordered);
});

// Próximos partidos
router.get('/:id/upcoming', async (req,res)=>{
  const [rows] = await pool.query(
    'SELECT m.*, th.name as home_name, th.emoji as home_emoji, ta.name as away_name, ta.emoji as away_emoji FROM matches m JOIN teams th ON th.id=m.home_team_id JOIN teams ta ON ta.id=m.away_team_id WHERE m.tournament_id=? AND m.status="scheduled" ORDER BY m.match_date, m.match_time LIMIT 20',
    [req.params.id]
  );
  res.json(rows);
});

// ✏️ Editar torneo existente
router.put('/:id', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { name, season, status } = req.body;
    await pool.query(
      'UPDATE tournaments SET name=?, season=?, status=? WHERE id=?',
      [name, season, status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar torneo' });
  }
});


module.exports = router;
