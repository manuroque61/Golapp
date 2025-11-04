const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/search-teams', async (req,res)=>{
  const q = `%${(req.query.q||'').trim()}%`;
  const [rows] = await pool.query('SELECT id, name, emoji FROM teams WHERE name LIKE ? LIMIT 20', [q]);
  res.json(rows);
});


/** 1) Listar torneos públicamente (sin login) */
router.get('/tournaments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, season, status FROM tournaments ORDER BY id DESC'
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cargar torneos' });
  }
});

/** 2) Tabla de posiciones pública por torneo */
router.get('/tournaments/:id/table', async (req, res) => {
  try {
    const tournamentId = req.params.id;

    // Equipos del torneo
    const [teams] = await pool.query(
      'SELECT id, name, emoji FROM teams WHERE tournament_id=?',
      [tournamentId]
    );

    // Partidos ya jugados del torneo
    const [matches] = await pool.query(
      'SELECT * FROM matches WHERE tournament_id=? AND status="played"',
      [tournamentId]
    );

    const table = {};
    for (const t of teams) {
      table[t.id] = {
        team_id: t.id,
        team: t.name,
        emoji: t.emoji,
        PJ: 0, G: 0, E: 0, P: 0,
        GF: 0, GC: 0, DG: 0, PTS: 0
      };
    }

    for (const m of matches) {
      const h = table[m.home_team_id];
      const a = table[m.away_team_id];
      if (!h || !a) continue;

      h.PJ++; a.PJ++;
      h.GF += m.home_goals ?? 0; h.GC += m.away_goals ?? 0;
      a.GF += m.away_goals ?? 0; a.GC += m.home_goals ?? 0;

      if (m.home_goals > m.away_goals) { h.G++; a.P++; h.PTS += 3; }
      else if (m.home_goals < m.away_goals) { a.G++; h.P++; a.PTS += 3; }
      else { h.E++; a.E++; h.PTS += 1; a.PTS += 1; }
    }

    for (const t of Object.values(table)) t.DG = t.GF - t.GC;

    const ordered = Object.values(table).sort(
      (x, y) => y.PTS - x.PTS || y.DG - x.DG || y.GF - x.GF
    );

    res.json(ordered);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al armar la tabla' });
  }
});

/** 3) Partidos (programados + jugados) del equipo (se detecta el torneo por team.tournament_id) */
router.get('/teams/:teamId/matches', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (!teamId) return res.json([]);

    // Detectar torneo del equipo
    const [[team]] = await pool.query(
      'SELECT id, tournament_id FROM teams WHERE id=?',
      [teamId]
    );
    if (!team) return res.json([]);

    // Traer TODOS los partidos de ese torneo donde juegue el equipo
    const [rows] = await pool.query(
      `SELECT m.*,
              th.name  AS home_name, th.emoji AS home_emoji,
              ta.name  AS away_name, ta.emoji AS away_emoji
       FROM matches m
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       WHERE m.tournament_id = ?
         AND (m.home_team_id = ? OR m.away_team_id = ?)
       ORDER BY m.match_date, m.match_time`,
      [team.tournament_id, teamId, teamId]
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cargar partidos del equipo' });
  }
});

/** 4) Últimos resultados por torneo */
router.get('/tournaments/:id/results', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const [rows] = await pool.query(
      `SELECT m.*, th.name AS home_name, th.emoji AS home_emoji,
              ta.name AS away_name, ta.emoji AS away_emoji
       FROM matches m
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       WHERE m.tournament_id = ? AND m.status = 'played'
       ORDER BY m.match_date DESC, m.match_time DESC
       LIMIT 10`,
      [tournamentId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cargar resultados del torneo' });
  }
});

module.exports = router;


