const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');
const { pool } = require('./config/db');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/public', require('./routes/public'));
app.use('/api/raw', require('./routes/raw'));

// Frontend estático
app.use('/', express.static(path.join(__dirname, '../public')));

// Probar conexión
app.get('/api/health', async (req,res)=>{
  try {
    const [r] = await pool.query('SELECT 1+1 as ok');
    res.json({ ok: r[0].ok });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`GolApp escuchando en http://localhost:${PORT}`));
