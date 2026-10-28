import { useData } from '../data/DataContext';
import { formatINR, formatMonth, monthlySummary } from '../lib/money';

const CHART_HEIGHT = 160;

export function SummaryView() {
  const { transactions } = useData();
  const months = monthlySummary(transactions, new Date());
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const empty = transactions.every((t) => t.type === 'transfer');

  if (empty) return <p className="muted">Nothing to summarise yet. Income and expenses will show up here by month.</p>;

  const bar = (value: number) => Math.max(value > 0 ? 2 : 0, Math.round((value / max) * CHART_HEIGHT));

  return (
    <div className="stack">
      <section aria-labelledby="chart-label">
        <h2 id="chart-label" className="section-title">
          Income and expense, last {months.length} {months.length === 1 ? 'month' : 'months'}
        </h2>
        <div className="legend">
          <span><i className="dot pos-bg" /> Income</span>
          <span><i className="dot neg-bg" /> Expense</span>
        </div>
        <div className="chart" role="img" aria-label="Bar chart of income and expense per month">
          {months.map((m, i) => (
            <div key={m.month} className="chart-col" style={{ '--i': i } as React.CSSProperties} title={`${formatMonth(m.month)}: in ${formatINR(m.income)}, out ${formatINR(m.expense)}`}>
              <div className="bars" style={{ height: CHART_HEIGHT }}>
                <div className="bar pos-bg" style={{ height: bar(m.income) }} />
                <div className="bar neg-bg" style={{ height: bar(m.expense) }} />
              </div>
              <span className="chart-label mono">{formatMonth(m.month).replace(' ', '\u00A0')}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tbl-label">
        <h2 id="tbl-label" className="section-title">Figures</h2>
        <div className="table" role="table">
          <div className="table-row table-head" role="row">
            <span role="columnheader">Month</span>
            <span role="columnheader" className="num">In</span>
            <span role="columnheader" className="num">Out</span>
            <span role="columnheader" className="num">Net</span>
          </div>
          {[...months].reverse().map((m) => {
            const net = m.income - m.expense;
            return (
              <div key={m.month} className="table-row" role="row">
                <span role="cell" className="mono">{formatMonth(m.month)}</span>
                <span role="cell" className="num mono pos">{formatINR(m.income)}</span>
                <span role="cell" className="num mono neg">{formatINR(m.expense)}</span>
                <span role="cell" className={`num mono ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}`}>{formatINR(net)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
