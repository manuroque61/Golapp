const API = location.origin + '/api';
const token = localStorage.getItem('token');
const storedTeamId = parseInt(localStorage.getItem('team_id'), 10);
const teamId = Number.isInteger(storedTeamId) ? storedTeamId : 1;

let currentTeam = null;
let playersCache = [];
let sections = {};
let fixtureContent = null;
let standingsBody = null;
let modalBackdrop = null;
let modalForm = null;
let modalTitle = null;
let modalNameInput = null;
let modalNumberInput = null;
let modalPositionInput = null;
let modalError = null;
let editingPlayer = null;
let fixtureLoaded = false;
let standingsLoaded = false;

if (!token) {
  alert('Debes iniciar sesión para gestionar tu equipo.');
  window.location.href = '/';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('team_id');
  window.location.href = 'index.html';
}

window.logout = logout;

async function apiFetch(url, options = {}) {
  const opts = { ...options };
  opts.headers = {
    Authorization: 'Bearer ' + token,
    ...(options.headers || {})
  };
  if (opts.body && !opts.headers['Content-Type']) {
    opts.headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(url, opts);
  let data = null;
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await resp.json();
  }
  if (!resp.ok) {
    const message = data?.error || 'Error en la solicitud';
    throw new Error(message);
  }
  return data;
}

async function cargarCabeceraEquipo() {
  try {
    currentTeam = await apiFetch(`${API}/tournaments/teams/${teamId}`);
    const emoji = currentTeam?.emoji || '⚽';
    const name = currentTeam?.name || 'Mi Equipo';
    document.getElementById('teamTitle').textContent = `${emoji} ${name}`;
  } catch (e) {
    currentTeam = null;
    document.getElementById('teamTitle').textContent = 'Mi Equipo';
  }
}

function renderPlayers(players) {
  playersCache = Array.isArray(players) ? players : [];
  const list = document.getElementById('players');
  list.innerHTML = '';

  if (!playersCache.length) {
    list.innerHTML = '<p>No hay jugadores cargados todavía.</p>';
    return;
  }

  playersCache.forEach(player => {
    const item = document.createElement('div');
    item.className = 'item';
    if (player.is_captain) item.classList.add('captain-player');

    const info = document.createElement('div');
    info.className = 'info';

    const number = document.createElement('strong');
    if (player.is_captain) {
      number.textContent = 'Capitán';
    } else {
      number.textContent = player.number ? `#${player.number}` : 'Sin Nº';
    }

    const name = document.createElement('span');
    name.textContent = player.name;
    name.style.color = 'inherit';
    name.style.fontWeight = '600';

    const position = document.createElement('span');
    position.textContent = player.position || 'Sin posición';

    const email = document.createElement('span');
    email.className = 'player-email';
    email.textContent = player.email || 'Sin email';

    info.appendChild(number);
    info.appendChild(name);
    if (player.is_captain) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Capitán';
      info.appendChild(badge);
    }
    info.appendChild(position);
    info.appendChild(email);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn primary sm';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', () => openPlayerModal(player));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn red sm';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.addEventListener('click', () => eliminarJugador(player));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function setModalError(message = '') {
  if (!modalError) return;
  if (!message) {
    modalError.textContent = '';
    modalError.classList.add('hidden');
    return;
  }
  modalError.textContent = message;
  modalError.classList.remove('hidden');
}

function openPlayerModal(player) {
  if (!modalBackdrop || !modalForm) return;
  editingPlayer = player;
  modalTitle.textContent = player ? `Editar ${player.name}` : 'Editar jugador';
  setModalError();
  modalNameInput.value = player?.name || '';
  modalNumberInput.value = player?.number ?? '';
  modalPositionInput.value = player?.position || '';
  modalBackdrop.classList.add('show');
  if (modalNameInput) {
    setTimeout(() => modalNameInput.focus(), 0);
  }
}

function closePlayerModal() {
  editingPlayer = null;
  setModalError();
  if (modalForm) modalForm.reset();
  if (modalBackdrop) modalBackdrop.classList.remove('show');
}

function formatShortDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return dateString;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatMatchMeta(match) {
  const segments = [];
  if (match.round) segments.push(`Fecha ${match.round}`);
  if (match.match_date) segments.push(formatShortDate(match.match_date));
  if (match.match_time) segments.push(`${match.match_time.slice(0, 5)} hs`);
  return segments.length ? segments.join(' • ') : 'Sin programación';
}

function matchStatusLabel(status) {
  switch (status) {
    case 'played':
      return ['Finalizado', 'done'];
    case 'in_progress':
      return ['En juego', 'upcoming'];
    default:
      return ['Programado', 'upcoming'];
  }
}

function createTeamNode(emoji, name, highlight) {
  const team = document.createElement('div');
  team.className = 'team';
  if (highlight) team.classList.add('highlight');

  const icon = document.createElement('span');
  icon.className = 'emoji';
  icon.textContent = emoji || '⚽';

  const label = document.createElement('span');
  label.textContent = name;

  team.appendChild(icon);
  team.appendChild(label);
  return team;
}

function renderFixture(matches) {
  if (!fixtureContent) fixtureContent = document.getElementById('fixtureContent');
  if (!fixtureContent) return;

  fixtureContent.innerHTML = '';

  if (!matches?.length) {
    fixtureContent.innerHTML = '<p class="small">Todavía no hay partidos programados para este equipo.</p>';
    return;
  }

  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'item fixture-item';

    const meta = document.createElement('div');
    meta.className = 'fixture-meta';
    const label = document.createElement('span');
    label.textContent = formatMatchMeta(match);
    meta.appendChild(label);

    const [statusLabel, statusClass] = matchStatusLabel(match.status);
    if (statusLabel) {
      const badge = document.createElement('span');
      badge.className = `fixture-status ${statusClass}`;
      badge.textContent = statusLabel;
      meta.appendChild(badge);
    }

    const line = document.createElement('div');
    line.className = 'teams';

    const home = createTeamNode(match.home_emoji, match.home_name, match.home_team_id === teamId);
    const score = document.createElement('div');
    score.className = 'fixture-score';
    if (match.status === 'played') {
      const homeGoals = match.home_goals ?? 0;
      const awayGoals = match.away_goals ?? 0;
      score.textContent = `${homeGoals} - ${awayGoals}`;
    } else if (match.match_time) {
      score.textContent = match.match_time.slice(0, 5);
    } else {
      score.textContent = '—';
      score.title = 'Horario a confirmar';
    }
    const away = createTeamNode(match.away_emoji, match.away_name, match.away_team_id === teamId);
    away.classList.add('fixture-team-right');

    line.appendChild(home);
    line.appendChild(score);
    line.appendChild(away);

    item.appendChild(meta);
    item.appendChild(line);
    fixtureContent.appendChild(item);
  });
}

function renderTablaPosiciones(rows) {
  if (!standingsBody) standingsBody = document.getElementById('tablaPosicionesBody');
  if (!standingsBody) return;

  standingsBody.innerHTML = '';

  if (!rows?.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10" class="small">Todavía no hay resultados cargados en este torneo.</td>';
    standingsBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (row.team_id === teamId) tr.classList.add('highlight');

    const positionCell = document.createElement('td');
    positionCell.textContent = index + 1;

    const teamCell = document.createElement('td');
    const teamWrapper = document.createElement('div');
    teamWrapper.className = 'table-team';
    if (row.team_id === teamId) teamWrapper.classList.add('highlight-team');
    const teamEmoji = document.createElement('span');
    teamEmoji.className = 'emoji';
    teamEmoji.textContent = row.emoji || '⚽';
    const teamName = document.createElement('span');
    teamName.textContent = row.team;
    teamWrapper.appendChild(teamEmoji);
    teamWrapper.appendChild(teamName);
    teamCell.appendChild(teamWrapper);

    const stats = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'PTS'];
    const statCells = stats.map(stat => {
      const td = document.createElement('td');
      td.textContent = row[stat];
      return td;
    });

    tr.appendChild(positionCell);
    tr.appendChild(teamCell);
    statCells.forEach(td => tr.appendChild(td));
    standingsBody.appendChild(tr);
  });
}

function createTeamNode(emoji, name, highlight) {
  const team = document.createElement('div');
  team.className = 'team';
  if (highlight) team.classList.add('highlight');

  const icon = document.createElement('span');
  icon.className = 'emoji';
  icon.textContent = emoji || '⚽';

  const label = document.createElement('span');
  label.textContent = name;

  team.appendChild(icon);
  team.appendChild(label);
  return team;
}

function renderFixture(matches) {
  if (!fixtureContent) fixtureContent = document.getElementById('fixtureContent');
  if (!fixtureContent) return;

  fixtureContent.innerHTML = '';

  if (!matches?.length) {
    fixtureContent.innerHTML = '<p class="small">Todavía no hay partidos programados para este equipo.</p>';
    return;
  }

  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'item fixture-item';

    const meta = document.createElement('div');
    meta.className = 'fixture-meta';
    const label = document.createElement('span');
    label.textContent = formatMatchMeta(match);
    meta.appendChild(label);

    const [statusLabel, statusClass] = matchStatusLabel(match.status);
    if (statusLabel) {
      const badge = document.createElement('span');
      badge.className = `fixture-status ${statusClass}`;
      badge.textContent = statusLabel;
      meta.appendChild(badge);
    }

    const line = document.createElement('div');
    line.className = 'teams';

    const home = createTeamNode(match.home_emoji, match.home_name, match.home_team_id === teamId);
    const score = document.createElement('div');
    score.className = 'fixture-score';
    if (match.status === 'played') {
      const homeGoals = match.home_goals ?? 0;
      const awayGoals = match.away_goals ?? 0;
      score.textContent = `${homeGoals} - ${awayGoals}`;
    } else if (match.match_time) {
      score.textContent = match.match_time.slice(0, 5);
    } else {
      score.textContent = '—';
      score.title = 'Horario a confirmar';
    }
    const away = createTeamNode(match.away_emoji, match.away_name, match.away_team_id === teamId);
    away.classList.add('fixture-team-right');

    line.appendChild(home);
    line.appendChild(score);
    line.appendChild(away);

    item.appendChild(meta);
    item.appendChild(line);
    fixtureContent.appendChild(item);
  });
}

function renderTablaPosiciones(rows) {
  if (!standingsBody) standingsBody = document.getElementById('tablaPosicionesBody');
  if (!standingsBody) return;

  standingsBody.innerHTML = '';

  if (!rows?.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10" class="small">Todavía no hay resultados cargados en este torneo.</td>';
    standingsBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (row.team_id === teamId) tr.classList.add('highlight');

    const positionCell = document.createElement('td');
    positionCell.textContent = index + 1;

    const teamCell = document.createElement('td');
    const teamWrapper = document.createElement('div');
    teamWrapper.className = 'table-team';
    if (row.team_id === teamId) teamWrapper.classList.add('highlight-team');
    const teamEmoji = document.createElement('span');
    teamEmoji.className = 'emoji';
    teamEmoji.textContent = row.emoji || '⚽';
    const teamName = document.createElement('span');
    teamName.textContent = row.team;
    teamWrapper.appendChild(teamEmoji);
    teamWrapper.appendChild(teamName);
    teamCell.appendChild(teamWrapper);

    const stats = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'PTS'];
    const statCells = stats.map(stat => {
      const td = document.createElement('td');
      td.textContent = row[stat];
      return td;
    });

    tr.appendChild(positionCell);
    tr.appendChild(teamCell);
    statCells.forEach(td => tr.appendChild(td));
    standingsBody.appendChild(tr);
  });
}

function createTeamNode(emoji, name, highlight) {
  const team = document.createElement('div');
  team.className = 'team';
  if (highlight) team.classList.add('highlight');

  const icon = document.createElement('span');
  icon.className = 'emoji';
  icon.textContent = emoji || '⚽';

  const label = document.createElement('span');
  label.textContent = name;

  team.appendChild(icon);
  team.appendChild(label);
  return team;
}

function renderFixture(matches) {
  if (!fixtureContent) fixtureContent = document.getElementById('fixtureContent');
  if (!fixtureContent) return;

  fixtureContent.innerHTML = '';

  if (!matches?.length) {
    fixtureContent.innerHTML = '<p class="small">Todavía no hay partidos programados para este equipo.</p>';
    return;
  }

  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'item fixture-item';

    const meta = document.createElement('div');
    meta.className = 'fixture-meta';
    const label = document.createElement('span');
    label.textContent = formatMatchMeta(match);
    meta.appendChild(label);

    const [statusLabel, statusClass] = matchStatusLabel(match.status);
    if (statusLabel) {
      const badge = document.createElement('span');
      badge.className = `fixture-status ${statusClass}`;
      badge.textContent = statusLabel;
      meta.appendChild(badge);
    }

    const line = document.createElement('div');
    line.className = 'teams';

    const home = createTeamNode(match.home_emoji, match.home_name, match.home_team_id === teamId);
    const score = document.createElement('div');
    score.className = 'fixture-score';
    if (match.status === 'played') {
      const homeGoals = match.home_goals ?? 0;
      const awayGoals = match.away_goals ?? 0;
      score.textContent = `${homeGoals} - ${awayGoals}`;
    } else if (match.match_time) {
      score.textContent = match.match_time.slice(0, 5);
    } else {
      score.textContent = '—';
      score.title = 'Horario a confirmar';
    }
    const away = createTeamNode(match.away_emoji, match.away_name, match.away_team_id === teamId);
    away.classList.add('fixture-team-right');

    line.appendChild(home);
    line.appendChild(score);
    line.appendChild(away);

    item.appendChild(meta);
    item.appendChild(line);
    fixtureContent.appendChild(item);
  });
}

function renderTablaPosiciones(rows) {
  if (!standingsBody) standingsBody = document.getElementById('tablaPosicionesBody');
  if (!standingsBody) return;

  standingsBody.innerHTML = '';

  if (!rows?.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10" class="small">Todavía no hay resultados cargados en este torneo.</td>';
    standingsBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (row.team_id === teamId) tr.classList.add('highlight');

    const positionCell = document.createElement('td');
    positionCell.textContent = index + 1;

    const teamCell = document.createElement('td');
    const teamWrapper = document.createElement('div');
    teamWrapper.className = 'table-team';
    if (row.team_id === teamId) teamWrapper.classList.add('highlight-team');
    const teamEmoji = document.createElement('span');
    teamEmoji.className = 'emoji';
    teamEmoji.textContent = row.emoji || '⚽';
    const teamName = document.createElement('span');
    teamName.textContent = row.team;
    teamWrapper.appendChild(teamEmoji);
    teamWrapper.appendChild(teamName);
    teamCell.appendChild(teamWrapper);

    const stats = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'PTS'];
    const statCells = stats.map(stat => {
      const td = document.createElement('td');
      td.textContent = row[stat];
      return td;
    });

    tr.appendChild(positionCell);
    tr.appendChild(teamCell);
    statCells.forEach(td => tr.appendChild(td));
    standingsBody.appendChild(tr);
  });
}

function createTeamNode(emoji, name, highlight) {
  const team = document.createElement('div');
  team.className = 'team';
  if (highlight) team.classList.add('highlight');

  const icon = document.createElement('span');
  icon.className = 'emoji';
  icon.textContent = emoji || '⚽';

  const label = document.createElement('span');
  label.textContent = name;

  team.appendChild(icon);
  team.appendChild(label);
  return team;
}

function renderFixture(matches) {
  if (!fixtureContent) fixtureContent = document.getElementById('fixtureContent');
  if (!fixtureContent) return;

  fixtureContent.innerHTML = '';

  if (!matches?.length) {
    fixtureContent.innerHTML = '<p class="small">Todavía no hay partidos programados para este equipo.</p>';
    return;
  }

  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'item fixture-item';

    const meta = document.createElement('div');
    meta.className = 'fixture-meta';
    const label = document.createElement('span');
    label.textContent = formatMatchMeta(match);
    meta.appendChild(label);

    const [statusLabel, statusClass] = matchStatusLabel(match.status);
    if (statusLabel) {
      const badge = document.createElement('span');
      badge.className = `fixture-status ${statusClass}`;
      badge.textContent = statusLabel;
      meta.appendChild(badge);
    }

    const line = document.createElement('div');
    line.className = 'teams';

    const home = createTeamNode(match.home_emoji, match.home_name, match.home_team_id === teamId);
    const score = document.createElement('div');
    score.className = 'fixture-score';
    if (match.status === 'played') {
      const homeGoals = match.home_goals ?? 0;
      const awayGoals = match.away_goals ?? 0;
      score.textContent = `${homeGoals} - ${awayGoals}`;
    } else if (match.match_time) {
      score.textContent = match.match_time.slice(0, 5);
    } else {
      score.textContent = '—';
      score.title = 'Horario a confirmar';
    }
    const away = createTeamNode(match.away_emoji, match.away_name, match.away_team_id === teamId);
    away.classList.add('fixture-team-right');

    line.appendChild(home);
    line.appendChild(score);
    line.appendChild(away);

    item.appendChild(meta);
    item.appendChild(line);
    fixtureContent.appendChild(item);
  });
}

function renderTablaPosiciones(rows) {
  if (!standingsBody) standingsBody = document.getElementById('tablaPosicionesBody');
  if (!standingsBody) return;

  standingsBody.innerHTML = '';

  if (!rows?.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10" class="small">Todavía no hay resultados cargados en este torneo.</td>';
    standingsBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (row.team_id === teamId) tr.classList.add('highlight');

    const positionCell = document.createElement('td');
    positionCell.textContent = index + 1;

    const teamCell = document.createElement('td');
    const teamWrapper = document.createElement('div');
    teamWrapper.className = 'table-team';
    if (row.team_id === teamId) teamWrapper.classList.add('highlight-team');
    const teamEmoji = document.createElement('span');
    teamEmoji.className = 'emoji';
    teamEmoji.textContent = row.emoji || '⚽';
    const teamName = document.createElement('span');
    teamName.textContent = row.team;
    teamWrapper.appendChild(teamEmoji);
    teamWrapper.appendChild(teamName);
    teamCell.appendChild(teamWrapper);

    const stats = ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'PTS'];
    const statCells = stats.map(stat => {
      const td = document.createElement('td');
      td.textContent = row[stat];
      return td;
    });

    tr.appendChild(positionCell);
    tr.appendChild(teamCell);
    statCells.forEach(td => tr.appendChild(td));
    standingsBody.appendChild(tr);
  });
}

async function agregar() {
  try {
    if (!token) return;
    const name = document.getElementById('pname').value.trim();
    const email = document.getElementById('pemail').value.trim();
    const numberValue = document.getElementById('pnum').value.trim();
    const position = document.getElementById('ppos').value;

    if (!name) {
      alert('Por favor ingresa el nombre del jugador.');
      return;
    }

    if (email && !emailRegex.test(email)) {
      alert('Ingresá un email válido.');
      return;
    }

    const number = numberValue === '' ? null : parseInt(numberValue, 10);
    if (numberValue !== '' && Number.isNaN(number)) {
      alert('El número debe ser un valor numérico.');
      return;
    }

    await apiFetch(`${API}/tournaments/teams/${teamId}/players`, {
      method: 'POST',
      body: JSON.stringify({ name, email: email || null, number, position })
    });
    limpiarFormulario();
    await listar();
  } catch (e) {
    alert(e.message);
  }
}

function limpiarFormulario() {
  document.getElementById('pname').value = '';
  document.getElementById('pnum').value = '';
  document.getElementById('ppos').selectedIndex = 0;
}

async function listar() {
  const list = document.getElementById('players');
  list.innerHTML = '<p>Cargando jugadores...</p>';

  try {
    if (!token) return;
    const players = await apiFetch(`${API}/tournaments/teams/${teamId}/players`);
    renderPlayers(players);
  } catch (e) {
    list.innerHTML = `<p>${e.message}</p>`;
  }
}

async function handleModalSubmit(event) {
  event.preventDefault();
  if (!editingPlayer) return;

  const name = modalNameInput.value.trim();
  const numberValue = modalNumberInput.value.trim();
  const positionValue = modalPositionInput.value.trim();

  if (!name) {
    setModalError('El nombre no puede estar vacío.');
    return;
  }

  const number = numberValue === '' ? null : parseInt(numberValue, 10);
  if (numberValue !== '' && Number.isNaN(number)) {
    setModalError('El número debe ser un valor numérico.');
    return;
  }

  try {
    setModalError();
    await apiFetch(`${API}/tournaments/players/${editingPlayer.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, number, position: positionValue || null })
    });
    closePlayerModal();
    await listar();
  } catch (e) {
    setModalError(e.message);
  }
}

async function eliminarJugador(player) {
  if (player?.is_captain) {
    alert('No podés eliminar al capitán desde esta sección.');
    return;
  }
  if (!confirm(`¿Seguro que deseas eliminar a ${player.name}?`)) return;
  try {
    if (!token) return;
    await apiFetch(`${API}/tournaments/players/${player.id}`, { method: 'DELETE' });
    await listar();
  } catch (e) {
    alert(e.message);
  }
}

function ensureSections() {
  if (sections.plantilla) return;
  sections = {
    plantilla: document.getElementById('plantillaSection'),
    fixture: document.getElementById('fixtureSection'),
    posiciones: document.getElementById('posicionesSection'),
    notificaciones: document.getElementById('notificacionesSection')
  };
}

function mostrarSeccion(tipo, el) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else if (window.event?.target) {
    window.event.target.classList.add('active');
  }

  ensureSections();
  Object.entries(sections).forEach(([key, section]) => {
    if (!section) return;
    section.classList.toggle('hidden', key !== tipo);
  });

  if (tipo === 'plantilla') listar();
  if (tipo === 'fixture') cargarFixture();
  if (tipo === 'posiciones') cargarPosiciones();
  if (tipo === 'notificaciones') mostrarNotificaciones();
}

async function cargarFixture() {
  ensureSections();
  if (!fixtureContent) fixtureContent = document.getElementById('fixtureContent');
  if (!fixtureContent) return;

  if (fixtureLoaded && fixtureContent.children.length) return;

  fixtureContent.innerHTML = '<p class="small">Cargando fixture...</p>';
  try {
    const matches = await apiFetch(`${API}/public/teams/${teamId}/matches`);
    fixtureLoaded = true;
    renderFixture(matches);
  } catch (e) {
    fixtureContent.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

async function cargarPosiciones() {
  ensureSections();
  if (!standingsBody) standingsBody = document.getElementById('tablaPosicionesBody');
  if (!standingsBody) return;

  if (!currentTeam?.tournament_id) {
    standingsBody.innerHTML = '<tr><td colspan="10" class="small">Este equipo todavía no tiene un torneo asignado.</td></tr>';
    return;
  }

  if (standingsLoaded && standingsBody.children.length) return;

  standingsBody.innerHTML = '<tr><td colspan="10" class="small">Cargando tabla...</td></tr>';
  try {
    const rows = await apiFetch(`${API}/public/tournaments/${currentTeam.tournament_id}/table`);
    standingsLoaded = true;
    renderTablaPosiciones(rows);
  } catch (e) {
    standingsBody.innerHTML = `<tr><td colspan="10" class="small">${e.message}</td></tr>`;
  }
}

function mostrarNotificaciones() {
  const content = document.getElementById('notificacionesContent');
  if (content) {
    content.textContent = 'No hay notificaciones nuevas.';
  }
}

function registrarEventosModal() {
  modalBackdrop = document.getElementById('playerModalBackdrop');
  modalForm = document.getElementById('playerModalForm');
  modalTitle = document.getElementById('playerModalTitle');
  modalNameInput = document.getElementById('modalName');
  modalNumberInput = document.getElementById('modalNumber');
  modalPositionInput = document.getElementById('modalPosition');
  modalError = document.getElementById('playerModalError');

  const closeBtn = document.getElementById('playerModalClose');
  const cancelBtn = document.getElementById('playerModalCancel');

  if (modalForm) {
    modalForm.addEventListener('submit', handleModalSubmit);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closePlayerModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closePlayerModal);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', evt => {
      if (evt.target === modalBackdrop) closePlayerModal();
    });
  }
  document.addEventListener('keydown', evt => {
    if (evt.key === 'Escape' && modalBackdrop?.classList.contains('show')) {
      closePlayerModal();
    }
  });
}

async function init() {
  registrarEventosModal();
  ensureSections();
  fixtureContent = document.getElementById('fixtureContent');
  standingsBody = document.getElementById('tablaPosicionesBody');
  await cargarCabeceraEquipo();
  mostrarSeccion('plantilla', document.getElementById('bPlantilla'));
}

window.addEventListener('load', init);
