// Quizy wbudowane + zapisywanie własnych quizów (localStorage tej przeglądarki).
// Format pytania: { q: 'treść', a: ['odp1','odp2','odp3','odp4'], c: indeksPoprawnej (0-3) }
(function () {
  'use strict';
  const KEY = 'qzl_quizzes_v1';

  const builtin = [
    {
      id: 'b-stolice', emoji: '🌍', title: 'Stolice Europy', builtin: true,
      questions: [
        { q: 'Stolica Francji to…', a: ['Paryż', 'Lyon', 'Marsylia', 'Nicea'], c: 0 },
        { q: 'Stolica Niemiec to…', a: ['Monachium', 'Berlin', 'Hamburg', 'Frankfurt'], c: 1 },
        { q: 'Stolica Włoch to…', a: ['Mediolan', 'Wenecja', 'Rzym', 'Neapol'], c: 2 },
        { q: 'Stolica Hiszpanii to…', a: ['Barcelona', 'Sewilla', 'Walencja', 'Madryt'], c: 3 },
        { q: 'Stolica Czech to…', a: ['Praga', 'Brno', 'Ostrawa', 'Pilzno'], c: 0 },
        { q: 'Stolica Ukrainy to…', a: ['Lwów', 'Kijów', 'Odessa', 'Charków'], c: 1 },
        { q: 'Stolica Portugalii to…', a: ['Porto', 'Faro', 'Lizbona', 'Braga'], c: 2 },
        { q: 'Stolica Norwegii to…', a: ['Bergen', 'Oslo', 'Trondheim', 'Stavanger'], c: 1 },
        { q: 'Stolica Węgier to…', a: ['Debreczyn', 'Budapeszt', 'Segedyn', 'Pecz'], c: 1 },
        { q: 'Stolica Litwy to…', a: ['Kowno', 'Kłajpeda', 'Wilno', 'Szawle'], c: 2 },
        { q: 'Stolica Grecji to…', a: ['Saloniki', 'Ateny', 'Patras', 'Heraklion'], c: 1 },
        { q: 'Stolica Szwecji to…', a: ['Göteborg', 'Malmö', 'Uppsala', 'Sztokholm'], c: 3 }
      ]
    },
    {
      id: 'b-mnozenie', emoji: '✖️', title: 'Tabliczka mnożenia', builtin: true,
      questions: (function () {
        const out = [];
        const pairs = [[6, 7], [8, 9], [7, 7], [6, 8], [9, 9], [4, 7], [8, 8], [3, 9], [7, 9], [6, 6], [5, 8], [4, 9], [7, 8], [6, 9], [3, 7]];
        for (const [x, y] of pairs) {
          const r = x * y;
          const wrong = new Set();
          for (const d of [x, -x, y, -y, 1, -1, 2, 10]) { if (wrong.size >= 3) break; const w = r + d; if (w > 0 && w !== r) wrong.add(w); }
          const a = [r, ...wrong].slice(0, 4).map(String);
          out.push({ q: x + ' × ' + y + ' = ?', a, c: 0 });
        }
        return out;
      })()
    },
    {
      id: 'b-mix', emoji: '🧪', title: 'Pokaz typów pytań', builtin: true,
      desc: 'Po trochu z każdego typu: wybór, kilka odpowiedzi, prawda/fałsz, wpisywanie i kolejność.',
      questions: [
        { type: 'choice', q: 'Ile dni ma tydzień?', a: ['5', '6', '7', '8'], c: 2 },
        { type: 'multi', q: 'Które z tych zwierząt to ssaki?', a: ['Delfin', 'Rekin', 'Nietoperz', 'Pingwin'], cs: [0, 2] },
        { type: 'tf', q: 'Słońce jest gwiazdą.', c: 0 },
        { type: 'tf', q: 'Pająk ma 6 nóg.', c: 1 },
        { type: 'input', q: 'Jak nazywa się stolica Polski?', accept: ['Warszawa'] },
        { type: 'input', q: 'Ile to 12 × 12?', accept: ['144'] },
        { type: 'order', q: 'Ułóż planety od najbliższej Słońcu:', items: ['Merkury', 'Wenus', 'Ziemia', 'Mars'] },
        { type: 'order', q: 'Ułóż liczby od najmniejszej:', items: ['0,05', '0,5', '5', '50'] }
      ]
    },
    {
      id: 'b-ogolna', emoji: '🧠', title: 'Wiedza ogólna', builtin: true,
      questions: [
        { q: 'Ile nóg ma pająk?', a: ['6', '8', '10', '4'], c: 1 },
        { q: 'Największa planeta Układu Słonecznego to…', a: ['Saturn', 'Ziemia', 'Jowisz', 'Neptun'], c: 2 },
        { q: 'Najdłuższa rzeka w Polsce to…', a: ['Odra', 'Warta', 'Wisła', 'Bug'], c: 2 },
        { q: 'Ile minut ma godzina?', a: ['60', '100', '30', '90'], c: 0 },
        { q: 'Kto napisał „Pana Tadeusza”?', a: ['Juliusz Słowacki', 'Adam Mickiewicz', 'Henryk Sienkiewicz', 'Bolesław Prus'], c: 1 },
        { q: 'Woda zamarza w temperaturze…', a: ['0°C', '10°C', '-10°C', '100°C'], c: 0 },
        { q: 'Najwyższy szczyt Polski to…', a: ['Śnieżka', 'Giewont', 'Kasprowy Wierch', 'Rysy'], c: 3 },
        { q: 'Ile kontynentów jest na Ziemi?', a: ['5', '6', '7', '8'], c: 2 },
        { q: 'Który gaz jest nam potrzebny do oddychania?', a: ['Tlen', 'Hel', 'Azot', 'Wodór'], c: 0 },
        { q: 'Ile boków ma sześciokąt?', a: ['5', '6', '7', '8'], c: 1 },
        { q: 'Stolicą Polski jest…', a: ['Kraków', 'Gdańsk', 'Warszawa', 'Poznań'], c: 2 },
        { q: 'Które zwierzę jest ssakiem?', a: ['Rekin', 'Delfin', 'Pingwin', 'Żółw'], c: 1 }
      ]
    }
  ];

  function loadOwn() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function saveOwn(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { alert('Nie udało się zapisać quizu w tej przeglądarce.'); return false; }
  }

  Q.quizzes = {
    builtin,
    loadOwn,
    saveOwn,
    all: () => loadOwn().concat(builtin)
  };
})();
