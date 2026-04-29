// ============================================
// PRODUCTOS.JS — Render, filtros, sugerencias, favoritos
// ============================================

function activarSeccion(key) {
    seccionActiva = key;
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
    const prods = filtrarProductos();
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
        return (b.venta_diaria || 0) - (a.venta_diaria || 0);
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
