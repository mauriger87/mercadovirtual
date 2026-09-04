// ============================================
// STORAGE.JS — Estado global y persistencia
// ============================================

let PROMOS = JSON.parse(localStorage.getItem('promosConfig')) || {
    dia: {
        0: { activo: true,  minimo: 25000, porcentaje: 12 },
        1: { activo: true,  minimo: 20000, porcentaje: 8  },
        2: { activo: false, minimo: 25000, porcentaje: 10 },
        3: { activo: false, minimo: 25000, porcentaje: 10 },
        4: { activo: false, minimo: 25000, porcentaje: 10 },
        5: { activo: true,  minimo: 25000, porcentaje: 12 },
        6: { activo: true,  minimo: 25000, porcentaje: 12 },
    },
    envioGratis:   { minimo: 35000, activo: true },
    primeraCompra: { activo: true, minimo: 25000, porcentaje: 10, incluyeEnvio: true },
    especial:      { activo: false, nombre: 'Black Friday', inicio: '', fin: '', minimo: 30000, porcentaje: 20 }
};

let productos = JSON.parse(localStorage.getItem('productosTienda_v2')) || [];
let carrito   = JSON.parse(localStorage.getItem('carritoTienda_v2'))   || [];
let config    = JSON.parse(localStorage.getItem('configTienda')) || {
    margenGeneral: 30, descuentoCantidad: 5,
    margenesSecciones: {}, margenesFamilias: {}, margenesSubfamilias: {},
    topDinamico: 100, stockMinimo: 0, stockCritico: 5, stockBajo: 20
};
let ofertas      = JSON.parse(localStorage.getItem('ofertasTienda'))    || [];
let folletoItems = JSON.parse(localStorage.getItem('folletoItems'))     || {};
let favoritos    = JSON.parse(localStorage.getItem('favoritosTienda'))  || [];
let zonasEnvio   = JSON.parse(localStorage.getItem('zonasEnvio')) || {
    precioBase:    1000,
    kmBase:        3,
    precioPorKm:   300,
    departamentos: ['guaymallen', 'maipú', 'maipu'],
};
let envioCliente = JSON.parse(localStorage.getItem('envioCliente')) || {
    calculado: false,
    costo: 0,
    distancia: 0,
    direccion: '',
    departamento: '',
};

let ordenActual     = 'vendidos';
let filtros         = { seccion: '', familia: '', subfamilia: '', busqueda: '' };
let seccionActiva   = 'todos';
let usuarioYaCompro = localStorage.getItem('yaCompro') === 'true';

// ── Paginación del catálogo ("Cargar más") ──
const PRODUCTOS_POR_PAGINA = 24;
let productosVisibles      = PRODUCTOS_POR_PAGINA;

// ============================================
// PERSISTENCIA
// ============================================
function guardar() {
    try {
        localStorage.setItem('productosTienda_v2', JSON.stringify(productos));
        localStorage.setItem('carritoTienda_v2',   JSON.stringify(carrito));
        localStorage.setItem('configTienda',        JSON.stringify(config));
        localStorage.setItem('ofertasTienda',       JSON.stringify(ofertas));
        localStorage.setItem('promosConfig',        JSON.stringify(PROMOS));
        localStorage.setItem('folletoItems',        JSON.stringify(folletoItems));
        localStorage.setItem('favoritosTienda',     JSON.stringify(favoritos));
        localStorage.setItem('zonasEnvio',          JSON.stringify(zonasEnvio));
        localStorage.setItem('envioCliente',        JSON.stringify(envioCliente));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            toast('⚠ Almacenamiento lleno. Eliminá productos antiguos.', 'error');
        } else {
            toast('❌ Error al guardar datos', 'error');
        }
    }
}

// ============================================
// CONFIG REMOTA
// ============================================
async function cargarConfigRemota() {
    try {
        const response = await fetch(CONFIG_SHEET_URL);
        if (!response.ok) return;
        const csv = await response.text();
        const lineas = csv.trim().split('\n').slice(1);
        const configRemota = {};
        lineas.forEach(linea => {
            const partes = linea.split(',');
            const clave  = partes[0]?.trim().replace(/^"|"$/g, '');
            const valor  = partes[1]?.trim().replace(/^"|"$/g, '');
            if (clave && valor !== undefined) {
                configRemota[clave] = isNaN(valor) ? valor : Number(valor);
            }
        });
        const clavesAplicar = ['topDinamico','stockMinimo','stockCritico','stockBajo','margenGeneral','descuentoCantidad'];
        let huboCambios = false;
        clavesAplicar.forEach(clave => {
            if (configRemota[clave] !== undefined && config[clave] !== configRemota[clave]) {
                config[clave] = configRemota[clave];
                huboCambios = true;
            }
        });
        if (huboCambios) {
            guardar();
            renderProductos();
            console.log('✅ Config remota aplicada:', configRemota);
        }
    } catch (err) {
        console.warn('⚠ No se pudo cargar config remota:', err.message);
    }
}

async function guardarConfigRemota(configParcial) {
    try {
        const payload = JSON.stringify({ ...configParcial, _key: ADMIN_SECRET });
        const url = APPS_SCRIPT_URL + '?payload=' + encodeURIComponent(payload);
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        if (data.ok) {
            console.log('✅ Config guardada en Sheet:', data.actualizadas);
            toast('✅ Configuración guardada en Sheet', 'success');
        } else {
            console.error('❌ Error del script:', data.error);
        }
        return data.ok;
    } catch (err) {
        console.error('❌ Error al guardar config:', err.message);
        return false;
    }
}

// ============================================
// CARGA DIFERIDA DE LIBRERÍAS (solo admin)
// ============================================
let _papaParseCargada = false;

// Carga SOLO PapaParse. Se usa para el flujo público (productos, folleto)
// que corre en cada visita: no debe depender de SheetJS/XLSX, que es pesado
// y solo hace falta para importar/exportar Excel en el panel de admin.
async function cargarPapaParse() {
    if (_papaParseCargada || typeof Papa !== 'undefined') { _papaParseCargada = true; return; }
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar PapaParse'));
        document.head.appendChild(s);
    });
    _papaParseCargada = true;
}

let _libreriasAdminCargadas = false;

async function cargarLibreriasAdmin() {
    if (_libreriasAdminCargadas) return;
    if (typeof XLSX !== 'undefined' && typeof Papa !== 'undefined') {
        _libreriasAdminCargadas = true;
        return;
    }
    toast('⏳ Preparando herramientas...', 'success');
    await Promise.all([
        new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('No se pudo cargar SheetJS'));
            document.head.appendChild(s);
        }),
        new Promise((resolve, reject) => {
            if (typeof Papa !== 'undefined') return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('No se pudo cargar PapaParse'));
            document.head.appendChild(s);
        })
    ]);
    _libreriasAdminCargadas = true;
}
