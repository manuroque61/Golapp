const API = location.origin + '/api';
const token = localStorage.getItem('token');
if (!token) location.href = 'index.html';

let editTournamentId = null;
let fixtureTournamentId = null;
let editTeamId = null;
let editCaptainId = null;

let torneosCache = [];
let teamsCache = [];
let captainsCache = [];
let matchesCache = [];

const teamStore = new Map();
const captainStore = new Map();

function authHeaders() {
  return { 'Authorization': 'Bearer ' + token };
}

function logout() {
  localStorage.removeItem('token');
  location.href = 'index.html';
}

/* ---------------------- NAVEGACIÓN ENTRE SECCIONES ---------------------- */
function mostrarSeccion(nombre) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
  event.target.classList.add('active');
  document.getElementById('seccion-' + nombre).style.display = 'block';

  if (nombre === 'torneos') cargarTorneos();
  if (nombre === 'equipos') cargarEquipos();
  if (nombre === 'capitanes') cargarCapitanes();
  if (nombre === 'partidos') cargarPartidos();
}

/* ---------------------------- 🏆 TORNEOS ---------------------------- */
async function obtenerTorneos(force = false) {
  if (!force && torneosCache.length) return torneosCache;
  const r = await fetch(API + '/tournaments', { headers: authHeaders() });
  if (!r.ok) {
    alert('No se pudieron cargar los torneos');
    return [];
  }
  torneosCache = await r.json();
  return torneosCache;
}

async function cargarTorneos(force = true) {
  const torneos = await obtenerTorneos(force);
  const tbody = document.querySelector('#tablaTorneos tbody');
  tbody.innerHTML = '';

  if (!torneos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="small">Todavía no creaste torneos.</td>';
    tbody.appendChild(tr);
  } else {
    torneos.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.name}</td>
        <td>${t.season}</td>
        <td>${t.total_rounds || '-'}</td>
        <td><span class="badge-sm">${t.status}</span></td>
        <td>
          <button class="btn" onclick="openEditModal(${t.id})">Editar</button>
          <button class="btn primary" onclick="openFixtureModal(${t.id})">Regenerar fixture</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  cargarTorneosEnSelects();
}

async function crearTorneo(e) {
  e.preventDefault();
  const name = document.getElementById('torneoName').value.trim();
  const season = document.getElementById('torneoSeason').value;
  const rounds = parseInt(document.getElementById('torneoRounds').value, 10);
  const startDate = document.getElementById('torneoStart').value;
  const timeInput = document.getElementById('torneoTime').value;
  const matchTime = timeInput ? `${timeInput}:00` : null;
  const location = document.getElementById('torneoCancha').value.trim();

  const today = new Date().toISOString().slice(0, 10);
  if (startDate && startDate < today) {
    alert('La fecha de inicio no puede ser anterior a hoy.');
    return;
  }

  const r = await fetch(API + '/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, season, rounds, startDate, matchTime, location })
  });
  const d = await r.json();

  if (r.ok) {
    alert('Torneo creado');
    document.getElementById('formTorneo').reset();
    cargarTorneos(true);
  } else {
    alert(d.error || 'Error al crear torneo');
  }
}

function openEditModal(id) {
  const torneo = torneosCache.find(t => t.id === id);
  if (!torneo) return;
  editTournamentId = id;
  document.getElementById('editName').value = torneo.name || '';
  document.getElementById('editSeason').value = torneo.season || new Date().getFullYear();
  document.getElementById('editStatus').value = torneo.status || 'active';
  document.getElementById('editRounds').value = torneo.total_rounds || 1;
  document.getElementById('editStart').value = torneo.start_date ? torneo.start_date.slice(0, 10) : '';
  document.getElementById('editTime').value = torneo.match_time ? torneo.match_time.slice(0, 5) : '';
  document.getElementById('editLocation').value = torneo.location || '';

  document.getElementById('modalEdit').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('modalEdit').style.display = 'none';
  editTournamentId = null;
}

async function submitEditTournament() {
  if (!editTournamentId) return;
  const name = document.getElementById('editName').value.trim();
  const season = document.getElementById('editSeason').value;
  const status = document.getElementById('editStatus').value;
  const total_rounds = parseInt(document.getElementById('editRounds').value, 10);
  const start_date = document.getElementById('editStart').value || null;
  const timeVal = document.getElementById('editTime').value;
  const match_time = timeVal ? `${timeVal}:00` : null;
  const location = document.getElementById('editLocation').value.trim();

  const r = await fetch(`${API}/tournaments/${editTournamentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, season, status, total_rounds, start_date, match_time, location })
  });
  const d = await r.json();

  if (r.ok && d.ok) {
    closeEditModal();
    await cargarTorneos(true);
    alert('Torneo actualizado con éxito');
  } else {
    alert(d.error || 'Error al actualizar el torneo');
  }
}

function openFixtureModal(id) {
  const torneo = torneosCache.find(t => t.id === id);
  if (!torneo) return;
  fixtureTournamentId = id;
  document.getElementById('fxStart').value = (torneo.start_date || new Date().toISOString().slice(0, 10));
  document.getElementById('fxTime').value = torneo.match_time ? torneo.match_time.slice(0, 5) : '16:00';
  document.getElementById('fxLocation').value = torneo.location || 'Cancha A';
  document.getElementById('modalFixture').style.display = 'flex';
}

function closeFixtureModal() {
  document.getElementById('modalFixture').style.display = 'none';
  fixtureTournamentId = null;
}

async function submitGenerateFixture() {
  if (!fixtureTournamentId) return;
  const startDate = document.getElementById('fxStart').value;
  const timeVal = document.getElementById('fxTime').value;
  const time = timeVal ? `${timeVal}:00` : '16:00:00';
  const location = document.getElementById('fxLocation').value.trim();

  const r = await fetch(`${API}/tournaments/${fixtureTournamentId}/generate-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ startDate, time, location })
  });
  const d = await r.json();

  if (r.ok && d.ok) {
    closeFixtureModal();
    alert(`Fixture regenerado (${d.rounds} fechas)`);
    cargarPartidos();
  } else {
    alert(d.error || 'No se pudo regenerar el fixture');
  }
}

/* ---------------------------- ⚽ EQUIPOS ---------------------------- */
async function fetchTeams(force = false) {
  if (!force && teamsCache.length) return teamsCache;
  const torneos = await obtenerTorneos();
  if (!torneos.length) {
    teamsCache = [];
    teamStore.clear();
    return teamsCache;
  }
  const lists = await Promise.all(torneos.map(async t => {
    const r = await fetch(`${API}/tournaments/${t.id}/teams`, { headers: authHeaders() });
    if (!r.ok) return [];
    const teams = await r.json();
    return teams.map(team => ({ ...team, tournament_id: t.id, tournament_name: t.name }));
  }));
  teamsCache = lists.flat();
  teamStore.clear();
  teamsCache.forEach(team => teamStore.set(team.id, team));
  return teamsCache;
}

async function cargarEquipos() {
  const torneos = await obtenerTorneos();
  await fetchTeams(true);
  const eqList = document.getElementById('listaEquipos');
  eqList.innerHTML = '';

  if (!torneos.length) {
    eqList.innerHTML = '<p class="small">No hay torneos disponibles.</p>';
    return;
  }

  torneos.forEach(t => {
    const title = document.createElement('h4');
    title.textContent = t.name;
    eqList.appendChild(title);
    const teams = teamsCache.filter(team => team.tournament_id === t.id);
    if (!teams.length) {
      const empty = document.createElement('p');
      empty.className = 'small';
      empty.textContent = 'Sin equipos cargados.';
      eqList.appendChild(empty);
    } else {
      teams.forEach(team => {
        const item = document.createElement('div');
        item.className = 'item';
        const info = document.createElement('div');
        info.innerHTML = `<strong>${team.emoji || '⚽'} ${team.name}</strong><br><span class="small">Capitán: ${team.captain_name || 'No asignado'}</span>`;
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.innerHTML = `<button class="btn" onclick="openTeamModal(${team.id})">Editar</button>`;
        item.appendChild(info);
        item.appendChild(actions);
        eqList.appendChild(item);
      });
    }
  });

  cargarTorneosEnSelects();
}

async function crearEquipo(e) {
  e.preventDefault();
  const torneo = document.getElementById('eqTorneo').value;
  const name = document.getElementById('eqNombre').value.trim();
  const emoji = document.getElementById('eqEmoji').value.trim();

  const r = await fetch(`${API}/tournaments/${torneo}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, emoji })
  });
  const d = await r.json();

  if (r.ok && d.id) {
    alert(d.fixtureGenerated ? `Equipo creado y fixture generado (${d.rounds} fechas)` : 'Equipo creado');
    document.getElementById('formEquipo').reset();
    await cargarEquipos();
    await fetchCaptains(true);
    if (document.getElementById('seccion-partidos').style.display !== 'none') {
      cargarPartidos();
    }
  } else {
    alert(d.error || 'Error al crear equipo');
  }
}

async function openTeamModal(id) {
  const team = teamStore.get(id);
  if (!team) return;
  editTeamId = id;
  document.getElementById('editTeamName').value = team.name || '';
  document.getElementById('editTeamEmoji').value = team.emoji || '';

  await fetchCaptains();
  fillCaptainOptions(document.getElementById('editTeamCaptain'));
  document.getElementById('editTeamCaptain').value = team.captain_user_id || '';

  document.getElementById('modalTeam').style.display = 'flex';
}

function closeTeamModal() {
  document.getElementById('modalTeam').style.display = 'none';
  editTeamId = null;
}

async function submitEditTeam() {
  if (!editTeamId) return;
  const name = document.getElementById('editTeamName').value.trim();
  const emoji = document.getElementById('editTeamEmoji').value.trim();
  const captain_user_id = document.getElementById('editTeamCaptain').value || null;

  const r = await fetch(`${API}/tournaments/teams/${editTeamId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, emoji, captain_user_id })
  });
  const d = await r.json();
  if (r.ok && d.ok) {
    closeTeamModal();
    await cargarEquipos();
    await cargarCapitanes();
    if (document.getElementById('seccion-partidos').style.display !== 'none') {
      cargarPartidos();
    }
  } else {
    alert(d.error || 'Error al actualizar equipo');
  }
}

/* ---------------------------- 👤 CAPITANES ---------------------------- */
async function fetchCaptains(force = false) {
  if (!force && captainsCache.length) return captainsCache;
  const r = await fetch(`${API}/tournaments/captains`, { headers: authHeaders() });
  if (!r.ok) {
    captainsCache = [];
    captainStore.clear();
    return captainsCache;
  }
  captainsCache = await r.json();
  captainStore.clear();
  captainsCache.forEach(c => captainStore.set(c.id, c));
  return captainsCache;
}

function fillTeamOptions(select, includeEmpty = false) {
  select.innerHTML = '';
  if (includeEmpty) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Seleccionar equipo';
    select.appendChild(opt);
  }
  const ordered = [...teamsCache].sort((a, b) => {
    if (a.tournament_name === b.tournament_name) return a.name.localeCompare(b.name);
    return a.tournament_name.localeCompare(b.tournament_name);
  });
  ordered.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = `${team.name} (${team.tournament_name})`;
    select.appendChild(opt);
  });
}

function fillCaptainOptions(select) {
  select.innerHTML = '';
  const base = document.createElement('option');
  base.value = '';
  base.textContent = 'Sin capitán asignado';
  select.appendChild(base);
  const ordered = [...captainsCache].sort((a, b) => a.name.localeCompare(b.name));
  ordered.forEach(cap => {
    const team = teamsCache.find(t => t.id === cap.team_id);
    const label = team ? `${cap.name} (${team.name})` : cap.name;
    const opt = document.createElement('option');
    opt.value = cap.id;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

async function cargarCapitanes() {
  await fetchTeams();
  await fetchCaptains(true);

  const capSelect = document.getElementById('capEquipo');
  if (teamsCache.length) {
    capSelect.removeAttribute('disabled');
    fillTeamOptions(capSelect);
  } else {
    capSelect.innerHTML = '<option value="">No hay equipos disponibles</option>';
    capSelect.setAttribute('disabled', 'disabled');
  }

  const list = document.getElementById('listaCapitanes');
  list.innerHTML = '';
  if (!captainsCache.length) {
    list.innerHTML = '<p class="small">No hay capitanes registrados.</p>';
  } else {
    captainsCache.forEach(c => {
      const item = document.createElement('div');
      item.className = 'item';
      const team = teamsCache.find(t => t.id === c.team_id);
      const info = document.createElement('div');
      info.innerHTML = `<strong>${c.name}</strong><br><span class="small">${c.email} • ${team ? team.name : 'Sin equipo'}</span>`;
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.innerHTML = `<button class="btn" onclick="openCaptainModal(${c.id})">Editar</button>`;
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  fillTeamOptions(document.getElementById('editCaptainTeam'), true);
}

async function crearCapitan(e) {
  e.preventDefault();
  const name = document.getElementById('capName').value.trim();
  const email = document.getElementById('capEmail').value.trim();
  const password = document.getElementById('capPass').value;
  const team_id = document.getElementById('capEquipo').value;

  const r = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role: 'captain', team_id })
  });
  const d = await r.json();

  if (r.ok && d.token) {
    alert('Capitán creado con éxito');
    document.getElementById('formCapitan').reset();
    await fetchCaptains(true);
    await cargarCapitanes();
    await cargarEquipos();
  } else {
    alert(d.error || 'Error al crear capitán');
  }
}

async function openCaptainModal(id) {
  const captain = captainStore.get(id);
  if (!captain) return;
  editCaptainId = id;
  document.getElementById('editCaptainName').value = captain.name || '';
  document.getElementById('editCaptainEmail').value = captain.email || '';
  document.getElementById('editCaptainPassword').value = '';
  fillTeamOptions(document.getElementById('editCaptainTeam'), true);
  document.getElementById('editCaptainTeam').value = captain.team_id || '';
  document.getElementById('modalCaptain').style.display = 'flex';
}

function closeCaptainModal() {
  document.getElementById('modalCaptain').style.display = 'none';
  editCaptainId = null;
}

async function submitEditCaptain() {
  if (!editCaptainId) return;
  const name = document.getElementById('editCaptainName').value.trim();
  const email = document.getElementById('editCaptainEmail').value.trim();
  const password = document.getElementById('editCaptainPassword').value;
  const team_id = document.getElementById('editCaptainTeam').value || null;

  const r = await fetch(`${API}/tournaments/captains/${editCaptainId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, email, password: password || undefined, team_id })
  });
  const d = await r.json();
  if (r.ok && d.ok) {
    closeCaptainModal();
    await fetchCaptains(true);
    await cargarCapitanes();
    await cargarEquipos();
  } else {
    alert(d.error || 'Error al actualizar capitán');
  }
}

/* ---------------------------- 📅 PARTIDOS ---------------------------- */
async function cargarPartidos() {
  const torneos = await obtenerTorneos();
  const select = document.getElementById('partidosTorneo');
  select.innerHTML = '';
  if (!torneos.length) {
    select.innerHTML = '<option value="">No hay torneos</option>';
    document.getElementById('listaPartidos').innerHTML = '<p class="small">Sin datos</p>';
    document.querySelector('#tablaResultados tbody').innerHTML = '';
    return;
  }
  const current = select.dataset.selected || torneos[0].id;
  torneos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.season})`;
    if (String(t.id) === String(current)) opt.selected = true;
    select.appendChild(opt);
  });
  const torneoId = select.value;
  select.dataset.selected = torneoId;

  const r = await fetch(`${API}/tournaments/${torneoId}/matches`, { headers: authHeaders() });
  if (!r.ok) {
    document.getElementById('listaPartidos').innerHTML = '<p class="small">No hay partidos disponibles.</p>';
    document.querySelector('#tablaResultados tbody').innerHTML = '';
    return;
  }
  matchesCache = await r.json();

  const upcomingContainer = document.getElementById('listaPartidos');
  upcomingContainer.innerHTML = '';
  const upcoming = matchesCache.filter(m => m.status === 'scheduled');
  if (!upcoming.length) {
    upcomingContainer.innerHTML = '<p class="small">No hay partidos programados.</p>';
  } else {
    upcoming.forEach(p => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <div class="teams">
          <div>${p.home_emoji} ${p.home_name}</div>
          vs
          <div>${p.away_emoji} ${p.away_name}</div>
        </div>
        <div class="small">${p.match_date || ''} • ${(p.match_time || '').slice(0,5)} • ${p.location || ''}</div>`;
      upcomingContainer.appendChild(item);
    });
  }

  const tbody = document.querySelector('#tablaResultados tbody');
  tbody.innerHTML = '';
  if (!matchesCache.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="small">Aún no hay fixture generado.</td>';
    tbody.appendChild(tr);
    return;
  }

  const pendingResults = matchesCache.filter(match => {
    const goalsMissing = match.home_goals == null || match.away_goals == null;
    return match.status !== 'played' && goalsMissing;
  });

  if (!pendingResults.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="small">Todos los partidos de este torneo ya tienen resultado.</td>';
    tbody.appendChild(tr);
    return;
  }

  pendingResults.forEach(match => {
    const tr = document.createElement('tr');
    const homeVal = match.home_goals ?? '';
    const awayVal = match.away_goals ?? '';
    tr.innerHTML = `
      <td>${match.match_date || ''}</td>
      <td>Fecha ${match.round}</td>
      <td>${match.home_emoji} ${match.home_name} vs ${match.away_emoji} ${match.away_name}</td>
      <td>
        <div class="result-inputs">
          <input type="number" min="0" id="res-${match.id}-home" value="${homeVal}" class="input-small">
          <span>-</span>
          <input type="number" min="0" id="res-${match.id}-away" value="${awayVal}" class="input-small">
        </div>
      </td>
      <td><button class="btn primary" onclick="guardarResultado(${match.id})">Guardar</button></td>`;
    tbody.appendChild(tr);
  });
}

async function guardarResultado(matchId) {
  const homeInput = document.getElementById(`res-${matchId}-home`);
  const awayInput = document.getElementById(`res-${matchId}-away`);
  const home_goals = parseInt(homeInput.value, 10);
  const away_goals = parseInt(awayInput.value, 10);

  if (Number.isNaN(home_goals) || Number.isNaN(away_goals)) {
    alert('Ingresá goles válidos');
    return;
  }

  const r = await fetch(`${API}/tournaments/matches/${matchId}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ home_goals, away_goals })
  });
  const d = await r.json();
  if (r.ok && d.ok) {
    alert('Resultado actualizado');
    cargarPartidos();
  } else {
    alert(d.error || 'No se pudo guardar el resultado');
  }
}

/* ---------------------------- 🔧 UTILIDADES ---------------------------- */
async function cargarTorneosEnSelects() {
  const torneos = await obtenerTorneos();
  const eqSel = document.getElementById('eqTorneo');
  if (!eqSel) return;
  eqSel.innerHTML = '';
  torneos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.season})`;
    eqSel.appendChild(opt);
  });
}

/* ---------------------------- AUTOLOAD ---------------------------- */
window.addEventListener('load', () => {
  cargarTorneos();
  const torneoStartInput = document.getElementById('torneoStart');
  if (torneoStartInput) {
    torneoStartInput.min = new Date().toISOString().slice(0, 10);
  }
});

window.logout = logout;
