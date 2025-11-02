# GolApp (simple)
Proyecto completo con **Node.js + MySQL** y **Frontend simple (HTML, CSS, JS)**.

## Requisitos
- Node 18+
- MySQL 8+

## Configuración rápida
1. Crear la base:
   ```sql
   source sql/schema.sql;
   source sql/seed.sql;
   ```
2. Copiar `.env.example` a `.env` y ajustar credenciales.
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Iniciar el servidor (http://localhost:3000):
   ```bash
   npm run dev
   ```

## Usuarios iniciales
- Admin: admin@golapp.com / admin123
- Capitán: capitan@golapp.com / capitan123

## Estructura
- `public/` Frontend simple (HTML + CSS + JS).
- `src/` Backend Express.
- `sql/` Scripts para base de datos.

## Funciones clave
- Registro / login con JWT.
- Gestión de Torneos, Equipos y Jugadores.
- **Sorteo automático de fixture** (round robin).
- Carga de resultados y **tabla de posiciones** automática.
- Vista pública (próximos partidos, tabla).

> Todo el código está **comentado**, pensado para ser fácil de modificar.
