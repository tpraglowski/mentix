// Tryb gry: Złote Skrzynie — dobra odpowiedź = wybierasz 1 z 3 skrzyń.
Q.registerMode({
  id: 'skrzynie',
  name: 'Złote Skrzynie',
  icon: '🎁',
  color: '#f2b705',
  unit: 'złota',
  desc: 'Za dobrą odpowiedź otwierasz skrzynię. Może być złoto, x2… albo pułapka!',
  start(ctx) {
    const h = ctx.h;
    const stage = h('div', { class: 'sk-stage' });
    ctx.root.append(stage);

    // losowanie zawartości skrzyni (szanse w %)
    function roll() {
      const x = Math.random() * 100;
      if (x < 36) { const v = ctx.randInt(10, 50); return { icon: '🪙', label: '+' + v, good: true, apply: s => s + v }; }
      if (x < 52) return { icon: '💰', label: '+100', good: true, apply: s => s + 100 };
      if (x < 62) return { icon: '✨', label: 'x2', good: true, apply: s => s * 2 };
      if (x < 67) return { icon: '👑', label: '+300', good: true, apply: s => s + 300 };
      if (x < 82) return { icon: '💀', label: '-25%', good: false, apply: s => Math.floor(s * 0.75) };
      return { icon: '🕸️', label: 'Pusto', good: false, apply: s => s };
    }

    function chooseChest() {
      return new Promise(resolve => {
        const outs = [roll(), roll(), roll()];
        let chosen = false;
        const row = h('div', { class: 'sk-row' });
        outs.forEach((o, i) => {
          const b = h('button', { class: 'sk-chest', onclick: () => {
            if (chosen || ctx.ended) return;
            chosen = true;
            [...row.children].forEach((el, k) => {
              el.disabled = true;
              el.replaceChildren(h('span', { class: 'sk-icon' }, outs[k].icon), h('span', { class: 'sk-label' }, outs[k].label));
              el.classList.add(k === i ? 'picked' : 'other', outs[k].good ? 'good' : 'bad');
            });
            ctx.setScore(o.apply(ctx.getScore()));
            ctx.toast(o.icon + ' ' + o.label, o.good ? 'good' : 'bad');
            setTimeout(resolve, 1300);
          } }, h('span', { class: 'sk-icon' }, '🎁'));
          row.append(b);
        });
        stage.replaceChildren(h('h2', {}, 'Wybierz skrzynię!'), row);
      });
    }

    (async function loop() {
      while (!ctx.ended) {
        stage.replaceChildren(h('div', { class: 'big-emoji' }, '🎁'));
        const r = await ctx.ask();
        if (ctx.ended) return;
        if (r.correct) await chooseChest();
        else { stage.replaceChildren(h('h2', {}, '🔒 Brak skrzyni — spróbuj następne pytanie')); await ctx.sleep(700); }
      }
    })();
  }
});
