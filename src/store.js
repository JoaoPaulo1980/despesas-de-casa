import { emptyState, demoState } from './demo.js';
import { todayISO } from './logic.js';
import { migrate, isValid } from './sync.js';

const KEY = 'despesas-de-casa:v1'; // mesma chave de sempre: quem já usa não perde nada
const BACKUP = 'despesas-de-casa:backup-antes-da-nuvem';
const LINK = 'despesas-de-casa:nuvem';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export const getLink = () => { const l = read(LINK); return l && l.code ? l : null; };
export function setLink(l) { try { l ? localStorage.setItem(LINK, JSON.stringify(l)) : localStorage.removeItem(LINK); return true; } catch { return false; } }

/** Devolve o estado salvo, ou null se este celular está ligado à nuvem mas perdeu a cópia local. */
export function load() {
  const s = read(KEY);
  if (isValid(s)) return migrate(s);
  if (getLink()) return null; // nunca inventar demonstração/tela vazia por cima de uma casa compartilhada
  const d = demoState(todayISO());
  save(d);
  return d;
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

/** Cópia de segurança dentro do próprio celular, antes de qualquer troca de dados. */
export function backup() {
  try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(BACKUP, raw); return true; } catch { return false; }
}

export const fresh = () => emptyState();
export const demo = () => demoState(todayISO());
export { isValid as valid, migrate };
