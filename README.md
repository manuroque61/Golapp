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

## Cómo subir los cambios a GitHub
1. Configurá el remoto (solo la primera vez):
   ```bash
   git remote add origin git@github.com:TU_USUARIO/TU_REPO.git
   ```
2. Verificá el estado del repositorio y agregá los archivos que quieras publicar:
   ```bash
   git status
   git add .
   ```
3. Creá un commit con un mensaje descriptivo:
   ```bash
   git commit -m "Describe tu cambio"
   ```
4. Empujá la rama actual al repositorio remoto:
   ```bash
   git push origin NOMBRE_DE_LA_RAMA
   ```
   Si es la primera vez que subís esta rama podés usar `-u` para dejarla configurada como upstream:
   ```bash
   git push -u origin NOMBRE_DE_LA_RAMA
   ```
5. Creá el Pull Request desde GitHub o, si ya está configurado, seguí trabajando y repetí el flujo cuando tengas más cambios.
