const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');
const { pool, testConnection, connectionConfig } = require('./config/db');
const { assertCompatibleSchema } = require('./utils/schemaCheck');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
app.get('/api/health', async (req, res) => {
  try {
    const [r] = await pool.query('SELECT 1+1 as ok');
    res.json({ ok: r[0].ok });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

async function bootstrap() {
  try {
    await testConnection();
    await assertCompatibleSchema(pool, connectionConfig.database);
    console.log(
      `✅ MySQL conectado (${connectionConfig.user}@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database})`
    );
  } catch (error) {
    if (error.code === 'ER_SCHEMA_MISMATCH') {
      console.error('❌ La base de datos existe pero le faltan columnas necesarias para esta versión.');
      console.error(error.message);
    } else {
      console.error('❌ No se pudo conectar a MySQL. Verificá tus variables de entorno y que la base exista.');
      console.error(error.message);
    }
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`GolApp escuchando en http://localhost:${PORT}`));
}

bootstrap();
