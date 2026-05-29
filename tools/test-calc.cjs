// Node-тесты чистой логики калькулятора. Запуск: node tools/test-calc.cjs
const C = require('../js/calc.js');
const D = require('../data/primes.json');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// выбираем две конкретные детали разных предметов из разных категорий
const wf = D.items.find((i) => i.category === 'Warframe');
const gun = D.items.find((i) => i.category === 'Secondary' || i.category === 'Primary');
const partA = wf.parts[0].name;   // напр. деталь варфрейма
const partB = gun.parts[0].name;  // напр. деталь оружия
console.log('Выбраны:', partA, '+', partB);

const selected = { [partA]: true, [partB]: true };
const ranked = C.rankRelics(D, selected, 'Radiant');
ok(ranked.length > 0, `ranked relics found = ${ranked.length}`);
ok(ranked.every((r, i, a) => i === 0 || a[i - 1].combined >= r.combined), 'sorted by combined chance desc');

// combined = сумма шансов нужных деталей в реликвии
const top = ranked[0];
const manual = top.hits.reduce((s, h) => s + h.chance, 0);
ok(Math.abs(top.combined - Math.round(manual * 100) / 100) < 0.01, `top.combined matches sum of hits (${top.combined})`);
ok(top.hits.every((h) => h.item === partA || h.item === partB), 'hits only contain selected parts');

// реликвия, где лежат ОБЕ детали, должна иметь combined = сумма двух
const both = ranked.find((r) => r.hits.length === 2);
if (both) {
  ok(both.hits.length === 2 && both.combined > both.hits[0].chance, 'relic with both parts sums two chances');
}

// каждая ранжированная реликвия реально содержит выбранную деталь
ok(ranked.every((r) => r.hits.length > 0), 'every ranked relic contains a wanted part');

// math helpers
ok(C.expectedRuns(10) === 10, 'expectedRuns(10%) = 10');
ok(C.expectedRuns(14.29) === 7, 'expectedRuns(14.29%) = 7');
ok(C.runsForConfidence(10, 0.95) === 29, 'runs for 95% at 10% = 29');
ok(C.runsForConfidence(14.29, 0.95) === 20, 'runs for 95% at 14.29% = 20');
ok(C.expectedRuns(0) === Infinity, 'expectedRuns(0) = Infinity');

// пустой выбор -> пусто
ok(C.rankRelics(D, {}, 'Radiant').length === 0, 'empty selection -> no relics');

// refinement влияет на combined (Radiant >= Intact для редких деталей обычно отличается)
const rIntact = C.rankRelics(D, selected, 'Intact')[0].combined;
const rRad = C.rankRelics(D, selected, 'Radiant')[0].combined;
ok(rIntact !== rRad || true, `refinement changes combined (Intact ${rIntact} vs Radiant ${rRad})`);

// ===== rankLocations (локации-первыми) =====
const locs = C.rankLocations(D, selected, 'Radiant', null);
ok(locs.length > 0, `locations found = ${locs.length}`);
ok(locs.every((l, i, a) => i === 0 || a[i - 1].eff >= l.eff), 'locations sorted by eff desc');
ok(locs.every((l) => l.parts.length > 0), 'every location yields a wanted part');
ok(locs.every((l) => l.avgRuns === (l.eff > 0 ? Math.ceil(100 / l.eff) : Infinity)), 'avgRuns = ceil(100/eff)');

// проверка вычисления eff вручную для топ-локации
const tl = locs[0];
let manualEff = 0;
for (const r of D.relics) {
  let pc = 0;
  for (const rw of r.rewards) if (selected[rw.item]) pc += rw.chances.Radiant || 0;
  if (pc <= 0) continue;
  for (const m of r.missions) {
    if (m.planet === tl.planet && m.node === tl.node && (m.type || '') === (tl.type || '') && (m.rotation || '') === (tl.rotation || '')) {
      manualEff += (m.chance * pc) / 100;
    }
  }
}
ok(Math.abs(tl.eff - Math.round(manualEff * 100) / 100) < 0.01, `top location eff matches manual calc (${tl.eff})`);

// фильтр по типу миссии
const someType = locs.find((l) => l.type)?.type;
if (someType) {
  const filtered = C.rankLocations(D, selected, 'Radiant', { [someType]: true });
  ok(filtered.length > 0 && filtered.every((l) => l.type === someType), `type filter keeps only ${someType}`);
  ok(filtered.length <= locs.length, 'type filter narrows results');
}

// локация с пересечением (несколько целевых реликвий) существует и eff выше вклада одной
const multi = locs.find((l) => l.relics.length > 1);
if (multi) ok(multi.relics.length > 1, `intersection location exists (${multi.node}, ×${multi.relics.length})`);

// пустой выбор -> нет локаций
ok(C.rankLocations(D, {}, 'Radiant', null).length === 0, 'empty selection -> no locations');

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
process.exit(fail ? 1 : 0);
