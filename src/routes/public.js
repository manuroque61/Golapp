const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/search-teams', async (req,res)=>{
  const q = `%${(req.query.q||'').trim()}%`;
  const [rows] = await pool.query('SELECT id, name, emoji FROM teams WHERE name LIKE ? LIMIT 20', [q]);
  res.json(rows);
});

module.exports = router;
