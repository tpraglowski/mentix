// Quizolandia — ekrany, host / gracz (PeerJS), uruchamianie trybów gry.
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
    screenCleanups.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    screenCleanups = [];
    app.replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }
  const onLeave = fn => screenCleanups.push(fn);

  // sesja sieciowa (host albo gracz) — przeżywa zmianę ekranów
  let session = null;
  function endSession() {
    if (session) { const s = session; session = null; try { s.dispose(); } catch (e) { console.error(e); } }
  }

  document.getElementById('logo').onclick = e => { e.preventDefault(); home(); };

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

  // ---------- strona główna ----------
  function home() {
    endSession();
    const pin = h('input', { class: 'pin-input', inputmode: 'numeric', maxlength: '7', placeholder: 'PIN gry', autocomplete: 'off' });
    const go = () => { const v = pin.value.replace(/\D/g, ''); if (v.length !== 6) return shake(pin); joinScreen(v); };
    pin.onkeydown = e => { if (e.key === 'Enter') go(); };
    const tile = (icon, title, text, fn) => h('button', { class: 'tile', onclick: fn },
      h('span', { class: 'tile-icon' }, icon), h('strong', {}, title), h('span', {}, text));
    screen(
      h('section', { class: 'hero' },
        h('h1', {}, 'Ucz się ', h('span', { class: 'accent' }, 'grając'), '!'),
        h('p', { class: 'lead' }, 'Quizy z trybami gry. Dołącz do gry kodem PIN albo zahostuj własną.'),
        h('div', { class: 'join-card' }, pin, btn('Dołącz', go, 'big'))
      ),
      h('section', { class: 'tiles' },
        tile('🎮', 'Hostuj grę', 'Wybierz quiz i tryb gry — gracze dołączają kodem PIN.', () => pickQuiz('host')),
        tile('🧍', 'Graj solo', 'Potrenuj dowolny quiz w dowolnym trybie.', () => pickQuiz('solo')),
        tile('✏️', 'Moje quizy', 'Twórz i edytuj własne zestawy pytań.', quizList)
      ),
      h('p', { class: 'foot muted' }, 'Tryby gry: ', Q.modes.map(m => m.icon + ' ' + m.name).join(' · '))
    );
    setTimeout(() => pin.focus(), 50);
  }

  // ---------- wybór quizu i trybu ----------
  function pickQuiz(purpose) {
    const quizzes = Q.quizzes.all().filter(q => q.questions && q.questions.length);
    screen(
      back(home),
      h('h2', {}, purpose === 'host' ? '🎮 Hostuj grę — wybierz quiz' : '🧍 Graj solo — wybierz quiz'),
      h('div', { class: 'cards' }, quizzes.map(q =>
        h('button', { class: 'card', onclick: () => pickMode(q, purpose) },
          h('span', { class: 'card-emoji' }, q.emoji || '📝'),
          h('strong', {}, q.title),
          h('span', { class: 'muted' }, pytan(q.questions.length) + (q.builtin ? ' · wbudowany' : ' · twój'))
        ))),
      h('p', { class: 'muted' }, 'Chcesz własny? ', h('a', { href: '#', onclick: e => { e.preventDefault(); editQuiz(null); } }, 'Stwórz nowy quiz'))
    );
  }

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
      back(() => pickQuiz(purpose)),
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
        const t0 = performance.now();
        const order = shuffle(q.a.map((_, i) => i).filter(i => String(q.a[i] || '').trim()));
        const grid = h('div', { class: 'q-answers n' + order.length });
        const card = h('div', { class: 'q-card' }, h('div', { class: 'q-text' }, q.q), grid);
        const ov = h('div', { class: 'q-overlay' }, card);
        let done = false;
        const choose = k => {
          if (done || ended) return;
          done = true;
          document.removeEventListener('keydown', keyHandler);
          const ai = order[k];
          const correct = ai === q.c;
          const timeMs = performance.now() - t0;
          grid.classList.add('answered');
          grid.children[k].classList.add(correct ? 'right' : 'wrong');
          const ck = order.indexOf(q.c);
          if (!correct && ck >= 0) grid.children[ck].classList.add('right');
          card.append(h('div', { class: 'q-feedback ' + (correct ? 'ok' : 'bad') },
            correct ? '✔ Dobrze!' : '✘ Źle! Poprawna odpowiedź: ' + q.a[q.c]));
          setTimeout(() => { ov.remove(); if (!ended) resolve({ correct, timeMs, question: q }); }, correct ? 650 : 1700);
        };
        order.forEach((ai, k) => grid.append(h('button', { class: 'q-ans c' + k, onclick: () => choose(k) },
          h('span', { class: 'q-key' }, String(k + 1)), q.a[ai])));
        keyHandler = e => { const k = Number(e.key) - 1; if (k >= 0 && k < order.length) choose(k); };
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

  // ---------- edytor quizów ----------
  function quizList() {
    endSession();
    const own = Q.quizzes.loadOwn();
    screen(
      back(home),
      h('h2', {}, '✏️ Moje quizy'),
      h('div', { class: 'btn-row left' }, btn('+ Nowy quiz', () => editQuiz(null), 'big'), btn('📥 Importuj (JSON)', importQuiz, 'ghost')),
      own.length ? h('div', { class: 'quiz-list' }, own.map((q, i) => h('div', { class: 'quiz-row' },
        h('span', { class: 'card-emoji' }, q.emoji || '📝'),
        h('div', { class: 'grow' }, h('strong', {}, q.title), h('div', { class: 'muted' }, pytan(q.questions.length))),
        btn('Edytuj', () => editQuiz(q), 'small'),
        btn('Eksport', () => exportQuiz(q), 'small ghost'),
        btn('Usuń', () => { if (confirm('Usunąć quiz „' + q.title + '”?')) { own.splice(i, 1); Q.quizzes.saveOwn(own); quizList(); } }, 'small danger')
      ))) : h('p', { class: 'muted' }, 'Nie masz jeszcze własnych quizów.'),
      h('h3', {}, 'Wbudowane (możesz skopiować i zmienić)'),
      h('div', { class: 'quiz-list' }, Q.quizzes.builtin.map(q => h('div', { class: 'quiz-row' },
        h('span', { class: 'card-emoji' }, q.emoji),
        h('div', { class: 'grow' }, h('strong', {}, q.title), h('div', { class: 'muted' }, pytan(q.questions.length))),
        btn('Kopiuj', () => editQuiz(Object.assign(JSON.parse(JSON.stringify(q)), { id: null, builtin: false, title: q.title + ' (kopia)' })), 'small ghost')
      ))),
      h('p', { class: 'muted small' }, 'Quizy zapisują się w tej przeglądarce. Żeby przenieść quiz na inny komputer, użyj Eksport / Importuj.')
    );
  }

  function exportQuiz(q) {
    const data = JSON.stringify({ title: q.title, emoji: q.emoji, questions: q.questions }, null, 2);
    const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: (q.title || 'quiz').replace(/[^\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ -]/g, '') + '.json' });
    document.body.append(a); a.click(); a.remove();
  }
  function importQuiz() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      f.text().then(txt => {
        const d = JSON.parse(txt);
        const qs = (d.questions || []).filter(x => x && x.q && Array.isArray(x.a)).map(x => ({ q: String(x.q), a: x.a.slice(0, 4).map(String), c: Math.min(3, Math.max(0, Number(x.c) || 0)) }));
        if (!qs.length) throw new Error('brak pytań');
        const own = Q.quizzes.loadOwn();
        own.unshift({ id: 'q' + Date.now(), title: String(d.title || 'Zaimportowany quiz').slice(0, 60), emoji: String(d.emoji || '📝').slice(0, 4), questions: qs });
        Q.quizzes.saveOwn(own); quizList();
      }).catch(e => alert('To nie jest poprawny plik quizu (' + e.message + ').'));
    };
    inp.click();
  }

  function editQuiz(orig) {
    const quiz = orig ? JSON.parse(JSON.stringify(orig)) : { id: null, title: '', emoji: '📝', questions: [] };
    if (!quiz.questions.length) quiz.questions.push({ q: '', a: ['', '', '', ''], c: 0 });
    const title = h('input', { class: 'title-input', maxlength: '60', placeholder: 'Nazwa quizu, np. Ułamki', value: quiz.title });
    const emoji = h('input', { class: 'emoji-input', maxlength: '4', value: quiz.emoji || '📝', title: 'Emoji quizu' });
    const list = h('div', { class: 'q-edit-list' });
    const msg = h('p', { class: 'error' });

    function sync() {
      quiz.title = title.value.trim();
      quiz.emoji = emoji.value.trim() || '📝';
    }
    function draw() {
      list.replaceChildren(...quiz.questions.map((q, i) => {
        const group = 'c' + i + '_' + Math.random().toString(36).slice(2, 7);
        return h('div', { class: 'q-edit' },
          h('div', { class: 'q-edit-head' }, h('b', {}, 'Pytanie ' + (i + 1)),
            quiz.questions.length > 1 ? h('button', { class: 'x', title: 'Usuń pytanie', onclick: () => { quiz.questions.splice(i, 1); draw(); } }, '🗑') : null),
          h('textarea', { rows: '2', placeholder: 'Treść pytania', value: q.q, oninput: e => { q.q = e.target.value; } }),
          h('div', { class: 'a-edit-grid' }, [0, 1, 2, 3].map(k => h('label', { class: 'a-edit c' + k + (q.c === k ? ' correct' : '') },
            h('input', { type: 'radio', name: group, checked: q.c === k, title: 'Poprawna odpowiedź', onchange: () => { q.c = k; draw(); } }),
            h('input', { type: 'text', maxlength: '80', placeholder: k < 2 ? 'Odpowiedź ' + (k + 1) : 'Odpowiedź ' + (k + 1) + ' (opcjonalna)', value: q.a[k] || '', oninput: e => { q.a[k] = e.target.value; } })
          ))));
      }));
    }
    draw();

    function save() {
      sync();
      if (!quiz.title) { msg.textContent = 'Podaj nazwę quizu.'; return shake(title); }
      const clean = [];
      for (let i = 0; i < quiz.questions.length; i++) {
        const q = quiz.questions[i];
        const a = [0, 1, 2, 3].map(k => String(q.a[k] || '').trim());
        if (!q.q.trim() && !a.some(Boolean)) continue; // puste pytanie — pomiń
        if (!q.q.trim()) { msg.textContent = 'Pytanie ' + (i + 1) + ' nie ma treści.'; return; }
        if (a.filter(Boolean).length < 2) { msg.textContent = 'Pytanie ' + (i + 1) + ' musi mieć co najmniej 2 odpowiedzi.'; return; }
        if (!a[q.c]) { msg.textContent = 'W pytaniu ' + (i + 1) + ' zaznaczona poprawna odpowiedź jest pusta.'; return; }
        clean.push({ q: q.q.trim(), a, c: q.c });
      }
      if (!clean.length) { msg.textContent = 'Dodaj co najmniej jedno pytanie.'; return; }
      const own = Q.quizzes.loadOwn();
      const rec = { id: quiz.id || 'q' + Date.now(), title: quiz.title, emoji: quiz.emoji, questions: clean };
      const idx = own.findIndex(x => x.id === rec.id);
      if (idx >= 0) own[idx] = rec; else own.unshift(rec);
      if (Q.quizzes.saveOwn(own)) quizList();
    }

    screen(
      back(() => { if (confirm('Wyjść bez zapisywania?')) quizList(); }),
      h('h2', {}, orig && orig.id ? 'Edytuj quiz' : 'Nowy quiz'),
      h('div', { class: 'row' }, emoji, title),
      list,
      h('div', { class: 'btn-row left' },
        btn('+ Dodaj pytanie', () => { quiz.questions.push({ q: '', a: ['', '', '', ''], c: 0 }); draw(); setTimeout(() => { const t = list.lastChild.querySelector('textarea'); t && t.focus(); }, 0); }, 'ghost'),
        btn('💾 Zapisz quiz', save, 'big')),
      msg,
      h('p', { class: 'muted small' }, 'Kółko przy odpowiedzi = poprawna odpowiedź.')
    );
  }

  // start: ?pin=123456 w adresie od razu otwiera dołączanie
  const urlPin = (new URLSearchParams(location.search).get('pin') || '').replace(/\D/g, '');
  if (location.search) history.replaceState(null, '', location.pathname);
  if (urlPin.length === 6) joinScreen(urlPin); else home();
})();
