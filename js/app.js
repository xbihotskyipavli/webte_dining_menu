'use strict';

(function ($) {
  const STORAGE_KEY = 'obedove-menu-v1';
  const DAYS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok'];

  /* ---------- pomocné funkcie ---------- */
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const dayIndex = s => DAYS.findIndex(d => clean(s).toLowerCase().startsWith(d.toLowerCase()));
  const pad = n => String(n).padStart(2, '0');
  const spaced = d => d.replace(/\.(?=\d)/g, '. ');

  // Jednotná štruktúra jedla: rovnaká pre všetky reštaurácie
  function item(day, date, type, name, price, extra) {
    return Object.assign({ day, date: date || '', type, name: clean(name), price: clean(price), weight: '', allergens: '', notes: [] }, extra);
  }

  /* ---------- parsery (jedna funkcia = jedna reštaurácia) ---------- */

  // Eat & Meet: záložky #day-1 .. #day-5, jedlo je v .menu-body
  function parseEatAndMeet(doc) {
    const out = [];
    doc.querySelectorAll('.weak-menu > .tab-pane[id^="day-"]').forEach(pane => {
      const day = parseInt(pane.id.slice(4), 10) - 1;
      if (day < 0 || day > 4) return;
      pane.querySelectorAll('.menu-body').forEach(box => {
        const descEl = box.querySelector('.desc');
        if (!descEl) return;
        const label = clean((box.querySelector('.menu-title h4, .menu-title h5') || {}).textContent);
        const prices = clean((box.querySelector('.price') || {}).textContent).match(/\d+,\d+\s*€/g) || [];
        const allergens = clean((descEl.querySelector('span') || {}).textContent).replace(/[()]/g, '');
        const copy = descEl.cloneNode(true);
        copy.querySelectorAll('span').forEach(s => s.remove());
        const name = clean(copy.textContent);
        if (!name) return;
        const type = /^polievka/i.test(label) ? 'soup' : /sladk|múčn|šalát/i.test(label) ? 'other' : 'main';
        const tag = /^(polievka|menu)/i.test(label) ? '' : label.charAt(0) + label.slice(1).toLowerCase();
        out.push(item(day, '', type, name, prices[0], {
          allergens,
          notes: [tag, prices[1] ? 'ISIC ' + prices[1] : ''].filter(Boolean)
        }));
      });
    });
    return out;
  }

  // Riviera: odseky <p>, nadpis dňa je <strong>, názov a detail sú dva <span> za sebou
  function parseRiviera(doc) {
    const out = [], weekly = [], dates = {};
    let day = -1;
    doc.querySelectorAll('.raw-menu-content p').forEach(p => {
      const strong = p.querySelector('strong');
      const di = strong ? dayIndex(strong.textContent) : -1;
      if (di >= 0) { day = di; dates[di] = clean(p.textContent.split('|')[1]); return; }
      const spans = Array.from(p.children).filter(c => c.tagName === 'SPAN');
      spans.forEach((s, k) => {
        if (!/11pt/.test(s.getAttribute('style') || '')) return;
        const parts = clean(spans[k + 1] && spans[k + 1].textContent).split('|').map(clean);
        const price = parts.find(x => /€/.test(x)) || '';
        const weight = parts.find(x => /^\d[\d,.]*\s?(g|l)$/i.test(x)) || '';
        const al = (parts.find(x => /^A\d/.test(x)) || '').replace(/^A/, '');
        const name = clean(s.textContent);
        const target = day < 0 ? weekly : out;
        if (!price && /l$/i.test(weight)) { // polievky: viac druhov v jednom riadku
          if (/^polievka dňa$/i.test(name)) return;
          const als = al.split(' / ');
          name.split(' / ').forEach((n, j) => target.push(
            item(day, dates[day], 'soup', n, '', { weight, allergens: (als[j] || '').replace(/^A/, '') })));
        } else {
          target.push(item(day, dates[day], 'main', name.replace(/^\d+\.\s*/, ''), price, { weight, allergens: al }));
        }
      });
    });
    // týždenná ponuka platí každý deň
    weekly.forEach(w => { for (let d = 0; d < 5; d++) out.push(Object.assign({}, w, { day: d, date: dates[d] || '', notes: ['Týždenná ponuka'] })); });
    return out;
  }

  // FreeFood: jedna stránka, tri výdajne v záložkách (#free-food, #fayn-food, #fiit-food)
  function parseFreeFood(tabId) {
    return doc => {
      const out = [];
      doc.querySelectorAll('#' + tabId + ' .daily-offer > li').forEach(li => {
        const title = clean((li.querySelector('.day-title') || {}).textContent);
        const day = dayIndex(title);
        if (day < 0) return;
        const date = clean(title.split(',')[1]).replace(/\.\d{4}$/, '.');
        li.querySelectorAll('.day-offer > li').forEach(row => {
          const label = clean((row.querySelector('.brand') || {}).textContent);
          const price = clean((row.querySelector('.price') || {}).textContent).replace('.', ',').replace('€', ' €');
          const copy = row.cloneNode(true);
          copy.querySelectorAll('.brand').forEach(n => n.remove());
          let text = clean(copy.textContent);
          if (!text) return;
          if (/zatvoren/i.test(text)) { out.push(item(day, date, 'closed', text, '')); return; }
          const veg = /\(V\)/.test(text);
          text = text.replace(/\(V\)/, '');
          const allergens = (text.match(/\bA:\s*([\d,]*)/) || [])[1] || '';
          text = clean(text.replace(/\bA:\s*[\d,]*/, ''));
          const w = text.match(/\s(\d+(?:,\d+)?\s?(?:g|l)(?:,\d+g)*)$/);
          const weight = w ? w[1] : '';
          if (w) text = clean(text.slice(0, w.index));
          out.push(item(day, date, label.charAt(0) === 'P' ? 'soup' : 'main', text, price,
            { weight, allergens, notes: veg ? ['Vegetariánske'] : [] }));
        });
      });
      return out;
    };
  }

  // Zoznam reštaurácií: nová reštaurácia = nový záznam + jej parser
  const RESTAURANTS = [
    { id: 'eatmeet', name: 'Eat & Meet', address: 'Staré Grunty 36, Átriaky, blok AD-U', url: 'https://eatandmeet.sk/tyzdenne-menu', file: 'data/eatandmeet.html', parse: parseEatAndMeet },
    { id: 'riviera', name: 'Reštaurácia Riviera', address: 'Karlova Ves, Bratislava', url: 'https://restauraciariviera.sk/obedove-menu/', file: 'data/riviera.html', parse: parseRiviera },
    { id: 'ff-fiit', name: 'FreeFood FIIT STU', address: '', url: 'http://www.freefood.sk/menu/#fiit-food', file: 'data/freefood.html', parse: parseFreeFood('fiit-food') }
  ];

  /* ---------- načítanie a ukladanie ---------- */
  let state = { data: {} };
  let view = 0;
  const hidden = new Set();

  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const isFresh = rec => !!rec && rec.day === todayKey() && !rec.error;
  const readStore = () => { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return s && s.data ? s : null; } catch (e) { return null; } };
  const writeStore = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* plné úložisko */ } };

  const fetchDoc = (file, memo) => memo[file] || (memo[file] = Promise.resolve($.ajax({ url: file, dataType: 'text', cache: false }))
    .then(txt => new DOMParser().parseFromString(txt, 'text/html')));

  async function loadRestaurant(r, memo) {
    const base = { day: todayKey(), updated: new Date().toISOString() };
    let doc;
    try { doc = await fetchDoc(r.file, memo); } catch (e) {
      return Object.assign(base, { items: [], error: 'Stránku reštaurácie sa nepodarilo načítať.' });
    }
    let items = [];
    try { items = r.parse(doc); } catch (e) { items = []; }
    if (!items.length) return Object.assign(base, { items: [], error: 'Štruktúra stránky sa zmenila, menu sa nepodarilo spracovať.' });
    return Object.assign(base, { items, error: '' });
  }

  async function refresh(force) {
    const todo = RESTAURANTS.filter(r => force || !isFresh(state.data[r.id]));
    if (!todo.length) return;
    setLoading(true);
    const memo = {};
    const results = await Promise.all(todo.map(r => loadRestaurant(r, memo)));
    results.forEach((rec, i) => { state.data[todo[i].id] = rec; });
    writeStore();
    setLoading(false);
    render();
  }

  function setLoading(on) {
    $('#loader').toggleClass('d-none', !on);
    $('#btnUpdate, #btnClear').prop('disabled', on);
  }
  const notice = t => $('#notice').text(t || '').toggleClass('d-none', !t);

  /* ---------- vykresľovanie (bez innerHTML, len textContent) ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const fmt = iso => new Date(iso).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' });

  function timeEl(date) {
    const m = /(\d{1,2})\.\s*(\d{1,2})\./.exec(date || '');
    if (!m) return null;
    const t = el('time', 'day-date', spaced(date));
    t.dateTime = new Date().getFullYear() + '-' + pad(m[2]) + '-' + pad(m[1]);
    return t;
  }

  function dish(i) {
    const li = el('li', 'dish');
    const top = el('div', 'dish-top');
    top.append(el('span', 'dish-name', i.name));
    if (i.price) top.append(el('span', 'price', i.price));
    li.append(top);
    const meta = el('div', 'dish-meta');
    i.notes.forEach(n => meta.append(el('span', 'tag', n)));
    if (i.weight) meta.append(el('span', null, i.weight));
    if (i.allergens) meta.append(el('span', null, 'Alergény: ' + i.allergens));
    if (meta.childNodes.length) li.append(meta);
    return li;
  }

  function daySection(items, d, inWeek) {
    const s = el('section', 'day-block');
    if (inWeek) {
      const h = el('h3', 'day-title', DAYS[d]);
      const t = timeEl((items[0] || {}).date);
      if (t) h.append(t);
      s.append(h);
    }
    const real = items.filter(i => i.type !== 'closed');
    if (!real.length) {
      s.append(el('p', 'empty', items.length ? 'Reštaurácia je v tento deň zatvorená.' : 'Menu na tento deň nie je k dispozícii.'));
      return s;
    }
    [['soup', 'Polievky'], ['main', 'Hlavné jedlá'], ['other', 'Dezerty a šaláty']].forEach(([type, label]) => {
      const group = real.filter(i => i.type === type);
      if (!group.length) return;
      s.append(el(inWeek ? 'h4' : 'h3', 'group-title', label));
      const ul = el('ul', 'dishes ' + type);
      group.forEach(i => ul.append(dish(i)));
      s.append(ul);
    });
    return s;
  }

  function card(r, days) {
    const rec = state.data[r.id];
    const col = el('div', days.length > 1 ? 'col-12 col-lg-6' : 'col-12 col-md-6 col-xl-4');
    const art = el('article', 'resto-card');
    const head = el('header', 'resto-head');
    const h = el('h2', 'resto-name');
    const a = el('a', null, r.name);
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    h.append(a);
    head.append(h);
    if (r.address) head.append(el('p', 'resto-meta', r.address));
    head.append(el('p', 'resto-meta', rec ? 'Aktualizované: ' + fmt(rec.updated) : 'Menu zatiaľ nie je načítané'));
    const body = el('div', 'resto-body');
    if (!rec) body.append(el('p', 'empty', 'Kliknite na „Aktualizovať menu“.'));
    else if (rec.error) body.append(el('p', 'empty error', rec.error));
    else days.forEach(d => body.append(daySection(rec.items.filter(i => i.day === d), d, days.length > 1)));
    art.append(head, body);
    col.append(art);
    return col;
  }

  function dateOf(d) {
    for (const id in state.data) {
      const it = (state.data[id].items || []).find(i => i.day === d && i.date);
      if (it) return spaced(it.date);
    }
    return '';
  }

  function render() {
    const days = view === 'all' ? [0, 1, 2, 3, 4] : [view];
    $('#dayHeading').text(view === 'all' ? 'Celý týždeň' : (DAYS[view] + ' ' + dateOf(view)).trim());
    const $menu = $('#menu').empty();
    const shown = RESTAURANTS.filter(r => !hidden.has(r.id));
    if (!shown.length) { $menu.append($('<p class="empty">').text('Nie je vybraná žiadna reštaurácia.')); return; }
    shown.forEach(r => $menu.append(card(r, days)));
  }

  function markActive() {
    $('#dayTabs button').each(function () {
      const on = $(this).data('day') === view;
      $(this).toggleClass('active', on).attr('aria-pressed', on);
    });
  }

  /* ---------- štart ---------- */
  $(function () {
    RESTAURANTS.forEach(r => {
      const id = 'f-' + r.id;
      $('#filters').append(
        $('<input>', { type: 'checkbox', 'class': 'btn-check', id, checked: true, autocomplete: 'off' })
          .on('change', function () { if (this.checked) hidden.delete(r.id); else hidden.add(r.id); render(); }),
        $('<label>', { 'class': 'btn btn-chip', 'for': id, text: r.name }));
    });

    $('#dayTabs button').on('click', function () { view = $(this).data('day'); markActive(); render(); });
    $('#btnUpdate').on('click', () => { notice(''); refresh(true); });
    $('#btnClear').on('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* nič */ }
      state = { data: {} };
      notice('Uložené dáta sú vymazané. Kliknutím na „Aktualizovať menu“ ich načítate znova.');
      render();
    });

    const stored = readStore();
    if (stored) state = stored;
    const dow = new Date().getDay(); // 0 = nedeľa, 6 = sobota
    if (dow === 0 || dow === 6) {
      view = 0;
      notice('Cez víkend menu nie je k dispozícii, zobrazuje sa pondelok.');
    } else {
      view = dow - 1;
    }
    markActive();
    render();
    refresh(false);
  });
})(jQuery);
