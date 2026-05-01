// ============================================
// CARRITO.JS — Carrito, modal de entrega, WhatsApp
// ============================================

function actualizarCarrito() {
    const items   = document.getElementById('cartItems');
    const total   = document.getElementById('cartTotal');
    const savings = document.getElementById('cartSavings');

    const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
    let totalSinDescuento = 0;
    carrito.forEach(item => {
        const p = productos.find(x => x.id === item.id);
        if (p) totalSinDescuento += calcularPrecio(p, item.cantidad) * item.cantidad;
    });

    const descuentos = calcularDescuentos(totalSinDescuento);
    const esMobile   = window.innerWidth <= 768;
    const montoFmt   = `$${Math.round(totalSinDescuento).toLocaleString('es-AR')}`;

    document.getElementById('cartText').textContent = totalItems > 0
        ? (esMobile ? `🛒 ${totalItems}` : `Carrito (${totalItems}) - ${montoFmt}`)
        : (esMobile ? '🛒' : 'Carrito (0)');
    document.getElementById('ctaMobileText').textContent = totalItems > 0
        ? `Comprar (${totalItems}) - ${montoFmt}` : 'Comprar (0) - $0';

    actualizarBannerPrimeraCompra(totalSinDescuento);
    actualizarBarraEnvioGratis(totalSinDescuento);

    if (carrito.length === 0) {
        items.innerHTML = `<div class="empty-cart">🛒 Carrito vacío<br><small>Agregá productos para empezar</small></div>`;
        total.textContent = '$0';
        savings.style.display = 'none';
        return;
    }

    let html = '';
    carrito.forEach(item => {
        const p = productos.find(x => x.id === item.id);
        if (!p) return;
        const pUnit = calcularPrecio(p, item.cantidad);
        const sub   = pUnit * item.cantidad;
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.nombre)}</div>
                    <div class="cart-item-price">
                        $${pUnit.toLocaleString('es-AR')} × ${item.cantidad} = <strong>$${sub.toLocaleString('es-AR')}</strong>
                    </div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" data-id="${escapeHTMLAttr(item.id)}" data-accion="-1">−</button>
                        <span class="qty-display">${item.cantidad}</span>
                        <button class="qty-btn" data-id="${escapeHTMLAttr(item.id)}" data-accion="1">+</button>
                        <button class="remove-btn" data-id="${escapeHTMLAttr(item.id)}" data-accion="remove">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
    items.innerHTML = html;

    const costoEnvio    = envioCliente.calculado ? envioCliente.costo : 0;
    const totalConEnvio = (descuentos.montoDescuento > 0 ? descuentos.totalFinal : totalSinDescuento) + costoEnvio;

    if (descuentos.montoDescuento > 0 || costoEnvio > 0) {
        let savingsHTML = '';
        if (descuentos.montoDescuento > 0) {
            savingsHTML += `<div style="background:#e8f4f8;padding:10px;border-radius:8px;margin-bottom:6px;">
                <strong>💰 DESCUENTOS:</strong><br>
                ${descuentos.mensajes.join('<br>')}
                <br><span style="color:var(--success);">− $${descuentos.montoDescuento.toLocaleString('es-AR')}</span>
            </div>`;
        }
        if (envioCliente.calculado) {
            savingsHTML += `<div style="background:#f0f7f0;padding:10px;border-radius:8px;">
                🚚 <strong>Envío a ${escapeHTML(envioCliente.direccion)}</strong><br>
                <span style="color:#2d6a4f;">+ ${formatearCostoEnvio(costoEnvio)} (${envioCliente.distancia} km)</span>
                <br><small style="color:#888;font-size:0.8rem;">
                    <a href="#" onclick="abrirCobertura();return false;" style="color:var(--primary);">Cambiar dirección</a>
                </small>
            </div>`;
        }
        savings.innerHTML = savingsHTML;
        savings.style.display = 'block';
        total.textContent = `$${Math.round(totalConEnvio).toLocaleString('es-AR')}`;
    } else {
        total.textContent = `$${totalSinDescuento.toLocaleString('es-AR')}`;
        savings.style.display = 'none';
    }

    if (typeof gtag === 'function' && totalSinDescuento > 0) {
        gtag('event', 'view_cart', { currency: 'ARS', value: descuentos.totalFinal || totalSinDescuento });
    }
}

function agregarAlCarrito(id) {
    const p = productos.find(x => x.id === id);
    if (!p || p.stock <= 0) { toast('❌ Sin stock', 'error'); return; }

    const item = carrito.find(x => x.id === id);
    if (item) {
        if (item.cantidad >= p.stock) { toast('⚠ No hay más stock disponible', 'warning'); return; }
        item.cantidad++;
    } else {
        carrito.push({
            id: p.id, nombre: p.nombre, costo: p.costo,
            cantidad: 1, imagen: p.imagen, emoji: p.emoji,
            seccion: p.seccion, familia: p.familia, subfamilia: p.subfamilia
        });
    }

    guardar(); actualizarCarrito();
    toast(`✅ ${p.nombre.length > 30 ? p.nombre.substring(0,30) + '…' : p.nombre} agregado`, 'success');

    if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
            currency: 'ARS', value: calcularPrecio(p, 1),
            items: [{ item_id: p.id, item_name: p.nombre, price: calcularPrecio(p, 1), quantity: 1, item_category: p.seccion || 'General' }]
        });
    }
}

function actualizarCantidad(id, cambio) {
    const item = carrito.find(x => x.id === id);
    const p    = productos.find(x => x.id === id);
    if (!item || !p) return;
    const nueva = item.cantidad + cambio;
    if (nueva <= 0) { eliminarDelCarrito(id); return; }
    if (nueva > p.stock) { toast('⚠ No hay más stock disponible', 'warning'); return; }
    item.cantidad = nueva;
    guardar(); actualizarCarrito();
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(x => x.id !== id);
    guardar(); actualizarCarrito();
    toast('🗑️ Producto eliminado del carrito', 'success');
}

function vaciarCarrito() {
    if (carrito.length === 0) { toast('⚠ El carrito ya está vacío', 'warning'); return; }
    confirmarAccion(`¿Vaciar el carrito? (${carrito.length} producto${carrito.length > 1 ? 's' : ''})`, () => {
        carrito = [];
        guardar(); actualizarCarrito();
        toast('🗑️ Carrito vaciado', 'success');
    });
}

function abrirModalEntrega() {
    if (carrito.length === 0) { toast('⚠ El carrito está vacío', 'warning'); return; }
    document.getElementById('deliveryModal').classList.add('show');
    setTimeout(() => document.getElementById('deliveryName').focus(), 100);
}

function cerrarModalEntrega() {
    document.getElementById('deliveryModal').classList.remove('show');
}

function generarWhatsApp() {
    if (carrito.length === 0) { toast('⚠ El carrito está vacío', 'warning'); return; }

    const nombre    = document.getElementById('deliveryName')?.value.trim() || '';
    const direccion = document.getElementById('deliveryAddress')?.value.trim() || '';
    const horario   = document.getElementById('deliveryTime')?.value || '';
    const notas     = document.getElementById('deliveryNotes')?.value.trim() || '';

    if (!direccion) {
        toast('⚠ Por favor ingresá tu dirección de entrega', 'warning');
        document.getElementById('deliveryAddress').focus();
        return;
    }

    let totalSinDescuento = 0;
    let msg = '🛒 *Pedido - Mercadito Virtual*\n\nHola 👋 te paso mi pedido:\n\n';

    carrito.forEach((item, i) => {
        const p = productos.find(x => x.id === item.id);
        if (!p) return;
        const pUnit = calcularPrecio(p, item.cantidad);
        const sub   = pUnit * item.cantidad;
        totalSinDescuento += sub;
        msg += `${i + 1}. *${item.nombre}*\n`;
        msg += `   Cant: ${item.cantidad} × $${pUnit.toLocaleString('es-AR')} = $${sub.toLocaleString('es-AR')}\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 Subtotal: $${totalSinDescuento.toLocaleString('es-AR')}\n\n`;

    const descuentos = calcularDescuentos(totalSinDescuento);

    if (descuentos.montoDescuento > 0) {
        msg += `🎁 *DESCUENTOS APLICADOS:*\n`;
        msg += descuentos.mensajes.join('\n') + '\n';
        msg += `Ahorrás: $${descuentos.montoDescuento.toLocaleString('es-AR')}\n`;
        msg += `\n✅ *TOTAL FINAL: $${descuentos.totalFinal.toLocaleString('es-AR')}*\n`;
        if (esPrimeraCompra() && totalSinDescuento >= PROMOS.primeraCompra.minimo) marcarComoComprado();
    } else {
        msg += `✅ *TOTAL: $${totalSinDescuento.toLocaleString('es-AR')}*\n`;
        const promoDia = getPromoDelDia();
        if (promoDia?.activo && totalSinDescuento < promoDia.minimo) {
            const falta = promoDia.minimo - totalSinDescuento;
            msg += `\n💡 Sumá $${falta.toLocaleString('es-AR')} más y obtené ${promoDia.porcentaje}% OFF 🎉\n`;
        }
    }

    if (envioCliente.calculado && envioCliente.costo > 0) {
        msg += `🚚 *Envío:* ${formatearCostoEnvio(envioCliente.costo)} (${envioCliente.distancia} km)\n`;
        msg += `💵 *TOTAL CON ENVÍO: $${Math.round((descuentos.totalFinal || totalSinDescuento) + envioCliente.costo).toLocaleString('es-AR')}*\n`;
    }

    msg += `\n━━━━━━━━━━━━━━━━━\n`;
    if (nombre)  msg += `👤 *Nombre:* ${nombre}\n`;
    const dirFinal = envioCliente.calculado && envioCliente.direccion ? envioCliente.direccion : direccion;
    msg += `📍 *Dirección:* ${dirFinal}\n`;
    if (horario) msg += `⏰ *Horario:* ${horario}\n`;
    if (notas)   msg += `📝 *Nota:* ${notas}\n`;

    if (typeof gtag === 'function') {
        gtag('event', 'begin_checkout', {
            currency: 'ARS', value: descuentos.totalFinal || totalSinDescuento,
            items: carrito.map(item => {
                const p = productos.find(x => x.id === item.id);
                return { item_id: item.id, item_name: item.nombre, price: p ? calcularPrecio(p, item.cantidad) : 0, quantity: item.cantidad };
            })
        });
    }

    cerrarModalEntrega();
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

    // Registrar pedido en Google Sheet
    registrarPedido({
        nombre,
        direccion: dirFinal,
        horario,
        notas,
        items: carrito.map(item => {
            const p = productos.find(x => x.id === item.id);
            return {
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: p ? calcularPrecio(p, item.cantidad) : 0
            };
        }),
        total: descuentos.totalFinal || totalSinDescuento,
        envio: envioCliente.calculado ? envioCliente.costo : 0
    });
}

async function registrarPedido(pedido) {
    try {
        const payload = {
            _key: ADMIN_SECRET,
            _accion: 'registrarPedido',
            fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' }),
            nombre: pedido.nombre || 'Sin nombre',
            direccion: pedido.direccion || '',
            horario: pedido.horario || '',
            notas: pedido.notas || '',
            items: pedido.items.map(i => `${i.cantidad}x ${i.nombre} ($${i.precio.toLocaleString('es-AR')})`).join(' | '),
            total: pedido.total,
            envio: pedido.envio,
            totalConEnvio: pedido.total + pedido.envio
        };
        const url = APPS_SCRIPT_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
        await fetch(url, { method: 'GET' });
        console.log('✅ Pedido registrado en Sheet');
    } catch (err) {
        console.warn('⚠ No se pudo registrar el pedido:', err.message);
    }
}
