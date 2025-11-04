const API = location.origin + '/api';
const token = localStorage.getItem('token');
if (!token) location.href = 'index.html';

// Estado de modales
let editTournamentId = null;
let fixtureTournamentId = null;

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
async function cargarTorneos() {
  const r = await fetch(API + '/tournaments', { headers: { 'Authorization': 'Bearer ' + token } });
  const data = await r.json();

  const tbody = document.querySelector('#tablaTorneos tbody');
  tbody.innerHTML = '';

  for (const t of data) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.season}</td>
      <td><span class="badge-sm">${t.status}</span></td>
      <td>
        <button class="btn" onclick="openEditModal(${t.id}, '${t.name.replace(/'/g,"\\'")}', ${t.season}, '${t.status}')">Editar</button>
        <button class="btn primary" onclick="openFixtureModal(${t.id})">Fixture</button>
      </td>`;
    tbody.appendChild(tr);
  }

  cargarTorneosEnSelects();
}

async function crearTorneo(e) {
  e.preventDefault();
  const name = document.getElementById('torneoName').value;
  const season = document.getElementById('torneoSeason').value;
  const startDate = document.getElementById('torneoStart').value;
  const time = document.getElementById('torneoTime').value + ':00';
  const location = document.getElementById('torneoCancha').value;

  const r = await fetch(API + '/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ name, season })
  });
  const d = await r.json();

  if (d.id) {
    await fetch(`${API}/tournaments/${d.id}/generate-fixture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ startDate, time, location })
    });
    alert('Torneo creado y fixture generado');
    cargarTorneos();
  } else {
    alert(d.error || 'Error al crear torneo');
  }
}

/* ----------- Modal Editar Torneo ----------- */
function openEditModal(id, name, season, status){
  editTournamentId = id;
  
  // Previene valores null
  document.getElementById('editName').value = name ?? '';
  document.getElementById('editSeason').value = season ?? new Date().getFullYear();
  document.getElementById('editStatus').value = status ?? 'active';
  
  document.getElementById('modalEdit').style.display = 'flex';
}

function closeEditModal(){
  document.getElementById('modalEdit').style.display = 'none';
  editTournamentId = null;
}
async function submitEditTournament(){
  const nameField = document.getElementById('editName');
  const seasonField = document.getElementById('editSeason');
  const statusField = document.getElementById('editStatus');

  const name = nameField?.value.trim() || '';
  const season = seasonField?.value.trim() || '';
  const status = statusField?.value || 'active';

  if(!editTournamentId || !name || !season){
    alert('Por favor completá todos los campos antes de guardar.');
    return;
  }

  try {
    const r = await fetch(API + '/tournaments/' + editTournamentId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name, season, status })
    });
    const d = await r.json();
    if(d.ok){
      closeEditModal();
      cargarTorneos();
      alert('Torneo actualizado con éxito');
    } else {
      alert(d.error || 'Error al actualizar el torneo');
    }
  } catch (err) {
    console.error('Error al enviar actualización:', err);
    alert('Error de conexión con el servidor.');
  }
}


/* ----------- Modal Generar Fixture ----------- */
function openFixtureModal(id){
  fixtureTournamentId = id;
  document.getElementById('fxStart').value = new Date().toISOString().slice(0,10);
  document.getElementById('fxTime').value = '16:00';
  document.getElementById('fxLocation').value = 'Cancha A';
  document.getElementById('modalFixture').style.display = 'flex';
}
function closeFixtureModal(){
  document.getElementById('modalFixture').style.display = 'none';
  fixtureTournamentId = null;
}
async function submitGenerateFixture(){
  const startDate = document.getElementById('fxStart').value;
  const time = document.getElementById('fxTime').value + ':00';
  const location = document.getElementById('fxLocation').value.trim();

  if(!fixtureTournamentId || !startDate || !time || !location){
    return alert('Completá todos los campos');
  }

  const r = await fetch(`${API}/tournaments/${fixtureTournamentId}/generate-fixture`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body: JSON.stringify({ startDate, time, location })
  });
  const d = await r.json();
  if(d.ok){
    closeFixtureModal();
    alert(`Fixture generado (${d.rounds} fechas)`);
  } else {
    alert(d.error || 'No se pudo generar el fixture (verifica que existan 2+ equipos)');
  }
}

/* ---------------------------- ⚽ EQUIPOS ---------------------------- */
async function cargarEquipos() {
  const eqList = document.getElementById('listaEquipos');
  eqList.innerHTML = '';
  const torneos = await obtenerTorneos();

  for (const t of torneos) {
    const r = await fetch(API + '/tournaments/' + t.id + '/teams', { headers: { 'Authorization': 'Bearer ' + token } });
    const teams = await r.json();
    eqList.innerHTML += `<h4>${t.name}</h4>`;
    teams.forEach(e => {
      eqList.innerHTML += `<div class="item"><span>${e.emoji}</span> ${e.name}</div>`;
    });
  }
  cargarTorneosEnSelects();
}

async function crearEquipo(e) {
  e.preventDefault();
  const torneo = document.getElementById('eqTorneo').value;
  const name = document.getElementById('eqNombre').value;
  const emoji = document.getElementById('eqEmoji').value || '⚽';

  const r = await fetch(API + `/tournaments/${torneo}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ name, emoji })
  });
  const d = await r.json();

  if (d.id) {
    alert('Equipo creado');
    cargarEquipos();
  } else {
    alert(d.error || 'Error al crear equipo');
  }
}

/* ---------------------------- 👤 CAPITANES ---------------------------- */
async function cargarCapitanes() {
  const eqSelect = document.getElementById('capEquipo');
  eqSelect.innerHTML = '';
  const torneos = await obtenerTorneos();

  for (const t of torneos) {
    const r = await fetch(API + '/tournaments/' + t.id + '/teams', { headers: { 'Authorization': 'Bearer ' + token } });
    const teams = await r.json();
    teams.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${t.name})`;
      eqSelect.appendChild(opt);
    });
  }
}

async function crearCapitan(e) {
  e.preventDefault();
  const name = document.getElementById('capName').value;
  const email = document.getElementById('capEmail').value;
  const password = document.getElementById('capPass').value;
  const team_id = document.getElementById('capEquipo').value;

  const r = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role: 'captain', team_id })
  });
  const d = await r.json();

  if (d.token) {
    alert('Capitán creado con éxito');
    document.getElementById('formCapitan').reset();
  } else {
    alert(d.error || 'Error al crear capitán');
  }
}

/* ---------------------------- 📅 PARTIDOS ---------------------------- */
async function cargarPartidos() {
  const torneos = await obtenerTorneos();
  const select = document.getElementById('partidosTorneo');
  const lista = document.getElementById('listaPartidos');

  if (select.options.length === 0) {
    torneos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.season})`;
      select.appendChild(opt);
    });
  }

  const torneoId = select.value || torneos[0]?.id;
  const r = await fetch(API + `/tournaments/${torneoId}/upcoming`);
  const data = await r.json();

  lista.innerHTML = '';
  data.forEach(p => {
    lista.innerHTML += `
      <div class="item">
        <div class="teams">
          <div>${p.home_emoji} ${p.home_name}</div> 
          vs 
          <div>${p.away_emoji} ${p.away_name}</div>
        </div>
        <div class="small">${p.match_date} • ${p.match_time?.slice(0,5) || ''} • ${p.location}</div>
      </div>`;
  });
}

/* ---------------------------- 🔧 UTILIDADES ---------------------------- */
async function obtenerTorneos() {
  const r = await fetch(API + '/tournaments', { headers: { 'Authorization': 'Bearer ' + token } });
  return await r.json();
}

async function cargarTorneosEnSelects() {
  const torneos = await obtenerTorneos();
  const eqSel = document.getElementById('eqTorneo');
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
});
