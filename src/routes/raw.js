const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/players', async (req,res)=>{
  const team = parseInt(req.query.team,10);
  if(!team) return res.json([]);

  const [rows] = await pool.query(
    'SELECT id, team_id, number, name, position, email FROM players WHERE team_id=? ORDER BY number ASC, name ASC',
    [team]
  );

  const players = rows.map(row => ({ ...row, is_captain: false }));

  const [[captain]] = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM teams t
     JOIN users u ON u.id = t.captain_user_id
     WHERE t.id=?`,
    [team]
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
        team_id: team,
        number: null,
        name: captain.name,
        position: 'Capitán',
        email: captain.email,
        is_captain: true
      });
    }
  }

  res.json(players);
});

module.exports = router;
