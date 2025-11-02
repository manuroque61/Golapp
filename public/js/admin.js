const API = location.origin + '/api';
const token = localStorage.getItem('token');
if(!token) location.href='index.html';

async function crearTorneo(){
  const name = prompt('Nombre del torneo','Torneo Apertura');
  const season = prompt('Temporada (YYYY)','2025');
  if(!name||!season) return;
  const r = await fetch(API+'/tournaments',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name,season})
  });
  const d = await r.json();
  if(d.id){ cargar(); }
  else alert(d.error||'Error');
}

async function generarFixture(id){
  const startDate = prompt('Fecha de inicio (YYYY-MM-DD)','2025-03-01');
  const time = prompt('Hora (HH:MM)','16:00');
  const location = prompt('Cancha','Cancha A');
  const r = await fetch(`${API}/tournaments/${id}/generate-fixture`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({startDate,time:time+':00',location})
  });
  const d = await r.json();
  if(d.ok){ alert('Fixture generado'); cargar(); }
  else alert(d.error||'Error');
}

async function cargar(){
  const r = await fetch(API+'/tournaments',{headers:{'Authorization':'Bearer '+token}});
  const torneos = await r.json();
  const tbody = document.querySelector('#torneosTable tbody');
  tbody.innerHTML = '';
  for(const t of torneos){
    // contar equipos
    const rTeams = await fetch(`${API}/tournaments/${t.id}/teams`,{headers:{'Authorization':'Bearer '+token}});
    const teams = await rTeams.json();
    const fechas = teams.length ? teams.length-1 : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.name}</td><td>${t.season}</td><td>${teams.length}</td><td>${fechas}</td><td>${t.status}</td>
      <td>
        <button class="btn" onclick="agregarEquipo(${t.id})">+ Equipo</button>
        <button class="btn primary" onclick="generarFixture(${t.id})">Fixture</button>
      </td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('kTournaments').innerText = torneos.length;
  // aproximado de equipos
  let totalTeams = 0;
  for(const t of torneos){
    const rTeams = await fetch(`${API}/tournaments/${t.id}/teams`,{headers:{'Authorization':'Bearer '+token}});
    const teams = await rTeams.json();
    totalTeams += teams.length;
  }
  document.getElementById('kTeams').innerText = totalTeams;
}

async function agregarEquipo(tournamentId){
  const name = prompt('Nombre del equipo');
  if(!name) return;
  const emoji = prompt('Emoji','🐯');
  const r = await fetch(`${API}/tournaments/${tournamentId}/teams`,{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name, emoji})
  });
  const d = await r.json();
  if(d.id) cargar(); else alert(d.error||'Error');
}

window.addEventListener('load', async ()=>{
  const span = document.getElementById('uName');
  try{
    const user = JSON.parse(localStorage.getItem('user')||'{}');
    span.textContent = (user?.name||'Admin') + ' ('+(user?.role||'')+')';
  }catch{}
  cargar();
});
