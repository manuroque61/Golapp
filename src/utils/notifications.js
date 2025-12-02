const { pool } = require("../config/db");
const { sendMail } = require("./email");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function formatDate(dateValue) {
  if (!dateValue) return "Fecha a confirmar";

  // Si es un objeto Date, usarlo directamente
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === "string") {
    // Si es un string en formato YYYY-MM-DD
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return "Fecha a confirmar";
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    // Intentar convertir a Date
    date = new Date(dateValue);
    if (isNaN(date.getTime())) return "Fecha a confirmar";
  }

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatMatchLine(match, teamId) {
  const youPlayAtHome = match.home_team_id === teamId;
  const opponentName = youPlayAtHome ? match.away_name : match.home_name;
  const opponentEmoji = youPlayAtHome ? match.away_emoji : match.home_emoji;
  const condition = youPlayAtHome ? "Local" : "Visitante";
  const dateLabel = formatDate(match.match_date);
  const timeLabel = match.match_time
    ? `${match.match_time.slice(0, 5)} hs`
    : "Horario a confirmar";
  const location = match.location || "Cancha a confirmar";
  return `${
    match.round ? `Fecha ${match.round}` : "Próximo partido"
  } • ${condition} vs ${
    opponentEmoji || "⚽"
  } ${opponentName} • ${dateLabel} • ${timeLabel} • ${location}`;
}

function buildTextBody(team, matches, recipient) {
  const greetingName = recipient?.name || team.name;
  const lines = [
    `Hola ${greetingName}!`,
    "",
    `Te compartimos los próximos partidos de ${team.name}:`,
    "",
  ];

  if (matches.length === 0) {
    lines.push("Por el momento no hay partidos programados.");
  } else {
    matches.forEach((match) => {
      lines.push(`• ${formatMatchLine(match, team.id)}`);
    });
  }

  lines.push("");
  lines.push("¡Éxitos y a disfrutar del juego!");
  return lines.join("\n");
}

function buildHtmlBody(team, matches, recipient) {
  const greetingName = recipient?.name || team.name;
  const items = matches.length
    ? matches
        .map((match) => `<li>${formatMatchLine(match, team.id)}</li>`)
        .join("")
    : "<li>Por el momento no hay partidos programados.</li>";

  return `
    <div>
      <p>Hola ${greetingName}!</p>
      <p>Te compartimos los próximos partidos de <strong>${team.name}</strong>:</p>
      <ul>${items}</ul>
      <p>¡Éxitos y a disfrutar del juego!</p>
    </div>
  `;
}

async function getTeamContext(teamId) {
  const [[team]] = await pool.query(
    `SELECT t.*, tr.name AS tournament_name
     FROM teams t
     LEFT JOIN tournaments tr ON tr.id = t.tournament_id
     WHERE t.id=?`,
    [teamId]
  );
  return team;
}

async function getUpcomingMatches(team) {
  if (!team?.tournament_id) return [];
  const [rows] = await pool.query(
    `SELECT m.id, m.round, m.match_date, m.match_time, m.location, m.home_team_id, m.away_team_id,
            th.name AS home_name, th.emoji AS home_emoji,
            ta.name AS away_name, ta.emoji AS away_emoji
     FROM matches m
     JOIN teams th ON th.id = m.home_team_id
     JOIN teams ta ON ta.id = m.away_team_id
     WHERE m.tournament_id = ?
       AND (m.home_team_id = ? OR m.away_team_id = ?)
       AND m.status = 'scheduled'
       AND (m.match_date IS NULL OR m.match_date >= CURDATE())
     ORDER BY m.match_date IS NULL, m.match_date, m.match_time
     LIMIT 5`,
    [team.tournament_id, team.id, team.id]
  );
  return rows;
}

async function collectRecipients(teamId, team) {
  const unique = new Map();

  const [players] = await pool.query(
    'SELECT name, email FROM players WHERE team_id=? AND email IS NOT NULL AND email <> ""',
    [teamId]
  );

  for (const player of players) {
    if (!EMAIL_REGEX.test(player.email)) continue;
    const key = normalizeEmail(player.email);
    if (!unique.has(key)) {
      unique.set(key, {
        email: player.email.trim(),
        name: player.name,
        isCaptain: false,
      });
    }
  }

  if (team?.captain_user_id) {
    const [[captain]] = await pool.query(
      "SELECT name, email FROM users WHERE id=?",
      [team.captain_user_id]
    );
    if (captain?.email && EMAIL_REGEX.test(captain.email)) {
      const key = normalizeEmail(captain.email);
      if (!unique.has(key)) {
        unique.set(key, {
          email: captain.email.trim(),
          name: captain.name,
          isCaptain: true,
        });
      }
    }
  }

  return Array.from(unique.values());
}

async function notifyUpcomingMatches({ teamId }) {
  console.log("[NOTIFICATIONS] Iniciando notificación para equipo:", teamId);
  const team = await getTeamContext(teamId);
  if (!team) {
    throw Object.assign(new Error("Equipo no encontrado"), {
      code: "TEAM_NOT_FOUND",
    });
  }

  const matches = await getUpcomingMatches(team);
  if (!matches.length) {
    throw Object.assign(new Error("El equipo no tiene partidos programados."), {
      code: "NO_UPCOMING_MATCHES",
    });
  }

  const recipients = await collectRecipients(teamId, team);
  if (!recipients.length) {
    throw Object.assign(new Error("No hay emails cargados para este equipo."), {
      code: "NO_RECIPIENTS",
    });
  }

  const subject = `Próximos partidos de ${team.name}`;
  let sent = 0;
  const failed = [];

  for (const recipient of recipients) {
    try {
      console.log("[NOTIFICATIONS] Enviando a:", recipient.email);
      const text = buildTextBody(team, matches, recipient);
      const html = buildHtmlBody(team, matches, recipient);
      const response = await sendMail({ to: [recipient], subject, text, html });
      console.log(
        "[NOTIFICATIONS] Respuesta para",
        recipient.email,
        ":",
        response
      );
      if (response.accepted?.length) {
        sent += 1;
        console.log(
          "[NOTIFICATIONS] ✓ Enviado exitosamente a",
          recipient.email
        );
      } else {
        failed.push(recipient.email);
        console.log("[NOTIFICATIONS] ✗ Falló el envío a", recipient.email);
      }
    } catch (error) {
      console.error("[NOTIFICATIONS] Error al enviar a", recipient.email, ":", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      failed.push(recipient.email);
    }
  }

  const message = failed.length
    ? `Se enviaron ${sent} notificaciones, ${failed.length} direcciones fallaron.`
    : `Se notificó a ${sent} integrante${sent === 1 ? "" : "s"} del equipo.`;

  return {
    team: { id: team.id, name: team.name },
    matches,
    recipients: recipients.map((r) => ({
      email: r.email,
      name: r.name,
      isCaptain: r.isCaptain,
    })),
    sent,
    failed,
    message,
  };
}

module.exports = { notifyUpcomingMatches };
