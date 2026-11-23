// ============================================================
//  SZABLON TRYBU GRY — skopiuj ten plik, np. jako modes/moj-tryb.js
//  i dopisz w index.html (przed app.js):
//      <script src="modes/moj-tryb.js?v=1"></script>
//  Ten plik (_szablon.js) NIE jest wczytywany przez stronę.
// ============================================================
//
//  Każdy gracz gra w tryb u siebie. Strona sama:
//   - pokazuje górny pasek (nick, czas, wynik),
//   - pilnuje czasu gry,
//   - wysyła wynik do hosta (ranking na żywo).
//  Ty decydujesz tylko, CO się dzieje między pytaniami i jak liczyć punkty.
//
//  Co masz w `ctx`:
//   ctx.root            – Twój obszar gry (element HTML), wstawiaj tu co chcesz
//   await ctx.ask()     – pokazuje następne pytanie; zwraca { correct, timeMs, question }
//   ctx.addScore(n)     – dodaje punkty (może być ujemne)
//   ctx.setScore(n)     – ustawia wynik
//   ctx.getScore()      – aktualny wynik
//   ctx.toast('tekst', 'good' | 'bad') – mały dymek z informacją
//   ctx.ended           – true, gdy czas się skończył (przerwij wtedy pętlę)
//   ctx.onEnd(fn)       – fn wywoła się na koniec gry (np. zatrzymaj animacje)
//   ctx.timeLeft()      – ile ms zostało
//   ctx.leaderboard()   – top 10 graczy [{name, avatar, score}] (tylko multiplayer)
//   ctx.me              – { name, avatar } tego gracza
//   ctx.solo            – true, gdy gra solo
//   ctx.h(tag, atrybuty, ...dzieci) – szybkie tworzenie elementów HTML
//   ctx.randInt(a, b), ctx.pick(lista), ctx.shuffle(lista), await ctx.sleep(ms)
//
//  start(ctx) może zwrócić funkcję sprzątającą (wywoływana na koniec).

Q.registerMode({
  id: 'moj-tryb',            // unikalne, małe litery, bez spacji
  name: 'Mój tryb',          // nazwa na karcie
  icon: '⭐',                 // emoji
  color: '#ff7a00',          // kolor paska na karcie
  unit: 'pkt',               // jednostka wyniku (np. 'pkt', 'złota', 'm')
  author: 'Ja',              // (opcjonalnie) podpis autora
  desc: 'Krótki opis zasad, widoczny przy wyborze trybu.',

  start(ctx) {
    const h = ctx.h;
    const info = h('h2', {}, 'Odpowiadaj na pytania!');
    ctx.root.append(info);

    (async function loop() {
      while (!ctx.ended) {
        const r = await ctx.ask();
        if (r.correct) {
          ctx.addScore(100);
          ctx.toast('+100', 'good');
        } else {
          ctx.toast('Ups!', 'bad');
        }
      }
    })();
  }
});
