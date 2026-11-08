// ===== Configuración =====
const RUTA_BD = 'bd/baseDatos.json';
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';

// ===== Referencias DOM =====
const formLogin = document.getElementById('form-login');
const inputEmail = document.getElementById('email');
const inputPassword = document.getElementById('password');
const errorBox = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');

// ===== Utilidades =====
function mostrarError(mensaje) {
  errorBox.textContent = mensaje;
  errorBox.hidden = false;
}

function limpiarError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function leerUsuariosExtra() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || [];
  } catch {
    return [];
  }
}

function cargarUsuarios() {
  return fetch(RUTA_BD)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(datos => {
      const base = Array.isArray(datos.usuarios) ? datos.usuarios : [];
      const agentes = Array.isArray(datos.agenteBoleto) ? datos.agenteBoleto : [];
      // Unimos ambos arrays para que el login acepte a los dos
      return [...base, ...agentes, ...leerUsuariosExtra()];
    })
    .catch(err => {
      console.error('Error cargando BD:', err);
      return leerUsuariosExtra();
    });
}

function iniciarSesion(usuarioId) {
  localStorage.setItem(CLAVE_SESION, usuarioId);
  window.location.href = `index.html?usuarioId=${encodeURIComponent(usuarioId)}`;
}

// ===== Manejo del submit =====
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarError();

  const email = inputEmail.value.trim().toLowerCase();
  const password = inputPassword.value;

  if (!email || !password) {
    mostrarError('Completa todos los campos.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Verificando…';

  try {
    const usuarios = await cargarUsuarios();

    const usuario = usuarios.find(u =>
      (u.email || '').toLowerCase() === email && u.password === password
    );

    if (!usuario) {
      mostrarError('Correo o contraseña incorrectos.');
      return;
    }

    iniciarSesion(usuario.id);

  } catch (err) {
    mostrarError('No se pudo conectar con el servidor. Intenta de nuevo.');
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Entrar';
  }
});