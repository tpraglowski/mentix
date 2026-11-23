// MENTIX — wspólne narzędzia + rejestr trybów gry.
// Tryby gry (folder modes/) wywołują Q.registerMode({...}). Zobacz modes/_szablon.js.
window.Q = (function () {
  'use strict';
  const modes = [];

  // h('div', {class:'x', onclick: fn}, 'tekst', innyElement) — tworzy element (tekst jest bezpieczny, bez HTML)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el[k] = v;
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const s in v) el.style.setProperty(s.startsWith('--') ? s : s.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), v[s]); }
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) add(el, c);
      else el.append(c instanceof Node ? c : document.createTextNode(mono(String(c))));
    }
  }

  // ikonki zawsze jednokolorowe: znak U+FE0F wymusza kolorowe emoji — zamieniamy na U+FE0E (wersja tekstowa)
  const mono = t => t.replace(/️/g, '︎');

  function registerMode(m) {
    if (!m || !m.id || typeof m.start !== 'function') { console.error('MENTIX: niepoprawny tryb gry', m); return; }
    if (modes.some(x => x.id === m.id)) { console.warn('MENTIX: tryb o id "' + m.id + '" już istnieje'); return; }
    modes.push(Object.assign({ icon: '🎲', unit: 'pkt', desc: '', name: m.id }, m));
  }

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmt = n => Math.round(n).toLocaleString('pl-PL');

  // wspólna baza (cloud.js): obietnica z API albo null, gdy nie ma połączenia (max 10 s)
  let cloudResolve;
  const cloudReady = new Promise(r => { cloudResolve = r; });
  setTimeout(() => cloudResolve(null), 10000);

  return { cloudReady, _cloudResolve: v => cloudResolve(v), modes, registerMode, h, mono, randInt, shuffle, pick, sleep, fmt };
})();
