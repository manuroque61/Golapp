const API = location.origin + '/api';

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await r.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.user.role === 'captain') location.href = 'team.html';
    else location.href = 'admin.html';
  }
}

async function registerUser() {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const role = "admin";

  const r = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await r.json();
  if (data.token) {
    alert('Registro exitoso, ahora podés iniciar sesión');
    location.href = 'index.html';
  } else {
    alert(data.error || 'Error al registrar');
  }
}

