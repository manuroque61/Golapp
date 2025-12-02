const nodemailer = require("nodemailer");

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function sendMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = parseBoolean(process.env.SMTP_SECURE ?? "true");
  const rejectUnauthorized = !parseBoolean(
    process.env.SMTP_ALLOW_INVALID ?? "false"
  );
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  console.log("[EMAIL] Configuración SMTP:", {
    host,
    port,
    secure,
    rejectUnauthorized,
    user: user ? `${user.substring(0, 3)}***` : "no configurado",
    from,
  });

  const recipients = Array.isArray(to)
    ? to.filter(Boolean)
    : [to].filter(Boolean);
  if (!recipients.length) {
    throw Object.assign(new Error("No recipients provided"), {
      code: "NO_RECIPIENTS",
    });
  }

  if (!host || !port || !from) {
    console.error("[EMAIL] Error: Servicio de correo no configurado");
    throw Object.assign(new Error("Servicio de correo no configurado."), {
      code: "MAILER_NOT_CONFIGURED",
    });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      user && pass
        ? {
            user,
            pass,
          }
        : undefined,
    tls: {
      rejectUnauthorized,
    },
  });

  // Verificar la conexión antes de enviar
  try {
    console.log("[EMAIL] Verificando conexión SMTP...");
    await transporter.verify();
    console.log("[EMAIL] ✓ Conexión SMTP verificada correctamente");
  } catch (verifyError) {
    console.error("[EMAIL] ✗ Error al verificar conexión SMTP:", {
      message: verifyError.message,
      code: verifyError.code,
    });
    throw Object.assign(
      new Error(`Error de conexión SMTP: ${verifyError.message}`),
      { code: "SMTP_CONNECTION_ERROR", originalError: verifyError }
    );
  }

  // Convertir el formato de destinatarios al formato de nodemailer
  const toAddresses = recipients.map((recipient) => {
    // Si es un string, usarlo directamente
    if (typeof recipient === "string") {
      return recipient;
    }
    // Si es un objeto con email y name
    if (recipient.email) {
      if (recipient.name) {
        return {
          name: recipient.name,
          address: recipient.email,
        };
      }
      return recipient.email;
    }
    // Fallback: si tiene alguna propiedad que parezca un email
    return recipient;
  });

  try {
    console.log("[EMAIL] Enviando correo a:", toAddresses);
    console.log("[EMAIL] Asunto:", subject);

    const info = await transporter.sendMail({
      from,
      to: toAddresses,
      subject,
      text:
        text ||
        (html
          ? html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : ""),
      html: html || undefined,
    });

    console.log("[EMAIL] Respuesta de nodemailer:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    // nodemailer retorna accepted y rejected en info
    // accepted y rejected son arrays de strings (emails)
    const accepted =
      info.accepted ||
      recipients
        .map((r) => (typeof r === "string" ? r : r.email))
        .filter(Boolean);
    const rejected = info.rejected || [];

    console.log("[EMAIL] Resultado final:", { accepted, rejected });

    return {
      accepted,
      rejected,
    };
  } catch (error) {
    console.error("[EMAIL] Error al enviar correo:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { sendMail };
