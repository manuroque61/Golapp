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
- Recordatorios por correo para próximos partidos de cada equipo.

> Todo el código está **comentado**, pensado para ser fácil de modificar.

## Variables de entorno

- **DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME**: credenciales de tu servidor MySQL. Por defecto el proyecto intentará conectarse a `root@localhost:3306/golapp` tal como está definido en los scripts de `sql/`.
- **JWT_SECRET**: clave utilizada para firmar los tokens. Recordá cambiarla en tu `.env` antes de desplegar.
- **PORT** _(opcional)_: puerto donde Express levantará la app. Si no lo definís usa `3000`.
- **SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / SMTP_FROM / SMTP_ALLOW_INVALID** _(opcional)_: credenciales
  del servidor SMTP utilizado para enviar notificaciones de próximos partidos. Si no configurás estos valores, la función
  devolverá un error indicando que el correo no está disponible.

### Notificaciones por mail

1. **Configurá las variables SMTP** en tu `.env` con los datos del proveedor que prefieras (por ejemplo, el host, puerto y
   usuario que te dé tu servicio de mail transaccional). En modo desarrollo podés activar `SMTP_ALLOW_INVALID=true` si tu
   certificado es autofirmado.
2. **Reiniciá el servidor** después de guardar el `.env` para que Express tome la nueva configuración.
3. **Cargá los emails de tus jugadores y capitán** desde el panel del equipo (botón “Editar jugador”). Las direcciones
   ingresadas se validan antes de guardarse.
4. **Enviá el recordatorio manualmente**: en el panel del capitán está el botón “Enviar recordatorio por mail”, que invoca el
   endpoint `POST /api/tournaments/teams/:teamId/notify-upcoming`. No hay un proceso automático/cron; cada envío debe ser
   solicitado desde esa acción (o haciendo una llamada autenticada al endpoint).

Si falta algún dato (SMTP sin configurar, equipo sin partidos próximos o sin destinatarios válidos) la respuesta mostrará el
motivo para que puedas corregirlo.

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
