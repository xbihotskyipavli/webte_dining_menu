# Obedové menu v okolí FEI STU

Zadanie č. 2 z predmetu WEBTE1 (ZS 2026/2027)
Autor: Serhii Bihotskyi

Stránka zobrazuje denné menu reštaurácií a jedální v okolí FEI STU. Všetko beží na strane klienta (HTML, CSS, JavaScript).

## Reštaurácie

| Zdroj | Výdajne na stránke |
|---|---|
| Eat & Meet | Eat & Meet |
| Reštaurácia Riviera | Riviera |
| FreeFood | Matika, Fyzika, FIIT STU |

Každý zdroj má inú štruktúru HTML, preto má vlastný parser v `js/app.js` (`parseEatAndMeet`, `parseRiviera`, `parseFreeFood`). Nová reštaurácia sa pridá novým záznamom v poli `RESTAURANTS` a vlastnou parsovacou funkciou, ktorá vráti jednotné objekty.

## Spustenie

Stránky reštaurácií sa načítavajú cez AJAX z lokálnych kópií v priečinku `data/`, takže stránku treba otvoriť cez HTTP server, nie priamo zo súboru (`file://` AJAX blokuje):

```
python3 -m http.server 8000
```

Potom otvorte `http://localhost:8000/`. Na školskom serveri stačí nahrať obsah archívu.

V priečinku `data/` musia byť kópie stránok: `eatandmeet.html`, `riviera.html`, `freefood.html`.

## Štruktúra

```
index.html        hlavná stránka s menu
o-projekte.html   o projekte + formulár „Napíšte nám“
css/style.css     vzhľad, @font-face
js/app.js         načítanie, parsery, localStorage, vykresľovanie
js/form.js        formulár
data/             lokálne kópie stránok reštaurácií
lib/              Bootstrap, jQuery
fonts/            Poppins (woff2) + licencia
docs/             výpisy z validátorov
```

## Spracovanie dát

1. jQuery AJAX načíta HTML kópiu stránky.
2. `DOMParser` vytvorí DOM, údaje sa hľadajú cez `querySelector` / `querySelectorAll`.
3. Každý parser vráti pole objektov `{day, date, type, name, price, weight, allergens, notes}`.
4. Výsledok sa uloží do `localStorage`. Ak sú uložené dáta z dnešného dňa, stránky sa nenačítavajú znova.
5. Cudzí HTML sa do stránky nevkladá, vykresľujú sa iba vybrané údaje cez `textContent`.
6. Chyba pri jednej reštaurácii sa zobrazí len v jej bloku.

## Použité knižnice a licencie

- Bootstrap 5.3.3, licencia MIT
- jQuery 3.7.1, licencia MIT
- Písmo Poppins, licencia SIL Open Font License 1.1 (`fonts/LICENSE-Poppins-OFL.txt`), získané cez balík Fontsource

## Použitie AI

Pri vypracovaní bol použitý AI nástroj Claude (Anthropic): návrh štruktúry projektu, parsery, JavaScript, CSS a šablóny stránok. Autor kód skontroloval, otestoval a vie ho vysvetliť.
