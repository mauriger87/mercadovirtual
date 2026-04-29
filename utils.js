// ============================================
// UTILS.JS — Funciones puras y helpers
// ============================================

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeHTMLAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generarIdUnico() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function validarURL(url) {
    if (!url || url.trim() === '') return false;
    const protocolosPeligrosos = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const urlLower = url.toLowerCase().trim();
    for (const proto of protocolosPeligrosos) {
        if (urlLower.startsWith(proto)) return false;
    }
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch { return false; }
}

function toast(msg, tipo = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 100);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

async function hashPassword(password) {
    const msgBuffer  = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return 'hash_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function confirmarAccion(mensaje, onConfirmar) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
        <div style="background:white;border-radius:12px;padding:24px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <p style="font-size:1rem;color:#1d3557;margin-bottom:20px;line-height:1.5;">${escapeHTML(mensaje)}</p>
            <div style="display:flex;gap:10px;">
                <button id="confirmNo" style="flex:1;padding:12px;border:none;border-radius:8px;background:#8d99ae;color:white;font-weight:600;cursor:pointer;font-size:0.95rem;">Cancelar</button>
                <button id="confirmSi" style="flex:1;padding:12px;border:none;border-radius:8px;background:#e63946;color:white;font-weight:600;cursor:pointer;font-size:0.95rem;">Confirmar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmNo').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmSi').addEventListener('click', () => { overlay.remove(); onConfirmar(); });
}

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}
