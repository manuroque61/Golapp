const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/players', async (req,res)=>{
  const team = parseInt(req.query.team,10);
  if(!team) return res.json([]);
  const [rows] = await pool.query('SELECT * FROM players WHERE team_id=? ORDER BY number ASC', [team]);
  res.json(rows);
});

router.get('/teams/:id', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  if (!teamId) {
    return res.status(400).json({ error: 'ID de equipo inválido' });
  }
  try {
    const [[team]] = await pool.query('SELECT id, name, emoji FROM teams WHERE id=?', [teamId]);
    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    const [players] = await pool.query(
      'SELECT id, team_id, number, name, position FROM players WHERE team_id=? ORDER BY number IS NULL, number ASC, name ASC',
      [teamId]
    );
    res.json({ team, players });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la información del equipo' });
  }
});

module.exports = router;
