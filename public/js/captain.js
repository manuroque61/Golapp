const API = location.origin + '/api';
const token = localStorage.getItem('token');

if (!token) {
  location.href = 'index.html';
}

function resolveTeamId() {
  const stored = localStorage.getItem('team_id');
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.team_id) return user.team_id;
  } catch (e) {
    console.warn('No se pudo leer el usuario almacenado', e);
  }
  return null;
}

const teamId = resolveTeamId();

async function agregar() {
  if (!teamId) {
    alert('No tenés un equipo asignado todavía.');
    return;
  }
  const name = document.getElementById('pname').value.trim();
  const number = parseInt(document.getElementById('pnum').value || '0', 10);
  const position = document.getElementById('ppos').value;
  if (!name) {
    alert('Ingresá el nombre del jugador');
    return;
  }
  const response = await fetch(`${API}/tournaments/teams/${teamId}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ name, number: Number.isNaN(number) ? null : number, position }),
  });
  const data = await response.json();
  if (data.id) {
    document.getElementById('pname').value = '';
    document.getElementById('pnum').value = '';
    listar();
  } else {
    alert(data.error || 'No se pudo agregar el jugador');
  }
}

function renderEmptyState(message) {
  const list = document.getElementById('players');
  list.innerHTML = `<div class="empty">${message}</div>`;
}

async function listar() {
  if (!teamId) {
    renderEmptyState('No tenés un equipo asignado todavía.');
    return;
  }
  const list = document.getElementById('players');
  list.innerHTML = '<div class="small">Cargando jugadores...</div>';
  try {
    const resp = await fetch(`${API}/raw/teams/${teamId}`);
    if (!resp.ok) {
      throw new Error('Respuesta no válida');
    }
    const { team, players } = await resp.json();
    const title = document.getElementById('teamTitle');
    if (team) {
      title.textContent = `${team.emoji || '⚽'} ${team.name}`;
    }
    if (!players.length) {
      renderEmptyState('Todavía no hay jugadores cargados.');
      return;
    }
    list.innerHTML = '';
    players.forEach((player) => {
      const item = document.createElement('div');
      item.className = 'item';
      const hasNumber = player.number !== null && player.number !== undefined;
      const numberLabel = hasNumber ? `#${player.number}` : 'S/N';
      item.innerHTML = `
        <div>
          <strong>${player.name}</strong>
          <div class="small">${numberLabel} • ${player.position || 'Sin posición'}</div>
        </div>
      `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error al cargar jugadores', error);
    renderEmptyState('No se pudieron cargar los jugadores.');
  }
}

window.addEventListener('load', listar);
