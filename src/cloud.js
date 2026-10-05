import { merge, canon, migrate } from './sync.js';
import { getLink, setLink } from './store.js';

const cfg = () => window.DDC_CONFIG || {};
export const enabled = () => !!(cfg().url && cfg().key);

// Alfabeto sem letras parecidas (0/O, 1/I/L). 16 caracteres de 31 = ~79 bits: impossível de adivinhar.
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode() {
  const out = [];
  const buf = new Uint8Array(64);
  while (out.length < 16) {
    crypto.getRandomValues(buf);
    for (const b of buf) { if (b < 248 && out.length < 16) out.push(ALPHA[b % 31]); }
  }
  return out.join('');
}
export const normalizeCode = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c) => c.match(/.{1,4}/g).join('-');

export class CloudError extends Error {
  constructor(kind, msg) { super(msg || kind); this.kind = kind; }
}

async function rpc(fn, args) {
  let res;
  try {
    res = await fetch(`${cfg().url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: cfg().key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new CloudError('offline'); // sem internet, DNS, tempo esgotado, bloqueio...
  }
  let body = null;
  try { body = await res.json(); } catch { /* corpo vazio */ }
  if (!res.ok) {
    const m = body?.message || '';
    if (m === 'codigo_invalido') throw new CloudError('codigo');
    if (m === 'casa_ja_existe') throw new CloudError('ja_existe');
    if (m === 'codigo_fraco' || m === 'dados_invalidos') throw new CloudError('invalido', m);
    throw new CloudError('fora', `HTTP ${res.status}`); // serviço fora do ar, pausado, chave errada...
  }
  return body;
}

/** Cria a casa na nuvem com os dados atuais deste celular. Devolve o código (mostrar UMA vez). */
export async function createHouse(state) {
  const code = newCode();
  await rpc('casa_criar', { p_codigo: code, p_dados: { ...state, demo: false } });
  setLink({ code, version: 1, lastOk: Date.now() });
  return code;
}

/** Baixa a casa com um código (para entrar num celular novo). Não grava nada localmente. */
export async function fetchHouse(rawCode) {
  const code = normalizeCode(rawCode);
  const r = await rpc('casa_ler', { p_codigo: code });
  return { code, state: migrate(r.dados), version: r.versao };
}

/** Junta local + nuvem e grava o resultado. Devolve o estado final (já unido). */
export async function syncNow(local) {
  const link = getLink();
  if (!link) return { state: local };
  let cur = local;
  for (let i = 0; i < 4; i++) {
    const r = await rpc('casa_ler', { p_codigo: link.code });
    const remote = migrate(r.dados);
    const merged = merge(cur, remote);
    if (canon(merged) === canon(remote)) { setLink({ ...link, version: r.versao, lastOk: Date.now() }); return { state: merged }; }
    const w = await rpc('casa_gravar', { p_codigo: link.code, p_dados: merged, p_versao_base: r.versao });
    if (!w.conflito) { setLink({ ...link, version: w.versao, lastOk: Date.now() }); return { state: merged }; }
    cur = merged; // alguém gravou no meio: junta de novo e tenta outra vez
  }
  throw new CloudError('fora', 'conflito repetido');
}
