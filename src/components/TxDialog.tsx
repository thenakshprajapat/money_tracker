import { Lock, LockOpen, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useData } from '../data/DataContext';
import { computeBalances, formatDateObj, formatINR, isLocked, lockDate, paiseToInput, parseAmount, toISODate } from '../lib/money';
import { sourcesFor } from '../lib/sources';
import type { SourceId, Transaction, TxInput, TxType } from '../lib/types';

const TYPES: readonly { id: TxType; label: string }[] = [
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
  { id: 'transfer', label: 'Transfer' },
];

interface Props {
  target: Transaction | 'new';
  onClose: () => void;
}

export function TxDialog({ target, onClose }: Props) {
  const { accounts, transactions, settings, actions } = useData();
  const existing = target === 'new' ? null : target;
  const ref = useRef<HTMLDialogElement>(null);

  const locked = useMemo(
    () => (existing ? isLocked(existing.createdAt, settings.lockDays) : false),
    [existing, settings.lockDays],
  );

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? paiseToInput(existing.amountPaise) : '');
  const [date, setDate] = useState(existing?.date ?? toISODate(new Date()));
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(
    existing?.toAccountId ?? accounts.find((a) => a.id !== (existing?.accountId ?? accounts[0]?.id))?.id ?? '',
  );
  const [sourceId, setSourceId] = useState<SourceId | ''>(existing?.sourceId ?? 'personal');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const sources = sourcesFor(type);

  const preview = useMemo(() => {
    if (type !== 'transfer') return null;
    const paise = parseAmount(amount);
    const from = accounts.find((a) => a.id === accountId);
    const to = accounts.find((a) => a.id === toAccountId);
    if (!from || !to || from.id === to.id) return null;
    const others = transactions.filter((t) => t.id !== existing?.id);
    const bal = computeBalances(accounts, others).byAccount;
    const delta = paise !== null && paise > 0 ? paise : 0;
    return {
      from: { name: from.name, now: bal[from.id] ?? 0, after: (bal[from.id] ?? 0) - delta },
      to: { name: to.name, now: bal[to.id] ?? 0, after: (bal[to.id] ?? 0) + delta },
    };
  }, [type, amount, accountId, toAccountId, accounts, transactions, existing]);

  function changeType(next: TxType) {
    setType(next);
    const allowed = sourcesFor(next);
    if (allowed.length > 0 && !allowed.some((s) => s.id === sourceId)) {
      setSourceId(allowed[0].id);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    const amountPaise = parseAmount(amount);
    if (amountPaise === null || amountPaise <= 0) return setError('Enter an amount greater than zero, with at most two decimals.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick a valid date.');
    if (!accountId) return setError('Choose an account.');
    if (type === 'transfer') {
      if (!toAccountId) return setError('Choose the account to transfer to.');
      if (toAccountId === accountId) return setError('Choose two different accounts.');
    } else if (!sourceId) {
      return setError('Choose a source.');
    }
    const input: TxInput = {
      type,
      amountPaise,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      sourceId: type === 'transfer' ? null : (sourceId as SourceId),
      note: note.trim(),
    };
    if (existing) actions.updateTransaction(existing.id, input);
    else actions.addTransaction(input);
    ref.current?.close();
  }

  function remove() {
    if (!existing || locked) return;
    if (!confirmDelete) return setConfirmDelete(true);
    actions.deleteTransaction(existing.id);
    ref.current?.close();
  }

  const title = !existing ? 'Add transaction' : locked ? 'Transaction' : 'Edit transaction';

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="tx-dialog-title"
    >
      <form onSubmit={submit} className="dialog-body" noValidate>
        <div className="dialog-head">
          <h2 id="tx-dialog-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {existing && (
          <p className={`lock-note${locked ? ' is-locked' : ''}`}>
            {locked ? <Lock size={14} strokeWidth={1.5} aria-hidden="true" /> : <LockOpen size={14} strokeWidth={1.5} aria-hidden="true" />}
            {locked
              ? `Locked on ${formatDateObj(lockDate(existing.createdAt, settings.lockDays))}. It can no longer be changed.`
              : `Locks on ${formatDateObj(lockDate(existing.createdAt, settings.lockDays))}.`}
          </p>
        )}

        <fieldset className="field" disabled={locked}>
          <div className="segmented" role="radiogroup" aria-label="Type">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                className={type === t.id ? 'on' : ''}
                onClick={() => changeType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-grid" disabled={locked}>
          <label className="field">
            <span>Amount (₹)</span>
            <input
              className="mono"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!existing}
              id="tx-amount"
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input className="mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} id="tx-date" />
          </label>
          <label className="field">
            <span>{type === 'transfer' ? 'From account' : 'Account'}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} id="tx-account">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          {type === 'transfer' ? (
            <label className="field">
              <span>To account</span>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} id="tx-to-account">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Source</span>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value as SourceId)} id="tx-source">
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field span-2">
            <span>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} id="tx-note" />
          </label>
        </fieldset>

        {preview && (
          <div className="transfer-preview" aria-live="polite">
            {[preview.from, preview.to].map((p) => (
              <div key={p.name} className="tp-row">
                <span>{p.name}</span>
                <span className="mono muted">{formatINR(p.now)}</span>
                <span className="muted" aria-hidden="true">→</span>
                <span className={`mono ${p.after < 0 ? 'neg' : ''}`}>{formatINR(p.after)}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        {!locked && (
          <div className="dialog-actions">
            {existing ? (
              <button type="button" className={`btn ${confirmDelete ? 'danger' : 'ghost'}`} onClick={remove}>
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn primary" id="tx-save">
              {existing ? 'Save' : 'Add'}
            </button>
          </div>
        )}
      </form>
    </dialog>
  );
}
