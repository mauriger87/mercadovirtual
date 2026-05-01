// ============================================
// MAIN.JS — Inicialización y event listeners
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Mercadito Virtual iniciando...');

    // Alturas sticky dinámicas
    const badge = document.getElementById('badgeMendoza');
    if (badge) {
        const updateStickyHeights = () => {
            document.documentElement.style.setProperty('--badge-height', badge.offsetHeight + 'px');
        };
        updateStickyHeights();
        window.addEventListener('resize', debounce(updateStickyHeights, 200));
    }

    // Reset paneles al cargar
    document.getElementById('adminPanel')?.classList.remove('open');
    document.getElementById('cartSidebar')?.classList.remove('open');
    document.getElementById('passwordModal')?.classList.remove('show');
    document.getElementById('deliveryModal')?.classList.remove('show');

    // Actualizar SW si hay uno registrado
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.update()));
    }

    // Carga de datos
    cargarConfigRemota();

    const ultimaSync = localStorage.getItem('ultimaActualizacion');
    const hace6hs    = Date.now() - 6 * 3600 * 1000;
    if (!ultimaSync || new Date(ultimaSync).getTime() < hace6hs || productos.length === 0) {
        cargarDesdeGoogleSheets(true);
    }

    const ultimaFolleto = localStorage.getItem('ultimaActualizacionFolleto');
    const hace12hs      = Date.now() - 12 * 3600 * 1000;
    if (!ultimaFolleto || new Date(ultimaFolleto).getTime() < hace12hs || Object.keys(folletoItems).length === 0) {
        cargarFolleto(true);
    }

    // Render inicial
    actualizarFiltros();
    renderProductos();
    actualizarCarrito();
    actualizarContadorFiltros();

    // ── BÚSQUEDA DESKTOP ──
    document.getElementById('searchInput').addEventListener('input', debounce(e => {
        filtros.busqueda = e.target.value;
        mostrarSugerencias(e.target.value);
        renderProductos();
    }, 200));

    document.addEventListener('click', e => {
        if (!e.target.closest('.search-bar') && !e.target.closest('#searchSuggestions')) {
            const box = document.getElementById('searchSuggestions');
            if (box) { box.innerHTML = ''; box.classList.remove('visible'); }
        }
    });

    // ── BÚSQUEDA MOBILE ──
    const searchToggleBtn  = document.getElementById('searchToggleBtn');
    const searchBarMobile  = document.getElementById('searchBarMobile');
    const searchInputMobile = document.getElementById('searchInputMobile');
    const searchCloseBtn   = document.getElementById('searchCloseBtn');

    searchToggleBtn?.addEventListener('click', () => {
        searchBarMobile.classList.add('open');
        setTimeout(() => searchInputMobile.focus(), 50);
    });
    searchCloseBtn?.addEventListener('click', () => {
        searchBarMobile.classList.remove('open');
        searchInputMobile.value = '';
        filtros.busqueda = '';
        renderProductos();
    });
    searchInputMobile?.addEventListener('input', debounce(e => {
        filtros.busqueda = e.target.value;
        renderProductos();
    }, 300));

    // ── CARRITO ──
    document.getElementById('cartBtn').addEventListener('click', () =>
        document.getElementById('cartSidebar').classList.add('open'));
    document.getElementById('closeCartBtn').addEventListener('click', () =>
        document.getElementById('cartSidebar').classList.remove('open'));
    document.getElementById('checkoutBtn').addEventListener('click', abrirModalEntrega);
    document.getElementById('clearCartBtn').addEventListener('click', vaciarCarrito);

    document.getElementById('cartItems').addEventListener('click', e => {
        const btn = e.target.closest('[data-id]');
        if (!btn) return;
        const id     = btn.dataset.id;
        const accion = btn.dataset.accion;
        if (accion === 'remove') eliminarDelCarrito(id);
        else actualizarCantidad(id, parseInt(accion));
    });

    // ── PRODUCTOS GRID ──
    document.getElementById('productsGrid').addEventListener('click', e => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        if (addBtn && !addBtn.disabled) agregarAlCarrito(addBtn.dataset.id);
        const favBtn = e.target.closest('.fav-btn');
        if (favBtn) toggleFavorito(favBtn.dataset.fav);
    });

    // ── MODAL ENTREGA ──
    document.getElementById('cancelDeliveryBtn')?.addEventListener('click', cerrarModalEntrega);
    document.getElementById('confirmDeliveryBtn')?.addEventListener('click', generarWhatsApp);
    document.getElementById('deliveryModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('deliveryModal')) cerrarModalEntrega();
    });
    ['deliveryName','deliveryAddress','deliveryNotes'].forEach(id => {
        document.getElementById(id)?.addEventListener('keypress', e => {
            if (e.key === 'Enter') generarWhatsApp();
        });
    });

    // ── ADMIN — acceso triple click ──
    document.getElementById('logoBtn').addEventListener('click', e => {
        if (e.detail === 3) {
            document.getElementById('passwordModal').classList.add('show');
            setTimeout(() => document.getElementById('passwordInput').focus(), 100);
        }
    });
    document.getElementById('confirmPasswordBtn').addEventListener('click', verificarPassword);
    document.getElementById('passwordInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') verificarPassword();
    });
    document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
        document.getElementById('passwordModal').classList.remove('show');
        document.getElementById('passwordInput').value = '';
    });
    document.getElementById('closeAdminBtn').addEventListener('click', () =>
        document.getElementById('adminPanel').classList.remove('open'));

    // ── ADMIN — tabs ──
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(`${this.dataset.tab}Tab`).classList.add('active');
        });
    });

    // ── ADMIN — productos ──
    document.getElementById('buscarProductoAdmin').addEventListener('input', renderProductosAdmin);
    document.getElementById('productListAdmin').addEventListener('click', e => {
        const btn = e.target.closest('.btn-delete[data-id]');
        if (btn) eliminarProducto(btn.dataset.id);
    });
    document.getElementById('deleteAllBtn').addEventListener('click', () => {
        if (!productos.length) return toast('⚠ Sin productos', 'warning');
        confirmarAccion(`¿Eliminar los ${productos.length} productos? Esta acción no se puede deshacer.`, () => {
            productos = []; carrito = [];
            guardar(); renderProductos(); renderProductosAdmin(); actualizarCarrito(); actualizarFiltros();
            toast('✅ Todos los productos eliminados', 'success');
        });
    });
    document.getElementById('addProductBtn')?.addEventListener('click', agregarProductoManual);

    // ── ADMIN — importación / exportación ──
    document.getElementById('dropZone').addEventListener('click', () =>
        document.getElementById('excelFile').click());
    document.getElementById('excelFile').addEventListener('change', importarExcel);
    document.getElementById('importBtn').addEventListener('click', async e => {
        e.preventDefault();
        try { await cargarLibreriasAdmin(); } catch { toast('❌ Error cargando librerías', 'error'); return; }
        document.getElementById('excelFile').click();
    });
    document.getElementById('exportBtn').addEventListener('click', async () => {
        if (!productos.length) return toast('⚠ Sin productos para exportar', 'warning');
        try {
            await cargarLibreriasAdmin();
            const datos = productos.map(p => ({
                nombre: p.nombre, seccion: p.seccion, familia: p.familia, subfamilia: p.subfamilia,
                costo: p.costo, precio: p.precio, stock: p.stock, imagen: p.imagen || '', emoji: p.emoji || ''
            }));
            const ws = XLSX.utils.json_to_sheet(datos);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Productos');
            XLSX.writeFile(wb, `productos_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast('✅ Exportado correctamente', 'success');
        } catch (err) { toast('❌ Error al exportar: ' + err.message, 'error'); }
    });

    // ── ADMIN — sliders stock ──
    const syncSlider = (rangeId, numId, numMin, callback) => {
        const range = document.getElementById(rangeId);
        const num   = document.getElementById(numId);
        if (!range || !num) return;
        range.addEventListener('input', () => {
            num.value = range.value;
            if (numMin) document.getElementById(numMin).value = parseInt(range.value) + 1;
            if (callback) callback();
        });
        num.addEventListener('input', () => {
            range.value = num.value;
            if (numMin) document.getElementById(numMin).value = parseInt(num.value) + 1;
            if (callback) callback();
        });
    };
    syncSlider('stockMinimoRange',  'stockMinimoExacto',  null,             actualizarPreviewStock);
    syncSlider('stockCriticoRange', 'stockCriticoExacto', null,             actualizarPreviewStock);
    syncSlider('stockBajoRange',    'stockBajoExacto',    'stockNormalMin', actualizarPreviewStock);

    // ── ADMIN — top dinámico ──
    const topRange  = document.getElementById('topRange');
    const topExacto = document.getElementById('topExacto');
    if (topRange && topExacto) {
        topRange.value  = config.topDinamico;
        topExacto.value = config.topDinamico;
        topRange.addEventListener('input', () => {
            topExacto.value = topRange.value;
            document.getElementById('topValorDisplay').textContent = topRange.value;
            actualizarPreviewTop();
        });
        topExacto.addEventListener('input', () => {
            topRange.value = topExacto.value;
            document.getElementById('topValorDisplay').textContent = topExacto.value;
            actualizarPreviewTop();
        });
    }

    // ── ADMIN — márgenes ──
    const mgEl = document.getElementById('margenGeneral');
    const dcEl = document.getElementById('descuentoCantidad');
    if (mgEl) mgEl.value = config.margenGeneral;
    if (dcEl) dcEl.value = config.descuentoCantidad;

    iniciarBusquedaOferta();

    // ── MENÚ DE SECCIONES ──
    document.querySelectorAll('.seccion-btn').forEach(btn => {
        btn.addEventListener('click', () => activarSeccion(btn.dataset.seccion));
    });

    // ── ORDENAR ──
    document.getElementById('ordenSelect')?.addEventListener('change', e => {
        ordenActual = e.target.value;
        renderProductos();
    });

    // ── COBERTURA ──
    document.getElementById('closeCoberturaBtn')?.addEventListener('click', cerrarCobertura);
    document.getElementById('coberturaModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('coberturaModal')) cerrarCobertura();
    });
    document.getElementById('coberturaDir')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') verificarDireccion();
    });

    // ── FOOTER ──
    document.getElementById('lastUpdate').textContent = new Date().toLocaleDateString('es-AR');

    console.log('✅ Mercadito Virtual listo');
});
