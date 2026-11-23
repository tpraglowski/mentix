// MENTIX — typy pytań. Każdy typ ma: edytor (kreator), wygląd w grze, sprawdzanie i podgląd.
// Pytanie bez pola `type` to zwykłe 'choice' (jedna poprawna).
(function () {
  'use strict';
  const h = Q.h;
  const S = v => String(v == null ? '' : v).trim();
  // porównywanie wpisanych odpowiedzi: bez wielkości liter, polskich znaków, kropki na końcu i podwójnych spacji
  const norm = t => S(t).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?;:]+$/, '').replace(/\s+/g, ' ').trim();

  const types = [];
  const add = t => types.push(t);
  const get = id => types.find(t => t.id === id) || types[0];
  const typeOf = q => get(q && q.type);

  function choiceGrid(labels, onPick, cls) {
    const grid = h('div', { class: 'q-answers n' + labels.length + (cls ? ' ' + cls : '') });
    labels.forEach((txt, k) => grid.append(h('button', { class: 'q-ans c' + k, onclick: () => onPick(k) },
      h('span', { class: 'q-key' }, String(k + 1)), txt)));
    return grid;
  }
  const answersFrom = x => [0, 1, 2, 3].map(k => S((x.a || [])[k]));
  const rowBtn = (label, title, fn, dis) => h('button', { class: 'mini', title, onclick: fn, disabled: !!dis }, label);

  // ---------- 1. Jedna poprawna ----------
  add({
    id: 'choice', name: 'Jedna poprawna', icon: '🔘', desc: '2–4 odpowiedzi, jedna dobra',
    blank: () => ({ type: 'choice', q: '', a: ['', '', '', ''], c: 0 }),
    clean(x) {
      const a = answersFrom(x), c = Math.max(0, Math.min(3, Number(x.c) || 0));
      if (a.filter(Boolean).length < 2) return 'musi mieć co najmniej 2 odpowiedzi';
      if (!a[c]) return 'zaznaczona poprawna odpowiedź jest pusta';
      return { type: 'choice', q: S(x.q), a, c };
    },
    answer: q => q.a[q.c],
    play(q, api) {
      const order = Q.shuffle(q.a.map((_, i) => i).filter(i => S(q.a[i])));
      let grid;
      const pick = k => {
        if (!api.lock()) return;
        const ok = order[k] === q.c;
        grid.classList.add('answered');
        grid.children[k].classList.add(ok ? 'right' : 'wrong');
        const ck = order.indexOf(q.c);
        if (!ok && ck >= 0) grid.children[ck].classList.add('right');
        api.done(ok);
      };
      grid = choiceGrid(order.map(i => q.a[i]), pick);
      return { el: grid, key: e => { const k = Number(e.key) - 1; if (k >= 0 && k < order.length) pick(k); } };
    },
    edit(q, redraw) {
      const group = 'g' + Math.random().toString(36).slice(2);
      return h('div', {},
        h('div', { class: 'a-edit-grid' }, [0, 1, 2, 3].map(k => h('label', { class: 'a-edit c' + k + (q.c === k ? ' correct' : '') },
          h('input', { type: 'radio', name: group, checked: q.c === k, title: 'Poprawna odpowiedź', onchange: () => { q.c = k; redraw(); } }),
          h('input', { type: 'text', maxlength: '80', placeholder: 'Odpowiedź ' + (k + 1) + (k < 2 ? '' : ' (opcjonalna)'), value: q.a[k] || '', oninput: e => { q.a[k] = e.target.value; } })))),
        h('p', { class: 'hint' }, 'Zaznacz kółkiem poprawną odpowiedź.'));
    },
    preview: q => q.a.map((t, i) => S(t) ? h('span', { class: i === q.c ? 'right' : '' }, t) : null)
  });

  // ---------- 2. Kilka poprawnych ----------
  add({
    id: 'multi', name: 'Kilka poprawnych', icon: '☑️', desc: 'zaznacz wszystkie dobre',
    blank: () => ({ type: 'multi', q: '', a: ['', '', '', ''], cs: [] }),
    clean(x) {
      const a = answersFrom(x);
      const cs = [...new Set((x.cs || []).map(Number))].filter(i => i >= 0 && i < 4 && a[i]).sort();
      if (a.filter(Boolean).length < 2) return 'musi mieć co najmniej 2 odpowiedzi';
      if (!cs.length) return 'zaznacz co najmniej jedną poprawną odpowiedź';
      return { type: 'multi', q: S(x.q), a, cs };
    },
    answer: q => q.cs.map(i => q.a[i]).join(', '),
    play(q, api) {
      const order = Q.shuffle(q.a.map((_, i) => i).filter(i => S(q.a[i])));
      const sel = new Set();
      const grid = choiceGrid(order.map(i => q.a[i]), k => {
        if (api.isDone()) return;
        if (sel.has(k)) sel.delete(k); else sel.add(k);
        grid.children[k].classList.toggle('sel', sel.has(k));
        check.disabled = !sel.size;
      }, 'multi');
      const check = h('button', { class: 'btn big q-check', disabled: true, onclick: () => {
        if (!sel.size || !api.lock()) return;
        const picked = [...sel].map(k => order[k]).sort();
        const ok = picked.length === q.cs.length && picked.every((v, i) => v === q.cs[i]);
        grid.classList.add('answered');
        order.forEach((ai, k) => {
          const good = q.cs.includes(ai);
          if (good) grid.children[k].classList.add('right');
          else if (sel.has(k)) grid.children[k].classList.add('wrong');
        });
        api.done(ok);
      } }, 'Sprawdź ✔');
      return {
        el: h('div', {}, h('p', { class: 'q-tip' }, 'Zaznacz wszystkie poprawne odpowiedzi'), grid, check),
        key: e => { const k = Number(e.key) - 1; if (k >= 0 && k < order.length) grid.children[k].click(); else if (e.key === 'Enter') check.click(); }
      };
    },
    edit(q, redraw) {
      return h('div', {},
        h('div', { class: 'a-edit-grid' }, [0, 1, 2, 3].map(k => h('label', { class: 'a-edit c' + k + (q.cs.includes(k) ? ' correct' : '') },
          h('input', { type: 'checkbox', checked: q.cs.includes(k), title: 'Poprawna odpowiedź', onchange: e => {
            q.cs = q.cs.filter(i => i !== k); if (e.target.checked) q.cs.push(k); redraw();
          } }),
          h('input', { type: 'text', maxlength: '80', placeholder: 'Odpowiedź ' + (k + 1) + (k < 2 ? '' : ' (opcjonalna)'), value: q.a[k] || '', oninput: e => { q.a[k] = e.target.value; } })))),
        h('p', { class: 'hint' }, 'Zaznacz kwadracikiem wszystkie poprawne odpowiedzi.'));
    },
    preview: q => q.a.map((t, i) => S(t) ? h('span', { class: q.cs.includes(i) ? 'right' : '' }, t) : null)
  });

  // ---------- 3. Prawda / fałsz ----------
  const TF = ['Prawda', 'Fałsz'];
  add({
    id: 'tf', name: 'Prawda / fałsz', icon: '⚖️', desc: 'czy zdanie jest prawdziwe?',
    blank: () => ({ type: 'tf', q: '', c: 0 }),
    clean: x => ({ type: 'tf', q: S(x.q), c: Number(x.c) === 1 ? 1 : 0 }),
    answer: q => TF[q.c],
    play(q, api) {
      let grid;
      const pick = k => {
        if (!api.lock()) return;
        const ok = k === q.c;
        grid.classList.add('answered');
        grid.children[k].classList.add(ok ? 'right' : 'wrong');
        if (!ok) grid.children[q.c].classList.add('right');
        api.done(ok);
      };
      grid = choiceGrid(TF, pick, 'tf');
      return { el: grid, key: e => { if (e.key === '1' || e.key === '2') pick(Number(e.key) - 1); } };
    },
    edit(q, redraw) {
      return h('div', {},
        h('div', { class: 'tf-edit' }, TF.map((t, k) => h('button', { class: 'tf-opt' + (q.c === k ? ' on' : ''), onclick: () => { q.c = k; redraw(); } }, (k ? '✘ ' : '✔ ') + t))),
        h('p', { class: 'hint' }, 'Wpisz zdanie i wybierz, czy jest prawdziwe.'));
    },
    preview: q => TF.map((t, i) => h('span', { class: i === q.c ? 'right' : '' }, t))
  });

  // ---------- 4. Wpisywanie ----------
  add({
    id: 'input', name: 'Wpisywanie', icon: '⌨️', desc: 'gracz sam wpisuje odpowiedź',
    blank: () => ({ type: 'input', q: '', accept: [''] }),
    clean(x) {
      const accept = [...new Set((x.accept || []).map(S).filter(Boolean))].slice(0, 6);
      if (!accept.length) return 'wpisz co najmniej jedną poprawną odpowiedź';
      return { type: 'input', q: S(x.q), accept };
    },
    answer: q => q.accept[0],
    play(q, api) {
      const inp = h('input', { class: 'q-input', type: 'text', maxlength: '80', placeholder: 'Wpisz odpowiedź…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const submit = () => {
        if (!S(inp.value)) { inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.focus(); return; }
        if (!api.lock()) return;
        const ok = q.accept.some(a => norm(a) === norm(inp.value));
        inp.disabled = true;
        inp.classList.add(ok ? 'right' : 'wrong');
        api.done(ok);
      };
      inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
      setTimeout(() => inp.focus(), 30);
      return { el: h('div', { class: 'q-input-row' }, inp, h('button', { class: 'btn big', onclick: submit }, 'Sprawdź ✔')) };
    },
    edit(q, redraw) {
      return h('div', {},
        h('p', { class: 'label' }, 'Poprawne odpowiedzi:'),
        h('div', { class: 'list-edit' }, q.accept.map((t, i) => h('div', { class: 'list-row' },
          h('span', { class: 'list-no ok' }, '✔'),
          h('input', { type: 'text', maxlength: '80', placeholder: i ? 'Inna poprawna wersja (opcjonalnie)' : 'Poprawna odpowiedź', value: t, oninput: e => { q.accept[i] = e.target.value; } }),
          q.accept.length > 1 ? rowBtn('✕', 'Usuń', () => { q.accept.splice(i, 1); redraw(); }) : null))),
        q.accept.length < 6 ? h('button', { class: 'link-btn', onclick: () => { q.accept.push(''); redraw(); } }, '+ Dodaj inną poprawną wersję') : null,
        h('p', { class: 'hint' }, 'Wielkość liter, polskie znaki i kropka na końcu nie mają znaczenia.'));
    },
    preview: q => q.accept.map(t => h('span', { class: 'right' }, t))
  });

  // ---------- 5. Ustawianie kolejności ----------
  add({
    id: 'order', name: 'Ustaw kolejność', icon: '🔢', desc: 'ułóż elementy po kolei',
    blank: () => ({ type: 'order', q: '', items: ['', '', ''] }),
    clean(x) {
      const items = (x.items || []).map(S).filter(Boolean).slice(0, 6);
      if (items.length < 2) return 'musi mieć co najmniej 2 elementy do ułożenia';
      return { type: 'order', q: S(x.q), items };
    },
    answer: q => q.items.join(' → '),
    play(q, api) {
      const n = q.items.length;
      let mix = Q.shuffle(q.items.map((_, i) => i));
      if (n > 1) while (mix.every((v, i) => v === i)) mix = Q.shuffle(mix);
      const picked = [];
      const slots = h('div', { class: 'ord-slots' });
      const pool = h('div', { class: 'ord-pool' });
      const check = h('button', { class: 'btn big q-check', disabled: true, onclick: () => {
        if (picked.length !== n || !api.lock()) return;
        const ok = picked.every((v, i) => v === i);
        [...slots.children].forEach((el, i) => el.classList.add(picked[i] === i ? 'right' : 'wrong'));
        api.done(ok);
      } }, 'Sprawdź ✔');
      function draw() {
        slots.replaceChildren(...q.items.map((_, i) => picked[i] != null
          ? h('button', { class: 'ord-slot full', title: 'Kliknij, żeby cofnąć', onclick: () => { if (api.isDone()) return; picked.splice(i, 1); draw(); } },
            h('span', { class: 'ord-no' }, i + 1), q.items[picked[i]])
          : h('div', { class: 'ord-slot' }, h('span', { class: 'ord-no' }, i + 1))));
        pool.replaceChildren(...mix.filter(ix => !picked.includes(ix)).map(ix =>
          h('button', { class: 'ord-item', onclick: () => { if (api.isDone()) return; picked.push(ix); draw(); } }, q.items[ix])));
        check.disabled = picked.length !== n;
      }
      draw();
      return { el: h('div', {}, h('p', { class: 'q-tip' }, 'Klikaj elementy w dobrej kolejności (kliknij ułożony, żeby go cofnąć)'), slots, pool, check) };
    },
    edit(q, redraw) {
      const n = q.items.length;
      return h('div', {},
        h('p', { class: 'label' }, 'Elementy w POPRAWNEJ kolejności:'),
        h('div', { class: 'list-edit' }, q.items.map((t, i) => h('div', { class: 'list-row' },
          h('span', { class: 'list-no' }, i + 1),
          h('input', { type: 'text', maxlength: '60', placeholder: 'Element ' + (i + 1), value: t, oninput: e => { q.items[i] = e.target.value; } }),
          rowBtn('↑', 'W górę', () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; redraw(); }, i === 0),
          rowBtn('↓', 'W dół', () => { [q.items[i + 1], q.items[i]] = [q.items[i], q.items[i + 1]]; redraw(); }, i === n - 1),
          n > 2 ? rowBtn('✕', 'Usuń', () => { q.items.splice(i, 1); redraw(); }) : null))),
        n < 6 ? h('button', { class: 'link-btn', onclick: () => { q.items.push(''); redraw(); } }, '+ Dodaj element') : null,
        h('p', { class: 'hint' }, 'Gracze dostaną te elementy pomieszane i muszą je ułożyć.'));
    },
    preview: q => q.items.map((t, i) => h('span', { class: 'right' }, (i + 1) + '. ' + t))
  });

  // zamiana typu w kreatorze — zachowujemy treść i (gdzie się da) odpowiedzi
  function convert(q, newType) {
    const nq = get(newType).blank();
    nq.q = q.q || '';
    const texts = (q.a || q.items || q.accept || []).map(S).filter(Boolean);
    if (nq.a) { texts.slice(0, 4).forEach((t, i) => { nq.a[i] = t; }); if (newType === 'multi' && q.type !== 'tf' && q.c != null && nq.a[q.c]) nq.cs = [q.c]; if (newType === 'choice' && q.cs && q.cs.length) nq.c = q.cs[0]; else if (newType === 'choice' && q.c != null && q.type !== 'tf') nq.c = q.c; }
    if (nq.items && texts.length) { nq.items = texts.slice(0, 6); while (nq.items.length < 2) nq.items.push(''); }
    if (nq.accept) {
      const first = q.type === 'choice' || !q.type ? S((q.a || [])[q.c]) : q.type === 'multi' ? S((q.a || [])[(q.cs || [])[0]]) : texts[0];
      nq.accept = [first || ''];
    }
    return nq;
  }

  const isEmpty = q => !S(q.q) && ![...(q.a || []), ...(q.accept || []), ...(q.items || [])].some(v => S(v));

  // sprawdza / czyści pytanie z dowolnego źródła (np. import); zwraca obiekt albo tekst błędu
  function clean(x) {
    if (!x || typeof x !== 'object') return 'zły format';
    if (!S(x.q)) return 'brak treści pytania';
    return get(x.type).clean(x);
  }

  Q.qtypes = { list: types, get, typeOf, clean, convert, isEmpty, norm };
})();
