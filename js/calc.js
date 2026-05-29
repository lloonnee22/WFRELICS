// Чистая логика расчётов WFRELICS (работает и в браузере, и в Node).
// Главная фишка: игрок отмечает нужные ему ОТДЕЛЬНЫЕ детали (приклад пистолета,
// нейрооптика варфрейма и т.д.) — функция ранжирует реликвии по суммарному шансу
// выбить хоть одну из нужных деталей (в одном вскрытии награда одна, поэтому шансы
// взаимоисключающие и складываются).
(function (root) {
  'use strict';

  // selected: { "<английское имя детали>": true }
  function rankRelics(data, selected, refinement) {
    const sel = selected || {};
    const want = new Set(Object.keys(sel).filter((k) => sel[k]));
    if (!want.size || !data || !data.relics) return [];

    const out = [];
    for (const r of data.relics) {
      const hits = [];
      let combined = 0;
      for (const rw of r.rewards) {
        if (want.has(rw.item)) {
          const c = rw.chances[refinement] || 0;
          combined += c;
          hits.push({ item: rw.item, rarity: rw.rarity, chance: c });
        }
      }
      if (hits.length) {
        hits.sort((a, b) => b.chance - a.chance);
        out.push({
          id: r.id,
          tier: r.tier,
          image: r.image,
          combined: Math.round(combined * 100) / 100,
          hits,
          mission: r.missions && r.missions[0] ? r.missions[0] : null,
          missions: r.missions || [],
        });
      }
    }
    out.sort((a, b) => b.combined - a.combined || a.id.localeCompare(b.id));
    return out;
  }

  // Локации-первыми: где идти фармить. Берём только реликвии, в которых есть нужная
  // деталь, и агрегируем по миссиям. eff = шанс выбить НУЖНУЮ реликвию за заход.
  // Если в одной миссии падает несколько нужных реликвий — их шансы складываются
  // (рад любой из них), и локация поднимается выше. Шанс детали ВНУТРИ реликвии
  // намеренно не учитываем — он одинаков везде и пользователю тут не нужен.
  function rankLocations(data, selected, typeSel) {
    const sel = selected || {};
    const want = new Set(Object.keys(sel).filter((k) => sel[k]));
    if (!want.size || !data || !data.relics) return [];
    const typeKeys = typeSel ? Object.keys(typeSel).filter((t) => typeSel[t]) : [];
    const typeOk = (t) => !typeKeys.length || (t && typeKeys.includes(t));

    const byLoc = new Map();
    for (const r of data.relics) {
      const parts = r.rewards.filter((rw) => want.has(rw.item)).map((rw) => rw.item);
      if (!parts.length) continue; // в этой реликвии нет наших деталей
      for (const m of r.missions || []) {
        if (!typeOk(m.type)) continue;
        const key = (m.planet || '') + '|' + m.node + '|' + (m.type || '') + '|' + (m.rotation || '');
        let loc = byLoc.get(key);
        if (!loc) { loc = { planet: m.planet, node: m.node, type: m.type, rotation: m.rotation, eff: 0, relics: [], partSet: {} }; byLoc.set(key, loc); }
        loc.eff += m.chance; // шанс выбить эту реликвию за заход (%)
        loc.relics.push({ relic: r.id, tier: r.tier, relicChance: m.chance, parts });
        for (const p of parts) loc.partSet[p] = true;
      }
    }

    const out = [...byLoc.values()].map((l) => {
      const eff = Math.round(l.eff * 100) / 100;
      return {
        planet: l.planet, node: l.node, type: l.type, rotation: l.rotation,
        eff,
        avgRuns: eff > 0 ? Math.ceil(100 / eff) : Infinity,
        relics: l.relics.sort((a, b) => b.relicChance - a.relicChance),
        parts: Object.keys(l.partSet), // уникальные нужные детали, доступные тут
      };
    });
    out.sort((a, b) => b.eff - a.eff || a.avgRuns - b.avgRuns);
    return out;
  }

  // Сколько вскрытий/заходов в среднем нужно при шансе p (в процентах).
  function expectedRuns(pPercent) {
    const p = (pPercent || 0) / 100;
    return p > 0 ? Math.ceil(1 / p) : Infinity;
  }

  // Сколько попыток нужно для заданной уверенности (0.9 / 0.95 / 0.99).
  function runsForConfidence(pPercent, conf) {
    const p = (pPercent || 0) / 100;
    if (p <= 0) return Infinity;
    if (p >= 1) return 1;
    return Math.ceil(Math.log(1 - conf) / Math.log(1 - p));
  }

  const api = { rankRelics, rankLocations, expectedRuns, runsForConfidence };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WFCalc = api;
})(typeof self !== 'undefined' ? self : this);
