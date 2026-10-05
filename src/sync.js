// Juntar o que dois celulares fizeram, sem servidor "inteligente": cada registro
// tem um carimbo `u` (quando mudou) e cada exclusão deixa um recibo em `del`.
// Para cada registro vence o mais recente; exclusão mais recente que o registro
// vence. A junção é a mesma em qualquer ordem, então repetir não estraga nada.

const COLL = ['expenses', 'recurring', 'payments', 'categories'];
const idOf = (c, r) => (c === 'payments' ? r.key : r.id);
const PRUNE_MS = 400 * 864e5;

export function stable(x) {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
/** Forma canônica: mesma informação => mesmo texto, qualquer que seja a ordem. */
export function canon(s) {
  const o = { ...s };
  for (const c of COLL) o[c] = [...(s[c] || [])].sort((a, b) => String(idOf(c, a)).localeCompare(String(idOf(c, b))));
  return stable(o);
}

export function migrate(s) {
  if (!s || typeof s !== 'object' || s.v !== 1) return s;
  const t = Date.now();
  const out = { ...s, v: 2, del: {}, settings: { ...s.settings, availableSetAt: t, u: t } };
  for (const c of COLL) out[c] = (s[c] || []).map((r) => ({ u: c === 'categories' ? 0 : 1, ...r }));
  return out;
}

export function isValid(s) {
  return !!s && (s.v === 1 || s.v === 2) && s.settings && COLL.every((c) => Array.isArray(s[c]));
}

export function merge(a, b) {
  const del = { ...(a.del || {}) };
  for (const [k, t] of Object.entries(b.del || {})) del[k] = Math.max(del[k] || 0, t);
  const now = Date.now();
  for (const k of Object.keys(del)) if (now - del[k] > PRUNE_MS) delete del[k];
  const out = {
    v: 2,
    demo: !!(a.demo && b.demo),
    settings: (b.settings?.u || 0) > (a.settings?.u || 0) ? b.settings : a.settings,
    del,
  };
  for (const c of COLL) {
    const best = new Map();
    for (const r of [...(a[c] || []), ...(b[c] || [])]) {
      const id = idOf(c, r);
      const cur = best.get(id);
      if (!cur || (r.u || 0) > (cur.u || 0) || ((r.u || 0) === (cur.u || 0) && stable(r) > stable(cur))) best.set(id, r);
    }
    out[c] = [...best.entries()].filter(([id, r]) => !((`${c}:${id}`) in del && del[`${c}:${id}`] >= (r.u || 0))).map(([, r]) => r);
  }
  return out;
}
