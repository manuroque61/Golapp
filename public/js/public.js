const API = location.origin + '/api';

async function buscar(){
  const q = document.getElementById('search').value;
  const r = await fetch(API + '/public/search-teams?q=' + encodeURIComponent(q));
  const teams = await r.json();
  const div = document.getElementById('results');
  div.innerHTML = '';
  teams.forEach(t => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div class="teams"><div class="team"><span>${t.emoji}</span><strong>${t.name}</strong></div></div>`;
    div.appendChild(row);
  });
}

async function loadUpcoming(){
  document.getElementById('tab1').classList.add('active');
  document.getElementById('tab2').classList.remove('active');

  const r = await fetch(API + '/tournaments/1/upcoming');
  const games = await r.json();
  const c = document.getElementById('content');
  c.innerHTML = '';
  games.forEach(g => {
    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="teams">
        <div class="team"><div>${g.home_emoji}</div><div>${g.home_name}</div></div>
        <div>VS</div>
        <div class="team"><div>${g.away_emoji}</div><div>${g.away_name}</div></div>
      </div>
      <div class="small">${g.match_date} • ${g.match_time?.slice(0,5)} • ${g.location}</div>
    `;
    c.appendChild(el);
  });
}

async function loadTable(){
  document.getElementById('tab2').classList.add('active');
  document.getElementById('tab1').classList.remove('active');

  const r = await fetch(API + '/tournaments/1/table');
  const rows = await r.json();
  const c = document.getElementById('content');
  c.innerHTML = `
    <table class="table">
      <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  `;
  const tbody = document.getElementById('tbody');
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.emoji} ${r.team}</td><td>${r.PJ}</td><td>${r.G}</td><td>${r.E}</td><td>${r.P}</td><td>${r.GF}</td><td>${r.GC}</td><td>${r.DG}</td><td>${r.PTS}</td>`;
    tbody.appendChild(tr);
  });
}

window.addEventListener('load', ()=>{
  loadUpcoming();
});
