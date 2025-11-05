const API = location.origin + '/api';

async function fetchJson(url) {
  const resp = await fetch(url);
  const isJson = (resp.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await resp.json() : null;
  if (!resp.ok) {
    throw new Error(data?.error || 'No se pudo cargar la información solicitada');
  }
  return data;
}

function showCard(card, visible) {
  if (!card) return;
  card.classList.toggle('hidden', !visible);
}

function renderFixtureRow(match, teamId) {
  const homeClass = match.home_team_id === teamId ? 'highlight-team' : '';
  const awayClass = match.away_team_id === teamId ? 'highlight-team' : '';
  const isPlayed = match.status === 'played';
  const score = isPlayed
    ? `<strong>${match.home_goals ?? 0} - ${match.away_goals ?? 0}</strong>`
    : '<strong>vs</strong>';
  const date = match.match_date || 'Fecha a confirmar';
  const time = match.match_time ? match.match_time.slice(0, 5) : '';
  const location = match.location || 'Por confirmar';

  return `
    <div class="item">
      <div class="teams">
        <div class="team ${homeClass}">${match.home_emoji || '⚽'} ${match.home_name}</div>
        ${score}
        <div class="team ${awayClass}">${match.away_emoji || '⚽'} ${match.away_name}</div>
      </div>
      <div class="small">${date}${time ? ' • ' + time : ''} • ${location}</div>
    </div>
  `;
}

function renderPlayersList(players) {
  if (!players.length) {
    return '<p class="small">No hay jugadores cargados.</p>';
  }
  const items = players
    .map(player => `
      <li>
        <strong>${player.number ? player.number + ' - ' : ''}${player.name}</strong>
        ${player.position ? `<span>${player.position}</span>` : ''}
      </li>
    `)
    .join('');
  return `<ul class="players-list">${items}</ul>`;
}

function renderTable(table, teamId) {
  if (!table.length) {
    return '<p class="small">Todavía no hay tabla disponible.</p>';
  }
  const rows = table
    .map((row, index) => {
      const highlight = row.team_id === teamId ? ' class="highlight"' : '';
      return `
        <tr${highlight}>
          <td>${index + 1}</td>
          <td>${row.emoji || '⚽'} ${row.team}</td>
          <td>${row.PJ}</td>
          <td>${row.G}</td>
          <td>${row.E}</td>
          <td>${row.P}</td>
          <td>${row.GF}</td>
          <td>${row.GC}</td>
          <td>${row.DG}</td>
          <td>${row.PTS}</td>
        </tr>
      `;
    })
    .join('');

  return `
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

async function buscar() {
  const q = document.getElementById('search').value;
  const div = document.getElementById('results');
  div.innerHTML = '<p class="small">Buscando equipos...</p>';

  try {
    const teams = await fetchJson(API + '/public/search-teams?q=' + encodeURIComponent(q || ''));
    if (!teams.length) {
      div.innerHTML = '<p class="small">No se encontraron equipos.</p>';
      return;
    }

    div.innerHTML = '';
    teams.forEach(team => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div class="teams">
          <div class="team">
            <span>${team.emoji || '⚽'}</span>
            <strong>${team.name}</strong>
          </div>
        </div>
      `;
      row.onclick = () => loadTeamInfo(team.id, team.name);
      div.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    div.innerHTML = '<p class="small">No pudimos realizar la búsqueda.</p>';
  }
}

async function loadTeamInfo(teamId, fallbackName) {
  const teamCard = document.getElementById('teamCard');
  const fixtureCard = document.getElementById('fixtureCard');
  const playersCard = document.getElementById('playersCard');
  const tableCard = document.getElementById('tableCard');
  const teamTitleEl = document.getElementById('teamTitle');
  const teamTournamentEl = document.getElementById('teamTournament');
  const teamPositionEl = document.getElementById('teamPosition');
  const fixtureContent = document.getElementById('fixtureContent');
  const playersContent = document.getElementById('playersContent');
  const tableContent = document.getElementById('tableContent');

  showCard(teamCard, true);
  showCard(fixtureCard, true);
  showCard(playersCard, true);
  showCard(tableCard, true);

  teamTitleEl.textContent = fallbackName || 'Equipo seleccionado';
  teamTournamentEl.textContent = 'Cargando información del torneo...';
  teamPositionEl.textContent = 'Buscando posición en la tabla...';
  fixtureContent.innerHTML = '<p class="small">Cargando fixture...</p>';
  playersContent.innerHTML = '<p class="small">Cargando jugadores...</p>';
  tableContent.innerHTML = '<p class="small">Cargando tabla...</p>';

  let teamInfo = null;
  try {
    teamInfo = await fetchJson(`${API}/public/teams/${teamId}/info`);
    teamTitleEl.textContent = `${teamInfo.emoji || '⚽'} ${teamInfo.name}`;
    if (teamInfo.tournament_name) {
      const season = teamInfo.season ? ` (${teamInfo.season})` : '';
      teamTournamentEl.textContent = `Torneo: ${teamInfo.tournament_name}${season}`;
    } else {
      teamTournamentEl.textContent = 'Este equipo todavía no está asociado a un torneo.';
    }
  } catch (infoError) {
    console.error(infoError);
    teamTournamentEl.textContent = 'No pudimos obtener información del torneo.';
  }

  try {
    const [players, matches] = await Promise.all([
      fetchJson(`${API}/raw/players?team=${teamId}`),
      fetchJson(`${API}/public/teams/${teamId}/matches`)
    ]);

    playersContent.innerHTML = renderPlayersList(players);
    fixtureContent.innerHTML = matches.length
      ? `<div class="list">${matches.map(match => renderFixtureRow(match, teamId)).join('')}</div>`
      : '<p class="small">Todavía no hay partidos programados para este equipo.</p>';

    const tournamentId = teamInfo?.tournament_id || matches[0]?.tournament_id;
    if (tournamentId) {
      try {
        const table = await fetchJson(`${API}/public/tournaments/${tournamentId}/table`);
        if (table.length) {
          tableContent.innerHTML = renderTable(table, teamId);
          const index = table.findIndex(row => row.team_id === teamId);
          if (index >= 0) {
            const current = table[index];
            teamPositionEl.textContent = `Posición actual: ${index + 1}º con ${current.PTS} pts.`;
          } else {
            teamPositionEl.textContent = 'Tu equipo todavía no aparece en la tabla.';
          }
        } else {
          tableContent.innerHTML = '<p class="small">La tabla todavía no está disponible.</p>';
          teamPositionEl.textContent = 'La tabla del torneo aún no está disponible.';
        }
      } catch (tableError) {
        console.error(tableError);
        tableContent.innerHTML = '<p class="small">No pudimos cargar la tabla.</p>';
        teamPositionEl.textContent = 'No pudimos cargar la posición del equipo.';
      }
    } else {
      tableContent.innerHTML = '<p class="small">Todavía no hay información de la tabla para este equipo.</p>';
      teamPositionEl.textContent = 'Todavía no hay información de la tabla para este equipo.';
    }
  } catch (dataError) {
    console.error(dataError);
    playersContent.innerHTML = '<p class="small">No pudimos cargar los jugadores.</p>';
    fixtureContent.innerHTML = '<p class="small">No pudimos cargar el fixture del equipo.</p>';
    tableContent.innerHTML = '<p class="small">No pudimos cargar la tabla.</p>';
    teamPositionEl.textContent = 'No pudimos cargar la posición del equipo.';
  }
}

window.buscar = buscar;
window.loadTeamInfo = loadTeamInfo;

