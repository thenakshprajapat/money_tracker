import { describe, expect, it } from 'vitest';
import {
  computeBalances,
  filterTransactions,
  EMPTY_FILTERS,
  formatDate,
  formatINR,
  formatMonth,
  isLocked,
  lockDate,
  monthlySummary,
  paiseToInput,
  parseAmount,
  sortNewestFirst,
  sourceTotalsForMonth,
} from './money';
import type { Account, Transaction } from './types';

const accounts: Account[] = [
  { id: 'a', name: 'A', openingPaise: 100000, order: 0 },
  { id: 'b', name: 'B', openingPaise: 0, order: 1 },
];

let n = 0;
function tx(p: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    type: 'income',
    amountPaise: 100,
    date: '2026-10-10',
    accountId: 'a',
    toAccountId: null,
    sourceId: 'mom',
    note: '',
    createdAt: new Date(2026, 9, 10, 12, 0, n),
    updatedAt: new Date(2026, 9, 10, 12, 0, n),
    ...p,
  };
}

describe('formatting', () => {
  it('uses Indian grouping', () => {
    expect(formatINR(10000000)).toBe('₹1,00,000.00');
    expect(formatINR(1234567890)).toBe('₹1,23,45,678.90');
    expect(formatINR(5)).toBe('₹0.05');
  });
  it('formats dates and months', () => {
    expect(formatDate('2026-10-28')).toBe('28 Oct 2026');
    expect(formatDate('2026-09-01')).toBe('1 Sep 2026');
    expect(formatMonth('2026-10')).toBe('Oct 2026');
  });
});

describe('parseAmount', () => {
  it('parses without float error', () => {
    expect(parseAmount('1,250.5')).toBe(125050);
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('19.99')).toBe(1999);
    expect(parseAmount('₹10')).toBe(1000);
  });
  it('rejects bad input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });
  it('allows negatives when asked', () => {
    expect(parseAmount('-5.5', true)).toBe(-550);
    expect(paiseToInput(-550)).toBe('-5.50');
    expect(paiseToInput(125050)).toBe('1250.50');
  });
});

describe('computeBalances', () => {
  it('starts from opening balances', () => {
    const r = computeBalances(accounts, []);
    expect(r.byAccount).toEqual({ a: 100000, b: 0 });
    expect(r.total).toBe(100000);
  });
  it('applies income and expense', () => {
    const r = computeBalances(accounts, [
      tx({ type: 'income', amountPaise: 5000 }),
      tx({ type: 'expense', amountPaise: 2000, sourceId: 'personal', accountId: 'b' }),
    ]);
    expect(r.byAccount).toEqual({ a: 105000, b: -2000 });
    expect(r.total).toBe(103000);
  });
  it('moves money with a transfer without changing net worth', () => {
    const r = computeBalances(accounts, [
      tx({ type: 'transfer', amountPaise: 30000, accountId: 'a', toAccountId: 'b', sourceId: null }),
    ]);
    expect(r.byAccount).toEqual({ a: 70000, b: 30000 });
    expect(r.total).toBe(100000);
  });
});

describe('sourceTotalsForMonth', () => {
  const txs = [
    tx({ amountPaise: 1000, sourceId: 'mom', date: '2026-10-02' }),
    tx({ amountPaise: 500, sourceId: 'mom', date: '2026-09-30' }),
    tx({ type: 'expense', amountPaise: 300, sourceId: 'personal', date: '2026-10-05' }),
    tx({ amountPaise: 700, sourceId: 'personal', date: '2026-10-06' }),
    tx({ type: 'transfer', amountPaise: 9999, toAccountId: 'b', sourceId: null, date: '2026-10-07' }),
  ];
  it('totals the requested month only and ignores transfers', () => {
    const rows = sourceTotalsForMonth(txs, '2026-10');
    expect(rows.map((r) => r.sourceId)).toEqual(['mom', 'dad', 'rent', 'personal']);
    expect(rows[0]).toMatchObject({ income: 1000, expense: 0, net: 1000 });
    expect(rows[1]).toMatchObject({ income: 0, expense: 0, net: 0 });
    expect(rows[3]).toMatchObject({ income: 700, expense: 300, net: 400 });
  });
});

describe('monthlySummary', () => {
  it('fills gaps, ignores transfers, and keeps the latest months', () => {
    const rows = monthlySummary(
      [
        tx({ amountPaise: 100, date: '2026-07-01' }),
        tx({ type: 'expense', amountPaise: 40, sourceId: 'personal', date: '2026-09-01' }),
        tx({ type: 'transfer', amountPaise: 999, toAccountId: 'b', sourceId: null, date: '2026-08-01' }),
      ],
      new Date(2026, 9, 28),
    );
    expect(rows.map((r) => r.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(rows[0]).toMatchObject({ income: 100, expense: 0 });
    expect(rows[1]).toMatchObject({ income: 0, expense: 0 });
    expect(rows[2]).toMatchObject({ income: 0, expense: 40 });
  });
  it('limits to the last N months across a year boundary', () => {
    const rows = monthlySummary([tx({ date: '2025-11-01' })], new Date(2026, 1, 1), 3);
    expect(rows.map((r) => r.month)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('locking', () => {
  const created = new Date('2026-10-01T10:00:00Z');
  it('computes the lock date', () => {
    expect(lockDate(created, 7).toISOString()).toBe('2026-10-08T10:00:00.000Z');
  });
  it('is unlocked before and locked at/after the lock date', () => {
    expect(isLocked(created, 7, new Date('2026-10-08T09:59:59Z'))).toBe(false);
    expect(isLocked(created, 7, new Date('2026-10-08T10:00:00Z'))).toBe(true);
  });
  it('follows a changed lock period', () => {
    expect(isLocked(created, 30, new Date('2026-10-20T00:00:00Z'))).toBe(false);
  });
});

describe('filtering and sorting', () => {
  const txs = [
    tx({ date: '2026-10-01', note: 'Groceries run', sourceId: 'personal', type: 'expense' }),
    tx({ date: '2026-10-09', note: 'October rent', sourceId: 'rent' }),
    tx({ date: '2026-09-09', note: '', sourceId: 'dad', accountId: 'b' }),
    tx({ type: 'transfer', date: '2026-10-09', accountId: 'a', toAccountId: 'b', sourceId: null }),
  ];
  it('sorts newest first, ties by createdAt', () => {
    const sorted = sortNewestFirst(txs);
    expect(sorted.map((t) => t.date)).toEqual(['2026-10-09', '2026-10-09', '2026-10-01', '2026-09-09']);
    expect(sorted[0].type).toBe('transfer');
  });
  it('filters by each field', () => {
    expect(filterTransactions(txs, { ...EMPTY_FILTERS, month: '2026-09' })).toHaveLength(1);
    expect(filterTransactions(txs, { ...EMPTY_FILTERS, type: 'expense' })).toHaveLength(1);
    expect(filterTransactions(txs, { ...EMPTY_FILTERS, sourceId: 'rent' })).toHaveLength(1);
    expect(filterTransactions(txs, { ...EMPTY_FILTERS, query: 'RENT' })).toHaveLength(1);
  });
  it('matches transfers on either account', () => {
    expect(filterTransactions(txs, { ...EMPTY_FILTERS, accountId: 'b' })).toHaveLength(2);
  });
});
