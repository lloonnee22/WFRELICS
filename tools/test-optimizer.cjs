// Рендер-тест партиала оптимизатора (calc.html) с выбранными деталями.
// Запуск: NODE_PATH=<tmp>/node_modules node tools/test-optimizer.cjs
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ROOT = join(__dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const primes = JSON.parse(read('data/primes.json'));

const calc = read('partials/calc.html');
const dom = new JSDOM(`<!DOCTYPE html><html><body><main id="main">${calc}</main></body></html>`,
  { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
global.MutationObserver = window.MutationObserver;
global.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
global.navigator = window.navigator;
for (const k of ['CustomEvent', 'Event', 'Node', 'Element', 'ShadowRoot', 'HTMLElement', 'DocumentFragment', 'getComputedStyle', 'HTMLTemplateElement', 'customElements']) global[k] = window[k];
window.fetch = global.fetch = async () => ({ ok: true, status: 200, json: async () => primes });

window.eval(read('js/calc.js'));
window.eval(read('js/store.js'));
let Alpine = require('alpinejs'); Alpine = Alpine.default || Alpine;
window.Alpine = Alpine; Alpine.start();

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const doc = window.document;

(async () => {
  await new Promise((r) => setTimeout(r, 200));
  const store = Alpine.store('wf');

  // выбираем две детали разных предметов
  const wf = primes.items.find((i) => i.category === 'Warframe');
  const gun = primes.items.find((i) => i.category === 'Secondary' || i.category === 'Primary');
  store.toggle(wf.parts[0].name);
  store.toggle(gun.parts[0].name);
  await new Promise((r) => setTimeout(r, 150));

  const expected = store.locations.length;
  const rows = doc.querySelectorAll('#main [style*="grid-template-columns:34px"]');
  // первая строка с этим grid — заголовок колонок, остальные — локации
  const locRows = [...rows].filter((r) => /%$/.test(r.textContent.trim().slice(-1) + '') || r.querySelector('.text-haz'));
  ok(expected > 0, `store.locations computed = ${expected}`);
  ok(doc.querySelectorAll('#main .text-2xl.text-haz').length === expected, `rendered ${expected} location rows with eff%`);

  // фильтр по типу миссии отрисован
  const typeBtns = doc.querySelectorAll('#main button');
  ok(store.availTypes().length > 0, `available mission types = ${store.availTypes().length}`);

  // применяем фильтр по первому типу и проверяем, что число строк меняется как в сторе
  const t0 = store.availTypes()[0];
  store.toggleType(t0);
  await new Promise((r) => setTimeout(r, 120));
  ok(doc.querySelectorAll('#main .text-2xl.text-haz').length === store.locations.length, `type filter re-renders rows (${store.locations.length})`);
  ok(store.locations.every((l) => l.type === t0), `filtered locations all type ${t0}`);

  // нет старого «шанс части из релика» столбца / кнопок «все точки фарма»
  ok(!/все точки фарма|all farm spots/i.test(doc.querySelector('#main').textContent), 'no per-relic expandable farm buttons remain');

  console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
  process.exit(fail ? 1 : 0);
})();
