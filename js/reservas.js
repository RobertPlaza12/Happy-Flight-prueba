// ===== Configuración =====
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_RESERVAS = 'hf_reservas';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';
const RUTA_BD = 'bd/baseDatos.json';

// ===== Obtener Sesión =====
const params = new URLSearchParams(window.location.search);
let usuarioId = params.get('usuarioId') || localStorage.getItem(CLAVE_SESION);

// ===== Referencias DOM =====
const listaReservas = document.getElementById('lista-reservas');
const bienvenida = document.getElementById('bienvenida');
const contenedorSesion = document.querySelector('.acciones-sesion');

// Referencias del Modal
const modalCancelar = document.getElementById('modal-cancelar');
const btnCerrarCancelar = document.getElementById('btn-cerrar-cancelar');
const btnAbortarCancelar = document.getElementById('btn-abortar-cancelar');
const btnConfirmarCancelar = document.getElementById('btn-confirmar-cancelar');
const cancelDestino = document.getElementById('cancel-destino');
const cancelMonto = document.getElementById('cancel-monto');
const avisoReembolso = document.getElementById('aviso-reembolso');
const avisoNoReembolsable = document.getElementById('aviso-no-reembolsable');
const motivoNoCancelable = document.getElementById('motivo-no-cancelable');
const cancelPorcentajeTexto = document.getElementById('cancel-porcentaje-texto');

let reservaACancelar = null;

// ===== Utilidades =====
function formatearPrecio(n) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n);
}

function leerReservas() {
  try { return JSON.parse(localStorage.getItem(CLAVE_RESERVAS)) || []; } catch { return []; }
}
function guardarReservas(lista) {
  localStorage.setItem(CLAVE_RESERVAS, JSON.stringify(lista));
}
function leerUsuariosExtra() {
  try { return JSON.parse(localStorage.getItem(CLAVE_USUARIOS_EXTRA)) || []; } catch { return []; }
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
    const todos = [...(datos.usuarios || []), ...extra];
    // Prioridad a lo que está en localStorage
    const user = extra.find(u => u.id === usuarioId) || todos.find(u => u.id === usuarioId);
    if (user) nombreMostrar = user.nombre;
  } catch (e) { console.warn('No se pudo cargar el nombre del usuario'); }

  bienvenida.textContent = `Historial de vuelos reservados por ${nombreMostrar}.`;

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

// ===== Render de Reservas =====
function renderizarReservas() {
  listaReservas.innerHTML = '';
  
  if (!usuarioId) {
    listaReservas.innerHTML = '<p class="mensaje">Inicia sesión para ver tus reservas.</p>';
    return;
  }

  const todas = leerReservas();
  const misReservas = todas.filter(r => r.usuarioId === usuarioId);

  if (misReservas.length === 0) {
    listaReservas.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px;">
        <p class="mensaje">Aún no tienes reservas.</p>
        <a href="index.html" class="boton" style="margin-top: 10px;">Buscar vuelos</a>
      </div>
    `;
    return;
  }

  misReservas.sort((a, b) => new Date(b.creada) - new Date(a.creada));
  const fragmento = document.createDocumentFragment();

  misReservas.forEach(reserva => {
    const card = document.createElement('article');
    card.className = 'vuelo';
    
    const fechaCompra = new Date(reserva.creada).toLocaleDateString('es-DO', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    // Mostrar si usó millas y cuánto pagó
    let detallePago = `<p><strong>Precio:</strong> ${formatearPrecio(reserva.precioOriginal || reserva.precio)}</p>`;
    if (reserva.pagado !== undefined && reserva.pagado < (reserva.precioOriginal || reserva.precio)) {
      detallePago = `
        <p style="text-decoration: line-through; color: #8896a8;">Precio original: ${formatearPrecio(reserva.precioOriginal || reserva.precio)}</p>
        <p style="color: #1e8449; font-weight: bold;">Pagado: ${formatearPrecio(reserva.pagado)}</p>
        <p style="font-size: 0.8rem; color: #b28500;">(Canjeaste ${reserva.millasCanjeadas} millas)</p>
      `;
    }

    card.innerHTML = `
      <h3 style="margin-bottom: 12px; font-size: 1.1rem;">${reserva.origen} → ${reserva.destino}</h3>
      <div style="background: var(--azul-claro); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
        <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: var(--azul);">Asiento: ${reserva.asiento}</p>
      </div>
      <p><strong>Vuelo:</strong> ${reserva.vueloId}</p>
      <p><strong>Fecha de vuelo:</strong> ${reserva.fechaSalida}</p>
      <p><strong>Hora:</strong> ${reserva.horaSalida}</p>
      ${detallePago}
      <p style="font-size: 0.8rem; color: #8896a8; margin-top: 15px;">Reservado el: ${fechaCompra}</p>
      
      <button class="btn-sesion login" style="width: 100%; margin-top: 15px; border-color: #c0392b; color: #c0392b; background: transparent;" data-id="${reserva.id}">
        Cancelar reserva
      </button>
    `;

    // Escuchador del botón cancelar
    card.querySelector('button').addEventListener('click', () => abrirModalCancelacion(reserva.id));

    fragmento.appendChild(card);
  });

  listaReservas.appendChild(fragmento);
}

// ===== Lógica de Cancelación =====
function abrirModalCancelacion(idReserva) {
  const todas = leerReservas();
  const reserva = todas.find(r => r.id === idReserva);
  if (!reserva) return;

  reservaACancelar = reserva;
  cancelDestino.textContent = `${reserva.origen} → ${reserva.destino}`;
  
  const ahora = new Date();
  const fechaVuelo = new Date(`${reserva.fechaSalida}T${reserva.horaSalida || '00:00'}:00`);
  
  // 1. Validar que el vuelo no haya pasado
  if (ahora > fechaVuelo) {
    avisoReembolso.hidden = true;
    avisoNoReembolsable.hidden = false;
    motivoNoCancelable.textContent = "La fecha y hora del vuelo ya pasaron. No es posible cancelar.";
    btnConfirmarCancelar.disabled = true;
    btnConfirmarCancelar.style.opacity = '0.5';
  } 
  else {
    const fechaCompra = new Date(reserva.creada);
    const diferenciaDias = (ahora - fechaCompra) / (1000 * 60 * 60 * 24);
    
    avisoNoReembolsable.hidden = true;
    avisoReembolso.hidden = false;
    btnConfirmarCancelar.disabled = false;
    btnConfirmarCancelar.style.opacity = '1';

    // Usamos "pagado". Si por alguna razón no existe, usamos el precio original.
    const montoPagado = reserva.pagado !== undefined ? reserva.pagado : (reserva.precioOriginal || reserva.precio);
    let reembolso = 0;

    // 2. Calcular porcentaje según los días
    if (diferenciaDias < 7) {
      // Menos de una semana: 100%
      reembolso = montoPagado;
      cancelPorcentajeTexto.innerHTML = `Como cancelaste en menos de una semana, se te devolverá el <strong>100%</strong> de lo que pagaste.`;
    } else {
      // Más de una semana: 80%
      reembolso = montoPagado * 0.80;
      cancelPorcentajeTexto.innerHTML = `Han pasado más de 7 días desde tu compra, por lo que se te devolverá el <strong>80%</strong> de lo que pagaste.`;
    }
    
    cancelMonto.textContent = formatearPrecio(reembolso);
  }

  modalCancelar.hidden = false;
}

btnCerrarCancelar.addEventListener('click', () => modalCancelar.hidden = true);
btnAbortarCancelar.addEventListener('click', () => modalCancelar.hidden = true);

btnConfirmarCancelar.addEventListener('click', () => {
  if (!reservaACancelar) return;

  const todas = leerReservas();
  const filtradas = todas.filter(r => r.id !== reservaACancelar.id);
  guardarReservas(filtradas);
  
  modalCancelar.hidden = true;
  reservaACancelar = null;
  renderizarReservas();
});

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  actualizarUIUsuario();
  renderizarReservas();
});