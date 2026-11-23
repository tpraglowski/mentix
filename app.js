// MENTIX — ekrany, host / gracz (PeerJS), uruchamianie trybów gry.
(function () {
  'use strict';
  const { h, shuffle, fmt } = Q;
  const app = document.getElementById('app');
  const PREFIX = 'quizolandia-v1-';
  const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐵', '🐧', '🐢', '🦁', '🐨', '🐰', '🐲', '🦉', '🐝', '🐳', '🦖', '🐷', '🐮', '🦋'];
  const DURATIONS = [2, 3, 5, 7, 10];

  // ---------- ekrany ----------
  let screenCleanups = [];
  function screen(...nodes) {
    document.body.classList.remove('dash');
    screenCleanups.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    screenCleanups = [];
    app.replaceChildren(...nodes.filter(n => n != null && n !== false));
    window.scrollTo(0, 0);
  }
  const onLeave = fn => screenCleanups.push(fn);

  // sesja sieciowa (host albo gracz) — przeżywa zmianę ekranów
  let session = null;
  function endSession() {
    if (session) { const s = session; session = null; try { s.dispose(); } catch (e) { console.error(e); } }
  }

  document.getElementById('logo').onclick = e => { e.preventDefault(); go('odkrywaj'); };

  const btn = (label, onclick, cls) => h('button', { class: 'btn ' + (cls || ''), onclick }, label);
  const back = fn => h('button', { class: 'back', onclick: fn }, '← Wróć');
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); el.focus(); }
  const mmss = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pytan = n => n + ' ' + (n === 1 ? 'pytanie' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'pytania' : 'pytań');
  const joinUrl = pin => location.origin + location.pathname.replace(/index\.html$/, '') + '?pin=' + pin;
  function qrSvg(text) {
    if (typeof qrcode === 'undefined') return null;
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const box = document.createElement('div');
    box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    return box.firstElementChild;
  }
  function showBigQr(pin) {
    const svg = qrSvg(joinUrl(pin));
    if (!svg) return;
    const ov = h('div', { class: 'qr-big', onclick: () => ov.remove() },
      h('div', { class: 'qr-big-card' },
        h('div', { class: 'qr-big-code' }, svg),
        h('div', { class: 'big-pin' }, pin.slice(0, 3) + ' ' + pin.slice(3)),
        h('p', { class: 'muted' }, 'Zeskanuj aparatem w telefonie · kliknij, żeby zamknąć')));
    document.body.append(ov);
    onLeave(() => ov.remove());
  }
  const findMode = id => Q.modes.find(m => m.id === id);
  let me = loadMe();
  function loadMe() {
    try { const v = JSON.parse(localStorage.getItem('qzl_me') || 'null'); if (v && v.name) return v; } catch (e) {}
    return { name: '', avatar: Q.pick(AVATARS) };
  }
  function saveMe() { try { localStorage.setItem('qzl_me', JSON.stringify(me)); } catch (e) {} }

  // ---------- panel z menu (Graj / Odkrywaj / Kreator / Moje zestawy / Ulubione) ----------
  const SECTIONS = [
    { id: 'graj', label: 'Graj', icon: '🎮', fn: () => play() },
    { id: 'odkrywaj', label: 'Odkrywaj', icon: '🧭', fn: () => discover() },
    { id: 'kreator', label: 'Kreator zestawów', icon: '✏️', fn: () => editQuiz(null) },
    { id: 'moje', label: 'Moje zestawy', icon: '🗂️', fn: () => mySets() },
    { id: 'ulubione', label: 'Ulubione', icon: '⭐', fn: () => favorites() }
  ];
  let current = 'odkrywaj';
  const side = document.getElementById('side');
  side.replaceChildren(...SECTIONS.map(sec => h('a', {
    href: '#' + sec.id, class: 'side-link', 'data-id': sec.id,
    onclick: e => { e.preventDefault(); go(sec.id); }
  }, h('span', { class: 'side-icon' }, sec.icon), h('span', { class: 'side-label' }, sec.label))));
  function go(id) { endSession(); (SECTIONS.find(x => x.id === id) || SECTIONS[0]).fn(); }
  function home() { go(current); }
  function dash(id, ...nodes) {
    screen(...nodes);
    current = id;
    document.body.classList.add('dash');
    side.querySelectorAll('.side-link').forEach(a => a.classList.toggle('on', a.dataset.id === id));
    if (location.hash !== '#' + id) history.replaceState(null, '', location.pathname + '#' + id);
  }

  // ---------- Graj: dołączanie do gry ----------
  function play() {
    const pin = h('input', { class: 'pin-input', inputmode: 'numeric', maxlength: '7', placeholder: 'PIN gry', autocomplete: 'off' });
    const join = () => { const v = pin.value.replace(/\D/g, ''); if (v.length !== 6) return shake(pin); joinScreen(v); };
    pin.onkeydown = e => { if (e.key === 'Enter') join(); };
    dash('graj',
      h('section', { class: 'hero' },
        h('div', { class: 'big-emoji' }, '🎮'),
        h('h1', {}, 'Dołącz do ', h('span', { class: 'accent' }, 'gry'), '!'),
        h('p', { class: 'lead' }, 'Wpisz PIN, który pokazuje host — albo zeskanuj jego kod QR telefonem.'),
        h('div', { class: 'join-card' }, pin, btn('Dołącz', join, 'big'))),
      h('div', { class: 'play-hint' },
        h('span', { class: 'side-icon' }, '🧭'),
        h('span', {}, 'Chcesz sam poprowadzić grę? Wybierz zestaw w ', h('a', { href: '#odkrywaj', onclick: e => { e.preventDefault(); go('odkrywaj'); } }, 'Odkrywaj'), ' i kliknij „Hostuj”.')));
    setTimeout(() => pin.focus(), 50);
  }

  // ulubione (w tej przeglądarce)
  const FKEY = 'qzl_favs_v1';
  function favs() { try { const v = JSON.parse(localStorage.getItem(FKEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  const isFav = id => favs().includes(id);
  function toggleFav(id) {
    const f = favs(); const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch (e) {}
    return i < 0;
  }
  function favButton(q, cls, onChange) {
    const b = h('button', { class: cls, title: 'Dodaj do ulubionych / usuń' });
    const paint = () => {
      const on = isFav(q.id);
      b.classList.toggle('on', on);
      b.replaceChildren(h('span', { class: 'fav-icon' }, '⭐'));
      if (cls.includes('btn')) b.append(on ? ' W ulubionych' : ' Do ulubionych');
    };
    b.onclick = e => { e.stopPropagation(); toggleFav(q.id); cacheFav(q); paint(); if (onChange) onChange(); };
    paint();
    return b;
  }

  // ---------- wspólna baza: publiczne zestawy ----------
  const newSetId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const isOwn = q => Q.quizzes.loadOwn().some(x => x.id === q.id);
  let remoteSets = [];            // ostatnio pobrane publiczne zestawy z bazy
  const FCACHE = 'qzl_fav_cache_v1';
  function favCache() { try { const v = JSON.parse(localStorage.getItem(FCACHE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function cacheFav(q) {
    const c = favCache();
    if (isFav(q.id) && q.remote) c[q.id] = q; else delete c[q.id];
    try { localStorage.setItem(FCACHE, JSON.stringify(c)); } catch (e) {}
  }
  function notify(text, kind) {
    let box = document.getElementById('notes');
    if (!box) { box = h('div', { id: 'notes', class: 'notes' }); document.body.append(box); }
    const n = h('div', { class: 'note ' + (kind || '') }, text);
    box.append(n);
    setTimeout(() => n.remove(), 3500);
  }
  // wysyła / usuwa zestaw w bazie zależnie od widoczności; zapamiętuje, czy się udało
  async function syncSet(rec, quiet) {
    const cloud = await Q.cloudReady;
    const mark = ok => {
      const own = Q.quizzes.loadOwn(); const x = own.find(o => o.id === rec.id);
      if (x) { x.cloud = ok; Q.quizzes.saveOwn(own); }
    };
    if (!cloud) { if (rec.visibility === 'public') { mark(false); if (!quiet) notify('⚠️ Brak połączenia z bazą — zestaw zapisany tylko na tym urządzeniu.', 'bad'); } return false; }
    try {
      if (rec.visibility === 'public') { await cloud.publish(rec, me.name); mark(true); if (!quiet) notify('🌍 Zestaw opublikowany — widzą go wszyscy w Odkrywaj.', 'good'); }
      else { await cloud.unpublish(rec.id); mark(false); }
      return true;
    } catch (e) {
      console.warn('MENTIX sync:', e);
      if (rec.visibility === 'public') mark(false);
      if (!quiet) notify('⚠️ Nie udało się wysłać zestawu do bazy (' + (e.code || e.message) + '). Zapisany na tym urządzeniu.', 'bad');
      return false;
    }
  }
  // po starcie: dosyłamy publiczne zestawy, które jeszcze nie trafiły do bazy
  Q.cloudReady.then(cloud => {
    if (!cloud) return;
    Q.quizzes.loadOwn().filter(x => x.visibility !== 'private' && !x.cloud).forEach(x => syncSet(x, true));
  });

  function setCard(q, onFavChange) {
    return h('div', { class: 'set-card' },
      h('button', { class: 'set-main', onclick: () => setDetail(q) },
        h('span', { class: 'set-emoji' }, q.emoji || '📝'),
        h('strong', { class: 'set-title' }, q.title),
        q.desc ? h('span', { class: 'set-desc' }, q.desc) : null,
        h('span', { class: 'muted small' }, pytan(q.questions.length) + (q.builtin ? ' · wbudowany' : q.remote ? ' · autor: ' + (q.author || 'anonim') : ' · twój'),
          q.visibility === 'private' ? h('span', { class: 'badge' }, '🔒 Prywatny') : null,
          !q.builtin && !q.remote && q.visibility !== 'private' && q.cloud === false ? h('span', { class: 'badge warn', title: 'Nie udało się wysłać do wspólnej bazy — spróbuję ponownie przy następnym wejściu' }, '⚠️ tylko lokalnie') : null)),
      favButton(q, 'fav', onFavChange),
      h('div', { class: 'set-actions' },
        btn('Hostuj', () => pickMode(q, 'host'), 'small'),
        btn('Solo', () => pickMode(q, 'solo'), 'small ghost')));
  }
  const emptyBox = (icon, text, sub, action) => h('div', { class: 'empty' },
    h('div', { class: 'big-emoji' }, icon), h('p', {}, text), sub ? h('p', { class: 'muted' }, sub) : null, action);

  function discover() {
    let all = [];
    const local = () => Q.quizzes.all().filter(q => q.questions && q.questions.length && q.visibility !== 'private');
    const merge = () => {
      const l = local(); const ids = new Set(l.map(q => q.id));
      all = l.concat(remoteSets.filter(r => !ids.has(r.id) && r.questions.length));
    };
    merge();
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Szukaj zestawu…', autocomplete: 'off' });
    const grid = h('div', { class: 'set-grid' });
    const status = h('p', { class: 'muted small cloud-status' }, '⏳ Ładuję publiczne zestawy…');
    Q.cloudReady.then(cloud => cloud ? cloud.listPublic() : Promise.reject(new Error('offline'))).then(list => {
      remoteSets = list;
      if (!grid.isConnected) return;
      merge(); draw();
      status.textContent = '🌍 Publiczne zestawy wszystkich graczy: ' + list.length;
    }).catch(e => {
      console.warn('MENTIX listPublic:', e);
      if (grid.isConnected) status.textContent = '⚠️ Nie udało się wczytać publicznych zestawów innych graczy (' + (e.code || e.message) + ').';
    });
    const draw = () => {
      const t = search.value.trim().toLowerCase();
      const list = all.filter(q => !t || q.title.toLowerCase().includes(t));
      grid.replaceChildren(...(list.length ? list.map(q => setCard(q)) : [h('p', { class: 'muted' }, 'Nic nie znaleziono.')]));
    };
    search.oninput = draw;
    draw();
    dash('odkrywaj',
      h('div', { class: 'page-head' }, h('h2', {}, 'Odkrywaj'), search),
      h('p', { class: 'muted' }, 'Wybierz zestaw pytań — zagraj solo albo zahostuj grę dla znajomych.'),
      status,
      grid,
      h('p', { class: 'foot muted' }, 'Tryby gry: ', Q.modes.map(m => m.icon + ' ' + m.name).join(' · ')));
  }

  function favorites() {
    const f = favs();
    const local = Q.quizzes.all();
    const ids = new Set(local.map(q => q.id));
    const cache = favCache();
    const list = local.concat(Object.values(cache).filter(q => !ids.has(q.id)))
      .filter(q => f.includes(q.id) && q.questions && q.questions.length && (q.visibility !== 'private' || isOwn(q)));
    dash('ulubione',
      h('div', { class: 'page-head' }, h('h2', {}, 'Ulubione')),
      list.length
        ? h('div', { class: 'set-grid' }, list.map(q => setCard(q, favorites)))
        : emptyBox('⭐', 'Nie masz jeszcze ulubionych zestawów.', 'Kliknij gwiazdkę przy zestawie, żeby go tu dodać.', btn('Przejdź do Odkrywaj', () => go('odkrywaj'))));
  }

  function mySets() {
    const own = Q.quizzes.loadOwn();
    dash('moje',
      h('div', { class: 'page-head' }, h('h2', {}, 'Moje zestawy'),
        h('div', { class: 'btn-row left tight' }, btn('+ Nowy zestaw', () => go('kreator')), btn('Importuj (JSON)', importQuiz, 'ghost'))),
      own.length
        ? h('div', { class: 'set-grid' }, own.map(q => {
          const c = setCard(q);
          c.append(h('div', { class: 'set-tools' },
            btn('Edytuj', () => editQuiz(q), 'small ghost'),
            btn('Eksport', () => exportQuiz(q), 'small ghost'),
            btn('Usuń', () => {
              if (!confirm('Usunąć zestaw „' + q.title + '”?')) return;
              Q.quizzes.saveOwn(Q.quizzes.loadOwn().filter(x => x.id !== q.id));
              if (q.visibility !== 'private') syncSet({ id: q.id, visibility: 'private' }, true);
              mySets();
            }, 'small danger')));
          return c;
        }))
        : emptyBox('🗂️', 'Nie masz jeszcze własnych zestawów.', null, btn('Stwórz pierwszy zestaw', () => go('kreator'))),
      h('p', { class: 'muted small' }, 'Zestawy zapisują się w tej przeglądarce. Żeby przenieść zestaw na inny komputer, użyj Eksport / Importuj.'));
  }

  function setDetail(q) {
    const backTo = current;
    const copy = () => editQuiz(Object.assign(JSON.parse(JSON.stringify(q)), { id: null, builtin: false, title: q.title + ' (kopia)' }));
    dash(current,
      back(() => go(backTo)),
      h('div', { class: 'set-hero' },
        h('span', { class: 'set-emoji big' }, q.emoji || '📝'),
        h('div', { class: 'grow' },
          h('h2', {}, q.title),
          q.desc ? h('p', { class: 'set-desc big' }, q.desc) : null,
          h('p', { class: 'muted' }, pytan(q.questions.length) + (q.builtin ? ' · wbudowany' : q.remote ? ' · autor: ' + (q.author || 'anonim') : ' · twój') + (q.visibility === 'private' ? ' · 🔒 prywatny' : ' · 🌍 publiczny')),
          h('div', { class: 'btn-row left tight' },
            btn('Hostuj', () => pickMode(q, 'host'), 'big'),
            btn('Solo', () => pickMode(q, 'solo'), 'big ghost'),
            favButton(q, 'btn ghost fav-btn'),
            isOwn(q) ? btn('Edytuj', () => editQuiz(q), 'ghost') : btn('Kopiuj i edytuj', copy, 'ghost')))),
      h('ol', { class: 'q-preview' }, q.questions.map(x => {
        const t = Q.qtypes.typeOf(x);
        return h('li', {},
          h('div', { class: 'q-prev-type' }, t.icon + ' ' + t.name),
          h('b', {}, x.q),
          h('div', { class: 'q-prev-ans' }, t.preview(x)));
      })));
  }

  // ---------- wybór trybu ----------
  function pickMode(quiz, purpose) {
    let dur = Number(localStorage.getItem('qzl_dur')) || 3;
    const chips = h('div', { class: 'chips' });
    function drawChips() {
      chips.replaceChildren(...DURATIONS.map(d => h('button', {
        class: 'chip' + (d === dur ? ' on' : ''),
        onclick: () => { dur = d; try { localStorage.setItem('qzl_dur', d); } catch (e) {} drawChips(); }
      }, d + ' min')));
    }
    drawChips();
    const startWith = mode => purpose === 'host'
      ? hostGame(quiz, mode, dur * 60000)
      : playSolo(quiz, mode, dur * 60000);
    screen(
      back(home),
      h('h2', {}, (quiz.emoji || '📝') + ' ' + quiz.title + ' — wybierz tryb gry'),
      h('div', { class: 'row' }, h('span', { class: 'label' }, 'Czas gry:'), chips),
      Q.modes.length
        ? h('div', { class: 'cards modes' }, Q.modes.map(m =>
          h('button', { class: 'card mode-card', style: { '--mc': m.color || '#ff7a00' }, onclick: () => startWith(m) },
            h('span', { class: 'card-emoji' }, m.icon),
            h('strong', {}, m.name),
            h('span', { class: 'muted' }, m.desc),
            m.author ? h('span', { class: 'author' }, 'autor: ' + m.author) : null
          )))
        : h('p', {}, 'Brak trybów gry — dodaj plik w folderze modes/.')
    );
  }

  // ---------- rozgrywka (wspólna dla solo i multiplayer) ----------
  // o: { quiz, mode, durationMs, me, solo, onScore(score), onTimeUp(score), getBoard() }
  function playGame(o) {
    let score = 0, ended = false, timerId = 0, modeCleanup = null;
    const endFns = [];
    const unit = o.mode.unit || 'pkt';
    const scoreEl = h('b', {}, '0');
    const timeEl = h('b', {}, mmss(o.durationMs));
    const root = h('div', { class: 'mode-root' });
    const toasts = h('div', { class: 'toasts' });
    screen(h('div', { class: 'game' },
      h('div', { class: 'g-bar' },
        h('span', { class: 'g-me' }, o.me.avatar + ' ' + o.me.name),
        h('span', { class: 'g-mode' }, o.mode.icon + ' ' + o.mode.name),
        h('span', { class: 'g-time' }, '⏱ ', timeEl),
        h('span', { class: 'g-score' }, scoreEl, ' ' + unit)
      ),
      root, toasts
    ));
    const endsAt = Date.now() + o.durationMs;

    let deck = [];
    const nextQ = () => { if (!deck.length) deck = shuffle(o.quiz.questions.slice()); return deck.pop(); };

    function setScore(n) {
      n = Math.max(0, Math.round(Number(n) || 0));
      if (ended || n === score) return;
      score = n;
      scoreEl.textContent = fmt(n);
      scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop');
      if (o.onScore) o.onScore(score);
    }
    function toast(text, kind) {
      const t = h('div', { class: 'toast ' + (kind || '') }, text);
      toasts.append(t);
      setTimeout(() => t.remove(), 1800);
    }

    let keyHandler = null;
    function ask() {
      if (ended) return new Promise(() => {});
      return new Promise(resolve => {
        const q = nextQ();
        const type = Q.qtypes.typeOf(q);
        const t0 = performance.now();
        const card = h('div', { class: 'q-card' },
          type.id !== 'choice' ? h('div', { class: 'q-type' }, type.icon + ' ' + type.name) : null,
          h('div', { class: 'q-text' }, q.q));
        const ov = h('div', { class: 'q-overlay' }, card);
        let done = false;
        const api = {
          isDone: () => done || ended,
          lock: () => { if (done || ended) return false; done = true; document.removeEventListener('keydown', keyHandler); return true; },
          done: correct => {
            const timeMs = performance.now() - t0;
            card.append(h('div', { class: 'q-feedback ' + (correct ? 'ok' : 'bad') },
              correct ? '✔ Dobrze!' : '✘ Źle! Poprawna odpowiedź: ' + type.answer(q)));
            setTimeout(() => { ov.remove(); if (!ended) resolve({ correct, timeMs, question: q }); }, correct ? 650 : (type.id === 'order' ? 2600 : 1800));
          }
        };
        let r;
        try { r = type.play(q, api); }
        catch (e) { console.error(e); r = { el: h('p', { class: 'error' }, 'Błąd w pytaniu.') }; setTimeout(() => { if (api.lock()) api.done(false); }, 800); }
        card.append(r.el);
        keyHandler = e => { if (r.key && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) r.key(e); };
        document.addEventListener('keydown', keyHandler);
        root.append(ov);
      });
    }

    const ctx = {
      root, quiz: o.quiz, me: o.me, solo: !!o.solo, unit,
      get ended() { return ended; },
      ask, toast, setScore,
      addScore: n => setScore(score + n),
      getScore: () => score,
      timeLeft: () => Math.max(0, endsAt - Date.now()),
      onEnd: fn => endFns.push(fn),
      leaderboard: () => (o.getBoard ? o.getBoard() : []),
      randInt: Q.randInt, pick: Q.pick, shuffle: Q.shuffle, sleep: Q.sleep, h: Q.h, fmt
    };

    function stop() {
      if (ended) return false;
      ended = true;
      clearInterval(timerId);
      document.removeEventListener('keydown', keyHandler);
      endFns.forEach(f => { try { f(); } catch (e) { console.error(e); } });
      if (typeof modeCleanup === 'function') { try { modeCleanup(); } catch (e) { console.error(e); } }
      return true;
    }
    function timeUp() {
      if (!stop()) return;
      root.replaceChildren(h('div', { class: 'center-box' },
        h('div', { class: 'big-emoji' }, '⏰'),
        h('h2', {}, 'Koniec czasu!'),
        h('p', {}, 'Twój wynik: ', h('b', {}, fmt(score) + ' ' + unit))));
      if (o.onTimeUp) o.onTimeUp(score, root);
    }
    const tick = () => { const left = endsAt - Date.now(); timeEl.textContent = mmss(Math.max(0, left)); if (left <= 10000) timeEl.classList.add('hurry'); if (left <= 0) timeUp(); };
    timerId = setInterval(tick, 250);
    onLeave(stop);

    try { modeCleanup = o.mode.start(ctx); }
    catch (e) { console.error(e); root.append(h('p', { class: 'error' }, 'Błąd w trybie gry „' + o.mode.name + '”: ' + e.message)); }

    return { stop: timeUp, getScore: () => score };
  }

  function playSolo(quiz, mode, durationMs) {
    endSession();
    if (!me.name) me.name = 'Ty';
    playGame({
      quiz, mode, durationMs, me, solo: true,
      onTimeUp(score, root) {
        const k = 'qzl_best_' + quiz.id + '_' + mode.id;
        let best = 0; try { best = Number(localStorage.getItem(k)) || 0; } catch (e) {}
        const rec = score > best;
        if (rec) { try { localStorage.setItem(k, score); } catch (e) {} }
        root.firstChild.append(
          h('p', { class: rec ? 'record' : 'muted' }, rec ? '🏆 Nowy rekord!' : 'Rekord: ' + fmt(best) + ' ' + (mode.unit || 'pkt')),
          h('div', { class: 'btn-row' },
            btn('Zagraj jeszcze raz', () => playSolo(quiz, mode, durationMs), 'big'),
            btn('Inny tryb', () => pickMode(quiz, 'solo'), 'ghost'),
            btn('Strona główna', home, 'ghost')));
      }
    });
  }

  // ---------- wyniki ----------
  function podium(ranking, unit, myName) {
    const top = ranking.slice(0, 3);
    const order = [1, 0, 2].filter(i => top[i]);
    const medals = ['🥇', '🥈', '🥉'];
    return h('div', { class: 'results' },
      h('div', { class: 'podium' }, order.map(i => h('div', { class: 'pod p' + (i + 1) + (top[i].name === myName ? ' mine' : '') },
        h('div', { class: 'pod-ava' }, top[i].avatar),
        h('div', { class: 'pod-name' }, top[i].name),
        h('div', { class: 'pod-score' }, fmt(top[i].score) + ' ' + unit),
        h('div', { class: 'pod-block' }, medals[i])))),
      ranking.length > 3 ? h('ol', { class: 'rank-list', start: '4' }, ranking.slice(3).map(p =>
        h('li', { class: p.name === myName ? 'mine' : '' }, p.avatar + ' ' + p.name, h('b', {}, fmt(p.score))))) : null
    );
  }

  // ---------- HOST ----------
  function hostGame(quiz, mode, durationMs) {
    endSession();
    if (typeof Peer === 'undefined') { alert('Nie udało się wczytać biblioteki do gry online (PeerJS). Sprawdź internet i odśwież stronę.'); return; }
    const S = session = { role: 'host', peer: null, players: new Map(), phase: 'lobby', endsAt: 0, timer: 0, boardTimer: 0, drawT: 0, pin: '' };
    S.dispose = () => {
      clearInterval(S.timer); clearInterval(S.boardTimer); clearTimeout(S.drawT);
      S.players.forEach(p => { try { p.conn.send({ t: 'hostLeft' }); p.conn.close(); } catch (e) {} });
      try { S.peer && S.peer.destroy(); } catch (e) {}
    };
    const unit = mode.unit || 'pkt';
    const players = () => [...S.players.values()].filter(p => !p.left);
    const ranking = () => players().map(p => ({ name: p.name, avatar: p.avatar, score: p.score })).sort((a, b) => b.score - a.score);
    const send = (conn, msg) => { try { if (conn.open) conn.send(msg); } catch (e) { console.warn(e); } };
    const broadcast = msg => players().forEach(p => send(p.conn, msg));
    const startMsg = () => ({ t: 'start', quiz: { id: quiz.id, title: quiz.title, questions: quiz.questions }, modeId: mode.id, remainingMs: Math.max(0, S.endsAt - Date.now()) });

    let view = () => {};
    const redraw = () => { if (S.drawT) return; S.drawT = setTimeout(() => { S.drawT = 0; if (session === S) view(); }, 80); };

    // --- lobby ---
    const pinEl = h('div', { class: 'big-pin' }, '······');
    const status = h('p', { class: 'muted' }, 'Tworzę grę…');
    const list = h('div', { class: 'lobby-players' });
    const count = h('span', {}, '0');
    const qrBox = h('button', { class: 'qr-box', title: 'Powiększ kod QR', onclick: () => S.pin && showBigQr(S.pin) },
      h('div', { class: 'qr-code' }), h('span', {}, 'Zeskanuj, żeby dołączyć'));
    const startBtn = btn('Start ▶', startGame, 'big');
    startBtn.disabled = true;
    const site = location.host + location.pathname.replace(/index\.html$/, '');
    screen(
      back(home),
      h('div', { class: 'lobby' },
        h('div', { class: 'lobby-head' },
          h('div', { class: 'lobby-pin' }, h('p', { class: 'muted' }, 'Wejdź na ', h('b', {}, site), ' i wpisz PIN:'), pinEl, status),
          qrBox,
          h('div', { class: 'lobby-info' },
            h('div', {}, (quiz.emoji || '📝') + ' ', h('b', {}, quiz.title)),
            h('div', {}, mode.icon + ' ', h('b', {}, mode.name)),
            h('div', {}, '⏱ ', h('b', {}, mmss(durationMs))),
            h('div', {}, '👥 Graczy: ', h('b', {}, count)),
            startBtn)),
        list,
        h('p', { class: 'muted small' }, 'Kliknij gracza, żeby go usunąć z gry.')
      )
    );
    view = () => {
      const ps = players();
      count.textContent = ps.length;
      startBtn.disabled = !ps.length;
      list.replaceChildren(...(ps.length ? ps.map(p => h('button', { class: 'player-chip', title: 'Usuń z gry', onclick: () => kick(p) }, p.avatar + ' ' + p.name))
        : [h('div', { class: 'waiting' }, h('span', { class: 'dots' }), 'Czekamy na graczy…')]));
    };
    view();

    function kick(p) {
      if (!confirm('Usunąć gracza ' + p.name + '?')) return;
      send(p.conn, { t: 'kicked' });
      S.players.delete(p.conn.peer);
      setTimeout(() => { try { p.conn.close(); } catch (e) {} }, 300);
      redraw();
    }

    function open(attempt) {
      const pin = String(100000 + Math.floor(Math.random() * 900000));
      const peer = new Peer(PREFIX + pin, { debug: 1 });
      S.peer = peer;
      peer.on('open', () => {
        if (session !== S) return;
        S.pin = pin;
        pinEl.textContent = pin.slice(0, 3) + ' ' + pin.slice(3);
        status.textContent = 'Gra gotowa — czekamy na graczy.';
        const svg = qrSvg(joinUrl(pin));
        if (svg) qrBox.firstChild.replaceChildren(svg); else qrBox.remove();
      });
      peer.on('error', err => {
        if (session !== S) return;
        console.warn('PeerJS host:', err.type, err);
        if (err.type === 'unavailable-id' && attempt < 5) { peer.destroy(); open(attempt + 1); }
        else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'unavailable-id'].includes(err.type)) status.textContent = '⚠️ Problem z połączeniem (' + err.type + '). Odśwież stronę i spróbuj ponownie.';
      });
      peer.on('disconnected', () => { if (session === S && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1000); });
      peer.on('connection', conn => {
        conn.on('data', msg => onMsg(conn, msg));
        conn.on('close', () => {
          const p = S.players.get(conn.peer);
          if (!p || p.conn !== conn) return;
          if (S.phase === 'lobby') S.players.delete(conn.peer); else p.left = true;
          redraw();
        });
      });
    }
    open(0);

    function onMsg(conn, msg) {
      if (session !== S || !msg || typeof msg !== 'object') return;
      if (msg.t === 'join') {
        if (S.phase === 'end') return send(conn, { t: 'refused', why: 'Ta gra już się skończyła.' });
        const name = String(msg.name || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Gracz';
        const taken = players().some(p => p.name.toLowerCase() === name.toLowerCase() && p.conn.peer !== conn.peer);
        if (taken) return send(conn, { t: 'refused', why: 'Nick „' + name + '” jest już zajęty — wybierz inny.' });
        const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[0];
        S.players.set(conn.peer, { name, avatar, score: 0, conn });
        send(conn, { t: 'joined', name, quizTitle: quiz.title, modeName: mode.icon + ' ' + mode.name });
        if (S.phase === 'game') send(conn, startMsg());
        redraw();
      } else if (msg.t === 'avatar') {
        const p = S.players.get(conn.peer);
        if (p && S.phase === 'lobby' && AVATARS.includes(msg.avatar)) { p.avatar = msg.avatar; redraw(); }
      } else if (msg.t === 'score') {
        const p = S.players.get(conn.peer);
        if (p && S.phase === 'game') { p.score = Math.max(0, Math.min(1e12, Math.round(Number(msg.score) || 0))); redraw(); }
      }
    }

    // --- gra ---
    function startGame() {
      if (!players().length) return;
      S.phase = 'game';
      S.endsAt = Date.now() + durationMs;
      broadcast(startMsg());
      const timeEl = h('div', { class: 'host-time' }, mmss(durationMs));
      const board = h('div', { class: 'board' });
      const smallPin = h('span', { class: 'small-pin' }, 'PIN: ' + S.pin);
      screen(h('div', { class: 'host-game' },
        h('div', { class: 'host-top' },
          h('div', {}, h('b', {}, mode.icon + ' ' + mode.name), ' · ' + quiz.title, ' · ', smallPin),
          timeEl,
          btn('Zakończ teraz', () => { if (confirm('Zakończyć grę teraz?')) finish(); }, 'ghost'))
        , board));
      view = () => {
        const r = ranking();
        const max = Math.max(1, ...r.map(p => p.score));
        board.replaceChildren(...r.map((p, i) => h('div', { class: 'board-row' },
          h('span', { class: 'board-pos' }, i + 1),
          h('span', { class: 'board-ava' }, p.avatar),
          h('span', { class: 'board-name' }, p.name),
          h('span', { class: 'board-bar' }, h('i', { style: { width: (p.score / max * 100) + '%' } })),
          h('b', { class: 'board-score' }, fmt(p.score) + ' ' + unit))));
      };
      view();
      S.timer = setInterval(() => {
        const left = S.endsAt - Date.now();
        timeEl.textContent = mmss(Math.max(0, left));
        if (left <= 10000) timeEl.classList.add('hurry');
        if (left <= 0) finish();
      }, 250);
      S.boardTimer = setInterval(() => broadcast({ t: 'board', top: ranking().slice(0, 10) }), 2000);
    }

    function finish() {
      if (S.phase !== 'game') return;
      S.phase = 'end';
      clearInterval(S.timer); clearInterval(S.boardTimer);
      const r = ranking();
      broadcast({ t: 'end', ranking: r, unit });
      view = () => {};
      screen(h('div', { class: 'end-screen' },
        h('h1', {}, '🏁 Koniec gry!'),
        r.length ? podium(r, unit) : h('p', {}, 'Nikt nie zagrał.'),
        h('div', { class: 'btn-row' },
          btn('Zagraj ponownie', () => hostGame(quiz, mode, durationMs), 'big'),
          btn('Inny tryb', () => { endSession(); pickMode(quiz, 'host'); }, 'ghost'),
          btn('Strona główna', home, 'ghost'))));
    }
  }

  // ---------- GRACZ ----------
  function joinScreen(pin, error) {
    endSession();
    const name = h('input', { class: 'name-input', maxlength: '16', placeholder: 'Twój nick', value: me.name, autocomplete: 'off' });
    const go = () => {
      const n = name.value.replace(/\s+/g, ' ').trim();
      if (!n) return shake(name);
      me.name = n.slice(0, 16); saveMe();
      connect(pin);
    };
    name.onkeydown = e => { if (e.key === 'Enter') go(); };
    screen(
      back(home),
      h('div', { class: 'join-box' },
        h('p', { class: 'muted' }, 'Gra PIN ', h('b', {}, pin)),
        h('h2', {}, 'Kim jesteś?'),
        error ? h('p', { class: 'error' }, error) : null,
        name,
        btn('Wchodzę! 🚀', go, 'big wide join-go'),
        h('p', { class: 'muted small' }, 'Wygląd wybierzesz w poczekalni.'))
    );
    setTimeout(() => name.focus(), 50);
  }

  function connect(pin) {
    endSession();
    if (typeof Peer === 'undefined') { joinScreen(pin, 'Nie udało się wczytać biblioteki do gry online. Sprawdź internet i odśwież stronę.'); return; }
    const S = session = { role: 'player', peer: null, conn: null, phase: 'connecting', game: null, board: [], sendT: 0, dirty: false, score: 0 };
    S.dispose = () => { clearTimeout(S.sendT); clearTimeout(S.to); try { S.peer && S.peer.destroy(); } catch (e) {} };
    const fail = why => { if (session !== S) return; const p = S.phase; endSession(); if (p === 'end') return; joinScreen(pin, why); };

    screen(h('div', { class: 'center-box' }, h('div', { class: 'big-emoji spin' }, '🍊'), h('h2', {}, 'Łączę z grą ' + pin + '…')));

    S.to = setTimeout(() => { if (S.phase === 'connecting') fail('Nie udało się połączyć z grą o PIN-ie ' + pin + '. Sprawdź PIN.'); }, 15000);
    const peer = new Peer({ debug: 1 });
    S.peer = peer;
    peer.on('open', () => {
      if (session !== S) return;
      const conn = peer.connect(PREFIX + pin, { reliable: true, serialization: 'json' });
      S.conn = conn;
      conn.on('open', () => { if (session !== S) return; conn.send({ t: 'join', name: me.name, avatar: me.avatar }); });
      conn.on('data', onMsg);
      conn.on('close', () => { if (S.phase !== 'end') fail('Połączenie z hostem zostało przerwane.'); });
    });
    peer.on('error', err => {
      console.warn('PeerJS gracz:', err.type, err);
      if (err.type === 'peer-unavailable') fail('Nie ma gry o PIN-ie ' + pin + '.');
      else if (S.phase === 'connecting' || ['network', 'server-error', 'socket-error', 'browser-incompatible'].includes(err.type)) fail('Problem z połączeniem (' + err.type + ').');
    });

    function sendScore() {
      if (S.sendT) { S.dirty = true; return; }
      try { S.conn.send({ t: 'score', score: S.score }); } catch (e) {}
      S.sendT = setTimeout(() => { S.sendT = 0; if (S.dirty) { S.dirty = false; sendScore(); } }, 300);
    }

    function onMsg(msg) {
      if (session !== S || !msg || typeof msg !== 'object') return;
      if (msg.t === 'refused') fail(msg.why || 'Host nie wpuścił Cię do gry.');
      else if (msg.t === 'kicked') fail('Host usunął Cię z gry.');
      else if (msg.t === 'hostLeft') fail('Host zamknął grę.');
      else if (msg.t === 'joined') {
        S.phase = 'lobby';
        clearTimeout(S.to);
        me.name = msg.name;
        const preview = h('div', { class: 'big-emoji bounce' }, me.avatar);
        const avas = h('div', { class: 'avatars' });
        const drawAvas = () => avas.replaceChildren(...AVATARS.map(a => h('button', {
          class: 'ava' + (a === me.avatar ? ' on' : ''),
          onclick: () => {
            if (a === me.avatar) return;
            me.avatar = a; saveMe();
            preview.textContent = a;
            drawAvas();
            try { S.conn.send({ t: 'avatar', avatar: a }); } catch (e) {}
          }
        }, a)));
        drawAvas();
        screen(h('div', { class: 'join-box lobby-wait' },
          preview,
          h('h2', {}, 'Jesteś w grze, ' + me.name + '!'),
          h('p', { class: 'muted' }, String(msg.quizTitle || ''), ' · ', String(msg.modeName || '')),
          h('p', { class: 'waiting' }, h('span', { class: 'dots' }), 'Czekamy, aż host wystartuje…'),
          h('p', { class: 'label' }, 'Wybierz swój wygląd:'),
          avas));
      } else if (msg.t === 'start') {
        const mode = findMode(msg.modeId);
        if (!mode) { fail('Nie znam trybu gry „' + msg.modeId + '”. Odśwież stronę.'); return; }
        const quiz = msg.quiz;
        if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) { fail('Host wysłał pusty quiz.'); return; }
        S.phase = 'game';
        S.unit = mode.unit || 'pkt';
        S.game = playGame({
          quiz, mode, me, durationMs: Number(msg.remainingMs) || 60000,
          onScore: s => { S.score = s; sendScore(); },
          getBoard: () => S.board.slice(),
          onTimeUp: (s, root) => { root.firstChild.append(h('p', { class: 'waiting' }, h('span', { class: 'dots' }), 'Czekamy na wyniki…')); }
        });
      } else if (msg.t === 'board') {
        if (Array.isArray(msg.top)) S.board = msg.top;
      } else if (msg.t === 'end') {
        if (S.game) S.game.stop();
        S.phase = 'end';
        const r = Array.isArray(msg.ranking) ? msg.ranking : [];
        const place = r.findIndex(p => p.name === me.name) + 1;
        const unit = msg.unit || S.unit || 'pkt';
        screen(h('div', { class: 'end-screen' },
          h('h1', {}, place === 1 ? '🏆 Wygrałeś!' : '🏁 Koniec gry!'),
          place ? h('p', { class: 'lead' }, 'Twoje miejsce: ', h('b', {}, place + ' / ' + r.length)) : null,
          podium(r, unit, me.name),
          h('div', { class: 'btn-row' }, btn('Strona główna', home, 'big'))));
        setTimeout(() => { if (session === S) endSession(); }, 1500);
      }
    }
  }

  // ---------- eksport / import / kreator zestawów ----------
  function exportQuiz(q) {
    const data = JSON.stringify({ title: q.title, desc: q.desc || '', emoji: q.emoji, visibility: q.visibility || 'public', questions: q.questions }, null, 2);
    const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: (q.title || 'quiz').replace(/[^\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '') + '.json' });
    document.body.append(a); a.click(); a.remove();
  }
  function importQuiz() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      f.text().then(txt => {
        const d = JSON.parse(txt);
        const qs = (d.questions || []).map(Q.qtypes.clean).filter(x => x && typeof x === 'object');
        if (!qs.length) throw new Error('brak pytań');
        const own = Q.quizzes.loadOwn();
        own.unshift({ id: newSetId(), title: String(d.title || 'Zaimportowany zestaw').slice(0, 60), desc: String(d.desc || '').slice(0, 300), emoji: String(d.emoji || '📝').slice(0, 4), visibility: d.visibility === 'private' ? 'private' : 'public', questions: qs });
        Q.quizzes.saveOwn(own); mySets();
        syncSet(own[0]);
      }).catch(e => alert('To nie jest poprawny plik quizu (' + e.message + ').'));
    };
    inp.click();
  }

  const COVER_ICONS = ['📝', '🧠', '🌍', '✖️', '➗', '📐', '🔬', '🧪', '📚', '🎨', '🎵', '⚽', '🏰', '🐾', '💻', '🚀', '🗺️', '🧮', '🌱', '⭐'];

  function editQuiz(orig) {
    const editing = !!(orig && orig.id);
    const quiz = orig ? JSON.parse(JSON.stringify(orig)) : { id: null, title: '', desc: '', emoji: '📝', visibility: 'public', questions: [] };
    if (quiz.visibility !== 'private') quiz.visibility = 'public';
    if (quiz.desc == null) quiz.desc = '';
    quiz.questions = (quiz.questions || []).map(q => Object.assign({ type: 'choice' }, q));
    delete quiz.builtin;
    const section = editing ? 'moje' : 'kreator';
    const leave = () => { if (confirm('Wyjść bez zapisywania?')) mySets(); };
    const steps = n => h('div', { class: 'steps' },
      h('span', { class: 'step ' + (n === 1 ? 'on' : 'done') }, h('b', {}, '1'), ' Szczegóły'),
      h('span', { class: 'step-line' }),
      h('span', { class: 'step' + (n === 2 ? ' on' : '') }, h('b', {}, '2'), ' Pytania'));

    if (editing) stepQuestions(); else stepDetails();

    // ----- krok 1: nazwa, opis, ikonka, widoczność -----
    function stepDetails() {
      const title = h('input', { class: 'title-input', maxlength: '60', placeholder: 'np. Ułamki — klasa 5', value: quiz.title });
      const desc = h('textarea', { class: 'desc-input', rows: '3', maxlength: '300', placeholder: 'O czym jest ten zestaw? (opcjonalnie)', value: quiz.desc });
      const iconPrev = h('div', { class: 'cover-prev' }, quiz.emoji);
      const icons = h('div', { class: 'cover-icons' });
      const drawIcons = () => icons.replaceChildren(...COVER_ICONS.map(ic => h('button', {
        class: 'cover-ic' + (ic === quiz.emoji ? ' on' : ''),
        onclick: () => { quiz.emoji = ic; iconPrev.textContent = Q.mono(ic); drawIcons(); }
      }, ic)));
      drawIcons();
      const vis = h('div', { class: 'vis-opts' });
      const visOpt = (v, ic, name, txt) => h('button', {
        class: 'vis-opt' + (quiz.visibility === v ? ' on' : ''),
        onclick: () => { quiz.visibility = v; drawVis(); }
      }, h('span', { class: 'vis-ic' }, ic), h('strong', {}, name), h('span', { class: 'muted small' }, txt));
      const drawVis = () => vis.replaceChildren(
        visOpt('public', '🌍', 'Publiczny', 'Widoczny w Odkrywaj.'),
        visOpt('private', '🔒', 'Prywatny', 'Tylko w Moich zestawach — nadal możesz go hostować.'));
      drawVis();
      const msg = h('p', { class: 'error' });
      const keep = () => { quiz.title = title.value.trim(); quiz.desc = desc.value.trim(); };
      const next = () => {
        keep();
        if (!quiz.title) { msg.textContent = 'Podaj nazwę zestawu.'; return shake(title); }
        stepQuestions();
      };
      title.oninput = () => { msg.textContent = ''; };
      title.onkeydown = e => { if (e.key === 'Enter') next(); };
      dash(section,
        editing ? back(leave) : null,
        h('h2', {}, editing ? 'Edytuj zestaw' : 'Kreator zestawów'),
        steps(1),
        h('div', { class: 'creator-card' },
          h('div', { class: 'creator-grid' },
            h('div', { class: 'creator-main' },
              h('label', { class: 'field' }, h('span', { class: 'label' }, 'Nazwa zestawu'), title),
              h('label', { class: 'field' }, h('span', { class: 'label' }, 'Opis'), desc),
              h('div', { class: 'field' }, h('span', { class: 'label' }, 'Widoczność'), vis)),
            h('div', { class: 'field creator-side' }, h('span', { class: 'label' }, 'Ikonka zestawu'), iconPrev, icons))),
        msg,
        h('div', { class: 'btn-row left' }, btn('Dalej: pytania →', next, 'big')));
      setTimeout(() => title.focus(), 50);
    }

    // ----- krok 2: pytania różnych typów -----
    function stepQuestions() {
      const list = h('div', { class: 'q-edit-list' });
      const msg = h('p', { class: 'error' });
      const swap = (a, b) => { const qs = quiz.questions; [qs[a], qs[b]] = [qs[b], qs[a]]; draw(); };
      function draw() {
        list.replaceChildren(...(quiz.questions.length ? quiz.questions.map((q, i) => {
          const type = Q.qtypes.typeOf(q);
          const sel = h('select', { class: 'type-select', title: 'Typ pytania', onchange: e => { quiz.questions[i] = Q.qtypes.convert(q, e.target.value); draw(); } },
            Q.qtypes.list.map(t => h('option', { value: t.id, selected: t.id === type.id }, t.name)));
          return h('div', { class: 'q-edit' },
            h('div', { class: 'q-edit-head' },
              h('b', { class: 'q-no' }, i + 1),
              h('span', { class: 'type-ic' }, type.icon), sel,
              h('span', { class: 'grow' }),
              h('button', { class: 'mini', title: 'W górę', disabled: i === 0, onclick: () => swap(i, i - 1) }, '↑'),
              h('button', { class: 'mini', title: 'W dół', disabled: i === quiz.questions.length - 1, onclick: () => swap(i, i + 1) }, '↓'),
              h('button', { class: 'mini', title: 'Duplikuj', onclick: () => { quiz.questions.splice(i + 1, 0, JSON.parse(JSON.stringify(q))); draw(); } }, '⧉'),
              h('button', { class: 'mini danger', title: 'Usuń pytanie', onclick: () => {
                if (Q.qtypes.isEmpty(q) || confirm('Usunąć pytanie ' + (i + 1) + '?')) { quiz.questions.splice(i, 1); draw(); }
              } }, '🗑')),
            h('textarea', { rows: '2', maxlength: '200', placeholder: type.id === 'tf' ? 'Zdanie do oceny, np. „Wieloryb to ryba.”' : 'Treść pytania', value: q.q, oninput: e => { q.q = e.target.value; } }),
            type.edit(q, draw));
        }) : [h('div', { class: 'empty' }, h('p', {}, 'Nie ma jeszcze pytań.'), h('p', { class: 'muted' }, 'Wybierz poniżej typ pierwszego pytania.'))]));
      }
      const addQ = id => {
        quiz.questions.push(Q.qtypes.get(id).blank());
        draw();
        setTimeout(() => { const t = list.lastChild && list.lastChild.querySelector('textarea'); if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 0);
      };
      function save() {
        const clean = [];
        for (let i = 0; i < quiz.questions.length; i++) {
          const q = quiz.questions[i];
          if (Q.qtypes.isEmpty(q)) continue;
          const r = Q.qtypes.clean(q);
          if (typeof r === 'string') {
            msg.textContent = 'Pytanie ' + (i + 1) + ': ' + r + '.';
            if (list.children[i]) list.children[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
          }
          clean.push(r);
        }
        if (!clean.length) { msg.textContent = 'Dodaj co najmniej jedno pytanie.'; return; }
        const own = Q.quizzes.loadOwn();
        const rec = { id: quiz.id || newSetId(), title: quiz.title, desc: quiz.desc, emoji: quiz.emoji, visibility: quiz.visibility, questions: clean };
        const idx = own.findIndex(x => x.id === rec.id);
        if (idx >= 0) own[idx] = rec; else own.unshift(rec);
        if (Q.quizzes.saveOwn(own)) { mySets(); syncSet(rec); }
      }
      draw();
      dash(section,
        h('button', { class: 'back', onclick: stepDetails }, '← Wróć do szczegółów'),
        h('h2', {}, editing ? 'Edytuj zestaw' : 'Kreator zestawów'),
        steps(2),
        h('div', { class: 'set-summary' },
          h('span', { class: 'set-emoji' }, quiz.emoji),
          h('div', { class: 'grow' },
            h('strong', {}, quiz.title),
            h('div', { class: 'muted small' }, (quiz.visibility === 'private' ? '🔒 Prywatny' : '🌍 Publiczny') + (quiz.desc ? ' · ' + quiz.desc : ''))),
          btn('✏️ Szczegóły', stepDetails, 'small ghost')),
        list,
        h('div', { class: 'add-q' },
          h('p', { class: 'label' }, 'Dodaj pytanie:'),
          h('div', { class: 'type-tiles' }, Q.qtypes.list.map(t => h('button', { class: 'type-tile', onclick: () => addQ(t.id) },
            h('span', { class: 'type-tile-ic' }, t.icon), h('strong', {}, t.name), h('span', { class: 'muted small' }, t.desc))))),
        msg,
        h('div', { class: 'btn-row left save-row' }, btn('💾 Zapisz zestaw', save, 'big'), editing ? btn('Anuluj', leave, 'ghost') : null));
    }
  }

  // start: ?pin=123456 w adresie od razu otwiera dołączanie
  const urlPin = (new URLSearchParams(location.search).get('pin') || '').replace(/\D/g, '');
  const startHash = location.hash.slice(1);
  if (location.search) history.replaceState(null, '', location.pathname);
  if (urlPin.length === 6) joinScreen(urlPin); else go(SECTIONS.some(x => x.id === startHash) ? startHash : 'odkrywaj');
})();
