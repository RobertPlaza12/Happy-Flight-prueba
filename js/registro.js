// ===== Configuración =====
const RUTA_BD = 'bd/baseDatos.json';
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';

// ===== Referencias DOM =====
const formRegistro = document.getElementById('form-registro');
const errorBox = document.getElementById('registro-error');
const okBox = document.getElementById('registro-ok');
const btnRegistro = document.getElementById('btn-registro');

// ===== Utilidades =====
function mostrarError(msg) {
  okBox.hidden = true;
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function mostrarOk(msg) {
  errorBox.hidden = true;
  okBox.textContent = msg;
  okBox.hidden = false;
}

function limpiarMensajes() {
  errorBox.hidden = true;
  okBox.hidden = true;
}

function leerUsuariosExtra() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || [];
  } catch {
    return [];
  }
}

function guardarUsuariosExtra(lista) {
  localStorage.setItem(CLAVE_USUARIOS_EXTRA, JSON.stringify(lista));
}

async function cargarUsuariosBase() {
  try {
    const r = await fetch(RUTA_BD);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const datos = await r.json();
    return Array.isArray(datos.usuarios) ? datos.usuarios : [];
  } catch (err) {
    console.error('Error cargando BD:', err);
    return []; // si falla, al menos permitimos registrar contra los extra
  }
}

function generarId(usuariosExistentes) {
  // IDs tipo U001, U002... basados en el máximo actual + 1
  const numeros = usuariosExistentes
    .map(u => parseInt(String(u.id).replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return 'U' + String(siguiente).padStart(3, '0');
}

// ===== Submit =====
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensajes();

  // Recolectar valores
  const nuevo = {
    nombre: document.getElementById('nombre').value.trim(),
    email: document.getElementById('email').value.trim().toLowerCase(),
    password: document.getElementById('password').value,
    direccion: document.getElementById('direccion').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    tipoCliente: document.getElementById('tipoCliente').value
  };

  // Validaciones básicas
  if (!nuevo.nombre || !nuevo.email || !nuevo.password ||
      !nuevo.direccion || !nuevo.telefono || !nuevo.tipoCliente) {
    mostrarError('Todos los campos son obligatorios.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo.email)) {
    mostrarError('Ingresa un correo electrónico válido.');
    return;
  }

  if (nuevo.password.length < 4) {
    mostrarError('La contraseña debe tener al menos 4 caracteres.');
    return;
  }

  if (!['minorista', 'ejecutivo'].includes(nuevo.tipoCliente)) {
    mostrarError('Selecciona un tipo de cliente válido.');
    return;
  }

  btnRegistro.disabled = true;
  btnRegistro.textContent = 'Creando cuenta…';

  try {
    const usuariosBase = await cargarUsuariosBase();
    const usuariosExtra = leerUsuariosExtra();
    const todos = [...usuariosBase, ...usuariosExtra];

    // Verificar email duplicado
    const existe = todos.some(u => (u.email || '').toLowerCase() === nuevo.email);
    if (existe) {
      mostrarError('Ya existe una cuenta con ese correo.');
      return;
    }

    // Crear usuario con ID único
    const usuario = { id: generarId(todos), ...nuevo };

    // Guardar en extra
    usuariosExtra.push(usuario);
    guardarUsuariosExtra(usuariosExtra);

    // Iniciar sesión automáticamente
    localStorage.setItem(CLAVE_SESION, usuario.id);

    mostrarOk(`¡Cuenta creada! Bienvenido, ${usuario.nombre}.`);

    // Redirigir al index con sesión activa
    setTimeout(() => {
      window.location.href = `index.html?usuarioId=${encodeURIComponent(usuario.id)}`;
    }, 900);

  } catch (err) {
    console.error(err);
    mostrarError('Ocurrió un error al crear la cuenta. Intenta de nuevo.');
  } finally {
    btnRegistro.disabled = false;
    btnRegistro.textContent = 'Crear cuenta';
  }
});