// ============================================
// CONFIG.JS — Constantes y URLs globales
// ============================================

const ADMIN_PASSWORD_HASH = 'hash_5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5';
const ADMIN_SECRET        = 'mv_secret_k9x2p7qn4r8wj3m6t1v5y0';

const NUMERO_WHATSAPP   = '5492616312850';
const GOOGLE_SHEET_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWF-EO1BcszJ6KWQY4pFEReCBa-zF7A66H9cq3YZUdFaw2KoHBu5gqJkEIyqYx6d3EYiQmAUg4ryK2/pub?gid=1679034661&single=true&output=csv';
const CONFIG_SHEET_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWF-EO1BcszJ6KWQY4pFEReCBa-zF7A66H9cq3YZUdFaw2KoHBu5gqJkEIyqYx6d3EYiQmAUg4ryK2/pub?gid=1881920247&single=true&output=csv';
const APPS_SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbxY6zIDghzJYxKXbHy8OKOtT8KrThyqnFRfXSlRmCIUmbq4I6pRv8QjBxw3r2zBTqNhYA/exec';
const FOLLETO_GID       = '1980926164';
const FOLLETO_SHEET_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTWF-EO1BcszJ6KWQY4pFEReCBa-zF7A66H9cq3YZUdFaw2KoHBu5gqJkEIyqYx6d3EYiQmAUg4ryK2/pub?gid=${FOLLETO_GID}&single=true&output=csv`;

const SECCIONES_MENU = {
    todos:      { seccion: null,      familias: null },
    bebidas:    { seccion: 'BEBIDAS', familias: null },
    almacen:    { seccion: 'SECO',    familias: null },
    perfumeria: { seccion: 'D.P.H.',  familias: ['COSMETICA','FRAGANCIAS','TOCADOR','CUIDADO DEL CABE','HIGIENE','FARMACIA'] },
    limpieza:   { seccion: 'D.P.H.',  familias: ['MANTENIMIENTO DE'] },
    ofertas:    { seccion: null,       familias: null, esOfertas: true },
};
