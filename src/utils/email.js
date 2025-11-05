const net = require('net');
const tls = require('tls');

const DEFAULT_TIMEOUT = 10000;

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function connectSocket({ host, port, secure, rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const options = { host, port, rejectUnauthorized };
    let socket;

    function handleError(err) {
      if (socket) {
        socket.destroy();
      }
      reject(err);
    }

    if (secure) {
      socket = tls.connect(options, () => {
        socket.removeListener('error', handleError);
        resolve(socket);
      });
      socket.once('error', handleError);
    } else {
      socket = net.createConnection(options, () => {
        socket.removeListener('error', handleError);
        resolve(socket);
      });
      socket.once('error', handleError);
    }
  });
}

function waitForResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    function cleanup() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
      socket.setTimeout(0);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function onTimeout() {
      cleanup();
      reject(new Error('SMTP timeout'));
    }

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (!match) continue;
        if (match[2] === '-') {
          continue; // multi-line, wait for final response
        }
        cleanup();
        const statusCode = parseInt(match[1], 10);
        if (statusCode >= 400) {
          reject(new Error(line));
          return;
        }
        resolve({ statusCode, message: buffer });
        return;
      }
    }

    socket.on('data', onData);
    socket.on('error', onError);
    socket.setTimeout(DEFAULT_TIMEOUT, onTimeout);
  });
}

function base64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function formatAddressList(addresses) {
  return addresses
    .map(addr => {
      if (!addr.name) return addr.email;
      return `${addr.name} <${addr.email}>`;
    })
    .join(', ');
}

function buildMessage({ from, to, subject, text, html }) {
  const headers = [
    `From: ${from}`,
    `To: ${formatAddressList(to)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0'
  ];

  const plain = text || '';
  if (html) {
    const boundary = `----=_GolappAlt_${Date.now()}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      '',
      plain || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      `--${boundary}--`
    ];

    return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n') + '\r\n';
  }

  headers.push('Content-Type: text/plain; charset="utf-8"');
  headers.push('Content-Transfer-Encoding: 8bit');
  return headers.join('\r\n') + '\r\n\r\n' + plain + '\r\n';
}

async function sendMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = parseBoolean(process.env.SMTP_SECURE ?? 'true');
  const rejectUnauthorized = !parseBoolean(process.env.SMTP_ALLOW_INVALID ?? 'false');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    throw Object.assign(new Error('No recipients provided'), { code: 'NO_RECIPIENTS' });
  }

  if (!host || !port || !from) {
    throw Object.assign(new Error('Servicio de correo no configurado.'), { code: 'MAILER_NOT_CONFIGURED' });
  }

  const socket = await connectSocket({ host, port, secure, rejectUnauthorized });
  socket.setEncoding('utf8');

  try {
    await waitForResponse(socket); // 220
    socket.write(`EHLO ${host}\r\n`);
    await waitForResponse(socket);

    if (user && pass) {
      socket.write('AUTH LOGIN\r\n');
      await waitForResponse(socket);
      socket.write(`${base64(user)}\r\n`);
      await waitForResponse(socket);
      socket.write(`${base64(pass)}\r\n`);
      await waitForResponse(socket);
    }

    socket.write(`MAIL FROM:<${from}>\r\n`);
    await waitForResponse(socket);

    for (const recipient of recipients) {
      socket.write(`RCPT TO:<${recipient.email}>\r\n`);
      await waitForResponse(socket);
    }

    socket.write('DATA\r\n');
    await waitForResponse(socket);

    const message = buildMessage({ from, to: recipients, subject, text, html });
    socket.write(message + '\r\n.\r\n');
    await waitForResponse(socket);

    socket.write('QUIT\r\n');
    await waitForResponse(socket);

    socket.end();
    return { accepted: recipients.map(r => r.email), rejected: [] };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

module.exports = { sendMail };
