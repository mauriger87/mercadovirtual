// ============================================
// MAPA.JS — Cobertura, Leaflet y envío
// ============================================

const COBERTURA_LAT = -32.895019;
const COBERTURA_LNG = -68.768249;
let _leafletCargado  = false;
let _coberturaMap    = null;
let _marcadorCliente = null;

function abrirCobertura() {
    const modal = document.getElementById('coberturaModal');
    if (!modal) return;
    modal.classList.add('show');
    const infoEl = document.getElementById('zonaInfoPrecio');
    if (infoEl) {
        const base   = zonasEnvio.precioBase  || 1000;
        const kmBase = zonasEnvio.kmBase      || 3;
        const porKm  = zonasEnvio.precioPorKm || 300;
        infoEl.textContent = `Primeros ${kmBase}km: $${base.toLocaleString('es-AR')} · Luego $${porKm.toLocaleString('es-AR')} por km`;
    }
    if (!_leafletCargado) {
        cargarLeaflet();
    } else if (_coberturaMap) {
        setTimeout(() => _coberturaMap.invalidateSize(), 100);
    }
}

function cerrarCobertura() {
    document.getElementById('coberturaModal')?.classList.remove('show');
}

async function cargarLeaflet() {
    if (_leafletCargado) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
    _leafletCargado = true;
    iniciarMapa();
}

function iniciarMapa() {
    if (_coberturaMap) {
        _coberturaMap.remove();
        _coberturaMap = null;
        _marcadorCliente = null;
    }
    const mapEl = document.getElementById('coberturaMap');
    if (!mapEl) return;

    _coberturaMap = L.map('coberturaMap', { zoomControl: true, scrollWheelZoom: false })
        .setView([COBERTURA_LAT, COBERTURA_LNG], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(_coberturaMap);

    L.marker([COBERTURA_LAT, COBERTURA_LNG], {
        icon: L.divIcon({
            className: '',
            html: '<div style="background:#e63946;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📦</div>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        })
    }).addTo(_coberturaMap).bindPopup('<strong>📦 Mercadito Virtual</strong><br>Punto de despacho');

    mapEl.style.cursor = 'crosshair';
    _coberturaMap.on('click', function(e) {
        colocarPinCliente(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(() => _coberturaMap.invalidateSize(), 150);
}

async function colocarPinCliente(lat, lng) {
    const distancia = calcularDistanciaKm(COBERTURA_LAT, COBERTURA_LNG, lat, lng);
    let displayName = '', departamento = '';
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
        const r = await fetch(url, { headers: { 'Accept-Language': 'es' } });
        const d = await r.json();
        displayName  = d.display_name || '';
        departamento = d.address?.county || d.address?.city || d.address?.state_district || '';
    } catch { /* usa solo distancia */ }

    const habilitado  = displayName ? esDepartamentoHabilitado(displayName) : true;
    const dentroRango = distancia <= 10;
    const resultado   = document.getElementById('coberturaResultado');

    if (_marcadorCliente) _marcadorCliente.remove();
    _marcadorCliente = L.marker([lat, lng], {
        icon: L.divIcon({
            className: '',
            html: '<div style="background:#1d3557;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📍</div>',
            iconSize: [28, 28], iconAnchor: [14, 14]
        }),
        draggable: true
    }).addTo(_coberturaMap);

    _marcadorCliente.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        colocarPinCliente(pos.lat, pos.lng);
    });

    const distTexto = distancia.toFixed(1);

    if (!habilitado || !dentroRango) {
        const motivo = !habilitado
            ? 'Solo hacemos envíos a Guaymallén y Maipú'
            : `Estás a ${distTexto} km — fuera de nuestro radio de 10 km`;
        _marcadorCliente.bindPopup(`❌ Fuera de zona<br><small>${motivo}</small>`).openPopup();
        if (resultado) {
            resultado.innerHTML = `<div class="resultado-zona"><span class="resultado-emoji">❌</span><div><strong>Fuera de zona</strong><br><span>${motivo}</span></div></div>`;
            resultado.className = 'cobertura-resultado resultado-error';
            resultado.style.display = 'block';
        }
        envioCliente = { calculado: false, costo: 0, distancia: 0, direccion: '', departamento: '' };
        guardar(); actualizarCarrito();
        return;
    }

    const costo    = calcularCostoEnvio(distancia);
    const costoFmt = formatearCostoEnvio(costo);
    const dirLabel = displayName.split(',')[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    _marcadorCliente.bindPopup(`✅ <strong>Envío: ${costoFmt}</strong><br><small>${distTexto} km · Arrastrá el pin para ajustar</small>`).openPopup();
    if (resultado) {
        resultado.innerHTML = `<div class="resultado-zona"><span class="resultado-emoji">✅</span><div><strong>¡Llegamos! — Envío ${costoFmt}</strong><br><span>${distTexto} km desde nuestro depósito · Arrastrá el pin para ajustar</span></div></div>`;
        resultado.className = 'cobertura-resultado resultado-verde';
        resultado.style.display = 'block';
    }

    envioCliente = { calculado: true, costo, distancia: parseFloat(distTexto), direccion: dirLabel, departamento };
    guardar(); actualizarCarrito();
}

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function verificarDireccion() {
    const input     = document.getElementById('coberturaDir');
    const resultado = document.getElementById('coberturaResultado');
    const btn       = document.getElementById('btnVerificarDir');
    if (!input || !resultado) return;
    const dir = input.value.trim();
    if (!dir) { toast('⚠ Ingresá una dirección', 'warning'); return; }

    btn.textContent = '⏳ Buscando...';
    btn.disabled = true;
    resultado.style.display = 'none';

    try {
        const query    = encodeURIComponent(dir + ', Mendoza, Argentina');
        const url      = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'MercaditoVirtualMendoza/1.0' } });
        const data     = await response.json();

        if (!data.length) {
            resultado.innerHTML = '❌ No encontramos esa dirección. Probá con calle y número más el barrio.';
            resultado.className = 'cobertura-resultado resultado-error';
            resultado.style.display = 'block';
            return;
        }

        const { lat, lon, display_name } = data[0];
        const clienteLat  = parseFloat(lat);
        const clienteLng  = parseFloat(lon);
        const distancia   = calcularDistanciaKm(COBERTURA_LAT, COBERTURA_LNG, clienteLat, clienteLng);
        const distTexto   = distancia.toFixed(1);
        const habilitado  = esDepartamentoHabilitado(display_name);
        const dentroRango = distancia <= 10;

        if (!habilitado || !dentroRango) {
            resultado.innerHTML = `<div class="resultado-zona"><span class="resultado-emoji">❌</span><div><strong>Fuera de zona de cobertura</strong><br><span>Por ahora solo hacemos envíos a Guaymallén y Maipú.</span></div></div>`;
            resultado.className = 'cobertura-resultado resultado-error';
            resultado.style.display = 'block';
            envioCliente = { calculado: false, costo: 0, distancia: 0, direccion: '', departamento: '' };
            guardar(); actualizarCarrito();
            return;
        }

        const costo    = calcularCostoEnvio(distancia);
        const costoFmt = formatearCostoEnvio(costo);
        const depto    = display_name.split(',')[1]?.trim() || '';

        resultado.innerHTML = `<div class="resultado-zona"><span class="resultado-emoji">✅</span><div><strong>¡Llegamos! — Envío ${costoFmt}</strong><br><span>${distTexto} km desde nuestro depósito · ${display_name.split(',')[0]}</span></div></div>`;
        resultado.className = 'cobertura-resultado resultado-verde';
        resultado.style.display = 'block';

        envioCliente = { calculado: true, costo, distancia: parseFloat(distTexto), direccion: display_name.split(',')[0], departamento: depto };
        guardar(); actualizarCarrito();

        if (_coberturaMap) {
            _coberturaMap.setView([clienteLat, clienteLng], 14);
            if (_marcadorCliente) _marcadorCliente.remove();
            _marcadorCliente = L.marker([clienteLat, clienteLng], {
                icon: L.divIcon({
                    className: '',
                    html: '<div style="background:#1d3557;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📍</div>',
                    iconSize: [28, 28], iconAnchor: [14, 14]
                }),
                draggable: true
            }).addTo(_coberturaMap)
              .bindPopup(`✅ <strong>Envío: ${costoFmt}</strong><br><small>${distTexto} km · Arrastrá el pin para ajustar</small>`)
              .openPopup();
            _marcadorCliente.on('dragend', function(e) {
                const pos = e.target.getLatLng();
                colocarPinCliente(pos.lat, pos.lng);
            });
        }
    } catch (err) {
        resultado.innerHTML = '❌ Error al buscar. Revisá tu conexión e intentá de nuevo.';
        resultado.className = 'cobertura-resultado resultado-error';
        resultado.style.display = 'block';
        console.error('Geocoding error:', err);
    } finally {
        btn.textContent = 'Buscar';
        btn.disabled = false;
    }
}

function calcularCostoEnvio(distanciaKm) {
    const base   = zonasEnvio.precioBase  || 1000;
    const kmBase = zonasEnvio.kmBase      || 3;
    const porKm  = zonasEnvio.precioPorKm || 300;
    if (distanciaKm <= kmBase) return base;
    return Math.round(base + (distanciaKm - kmBase) * porKm);
}

function formatearCostoEnvio(costo) {
    return costo === 0 ? 'Gratis' : `$${Math.round(costo).toLocaleString('es-AR')}`;
}

function esDepartamentoHabilitado(displayName) {
    const normalizar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dn = normalizar(displayName);
    return ['guaymallen', 'maipu'].some(d => dn.includes(d));
}

function guardarZonasEnvio() {
    zonasEnvio = {
        precioBase:    parseFloat(document.getElementById('zona1Precio')?.value)  || 1000,
        kmBase:        parseFloat(document.getElementById('kmBase')?.value)        || 3,
        precioPorKm:   parseFloat(document.getElementById('precioPorKm')?.value)   || 300,
        departamentos: ['guaymallen', 'maipú', 'maipu'],
    };
    guardar();
    if (_coberturaMap) { _coberturaMap.remove(); _coberturaMap = null; }
    toast('✅ Configuración de envío guardada', 'success');
}

function cargarUIZonas() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('zona1Precio', zonasEnvio.precioBase  || 1000);
    set('kmBase',      zonasEnvio.kmBase       || 3);
    set('precioPorKm', zonasEnvio.precioPorKm  || 300);
}
