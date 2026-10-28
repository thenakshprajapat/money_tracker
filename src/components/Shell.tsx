import { ChartColumn, House, List, Plus, Settings, WifiOff, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '../data/DataContext';

export type ViewId = 'overview' | 'transactions' | 'summary' | 'settings';

export const VIEWS: readonly { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: House },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'summary', label: 'Monthly', icon: ChartColumn },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

interface ShellProps {
  view: ViewId;
  onAdd: () => void;
  canAdd: boolean;
  children: ReactNode;
}

export function Shell({ view, onAdd, canAdd, children }: ShellProps) {
  const online = useOnline();
  const { hasPendingWrites } = useData();
  const current = VIEWS.find((v) => v.id === view);

  const status = !online
    ? 'Offline. Changes will sync when you are back online.'
    : hasPendingWrites
      ? 'Syncing…'
      : null;

  const links = (
    <>
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#/${id}`}
          className={`nav-link${id === view ? ' active' : ''}`}
          aria-current={id === view ? 'page' : undefined}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><i className="brand-mark" aria-hidden="true" />My Money</div>
        <nav className="nav" aria-label="Main">{links}</nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <h1>{current?.label}</h1>
          <div className="topbar-end">
            {status && (
              <span className="status" role="status">
                {!online && <WifiOff size={14} strokeWidth={1.5} aria-hidden="true" />}
                {status}
              </span>
            )}
            <button className="btn primary desktop-only" onClick={onAdd} disabled={!canAdd} id="add-transaction">
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> Add transaction
            </button>
          </div>
        </header>
        <main className="page" key={view}>{children}</main>
      </div>

      <nav className="bottomnav" aria-label="Main">{links}</nav>
      <button className="fab" onClick={onAdd} disabled={!canAdd} aria-label="Add transaction" id="add-transaction-fab">
        <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
