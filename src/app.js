import * as L from './logic.js';
import { uid } from './demo.js';
import * as store from './store.js';
import * as cloud from './cloud.js';
import { merge } from './sync.js';
import { icon, houseSolid } from './icons.js';

let st = store.load(); // null = celular ligado à nuvem que perdeu a cópia local: busca antes de mostrar qualquer coisa
const ui = { month: L.monthOf(L.todayISO()), open: new Set() };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = L.fmtMoney;
const parseSigned = (t) => { const x = String(t).trim(); return x.startsWith('-') ? -L.parseMoney(x.slice(1)) : L.parseMoney(x); };
const catOf = (id) => st.categories.find((c) => c.id === id) || st.categories.find((c) => c.id === 'outros') || { id: 'outros', name: 'Outros', hue: 230, icon: 'tag' };
const tint = (h) => `background:hsl(${h} 85% 93%);color:hsl(${h} 55% 30%)`;
const solid = (h) => `hsl(${h} 78% 60%)`;
const catIco = (c) => `<span class="ico" style="${tint(c.hue)}">${icon(c.icon || 'tag')}</span>`;
const catDot = (c) => `<span class="cat"><span class="dot" style="background:${solid(c.hue)}"></span>${esc(c.name)}</span>`;

const NAV = [
  ['visao', 'Visão Geral', 'Visão', 'grid'],
  ['proximas', 'Próximas Contas', 'Contas', 'calendar'],
  ['despesas', 'Despesas', 'Despesas', 'list'],
  ['recorrentes', 'Recorrentes', 'Recorrentes', 'repeat'],
  ['relatorio', 'Relatório', 'Relatório', 'chart'],
  ['config', 'Configurações', 'Config.', 'gear'],
];

const sync = { state: store.getLink() ? 'idle' : 'off', syncing: false, timer: 0, error: null };
function persist() {
  if (!store.save(st)) toast('Não consegui salvar neste navegador (modo privado?).');
  if (store.getLink()) scheduleSync(900);
}
function scheduleSync(ms) { clearTimeout(sync.timer); sync.timer = setTimeout(runSync, ms); }
async function runSync() {
  if (!store.getLink() || sync.syncing || !st) return;
  sync.syncing = true; sync.state = 'syncing'; renderSyncbar();
  try {
    const sent = JSON.stringify(st);
    const r = await cloud.syncNow(st);
    // se o usuário mexeu durante a espera, junta de novo com o que está na tela agora
    st = JSON.stringify(st) === sent ? r.state : merge(st, r.state);
    store.save(st);
    sync.state = 'ok'; sync.error = null;
    if (JSON.stringify(st) !== sent && $('#modal').hidden && !document.activeElement?.matches?.('input,select,textarea')) render();
    if (JSON.stringify(st) !== JSON.stringify(r.state)) scheduleSync(500);
  } catch (e) {
    sync.state = e.kind === 'codigo' ? 'codigo' : e.kind === 'offline' ? 'offline' : 'fora';
    sync.error = e;
  } finally { sync.syncing = false; renderSyncbar(); }
}
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function renderSyncbar() {
  const el = $('#syncbar'); if (!el) return;
  const l = store.getLink();
  if (!l) { el.innerHTML = ''; el.className = 'syncbar'; return; }
  const ult = l.lastOk ? `sincronizados pela última vez em ${new Date(l.lastOk).toLocaleDateString('pt-BR')} às ${hhmm(l.lastOk)}` : 'ainda não sincronizados';
  const M = {
    ok: ['ok', `Compartilhado com a casa · sincronizado às ${hhmm(l.lastOk || Date.now())}`],
    idle: ['ok', 'Compartilhado com a casa'],
    syncing: ['ok', 'Sincronizando…'],
    offline: ['bad', `<b>Sem conexão com o serviço online.</b> Você está vendo os dados salvos neste celular (${ult}). O que você lançar fica guardado aqui e é enviado quando a conexão voltar. O outro celular só vê as mudanças depois disso.`],
    fora: ['bad', `<b>O serviço online não está respondendo.</b> Você está vendo os dados salvos neste celular (${ult}). O que você lançar fica guardado aqui e é enviado quando o serviço voltar.`],
    codigo: ['bad', '<b>O código da casa não foi aceito pelo servidor.</b> Os dados deste celular estão salvos, mas não estão sendo compartilhados. Vá em Configurações e entre de novo com o código.'],
  }[sync.state] || ['ok', ''];
  el.className = 'syncbar ' + M[0];
  el.innerHTML = `<span>${M[1]}</span>${M[0] === 'bad' ? '<button class="btn sm ghost" data-act="sync-now">Tentar de novo</button>' : ''}`;
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- peças reutilizáveis ----------
function billRow(i, today, { showPay = true } = {}) {
  const c = catOf(i.cat);
  const chip = `<span class="chip s-${i.status}">${i.status === 'paid' ? icon('check') : i.status === 'overdue' ? icon('alert') : i.status === 'today' || i.status === 'soon' ? icon('clock') : ''}${L.STATUS_LABEL[i.status]}</span>`;
  const btn = !showPay ? '' : i.paid
    ? `<button class="btn ghost sm" data-act="unpay" data-rec="${esc(i.recId)}" data-date="${i.date}" aria-label="Desfazer pagamento de ${esc(i.name)}">${icon('undo')}<span class="bt">Desfazer</span></button>`
    : `<button class="btn pay sm" data-act="pay" data-rec="${esc(i.recId)}" data-date="${i.date}" aria-label="Marcar ${esc(i.name)} como paga">${icon('check')}<span class="bt">Pagar</span></button>`;
  return `<div class="row ${i.paid ? 'paid' : ''} ${i.overdue ? 'overdue' : ''}">
    <div class="when">${L.dayLabel(i.date, today)}</div>
    <div class="main1"><div class="nm">${esc(i.name)}</div><div class="meta">${catDot(c)}${chip}</div></div>
    <div class="amt">${money(i.amount)}</div>${btn}</div>`;
}

function monthNav() {
  return `<div class="monthnav"><span class="muted" style="font-size:13px">Mês:</span><b>${L.fmtMonth(ui.month)}</b>
    <button data-act="month" data-d="-1" aria-label="Mês anterior">${icon('left')}</button>
    <button data-act="month" data-d="1" aria-label="Próximo mês">${icon('right')}</button></div>`;
}

// ---------- telas ----------
function viewVisao(today) {
  const o = L.overview(st, today);
  const ms = L.monthSummary(st, L.monthOf(today));
  const neg = o.free < 0;
  const { y, m, d } = L.parseISO(today);
  const long = `${L.DIAS_SEMANA[L.weekday(today)]}, ${d} de ${L.MESES_LONGOS[m - 1].toLowerCase()}`;
  const list = o.items7.length
    ? o.items7.map((i) => billRow(i, today)).join('')
    : `<div class="empty">Nada a pagar nos próximos 7 dias.<br>Cadastre suas contas fixas em <a class="link" href="#/recorrentes">Recorrentes</a>.</div>`;
  const maxG = ms.groups[0]?.total || 1;
  const bars = ms.groups.slice(0, 5).map((g) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700">${catDot(g.cat)}<span>${money(g.total)}</span></div>
    <div style="height:8px;background:#eef1f6;border-radius:9px;margin-top:5px"><div style="height:8px;width:${(g.total / maxG) * 100}%;background:${solid(g.cat.hue)};border-radius:9px"></div></div></div>`).join('');
  return `<div class="pagehead"><div><h1>Visão Geral</h1><p class="muted">${long}</p></div></div>
  <section class="stats" aria-label="Resumo">
    <div class="stat t-blue edit" data-act="edit-available" role="button" tabindex="0" id="avail">
      <span class="lbl">${icon('wallet')}Disponível hoje</span><span class="big">${money(o.available)}</span><span class="sub">Toque para alterar · pagar uma conta desconta daqui</span></div>
    <div class="stat t-orange"><span class="lbl">${icon('calendar')}Próximos 7 dias</span><span class="big">${money(o.next7)}</span><span class="sub">${o.items7.filter((i) => !i.paid).length} conta(s) a pagar</span></div>
    <div class="stat t-purple"><span class="lbl">${icon('calc')}Próximos 30 dias</span><span class="big">${money(o.next30)}</span><span class="sub">${o.items30.filter((i) => !i.paid).length} conta(s) a pagar</span></div>
    <div class="stat free ${neg ? 'neg' : 't-green'}"><span class="lbl">${icon(neg ? 'alert' : 'check')}Livre depois das próximas contas</span><span class="big">${money(o.free)}</span><span class="sub">${neg ? `Faltam ${money(-o.free)} para cobrir os 7 dias` : 'Disponível menos os próximos 7 dias'}</span></div>
  </section>
  <div class="grid2">
    <section class="card"><div class="sechead"><h2>Próximas contas</h2><a class="link" href="#/proximas">Ver todas</a></div><div class="list">${list}</div></section>
    <section class="card"><div class="sechead"><h2>${L.MESES_LONGOS[m - 1]}</h2><a class="link" href="#/relatorio">Relatório</a></div>
      <div class="big" style="font-size:30px;font-weight:800;letter-spacing:-.02em">${money(ms.total)}</div>
      <div class="muted" style="font-size:13px">gasto no mês${ms.planned ? ` · ${money(ms.planned)} ainda previsto` : ''}</div>
      ${bars || '<div class="empty">Sem lançamentos neste mês.</div>'}</section>
  </div>`;
}

function viewProximas(today) {
  const items = L.upcoming(st, today, 30);
  const over = items.filter((i) => i.overdue);
  const w1 = items.filter((i) => !i.overdue && L.diffDays(i.date, today) <= 6);
  const w2 = items.filter((i) => !i.overdue && L.diffDays(i.date, today) > 6);
  const sec = (t, arr, sub) => arr.length ? `<section class="card" style="margin-bottom:16px"><div class="sechead"><h2>${t}</h2><span class="muted">${sub}</span></div><div class="list">${arr.map((i) => billRow(i, today)).join('')}</div></section>` : '';
  const sum = (a) => money(L.sumUnpaid(a));
  return `<div class="pagehead"><div><h1>Próximas Contas</h1><p class="muted">Tudo que vai sair nos próximos 30 dias, por data.</p></div></div>
  ${sec('Atrasadas', over, `${sum(over)} sem pagar`)}${sec('Próximos 7 dias', w1, `${sum(w1)} a pagar`)}${sec('Dias 8 a 30', w2, `${sum(w2)} a pagar`)}
  ${items.length ? '' : '<div class="card empty">Nenhuma conta prevista. Cadastre em <a class="link" href="#/recorrentes">Recorrentes</a>.</div>'}`;
}

function viewDespesas(today) {
  const s = L.monthSummary(st, ui.month);
  const groups = s.groups.map((g) => {
    const rows = g.items.map((e) => {
      const kind = e.kind === 'manual' ? '' : `<span class="chip ${e.paid ? 's-paid' : 's-planned'}">Recorrente · ${e.paid ? 'paga' : 'prevista'}</span>`;
      const act = e.kind === 'manual'
        ? `<div class="actions"><button class="iconbtn" data-act="edit-exp" data-id="${esc(e.id)}" aria-label="Editar ${esc(e.name)}">${icon('edit')}</button><button class="iconbtn" data-act="del-exp" data-id="${esc(e.id)}" aria-label="Excluir ${esc(e.name)}">${icon('trash')}</button></div>`
        : e.paid
          ? `<button class="btn ghost sm" data-act="unpay" data-rec="${esc(e.recId)}" data-date="${e.date}" aria-label="Desfazer pagamento de ${esc(e.name)}">${icon('undo')}<span class="bt">Desfazer</span></button>`
          : `<button class="btn pay sm" data-act="pay" data-rec="${esc(e.recId)}" data-date="${e.date}" aria-label="Marcar ${esc(e.name)} como paga">${icon('check')}<span class="bt">Pagar</span></button>`;
      return `<div class="row ${e.kind === 'rec' && !e.paid ? '' : ''}"><div class="when">${L.fmtShort(e.date)}</div>
        <div class="main1"><div class="nm">${esc(e.name)}</div><div class="meta">${kind}${e.note ? `<span>${esc(e.note)}</span>` : ''}</div></div>
        <div class="amt">${money(e.amount)}</div>${act}</div>`;
    }).join('');
    return `<section class="card group"><div class="ghead">${catIco(g.cat)}<span>${esc(g.cat.name)}</span><span class="gtotal">${money(g.total)}</span></div>
      <div class="list">${rows}</div><div class="tot" style="${tint(g.cat.hue)}"><span>TOTAL ${esc(g.cat.name.toUpperCase())}</span><span>${money(g.total)}</span></div></section>`;
  }).join('');
  return `<div class="pagehead"><div><h1>Despesas</h1><p class="muted">${s.entries.length} lançamento(s) · total do mês <b>${money(s.total)}</b></p></div>${monthNav()}</div>
  <div class="flex noprint" style="margin-bottom:16px"><button class="btn" data-act="new-exp">${icon('plus')}Nova despesa</button></div>
  ${groups || '<div class="card empty">Nenhuma despesa neste mês.</div>'}`;
}

const freqText = (r) => {
  const { m, d } = L.parseISO(r.start);
  if (r.freq === 'weekly') { const w = L.weekday(r.start); return `Semanal · toda${w === 0 || w === 6 ? '' : ''} ${L.DIAS_SEMANA[w]}`.replace('toda domingo', 'todo domingo').replace('toda sábado', 'todo sábado'); }
  if (r.freq === 'annual') return `Anual · ${d} ${L.MESES[m - 1]}`;
  return `Mensal · dia ${d}`;
};
function viewRecorrentes(today) {
  const over = new Set(L.upcoming(st, today, 1).filter((i) => i.overdue).map((i) => i.recId));
  const cards = st.recurring.map((r) => {
    const c = catOf(r.cat);
    const next = L.occurrences(r, today, L.addDays(today, 800)).find((d) => !st.payments.some((p) => p.key === L.payKey(r.id, d)));
    return `<article class="card reccard ${r.active ? '' : 'off'}">
      <div class="top">${catIco(c)}<div style="flex:1;min-width:0"><div class="nm" style="font-weight:800;font-size:16px">${esc(r.name)}</div><div class="muted" style="font-size:13px">${esc(c.name)}</div></div><div class="amt" style="font-weight:800;font-size:19px">${money(r.amount)}</div></div>
      <div class="facts"><span>${freqText(r)}</span>${r.account ? `<span>${esc(r.account)}</span>` : ''}<span>${r.active ? (next ? 'Próxima: <b>' + L.dayLabel(next, today) + '</b>' : '—') : '<b>Pausada</b>'}</span></div>
      ${over.has(r.id) && r.active ? `<div><span class="chip s-overdue">${icon('alert')}Tem cobrança atrasada</span></div>` : ''}
      ${r.note ? `<div class="muted" style="font-size:13px">${esc(r.note)}</div>` : ''}
      <div class="foot"><button class="btn ghost sm" data-act="edit-rec" data-id="${r.id}">${icon('edit')}Editar</button>
        <button class="btn ghost sm" data-act="toggle-rec" data-id="${r.id}">${icon(r.active ? 'pause' : 'play')}${r.active ? 'Pausar' : 'Ativar'}</button>
        <button class="btn danger sm" data-act="del-rec" data-id="${r.id}">${icon('trash')}Excluir</button></div></article>`;
  }).join('');
  const total = st.recurring.filter((r) => r.active).length;
  return `<div class="pagehead"><div><h1>Recorrentes</h1><p class="muted">Cadastre uma vez; as próximas cobranças aparecem sozinhas. ${total} ativa(s).</p></div><button class="btn" data-act="new-rec">${icon('plus')}Nova recorrente</button></div>
  <div class="reccards">${cards || '<div class="card empty">Nenhuma despesa recorrente ainda.</div>'}</div>`;
}

function donut(groups) {
  let off = 0;
  const arcs = groups.map((g) => { const a = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${solid(g.cat.hue)}" pathLength="100" stroke-dasharray="${g.pct} ${100 - g.pct}" stroke-dashoffset="${-off}"/>`; off += g.pct; return a; }).join('');
  return `<svg viewBox="0 0 42 42" role="img" aria-label="Despesas por categoria"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eef1f6"/>${arcs}</svg>`;
}
function viewRelatorio() {
  const s = L.monthSummary(st, ui.month);
  const rows = s.groups.map((g) => {
    const open = ui.open.has(g.cat.id);
    const det = open ? `<div class="det">${g.items.map((e) => `<div><span>→ ${esc(e.name)} <span class="muted">· ${L.fmtShort(e.date)}</span></span><b>${money(e.amount)}</b></div>`).join('')}</div>` : '';
    return `<div style="background:hsl(${g.cat.hue} 85% 95%)"><button class="tr" data-act="toggle-cat" data-id="${g.cat.id}" aria-expanded="${open}">
      <span class="nm">${catIco(g.cat)}<span>${esc(g.cat.name)}<small>${g.items.length} lançamento(s)</small></span></span>
      <span class="v">${money(g.total)}</span><span class="p">${L.fmtPct(g.pct)} <span class="chev" style="display:inline-block">${icon('right')}</span></span></button>${det}</div>`;
  }).join('');
  const legend = s.groups.map((g) => `<div><span class="dot" style="background:${solid(g.cat.hue)}"></span><span>${esc(g.cat.name)}</span><span>${money(g.total)}</span><span>${L.fmtPct(g.pct)}</span></div>`).join('');
  const sem = s.weeks.toFixed(1).replace('.', ',');
  return `<div class="pagehead noprint"><div><h1>Relatório</h1></div><div class="flex"><button class="btn ghost" data-act="print">Imprimir</button>${monthNav()}</div></div>
  <div class="rep">
    <div class="rephead"><div class="tt">${houseSolid}<div><h1>Despesas de Casa</h1><small>Controle Mensal · ${L.fmtMonth(ui.month)}</small></div></div></div>
    <div class="stats" style="margin-bottom:0">
      <div class="stat t-blue"><span class="lbl">${icon('wallet')}Total de despesas</span><span class="big">${money(s.total)}</span><span class="sub">${s.entries.length} lançamento(s)</span></div>
      ${s.perPerson != null ? `<div class="stat t-green"><span class="lbl">${icon('home')}Custo por pessoa</span><span class="big">${money(s.perPerson)}</span><span class="sub">${s.residents} pessoa(s)</span></div>` : `<div class="stat t-green"><span class="lbl">${icon('home')}Custo por pessoa</span><span class="big">—</span><span class="sub">Informe os moradores em Configurações</span></div>`}
      <div class="stat t-orange"><span class="lbl">${icon('cart')}Maior categoria</span><span class="big" style="font-size:clamp(20px,4.6vw,26px)">${s.top ? esc(s.top.cat.name) : '—'}</span><span class="sub">${s.top ? L.fmtPct(s.top.pct) + ' do total · ' + money(s.top.total) : ''}</span></div>
      <div class="stat t-purple"><span class="lbl">${icon('calc')}Média por semana</span><span class="big">${money(s.perWeek)}</span><span class="sub">(${sem} semanas)</span></div>
    </div>
    <div class="repgrid">
      <div class="tbl"><div class="th"><span>Categoria</span><span>Valor mensal</span><span>% do total</span></div>${rows || '<div class="empty">Sem lançamentos neste mês.</div>'}
        <div class="tt2"><span>TOTAL</span><span>${money(s.total)}</span><span>${s.total ? '100,0%' : '—'}</span></div></div>
      <div class="donutbox"><h2>Despesas por categoria</h2><div class="donut">${donut(s.groups)}<div class="mid"><b>${money(s.total)}</b><span>Total mensal</span></div></div><div class="legend">${legend}</div></div>
    </div>
    <div class="bottom3">
      <div class="bigcard t-green"><span class="ico">${icon('users')}</span><div><b>Divisão por morador</b><b class="n">${s.perPerson != null ? money(s.perPerson) : '—'}</b><small>${s.perPerson != null ? `por pessoa / mês · ${money(s.total)} ÷ ${s.residents}` : 'Número de moradores não informado'}</small></div></div>
      <div class="bigcard t-pink"><span class="ico">${icon('calendar')}</span><div><b>Por semana</b><b class="n">${money(s.perWeek)}</b><small>${money(s.total)} ÷ ${sem} semanas</small></div></div>
      <div class="bigcard t-orange"><span class="ico">${icon('clock')}</span><div><b>Ainda a pagar</b><b class="n">${money(s.planned)}</b><small>previsto no mês, ainda não pago</small></div></div>
    </div>
    <p class="note">O total soma as despesas lançadas e as cobranças das recorrentes do mês (pagas e previstas). Toque numa categoria para ver o que formou o valor.</p>
  </div>`;
}

function shareSection() {
  const l = store.getLink();
  if (!cloud.enabled()) return '';
  if (!l) return `<section class="card"><h2 style="margin-bottom:8px">Compartilhar com a casa</h2>
    <p class="muted" style="margin-bottom:12px">Para você e sua família verem as mesmas contas em celulares diferentes, sem lançar duas vezes. Os dados passam a ficar também num serviço online, protegidos por um <b>código da casa</b>.</p>
    <div class="flex"><button class="btn" data-act="cloud-create">Criar a casa com os dados deste celular</button><button class="btn ghost" data-act="cloud-join">Já tenho o código</button></div></section>`;
  const msg = { ok: 'Sincronizado', idle: 'Compartilhado', syncing: 'Sincronizando…', offline: 'Sem conexão', fora: 'Serviço fora do ar', codigo: 'Código recusado' }[sync.state] || '';
  return `<section class="card"><h2 style="margin-bottom:8px">Compartilhar com a casa</h2>
    <p class="muted" style="margin-bottom:12px">Este celular está ligado à casa. ${msg}${l.lastOk ? ` · última vez às ${hhmm(l.lastOk)}` : ''}.</p>
    <div class="flex"><button class="btn ghost" data-act="sync-now">Sincronizar agora</button><button class="btn ghost" data-act="cloud-show">Mostrar o código</button><button class="btn danger" data-act="cloud-unlink">Desligar neste celular</button></div></section>`;
}

function viewConfig() {
  const cats = st.categories.map((c) => `<div class="setrow">${catIco(c)}<div style="flex:1;font-weight:700">${esc(c.name)}</div>
    <button class="iconbtn" data-act="ren-cat" data-id="${c.id}" aria-label="Renomear ${esc(c.name)}">${icon('edit')}</button>
    ${c.id === 'outros' ? '' : `<button class="iconbtn" data-act="del-cat" data-id="${c.id}" aria-label="Excluir ${esc(c.name)}">${icon('trash')}</button>`}</div>`).join('');
  return `<div class="pagehead"><div><h1>Configurações</h1></div></div>
  <div class="cards">
    <section class="card"><h2 style="margin-bottom:12px">Geral</h2>
      <form id="cfg"><div class="two"><div class="field"><label for="c-res">Número de moradores</label><input id="c-res" name="res" inputmode="numeric" value="${st.settings.residents || ''}" placeholder="Ex.: 7"></div>
      <div class="field"><label for="c-av">Disponível hoje (£)</label><input id="c-av" name="av" inputmode="decimal" value="${L.availableNow(st) ? (L.availableNow(st) / 100).toFixed(2).replace(/\.00$/, '') : ''}" placeholder="0"></div></div>
      <div class="field"><label>Moeda</label><input value="GBP (£)" disabled></div><button class="btn">Salvar</button></form></section>
    ${shareSection()}
    <section class="card"><div class="sechead"><h2>Categorias</h2><button class="btn ghost sm" data-act="add-cat">${icon('plus')}Nova categoria</button></div>${cats}
      <p class="note">Ao excluir uma categoria, o que era dela passa para “Outros”.</p></section>
    <section class="card"><h2 style="margin-bottom:8px">Seus dados</h2>
      <div class="warn" style="margin-bottom:14px">${store.getLink() ? '<b>Onde ficam os dados:</b> neste celular e também no serviço online da casa. Quem tem o código vê e altera tudo. Limpar o navegador não perde nada, porque dá para entrar de novo com o código.' : '<b>Onde ficam os dados:</b> só neste navegador, neste aparelho. O que você lança no computador <b>não aparece no celular</b>, e <b>limpar os dados do navegador apaga tudo</b>. Use “Exportar” de vez em quando para guardar uma cópia.'}</div>
      <div class="flex"><button class="btn ghost" data-act="export">${icon('download')}Exportar cópia</button>${store.getLink() ? '' : `<button class="btn ghost" data-act="import">${icon('upload')}Importar cópia</button>`}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
      <div class="flex">${store.getLink() ? '' : '<button class="btn ghost" data-act="reset-demo">Restaurar demonstração</button>'}<button class="btn danger" data-act="reset-empty">Apagar tudo e começar do zero</button></div></section>
  </div>`;
}

const VIEWS = { visao: viewVisao, proximas: viewProximas, despesas: viewDespesas, recorrentes: viewRecorrentes, relatorio: viewRelatorio, config: viewConfig };
const route = () => { const r = location.hash.replace('#/', ''); return VIEWS[r] ? r : 'visao'; };

function render() {
  const r = route(), today = L.todayISO();
  $('#view').innerHTML = VIEWS[r](today);
  const links = NAV.map(([k, long, short, ic]) => `<a href="#/${k}" ${k === r ? 'aria-current="page"' : ''}>${icon(ic)}<span class="L">${long}</span></a>`);
  $('#side').innerHTML = `<div class="brand">${houseSolid}Despesas de Casa</div>` + links.map((a) => a.replace('<a ', '<a class="navlink" ')).join('');
  $('#tabbar').innerHTML = NAV.map(([k, , short, ic]) => `<a href="#/${k}" ${k === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${short}</span></a>`).join('');
  $('#fab').hidden = r === 'relatorio' || r === 'config';
}

// ---------- formulários ----------
function openForm(title, html, onSubmit, { submitLabel = 'Salvar', extra = '' } = {}) {
  const m = $('#modal');
  m.innerHTML = `<form class="sheet" novalidate role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}<div class="err" id="ferr" hidden></div>
    <div class="btns"><button type="button" class="btn ghost" data-act="close">Cancelar</button>${extra}<button class="btn" value="save">${submitLabel}</button></div></form>`;
  m.hidden = false;
  const f = m.querySelector('form');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    data._again = ev.submitter?.value === 'again';
    data._active = f.querySelector('[name=active]')?.checked;
    const err = onSubmit(data);
    if (err) { const e = $('#ferr'); e.textContent = err; e.hidden = false; }
  });
  setTimeout(() => f.querySelector('input:not([type=date]),select')?.focus(), 30);
}
const closeModal = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; };
const catOptions = (sel) => st.categories.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

function expenseForm(id, again) {
  const e = id ? st.expenses.find((x) => x.id === id) : null;
  const today = L.todayISO();
  const last = again?.cat;
  openForm(e ? 'Editar despesa' : 'Nova despesa', `
    <div class="field"><label for="f-amt">Valor (£)</label><input id="f-amt" name="amount" inputmode="decimal" autocomplete="off" placeholder="126.40" value="${e ? (e.amount / 100).toFixed(2) : ''}"></div>
    <div class="field"><label for="f-desc">Descrição</label><input id="f-desc" name="desc" autocomplete="off" placeholder="Ex.: Tesco" value="${esc(e?.desc)}"></div>
    <div class="two"><div class="field"><label for="f-cat">Categoria</label><select id="f-cat" name="cat">${catOptions(e?.cat || last || 'mercado')}</select></div>
    <div class="field"><label for="f-date">Data</label><input id="f-date" name="date" type="date" value="${e?.date || today}"></div></div>
    <div class="field"><label for="f-note">Observação</label><input id="f-note" name="note" autocomplete="off" value="${esc(e?.note)}"></div>`,
  (d) => {
    const amount = L.parseMoney(d.amount);
    if (!(amount > 0)) return 'Informe um valor maior que zero.';
    if (!d.desc.trim()) return 'Informe a descrição.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Informe a data.';
    const rec = { id: e?.id || uid('e'), date: d.date, desc: d.desc.trim(), cat: d.cat, amount, note: d.note.trim(), u: Date.now() };
    if (e) Object.assign(e, rec); else st.expenses.push(rec);
    persist(); closeModal();
    if (!e) ui.month = L.monthOf(d.date) === ui.month ? ui.month : ui.month;
    render(); toast(e ? 'Despesa atualizada.' : `Despesa salva: ${money(amount)}`);
    if (d._again) expenseForm(null, { cat: d.cat });
  }, { extra: e ? '' : '<button class="btn ghost" value="again">Salvar e outra</button>' });
}

function recurringForm(id) {
  const r = id ? st.recurring.find((x) => x.id === id) : null;
  const today = L.todayISO();
  openForm(r ? 'Editar recorrente' : 'Nova recorrente', `
    <div class="field"><label for="r-name">Nome</label><input id="r-name" name="name" autocomplete="off" placeholder="Ex.: Internet" value="${esc(r?.name)}"></div>
    <div class="two"><div class="field"><label for="r-amt">Valor (£)</label><input id="r-amt" name="amount" inputmode="decimal" autocomplete="off" value="${r ? (r.amount / 100).toFixed(2) : ''}"></div>
    <div class="field"><label for="r-freq">Frequência</label><select id="r-freq" name="freq">${[['monthly', 'Mensal'], ['weekly', 'Semanal'], ['annual', 'Anual']].map(([v, t]) => `<option value="${v}" ${r?.freq === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="two"><div class="field"><label for="r-cat">Categoria</label><select id="r-cat" name="cat">${catOptions(r?.cat || 'outros')}</select></div>
    <div class="field"><label for="r-start">Primeira cobrança</label><input id="r-start" name="start" type="date" value="${r?.start || L.addDays(today, 1)}"></div></div>
    <p class="note" style="margin:-4px 0 12px">Dessa data saem o dia do mês (mensal), o dia da semana (semanal) ou o dia do ano (anual). Cobranças de datas já passadas ficam como atrasadas até você marcar como pagas.</p>
    <div class="field"><label for="r-acc">Conta / forma de pagamento</label><input id="r-acc" name="account" list="accs" autocomplete="off" placeholder="Ex.: Débito automático" value="${esc(r?.account)}"><datalist id="accs"><option value="Débito automático"><option value="Cartão de crédito"><option value="Conta corrente"><option value="Dinheiro"></datalist></div>
    <div class="field"><label for="r-note">Observação</label><input id="r-note" name="note" autocomplete="off" value="${esc(r?.note)}"></div>
    <label class="check"><input type="checkbox" name="active" ${r && !r.active ? '' : 'checked'}>Ativa</label>`,
  (d) => {
    const amount = L.parseMoney(d.amount);
    if (!d.name.trim()) return 'Informe o nome.';
    if (!(amount > 0)) return 'Informe um valor maior que zero.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start)) return 'Informe a data da primeira cobrança.';
    const rec = { id: r?.id || uid('r'), name: d.name.trim(), cat: d.cat, amount, freq: d.freq, start: d.start, account: d.account.trim(), note: d.note.trim(), active: !!d._active, u: Date.now() };
    if (r) Object.assign(r, rec); else st.recurring.push(rec);
    persist(); closeModal(); render(); toast(r ? 'Recorrente atualizada.' : 'Recorrente cadastrada. As próximas cobranças já foram calculadas.');
  });
}

function nameForm(title, current, cb) {
  openForm(title, `<div class="field"><label for="n-name">Nome</label><input id="n-name" name="name" autocomplete="off" value="${esc(current)}"></div>`, (d) => {
    const n = d.name.trim();
    if (!n) return 'Informe o nome.';
    if (st.categories.some((c) => c.name.toLowerCase() === n.toLowerCase() && c.name !== current)) return 'Já existe uma categoria com esse nome.';
    cb(n); persist(); closeModal(); render();
  });
}

function editAvailable() {
  const el = $('#avail');
  if (!el || el.querySelector('input')) return;
  el.innerHTML = `<span class="lbl">${icon('wallet')}Disponível hoje (£)</span><input inputmode="decimal" aria-label="Disponível hoje" value="${L.availableNow(st) ? (L.availableNow(st) / 100).toFixed(2).replace(/\.00$/, '') : ''}" placeholder="0"><span class="sub">Enter para salvar</span>`;
  const inp = el.querySelector('input');
  inp.focus(); inp.select();
  let done = false;
  const commit = () => {
    if (done) return; done = true;
    const v = inp.value.trim() === '' ? 0 : parseSigned(inp.value);
    if (Number.isNaN(v)) { toast('Valor inválido.'); } else { if (v !== L.availableNow(st)) L.setAvailable(st, v); persist(); }
    render();
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { done = true; render(); } });
  inp.addEventListener('blur', commit);
}

// ---------- nuvem: criar / entrar ----------
const errText = (e) => ({ offline: 'Sem conexão com o serviço online. Tente de novo quando a internet voltar.', fora: 'O serviço online não está respondendo agora. Nada foi alterado. Tente mais tarde.', codigo: 'Código não reconhecido. Confira as letras e números.', ja_existe: 'Já existe uma casa criada. Use “Já tenho o código” neste celular.', invalido: 'Não foi possível criar a casa.' }[e.kind] || 'Algo deu errado. Nada foi alterado.');
function showCode(code, first) {
  openForm('Código da casa', `<p style="margin-bottom:10px">${first ? '<b>A casa foi criada.</b> ' : ''}Este é o código. Quem tiver o código <b>vê e altera todas as contas</b>; sem ele, ninguém entra.</p>
    <div style="font-size:26px;font-weight:800;letter-spacing:.04em;text-align:center;padding:16px;background:#eaf0f9;border-radius:14px;margin-bottom:12px;user-select:all">${cloud.prettyCode(code)}</div>
    <p class="note" style="margin:0 0 10px">${first ? 'Anote agora (Notas, gerenciador de senhas). No celular da sua esposa: abra o mesmo link, vá em Configurações → “Já tenho o código” e digite estes caracteres.' : 'No outro celular: Configurações → “Já tenho o código”.'}</p>`,
  () => { closeModal(); render(); }, { submitLabel: 'Entendi' });
  $('#modal .btn.ghost[data-act=close]')?.remove();
}
function cloudCreate() {
  const demoWarn = st.demo ? '\n\nAtenção: estes ainda são os dados de DEMONSTRAÇÃO. Se você quer começar do zero, cancele e use antes “Apagar tudo e começar do zero”.' : '';
  if (!confirm('Criar a casa na nuvem com os dados deste celular?\nUma cópia de segurança fica guardada neste celular antes.' + demoWarn)) return;
  store.backup();
  toast('Criando a casa…');
  cloud.createHouse(st).then((code) => { sync.state = 'ok'; renderSyncbar(); showCode(code, true); render(); })
    .catch((e) => toast(errText(e)));
}
function cloudJoin() {
  openForm('Entrar na casa', `<p class="note" style="margin:0 0 12px">Os dados que estão neste celular serão <b>substituídos</b> pelos da casa. (Uma cópia de segurança fica guardada aqui.)</p>
    <div class="field"><label for="j-code">Código da casa</label><input id="j-code" name="code" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase"></div>`,
  (d) => {
    const code = cloud.normalizeCode(d.code);
    if (code.length < 16) return 'O código tem 16 letras e números.';
    $('#ferr').hidden = true;
    cloud.fetchHouse(code).then((h) => {
      store.backup(); st = h.state; store.setLink({ code: h.code, version: h.version, lastOk: Date.now() }); store.save(st);
      sync.state = 'ok'; closeModal(); renderSyncbar(); render(); toast('Entrou na casa. Dados carregados.');
    }).catch((e) => { const el = $('#ferr'); el.textContent = errText(e); el.hidden = false; });
  }, { submitLabel: 'Entrar' });
}

// ---------- cliques ----------
const HUES = [212, 135, 45, 265, 345, 18, 165, 290, 85, 190, 320, 60];
document.addEventListener('click', (ev) => {
  if (ev.target === $('#modal')) return closeModal();
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    case 'close': return closeModal();
    case 'month': ui.month = L.addMonthsYM(ui.month, +b.dataset.d); return render();
    case 'pay': L.markPaid(st, b.dataset.rec, b.dataset.date); persist(); render(); return toast('Paga — descontada do disponível.');
    case 'unpay': L.unmarkPaid(st, b.dataset.rec, b.dataset.date); persist(); render(); return toast('Pagamento desfeito — valor devolvido ao disponível.');
    case 'new-exp': return expenseForm();
    case 'edit-exp': return expenseForm(id);
    case 'del-exp': { const e = st.expenses.find((x) => x.id === id); if (e && confirm(`Excluir “${e.desc}” (${money(e.amount)})?`)) { L.removeRec(st, 'expenses', id); persist(); render(); toast('Despesa excluída.'); } return; }
    case 'new-rec': return recurringForm();
    case 'edit-rec': return recurringForm(id);
    case 'toggle-rec': { const r = st.recurring.find((x) => x.id === id); r.active = !r.active; r.u = Date.now(); persist(); render(); return toast(r.active ? 'Recorrente ativada.' : 'Recorrente pausada.'); }
    case 'del-rec': { const r = st.recurring.find((x) => x.id === id); if (confirm(`Excluir a recorrente “${r.name}”?\nO que já foi pago continua nos relatórios; as cobranças futuras somem.`)) { L.removeRec(st, 'recurring', id); persist(); render(); toast('Recorrente excluída.'); } return; }
    case 'toggle-cat': ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); return render();
    case 'edit-available': return editAvailable();
    case 'add-cat': return nameForm('Nova categoria', '', (n) => {
      const used = new Set(st.categories.map((c) => c.hue));
      st.categories.push({ id: uid('c'), name: n, hue: HUES.find((h) => !used.has(h)) ?? Math.floor(Math.random() * 360), icon: 'tag', u: Date.now() });
      toast('Categoria criada.');
    });
    case 'ren-cat': { const c = st.categories.find((x) => x.id === id); return nameForm('Renomear categoria', c.name, (n) => { c.name = n; c.u = Date.now(); }); }
    case 'del-cat': { const c = st.categories.find((x) => x.id === id); if (confirm(`Excluir a categoria “${c.name}”?\nO que era dela passa para “Outros”.`)) { L.deleteCategory(st, id); persist(); render(); toast('Categoria excluída.'); } return; }
    case 'sync-now': return scheduleSync(0), toast('Sincronizando…');
    case 'cloud-create': return cloudCreate();
    case 'cloud-join': return cloudJoin();
    case 'cloud-show': return showCode(store.getLink().code, false);
    case 'cloud-unlink': if (confirm('Desligar a casa neste celular?\nOs dados continuam aqui, mas deixam de ser compartilhados. A casa na nuvem não é apagada.')) { store.setLink(null); sync.state = 'off'; renderSyncbar(); render(); toast('Desligado. Os dados ficaram neste celular.'); } return;
    case 'print': return window.print();
    case 'export': {
      const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), el = document.createElement('a');
      el.href = url; el.download = `despesas-de-casa-${L.todayISO()}.json`; el.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return toast('Cópia exportada.');
    }
    case 'import': {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        try {
          const s = JSON.parse(await inp.files[0].text());
          if (!store.valid(s)) throw 0;
          if (!confirm('Substituir os dados atuais pelos desta cópia?')) return;
          st = s; persist(); render(); toast('Cópia importada.');
        } catch { toast('Esse arquivo não parece uma cópia do aplicativo.'); }
      };
      return inp.click();
    }
    case 'reset-demo': if (confirm('Substituir tudo pelos dados de demonstração?')) { st = store.demo(); persist(); render(); toast('Demonstração restaurada.'); } return;
    case 'reset-empty': if (store.getLink()) { if (confirm('Apagar TODOS os lançamentos da casa, nos dois celulares?\nIsso não dá para desfazer.')) { L.clearAll(st); persist(); render(); toast('Tudo apagado.'); } return; }
      if (confirm('Apagar TODOS os dados deste navegador e começar do zero?\nExporte uma cópia antes se quiser guardá-los.')) { st = store.fresh(); persist(); render(); toast('Tudo apagado.'); } return;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-act=edit-available]')) { e.preventDefault(); editAvailable(); }
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'cfg') return;
  ev.preventDefault();
  const f = new FormData(ev.target);
  const res = String(f.get('res')).trim(), av = String(f.get('av')).trim();
  const r = res === '' ? 0 : Number(res), a = av === '' ? 0 : parseSigned(av);
  if (!Number.isInteger(r) || r < 0 || r > 99) return toast('Número de moradores inválido.');
  if (Number.isNaN(a)) return toast('Valor disponível inválido.');
  st.settings.residents = r; st.settings.u = Date.now(); if (a !== L.availableNow(st)) L.setAvailable(st, a); persist(); toast('Configurações salvas.');
});
$('#fab').addEventListener('click', () => expenseForm());
window.addEventListener('hashchange', () => { if (st) render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && st && $('#modal').hidden) render(); });
renderSyncbar();
async function boot() {
  if (!st) { // ligado à nuvem, mas sem cópia local: busca antes de mostrar qualquer tela
    $('#fab').hidden = true;
    $('#view').innerHTML = '<div class="card empty"><b>Carregando os dados da casa…</b></div>';
    try {
      const l = store.getLink();
      const h = await cloud.fetchHouse(l.code);
      st = h.state; store.save(st); store.setLink({ ...l, version: h.version, lastOk: Date.now() });
    } catch (e) {
      $('#view').innerHTML = `<div class="card empty"><h2 style="margin-bottom:8px">Não consegui carregar os dados da casa</h2><p>${esc(errText(e))}</p><p class="muted" style="margin-top:6px">Seus dados não foram apagados: eles estão no serviço online.</p><div class="btns" style="justify-content:center;margin-top:14px"><button class="btn" onclick="location.reload()">Tentar de novo</button></div></div>`;
      return;
    }
  }
  render();
  if (store.getLink()) scheduleSync(100);
}
boot();
document.addEventListener('visibilitychange', () => { if (!document.hidden && store.getLink()) scheduleSync(200); });
setInterval(() => { if (!document.hidden && store.getLink()) scheduleSync(0); }, 30000);
