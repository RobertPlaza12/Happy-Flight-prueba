// ===== Configuración =====
const RUTA_BD = 'bd/baseDatos.json';
const CLAVE_SESION = 'hf_usuarioId';
const CLAVE_RESERVAS = 'hf_reservas';
const CLAVE_USUARIOS_EXTRA = 'hf_usuarios_extra';

// ===== Variables Globales =====
let usuarioActual = null;
let descuentoMillas = 0;
let millasCanjeadas = 0;

// ===== Parámetros de URL =====
const params = new URLSearchParams(window.location.search);
const usuarioId = params.get('usuarioId') || localStorage.getItem(CLAVE_SESION);
const vueloId = params.get('vueloId');

// ===== Estado =====
let vuelo = null;
let asientoSeleccionado = null;
let reservasExistentes = [];

// ===== Referencias DOM =====
const infoVuelo = document.getElementById('info-vuelo');
const resumenVuelo = document.getElementById('resumen-vuelo');
const mapaAsientos = document.getElementById('mapa-asientos');
const asientoTexto = document.getElementById('asiento-seleccionado');
const btnConfirmar = document.getElementById('btn-confirmar');
const mensajeError = document.getElementById('reserva-mensaje');

// ===== Utilidades =====
function formatearPrecio(n) {
  // Cambiado a DOP (Peso Dominicano)
  return new Intl.NumberFormat('es-DO', { 
    style: 'currency', 
    currency: 'DOP' 
  }).format(n);
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
function mostrarError(msg) {
  if (mensajeError) { mensajeError.textContent = msg; mensajeError.hidden = false; }
}
function limpiarError() {
  if (mensajeError) mensajeError.hidden = true;
}

// ===== Render de la info del vuelo =====
function renderizarInfoVuelo(v) {
  if (resumenVuelo) resumenVuelo.textContent = `${v.origen} → ${v.destino} · ${v.fechaSalida} · ${v.horaSalida}`;
  if (infoVuelo) {
    infoVuelo.innerHTML = `
      <p><strong>Vuelo:</strong> ${v.id}</p>
      <p><strong>Ruta:</strong> ${v.origen} → ${v.destino}</p>
      <p><strong>Fecha:</strong> ${v.fechaSalida} · <strong>Hora:</strong> ${v.horaSalida}</p>
      <p><strong>Precio:</strong> ${formatearPrecio(v.precio)}</p>
    `;
    infoVuelo.hidden = false;
  }
}

// ===== Estado de un asiento =====
function estadoAsiento(fila, columna) {
  const codigo = `${fila}${columna}`;
  const enJson = vuelo.asientos?.[codigo];
  if (enJson === 'ocupado') return 'ocupado';

  const reservadoLocal = reservasExistentes.some(
    r => r.vueloId === vuelo.id && r.asiento === codigo
  );
  if (reservadoLocal) return 'ocupado';

  return 'libre';
}

// ===== Render del mapa de asientos =====
function renderizarMapa() {
  const filas = vuelo.filas || 4;
  const columnas = vuelo.columnas || 20;
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  if (!mapaAsientos) return;
  mapaAsientos.innerHTML = '';
  mapaAsientos.style.setProperty('--filas', filas);

  const cabecera = document.createElement('div');
  cabecera.className = 'asientos-fila cabecera';
  const vacio = document.createElement('span');
  vacio.className = 'asiento-etiqueta';
  cabecera.appendChild(vacio);
  for (let f = 0; f < filas; f++) {
    const letra = document.createElement('span');
    letra.className = 'asiento-numero';
    letra.textContent = letras[f];
    cabecera.appendChild(letra);
  }
  mapaAsientos.appendChild(cabecera);

  for (let c = 1; c <= columnas; c++) {
    const fila = document.createElement('div');
    fila.className = 'asientos-fila';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'asiento-etiqueta';
    etiqueta.textContent = c;
    fila.appendChild(etiqueta);

    for (let f = 0; f < filas; f++) {
      const letra = letras[f];
      const codigo = `${letra}${c}`;
      const estado = estadoAsiento(letra, c);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `asiento ${estado}`;
      btn.dataset.codigo = codigo;
      btn.title = `Asiento ${codigo} (${estado})`;

      if (estado === 'ocupado') {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => seleccionarAsiento(codigo, btn));
      }
      fila.appendChild(btn);
    }
    mapaAsientos.appendChild(fila);
  }
}

// ===== Selección =====
function seleccionarAsiento(codigo, btn) {
  document.querySelectorAll('.asiento.seleccionado').forEach(el => el.classList.remove('seleccionado'));

  if (asientoSeleccionado === codigo) {
    asientoSeleccionado = null;
    if(asientoTexto) asientoTexto.textContent = 'Ningún asiento seleccionado.';
    if(btnConfirmar) btnConfirmar.disabled = true;
    return;
  }

  asientoSeleccionado = codigo;
  btn.classList.add('seleccionado');
  if(asientoTexto) asientoTexto.textContent = `Asiento seleccionado: ${codigo} · ${formatearPrecio(vuelo.precio)}`;
  if(btnConfirmar) btnConfirmar.disabled = false;
  limpiarError();
}

// ===== Lógica de Pago y Modal =====
const modalPago = document.getElementById('modal-pago');
const modalExito = document.getElementById('modal-exito');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const seccionMillas = document.getElementById('seccion-millas');
const chkUsarMillas = document.getElementById('chk-usar-millas');
const detalleMillas = document.getElementById('detalle-millas');
const inputMillas = document.getElementById('input-millas');
const formPago = document.getElementById('form-pago');
const pagoError = document.getElementById('pago-error');

function confirmarReserva() {
  if (!asientoSeleccionado) return;

  if (document.getElementById('modal-ruta')) document.getElementById('modal-ruta').textContent = `${vuelo.origen} → ${vuelo.destino}`;
  if (document.getElementById('modal-asiento')) document.getElementById('modal-asiento').textContent = asientoSeleccionado;
  if (document.getElementById('modal-precio')) document.getElementById('modal-precio').textContent = formatearPrecio(vuelo.precio);
  if (document.getElementById('btn-pagar-monto')) document.getElementById('btn-pagar-monto').textContent = formatearPrecio(vuelo.precio);
  
  if (formPago) formPago.reset();
  if (pagoError) pagoError.hidden = true;
  descuentoMillas = 0;
  millasCanjeadas = 0;

  if (usuarioActual && usuarioActual.tipoCliente === 'ejecutivo') {
    if (seccionMillas) seccionMillas.hidden = false;
    const millasUsuario = usuarioActual.millas || 0;
    if (document.getElementById('millas-disponibles')) document.getElementById('millas-disponibles').textContent = millasUsuario;
    if (document.getElementById('descuento-millas')) document.getElementById('descuento-millas').textContent = formatearPrecio(0);
    
    if (inputMillas) {
      inputMillas.max = millasUsuario;
      inputMillas.value = 0;
    }
  } else {
    if (seccionMillas) seccionMillas.hidden = true;
    if (chkUsarMillas) chkUsarMillas.checked = false;
    if (detalleMillas) detalleMillas.hidden = true;
  }

  if (modalPago) modalPago.hidden = false;
}

if (chkUsarMillas) {
  chkUsarMillas.addEventListener('change', (e) => {
    if (detalleMillas) detalleMillas.hidden = !e.target.checked;
    if (!e.target.checked) {
      if (inputMillas) inputMillas.value = 0;
      calcularDescuentoMilla();
    }
  });
}

if (inputMillas) inputMillas.addEventListener('input', calcularDescuentoMilla);

function calcularDescuentoMilla() {
  let millas = parseInt(inputMillas?.value) || 0;
  const maxMillas = usuarioActual?.millas || 0;
  
  if (millas > maxMillas) {
    millas = maxMillas;
    if (inputMillas) inputMillas.value = millas;
  }

  // Mantenemos la tasa: 100 millas = 1 unidad de moneda (ahora DOP)
  descuentoMillas = millas / 100;
  millasCanjeadas = millas;

  if (document.getElementById('descuento-millas')) document.getElementById('descuento-millas').textContent = '-' + formatearPrecio(descuentoMillas);
  
  const total = Math.max(0, vuelo.precio - descuentoMillas);
  if (document.getElementById('modal-precio')) document.getElementById('modal-precio').textContent = formatearPrecio(total);
  if (document.getElementById('btn-pagar-monto')) document.getElementById('btn-pagar-monto').textContent = formatearPrecio(total);
}

// Formateos
if (document.getElementById('tarjeta-numero')) {
  document.getElementById('tarjeta-numero').addEventListener('input', function() {
    let v = this.value.replace(/\D/g, '').substring(0, 16);
    v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.value = v;
  });
}
if (document.getElementById('tarjeta-vencimiento')) {
  document.getElementById('tarjeta-vencimiento').addEventListener('input', function() {
    let v = this.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    this.value = v;
  });
}

if (btnCerrarModal) btnCerrarModal.addEventListener('click', () => { if(modalPago) modalPago.hidden = true; });

if (formPago) {
  formPago.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pagoError) pagoError.hidden = true;

    const tarjeta = document.getElementById('tarjeta-numero').value.replace(/\s/g, '');
    const cvv = document.getElementById('tarjeta-cvv').value;
    const vencimiento = document.getElementById('tarjeta-vencimiento').value;

    if (tarjeta.length < 16 || cvv.length < 3 || vencimiento.length < 5) {
      if (pagoError) {
        pagoError.textContent = 'Verifica los datos de tu tarjeta.';
        pagoError.hidden = false;
      }
      return;
    }

    const btnPagar = document.getElementById('btn-pagar');
    if (btnPagar) {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando pago...';
    }

    setTimeout(finalizarReserva, 1500);
  });
}

function finalizarReserva() {
  const totalPagado = Math.max(0, vuelo.precio - descuentoMillas);
  
  const nueva = {
    id: 'R' + Date.now(),
    usuarioId,
    vueloId: vuelo.id,
    asiento: asientoSeleccionado,
    origen: vuelo.origen,
    destino: vuelo.destino,
    fechaSalida: vuelo.fechaSalida,
    horaSalida: vuelo.horaSalida,
    precioOriginal: vuelo.precio,     // Guardamos el precio sin descuento
    pagado: totalPagado,              // Guardamos lo que realmente pagó
    millasCanjeadas: millasCanjeadas,
    creada: new Date().toISOString()
  };

  reservasExistentes.push(nueva);
  guardarReservas(reservasExistentes);

  let millasGanadas = 0;
  if (usuarioActual && usuarioActual.tipoCliente === 'ejecutivo') {
    // Acumulación: 1 DOP = 10 millas 
    millasGanadas = Math.floor(totalPagado * 10);
    
    // Guardamos el estado actualizado del usuario
    const usuariosExtra = leerUsuariosExtra();
    const index = usuariosExtra.findIndex(u => u.id === usuarioId);
    
    if (index !== -1) {
      usuariosExtra[index].millas = (usuariosExtra[index].millas || 0) - millasCanjeadas + millasGanadas;
    } else {
      const userBase = { ...usuarioActual };
      userBase.millas = (userBase.millas || 0) - millasCanjeadas + millasGanadas;
      usuariosExtra.push(userBase);
    }
    localStorage.setItem(CLAVE_USUARIOS_EXTRA, JSON.stringify(usuariosExtra));
  }

  if (modalPago) modalPago.hidden = true;
  if (modalExito) modalExito.hidden = false;
  if (document.getElementById('exito-email')) document.getElementById('exito-email').textContent = usuarioActual?.email || 'tu correo';
  
  if (document.getElementById('exito-millas')) {
    if (millasGanadas > 0) {
      document.getElementById('exito-millas').innerHTML = `¡Has acumulado <strong>${millasGanadas} millas</strong> con esta compra!`;
    } else {
      document.getElementById('exito-millas').textContent = '';
    }
  }
// Esto permite que el número se mantenga actualizado sin tocar el JSON original
  const CLAVE_VUELOS_EXTRA = 'hf_vuelos_extra';
  let vuelosExtra = [];
  try { vuelosExtra = JSON.parse(localStorage.getItem(CLAVE_VUELOS_EXTRA)) || []; } catch {}

  // Buscar si este vuelo ya fue editado por un agente (o si ya le habíamos restado un asiento)
  const indexVuelo = vuelosExtra.findIndex(v => v.id === vuelo.id);
  
  if (indexVuelo !== -1) {
    // Si ya existe, le restamos 1 asiento a su contador guardado
    vuelosExtra[indexVuelo].asientosDisponibles = Math.max(0, (vuelosExtra[indexVuelo].asientosDisponibles || 0) - 1);
  } else {
    // Si no existe en local, lo creamos con 1 asiento menos
    const vueloCopia = { ...vuelo };
    vueloCopia.asientosDisponibles = Math.max(0, (vueloCopia.asientosDisponibles || 0) - 1);
    vuelosExtra.push(vueloCopia);
  }
  
  localStorage.setItem(CLAVE_VUELOS_EXTRA, JSON.stringify(vuelosExtra));
  setTimeout(() => {
    window.location.href = `reservas.html?usuarioId=${encodeURIComponent(usuarioId)}`;
  }, 4000);
}

if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarReserva);

// ===== Inicialización =====
(async function init() {
  if (!usuarioId) {
    window.location.href = 'registro.html';
    return;
  }

  if (!vueloId) {
    mostrarError('Falta el parámetro vueloId en la URL.');
    return;
  }

  try {
    const r = await fetch(RUTA_BD);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const datos = await r.json();
    
    // EL FIX DE LAS MILLAS: Priorizar siempre lo que está en localStorage
    const extra = leerUsuariosExtra();
    const userEnLocal = extra.find(u => u.id === usuarioId);
    
    if (userEnLocal) {
      // Si el usuario ya fue modificado (tiene millas actualizadas), usamos ese objeto
      usuarioActual = userEnLocal;
    } else {
      // Si es la primera vez que compra, lo buscamos en el JSON
      const base = datos.usuarios || [];
      usuarioActual = base.find(u => u.id === usuarioId);
    }

    const vuelos = Array.isArray(datos.vuelos) ? datos.vuelos : [];
    vuelo = vuelos.find(v => v.id === vueloId);

    if (!vuelo) {
      mostrarError('El vuelo solicitado no existe.');
      return;
    }

    reservasExistentes = leerReservas();
    renderizarInfoVuelo(vuelo);
    renderizarMapa();
    
  } catch (err) {
    console.error(err);
    mostrarError('No se pudo cargar la información del vuelo.');
  }
})();
