// Smoke-тест Alpine-стора и шаблонов через jsdom (без htmx/сервера).
// Запуск: NODE_PATH=<tmp>/node_modules node tools/smoke-ui.cjs
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ROOT = join(__dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const primes = JSON.parse(read('data/primes.json'));

const catalog = read('partials/catalog.html');
const dom = new JSDOM(
  `<!DOCTYPE html><html><body><main id="main">${catalog}</main></body></html>`,
  { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true }
);
const { window } = dom;

// глобалы для Alpine
global.window = window;
global.document = window.document;
global.MutationObserver = window.MutationObserver;
global.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
global.navigator = window.navigator;
global.customElements = window.customElements;
// конструкторы событий должны быть из реалма jsdom, иначе dispatchEvent ругается
for (const k of ['CustomEvent', 'Event', 'Node', 'Element', 'ShadowRoot', 'HTMLElement', 'DocumentFragment', 'getComputedStyle', 'HTMLTemplateElement']) {
  global[k] = window[k];
}

// стаб fetch -> локальный primes.json
window.fetch = global.fetch = async () => ({ ok: true, status: 200, json: async () => primes });

// грузим наш код в контекст окна
window.eval(read('js/calc.js'));
window.eval(read('js/store.js'));

// Alpine
let Alpine = require('alpinejs');
Alpine = Alpine.default || Alpine;
window.Alpine = Alpine;
Alpine.start();

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

(async () => {
  // ждём fetch + флаш реактивности
  await new Promise((r) => setTimeout(r, 200));
  const store = Alpine.store('wf');

  ok(store.loaded === true, 'store loaded data');
  ok(!store.error, 'no load error (' + (store.error || 'ok') + ')');
  ok(store.data.items.length === primes.items.length, `store has ${primes.items.length} items`);
  ok(store.filteredItems().length === primes.items.length, 'filteredItems returns all by default');

  // фильтр по категории
  store.itemCat = 'Warframe';
  const wfCount = primes.items.filter((i) => i.category === 'Warframe').length;
  ok(store.filteredItems().length === wfCount, `category filter Warframe -> ${wfCount}`);
  store.itemCat = 'all';

  // выбор детали + оптимизатор
  const part = primes.items[0].parts[0].name;
  store.toggle(part);
  ok(store.isSel(part), 'toggle selects a part');
  ok(store.selCount === 1, 'selCount = 1');
  const ranked = store.ranked;
  ok(ranked.length > 0, `ranked relics for selected part = ${ranked.length}`);
  ok(ranked.every((r) => r.hits.some((h) => h.item === part)), 'every ranked relic contains the part');

  // DOM: отрисованы карточки предметов
  await new Promise((r) => setTimeout(r, 100));
  const cards = window.document.querySelectorAll('#main article');
  ok(cards.length === primes.items.length, `DOM rendered ${cards.length} item cards`);
  const checks = window.document.querySelectorAll('#main input[type=checkbox]');
  ok(checks.length > 0, `DOM rendered ${checks.length} part checkboxes`);

  // заголовок виден после загрузки (по умолчанию EN)
  const h1 = window.document.querySelector('#main h1');
  ok(h1 && /Prime items/i.test(h1.textContent), 'catalog heading rendered in EN by default');

  // i18n: переключение языка
  ok(store.lang === 'en', 'default language is EN');
  ok(store.t('cat_title') === 'Prime items', 't() returns EN string');
  store.setLang('ru');
  ok(store.t('cat_title') === 'Прайм-предметы', 't() switches to RU');
  ok(store.catName('Warframe') === 'Варфреймы', 'catName translates');
  await new Promise((r) => setTimeout(r, 50));
  ok(/Прайм-предметы/i.test(window.document.querySelector('#main h1').textContent), 'heading re-renders in RU after toggle');
  store.setLang('en');

  // данные остаются английскими независимо от языка
  ok(/Prime/i.test(primes.items[0].name) && !/Прайм/.test(primes.items[0].name), 'item names stay English in data');

  console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
  process.exit(fail ? 1 : 0);
})();
