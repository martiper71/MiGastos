// --- 1. CONFIGURACIÓN ---
const PB_URL = 'https://martiperpocketbase.duckdns.org';
// El presupuesto mensual ahora se calcula por mes/año seleccionado
let presupuestoMensual = 300;
const pb = new PocketBase(PB_URL);

// Variable global para guardar los registros del mes actual
let registrosActuales = [];
let movimientoAEditar = null;

function getPresupuestoKey() {
    const anio = document.getElementById('select-anio').value;
    const mes = document.getElementById('select-mes').value;
    return `presupuesto_${anio}_${mes}`;
}

function obtenerPresupuestoActual() {
    const key = getPresupuestoKey();
    return parseFloat(localStorage.getItem(key)) || 300;
}

// --- 2. INICIO ---
window.addEventListener('DOMContentLoaded', async () => {
    configurarFecha();
    if (pb.authStore.isValid) {
        mostrarApp();
    }
});

async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.getElementById('btn-login');

    if (!email || !pass) return alert("Hacen falta datos");

    try {
        btn.disabled = true;
        btn.textContent = "Entrando...";
        await pb.collection('users').authWithPassword(email, pass);
        mostrarApp();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
}

function mostrarApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-main').style.display = 'block';
    cargarGastos();
}

function configurarFecha() {
    const hoy = new Date();
    const selectMes = document.getElementById('select-mes');
    const selectAnio = document.getElementById('select-anio');

    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

    // Llenar meses
    meses.forEach((nombre, index) => {
        const opt = document.createElement('option');
        opt.value = index + 1;
        opt.textContent = nombre;
        if (index === hoy.getMonth()) opt.selected = true;
        selectMes.appendChild(opt);
    });

    // Llenar años (de 2026 a 2030)
    const anioActual = hoy.getFullYear();
    for (let a = 2026; a <= 2030; a++) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        if (a === anioActual) opt.selected = true;
        selectAnio.appendChild(opt);
    }

    // Ajustar anchos iniciales
    ajustarAnchoSelect('select-mes');
    ajustarAnchoSelect('select-anio');
}

// Función para que el select ocupe solo lo que mide el texto
function ajustarAnchoSelect(id) {
    const el = document.getElementById(id);
    if (!el || el.selectedIndex < 0) return;
    const texto = el.options[el.selectedIndex].text;

    // Creamos un span temporal para medir el texto con todos sus estilos (especialmente letter-spacing)
    const span = document.createElement("span");
    span.style.visibility = "hidden";
    span.style.position = "absolute";
    span.style.whiteSpace = "nowrap";
    span.style.font = getComputedStyle(el).font;
    span.style.fontSize = getComputedStyle(el).fontSize;
    span.style.fontWeight = getComputedStyle(el).fontWeight;
    span.style.letterSpacing = getComputedStyle(el).letterSpacing;
    span.style.textTransform = getComputedStyle(el).textTransform;
    span.style.fontFamily = getComputedStyle(el).fontFamily;
    span.textContent = texto;
    document.body.appendChild(span);

    const width = span.offsetWidth;
    document.body.removeChild(span);

    // Espacio extra para la flecha (ajustado al nuevo tamaño)
    const paddingExtra = (id === 'select-mes') ? 28 : 22;
    el.style.width = (width + paddingExtra) + "px";
}

// --- 3. LÓGICA DE DATOS ---

async function cargarGastos() {
    try {
        if (!pb.authStore.isValid) return;

        const anio = document.getElementById('select-anio').value;
        const mes = document.getElementById('select-mes').value.toString().padStart(2, '0');

        // Actualizar presupuesto local para el periodo seleccionado
        presupuestoMensual = obtenerPresupuestoActual();

        // Ajustar el ancho visual de los selectores cada vez que cambien
        ajustarAnchoSelect('select-mes');
        ajustarAnchoSelect('select-anio');

        // Rango del mes seleccionado
        const fechaInicio = `${anio}-${mes}-01 00:00:00`;

        // Calcular el inicio del mes siguiente para el límite superior
        let proximoAnio = parseInt(anio);
        let proximoMes = parseInt(mes) + 1;
        if (proximoMes > 12) {
            proximoMes = 1;
            proximoAnio++;
        }
        const fechaFin = `${proximoAnio}-${proximoMes.toString().padStart(2, '0')}-01 00:00:00`;

        // Filtramos por el campo 'fecha' que guardamos nosotros
        const registros = await pb.collection('MisGastos').getFullList({
            filter: `fecha >= '${fechaInicio}' && fecha < '${fechaFin}'`,
            sort: '-fecha', // Orden descendente por fecha
        });

        registrosActuales = registros;
        const totalGastado = registros.reduce((sum, g) => sum + (g.importe || 0), 0);
        actualizarUI(totalGastado);

    } catch (err) {
        console.error("Error al cargar:", err);
    }
}

function verMovimientos() {
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('vista-movimientos').style.display = 'block';
    renderizarMovimientos();
}

function volverAMain() {
    document.getElementById('vista-movimientos').style.display = 'none';
    document.getElementById('vista-comparativa').style.display = 'none';
    document.getElementById('app-main').style.display = 'block';
}

async function verComparativa() {
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('vista-comparativa').style.display = 'block';

    const anio = document.getElementById('select-anio').value;
    document.getElementById('anio-titulo').textContent = anio;

    renderizarCargandoComparativa();

    try {
        // Rango del año completo
        const fechaInicio = `${anio}-01-01 00:00:00`;
        const fechaFin = `${parseInt(anio) + 1}-01-01 00:00:00`;

        const registros = await pb.collection('MisGastos').getFullList({
            filter: `fecha >= '${fechaInicio}' && fecha < '${fechaFin}'`,
        });

        renderizarComparativa(registros, anio);
    } catch (err) {
        console.error("Error comparativa:", err);
    }
}

function renderizarCargandoComparativa() {
    document.getElementById('lista-comparativa').innerHTML = '<div style="text-align:center; margin-top:50px;">Cargando datos del año...</div>';
}

function renderizarComparativa(registros, anio) {
    const container = document.getElementById('lista-comparativa');
    container.innerHTML = '';

    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Agrupar gastos por mes
    const gastosPorMes = new Array(12).fill(0);
    registros.forEach(r => {
        const mes = parseInt(r.fecha.split('-')[1]) - 1;
        gastosPorMes[mes] += (r.importe || 0);
    });

    mesesNombres.forEach((nombre, i) => {
        const mesNum = i + 1;
        const gasto = gastosPorMes[i];
        const presupuesto = parseFloat(localStorage.getItem(`presupuesto_${anio}_${mesNum}`)) || 300;

        let porcentaje = (gasto / presupuesto) * 100;
        let colorBarra = 'var(--success)';
        if (porcentaje > 100) {
            colorBarra = 'var(--danger)';
            porcentaje = 100; // Limitar visualmente al 100%
        } else if (porcentaje > 66) {
            colorBarra = 'var(--warning)';
        }

        const item = document.createElement('div');
        item.className = 'comparativa-item';
        item.innerHTML = `
            <div class="comparativa-header">
                <span>${nombre.toUpperCase()}</span>
                <span style="color: ${gasto > presupuesto ? 'var(--danger)' : '#333'}">
                    €${formatearNumero(gasto)} / €${formatearNumero(presupuesto)}
                </span>
            </div>
            <div class="bar-container">
                <div class="bar-fill" style="width: ${porcentaje}%; background-color: ${colorBarra}"></div>
            </div>
            <div class="bar-info">
                <span>${gasto > presupuesto ? 'Presupuesto excedido' : 'Dentro del presupuesto'}</span>
                <span>${Math.round((gasto / presupuesto) * 100)}%</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderizarMovimientos() {
    const container = document.getElementById('lista-movimientos');
    container.innerHTML = '';

    if (registrosActuales.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#888; margin-top:50px;">No hay movimientos este mes.</div>';
        return;
    }

    registrosActuales.forEach(g => {
        // Formatear fecha legible
        const d = new Date(g.fecha.replace(' ', 'T'));
        const fechaFormateada = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');

        const item = document.createElement('div');
        item.className = 'movimiento-item';
        item.onclick = () => editarMovimiento(g.id, g.concepto, g.importe, g.fecha);
        item.innerHTML = `
            <div class="movimiento-info">
                <span class="movimiento-concepto">${g.concepto}</span>
                <span class="movimiento-fecha">${fechaFormateada}</span>
            </div>
            <div class="movimiento-importe">-€${formatearNumero(g.importe)}</div>
        `;
        container.appendChild(item);
    });
}

function editarMovimiento(id, conceptoActual, importeActual, fechaActual) {
    movimientoAEditar = id;
    document.getElementById('edit-concepto').value = conceptoActual;
    document.getElementById('edit-importe').value = importeActual;
    // Extraer solo la parte YYYY-MM-DD para el input date
    document.getElementById('edit-fecha').value = fechaActual.split(' ')[0];
    document.getElementById('modal-edicion').style.display = 'flex';
}

function cerrarModalEdicion() {
    document.getElementById('modal-edicion').style.display = 'none';
}

async function guardarCambiosMovimiento() {
    const id = movimientoAEditar;
    const nuevoConcepto = document.getElementById('edit-concepto').value.trim();
    const nuevoImporte = parseFloat(document.getElementById('edit-importe').value);
    const nuevaFechaSimple = document.getElementById('edit-fecha').value; // YYYY-MM-DD

    if (!nuevoConcepto || isNaN(nuevoImporte) || nuevoImporte <= 0 || !nuevaFechaSimple) {
        return alert("Datos inválidos");
    }

    // Mantener HH:MM:SS si es posible o usar una por defecto
    const nuevaFechaCompleta = nuevaFechaSimple + " 12:00:00";

    try {
        mostrarToast("Actualizando...");
        await pb.collection('MisGastos').update(id, {
            concepto: nuevoConcepto,
            importe: nuevoImporte,
            fecha: nuevaFechaCompleta
        });

        cerrarModalEdicion();
        mostrarToast("Actualizado!");
        await cargarGastos();
        renderizarMovimientos();
    } catch (err) {
        alert("Error al actualizar: " + err.message);
    }
}

async function borrarMovimientoActual() {
    if (!confirm("¿Seguro que quieres eliminar este gasto permanentemente?")) return;

    const id = movimientoAEditar;
    try {
        mostrarToast("Eliminando...");
        await pb.collection('MisGastos').delete(id);

        cerrarModalEdicion();
        mostrarToast("Gasto eliminado");
        await cargarGastos();
        renderizarMovimientos();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

async function anadirGasto() {
    const inputConcepto = document.getElementById('input-concepto');
    const inputImporte = document.getElementById('input-importe');
    const btn = document.getElementById('btn-anadir');

    const concepto = inputConcepto.value.trim();
    const importe = parseFloat(inputImporte.value);

    if (!concepto || isNaN(importe) || importe <= 0) {
        return alert("Por favor, pon un concepto y un importe mayor que cero");
    }

    try {
        btn.disabled = true;
        btn.textContent = "Guardando...";

        // Datos a enviar a PocketBase
        const data = {
            concepto: concepto,
            importe: importe,
            fecha: new Date().toISOString().replace('T', ' ').split('.')[0], // Formato YYYY-MM-DD HH:MM:SS
            user: pb.authStore.model.id
        };

        await pb.collection('MisGastos').create(data);

        inputConcepto.value = '';
        inputImporte.value = '';
        mostrarToast("Gasto guardado!");
        await cargarGastos();

    } catch (err) {
        console.error("ERROR PocketBase:", err);
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "+ Añadir Gasto";
    }
}

async function editarPresupuesto() {
    const actual = obtenerPresupuestoActual();
    const actualFormat = actual.toString().replace('.', ',');
    const nuevo = prompt("Introduce tu nuevo presupuesto mensual para este periodo:", actualFormat);
    if (nuevo === null) return;

    const valor = parseFloat(nuevo.replace(',', '.'));
    if (!isNaN(valor) && valor > 0) {
        const key = getPresupuestoKey();
        localStorage.setItem(key, valor);
        presupuestoMensual = valor;
        await cargarGastos();
        mostrarToast("Presupuesto actualizado");
    } else {
        mostrarToast("Valor inválido");
    }
}

function formatearNumero(num) {
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function actualizarUI(gastado) {
    const presupuesto = presupuestoMensual;
    const restante = presupuesto - gastado;
    const porcentajeRestante = Math.max(0, (restante / presupuesto) * 100);

    document.getElementById('texto-gastado').textContent = `€${formatearNumero(gastado)}`;
    document.getElementById('texto-presupuesto').textContent = `€${formatearNumero(presupuesto)}`;
    document.getElementById('texto-restante').textContent = `€${formatearNumero(restante)}`;
    document.getElementById('texto-porcentaje').textContent = `${Math.round(porcentajeRestante)}%`;

    const grafico = document.getElementById('grafico-circular');
    const label = document.getElementById('label-restante');

    if (restante < 0) {
        document.documentElement.style.setProperty('--primary', 'var(--danger)');
        grafico.style.background = `conic-gradient(var(--danger) 0% 100%, #e0e0e0 0%)`;
        label.textContent = "EXCEDIDO";
        document.getElementById('texto-porcentaje').textContent = "!!!";
    } else {
        let colorActual = '#00bcd4';
        if (porcentajeRestante > 66) colorActual = 'var(--success)';
        else if (porcentajeRestante >= 33) colorActual = 'var(--warning)';
        else colorActual = 'var(--danger)';

        document.documentElement.style.setProperty('--primary', colorActual);
        grafico.style.background = `conic-gradient(var(--primary) 0% ${porcentajeRestante}%, #e0e0e0 ${porcentajeRestante}% 100%)`;
        label.textContent = "DISPONIBLE";
    }
}

function mostrarToast(mensaje) {
    const t = document.getElementById('toast');
    t.textContent = mensaje;
    t.style.opacity = '1';
    setTimeout(() => t.style.opacity = '0', 2000);
}
