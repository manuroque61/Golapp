const API = location.origin + '/api';

/** Buscar equipos por nombre y hacerlos clickeables */
async function buscar() {
  const q = document.getElementById('search').value;
  const r = await fetch(API + '/public/search-teams?q=' + encodeURIComponent(q));
  const teams = await r.json();
  const div = document.getElementById('results');
  div.innerHTML = '';

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

/** Mostrar jugadores + partidos (programados y jugados) del equipo seleccionado */
async function loadTeamInfo(teamId, teamName) {
  const content = document.getElementById('content');
  content.innerHTML = `<h3>${teamName}</h3><p>Cargando información...</p>`;

  try {
    // 1) Jugadores
    const rPlayers = await fetch(API + '/raw/players?team=' + teamId);
    const players = await rPlayers.json();

    // 2) Partidos del equipo (todos los estados) - detecta torneo automáticamente
    const rMatches = await fetch(API + '/public/teams/' + teamId + '/matches');
    const matches = await rMatches.json();

    // Separar por estado
    const upcoming = matches.filter(m => m.status === 'scheduled');
    const played   = matches.filter(m => m.status === 'played');

    content.innerHTML = `
      <h3>${teamName}</h3>

      <h4>Jugadores</h4>
      ${
        players.length
          ? `<ul>${players
              .map(p => `<li>${p.number || ''} ${p.name} ${p.position ? '— ' + p.position : ''}</li>`)
              .join('')}</ul>`
          : '<p class="small">No hay jugadores cargados.</p>'
      }

      <h4>Próximos partidos</h4>
      ${
        upcoming.length
          ? `<ul>${upcoming
              .map(m => `
                <li>
                  ${m.match_date || ''} ${m.match_time ? '• ' + m.match_time.slice(0,5) : ''} • ${m.location || ''}
                  — ${m.home_emoji} ${m.home_name} vs ${m.away_emoji} ${m.away_name}
                </li>`)
              .join('')}</ul>`
          : '<p class="small">No hay próximos partidos.</p>'
      }

      <h4>Partidos jugados</h4>
      ${
        played.length
          ? `<ul>${played
              .map(m => `
                <li>
                  ${m.match_date || ''} • ${m.location || ''} — 
                  ${m.home_emoji} ${m.home_name} ${m.home_goals ?? '-'}
                  vs
                  ${m.away_goals ?? '-'} ${m.away_emoji} ${m.away_name}
                </li>`)
              .join('')}</ul>`
          : '<p class="small">Aún no hay resultados cargados.</p>'
      }
    `;
  } catch (e) {
    console.error(e);
    content.innerHTML = `<p>Error al cargar información del equipo.</p>`;
  }
}

/** Cargar tabla de posiciones separada por torneo (pública, sin token) */
async function loadTable() {
  document.getElementById('tab2').classList.add('active');
  document.getElementById('tab1').classList.remove('active');

  const c = document.getElementById('content');
  c.innerHTML = `<p>Cargando tabla...</p>`;

  try {
    // Torneos públicos
    const rTournaments = await fetch(API + '/public/tournaments');
    const tournaments = await rTournaments.json();
    if (!Array.isArray(tournaments) || !tournaments.length) {
      c.innerHTML = `<p class="small">No hay torneos disponibles.</p>`;
      return;
    }

    c.innerHTML = '';
    for (const t of tournaments) {
      const rTable = await fetch(API + `/public/tournaments/${t.id}/table`);
      const rows = await rTable.json();

      const tableHTML = `
        <div class="card">
          <h3>${t.name} (${t.season})</h3>
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
                <th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${r.emoji} ${r.team}</td>
                    <td>${r.PJ}</td><td>${r.G}</td><td>${r.E}</td><td>${r.P}</td>
                    <td>${r.GF}</td><td>${r.GC}</td><td>${r.DG}</td><td>${r.PTS}</td>
                  </tr>`)
                .join('')
              }
            </tbody>
          </table>
        </div>
      `;

      c.innerHTML += tableHTML;
    }
  } catch (e) {
    console.error(e);
    c.innerHTML = `<p>Error al cargar tabla de posiciones.</p>`;
  }
}

/** Pestaña "Próximos Partidos" por defecto (del primer torneo) — opcional */
async function loadUpcoming() {
  document.getElementById('tab1').classList.add('active');
  document.getElementById('tab2').classList.remove('active');

  const c = document.getElementById('content');
  c.innerHTML = `<p>Cargando próximos partidos...</p>`;

  try {
    // Si querés: tomar el primer torneo público y usar sus próximos partidos
    const rTournaments = await fetch(API + '/public/tournaments');
    const tournaments = await rTournaments.json();
    if (!tournaments.length) {
      c.innerHTML = `<p class="small">No hay torneos disponibles.</p>`;
      return;
    }
    const t = tournaments[0];

    const r = await fetch(API + `/tournaments/${t.id}/upcoming`);
    const games = await r.json();

    c.innerHTML = '';
    if (!games.length) {
      c.innerHTML = `<p class="small">No hay próximos partidos.</p>`;
      return;
    }

    games.forEach(g => {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div class="teams">
          <div class="team"><div>${g.home_emoji}</div><div>${g.home_name}</div></div>
          <div>VS</div>
          <div class="team"><div>${g.away_emoji}</div><div>${g.away_name}</div></div>
        </div>
        <div class="small">${g.match_date} • ${g.match_time?.slice(0,5) || ''} • ${g.location || ''}</div>
      `;
      c.appendChild(el);
    });
  } catch (e) {
    console.error(e);
    c.innerHTML = `<p>Error al cargar próximos partidos.</p>`;
  }
}

window.addEventListener('load', () => {
  loadUpcoming(); // pestaña por defecto
});
