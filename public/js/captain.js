const API = location.origin + '/api';
const token = localStorage.getItem('token');
const storedTeamId = parseInt(localStorage.getItem('team_id'), 10);
const teamId = Number.isInteger(storedTeamId) ? storedTeamId : 1;

if (!token) {
  alert('Debes iniciar sesión para gestionar tu equipo.');
  window.location.href = '/';
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

function limpiarFormulario() {
  document.getElementById('pname').value = '';
  document.getElementById('pnum').value = '';
  document.getElementById('ppos').selectedIndex = 0;
}

function renderPlayers(players) {
  const list = document.getElementById('players');
  list.innerHTML = '';

  if (!players?.length) {
    list.innerHTML = '<p>No hay jugadores cargados todavía.</p>';
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
    name.style.color = 'inherit';
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

async function cargarCabeceraEquipo() {
  try {
    const team = await apiFetch(`${API}/tournaments/teams/${teamId}`);
    const emoji = team?.emoji || '⚽';
    const name = team?.name || 'Mi Equipo';
    document.getElementById('teamTitle').textContent = `${emoji} ${name}`;
  } catch (e) {
    document.getElementById('teamTitle').textContent = 'Mi Equipo';
  }
}

async function agregar() {
  try {
    if (!token) return;
    const name = document.getElementById('pname').value.trim();
    const numberValue = document.getElementById('pnum').value.trim();
    const position = document.getElementById('ppos').value;

    if (!name) {
      alert('Por favor ingresa el nombre del jugador.');
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
  list.innerHTML = '<p>Cargando jugadores...</p>';
  await cargarCabeceraEquipo();

  try {
    if (!token) return;
    const players = await apiFetch(`${API}/tournaments/teams/${teamId}/players`);
    renderPlayers(players);
  } catch (e) {
    list.innerHTML = `<p>${e.message}</p>`;
  }
}

async function editarJugador(player) {
  try {
    if (!token) return;
    const nuevoNombre = prompt('Nombre del jugador', player.name)?.trim();
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

    const nuevaPosicion = prompt('Posición', player.position || '');
    if (nuevaPosicion === null) return;
    const posicionLimpia = nuevaPosicion.trim();

    await apiFetch(`${API}/tournaments/players/${player.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: nuevoNombre, number, position: (posicionLimpia || null) })
    });

    await listar();
  } catch (e) {
    alert(e.message);
  }
}

async function eliminarJugador(player) {
  if (!confirm(`¿Seguro que deseas eliminar a ${player.name}?`)) return;
  try {
    if (!token) return;
    await apiFetch(`${API}/tournaments/players/${player.id}`, { method: 'DELETE' });
    await listar();
  } catch (e) {
    alert(e.message);
  }
}

function mostrarSeccion(tipo, el) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else if (window.event?.target) {
    window.event.target.classList.add('active');
  }

  const c = document.getElementById('players');
  if (tipo === 'fixture') c.innerHTML = '<h4>Fixture próximamente...</h4>';
  if (tipo === 'posiciones') c.innerHTML = '<h4>Tabla de posiciones próximamente...</h4>';
  if (tipo === 'notificaciones') c.innerHTML = '<h4>No hay notificaciones nuevas.</h4>';
  if (tipo === 'plantilla') listar();
}

window.addEventListener('load', listar);
