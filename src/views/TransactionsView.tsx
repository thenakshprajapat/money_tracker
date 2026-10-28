import { Lock, LockOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import {
  EMPTY_FILTERS,
  filterTransactions,
  formatDate,
  formatDateObj,
  formatINR,
  formatMonth,
  isLocked,
  lockDate,
  monthKey,
  type TxFilters,
} from '../lib/money';
import { SOURCES, sourceLabel } from '../lib/sources';
import type { SourceId, Transaction, TxType } from '../lib/types';

export function TransactionsView({ onOpen }: { onOpen: (tx: Transaction) => void }) {
  const { accounts, transactions, settings } = useData();
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? 'Unknown account';

  const months = useMemo(
    () => [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse(),
    [transactions],
  );
  const visible = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const now = new Date();
  const set = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="stack">
      <div className="filters">
        <input
          type="search"
          placeholder="Search notes"
          aria-label="Search notes"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
          className="search"
        />
        <select aria-label="Account" value={filters.accountId} onChange={(e) => set('accountId', e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select aria-label="Source" value={filters.sourceId} onChange={(e) => set('sourceId', e.target.value as SourceId | '')}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select aria-label="Type" value={filters.type} onChange={(e) => set('type', e.target.value as TxType | '')}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
        <select aria-label="Month" value={filters.month} onChange={(e) => set('month', e.target.value)}>
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
        {filtering && (
          <button className="link" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
        )}
      </div>

      {transactions.length === 0 ? (
        <p className="muted">No transactions yet. Use the add button to record one.</p>
      ) : visible.length === 0 ? (
        <p className="muted">Nothing matches these filters.</p>
      ) : (
        <ul className="tx-list">
          {visible.map((tx, idx) => {
            const locked = isLocked(tx.createdAt, settings.lockDays, now);
            const lockOn = formatDateObj(lockDate(tx.createdAt, settings.lockDays));
            const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
            const title = tx.type === 'transfer' ? 'Transfer' : sourceLabel(tx.sourceId);
            const where =
              tx.type === 'transfer'
                ? `${accountName(tx.accountId)} → ${accountName(tx.toAccountId)}`
                : accountName(tx.accountId);
            return (
              <li key={tx.id} className="reveal" style={{ '--i': Math.min(idx, 12) } as React.CSSProperties}>
                <button className="tx-row" onClick={() => onOpen(tx)}>
                  <span className="tx-main">
                    <span className="tx-title">{title}</span>
                    <span className="tx-sub">
                      <span className="mono">{formatDate(tx.date)}</span> · {where}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </span>
                  </span>
                  <span className="tx-end">
                    <span className={`mono tx-amt ${tx.type === 'income' ? 'pos' : tx.type === 'expense' ? 'neg' : ''}`}>
                      {sign}{formatINR(tx.amountPaise)}
                    </span>
                    <span className={`tx-lock${locked ? ' is-locked' : ''}`}>
                      {locked ? <Lock size={12} strokeWidth={1.5} aria-hidden="true" /> : <LockOpen size={12} strokeWidth={1.5} aria-hidden="true" />}
                      <span className="mono">{locked ? `Locked ${lockOn}` : `Locks ${lockOn}`}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
