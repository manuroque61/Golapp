const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');

// Función para generar token
function sign(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, team_id: user.team_id || null },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// REGISTRO DE USUARIO
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validaciones básicas
    if (!name || !email || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios.' });

    // Validar si ya existe
    const [exist] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (exist.length) return res.status(400).json({ error: 'El email ya está registrado.' });

    const pass = await hashPassword(password);
    const userRole = role === 'captain' ? 'captain' : 'admin';
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
      [name, email, pass, userRole]
    );

    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [result.insertId]);
    const token = sign(rows[0]);
    res.json({ token, user: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

// 🔵 LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });

    const ok = await comparePassword(password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Usuario o contraseña incorrectos.' });

    const token = sign(rows[0]);
    res.json({ token, user: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

module.exports = router;

