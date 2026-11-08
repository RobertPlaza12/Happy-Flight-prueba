// ===== Configuración =====
const RUTA_BD = 'bd/baseDatos.json';
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';

// ===== Parámetros de URL =====
const params = new URLSearchParams(window.location.search);
const usuarioId = params.get('usuarioId') || localStorage.getItem(CLAVE_SESION);

// ===== Referencias DOM =====
const vistaLectura = document.getElementById('vista-lectura');
const vistaEdicion = document.getElementById('vista-edicion');
const btnEditar = document.getElementById('btn-editar-perfil');
const btnCancelar = document.getElementById('btn-cancelar-edicion');
const formPerfil = document.getElementById('form-perfil');
const errorBox = document.getElementById('perfil-error');
const okBox = document.getElementById('perfil-ok');
const tarjetaMillas = document.getElementById('tarjeta-millas');
const contenedorSesion = document.querySelector('.acciones-sesion');

let usuarioCargado = null; // Guarda los datos actuales para rellenar el form

// ===== Utilidades =====
function leerUsuariosExtra() {
  try { return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || []; } catch { return []; }
}

function mostrarError(msg) {
  okBox.hidden = true;
  errorBox.textContent = msg;
  errorBox.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarOk(msg) {
  errorBox.hidden = true;
  okBox.textContent = msg;
  okBox.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { okBox.hidden = true; }, 3000);
}

// ===== UI Usuario (Header) =====
async function actualizarUIUsuario() {
  if (!usuarioId) {
    contenedorSesion.innerHTML = `
      <a href="login.html" class="btn-sesion login">Iniciar sesión</a>
      <a href="registro.html" class="btn-sesion registro">Registrarse</a>
    `;
    return;
  }

  let nombreMostrar = usuarioId;
  try {
    const r = await fetch(RUTA_BD);
    const datos = await r.json();
    const extra = leerUsuariosExtra();
    const user = extra.find(u => u.id === usuarioId) || (datos.usuarios || []).find(u => u.id === usuarioId);
    if (user) nombreMostrar = user.nombre;
  } catch (e) { console.warn('No se pudo cargar el nombre'); }

  contenedorSesion.innerHTML = `
    <a href="reservas.html?usuarioId=${usuarioId}" class="btn-sesion login">Ver Reservas</a>
    <div class="menu-usuario">
      <button class="btn-usuario" id="btn-menu-usuario" aria-haspopup="true" aria-expanded="false">
        <span class="btn-usuario-nombre">${nombreMostrar}</span>
        <span class="btn-usuario-flecha">▾</span>
      </button>
      <div class="dropdown-usuario" id="dropdown-usuario" hidden>
        <a href="perfil.html?usuarioId=${usuarioId}" class="dropdown-item">Ver perfil</a>
        <button type="button" class="dropdown-item cerrar" id="cerrar-sesion">Cerrar sesión</button>
      </div>
    </div>
  `;

  const btnMenu = document.getElementById('btn-menu-usuario');
  const dropdown = document.getElementById('dropdown-usuario');
  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    btnMenu.setAttribute('aria-expanded', String(!dropdown.hidden));
  });
  document.getElementById('cerrar-sesion').addEventListener('click', () => {
    localStorage.removeItem(CLAVE_SESION);
    window.location.href = 'index.html';
  });
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('dropdown-usuario');
  const btnMenu = document.getElementById('btn-menu-usuario');
  if (dropdown && !dropdown.hidden) {
    if (!dropdown.contains(e.target) && !(btnMenu && btnMenu.contains(e.target))) {
      dropdown.hidden = true;
      btnMenu.setAttribute('aria-expanded', 'false');
    }
  }
});

// ===== Carga de Datos =====
async function cargarDatosPerfil() {
  if (!usuarioId) {
    window.location.href = 'registro.html';
    return;
  }

  try {
    const r = await fetch(RUTA_BD);
    const datos = await r.json();
    
    const extra = leerUsuariosExtra();
    const userLocal = extra.find(u => u.id === usuarioId);
    const userBase = (datos.usuarios || []).find(u => u.id === usuarioId);
    
    usuarioCargado = userLocal || userBase;

    if (!usuarioCargado) {
      mostrarError('Usuario no encontrado.');
      return;
    }

    // --- Llenar VISTA LECTURA ---
    document.getElementById('view-nombre').textContent = usuarioCargado.nombre || '-';
    document.getElementById('view-email').textContent = usuarioCargado.email || '-';
    document.getElementById('view-telefono').textContent = usuarioCargado.telefono || '-';
    document.getElementById('view-direccion').textContent = usuarioCargado.direccion || '-';
    document.getElementById('view-tipoCliente').textContent = usuarioCargado.tipoCliente || '-';

    // Mostrar millas si es ejecutivo
    if (usuarioCargado.tipoCliente === 'ejecutivo') {
      tarjetaMillas.hidden = false;
      document.getElementById('perfil-millas').textContent = usuarioCargado.millas || 0;
    } else {
      tarjetaMillas.hidden = true;
    }

  } catch (err) {
    console.error(err);
    mostrarError('Error al cargar el perfil.');
  }
}

// ===== Alternar Vistas =====
btnEditar.addEventListener('click', () => {
  // Llenar el formulario con los datos actuales
  document.getElementById('perfil-nombre').value = usuarioCargado.nombre || '';
  document.getElementById('perfil-email').value = usuarioCargado.email || '';
  document.getElementById('perfil-direccion').value = usuarioCargado.direccion || '';
  document.getElementById('perfil-telefono').value = usuarioCargado.telefono || '';
  document.getElementById('perfil-tipoCliente').value = usuarioCargado.tipoCliente || '';
  document.getElementById('perfil-password').value = ''; // Siempre vacío

  vistaLectura.hidden = true;
  vistaEdicion.hidden = false;
  errorBox.hidden = true;
});

btnCancelar.addEventListener('click', () => {
  vistaEdicion.hidden = true;
  vistaLectura.hidden = false;
  errorBox.hidden = true;
});

// ===== Guardar Cambios =====
formPerfil.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  okBox.hidden = true;

  const nombre = document.getElementById('perfil-nombre').value.trim();
  const password = document.getElementById('perfil-password').value;
  const direccion = document.getElementById('perfil-direccion').value.trim();
  const telefono = document.getElementById('perfil-telefono').value.trim();

  if (!nombre || !direccion || !telefono) {
    mostrarError('Nombre, dirección y teléfono son obligatorios.');
    return;
  }

  if (password && password.length < 4) {
    mostrarError('Si vas a cambiar la contraseña, debe tener al menos 4 caracteres.');
    return;
  }

  try {
    const extra = leerUsuariosExtra();
    const index = extra.findIndex(u => u.id === usuarioId);

    // Tomamos el objeto actual y lo actualizamos
    let usuarioEditado = { ...usuarioCargado };
    usuarioEditado.nombre = nombre;
    usuarioEditado.direccion = direccion;
    usuarioEditado.telefono = telefono;
    if (password) usuarioEditado.password = password; // Solo si escribió algo

    // Guardar en localStorage
    if (index !== -1) {
      extra[index] = usuarioEditado; // Actualizar existente
    } else {
      extra.push(usuarioEditado);    // Clonar base a local
    }
    localStorage.setItem(CLAVE_USUARIOS_EXTRA, JSON.stringify(extra));

    // Actualizar variable local y header
    usuarioCargado = usuarioEditado;
    actualizarUIUsuario();

    // Actualizar la vista de lectura
    document.getElementById('view-nombre').textContent = usuarioEditado.nombre;
    document.getElementById('view-telefono').textContent = usuarioEditado.telefono;
    document.getElementById('view-direccion').textContent = usuarioEditado.direccion;

    // Volver a modo lectura y mostrar éxito
    vistaEdicion.hidden = true;
    vistaLectura.hidden = false;
    mostrarOk('Perfil actualizado correctamente.');
    
  } catch (err) {
    console.error(err);
    mostrarError('Error al guardar los cambios.');
  }
});

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  actualizarUIUsuario();
  cargarDatosPerfil();
});