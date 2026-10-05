import { emptyState, demoState } from './demo.js';
import { todayISO } from './logic.js';

const KEY = 'despesas-de-casa:v1';

function valid(s) {
  return s && s.v === 1 && s.settings && Array.isArray(s.categories) && Array.isArray(s.expenses) &&
    Array.isArray(s.recurring) && Array.isArray(s.payments);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (valid(s)) return s; }
  } catch { /* navegador sem armazenamento: cai na demonstração */ }
  const s = demoState(todayISO());
  save(s);
  return s;
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export const fresh = () => emptyState();
export const demo = () => demoState(todayISO());
export { valid };
