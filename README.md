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
   > Si ya tenés una base `golapp` creada con una estructura antigua, ejecutá además
   > `sql/migrations/20240611_align_existing_schema.sql` para agregar las columnas nuevas
   > usadas por el panel de administración.
2. Copiar `.env.example` a `.env` y ajustar credenciales (host, usuario, contraseña y nombre de la base).
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

## Variables de entorno

- **DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME**: credenciales de tu servidor MySQL. Por defecto el proyecto intentará conectarse a `root@localhost:3306/golapp` tal como está definido en los scripts de `sql/`.
- **JWT_SECRET**: clave utilizada para firmar los tokens. Recordá cambiarla en tu `.env` antes de desplegar.
- **PORT** _(opcional)_: puerto donde Express levantará la app. Si no lo definís usa `3000`.

Cuando inicies el servidor verás un mensaje de verificación de la conexión a MySQL. Si hay un error, revisá la configuración anterior y asegurate de que la base exista (`sql/schema.sql`).

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
