const API = location.origin + '/api';
const token = localStorage.getItem('token');
let storedUser = null;
try {
  storedUser = JSON.parse(localStorage.getItem('user'));
} catch (e) {
  storedUser = null;
}

const storedTeamId = Number.parseInt(localStorage.getItem('team_id') ?? '', 10);
let teamId = Number.isInteger(storedTeamId) ? storedTeamId : null;
if (!teamId && storedUser?.team_id) {
  teamId = storedUser.team_id;
  if (teamId) localStorage.setItem('team_id', teamId);
}

if (!token) {
  alert('Debes iniciar sesión para gestionar tu equipo.');
  window.location.href = '/';
}

let currentTeam = null;
let matchesCache = null;
let standingsCache = null;

function getInfoContent() {
  return document.getElementById('infoContent');
}

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
  const contentType = resp.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await resp.json();
  }
  if (!resp.ok) {
    const message = data?.error || 'Error en la solicitud';
    throw new Error(message);
  }
  return data;
}

async function fetchPublic(url) {
  const resp = await fetch(url);
  const contentType = resp.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await resp.json();
  }
  if (!resp.ok) {
    const message = data?.error || 'No se pudo cargar la información';
    throw new Error(message);
  }
  return data;
}

function limpiarFormulario() {
  const nameInput = document.getElementById('pname');
  const numInput = document.getElementById('pnum');
  const posSelect = document.getElementById('ppos');
  if (nameInput) nameInput.value = '';
  if (numInput) numInput.value = '';
  if (posSelect) posSelect.selectedIndex = 0;
}

function renderPlayers(players) {
  const list = document.getElementById('players');
  if (!list) return;
  list.innerHTML = '';

  if (!players?.length) {
    list.innerHTML = '<p class="small">Todavía no cargaste jugadores.</p>';
    return;
  }

  players.forEach(player => {
    const item = document.createElement('div');
    item.className = 'item';

    const info = document.createElement('div');
    info.className = 'info';

    const number = document.createElement('strong');
    number.textContent = player.number ? `#${player.number}` : 'Sin Nº';

    const name = document.createElement('span');
    name.textContent = player.name;
    name.style.fontWeight = '600';

    const position = document.createElement('span');
    position.textContent = player.position || 'Sin posición';

    info.appendChild(number);
    info.appendChild(name);
    info.appendChild(position);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn primary sm';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', () => editarJugador(player));

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

async function cargarCabeceraEquipo(force = false) {
  if (!teamId) return null;
  if (!force && currentTeam) return currentTeam;
  try {
    const team = await apiFetch(`${API}/tournaments/teams/${teamId}`);
    currentTeam = team;
    const emoji = team?.emoji || '⚽';
    const name = team?.name || 'Mi Equipo';
    document.getElementById('teamTitle').textContent = `${emoji} ${name}`;
    return team;
  } catch (e) {
    document.getElementById('teamTitle').textContent = 'Mi Equipo';
    throw e;
  }
}

async function agregar() {
  if (!token) return;
  if (!teamId) {
    alert('Todavía no tenés un equipo asignado. Pedile al administrador que te vincule.');
    return;
  }
  try {
    const name = document.getElementById('pname').value.trim();
    const numberValue = document.getElementById('pnum').value.trim();
    const position = document.getElementById('ppos').value;

    if (!name) {
      alert('Ingresá el nombre del jugador.');
      return;
    }

    const number = numberValue === '' ? null : parseInt(numberValue, 10);
    if (numberValue !== '' && Number.isNaN(number)) {
      alert('El número debe ser un valor numérico.');
      return;
    }

    await apiFetch(`${API}/tournaments/teams/${teamId}/players`, {
      method: 'POST',
      body: JSON.stringify({ name, number, position })
    });
    limpiarFormulario();
    await listar();
  } catch (e) {
    alert(e.message);
  }
}

async function listar() {
  const list = document.getElementById('players');
  if (list) list.innerHTML = '<p>Cargando jugadores...</p>';

  try {
    await cargarCabeceraEquipo();
  } catch (e) {
    if (list) list.innerHTML = `<p class="small">${e.message}</p>`;
    return;
  }

  if (!teamId) {
    if (list) list.innerHTML = '<p class="small">Necesitás que un administrador te asigne un equipo.</p>';
    return;
  }

  try {
    const players = await apiFetch(`${API}/tournaments/teams/${teamId}/players`);
    renderPlayers(players);
  } catch (e) {
    if (list) list.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

async function editarJugador(player) {
  if (!token || !player) return;
  try {
    const nuevoNombre = prompt('Nombre del jugador', player.name ?? '')?.trim();
    if (nuevoNombre === undefined || nuevoNombre === null) return;
    if (!nuevoNombre) {
      alert('El nombre no puede estar vacío.');
      return;
    }

    const numeroInput = prompt('Número de camiseta', player.number ?? '');
    if (numeroInput === null) return;
    const numeroValor = numeroInput.trim();
    const number = numeroValor === '' ? null : parseInt(numeroValor, 10);
    if (numeroValor !== '' && Number.isNaN(number)) {
      alert('El número debe ser un valor numérico.');
      return;
    }

    const nuevaPosicion = prompt('Posición', player.position || '') ?? '';
    const posicionLimpia = nuevaPosicion.trim();

    await apiFetch(`${API}/tournaments/players/${player.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: nuevoNombre, number, position: posicionLimpia || null })
    });

    await listar();
  } catch (e) {
    alert(e.message);
  }
}

async function eliminarJugador(player) {
  if (!token || !player) return;
  if (!confirm(`¿Seguro que deseas eliminar a ${player.name}?`)) return;
  try {
    await apiFetch(`${API}/tournaments/players/${player.id}`, { method: 'DELETE' });
    await listar();
  } catch (e) {
    alert(e.message);
  }
}

async function obtenerPartidos(force = false) {
  if (!teamId) return [];
  if (!force && Array.isArray(matchesCache)) return matchesCache;
  const data = await fetchPublic(`${API}/public/teams/${teamId}/matches`);
  matchesCache = data;
  return data;
}

async function obtenerTabla(force = false) {
  if (!currentTeam?.tournament_id) return [];
  if (!force && Array.isArray(standingsCache)) return standingsCache;
  const data = await fetchPublic(`${API}/tournaments/${currentTeam.tournament_id}/table`);
  standingsCache = data;
  return data;
}

function formatMatchDate(match) {
  if (!match.match_date) return '';
  const parts = match.match_time ? match.match_time.slice(0, 5) : '';
  return `${match.match_date}${parts ? ' • ' + parts : ''}`;
}

function renderFixture(matches) {
  const container = getInfoContent();
  if (!container) return;
  container.innerHTML = '';
  if (!matches.length) {
    container.innerHTML = '<p class="small">No hay partidos cargados para este equipo.</p>';
    return;
  }

  const upcoming = matches.filter(m => m.status === 'scheduled');
  const played = matches.filter(m => m.status === 'played');

  const makeList = (items, emptyText, formatter) => {
    if (!items.length) return `<p class="small">${emptyText}</p>`;
    return `<div class="list">${items
      .map(formatter)
      .join('')}</div>`;
  };

  container.innerHTML = `
    <div>
      <h4>Próximos partidos</h4>
      ${makeList(upcoming, 'No hay partidos programados.', m => `
        <div class="item">
          <div class="info">
            <span>${formatMatchDate(m)}</span>
            <span>${m.location || 'Por confirmar'}</span>
          </div>
          <div class="teams">
            <div class="team"><div>${m.home_emoji}</div><div>${m.home_name}</div></div>
            <strong>VS</strong>
            <div class="team"><div>${m.away_emoji}</div><div>${m.away_name}</div></div>
          </div>
        </div>
      `)}
    </div>
    <div style="margin-top:20px">
      <h4>Resultados</h4>
      ${makeList(played, 'Todavía no hay resultados cargados.', m => `
        <div class="item">
          <div class="info">
            <span>${formatMatchDate(m)}</span>
            <span>${m.location || ''}</span>
          </div>
          <div class="teams">
            <div class="team"><div>${m.home_emoji}</div><div>${m.home_name}</div></div>
            <strong>${m.home_goals ?? '-'} - ${m.away_goals ?? '-'}</strong>
            <div class="team"><div>${m.away_emoji}</div><div>${m.away_name}</div></div>
          </div>
        </div>
      `)}
    </div>
  `;
}

function renderTabla(table) {
  const container = getInfoContent();
  if (!container) return;
  container.innerHTML = '';
  if (!table.length) {
    container.innerHTML = '<p class="small">Aún no hay posiciones calculadas.</p>';
    return;
  }

  const rows = table
    .map((team, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${team.emoji || '⚽'} ${team.team}</td>
        <td>${team.PJ}</td>
        <td>${team.G}</td>
        <td>${team.E}</td>
        <td>${team.P}</td>
        <td>${team.GF}</td>
        <td>${team.GC}</td>
        <td>${team.DG}</td>
        <td>${team.PTS}</td>
      </tr>
    `)
    .join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderNotificaciones(matches) {
  const container = getInfoContent();
  if (!container) return;
  container.innerHTML = '';

  if (!matches.length) {
    container.innerHTML = '<p class="small">Aún no hay partidos asignados a tu equipo.</p>';
    return;
  }

  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 7);

  const proximos = matches
    .filter(m => m.status === 'scheduled' && m.match_date)
    .filter(m => {
      const rawDate = `${m.match_date}T${m.match_time || '00:00:00'}`;
      const date = new Date(rawDate);
      return date >= now && date <= soon;
    })
    .sort((a, b) =>
      new Date(`${a.match_date}T${a.match_time || '00:00:00'}`) -
      new Date(`${b.match_date}T${b.match_time || '00:00:00'}`)
    )
    .slice(0, 3);

  const atrasados = matches
    .filter(m => m.status === 'scheduled' && m.match_date)
    .filter(m => {
      const rawDate = `${m.match_date}T${m.match_time || '00:00:00'}`;
      return new Date(rawDate) < now;
    })
    .slice(0, 3);

  const recientes = matches
    .filter(m => m.status === 'played' && m.match_date)
    .sort((a, b) =>
      new Date(`${b.match_date}T${b.match_time || '00:00:00'}`) -
      new Date(`${a.match_date}T${a.match_time || '00:00:00'}`)
    )
    .slice(0, 3);

  const buildList = (items, empty) => {
    if (!items.length) return `<p class="small">${empty}</p>`;
    return `<ul>${items
      .map(m => `<li>${formatMatchDate(m)} — ${m.home_emoji} ${m.home_name} vs ${m.away_emoji} ${m.away_name}</li>`)
      .join('')}</ul>`;
  };

  container.innerHTML = `
    <div>
      <h4>Próximos 7 días</h4>
      ${buildList(proximos, 'No hay partidos en la próxima semana.')}
    </div>
    <div style="margin-top:20px">
      <h4>Partidos sin cargar resultado</h4>
      ${buildList(atrasados, 'Estás al día con la carga de resultados.')}
    </div>
    <div style="margin-top:20px">
      <h4>Últimos resultados</h4>
      ${buildList(recientes, 'Todavía no se registraron resultados recientes.')}
    </div>
  `;
}

async function cargarFixture() {
  const container = getInfoContent();
  if (container) container.innerHTML = '<p>Cargando fixture...</p>';
  document.getElementById('infoTitle').textContent = 'Fixture del equipo';
  try {
    await cargarCabeceraEquipo();
    const matches = await obtenerPartidos();
    renderFixture(matches);
  } catch (e) {
    if (container) container.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

async function cargarPosiciones() {
  const container = getInfoContent();
  if (container) container.innerHTML = '<p>Cargando posiciones...</p>';
  document.getElementById('infoTitle').textContent = 'Tabla de posiciones';
  try {
    await cargarCabeceraEquipo();
    const table = await obtenerTabla();
    renderTabla(table);
  } catch (e) {
    if (container) container.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

async function cargarNotificaciones() {
  const container = getInfoContent();
  if (container) container.innerHTML = '<p>Cargando notificaciones...</p>';
  document.getElementById('infoTitle').textContent = 'Notificaciones del equipo';
  try {
    await cargarCabeceraEquipo();
    const matches = await obtenerPartidos();
    renderNotificaciones(matches);
  } catch (e) {
    if (container) container.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

function toggleSections(showPlantilla) {
  const plantilla = document.getElementById('plantillaSection');
  const info = document.getElementById('infoSection');
  if (plantilla) plantilla.style.display = showPlantilla ? 'block' : 'none';
  if (info) info.style.display = showPlantilla ? 'none' : 'block';
}

function mostrarSeccion(tipo, el) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else if (window.event?.target) {
    window.event.target.classList.add('active');
  }

  if (tipo === 'plantilla') {
    toggleSections(true);
    listar();
    return;
  }

  toggleSections(false);
  if (tipo === 'fixture') {
    cargarFixture();
  } else if (tipo === 'posiciones') {
    cargarPosiciones();
  } else if (tipo === 'notificaciones') {
    cargarNotificaciones();
  }
}

async function init() {
  if (!teamId) {
    const section = document.getElementById('plantillaSection');
    if (section) {
      section.innerHTML = '<div class="card"><p class="small">Todavía no estás asociado a un equipo. Pedile al administrador que te asigne uno.</p></div>';
    }
    toggleSections(true);
    return;
  }
  await listar();
}

window.addEventListener('load', init);
