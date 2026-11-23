# 🍊 Quizolandia

Strona z quizami i trybami gry. Host wybiera quiz i tryb, gracze dołączają kodem PIN
(połączenie przeglądarka–przeglądarka przez PeerJS / WebRTC, bez własnego serwera).

## Jak dodać własny tryb gry
1. Skopiuj `modes/_szablon.js` jako np. `modes/moj-tryb.js`.
2. Zmień `id`, `name`, `icon`, `desc` i logikę w `start(ctx)` (opis `ctx` jest w szablonie).
3. Dopisz w `index.html` (w sekcji TRYBY GRY): `<script src="modes/moj-tryb.js?v=1"></script>`.

## Pliki
- `app.js` – ekrany, host/gracz, rozgrywka
- `core.js` – narzędzia + `Q.registerMode`
- `quizzes.js` – quizy wbudowane i zapisywanie własnych (localStorage)
- `modes/` – tryby gry
