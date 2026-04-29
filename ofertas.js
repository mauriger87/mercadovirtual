// ============================================
// OFERTAS.JS — Folleto, promos y precios
// ============================================

function getItemFolleto(ean) {
    if (!ean || String(ean).trim().length < 8) return null;
    if (!folletoItems[String(ean).trim()]) return null;
    const item = folletoItems[String(ean)];
    const hoy  = new Date();
    hoy.setHours(0, 0, 0, 0);
    const desde = parseLocalDate(item.fecha_desde);
    const hasta = parseLocalDate(item.fecha_hasta);
    if (!desde || !hasta) return null;
    hasta.setHours(23, 59, 59, 999);
    return (hoy >= desde && hoy <= hasta) ? item : null;
}

async function cargarFolleto(silencioso = false) {
    if (FOLLETO_GID === 'FOLLETO_GID') {
        if (!silencioso) toast('⚠ Configurá el FOLLETO_GID en el código', 'warning');
        return;
    }
    try {
        if (!silencioso) toast('⏳ Cargando folleto...', 'success');
        if (typeof Papa === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('No se pudo cargar PapaParse'));
                document.head.appendChild(s);
            });
        }
        const response = await fetch(FOLLETO_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const result  = Papa.parse(csvText, {
            header: true, skipEmptyLines: true,
            transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
            transform: v => v.trim()
        });

        const nuevos = {};
        let cargados = 0;
        for (const fila of result.data) {
            const ean = String(fila.ean || '').trim();
            if (!ean) continue;
            const precio_folleto = parseFloat(fila.precio_folleto);
            if (isNaN(precio_folleto) || precio_folleto <= 0) continue;
            const fecha_desde = fila.fecha_desde || '';
            const fecha_hasta = fila.fecha_hasta || '';
            if (!fecha_desde || !fecha_hasta) continue;
            nuevos[ean] = { precio_folleto, mecanica: fila.mecanica || '', fecha_desde, fecha_hasta };
            cargados++;
        }

        folletoItems = nuevos;
        localStorage.setItem('folletoItems', JSON.stringify(folletoItems));
        localStorage.setItem('ultimaActualizacionFolleto', new Date().toISOString());
        renderProductos();

        const statsEl = document.getElementById('folletoStats');
        if (statsEl) {
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const vigentes = Object.values(folletoItems).filter(it => {
                const desde = parseLocalDate(it.fecha_desde);
                const hasta = parseLocalDate(it.fecha_hasta);
                if (!desde || !hasta) return false;
                hasta.setHours(23,59,59,999);
                return hoy >= desde && hoy <= hasta;
            }).length;
            statsEl.textContent = `✅ ${cargados} productos en folleto · ${vigentes} vigentes hoy`;
        }
        if (!silencioso) toast(`✅ Folleto: ${cargados} productos cargados`, 'success');
        console.log(`✅ Folleto cargado: ${cargados} items`);
    } catch (error) {
        if (!silencioso) toast(`❌ Error al cargar folleto: ${error.message}`, 'error');
        console.error('Folleto error:', error);
    }
}

function getOfertasActivasHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return ofertas.filter(o => {
        if (!o.activa) return false;
        const inicio = parseLocalDate(o.fechaInicio);
        const fin    = parseLocalDate(o.fechaFin);
        if (!inicio || !fin) return false;
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        return hoy >= inicio && hoy <= fin;
    });
}

function esPrimeraCompra() {
    return PROMOS.primeraCompra.activo && !usuarioYaCompro;
}

function marcarComoComprado() {
    usuarioYaCompro = true;
    localStorage.setItem('yaCompro', 'true');
}

function getPromoDelDia() {
    const ahora   = new Date();
    const fechaAR = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Mendoza' }));
    return PROMOS.dia[fechaAR.getDay()] || null;
}

function calcularDescuentos(total) {
    let desc = { porcentaje: 0, envioGratis: false, montoDescuento: 0, totalFinal: total, mensajes: [] };

    if (PROMOS.especial?.activo && PROMOS.especial.inicio && PROMOS.especial.fin) {
        const hoy    = new Date();
        const inicio = parseLocalDate(PROMOS.especial.inicio);
        const fin    = parseLocalDate(PROMOS.especial.fin);
        if (inicio && fin) {
            fin.setHours(23, 59, 59, 999);
            if (hoy >= inicio && hoy <= fin && total >= PROMOS.especial.minimo) {
                desc.porcentaje = PROMOS.especial.porcentaje;
                desc.mensajes   = [`🔥 ${PROMOS.especial.nombre}: ${PROMOS.especial.porcentaje}% OFF`];
            }
        }
    }

    const promoDia = getPromoDelDia();
    if (promoDia?.activo && total >= promoDia.minimo && promoDia.porcentaje > desc.porcentaje) {
        desc.porcentaje = promoDia.porcentaje;
        desc.mensajes   = [`🗓 ${promoDia.porcentaje}% OFF por promo del día`];
    }

    if (esPrimeraCompra() && total >= PROMOS.primeraCompra.minimo &&
        PROMOS.primeraCompra.porcentaje > desc.porcentaje) {
        desc.porcentaje = PROMOS.primeraCompra.porcentaje;
        desc.mensajes   = [`🎉 ${PROMOS.primeraCompra.porcentaje}% OFF por primera compra`];
    }

    if (PROMOS.envioGratis.activo && total >= PROMOS.envioGratis.minimo) {
        desc.envioGratis = true;
        desc.mensajes.push('🚚 Envío gratis incluido');
    }

    if (desc.porcentaje > 0) {
        desc.montoDescuento = total * (desc.porcentaje / 100);
        desc.totalFinal     = total - desc.montoDescuento;
    }
    return desc;
}

function actualizarBannerPrimeraCompra(totalCarrito) {
    const banner   = document.getElementById('bannerPrimeraCompra');
    const mensaje  = document.getElementById('bannerMensaje');
    const progreso = document.getElementById('bannerProgreso');
    if (!banner) return;
    if (!PROMOS.primeraCompra.activo || usuarioYaCompro) { banner.style.display = 'none'; return; }
    banner.style.display = 'block';
    const minimo = PROMOS.primeraCompra.minimo;
    const falta  = Math.max(0, minimo - totalCarrito);
    if (totalCarrito >= minimo) {
        mensaje.textContent  = `🎉 ¡Desbloqueaste ${PROMOS.primeraCompra.porcentaje}% OFF + envío gratis!`;
        progreso.textContent = '✅ Beneficio aplicado al finalizar el pedido';
    } else {
        mensaje.textContent  = `${PROMOS.primeraCompra.porcentaje}% off + envío gratis en compras > $${minimo.toLocaleString('es-AR')}`;
        progreso.textContent = `Llevás $${totalCarrito.toLocaleString('es-AR')} · Te faltan $${falta.toLocaleString('es-AR')}`;
    }
}

function actualizarBarraEnvioGratis(total) {
    const bar   = document.getElementById('envioGratisBar');
    const texto = document.getElementById('envioGratisBarTexto');
    const fill  = document.getElementById('envioGratisFill');
    if (!bar || !texto || !fill) return;
    if (!PROMOS.envioGratis.activo) { bar.style.display = 'none'; return; }
    const minimo = PROMOS.envioGratis.minimo;
    if (total >= minimo) {
        bar.style.display = 'block';
        texto.textContent = '🚚 ¡Tenés envío gratis en este pedido!';
        fill.style.width  = '100%';
        fill.style.background = '#2a9d8f';
    } else {
        const falta = minimo - total;
        const pct   = Math.min(100, Math.round((total / minimo) * 100));
        bar.style.display = 'block';
        texto.textContent = `🚚 Sumá $${falta.toLocaleString('es-AR')} más y el envío es gratis`;
        fill.style.width  = pct + '%';
        fill.style.background = pct >= 75 ? '#e9c46a' : '#a8dadc';
    }
}

function calcularPrecio(producto, cant = 1, ofertasHoy = null) {
    if (ofertasHoy === null) ofertasHoy = getOfertasActivasHoy();
    if (producto.ean) {
        const itemFolleto = getItemFolleto(producto.ean);
        if (itemFolleto) return itemFolleto.precio_folleto;
    }
    const oferta = ofertasHoy.find(o => o.productoId === producto.id);
    if (oferta) return oferta.precioOferta;

    let margen = config.margenGeneral;
    const sf = producto.subfamilia?.toLowerCase();
    const fa = producto.familia?.toLowerCase();
    const se = producto.seccion?.toLowerCase();
    if (sf && config.margenesSubfamilias[sf] != null) margen = config.margenesSubfamilias[sf];
    else if (fa && config.margenesFamilias[fa] != null) margen = config.margenesFamilias[fa];
    else if (se && config.margenesSecciones[se] != null) margen = config.margenesSecciones[se];
    if (cant >= 3) margen = Math.max(0, margen - config.descuentoCantidad);
    return parseFloat((producto.costo * (1 + margen / 100)).toFixed(2));
}

function getPrecioOriginal(producto) {
    let margen = config.margenGeneral;
    const sf = producto.subfamilia?.toLowerCase();
    const fa = producto.familia?.toLowerCase();
    const se = producto.seccion?.toLowerCase();
    if (sf && config.margenesSubfamilias[sf] != null) margen = config.margenesSubfamilias[sf];
    else if (fa && config.margenesFamilias[fa] != null) margen = config.margenesFamilias[fa];
    else if (se && config.margenesSecciones[se] != null) margen = config.margenesSecciones[se];
    return parseFloat((producto.costo * (1 + margen / 100)).toFixed(2));
}

function estaEnOferta(p) {
    return getOfertasActivasHoy().some(o => o.productoId === p.id);
}

function estaEnFolleto(p) {
    if (!p.ean || String(p.ean).trim().length < 8) return null;
    return getItemFolleto(p.ean);
}
