const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/players', async (req,res)=>{
  const team = parseInt(req.query.team,10);
  if(!team) return res.json([]);
  const [rows] = await pool.query('SELECT * FROM players WHERE team_id=? ORDER BY number ASC', [team]);
  res.json(rows);
});

module.exports = router;
