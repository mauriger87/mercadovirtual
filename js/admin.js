// ============================================
// ADMIN.JS — Panel admin, importación, configuración
// ============================================

async function verificarPassword() {
    const pass = document.getElementById('passwordInput').value;
    if (!pass) return;
    const hash = await hashPassword(pass);
    if (hash === ADMIN_PASSWORD_HASH) {
        document.getElementById('passwordModal').classList.remove('show');
        document.getElementById('adminPanel').classList.add('open');
        document.getElementById('passwordInput').value = '';
        renderProductosAdmin(); renderMargenes(); renderListaOfertas();
        cargarUIPromos(); cargarUIZonas(); actualizarPreviewTop(); actualizarPreviewStock();
        const topR = document.getElementById('topRange');
        const topE = document.getElementById('topExacto');
        const topD = document.getElementById('topValorDisplay');
        if (topR) topR.value = config.topDinamico;
        if (topE) topE.value = config.topDinamico;
        if (topD) topD.textContent = config.topDinamico;
        const smR = document.getElementById('stockMinimoRange');
        const smE = document.getElementById('stockMinimoExacto');
        const scR = document.getElementById('stockCriticoRange');
        const scE = document.getElementById('stockCriticoExacto');
        const sbR = document.getElementById('stockBajoRange');
        const sbE = document.getElementById('stockBajoExacto');
        const snM = document.getElementById('stockNormalMin');
        if (smR) smR.value = config.stockMinimo;
        if (smE) smE.value = config.stockMinimo;
        if (scR) scR.value = config.stockCritico;
        if (scE) scE.value = config.stockCritico;
        if (sbR) sbR.value = config.stockBajo;
        if (sbE) sbE.value = config.stockBajo;
        if (snM) snM.value = config.stockBajo + 1;
    } else {
        toast('❌ Contraseña incorrecta', 'error');
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
}

function renderProductosAdmin() {
    const term  = document.getElementById('buscarProductoAdmin')?.value.toLowerCase() || '';
    const prods = term ? productos.filter(p => p.nombre.toLowerCase().includes(term)) : productos;
    document.getElementById('productListAdmin').innerHTML = prods.length
        ? prods.map(p => `
            <div style="padding:10px;border:1px solid var(--accent);margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;border-radius:8px;">
                <div>
                    <strong>${escapeHTML(p.nombre)}</strong>
                    <span style="color:var(--gray);font-size:0.85rem;"> · ${escapeHTML(p.seccion)} · Stock: ${p.stock} · $${calcularPrecio(p, 1).toLocaleString('es-AR')}</span>
                </div>
                <button class="btn-delete" data-id="${escapeHTMLAttr(p.id)}" style="padding:6px 12px;">🗑️</button>
            </div>`).join('')
        : '<p style="color:var(--gray);">Sin productos</p>';
}

function eliminarProducto(id) {
    confirmarAccion('¿Eliminar este producto?', () => {
        productos = productos.filter(p => p.id !== id);
        carrito   = carrito.filter(c => c.id !== id);
        guardar(); renderProductos(); renderProductosAdmin(); actualizarCarrito(); actualizarFiltros();
        toast('✅ Producto eliminado', 'success');
    });
}

function agregarProductoManual() {
    const nombre     = document.getElementById('productName')?.value.trim();
    const seccion    = document.getElementById('productSeccion')?.value.trim().toUpperCase() || 'OTROS';
    const familia    = document.getElementById('productFamilia')?.value.trim().toUpperCase() || '';
    const subfamilia = document.getElementById('productSubfamilia')?.value.trim().toUpperCase() || '';
    const costo      = parseFloat(document.getElementById('productCosto')?.value);
    const stock      = parseInt(document.getElementById('productStock')?.value) || 0;
    const emoji      = document.getElementById('productEmoji')?.value.trim() || '📦';
    const imagen     = document.getElementById('productImage')?.value.trim() || '';

    if (!nombre)          return toast('❌ El nombre es obligatorio', 'error');
    if (!costo || costo <= 0) return toast('❌ El costo debe ser mayor a 0', 'error');

    const precio = parseFloat((costo * (1 + config.margenGeneral / 100)).toFixed(2));
    productos.push({ id: generarIdEstable(nombre), nombre, seccion, familia, subfamilia, costo, precio, stock: Math.max(0, stock), venta_diaria: 0, imagen, emoji });
    guardar(); actualizarFiltros(); renderProductos(); renderProductosAdmin();

    ['productName','productSeccion','productFamilia','productSubfamilia',
     'productCosto','productStock','productEmoji','productImage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('productEmoji').value = '📦';
    toast(`✅ "${nombre}" agregado`, 'success');
}

async function guardarMargenGeneral() {
    const val = parseFloat(document.getElementById('margenGeneral')?.value);
    if (isNaN(val) || val < 0) return toast('❌ Margen inválido', 'error');
    config.margenGeneral = val; guardar(); renderProductos();
    await guardarConfigRemota({ margenGeneral: val });
    toast('✅ Margen general guardado para todos', 'success');
}

async function guardarDescuentoCantidad() {
    const val = parseFloat(document.getElementById('descuentoCantidad')?.value);
    if (isNaN(val) || val < 0) return toast('❌ Valor inválido', 'error');
    config.descuentoCantidad = val; guardar();
    await guardarConfigRemota({ descuentoCantidad: val });
    toast('✅ Descuento por cantidad guardado para todos', 'success');
}

function _agregarMargenCategoria(inputNombre, inputMargen, tipoConfig, label) {
    const nombre = document.getElementById(inputNombre)?.value.trim().toLowerCase();
    const margen = parseFloat(document.getElementById(inputMargen)?.value);
    if (!nombre) return toast(`❌ Ingresá un nombre de ${label}`, 'error');
    if (isNaN(margen) || margen < 0) return toast('❌ Margen inválido', 'error');
    config[tipoConfig][nombre] = margen; guardar(); renderMargenes(); renderProductos();
    document.getElementById(inputNombre).value = '';
    document.getElementById(inputMargen).value = '';
    toast(`✅ Margen para "${nombre.toUpperCase()}" guardado`, 'success');
}

function agregarMargenSeccion()    { _agregarMargenCategoria('nuevaSeccionNombre',    'nuevaSeccionMargen',    'margenesSecciones',  'sección'); }
function agregarMargenFamilia()    { _agregarMargenCategoria('nuevaFamiliaNombre',    'nuevaFamiliaMargen',    'margenesFamilias',   'familia'); }
function agregarMargenSubfamilia() { _agregarMargenCategoria('nuevaSubfamiliaNombre', 'nuevaSubfamiliaMargen', 'margenesSubfamilias','subfamilia'); }

function eliminarMargen(tipoConfig, nombre) {
    delete config[tipoConfig][nombre]; guardar(); renderMargenes(); renderProductos();
    toast('✅ Margen eliminado', 'success');
}

function renderMargenes() {
    const renderLista = (containerId, obj, tipoConfig) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        const entradas = Object.entries(obj);
        el.innerHTML = entradas.length
            ? entradas.map(([nombre, margen]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;">
                    <span><strong>${escapeHTML(nombre.toUpperCase())}</strong> → ${margen}%</span>
                    <button class="btn-delete" style="padding:4px 8px;font-size:0.8rem;" onclick="eliminarMargen('${tipoConfig}','${escapeHTMLAttr(nombre)}')">✕</button>
                </div>`).join('')
            : '<p style="color:var(--gray);font-size:0.9rem;">Sin márgenes personalizados</p>';
    };
    renderLista('margenesSecciones',   config.margenesSecciones,   'margenesSecciones');
    renderLista('margenesFamilias',    config.margenesFamilias,    'margenesFamilias');
    renderLista('margenesSubfamilias', config.margenesSubfamilias, 'margenesSubfamilias');
}

async function guardarConfiguracionStockCompleta() {
    config.stockMinimo  = parseInt(document.getElementById('stockMinimoExacto')?.value) || 0;
    config.stockCritico = parseInt(document.getElementById('stockCriticoExacto')?.value) || 5;
    config.stockBajo    = parseInt(document.getElementById('stockBajoExacto')?.value) || 20;
    guardar(); renderProductos(); actualizarFiltros();
    await guardarConfigRemota({ stockMinimo: config.stockMinimo, stockCritico: config.stockCritico, stockBajo: config.stockBajo });
    toast('✅ Config de stock guardada para todos', 'success');
}

async function guardarTopDinamico() {
    const val = parseInt(document.getElementById('topExacto')?.value);
    if (isNaN(val) || val < 1) return toast('❌ Valor inválido', 'error');
    config.topDinamico = val; guardar(); renderProductos();
    await guardarConfigRemota({ topDinamico: val });
    toast(`✅ Top catálogo: ${val} productos (guardado para todos)`, 'success');
}

function actualizarPreviewTop() {
    const top = parseInt(document.getElementById('topRange')?.value) || config.topDinamico;
    const vis = productos.filter(p => p.stock >= (config.stockMinimo || 0));
    const el  = document.getElementById('statsDinamicas');
    if (el) el.innerHTML = `Mostrás los <strong>${Math.min(top, vis.length)}</strong> más vendidos de <strong>${vis.length}</strong> disponibles`;
}

function actualizarPreviewStock() {
    const minimo  = parseInt(document.getElementById('stockMinimoExacto')?.value) || 0;
    const visible = productos.filter(p => p.stock >= minimo);
    const ocultos = productos.length - visible.length;
    const el      = document.getElementById('statsStockFiltro');
    if (el) el.innerHTML = `Mostrando <strong>${visible.length}</strong> productos · <strong>${ocultos}</strong> ocultos por stock bajo`;
}

function renderListaOfertas() {
    const lista = document.getElementById('listaOfertas');
    if (!lista) return;
    const activas = ofertas.filter(o => o.activa);
    lista.innerHTML = activas.length
        ? activas.map(o => {
            const p = productos.find(x => x.id === o.productoId);
            return `
                <div style="padding:10px;border:1px solid var(--accent);margin-bottom:8px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${escapeHTML(p?.nombre || 'Producto eliminado')}</strong><br>
                        <small>$${o.precioOferta.toLocaleString('es-AR')} · ${o.fechaInicio} → ${o.fechaFin}</small>
                    </div>
                    <button class="btn-delete" onclick="eliminarOferta('${escapeHTMLAttr(o.id)}')" style="padding:6px 12px;">✕</button>
                </div>`;
          }).join('')
        : '<p style="color:var(--gray);">Sin ofertas activas</p>';
}

function eliminarOferta(id) {
    ofertas = ofertas.filter(o => o.id !== id);
    guardar(); renderListaOfertas(); renderProductos();
    toast('✅ Oferta eliminada', 'success');
}

function iniciarBusquedaOferta() {
    const input        = document.getElementById('buscarProductoOferta');
    const autocomplete = document.getElementById('autocompleteOfertas');
    if (!input || !autocomplete) return;

    input.addEventListener('input', debounce(() => {
        const term = input.value.toLowerCase().trim();
        if (term.length < 2) { autocomplete.innerHTML = ''; return; }
        const resultados = productos.filter(p => p.nombre.toLowerCase().includes(term)).slice(0, 8);
        autocomplete.innerHTML = resultados.map(p => `
            <div class="autocomplete-item" data-id="${escapeHTMLAttr(p.id)}" style="padding:10px;cursor:pointer;border-bottom:1px solid #eee;">
                ${escapeHTML(p.emoji || '📦')} ${escapeHTML(p.nombre)}
                <small style="color:var(--gray);"> · $${calcularPrecio(p, 1).toLocaleString('es-AR')}</small>
            </div>`).join('') || '<div style="padding:10px;color:var(--gray);">Sin resultados</div>';

        autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                mostrarFormularioOferta(item.dataset.id);
                autocomplete.innerHTML = '';
                input.value = '';
            });
        });
    }, 250));
}

function mostrarFormularioOferta(productoId) {
    const p = productos.find(x => x.id === productoId);
    if (!p) return;
    const precioActual = calcularPrecio(p, 1);
    const hoy = new Date().toISOString().split('T')[0];
    const en7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const cont = document.getElementById('resultadosBusquedaOferta');
    cont.innerHTML = `
        <div style="background:#f8f9fa;padding:15px;border-radius:8px;border:2px solid var(--primary);">
            <strong>🔥 ${escapeHTML(p.nombre)}</strong>
            <p style="color:var(--gray);margin:5px 0;">Precio actual: $${precioActual.toLocaleString('es-AR')}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                <div class="form-group">
                    <label>Precio oferta</label>
                    <input type="number" id="ofertaPrecio" value="${(precioActual * 0.85).toFixed(2)}" step="0.01" min="0">
                </div>
                <div></div>
                <div class="form-group"><label>Desde</label><input type="date" id="ofertaInicio" value="${hoy}"></div>
                <div class="form-group"><label>Hasta</label><input type="date" id="ofertaFin" value="${en7}"></div>
            </div>
            <button class="btn-primary" onclick="guardarOferta('${escapeHTMLAttr(p.id)}')" style="margin-top:10px;width:100%;">
                🔥 Activar Oferta
            </button>
        </div>`;
}

function guardarOferta(productoId) {
    const precio = parseFloat(document.getElementById('ofertaPrecio')?.value);
    const inicio = document.getElementById('ofertaInicio')?.value;
    const fin    = document.getElementById('ofertaFin')?.value;
    if (!precio || precio <= 0) return toast('❌ Precio inválido', 'error');
    if (!inicio || !fin)        return toast('❌ Fechas inválidas', 'error');
    if (inicio > fin)           return toast('❌ La fecha inicio debe ser anterior al fin', 'error');
    ofertas = ofertas.filter(o => o.productoId !== productoId);
    ofertas.push({ id: generarIdUnico(), productoId, precioOferta: precio, fechaInicio: inicio, fechaFin: fin, activa: true });
    guardar(); renderListaOfertas(); renderProductos();
    document.getElementById('resultadosBusquedaOferta').innerHTML = '';
    toast('✅ Oferta activada', 'success');
}

function guardarConfiguracionPromos() {
    const dias = [
        { key: 1, id: 'Lunes' }, { key: 2, id: 'Martes' }, { key: 3, id: 'Miercoles' },
        { key: 4, id: 'Jueves' }, { key: 5, id: 'Viernes' }, { key: 6, id: 'Sabado' }, { key: 0, id: 'Domingo' }
    ];
    dias.forEach(({ key, id }) => {
        PROMOS.dia[key] = {
            activo:     document.getElementById(`promo${id}`)?.checked ?? false,
            minimo:     parseFloat(document.getElementById(`promo${id}Min`)?.value) || 0,
            porcentaje: parseFloat(document.getElementById(`promo${id}Desc`)?.value) || 0
        };
    });
    PROMOS.envioGratis.activo        = document.getElementById('envioGratisActivo')?.checked ?? true;
    PROMOS.envioGratis.minimo        = parseFloat(document.getElementById('envioGratisMin')?.value) || 35000;
    PROMOS.primeraCompra.activo      = document.getElementById('primeraCompraActivo')?.checked ?? true;
    PROMOS.primeraCompra.minimo      = parseFloat(document.getElementById('primeraCompraMin')?.value) || 25000;
    PROMOS.primeraCompra.porcentaje  = parseFloat(document.getElementById('primeraCompraDesc')?.value) || 10;
    PROMOS.primeraCompra.incluyeEnvio= document.getElementById('primeraCompraEnvio')?.checked ?? true;
    PROMOS.especial.activo     = document.getElementById('promoEspecialActivo')?.checked ?? false;
    PROMOS.especial.nombre     = document.getElementById('promoEspecialNombre')?.value.trim() || 'Black Friday';
    PROMOS.especial.inicio     = document.getElementById('promoEspecialInicio')?.value || '';
    PROMOS.especial.fin        = document.getElementById('promoEspecialFin')?.value || '';
    PROMOS.especial.minimo     = parseFloat(document.getElementById('promoEspecialMin')?.value) || 30000;
    PROMOS.especial.porcentaje = parseFloat(document.getElementById('promoEspecialDesc')?.value) || 20;
    guardarZonasEnvio();
    guardar(); actualizarCarrito(); mostrarPromosActivasHoy();
    toast('✅ Configuración de promociones guardada', 'success');
}

function cargarUIPromos() {
    const dias = [
        { key: 1, id: 'Lunes' }, { key: 2, id: 'Martes' }, { key: 3, id: 'Miercoles' },
        { key: 4, id: 'Jueves' }, { key: 5, id: 'Viernes' }, { key: 6, id: 'Sabado' }, { key: 0, id: 'Domingo' }
    ];
    dias.forEach(({ key, id }) => {
        const promo = PROMOS.dia[key]; if (!promo) return;
        const cb = document.getElementById(`promo${id}`);
        const mi = document.getElementById(`promo${id}Min`);
        const de = document.getElementById(`promo${id}Desc`);
        if (cb) cb.checked = promo.activo;
        if (mi) mi.value   = promo.minimo;
        if (de) de.value   = promo.porcentaje;
    });
    const set = (id, prop) => { const el = document.getElementById(id); if (el) el[prop[0]] = prop[1]; };
    set('envioGratisActivo',   ['checked', PROMOS.envioGratis.activo]);
    set('envioGratisMin',      ['value',   PROMOS.envioGratis.minimo]);
    set('primeraCompraActivo', ['checked', PROMOS.primeraCompra.activo]);
    set('primeraCompraMin',    ['value',   PROMOS.primeraCompra.minimo]);
    set('primeraCompraDesc',   ['value',   PROMOS.primeraCompra.porcentaje]);
    set('primeraCompraEnvio',  ['checked', PROMOS.primeraCompra.incluyeEnvio]);
    set('promoEspecialActivo', ['checked', PROMOS.especial.activo]);
    set('promoEspecialNombre', ['value',   PROMOS.especial.nombre]);
    set('promoEspecialInicio', ['value',   PROMOS.especial.inicio]);
    set('promoEspecialFin',    ['value',   PROMOS.especial.fin]);
    set('promoEspecialMin',    ['value',   PROMOS.especial.minimo]);
    set('promoEspecialDesc',   ['value',   PROMOS.especial.porcentaje]);
}

function mostrarPromosActivasHoy() {
    const cont = document.getElementById('promosActivasHoy'); if (!cont) return;
    const hoy  = new Date();
    const msgs = [];
    const promoDia = getPromoDelDia();
    if (promoDia?.activo) msgs.push(`🗓 Promo del día: ${promoDia.porcentaje}% OFF en compras > $${promoDia.minimo.toLocaleString('es-AR')}`);
    if (PROMOS.envioGratis.activo)   msgs.push(`🚚 Envío gratis en compras > $${PROMOS.envioGratis.minimo.toLocaleString('es-AR')}`);
    if (PROMOS.primeraCompra.activo) msgs.push(`🎉 Primera compra: ${PROMOS.primeraCompra.porcentaje}% OFF en compras > $${PROMOS.primeraCompra.minimo.toLocaleString('es-AR')}`);
    if (PROMOS.especial?.activo && PROMOS.especial.inicio && PROMOS.especial.fin) {
        const inicio = parseLocalDate(PROMOS.especial.inicio);
        const fin    = parseLocalDate(PROMOS.especial.fin);
        if (inicio && fin) {
            fin.setHours(23, 59, 59, 999);
            if (hoy >= inicio && hoy <= fin) msgs.push(`🔥 ${PROMOS.especial.nombre}: ${PROMOS.especial.porcentaje}% OFF`);
        }
    }
    cont.innerHTML = msgs.length
        ? msgs.map(m => `<p style="padding:8px;background:#e8f4f8;border-radius:6px;margin-bottom:6px;">✅ ${escapeHTML(m)}</p>`).join('')
        : '<p style="color:var(--gray);">No hay promos activas en este momento</p>';
}

// ============================================
// IMPORTACIÓN / EXPORTACIÓN
// ============================================
function generarIdEstable(nombre) {
    return 'p_' + nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 80);
}

function parsearFilaProducto(fila) {
    const nombre = (fila.descripcion || fila.Descripcion || fila.nombre || fila.Nombre || fila.PRODUCTO || '').toString().trim();
    if (!nombre) return null;
    const costo = parseFloat(fila.costo || fila.Costo || fila.PRECIO || 0);
    if (isNaN(costo) || costo <= 0) return null;
    const seccion      = (fila['Des. Seccion*']     || fila.seccion    || 'OTROS').toString().trim().toUpperCase();
    const familia      = (fila['Des.Grp. Familia*'] || fila.familia    || '').toString().trim().toUpperCase();
    const subfamilia   = (fila.subfamilia || '').toString().trim().toUpperCase();
    const stock        = Math.max(0, parseInt(fila.Stock || fila.stock || 0) || 0);
    const venta_diaria = Math.max(0, parseFloat(fila.venta_diaria || fila.ventas || 0) || 0);
    const ean          = String(fila['*Codigo E.A.N. *'] || fila.Ean || fila.ean || fila.EAN || fila.ean_codigo || '').trim();
    return {
        id: generarIdEstable(nombre), ean, nombre, seccion, familia, subfamilia,
        costo, precio: parseFloat((costo * (1 + config.margenGeneral / 100)).toFixed(2)),
        stock, venta_diaria,
        imagen: fila.imagen || fila.Imagen || '',
        emoji:  fila.emoji  || fila.Emoji  || '📦'
    };
}

function validarArchivoImportacion(file) {
    const ext     = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const allowed = ['.xlsx', '.xls', '.csv'];
    const msgDiv  = document.getElementById('fileValidationMsg');
    if (!allowed.includes(ext)) {
        msgDiv.className = 'error';
        msgDiv.innerHTML = '❌ Formato no válido. Usá: .xlsx, .xls o .csv';
        msgDiv.style.display = 'block';
        return false;
    }
    if (file.size > 10 * 1024 * 1024) {
        msgDiv.className = 'error';
        msgDiv.innerHTML = '❌ Archivo demasiado grande. Máximo 10 MB.';
        msgDiv.style.display = 'block';
        return false;
    }
    msgDiv.className = 'success';
    msgDiv.innerHTML = `✅ ${escapeHTML(file.name)} (${(file.size / 1024).toFixed(1)} KB) listo para importar`;
    msgDiv.style.display = 'block';
    return true;
}

async function importarExcel(e) {
    const arch = e.target.files[0];
    if (!arch) return;
    if (!validarArchivoImportacion(arch)) return;
    try { await cargarLibreriasAdmin(); }
    catch (err) { toast('❌ No se pudo cargar la librería de importación', 'error'); return; }

    const prev     = document.getElementById('previewContainer');
    const prevCont = document.getElementById('previewContent');
    prev.style.display = 'block';
    prevCont.innerHTML = '<p style="color:var(--gray);">⏳ Procesando archivo...</p>';

    const lector = new FileReader();
    lector.onload = function (ev) {
        try {
            const datos = new Uint8Array(ev.target.result);
            const libro = XLSX.read(datos, { type: 'array' });
            const hoja  = libro.Sheets[libro.SheetNames[0]];
            const json  = XLSX.utils.sheet_to_json(hoja);
            if (!json.length) throw new Error('El archivo está vacío');
            const cols      = Object.keys(json[0]).map(k => k.toLowerCase());
            const faltantes = ['descripcion', 'costo'].filter(c => !cols.some(k => k.includes(c)));
            if (faltantes.length) throw new Error(`Columnas faltantes: ${faltantes.join(', ')}`);
            const nuevos = []; let errores = 0;
            json.forEach(fila => {
                try {
                    const prod = parsearFilaProducto(fila);
                    if (prod) nuevos.push(prod); else errores++;
                } catch { errores++; }
            });
            if (!nuevos.length) throw new Error('No se encontraron productos válidos');
            productos = [...productos, ...nuevos];
            localStorage.setItem('ultimaActualizacion', new Date().toISOString());
            guardar(); actualizarFiltros(); renderProductos(); renderProductosAdmin();
            prevCont.innerHTML = `✅ <strong>${nuevos.length}</strong> productos importados${errores ? ` · ⚠️ ${errores} filas con errores ignoradas` : ''}`;
            toast(`✅ ${nuevos.length} productos importados`, 'success');
        } catch (error) {
            prevCont.innerHTML = `<span style="color:var(--primary);">❌ ${escapeHTML(error.message)}</span>`;
            toast('❌ Error: ' + error.message, 'error');
        }
    };
    lector.readAsArrayBuffer(arch);
}

async function cargarDesdeGoogleSheets(silencioso = false) {
    try { await cargarPapaParse(); }
    catch { if (!silencioso) toast('❌ No se pudo cargar PapaParse', 'error'); return; }
    try {
        if (!silencioso) toast('⏳ Cargando desde Google Sheets...', 'success');
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const result  = Papa.parse(csvText, {
            header: true, skipEmptyLines: true,
            transformHeader: h => h.trim().replace(/^"|"$/g, ''),
            transform: v => v.trim().replace(/^"|"$/g, '')
        });
        if (result.errors.length) console.warn('Errores CSV:', result.errors);
        const nuevos = [];
        for (const fila of result.data) {
            if (!fila || !Object.keys(fila).length) continue;
            const prod = parsearFilaProducto(fila);
            if (prod) nuevos.push(prod);
        }
        if (!nuevos.length) throw new Error('No se encontraron productos en el sheet');
        productos = nuevos;
        const idsValidos = new Set(nuevos.map(p => p.id));
        const ofertasAntes = ofertas.length;
        ofertas = ofertas.filter(o => idsValidos.has(o.productoId));
        const eliminadas = ofertasAntes - ofertas.length;
        if (eliminadas > 0) console.warn(`🧹 ${eliminadas} oferta(s) huérfana(s) eliminadas`);
        localStorage.setItem('ultimaActualizacion', new Date().toISOString());
        guardar(); actualizarFiltros(); renderProductos(); renderProductosAdmin();
        if (!silencioso) toast(`✅ ${nuevos.length} productos cargados`, 'success');
    } catch (error) {
        if (!silencioso) toast(`❌ Error al cargar: ${error.message}`, 'error');
        console.error('Google Sheets error:', error);
    }
}
