// ============================================
// PRODUCTOS.JS — Render, filtros, sugerencias, favoritos
// ============================================

function activarSeccion(key) {
    seccionActiva = key;
    productosVisibles = PRODUCTOS_POR_PAGINA;
    document.querySelectorAll('.seccion-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.seccion === key);
    });
    filtros.seccion    = '';
    filtros.familia    = '';
    filtros.subfamilia = '';
    filtros.busqueda   = '';
    document.getElementById('searchInput').value = '';
    const searchInputMobile = document.getElementById('searchInputMobile');
    if (searchInputMobile) searchInputMobile.value = '';
    actualizarFiltros();
    renderProductos();
    actualizarContadorFiltros();
    const grid = document.getElementById('productsGrid');
    if (grid) {
        const offset = grid.getBoundingClientRect().top + window.scrollY - 250;
        window.scrollTo({ top: offset, behavior: 'smooth' });
    }
}

function mostrarSugerencias(term) {
    const box = document.getElementById('searchSuggestions');
    if (!box) return;
    if (!term || term.length < 2) { box.innerHTML = ''; box.classList.remove('visible'); return; }

    const resultados = productos
        .filter(p => p.nombre.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 6);

    if (!resultados.length) { box.innerHTML = ''; box.classList.remove('visible'); return; }

    box.innerHTML = resultados.map(p => {
        const precio = calcularPrecio(p, 1);
        const nombre = p.nombre.replace(new RegExp(term, 'gi'), m => `<strong>${escapeHTML(m)}</strong>`);
        return `<div class="sugerencia-item" data-id="${escapeHTMLAttr(p.id)}">
            <span class="sug-emoji">${escapeHTML(p.emoji || '📦')}</span>
            <span class="sug-nombre">${nombre}</span>
            <span class="sug-precio">$${precio.toLocaleString('es-AR')}</span>
        </div>`;
    }).join('');

    box.classList.add('visible');
    box.querySelectorAll('.sugerencia-item').forEach(item => {
        item.addEventListener('click', () => {
            const p = productos.find(x => x.id === item.dataset.id);
            if (!p) return;
            filtros.busqueda = p.nombre;
            document.getElementById('searchInput').value = p.nombre;
            box.innerHTML = ''; box.classList.remove('visible');
            renderProductos();
            document.getElementById('productsGrid')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function esFavorito(id) { return favoritos.includes(id); }

function toggleFavorito(id) {
    if (esFavorito(id)) {
        favoritos = favoritos.filter(f => f !== id);
        toast('💔 Quitado de favoritos', 'success');
    } else {
        favoritos.push(id);
        toast('❤️ Guardado en favoritos', 'success');
    }
    guardar();
    renderProductos();
}

function renderOfertasDestacadas() {
    const seccion = document.getElementById('ofertasSection');
    const grid    = document.getElementById('ofertasDestacadasGrid');
    if (!seccion || !grid) return;

    const activas = getOfertasActivasHoy();
    const enFolletoDestacados = productos
        .filter(p => p.ean && getItemFolleto(p.ean))
        .slice(0, 30)
        .map(p => {
            const item = getItemFolleto(p.ean);
            return { productoId: p.id, precioOferta: item.precio_folleto, esFolleto: true };
        });
    const todasDestacadas = [...activas, ...enFolletoDestacados.filter(f => !activas.some(a => a.productoId === f.productoId))];

    if (!todasDestacadas.length) { seccion.style.display = 'none'; return; }

    seccion.style.display = 'block';
    grid.innerHTML = todasDestacadas.map(o => {
        const p = productos.find(x => x.id === o.productoId);
        if (!p) return '';
        const precioOriginal = getPrecioOriginal(p);
        const ahorro = Math.round(((precioOriginal - o.precioOferta) / precioOriginal) * 100);
        const imgHTML = validarURL(p.imagen)
            ? `<img src="${escapeHTMLAttr(p.imagen)}" alt="${escapeHTMLAttr(p.nombre)}" loading="lazy" decoding="async"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="image-placeholder" style="display:none;">${escapeHTML(p.emoji) || '📦'}</div>`
            : `<div class="image-placeholder">${escapeHTML(p.emoji) || '📦'}</div>`;

        return `
            <div class="oferta-destacada-card ${o.esFolleto ? 'en-folleto' : ''}" onclick="agregarAlCarrito('${escapeHTMLAttr(p.id)}')">
                <div class="oferta-destacada-badge">${o.esFolleto ? '🗞️' : '🔥'} ${ahorro > 0 ? ahorro + '% OFF' : 'FOLLETO'}</div>
                <div class="oferta-destacada-image">${imgHTML}</div>
                <div class="oferta-destacada-info">
                    <div class="oferta-destacada-nombre">${escapeHTML(p.nombre)}</div>
                    <div class="oferta-destacada-precios">
                        <span class="oferta-destacada-precio-original">$${precioOriginal.toLocaleString('es-AR')}</span>
                        <span class="oferta-destacada-precio-oferta">$${o.precioOferta.toLocaleString('es-AR')}</span>
                    </div>
                    <div class="oferta-destacada-ahorro">💰 Ahorrás $${(precioOriginal - o.precioOferta).toLocaleString('es-AR')}</div>
                    <button class="oferta-destacada-btn">🛒 Agregar</button>
                </div>
            </div>`;
    }).join('');
}

function renderProductos() {
    const grid = document.getElementById('productsGrid');
    grid.classList.remove('skeleton-loading');
    renderMasPedidos();
    renderFamiliaChips();
    const todosFiltrados = filtrarProductos();
    const prods = todosFiltrados.slice(0, productosVisibles);
    actualizarBreadcrumb();

    let titulo = '🌟 Nuestros Productos';
    if (seccionActiva === 'ofertas')  titulo = '🔥 Ofertas Activas';
    else if (filtros.subfamilia)      titulo = filtros.subfamilia;
    else if (filtros.familia)         titulo = filtros.familia;
    else if (filtros.seccion)         titulo = filtros.seccion;
    document.getElementById('sectionTitle').textContent = titulo;

    if (prods.length === 0) {
        grid.innerHTML = `
            <div class="no-results">
                <h3>😕 No hay productos</h3>
                <p>Probá con otro filtro o búsqueda</p>
                ${filtros.busqueda ? `<p>Intentá con: <strong>${escapeHTML(filtros.busqueda.substring(0,1).toUpperCase())}</strong> o una palabra más corta</p>` : ''}
            </div>`;
        document.getElementById('relatedProducts').style.display = 'none';
        renderBotonCargarMas(0);
        return;
    }

    const ofertasHoyCache    = getOfertasActivasHoy();
    const ofertasHoyForRender = getOfertasActivasHoy();
    const primerManual = seccionActiva === 'ofertas'
        ? prods.findIndex(p => !(p.ean && getItemFolleto(p.ean)) && ofertasHoyForRender.some(o => o.productoId === p.id))
        : -1;

    grid.innerHTML = prods.map((p, idx) => {
        const itemFolleto    = estaEnFolleto(p);
        const enFolleto      = !!itemFolleto;
        const p1             = calcularPrecio(p, 1, ofertasHoyCache);
        const p3             = calcularPrecio(p, 3, ofertasHoyCache);
        const enOf           = !enFolleto && ofertasHoyCache.some(o => o.productoId === p.id);
        const precioOriginal = getPrecioOriginal(p);
        const ahorro         = (enOf || enFolleto) ? Math.round(((precioOriginal - p1) / precioOriginal) * 100) : 0;

        let stockBadge = '', stockClass = '', stockText = '';
        if (p.stock <= 0) {
            stockBadge = '<span class="stock-badge sin-stock">✕ Sin stock</span>';
            stockClass = 'danger'; stockText = '❌ Agotado';
        } else if (p.stock <= config.stockCritico) {
            stockBadge = '<span class="stock-badge sin-stock">🔴 CRÍTICO</span>';
            stockClass = 'danger';
            stockText  = p.stock === 1 ? '🔴 Última unidad' : `🔴 Últimas ${p.stock} unidades`;
        } else if (p.stock <= config.stockBajo) {
            stockBadge = '<span class="stock-badge poco-stock">🟡 BAJO</span>';
            stockClass = 'warning'; stockText = `🟡 Quedan ${p.stock} unidades`;
        } else {
            stockBadge = '<span class="stock-badge disponible">✅ Disponible</span>';
            stockText  = '✅ Disponible';
        }

        const imgHTML = validarURL(p.imagen)
            ? `<img src="${escapeHTMLAttr(p.imagen)}" alt="${escapeHTMLAttr(p.nombre)}" loading="lazy" decoding="async"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="image-placeholder" style="display:none;">${escapeHTML(p.emoji) || '📦'}</div>`
            : `<div class="image-placeholder">${escapeHTML(p.emoji) || '📦'}</div>`;

        let precioHTML;
        if (enFolleto) {
            precioHTML = `<div class="product-price folleto-price">$${p1.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
               <span class="product-price-original">$${precioOriginal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
               ${itemFolleto.mecanica ? `<div class="folleto-mecanica">${escapeHTML(itemFolleto.mecanica)}</div>` : ''}`;
        } else if (enOf) {
            precioHTML = `<div class="product-price oferta-price">$${p1.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
               <span class="product-price-original">$${precioOriginal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>`;
        } else {
            precioHTML = `<div class="product-price">$${p1.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>`;
        }

        const p3HTML = p3 < p1
            ? `<div class="precio-por-cantidad">🎁 3+ unidades: $${p3.toLocaleString('es-AR', {minimumFractionDigits: 2})} c/u</div>`
            : '';

        const nombreCorto = escapeHTML(p.nombre.length > 50 ? p.nombre.substring(0, 50) + '…' : p.nombre);
        const sepHTML = (seccionActiva === 'ofertas' && idx === primerManual && primerManual > 0)
            ? `<div class="ofertas-separador"><span>⭐ Ofertas especiales</span></div>`
            : '';

        return sepHTML + `
            <div class="product-card ${enFolleto ? 'en-folleto' : enOf ? 'en-oferta' : ''}">
                ${enFolleto ? `<div class="folleto-badge">🗞️ FOLLETO ${ahorro > 0 ? ahorro + '% OFF' : ''}</div>` : enOf ? `<div class="oferta-badge">🔥 ${ahorro}% OFF</div>` : ''}
                <div class="product-image-container">
                    ${imgHTML}
                    ${stockBadge}
                </div>
                <div class="product-info">
                    <h3 class="product-name" title="${escapeHTMLAttr(p.nombre)}">${nombreCorto}</h3>
                    <div class="price-container">
                        ${precioHTML}
                        ${p3HTML}
                    </div>
                    <div class="product-stock ${stockClass}">${stockText}</div>
                    <button class="add-to-cart-btn" data-id="${escapeHTMLAttr(p.id)}" ${p.stock <= 0 ? 'disabled' : ''}>
                        ${p.stock > 0 ? '🛒 Sumar al pedido' : '✕ Sin stock'}
                    </button>
                    <button class="fav-btn ${esFavorito(p.id) ? 'activo' : ''}" data-fav="${escapeHTMLAttr(p.id)}" aria-label="Favorito">
                        ${esFavorito(p.id) ? '❤️' : '🤍'}
                    </button>
                </div>
            </div>`;
    }).join('');

    document.getElementById('relatedProducts').style.display = 'none';
    renderBotonCargarMas(todosFiltrados.length);
}

function renderBotonCargarMas(totalFiltrados) {
    let cont = document.getElementById('cargarMasCont');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'cargarMasCont';
        cont.className = 'cargar-mas-cont';
        document.getElementById('productsGrid').insertAdjacentElement('afterend', cont);
    }

    if (productosVisibles >= totalFiltrados) {
        cont.innerHTML = '';
        return;
    }

    const restantes = totalFiltrados - productosVisibles;
    cont.innerHTML = `
        <button class="btn-cargar-mas" id="btnCargarMas">
            ⬇️ Cargar más productos (quedan ${restantes})
        </button>`;
    document.getElementById('btnCargarMas').addEventListener('click', () => {
        productosVisibles += PRODUCTOS_POR_PAGINA;
        renderProductos();
    });
}

function filtrarProductos() {
    let prods = productos.filter(p => p.stock >= (config.stockMinimo || 0));

    const sm = SECCIONES_MENU[seccionActiva];
    if (sm && sm.esOfertas) {
        const ofertasHoy = getOfertasActivasHoy();
        prods = prods.filter(p =>
            (p.ean && getItemFolleto(p.ean)) ||
            ofertasHoy.some(o => o.productoId === p.id)
        );
        prods.sort((a, b) => {
            const aFolleto = !!(a.ean && getItemFolleto(a.ean));
            const bFolleto = !!(b.ean && getItemFolleto(b.ean));
            if (aFolleto && !bFolleto) return -1;
            if (!aFolleto && bFolleto) return 1;
            return (b.venta_diaria || 0) - (a.venta_diaria || 0);
        });
    } else if (sm && sm.seccion) {
        prods = prods.filter(p => p.seccion === sm.seccion);
        if (sm.familias) prods = prods.filter(p => sm.familias.includes(p.familia));
    }

    prods.sort((a, b) => (b.venta_diaria || 0) - (a.venta_diaria || 0));
    prods = prods.slice(0, config.topDinamico || 100);

    prods.sort((a, b) => {
        const sA = a.seccion || '', sB = b.seccion || '';
        if (sA < sB) return -1; if (sA > sB) return 1;
        const fA = a.familia || '', fB = b.familia || '';
        if (fA < fB) return -1; if (fA > fB) return 1;
        return a.nombre.localeCompare(b.nombre, 'es');
    });

    if (filtros.seccion)    prods = prods.filter(p => p.seccion    === filtros.seccion);
    if (filtros.familia)    prods = prods.filter(p => p.familia    === filtros.familia);
    if (filtros.subfamilia) prods = prods.filter(p => p.subfamilia === filtros.subfamilia);
    if (filtros.busqueda.trim()) {
        const term = filtros.busqueda.toLowerCase();
        prods = prods.filter(p => p.nombre.toLowerCase().includes(term));
    }
    if (ordenActual === 'favoritos') prods = prods.filter(p => favoritos.includes(p.id));
    if (ordenActual === 'precio_asc')  prods.sort((a, b) => calcularPrecio(a, 1) - calcularPrecio(b, 1));
    else if (ordenActual === 'precio_desc') prods.sort((a, b) => calcularPrecio(b, 1) - calcularPrecio(a, 1));
    else if (ordenActual === 'nombre_asc')  prods.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return prods;
}

function actualizarFiltros() { /* manejado por menú de secciones */ }

function resetFiltros() {
    productosVisibles = PRODUCTOS_POR_PAGINA;
    filtros = { seccion: '', familia: '', subfamilia: '', busqueda: filtros.busqueda };
    document.getElementById('searchInput').value = filtros.busqueda;
    actualizarFiltros(); renderProductos(); actualizarContadorFiltros();
    toast('🔄 Filtros limpiados', 'success');
}

function actualizarContadorFiltros() { /* manejado por menú de secciones */ }

function actualizarBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = '<a href="#" data-action="home">🏠 Inicio</a>';
    if (filtros.seccion)    html += ` <span>›</span> <a href="#" data-action="seccion">${escapeHTML(filtros.seccion)}</a>`;
    if (filtros.familia)    html += ` <span>›</span> <a href="#" data-action="familia">${escapeHTML(filtros.familia)}</a>`;
    if (filtros.subfamilia) html += ` <span>›</span> <span>${escapeHTML(filtros.subfamilia)}</span>`;
    bc.innerHTML = html;
    bc.querySelectorAll('[data-action]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const action = e.currentTarget.dataset.action;
            if (action === 'home')     { filtros.seccion = filtros.familia = filtros.subfamilia = ''; }
            else if (action === 'seccion') { filtros.familia = filtros.subfamilia = ''; }
            else if (action === 'familia') { filtros.subfamilia = ''; }
            actualizarFiltros(); renderProductos(); actualizarContadorFiltros();
        });
    });
}

function scrollToProducts() {
    document.getElementById('productsGrid').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// LO QUE MÁS PEDÍS — fila de accesos rápidos a los más vendidos
// (solo se muestra en "Todos", sin búsqueda activa)
// ============================================
function renderMasPedidos() {
    const cont = document.getElementById('masPedidosCont');
    if (!cont) return;

    if (seccionActiva !== 'todos' || filtros.busqueda.trim()) {
        cont.style.display = 'none';
        cont.innerHTML = '';
        return;
    }

    const top = productos
        .filter(p => p.stock > (config.stockCritico || 0))
        .sort((a, b) => (b.venta_diaria || 0) - (a.venta_diaria || 0))
        .slice(0, 10);

    if (!top.length) {
        cont.style.display = 'none';
        cont.innerHTML = '';
        return;
    }

    cont.style.display = 'block';
    cont.innerHTML = `
        <div class="mas-pedidos-titulo">⭐ Lo que más pedís</div>
        <div class="mas-pedidos-scroll">
            ${top.map(p => {
                const precio = calcularPrecio(p, 1);
                const imgHTML = validarURL(p.imagen)
                    ? `<img src="${escapeHTMLAttr(p.imagen)}" alt="${escapeHTMLAttr(p.nombre)}" loading="lazy"
                           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <div class="mas-pedidos-emoji" style="display:none;">${escapeHTML(p.emoji) || '📦'}</div>`
                    : `<div class="mas-pedidos-emoji">${escapeHTML(p.emoji) || '📦'}</div>`;
                const nombreCorto = escapeHTML(p.nombre.length > 28 ? p.nombre.substring(0, 28) + '…' : p.nombre);
                return `
                <div class="mas-pedidos-card">
                    <div class="mas-pedidos-img">${imgHTML}</div>
                    <div class="mas-pedidos-nombre" title="${escapeHTMLAttr(p.nombre)}">${nombreCorto}</div>
                    <div class="mas-pedidos-precio">$${precio.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                    <button class="mas-pedidos-btn" data-id="${escapeHTMLAttr(p.id)}" ${p.stock <= 0 ? 'disabled' : ''}>+ Sumar</button>
                </div>`;
            }).join('')}
        </div>`;

    cont.querySelectorAll('.mas-pedidos-btn').forEach(btn => {
        btn.addEventListener('click', () => agregarAlCarrito(btn.dataset.id));
    });
}

// ============================================
// CHIPS DE GRUPO/FAMILIA — refinamiento dentro de cada sección
// ============================================
function renderFamiliaChips() {
    const cont = document.getElementById('familiaChips');
    if (!cont) return;

    const sm = SECCIONES_MENU[seccionActiva];
    if (seccionActiva === 'todos' || seccionActiva === 'ofertas' || !sm || !sm.seccion) {
        cont.style.display = 'none';
        cont.innerHTML = '';
        return;
    }

    let base = productos.filter(p => p.stock >= 0 && p.seccion === sm.seccion);
    if (sm.familias) base = base.filter(p => sm.familias.includes(p.familia));

    const conteo = {};
    base.forEach(p => {
        if (!p.familia) return;
        conteo[p.familia] = (conteo[p.familia] || 0) + 1;
    });
    const familias = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);

    if (familias.length < 2) {
        cont.style.display = 'none';
        cont.innerHTML = '';
        return;
    }

    const tituloCorto = f => f.length > 22 ? f.substring(0, 22) + '…' : f;

    cont.style.display = 'flex';
    cont.innerHTML = `
        <button class="familia-chip ${!filtros.familia ? 'active' : ''}" data-familia="">Todos</button>
        ${familias.map(f => `
            <button class="familia-chip ${filtros.familia === f ? 'active' : ''}" data-familia="${escapeHTMLAttr(f)}">
                ${escapeHTML(tituloCorto(f))}
            </button>`).join('')}`;

    cont.querySelectorAll('.familia-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            filtros.familia = btn.dataset.familia;
            productosVisibles = PRODUCTOS_POR_PAGINA;
            renderProductos();
        });
    });
}
