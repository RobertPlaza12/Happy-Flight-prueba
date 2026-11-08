// ===== Configuración BD =====
const RUTA_BD = 'bd/baseDatos.json';
let vuelosDisponibles = [];
let usuariosDB = [];
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';
let usuarioId = null;
let esAgente = false;

const contenedorResultados = document.querySelector('#buscar .resultados');
const formBusqueda = document.getElementById('form-busqueda');

// ===== Utilidades =====
function normalizar(texto) {
  return (texto || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes
}

function formatearPrecio(n) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'USD'
  }).format(n);
}

// Función que faltaba para prevenir inyecciones de código en el nombre
function escaparHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function obtenerUsuarioId() {
  const params = new URLSearchParams(window.location.search);
  const desdeUrl = params.get('usuarioId');
  if (desdeUrl) {
    localStorage.setItem(CLAVE_SESION, desdeUrl);
    return desdeUrl;
  }
  return localStorage.getItem(CLAVE_SESION);
}

function obtenerNombreUsuario(id) {
  if (!id) return '';
  const usuario = usuariosDB.find(u => u.id === id);
  return usuario?.nombre || id;
}

function actualizarUIUsuario() {
  const contenedor = document.querySelector('.acciones-sesion');
  if (!contenedor) return;

  if (usuarioId) {
    let nombreMostrar = obtenerNombreUsuario(usuarioId);
    
    // Botón extra si es agente
    const botonAgente = esAgente 
      ? `<a href="actualizarVuelos.html?agenteId=${usuarioId}" class="btn-sesion login" style="border-color: #1e8449; color: #1e8449; background: #e8f8ef;">Actualizar Vuelos</a>` 
      : '';

    contenedor.innerHTML = `
      <a href="reservas.html?usuarioId=${usuarioId}" class="btn-sesion login">Ver Reservas</a>
      ${botonAgente}
      <div class="menu-usuario">
        <button class="btn-usuario" id="btn-menu-usuario" aria-haspopup="true" aria-expanded="false">
          <span class="btn-usuario-nombre">${escaparHTML(nombreMostrar)}</span>
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
      const abierto = !dropdown.hidden;
      dropdown.hidden = abierto;
      btnMenu.setAttribute('aria-expanded', String(!abierto));
    });

    document.getElementById('cerrar-sesion').addEventListener('click', () => {
      localStorage.removeItem(CLAVE_SESION);
      window.location.href = 'index.html';
    });

  } else {
    contenedor.innerHTML = `
      <a href="login.html" class="btn-sesion login">Iniciar sesión</a>
      <a href="registro.html" class="btn-sesion registro">Registrarse</a>
    `;
  }
}

function calcularAsientosDisponibles(vuelo) {
  // Asientos totales originales
  let total = vuelo.asientosDisponibles || 0;
  
  // Leer reservas del localStorage
  let reservas = [];
  try {
    reservas = JSON.parse(localStorage.getItem('hf_reservas')) || [];
  } catch {}
  
  // Contar cuántas reservas hay para este vuelo
  const reservasDeEsteVuelo = reservas.filter(r => r.vueloId === vuelo.id).length;
  
  // Restar las reservas al total
  return Math.max(0, total - reservasDeEsteVuelo);
}

function crearTarjetaVuelo(vuelo) {
  const card = document.createElement('article');
  card.className = 'vuelo';

  // Calculamos el número real
  const disponibles = calcularAsientosDisponibles(vuelo);

  card.innerHTML = `
    <h3>${vuelo.origen} → ${vuelo.destino}</h3>
    <p><strong>Fecha:</strong> ${vuelo.fechaSalida}</p>
    <p><strong>Hora de salida:</strong> ${vuelo.horaSalida}</p>
    <p><strong>Asientos Disponibles:</strong> ${disponibles}</p>
    <p><strong>Precio:</strong> ${formatearPrecio(vuelo.precio)}</p>
    <p><strong>Vuelo:</strong> ${vuelo.id}</p>
    <button class="boton" data-id="${vuelo.id}" ${disponibles === 0 ? 'disabled style="background:#cfd8e3; color:#8896a8; cursor:not-allowed;"' : ''}>
      ${disponibles === 0 ? 'Agotado' : 'Reservar'}
    </button>
  `;

  // Solo si hay asientos disponibles, permitimos hacer la reserva
  if (disponibles > 0) {
    card.querySelector('button').addEventListener('click', () => {
      reservarVuelo(vuelo);
    });
  }

  return card;
}

function renderizarVuelos(lista) {
  contenedorResultados.innerHTML = '';

  if (!lista.length) {
    const p = document.createElement('p');
    p.className = 'mensaje';
    p.textContent = 'No se encontraron vuelos con esos criterios.';
    contenedorResultados.appendChild(p);
    return;
  }

  const fragmento = document.createDocumentFragment();
  lista.forEach(v => fragmento.appendChild(crearTarjetaVuelo(v)));
  contenedorResultados.appendChild(fragmento);
}

// ===== Carga de la base de datos =====
function leerUsuariosExtra() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || [];
  } catch {
    return [];
  }
}

async function cargarVuelos() {
  try {
    const respuesta = await fetch(RUTA_BD);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

    const datos = await respuesta.json();
    const ahora = new Date();

    // 1. Combinar vuelos base con los editados por el agente
    const baseVuelos = Array.isArray(datos.vuelos) ? datos.vuelos : [];
    let extraVuelos = [];
    try { extraVuelos = JSON.parse(localStorage.getItem('hf_vuelos_extra')) || []; } catch {}

    const mapaVuelos = new Map();
    baseVuelos.forEach(v => mapaVuelos.set(v.id, v));
    extraVuelos.forEach(v => mapaVuelos.set(v.id, v)); // Los extra tienen prioridad

    // 2. Filtrar vencidos
    vuelosDisponibles = Array.from(mapaVuelos.values()).filter(v => {
      const fechaHoraVuelo = new Date(`${v.fechaSalida}T${v.horaSalida || '00:00'}:00`);
      return fechaHoraVuelo >= ahora;
    });

    // 3. Usuarios (igual que antes)
    const usuariosBase = Array.isArray(datos.usuarios) ? datos.usuarios : [];
    usuariosDB = [...usuariosBase, ...leerUsuariosExtra()];

    // 4. Verificar Agente
    if (usuarioId) {
      const agentes = Array.isArray(datos.agenteBoleto) ? datos.agenteBoleto : [];
      esAgente = agentes.some(a => a.id === usuarioId);
    }

    actualizarUIUsuario();
    renderizarVuelos(vuelosDisponibles);
  } catch (error) {
    console.error('Error cargando base de datos:', error);
    contenedorResultados.innerHTML =
      '<p class="mensaje">No se pudieron cargar los vuelos. Intenta más tarde.</p>';
  }
}

function buscarVuelos({ origen, destino, hora, fecha }) {
  const o = normalizar(origen);
  const d = normalizar(destino);

  return vuelosDisponibles.filter(v => {
    const coincideOrigen = !o || normalizar(v.origen).includes(o);
    const coincideDestino = !d || normalizar(v.destino).includes(d);

    const coincideHora = !hora || v.horaSalida >= hora;
    const coincideFecha = !fecha || v.fechaSalida === fecha;

    return coincideOrigen && coincideDestino && coincideHora && coincideFecha;
  });
}

function manejarBusqueda(evento) {
  evento.preventDefault();

  const origen = document.getElementById('origen').value;
  const destino = document.getElementById('destino').value;
  const hora = document.getElementById('hora').value;
  const fecha = document.getElementById('fecha').value;

  const resultados = buscarVuelos({ origen, destino, hora, fecha });
  renderizarVuelos(resultados);
}

function reservarVuelo(vuelo) {
  if (!usuarioId) {
    // Sin sesión lo manda a registrarse
    window.location.href = 'registro.html';
    return;
  }

  // Con sesión lo manda a reserva.html con datos del usuario y vuelo
  const params = new URLSearchParams({
    usuarioId,
    vueloId: vuelo.id
  });
  window.location.href = `reserva.html?${params.toString()}`;
}

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  usuarioId = obtenerUsuarioId();
  actualizarUIUsuario();
  cargarVuelos();
  formBusqueda.addEventListener('submit', manejarBusqueda);
});

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('dropdown-usuario');
  const btnMenu = document.getElementById('btn-menu-usuario');
  if (!dropdown || dropdown.hidden) return;

  const clickDentroDropdown = dropdown.contains(e.target);
  const clickEnBoton = btnMenu && btnMenu.contains(e.target);

  if (!clickDentroDropdown && !clickEnBoton) {
    dropdown.hidden = true;
    btnMenu.setAttribute('aria-expanded', 'false');
  }
});
