const API = location.origin + '/api';

async function login(){
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const r = await fetch(API + '/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data = await r.json();
  if(data.token){
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    location.href = 'admin.html';
  }else{
    alert(data.error||'Error');
  }
}

async function demoRegister(){
  alert('Para registrarte rápido usá los usuarios demo del README o creá uno nuevo en /api/auth/register con Postman.');
}
