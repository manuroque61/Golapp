const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authRequired, roleRequired } = require('../middleware/auth');
const { generateRoundRobin } = require('../utils/fixture');
const { hashPassword } = require('../utils/hash');
const { notifyUpcomingMatches } = require('../utils/notifications');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

async function getTournamentForAdmin(tournamentId, adminId) {
  const [[tournament]] = await pool.query(
    'SELECT * FROM tournaments WHERE id=? AND admin_id=?',
    [tournamentId, adminId]
  );
  return tournament;
}

async function getTeamForAdmin(teamId, adminId) {
  const [[team]] = await pool.query(
    `SELECT teams.* FROM teams
     JOIN tournaments ON tournaments.id = teams.tournament_id
     WHERE teams.id=? AND tournaments.admin_id=?`,
    [teamId, adminId]
  );
  return team;
}

async function getMatchForAdmin(matchId, adminId) {
  const [[match]] = await pool.query(
    `SELECT matches.* FROM matches
     JOIN tournaments ON tournaments.id = matches.tournament_id
     WHERE matches.id=? AND tournaments.admin_id=?`,
    [matchId, adminId]
  );
  return match;
}

async function getPlayerWithContext(playerId) {
  const [[player]] = await pool.query(
    `SELECT p.*, t.tournament_id, tm.admin_id
     FROM players p
     JOIN teams t ON t.id = p.team_id
     JOIN tournaments tm ON tm.id = t.tournament_id
     WHERE p.id=?`,
    [playerId]
  );
  return player;
}

async function getCaptainForAdmin(captainId, adminId) {
  const [[captain]] = await pool.query(
    `SELECT u.*, tm.admin_id FROM users u
     LEFT JOIN teams t ON t.id = u.team_id
     LEFT JOIN tournaments tm ON tm.id = t.tournament_id
     WHERE u.id=? AND u.role='captain'`,
    [captainId]
  );
  if (!captain) return null;
  if (captain.admin_id && captain.admin_id !== adminId) return null;
  return captain;
}

async function autoGenerateFixture(tournamentId) {
  const [[tournament]] = await pool.query(
    'SELECT id, total_rounds, start_date, match_time, location FROM tournaments WHERE id=?',
    [tournamentId]
  );
  if (!tournament) return { generated: false, rounds: 0 };

  const [teams] = await pool.query(
    'SELECT id FROM teams WHERE tournament_id=? ORDER BY id ASC',
    [tournamentId]
  );
  if (teams.length < 2) return { generated: false, rounds: 0 };

  const [[existing]] = await pool.query(
    'SELECT COUNT(*) AS total FROM matches WHERE tournament_id=?',
    [tournamentId]
  );
  if (existing.total > 0) return { generated: false, rounds: 0 };

  const teamIds = teams.map(t => t.id);
  const baseRounds = generateRoundRobin(teamIds);
  if (!baseRounds.length) return { generated: false, rounds: 0 };

  const totalRounds = tournament.total_rounds || baseRounds.length;
  const baseDate = tournament.start_date ? new Date(tournament.start_date) : new Date();
  const matchTime = tournament.match_time || '16:00:00';
  const location = tournament.location || 'Cancha A';

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const template = baseRounds[roundIndex % baseRounds.length];
    const cycle = Math.floor(roundIndex / baseRounds.length);
    const roundMatches = template.map(match =>
      cycle % 2 === 1 ? { home: match.away, away: match.home } : match
    );

    const roundDate = new Date(baseDate);
    roundDate.setDate(baseDate.getDate() + roundIndex * 7);

    for (const m of roundMatches) {
      await pool.query(
        `INSERT INTO matches
         (tournament_id, round, match_date, match_time, location, home_team_id, away_team_id)
         VALUES (?,?,?,?,?,?,?)`,
        [
          tournamentId,
          roundIndex + 1,
          roundDate.toISOString().slice(0, 10),
          matchTime,
          location,
          m.home,
          m.away
        ]
      );
    }
  }

  return { generated: true, rounds: totalRounds };
}

// Crear torneo
router.post('/', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { name, season, rounds, startDate, matchTime, location } = req.body;

    if (!name || !season || !rounds) {
      return res.status(400).json({ error: 'Nombre, temporada y cantidad de fechas son obligatorios' });
    }

    const [r] = await pool.query(
      `INSERT INTO tournaments
       (name, season, status, admin_id, total_rounds, start_date, match_time, location)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        name,
        season,
        'active',
        req.user.id,
        rounds,
        startDate || null,
        matchTime || null,
        location || null
      ]
    );
    res.json({
      id: r.insertId,
      name,
      season,
      status: 'active',
      total_rounds: rounds,
      start_date: startDate,
      match_time: matchTime,
      location
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear torneo' });
  }
});

// Listar torneos
router.get('/', authRequired, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [rows] = await pool.query(
        'SELECT * FROM tournaments WHERE admin_id=? ORDER BY id DESC',
        [req.user.id]
      );
      return res.json(rows);
    }

    if (req.user.role === 'captain') {
      const [rows] = await pool.query(
        `SELECT t.* FROM tournaments t
         JOIN teams tm ON tm.tournament_id = t.id
         WHERE tm.id = ?
         ORDER BY t.id DESC`,
        [req.user.team_id]
      );
      return res.json(rows);
    }

    res.json([]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar torneos' });
  }
});

// Listado de capitanes del admin
router.get('/captains', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.team_id, t.name AS team_name, tm.name AS tournament_name
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN tournaments tm ON tm.id = t.tournament_id
       WHERE u.role='captain' AND tm.admin_id = ?
       ORDER BY u.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar capitanes' });
  }
});

// Actualizar capitán
router.put('/captains/:id', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const captainId = req.params.id;
    const { name, email, password, team_id } = req.body;

    const [[captain]] = await pool.query(
      `SELECT u.*, t.tournament_id, tm.admin_id FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN tournaments tm ON tm.id = t.tournament_id
       WHERE u.id=? AND u.role='captain'`,
      [captainId]
    );

    if (!captain || captain.admin_id !== req.user.id) {
      return res.status(404).json({ error: 'Capitán no encontrado' });
    }

    let passwordHash = captain.password_hash;
    if (password) passwordHash = await hashPassword(password);

    const targetTeamId = team_id || null;
    if (targetTeamId) {
      const team = await getTeamForAdmin(targetTeamId, req.user.id);
      if (!team) return res.status(400).json({ error: 'Equipo inválido para este admin' });
    }

    await pool.query(
      'UPDATE users SET name=?, email=?, password_hash=?, team_id=? WHERE id=?',
      [
        name ?? captain.name,
        email ?? captain.email,
        passwordHash,
        targetTeamId,
        captainId
      ]
    );

    // Actualizar relación con equipos
    await pool.query('UPDATE teams SET captain_user_id=NULL WHERE captain_user_id=?', [captainId]);
    if (targetTeamId) {
      await pool.query('UPDATE teams SET captain_user_id=? WHERE id=?', [captainId, targetTeamId]);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar capitán' });
  }
});

// Equipos del torneo
router.get('/:id/teams', authRequired, async (req, res) => {
  try {
    const tournamentId = req.params.id;

    if (req.user.role === 'admin') {
      const tournament = await getTournamentForAdmin(tournamentId, req.user.id);
      if (!tournament) return res.status(403).json({ error: 'No autorizado' });
    } else if (req.user.role === 'captain') {
      const [[team]] = await pool.query(
        'SELECT id FROM teams WHERE id=? AND tournament_id=?',
        [req.user.team_id, tournamentId]
      );
      if (!team) return res.status(403).json({ error: 'No autorizado' });
    }

    const [rows] = await pool.query(
      `SELECT teams.*, u.name AS captain_name, u.email AS captain_email
       FROM teams
       LEFT JOIN users u ON u.id = teams.captain_user_id
       WHERE teams.tournament_id=?
       ORDER BY teams.name ASC`,
      [tournamentId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar equipos' });
  }
});

// Crear equipo
router.post('/:id/teams', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await getTournamentForAdmin(tournamentId, req.user.id);
    if (!tournament) return res.status(403).json({ error: 'No autorizado' });

    const { name, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });

    const [r] = await pool.query(
      'INSERT INTO teams (name, emoji, tournament_id) VALUES (?,?,?)',
      [name, emoji || '⚽', tournamentId]
    );

    const fixtureInfo = await autoGenerateFixture(tournamentId);

    res.json({
      id: r.insertId,
      name,
      emoji,
      fixtureGenerated: fixtureInfo.generated,
      rounds: fixtureInfo.rounds
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear equipo' });
  }
});

// Actualizar equipo
router.put('/teams/:teamId', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const team = await getTeamForAdmin(teamId, req.user.id);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });

    const { name, emoji, captain_user_id } = req.body;
    let captainId = captain_user_id || null;
    if (captainId) {
      const captain = await getCaptainForAdmin(captainId, req.user.id);
      if (!captain) return res.status(400).json({ error: 'Capitán inválido' });
    }
    await pool.query(
      'UPDATE teams SET name=?, emoji=?, captain_user_id=? WHERE id=?',
      [name, emoji || '⚽', captainId, teamId]
    );

    if (captainId) {
      await pool.query('UPDATE users SET team_id=? WHERE id=?', [teamId, captainId]);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar equipo' });
  }
});

// Obtener detalle de un equipo (para admin/capitán)
router.get('/teams/:teamId', authRequired, roleRequired('admin','captain'), async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (!teamId) return res.status(400).json({ error: 'Equipo inválido' });

    if (req.user.role === 'admin') {
      const team = await getTeamForAdmin(teamId, req.user.id);
      if (!team) return res.status(403).json({ error: 'No autorizado' });
      return res.json(team);
    }

    if (req.user.team_id !== teamId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const [[team]] = await pool.query('SELECT * FROM teams WHERE id=?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(team);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// Listar jugadores de un equipo
router.get('/teams/:teamId/players', authRequired, roleRequired('admin','captain'), async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (!teamId) return res.status(400).json({ error: 'Equipo inválido' });

    if (req.user.role === 'admin') {
      const team = await getTeamForAdmin(teamId, req.user.id);
      if (!team) return res.status(403).json({ error: 'No autorizado' });
    } else if (req.user.role === 'captain') {
      if (teamId !== req.user.team_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const [rows] = await pool.query(
      'SELECT id, team_id, number, name, position, email FROM players WHERE team_id=? ORDER BY number ASC, name ASC',
      [teamId]
    );

    const players = rows.map(row => ({ ...row, is_captain: false }));

    const [[captain]] = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM teams t
       JOIN users u ON u.id = t.captain_user_id
       WHERE t.id=?`,
      [teamId]
    );

    if (captain?.id && captain.email) {
      const lowerEmail = captain.email.trim().toLowerCase();
      const existingIndex = players.findIndex(
        p => typeof p.email === 'string' && p.email.trim().toLowerCase() === lowerEmail
      );

      if (existingIndex >= 0) {
        players[existingIndex] = {
          ...players[existingIndex],
          is_captain: true,
          position: players[existingIndex].position || 'Capitán'
        };
      } else {
        players.unshift({
          id: `captain-${captain.id}`,
          team_id: teamId,
          number: null,
          name: captain.name,
          position: 'Capitán',
          email: captain.email,
          is_captain: true
        });
      }
    }

    res.json(players);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar jugadores' });
  }
});

// Agregar jugador
router.post('/teams/:teamId/players', authRequired, roleRequired('admin','captain'), async (req, res) => {
  try {
    const teamId = req.params.teamId;
    if (req.user.role === 'admin') {
      const team = await getTeamForAdmin(teamId, req.user.id);
      if (!team) return res.status(403).json({ error: 'No autorizado' });
    } else if (req.user.role === 'captain') {
      if (parseInt(teamId, 10) !== req.user.team_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const { name, number, position, email } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'El email del jugador no es válido' });
    }
    const [r] = await pool.query(
      'INSERT INTO players (team_id, number, name, position, email) VALUES (?,?,?,?,?)',
      [teamId, number, name, position, email || null]
    );
    res.json({ id: r.insertId, name, number, position, email: email || null, team_id: parseInt(teamId, 10) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al agregar jugador' });
  }
});

// Actualizar jugador
router.put('/players/:id', authRequired, roleRequired('admin','captain'), async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) return res.status(400).json({ error: 'Jugador inválido' });

    const player = await getPlayerWithContext(playerId);
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    if (req.user.role === 'admin' && player.admin_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (req.user.role === 'captain' && player.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { name, number, position, email } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'El email del jugador no es válido' });
    }

    await pool.query(
      'UPDATE players SET name=?, number=?, position=?, email=? WHERE id=?',
      [name, number, position, email || null, playerId]
    );

    res.json({ id: playerId, name, number, position, email: email || null, team_id: player.team_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar jugador' });
  }
});

// Eliminar jugador
router.delete('/players/:id', authRequired, roleRequired('admin','captain'), async (req,res) => {
  try {
    const playerId = req.params.id;
    const player = await getPlayerWithContext(playerId);
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    if (req.user.role === 'admin' && player.admin_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (req.user.role === 'captain' && player.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await pool.query('DELETE FROM players WHERE id=?', [playerId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar jugador' });
  }
});

router.post('/teams/:teamId/notify-upcoming', authRequired, roleRequired('admin','captain'), async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (!teamId) return res.status(400).json({ error: 'Equipo inválido' });

    if (req.user.role === 'admin') {
      const team = await getTeamForAdmin(teamId, req.user.id);
      if (!team) return res.status(403).json({ error: 'No autorizado' });
    } else if (req.user.role === 'captain' && req.user.team_id !== teamId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await notifyUpcomingMatches({ teamId });
    res.json(result);
  } catch (e) {
    if (['MAILER_NOT_CONFIGURED', 'NO_RECIPIENTS', 'NO_UPCOMING_MATCHES'].includes(e.code)) {
      const status = e.code === 'MAILER_NOT_CONFIGURED' ? 503 : 400;
      return res.status(status).json({ error: e.message });
    }
    console.error(e);
    res.status(500).json({ error: 'Error al enviar notificaciones' });
  }
});

// Generar fixture
router.post('/:id/generate-fixture', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const tournament = await getTournamentForAdmin(tournamentId, req.user.id);
    if (!tournament) return res.status(403).json({ error: 'No autorizado' });

    const { startDate, time = '16:00:00', location = 'Cancha A' } = req.body;

    await pool.query('DELETE FROM matches WHERE tournament_id=?', [tournamentId]);
    await pool.query(
      'UPDATE tournaments SET start_date=?, match_time=?, location=? WHERE id=?',
      [startDate || tournament.start_date, time, location, tournamentId]
    );

    const info = await autoGenerateFixture(tournamentId);
    if (!info.generated) return res.status(400).json({ error: 'No se pudo generar el fixture (verifica equipos)' });
    res.json({ ok: true, rounds: info.rounds });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo generar el fixture' });
  }
});

// Registrar resultado
router.post('/matches/:id/result', authRequired, roleRequired('admin','captain'), async (req,res) => {
  try {
    const matchId = req.params.id;
    const { home_goals, away_goals } = req.body;

    if (req.user.role === 'admin') {
      const match = await getMatchForAdmin(matchId, req.user.id);
      if (!match) return res.status(403).json({ error: 'No autorizado' });
    } else if (req.user.role === 'captain') {
      const [[match]] = await pool.query(
        'SELECT * FROM matches WHERE id=? AND (home_team_id=? OR away_team_id=?)',
        [matchId, req.user.team_id, req.user.team_id]
      );
      if (!match) return res.status(403).json({ error: 'No autorizado' });
    }

    await pool.query(
      'UPDATE matches SET home_goals=?, away_goals=?, status="played" WHERE id=?',
      [home_goals, away_goals, matchId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar resultado' });
  }
});

// Listado completo de partidos del torneo (para admin)
router.get('/:id/matches', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await getTournamentForAdmin(tournamentId, req.user.id);
    if (!tournament) return res.status(403).json({ error: 'No autorizado' });

    const [rows] = await pool.query(
      `SELECT m.*, th.name AS home_name, th.emoji AS home_emoji,
              ta.name AS away_name, ta.emoji AS away_emoji
       FROM matches m
       JOIN teams th ON th.id = m.home_team_id
       JOIN teams ta ON ta.id = m.away_team_id
       WHERE m.tournament_id=?
       ORDER BY m.round ASC, m.match_date, m.match_time`,
      [tournamentId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar partidos' });
  }
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
    const tournament = await getTournamentForAdmin(req.params.id, req.user.id);
    if (!tournament) return res.status(403).json({ error: 'No autorizado' });

    const { name, season, status, total_rounds, start_date, match_time, location } = req.body;
    await pool.query(
      `UPDATE tournaments
       SET name=?, season=?, status=?, total_rounds=?, start_date=?, match_time=?, location=?
       WHERE id=?`,
      [
        name,
        season,
        status,
        total_rounds ?? tournament.total_rounds,
        start_date ?? tournament.start_date,
        match_time ?? tournament.match_time,
        location ?? tournament.location,
        req.params.id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar torneo' });
  }
});


module.exports = router;
