const RUTA_BD = 'bd/baseDatos.json';
const CLAVE_VUELOS_EXTRA = 'hf_vuelos_extra';
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';

const params = new URLSearchParams(window.location.search);
// Si no hay ID en la URL, revisa el localStorage
const agenteId = params.get('agenteId') || localStorage.getItem(CLAVE_SESION);

let esAgente = false;
let vuelosGlobal = [];
let vueloEditando = null;

// ===== Referencias DOM =====
const listaAdmin = document.getElementById('lista-admin');
const formBusqueda = document.getElementById('form-busqueda-admin');
const formEditar = document.getElementById('form-editar-vuelo');
const modalEditar = document.getElementById('modal-editar');
const editError = document.getElementById('edit-error');
const contenedorSesion = document.querySelector('.acciones-sesion');

// ===== Utilidades =====
function formatearPrecio(n) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n);
}

function leerVuelosExtra() {
  try { return JSON.parse(localStorage.getItem(CLAVE_VUELOS_EXTRA)) || []; } catch { return []; }
}

function leerUsuariosExtra() {
  try { return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || []; } catch { return []; }
}

function esVueloVencidoODeHoy(fechaVuelo) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaVuelo}T00:00:00`);
  return fecha <= hoy;
}

// ===== UI Usuario (Header) =====
async function actualizarUIUsuario() {
  if (!contenedorSesion) return;

  if (!agenteId) {
    contenedorSesion.innerHTML = `
      <a href="login.html" class="btn-sesion login">Iniciar sesión</a>
      <a href="registro.html" class="btn-sesion registro">Registrarse</a>
    `;
    return;
  }

  let nombreMostrar = agenteId;
  try {
    const r = await fetch(RUTA_BD);
    const datos = await r.json();
    const extra = leerUsuariosExtra();
    const user = extra.find(u => u.id === agenteId) || 
                 (datos.usuarios || []).find(u => u.id === agenteId) || 
                 (datos.agenteBoleto || []).find(u => u.id === agenteId);
    if (user) nombreMostrar = user.nombre;
  } catch (e) { console.warn('No se pudo cargar el nombre'); }

  // Renderizamos el menú normal (sin el botón verde de admin, porque ya estamos en esa página)
  contenedorSesion.innerHTML = `
    <a href="reservas.html?usuarioId=${agenteId}" class="btn-sesion login">Ver Reservas</a>
    <div class="menu-usuario">
      <button class="btn-usuario" id="btn-menu-usuario" aria-haspopup="true" aria-expanded="false">
        <span class="btn-usuario-nombre">${nombreMostrar}</span>
        <span class="btn-usuario-flecha">▾</span>
      </button>
      <div class="dropdown-usuario" id="dropdown-usuario" hidden>
        <a href="perfil.html?usuarioId=${agenteId}" class="dropdown-item">Ver perfil</a>
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

// Listener global para cerrar menú
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

// ===== Lógica de Render =====
function renderizarVuelosAdmin(lista) {
  listaAdmin.innerHTML = '';
  if (!lista.length) {
    listaAdmin.innerHTML = '<p class="mensaje">No se encontraron vuelos.</p>';
    return;
  }

  const fragmento = document.createDocumentFragment();

  lista.forEach(vuelo => {
    const card = document.createElement('article');
    card.className = 'vuelo';

    const esVencido = esVueloVencidoODeHoy(vuelo.fechaSalida);
    
    // El botón siempre está activo para que el usuario pueda intentar guardar (y reciba el error)
    const botonEditar = `<button class="btn-sesion login" style="width: 100%; margin-top: 10px; border-color: var(--azul); color: var(--azul);" data-id="${vuelo.id}">Editar Vuelo</button>`;

    card.innerHTML = `
      <h3>${vuelo.origen} → ${vuelo.destino} ${esVencido ? '<span style="font-size:0.7rem; background:#c0392b; color:white; padding:2px 6px; border-radius:4px; vertical-align:middle;">Vencido</span>' : ''}</h3>
      <p><strong>ID:</strong> ${vuelo.id}</p>
      <p><strong>Fecha:</strong> ${vuelo.fechaSalida} · <strong>Hora:</strong> ${vuelo.horaSalida}</p>
      <p><strong>Asientos disp:</strong> ${vuelo.asientosDisponibles || 'N/A'}</p>
      <p><strong>Precio:</strong> ${formatearPrecio(vuelo.precio)}</p>
      ${botonEditar}
    `;

    card.querySelector('button[data-id]').addEventListener('click', () => abrirModalEditar(vuelo));

    fragmento.appendChild(card);
  });

  listaAdmin.appendChild(fragmento);
}

// ===== Carga de Datos =====
async function cargarDatos() {
  try {
    const r = await fetch(RUTA_BD);
    const datos = await r.json();

    // Verificar si es agente (para bloquear o no la edición)
    esAgente = (datos.agenteBoleto || []).some(a => a.id === agenteId);

    // Combinar vuelos del JSON con los editados
    const baseVuelos = datos.vuelos || [];
    const extraVuelos = leerVuelosExtra();

    const mapaVuelos = new Map();
    baseVuelos.forEach(v => mapaVuelos.set(v.id, v));
    extraVuelos.forEach(v => mapaVuelos.set(v.id, v));

    vuelosGlobal = Array.from(mapaVuelos.values());

    actualizarUIUsuario();
    renderizarVuelosAdmin(vuelosGlobal);

  } catch (err) {
    console.error(err);
    listaAdmin.innerHTML = '<p class="mensaje">Error al cargar la base de datos.</p>';
  }
}

// ===== Búsqueda =====
formBusqueda.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('filtro-id').value.trim().toLowerCase();
  const origen = document.getElementById('filtro-origen').value.trim().toLowerCase();
  const destino = document.getElementById('filtro-destino').value.trim().toLowerCase();
  const fecha = document.getElementById('filtro-fecha').value;

  const filtrados = vuelosGlobal.filter(v => {
    const cId = !id || v.id.toLowerCase().includes(id);
    const cOri = !origen || v.origen.toLowerCase().includes(origen);
    const cDes = !destino || v.destino.toLowerCase().includes(destino);
    const cFec = !fecha || v.fechaSalida === fecha;
    return cId && cOri && cDes && cFec;
  });

  renderizarVuelosAdmin(filtrados);
});

// ===== Modal de Edición =====
function abrirModalEditar(vuelo) {
  vueloEditando = vuelo;
  document.getElementById('edit-vuelo-id').textContent = vuelo.id;
  document.getElementById('edit-origen').value = vuelo.origen;
  document.getElementById('edit-destino').value = vuelo.destino;
  document.getElementById('edit-fecha').value = vuelo.fechaSalida;
  document.getElementById('edit-hora').value = vuelo.horaSalida;
  document.getElementById('edit-precio').value = vuelo.precio;
  document.getElementById('edit-asientos').value = vuelo.asientosDisponibles || 0;

  editError.hidden = true;

  // Mensaje extra si no es agente (para que sepa que no podrá guardar)
 /* if (!esAgente) {
    editError.textContent = '⚠️ Modo lectura: No tienes permisos de Agente para guardar cambios.';
    editError.style.background = '#fff8e1';
    editError.style.color = '#b28500';
    editError.style.borderLeft = '4px solid #ffe082';
    editError.hidden = false;
  } else if (esVueloVencidoODeHoy(vuelo.fechaSalida)) {
    editError.textContent = '⚠️ Este vuelo ya está vencido o es hoy. Podrás ver los datos, pero al intentar guardar el sistema rechazará la edición.';
    editError.style.background = '#fff8e1';
    editError.style.color = '#b28500';
    editError.style.borderLeft = '4px solid #ffe082';
    editError.hidden = false;
  }*/

  modalEditar.hidden = false;
}

document.getElementById('btn-cerrar-editar').addEventListener('click', () => modalEditar.hidden = true);
document.getElementById('btn-cancelar-edit').addEventListener('click', () => modalEditar.hidden = true);

// ===== Guardar Cambios =====
formEditar.addEventListener('submit', (e) => {
  e.preventDefault();
  editError.hidden = true;

  // 1. Validar que sea Agente
  if (!esAgente) {
    editError.textContent = 'Acceso denegado: No tienes los permisos requeridos para editar vuelos.';
    editError.style.background = '#fdecea';
    editError.style.color = '#c0392b';
    editError.style.borderLeft = '4px solid #c0392b';
    editError.hidden = false;
    return;
  }

  // 2. Validar que no sea un vuelo vencido
  if (esVueloVencidoODeHoy(vueloEditando.fechaSalida)) {
    editError.textContent = 'No se puede editar un vuelo que ya venció o que es para el día de hoy.';
    editError.style.background = '#fdecea';
    editError.style.color = '#c0392b';
    editError.style.borderLeft = '4px solid #c0392b';
    editError.hidden = false;
    return;
  }

  const nuevaFecha = document.getElementById('edit-fecha').value;

  // 3. Validar nueva fecha
  if (esVueloVencidoODeHoy(nuevaFecha)) {
    editError.textContent = 'La nueva fecha no puede ser hoy ni en el pasado.';
    editError.style.background = '#fdecea';
    editError.style.color = '#c0392b';
    editError.style.borderLeft = '4px solid #c0392b';
    editError.hidden = false;
    return;
  }

  // 4. Guardar
  const vueloActualizado = {
    ...vueloEditando,
    origen: document.getElementById('edit-origen').value.trim(),
    destino: document.getElementById('edit-destino').value.trim(),
    fechaSalida: nuevaFecha,
    horaSalida: document.getElementById('edit-hora').value,
    precio: parseFloat(document.getElementById('edit-precio').value),
    asientosDisponibles: parseInt(document.getElementById('edit-asientos').value)
  };

  const extra = leerVuelosExtra();
  const index = extra.findIndex(v => v.id === vueloActualizado.id);
  
  if (index !== -1) {
    extra[index] = vueloActualizado;
  } else {
    extra.push(vueloActualizado);
  }
  localStorage.setItem(CLAVE_VUELOS_EXTRA, JSON.stringify(extra));

  const indexGlobal = vuelosGlobal.findIndex(v => v.id === vueloActualizado.id);
  if (indexGlobal !== -1) vuelosGlobal[indexGlobal] = vueloActualizado;

  modalEditar.hidden = true;
  renderizarVuelosAdmin(vuelosGlobal);
  alert('Vuelo actualizado correctamente.');
});

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  // Quitamos la redirección forzada al login. 
  // La página cargará y mostrará el contenido a cualquiera.
  cargarDatos();
});
document.addEventListener('DOMContentLoaded', cargarDatos);