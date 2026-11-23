// Tryb gry: Klasyk — szybkie odpowiedzi + seria (combo).
Q.registerMode({
  id: 'klasyk',
  name: 'Klasyk',
  icon: '🎯',
  color: '#ff7a00',
  unit: 'pkt',
  desc: 'Odpowiadaj szybko i bez błędów. Szybkość i seria dobrych odpowiedzi dają bonus.',
  start(ctx) {
    const h = ctx.h;
    let streak = 0, best = 0;
    const streakEl = h('b', {}, '0');
    const bestEl = h('b', {}, '0');
    ctx.root.append(h('div', { class: 'center-box' },
      h('div', { class: 'big-emoji' }, '🎯'),
      h('p', {}, '🔥 Seria: ', streakEl, ' · Najlepsza: ', bestEl)));

    (async function loop() {
      while (!ctx.ended) {
        const r = await ctx.ask();
        if (r.correct) {
          streak++;
          best = Math.max(best, streak);
          const speed = Math.max(0, 1 - r.timeMs / 15000);           // 1 = natychmiast, 0 = po 15 s
          const combo = 1 + Math.min(streak - 1, 5) * 0.1;            // do +50% za serię
          const pts = Math.round((500 + 500 * speed) * combo);
          ctx.addScore(pts);
          ctx.toast('+' + pts + (streak > 1 ? '  🔥x' + streak : ''), 'good');
        } else {
          if (streak >= 3) ctx.toast('Seria przerwana 💔', 'bad');
          streak = 0;
        }
        streakEl.textContent = streak;
        bestEl.textContent = best;
      }
    })();
  }
});
