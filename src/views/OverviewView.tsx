import { CountUp } from '../components/CountUp';
import { useData } from '../data/DataContext';
import { computeBalances, formatINR, formatMonth, monthKey, sourceTotalsForMonth, toISODate } from '../lib/money';
import { sourceLabel } from '../lib/sources';

function toneClass(paise: number): string {
  return paise > 0 ? 'pos' : paise < 0 ? 'neg' : 'zero';
}

export function OverviewView() {
  const { accounts, transactions } = useData();
  const { byAccount, total } = computeBalances(accounts, transactions);
  const month = monthKey(toISODate(new Date()));
  const rows = sourceTotalsForMonth(transactions, month);

  return (
    <div className="stack">
      <section aria-labelledby="nw-label" className="hero reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <p id="nw-label" className="label">Net worth</p>
        <p className="big mono"><CountUp paise={total} /></p>
      </section>

      <section aria-labelledby="bal-label" className="reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 id="bal-label" className="section-title">Accounts</h2>
        <ul className="list">
          {accounts.map((a) => (
            <li key={a.id} className="list-row">
              <span>{a.name}</span>
              <CountUp className="mono" paise={byAccount[a.id] ?? 0} />
            </li>
          ))}
        </ul>
        {accounts.length === 0 && <p className="muted">No accounts yet.</p>}
      </section>

      <section aria-labelledby="src-label" className="reveal" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 id="src-label" className="section-title">
          By source <span className="muted mono">{formatMonth(month)}</span>
        </h2>
        <div className="table" role="table" aria-label="Totals per source this month">
          <div className="table-row table-head" role="row">
            <span role="columnheader">Source</span>
            <span role="columnheader" className="num">In</span>
            <span role="columnheader" className="num">Out</span>
            <span role="columnheader" className="num">Net</span>
          </div>
          {rows.map((r) => (
            <div key={r.sourceId} className="table-row" role="row">
              <span role="cell">{sourceLabel(r.sourceId)}</span>
              <span role="cell" className={`num mono ${r.income > 0 ? 'pos' : 'zero'}`}>{formatINR(r.income)}</span>
              <span role="cell" className={`num mono ${r.expense > 0 ? 'neg' : 'zero'}`}>{formatINR(r.expense)}</span>
              <span role="cell" className={`num mono ${toneClass(r.net)}`}>{formatINR(r.net)}</span>
            </div>
          ))}
        </div>
        {transactions.length === 0 && <p className="muted spaced">No transactions yet. Add your first one to get started.</p>}
      </section>
    </div>
  );
}
