const API = location.origin + '/api';
const token = localStorage.getItem('token');
const teamId = localStorage.getItem('team_id') || 1; // demo

async function agregar() {
  const name = document.getElementById('pname').value;
  const number = parseInt(document.getElementById('pnum').value || 0, 10);
  const position = document.getElementById('ppos').value;
  const r = await fetch(`${API}/tournaments/teams/${teamId}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ name, number, position })
  });
  const d = await r.json();
  if (d.id) { listar(); }
  else alert(d.error || 'Error');
}

async function listar() {
  const list = document.getElementById('players');
  // pequeño endpoint no hecho: leemos directo desde DB via teams? (para simplificar, traemos por público)
  const r = await fetch(`${API}/tournaments/1/teams`, { headers: { 'Authorization': 'Bearer ' + token } });
  const teams = await r.json();
  const me = teams.find(t => t.id == teamId);
  document.getElementById('teamTitle').textContent = (me?.emoji || '⚽') + ' ' + (me?.name || 'Mi Equipo');

  // Pedimos jugadores de ese equipo
  const resp = await fetch(`${location.origin}/api/raw/players?team=${teamId}`).catch(() => null);
  // Fallback si no existe el endpoint (lo evitamos generando uno simple abajo en server? lo haremos simple)
}

function mostrarSeccion(tipo) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const c = document.getElementById('players');
  if (tipo === 'fixture') c.innerHTML = '<h4>Fixture próximamente...</h4>';
  if (tipo === 'posiciones') c.innerHTML = '<h4>Tabla de posiciones próximamente...</h4>';
  if (tipo === 'notificaciones') c.innerHTML = '<h4>No hay notificaciones nuevas.</h4>';
  if (tipo === 'plantilla') listar();
}

window.addEventListener('load', listar);
