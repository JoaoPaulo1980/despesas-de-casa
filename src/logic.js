// Toda a conta do aplicativo mora aqui, sem tela. Datas são textos "AAAA-MM-DD"
// e os cálculos usam o calendário puro (UTC), então o horário de verão não
// pode empurrar uma conta para o dia errado. Dinheiro é sempre em centavos
// (números inteiros), para não aparecer 0.1 + 0.2 = 0.30000000000000004.

// ---------- datas ----------
export const pad = (n) => String(n).padStart(2, '0');
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
export const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const utc = (s) => {
  const { y, m, d } = parseISO(s);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (s, n) => {
  const t = new Date(utc(s) + n * 864e5);
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
export const diffDays = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const weekday = (s) => new Date(utc(s)).getUTCDay();
export const todayISO = (now = new Date()) =>
  toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const monthOf = (s) => s.slice(0, 7);
export const addMonthsYM = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
export const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return [toISO(y, m, 1), toISO(y, m, daysInMonth(y, m))];
};

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const fmtShort = (s) => { const { m, d } = parseISO(s); return `${pad(d)} ${MESES[m - 1]}`; };
export const fmtFull = (s) => { const { y, m, d } = parseISO(s); return `${pad(d)}/${pad(m)}/${y}`; };
export const fmtMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MESES_LONGOS[m - 1]} ${y}`; };
export function dayLabel(date, today) {
  const n = diffDays(date, today);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  return fmtShort(date);
}

// ---------- dinheiro ----------
export function fmtMoney(p) {
  const neg = p < 0;
  const a = Math.abs(Math.round(p));
  const w = Math.floor(a / 100);
  const c = a % 100;
  const s = '£' + String(w).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (c ? '.' + pad(c) : '');
  return neg ? '−' + s : s;
}
export const fmtPct = (x) => x.toFixed(1).replace('.', ',') + '%';

/** Lê "126.40", "126,40", "1,200", "1.200,50", "£1,200.50". Devolve centavos ou NaN. */
export function parseMoney(str) {
  let s = String(str ?? '').trim().replace(/[£\s]/g, '');
  if (!s || !/^\d[\d.,]*$/.test(s)) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) {
    const dec = lc > ld ? ',' : '.';
    const mil = dec === ',' ? '.' : ',';
    s = s.split(mil).join('').replace(dec, '.');
  } else if (lc >= 0) {
    s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.split(',').join('');
  } else if (ld >= 0) {
    s = /\.\d{1,2}$/.test(s) && s.split('.').length === 2 ? s : s.split('.').join('');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

// ---------- ocorrências das recorrentes ----------
/**
 * Datas de cobrança de uma recorrente entre `from` e `to` (inclusive).
 * rec.start é a primeira cobrança; dela saem o dia do mês (mensal), o dia da
 * semana (semanal) ou o dia/mês (anual). Dia 29–31 em mês curto cai no último
 * dia do mês. Nada é cobrado antes de rec.start.
 */
export function occurrences(rec, from, to) {
  const out = [];
  const lo = from > rec.start ? from : rec.start;
  if (lo > to) return out;
  const s = parseISO(rec.start);
  if (rec.freq === 'weekly') {
    const k = Math.ceil(diffDays(lo, rec.start) / 7);
    for (let d = addDays(rec.start, k * 7); d <= to; d = addDays(d, 7)) out.push(d);
  } else if (rec.freq === 'annual') {
    for (let y = parseISO(lo).y; y <= parseISO(to).y; y++) {
      const iso = toISO(y, s.m, Math.min(s.d, daysInMonth(y, s.m)));
      if (iso >= lo && iso <= to) out.push(iso);
    }
  } else {
    let { y, m } = parseISO(lo);
    for (;;) {
      const iso = toISO(y, m, Math.min(s.d, daysInMonth(y, m)));
      if (iso > to) break;
      if (iso >= lo) out.push(iso);
      if (++m > 12) { m = 1; y++; }
    }
  }
  return out;
}

export const payKey = (recId, date) => `${recId}|${date}`;

// ---------- lançamentos do mês (UMA fonte para Despesas, Visão Geral e Relatório) ----------
/**
 * Tudo que forma o gasto de um mês: despesas manuais + cobranças das
 * recorrentes (pagas ou ainda previstas). Recorrente pausada só entra com o
 * que já foi pago. Nenhum total é digitado: tudo vem desta lista.
 */
export function monthEntries(st, ym) {
  const [from, to] = monthRange(ym);
  const list = [];
  for (const e of st.expenses) {
    if (e.date >= from && e.date <= to)
      list.push({ id: e.id, kind: 'manual', date: e.date, name: e.desc, cat: e.cat, amount: e.amount, note: e.note || '', paid: true });
  }
  const seen = new Set();
  for (const p of st.payments) {
    if (p.date >= from && p.date <= to) {
      seen.add(p.key);
      list.push({ id: p.key, kind: 'rec', recId: p.recId, date: p.date, name: p.name, cat: p.cat, amount: p.amount, note: '', paid: true });
    }
  }
  for (const r of st.recurring) {
    if (!r.active) continue;
    for (const d of occurrences(r, from, to)) {
      const key = payKey(r.id, d);
      if (seen.has(key)) continue;
      list.push({ id: key, kind: 'rec', recId: r.id, date: d, name: r.name, cat: r.cat, amount: r.amount, note: r.note || '', paid: false });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function categoryTotals(entries, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map();
  for (const e of entries) {
    const id = byId.has(e.cat) ? e.cat : 'outros';
    if (!groups.has(id)) groups.set(id, { cat: byId.get(id) || { id, name: 'Outros', hue: 230 }, total: 0, items: [] });
    const g = groups.get(id);
    g.total += e.amount;
    g.items.push(e);
  }
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .map((g) => ({ ...g, pct: total ? (g.total / total) * 100 : 0 }));
}

export function monthSummary(st, ym) {
  const entries = monthEntries(st, ym);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const groups = categoryTotals(entries, st.categories);
  const [y, m] = ym.split('-').map(Number);
  const weeks = daysInMonth(y, m) / 7; // média semanal = total ÷ (dias do mês ÷ 7)
  const res = st.settings.residents || 0;
  return {
    entries, groups, total,
    planned: entries.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0),
    top: groups[0] || null,
    weeks,
    perWeek: Math.round(total / weeks),
    residents: res,
    perPerson: res > 0 ? Math.round(total / res) : null,
  };
}

// ---------- próximas contas ----------
/**
 * Cobranças das recorrentes que ainda interessam: as ATRASADAS (antes de hoje,
 * sem marcação de paga — continuam precisando de dinheiro) e as de hoje até
 * hoje+dias-1. "Próximos 7 dias" = hoje + 6 dias seguintes, e só o que ainda
 * não foi pago entra no total.
 */
export function upcoming(st, today, days) {
  const to = addDays(today, days - 1);
  const paid = new Map(st.payments.map((p) => [p.key, p]));
  const items = [];
  for (const p of st.payments) {
    if (p.date >= today && p.date <= to)
      items.push({ key: p.key, recId: p.recId, date: p.date, name: p.name, cat: p.cat, amount: p.amount, paid: true });
  }
  for (const r of st.recurring) {
    if (!r.active) continue;
    for (const d of occurrences(r, r.start, to)) {
      const key = payKey(r.id, d);
      if (paid.has(key)) continue;
      items.push({ key, recId: r.id, date: d, name: r.name, cat: r.cat, amount: r.amount, paid: false });
    }
  }
  return items
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    .map((i) => ({ ...i, overdue: !i.paid && i.date < today, status: statusOf(i, today) }));
}

export function statusOf(item, today) {
  if (item.paid) return 'paid';
  const n = diffDays(item.date, today);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 2) return 'soon';
  if (n <= 7) return 'next';
  return 'planned';
}
export const STATUS_LABEL = { paid: 'Paga', overdue: 'Atrasada', today: 'Hoje', soon: 'Vence em breve', next: 'Próximos dias', planned: 'Prevista' };

export const sumUnpaid = (items) => items.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);

export function overview(st, today) {
  const n7 = upcoming(st, today, 7);
  const n30 = upcoming(st, today, 30);
  const next7 = sumUnpaid(n7);
  const next30 = sumUnpaid(n30);
  const available = availableNow(st);
  return { items7: n7, items30: n30, next7, next30, available, free: available - next7 };
}

// ---------- marcar como paga ----------
/**
 * "Disponível hoje" = valor que você informou (settings.available, definido em
 * settings.availableSetAt) menos o que foi PAGO depois disso. Calculado assim
 * (e não somando e subtraindo no próprio número), dois celulares pagando contas
 * diferentes ao mesmo tempo não se atropelam, e desfazer devolve o valor sozinho.
 */
export function availableNow(st) {
  const since = st.settings.availableSetAt || 0;
  let a = st.settings.available || 0;
  for (const p of st.payments) if (Date.parse(p.paidAt) > since) a -= p.amount;
  return a;
}
export function setAvailable(st, value, now = Date.now()) {
  st.settings.available = value;
  st.settings.availableSetAt = now;
  st.settings.u = now;
}

export function markPaid(st, recId, date, now = new Date()) {
  const r = st.recurring.find((x) => x.id === recId);
  const key = payKey(recId, date);
  if (!r || st.payments.some((p) => p.key === key)) return;
  st.payments.push({ key, recId, date, name: r.name, cat: r.cat, amount: r.amount, paidAt: now.toISOString(), u: now.getTime() });
}
export function unmarkPaid(st, recId, date) {
  removeRec(st, 'payments', payKey(recId, date));
}

/** Exclui e deixa um "recibo de exclusão" (tombstone), para a exclusão chegar ao outro celular. */
export function removeRec(st, coll, id) {
  const isIt = coll === 'payments' ? (r) => r.key === id : (r) => r.id === id;
  if (!st[coll].some(isIt)) return;
  st[coll] = st[coll].filter((r) => !isIt(r));
  st.del = st.del || {};
  st.del[`${coll}:${id}`] = Date.now();
}

// ---------- categorias ----------
export function deleteCategory(st, id) {
  if (id === 'outros') return false;
  const t = Date.now();
  removeRec(st, 'categories', id);
  for (const e of st.expenses) if (e.cat === id) { e.cat = 'outros'; e.u = t; }
  for (const r of st.recurring) if (r.cat === id) { r.cat = 'outros'; r.u = t; }
  for (const p of st.payments) if (p.cat === id) { p.cat = 'outros'; p.u = t; }
  return true;
}

/** Apaga todos os lançamentos (mantém categorias e moradores), com recibos de exclusão. */
export function clearAll(st) {
  for (const c of ['expenses', 'recurring', 'payments']) {
    for (const r of [...st[c]]) removeRec(st, c, c === 'payments' ? r.key : r.id);
  }
  setAvailable(st, 0);
}
