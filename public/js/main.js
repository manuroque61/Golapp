const API = location.origin + '/api';

function showMessage(id, message = '', type = 'info') {
  const el = document.getElementById(id);
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'alert';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `alert ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`.trim();
}

async function login() {
  showMessage('loginMessage');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showMessage('loginMessage', 'Ingresa tu email y contraseña para continuar.', 'error');
    return;
  }

  try {
    const r = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await r.json();
    if (!r.ok) {
      showMessage('loginMessage', data.error || 'Usuario o contraseña incorrectos.', 'error');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    if (data.user.role === 'captain') {
      if (data.user.team_id) localStorage.setItem('team_id', data.user.team_id);
      else localStorage.removeItem('team_id');
      location.href = 'team.html';
    } else {
      location.href = 'admin.html';
    }
  } catch (e) {
    showMessage('loginMessage', 'No se pudo iniciar sesión. Intenta nuevamente.', 'error');
  }
}

async function registerUser() {
  showMessage('registerMessage');
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !email || !password) {
    showMessage('registerMessage', 'Completá nombre, email y contraseña.', 'error');
    return;
  }

  try {
    const r = await fetch(API + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'admin' })
    });

    const data = await r.json();
    if (!r.ok) {
      showMessage('registerMessage', data.error || 'No pudimos registrar el usuario.', 'error');
      return;
    }

    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    showMessage('registerMessage', 'Registro exitoso. Ya podés iniciar sesión.', 'success');
  } catch (e) {
    showMessage('registerMessage', 'Error de conexión al registrar. Probá de nuevo.', 'error');
  }
}

