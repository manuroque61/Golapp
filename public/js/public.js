const API = location.origin + '/api';

let tournamentsCache = [];
let currentTournamentId = null;
let activeTab = 'upcoming';
const tableCache = new Map();
const upcomingCache = new Map();
const resultsCache = new Map();

function setActiveButton(tabId) {
  document.querySelectorAll('.nav button').forEach(btn => btn.classList.remove('active'));
  const button = document.getElementById(tabId);
  if (button) button.classList.add('active');
}

async function fetchJson(url) {
  const resp = await fetch(url);
  const isJson = (resp.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await resp.json() : null;
  if (!resp.ok) {
    throw new Error(data?.error || 'No se pudo cargar la información');
  }
  return data;
}

async function fetchTournaments(force = false) {
  if (!force && tournamentsCache.length) return tournamentsCache;
  const data = await fetchJson(API + '/public/tournaments');
  tournamentsCache = Array.isArray(data) ? data : [];
  return tournamentsCache;
}

function populateTournamentSelect() {
  const select = document.getElementById('tournamentSelect');
  if (!select) return;
  if (!tournamentsCache.length) {
    select.innerHTML = '<option value="">Sin torneos</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = tournamentsCache
    .map(t => `<option value="${t.id}">${t.name} (${t.season})</option>`)
    .join('');
  if (currentTournamentId) {
    select.value = String(currentTournamentId);
  }
}

async function ensureTournamentSelected(preferredId) {
  await fetchTournaments();
  if (!tournamentsCache.length) {
    currentTournamentId = null;
    populateTournamentSelect();
    return null;
  }
  const normalized = preferredId ? parseInt(preferredId, 10) : currentTournamentId;
  const exists = tournamentsCache.some(t => t.id === normalized);
  currentTournamentId = exists ? normalized : tournamentsCache[0].id;
  populateTournamentSelect();
  const select = document.getElementById('tournamentSelect');
  if (select) select.value = String(currentTournamentId);
  return currentTournamentId;
}

async function getUpcomingMatches(tournamentId, force = false) {
  if (!tournamentId) return [];
  if (!force && upcomingCache.has(tournamentId)) return upcomingCache.get(tournamentId);
  const data = await fetchJson(`${API}/tournaments/${tournamentId}/upcoming`);
  upcomingCache.set(tournamentId, Array.isArray(data) ? data : []);
  return upcomingCache.get(tournamentId);
}

async function getRecentResults(tournamentId, force = false) {
  if (!tournamentId) return [];
  if (!force && resultsCache.has(tournamentId)) return resultsCache.get(tournamentId);
  const data = await fetchJson(`${API}/public/tournaments/${tournamentId}/results`);
  resultsCache.set(tournamentId, Array.isArray(data) ? data : []);
  return resultsCache.get(tournamentId);
}

async function getTable(tournamentId, force = false) {
  if (!tournamentId) return [];
  if (!force && tableCache.has(tournamentId)) return tableCache.get(tournamentId);
  const data = await fetchJson(`${API}/public/tournaments/${tournamentId}/table`);
  tableCache.set(tournamentId, Array.isArray(data) ? data : []);
  return tableCache.get(tournamentId);
}

function renderMatchRow(match) {
  return `
    <div class="item">
      <div class="teams">
        <div class="team"><div>${match.home_emoji}</div><div>${match.home_name}</div></div>
        <strong>VS</strong>
        <div class="team"><div>${match.away_emoji}</div><div>${match.away_name}</div></div>
      </div>
      <div class="small">${match.match_date || ''} • ${match.match_time ? match.match_time.slice(0, 5) : ''} • ${match.location || 'Por confirmar'}</div>
    </div>
  `;
}

function renderResultRow(match) {
  return `
    <div class="item">
      <div class="teams">
        <div class="team"><div>${match.home_emoji}</div><div>${match.home_name}</div></div>
        <strong>${match.home_goals ?? '-'} - ${match.away_goals ?? '-'}</strong>
        <div class="team"><div>${match.away_emoji}</div><div>${match.away_name}</div></div>
      </div>
      <div class="small">${match.match_date || ''} • ${match.location || ''}</div>
    </div>
  `;
}

async function buscar() {
  const q = document.getElementById('search').value;
  const teams = await fetchJson(API + '/public/search-teams?q=' + encodeURIComponent(q || ''));
  const div = document.getElementById('results');
  div.innerHTML = '';

  if (!teams.length) {
    div.innerHTML = '<p class="small">No se encontraron equipos.</p>';
    return;
  }

  teams.forEach(t => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div class="teams">
        <div class="team">
          <span>${t.emoji}</span>
          <strong>${t.name}</strong>
        </div>
      </div>
    `;
    row.onclick = () => loadTeamInfo(t.id, t.name);
    div.appendChild(row);
  });
}

async function loadTeamInfo(teamId, teamName) {
  const content = document.getElementById('content');
  content.innerHTML = `<h3>${teamName}</h3><p>Cargando información...</p>`;

  try {
    const players = await fetchJson(API + '/raw/players?team=' + teamId);
    const matches = await fetchJson(API + '/public/teams/' + teamId + '/matches');
    const upcoming = matches.filter(m => m.status === 'scheduled');
    const played = matches.filter(m => m.status === 'played');

    let positionHtml = '';
    const tournamentId = matches[0]?.tournament_id;
    if (tournamentId) {
      const table = await getTable(tournamentId);
      const index = table.findIndex(row => row.team_id === teamId);
      if (index >= 0) {
        const row = table[index];
        positionHtml = `<p class="small">Posición actual: ${index + 1}º con ${row.PTS} pts.</p>`;
      }
    }

    const playersHtml = players.length
      ? `<ul>${players
          .map(p => `<li>${p.number || ''} ${p.name} ${p.position ? '— ' + p.position : ''}</li>`)
          .join('')}</ul>`
      : '<p class="small">No hay jugadores cargados.</p>';

    const upcomingHtml = upcoming.length
      ? `<div class="list">${upcoming.map(renderMatchRow).join('')}</div>`
      : '<p class="small">No hay próximos partidos.</p>';

    const playedHtml = played.length
      ? `<div class="list">${played.map(renderResultRow).join('')}</div>`
      : '<p class="small">Aún no hay resultados cargados.</p>';

    content.innerHTML = `
      <h3>${teamName}</h3>
      ${positionHtml}
      <h4>Jugadores</h4>
      ${playersHtml}
      <h4>Próximos partidos</h4>
      ${upcomingHtml}
      <h4>Partidos jugados</h4>
      ${playedHtml}
    `;
  } catch (e) {
    console.error(e);
    content.innerHTML = `<p>Error al cargar información del equipo.</p>`;
  }
}

function renderTableRows(table) {
  if (!table.length) return '<p class="small">No hay posiciones disponibles.</p>';
  const rows = table
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.emoji || '⚽'} ${r.team}</td>
        <td>${r.PJ}</td>
        <td>${r.G}</td>
        <td>${r.E}</td>
        <td>${r.P}</td>
        <td>${r.GF}</td>
        <td>${r.GC}</td>
        <td>${r.DG}</td>
        <td>${r.PTS}</td>
      </tr>
    `)
    .join('');
  return `
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
            <th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadUpcoming(preferredId) {
  activeTab = 'upcoming';
  setActiveButton('tab1');
  const container = document.getElementById('content');
  container.innerHTML = '<p>Cargando próximos partidos...</p>';

  const tournamentId = await ensureTournamentSelected(preferredId);
  if (!tournamentId) {
    container.innerHTML = '<p class="small">No hay torneos disponibles.</p>';
    updateSummary(null);
    return;
  }

  try {
    const [upcoming, results] = await Promise.all([
      getUpcomingMatches(tournamentId, true),
      getRecentResults(tournamentId, true)
    ]);

    const upcomingHtml = upcoming.length
      ? `<div class="list">${upcoming.map(renderMatchRow).join('')}</div>`
      : '<p class="small">No hay partidos programados.</p>';

    const resultsHtml = results.length
      ? `<div class="list">${results.map(renderResultRow).join('')}</div>`
      : '<p class="small">Todavía no hay resultados registrados.</p>';

    container.innerHTML = `
      <h3>Próximos partidos</h3>
      ${upcomingHtml}
      <h3 style="margin-top:24px">Últimos resultados</h3>
      ${resultsHtml}
    `;
    updateSummary(tournamentId);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p class="small">${e.message}</p>`;
    updateSummary(tournamentId);
  }
}

async function loadTable(preferredId) {
  activeTab = 'table';
  setActiveButton('tab2');
  const container = document.getElementById('content');
  container.innerHTML = '<p>Cargando tabla...</p>';

  const tournamentId = await ensureTournamentSelected(preferredId);
  if (!tournamentId) {
    container.innerHTML = '<p class="small">No hay torneos disponibles.</p>';
    updateSummary(null);
    return;
  }

  try {
    const table = await getTable(tournamentId, true);
    container.innerHTML = `
      <h3>Tabla de posiciones</h3>
      ${renderTableRows(table)}
    `;
    updateSummary(tournamentId);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p class="small">${e.message}</p>`;
    updateSummary(tournamentId);
  }
}

async function updateSummary(tournamentId) {
  const container = document.getElementById('summaryContent');
  if (!container) return;

  if (!tournamentId) {
    container.innerHTML = '<p class="small">Seleccioná un torneo para ver el resumen.</p>';
    return;
  }

  container.innerHTML = '<p class="small">Generando resumen...</p>';

  try {
    const [table, upcoming, results] = await Promise.all([
      getTable(tournamentId),
      getUpcomingMatches(tournamentId),
      getRecentResults(tournamentId)
    ]);

    if (!table.length && !upcoming.length && !results.length) {
      container.innerHTML = '<p class="small">Todavía no hay información disponible para este torneo.</p>';
      return;
    }

    const leader = table[0];
    const bestAttack = [...table].sort((a, b) => (b.GF || 0) - (a.GF || 0))[0];
    const bestDefense = [...table].sort((a, b) => (a.GC || 0) - (b.GC || 0))[0];
    const nextMatch = upcoming[0];
    const lastResult = results[0];

    const topFive = table.slice(0, 5).map((row, i) => `
      <li>${i + 1}. ${row.emoji} ${row.team} — ${row.PTS} pts</li>
    `).join('');

    container.innerHTML = `
      <div class="summary-card">
        <h4>Equipos participantes</h4>
        <div class="stat">${table.length || '-'}</div>
      </div>
      ${leader ? `
        <div class="summary-card">
          <h4>Líder actual</h4>
          <div class="stat">${leader.emoji} ${leader.team}</div>
          <p>${leader.PTS} pts • DG ${leader.DG}</p>
        </div>
      ` : ''}
      ${bestAttack ? `
        <div class="summary-card">
          <h4>Mejor ataque</h4>
          <div class="stat">${bestAttack.emoji} ${bestAttack.team}</div>
          <p>${bestAttack.GF} goles a favor</p>
        </div>
      ` : ''}
      ${bestDefense ? `
        <div class="summary-card">
          <h4>Mejor defensa</h4>
          <div class="stat">${bestDefense.emoji} ${bestDefense.team}</div>
          <p>${bestDefense.GC} goles en contra</p>
        </div>
      ` : ''}
      ${nextMatch ? `
        <div class="summary-card">
          <h4>Próximo partido</h4>
          <p>${nextMatch.match_date || ''} • ${nextMatch.match_time ? nextMatch.match_time.slice(0, 5) : ''}</p>
          <p>${nextMatch.home_emoji} ${nextMatch.home_name} vs ${nextMatch.away_emoji} ${nextMatch.away_name}</p>
          <p class="small">${nextMatch.location || 'Por confirmar'}</p>
        </div>
      ` : ''}
      ${lastResult ? `
        <div class="summary-card">
          <h4>Último resultado</h4>
          <p>${lastResult.match_date || ''}</p>
          <p>${lastResult.home_emoji} ${lastResult.home_name} ${lastResult.home_goals ?? '-'} - ${lastResult.away_goals ?? '-'} ${lastResult.away_emoji} ${lastResult.away_name}</p>
        </div>
      ` : ''}
      ${topFive ? `
        <div class="summary-card full">
          <h4>Top 5</h4>
          <ol>${topFive}</ol>
        </div>
      ` : ''}
    `;
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p class="small">${e.message}</p>`;
  }
}

function onTournamentChange(value) {
  ensureTournamentSelected(value).then(() => {
    if (activeTab === 'table') loadTable(currentTournamentId);
    else loadUpcoming(currentTournamentId);
  });
}

function loadActiveTab() {
  if (activeTab === 'table') loadTable(currentTournamentId);
  else loadUpcoming(currentTournamentId);
}

window.addEventListener('load', async () => {
  await ensureTournamentSelected();
  loadActiveTab();
});

// Exponer funciones al scope global
window.buscar = buscar;
window.loadUpcoming = loadUpcoming;
window.loadTable = loadTable;
window.onTournamentChange = onTournamentChange;
window.loadTeamInfo = loadTeamInfo;
