import { addDays, parseISO, toISO, daysInMonth, occurrences, markPaid, payKey, pad } from './logic.js';

export const INITIAL_CATEGORIES = [
  { id: 'aluguel', name: 'Aluguel', hue: 212, icon: 'home' },
  { id: 'council', name: 'Council Tax', hue: 135, icon: 'building' },
  { id: 'agua', name: 'Água', hue: 190, icon: 'drop' },
  { id: 'energia', name: 'Energia/Gás', hue: 45, icon: 'bolt' },
  { id: 'internet', name: 'Internet', hue: 265, icon: 'wifi' },
  { id: 'mercado', name: 'Supermercado', hue: 345, icon: 'cart' },
  { id: 'seguro', name: 'Seguro', hue: 18, icon: 'shield' },
  { id: 'carro', name: 'Carro/Transporte', hue: 165, icon: 'car' },
  { id: 'assinaturas', name: 'Assinaturas', hue: 290, icon: 'repeat' },
  { id: 'casa', name: 'Casa', hue: 85, icon: 'tool' },
  { id: 'outros', name: 'Outros', hue: 230, icon: 'tag' },
];

export const emptyState = () => ({
  v: 1,
  demo: false,
  settings: { residents: 0, available: 0 },
  categories: INITIAL_CATEGORIES.map((c) => ({ ...c })),
  expenses: [],
  recurring: [],
  payments: [],
});

// Data de "n meses atrás", mantendo o mesmo dia do mês (volta mais um mês se o dia não existir lá).
function monthsBack(iso, n) {
  const { y, m, d } = parseISO(iso);
  for (let k = n; k < n + 12; k++) {
    const t = y * 12 + (m - 1) - k;
    const yy = Math.floor(t / 12), mm = (t % 12) + 1;
    if (daysInMonth(yy, mm) >= d) return toISO(yy, mm, d);
  }
  return iso;
}

let seq = 0;
export const uid = (p = 'id') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Demonstração com datas RELATIVAS a hoje: a Visão Geral nunca fica vazia. */
export function demoState(today) {
  const st = emptyState();
  st.demo = true;
  st.settings = { residents: 7, available: 120000 };
  const { y, m } = parseISO(today);
  const nextFirst = m === 12 ? toISO(y + 1, 1, 1) : toISO(y, m + 1, 1);
  const rec = (id, name, cat, pounds, freq, due, account, back) => ({
    id, name, cat, amount: Math.round(pounds * 100), freq,
    start: back === 'year' ? toISO(parseISO(due).y - 1, parseISO(due).m, parseISO(due).d) : back === 'week' ? addDays(due, -7 * 12) : monthsBack(due, 3),
    account, note: '', active: true,
  });
  st.recurring = [
    rec('r-aluguel', 'Aluguel', 'aluguel', 2300, 'monthly', nextFirst, 'Débito automático'),
    rec('r-energia', 'Energia e gás', 'energia', 280, 'monthly', addDays(today, 1), 'Débito automático'),
    rec('r-council', 'Council Tax', 'council', 229, 'monthly', addDays(today, 3), 'Débito automático'),
    rec('r-limpeza', 'Faxineira', 'casa', 45, 'weekly', addDays(today, 4), 'Dinheiro', 'week'),
    rec('r-seguro', 'Seguro da casa', 'seguro', 270, 'annual', addDays(today, 5), 'Cartão de crédito', 'year'),
    rec('r-internet', 'Internet', 'internet', 50, 'monthly', addDays(today, 6), 'Débito automático'),
    rec('r-agua', 'Água e esgoto', 'agua', 120, 'monthly', addDays(today, 12), 'Débito automático'),
  ];
  // Tudo que já venceu antes de hoje nasce pago, senão a demonstração começaria cheia de atrasadas.
  for (const r of st.recurring)
    for (const d of occurrences(r, r.start, addDays(today, -1))) markPaid(st, r.id, d, new Date(d + 'T12:00:00'), false);

  const monthStart = toISO(y, m, 1);
  const back = (k) => { const d = addDays(today, -k); return d < monthStart ? monthStart : d; };
  const ex = (k, desc, cat, pounds, note = '') => ({ id: uid('e'), date: back(k), desc, cat, amount: Math.round(pounds * 100), note });
  st.expenses = [
    ex(4, 'Tesco', 'mercado', 450), ex(3, 'Aldi', 'mercado', 310),
    ex(2, 'Costco', 'mercado', 540), ex(1, 'Tesco', 'mercado', 500),
    ex(2, 'Gasolina', 'carro', 62.4), ex(0, 'Lâmpadas e pilhas', 'casa', 18.9),
  ];
  return st;
}
