import {
  SOURCES,
} from './sources';
import type { Account, SourceId, Transaction, TxType } from './types';

/* ---------- Formatting ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 10000000 paise -> "₹1,00,000.00" */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

/** "2026-10-28" -> "28 Oct 2026" (manual, so it never depends on ICU month names). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" -> "Oct 2026" */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDateObj(d: Date): string {
  return formatDate(toISODate(d));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/* ---------- Amount parsing ---------- */

/** Parses "1,250.5" to 125050 paise. Returns null when invalid. Never uses floats for the digits. */
export function parseAmount(input: string, allowNegative = false): number | null {
  const s = input.trim().replace(/[,\s₹]/g, '');
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  if (m[1] && !allowNegative) return null;
  const paise = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(paise)) return null;
  return m[1] ? 0 - paise : paise;
}

/** 125050 -> "1250.50", for editable inputs. */
export function paiseToInput(paise: number): string {
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${paise < 0 ? '-' : ''}${whole}.${frac}`;
}

/* ---------- Balances and totals ---------- */

/** Signed effect of a transaction on one account. */
function effectOn(tx: Transaction, accountId: string): number {
  switch (tx.type) {
    case 'income':
      return tx.accountId === accountId ? tx.amountPaise : 0;
    case 'expense':
      return tx.accountId === accountId ? -tx.amountPaise : 0;
    case 'transfer':
      return (
        (tx.toAccountId === accountId ? tx.amountPaise : 0) -
        (tx.accountId === accountId ? tx.amountPaise : 0)
      );
  }
}

export interface Balances {
  byAccount: Record<string, number>;
  /** Net worth: the sum of all account balances. Transfers never change it. */
  total: number;
}

export function computeBalances(accounts: Account[], txs: Transaction[]): Balances {
  const byAccount: Record<string, number> = {};
  let total = 0;
  for (const a of accounts) {
    let bal = a.openingPaise;
    for (const tx of txs) bal += effectOn(tx, a.id);
    byAccount[a.id] = bal;
    total += bal;
  }
  return { byAccount, total };
}

export interface SourceTotal {
  sourceId: SourceId;
  income: number;
  expense: number;
  net: number;
}

/** Per-source totals for one month ("YYYY-MM"). Transfers are ignored. */
export function sourceTotalsForMonth(txs: Transaction[], month: string): SourceTotal[] {
  const rows = new Map<SourceId, SourceTotal>(
    SOURCES.map((s) => [s.id, { sourceId: s.id, income: 0, expense: 0, net: 0 }]),
  );
  for (const tx of txs) {
    if (tx.type === 'transfer' || tx.sourceId === null) continue;
    if (monthKey(tx.date) !== month) continue;
    const row = rows.get(tx.sourceId);
    if (!row) continue;
    if (tx.type === 'income') row.income += tx.amountPaise;
    else row.expense += tx.amountPaise;
    row.net = row.income - row.expense;
  }
  return SOURCES.map((s) => rows.get(s.id) as SourceTotal);
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Income vs expense per month, oldest first, gaps filled with zeros,
 * ending at the later of the current month and the latest transaction.
 */
export function monthlySummary(txs: Transaction[], now: Date, limit = 12): MonthSummary[] {
  const current = monthKey(toISODate(now));
  const totals = new Map<string, MonthSummary>();
  let first = current;
  let last = current;
  for (const tx of txs) {
    if (tx.type === 'transfer') continue;
    const key = monthKey(tx.date);
    if (key < first) first = key;
    if (key > last) last = key;
    const row = totals.get(key) ?? { month: key, income: 0, expense: 0 };
    if (tx.type === 'income') row.income += tx.amountPaise;
    else row.expense += tx.amountPaise;
    totals.set(key, row);
  }
  const out: MonthSummary[] = [];
  for (let k = first; k <= last; k = nextMonth(k)) {
    out.push(totals.get(k) ?? { month: k, income: 0, expense: 0 });
  }
  return out.slice(-limit);
}

/* ---------- Locking ---------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant a transaction becomes read-only. Mirrors the Firestore rule. */
export function lockDate(createdAt: Date, lockDays: number): Date {
  return new Date(createdAt.getTime() + lockDays * DAY_MS);
}

export function isLocked(createdAt: Date, lockDays: number, now: Date = new Date()): boolean {
  return now.getTime() >= lockDate(createdAt, lockDays).getTime();
}

/* ---------- Listing ---------- */

export interface TxFilters {
  accountId: string;
  sourceId: SourceId | '';
  type: TxType | '';
  month: string;
  query: string;
}

export const EMPTY_FILTERS: TxFilters = { accountId: '', sourceId: '', type: '', month: '', query: '' };

export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function filterTransactions(txs: Transaction[], f: TxFilters): Transaction[] {
  const q = f.query.trim().toLowerCase();
  return sortNewestFirst(txs).filter((tx) => {
    if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
    if (f.sourceId && tx.sourceId !== f.sourceId) return false;
    if (f.type && tx.type !== f.type) return false;
    if (f.month && monthKey(tx.date) !== f.month) return false;
    if (q && !tx.note.toLowerCase().includes(q)) return false;
    return true;
  });
}
