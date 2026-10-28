import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { DataProvider, useData } from './data/DataContext';
import { auth, googleProvider, isConfigured } from './lib/firebase';
import type { Transaction } from './lib/types';
import { Shell, type ViewId, VIEWS } from './components/Shell';
import { TxDialog } from './components/TxDialog';
import { OverviewView } from './views/OverviewView';
import { TransactionsView } from './views/TransactionsView';
import { SummaryView } from './views/SummaryView';
import { SettingsView } from './views/SettingsView';

function readHash(): ViewId {
  const id = window.location.hash.replace('#/', '');
  return VIEWS.some((v) => v.id === id) ? (id as ViewId) : 'overview';
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorised in Firebase. Add it under Authentication > Settings > Authorized domains.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(e instanceof Error ? e.message : 'Sign-in failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <h1 className="brand-lg">My Money</h1>
      <p className="muted">A quiet place to keep track of where it goes.</p>
      <button className="btn primary" onClick={() => void signIn()} disabled={busy} id="google-signin">
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}

function Main({ user }: { user: User }) {
  const data = useData();
  const [view, setView] = useState<ViewId>(readHash);
  const [dialog, setDialog] = useState<Transaction | 'new' | null>(null);

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let body;
  if (data.status === 'error') {
    body = <p className="error" role="alert">{data.error}</p>;
  } else if (data.status === 'loading') {
    body = <p className="muted">Loading…</p>;
  } else if (view === 'overview') {
    body = <OverviewView />;
  } else if (view === 'transactions') {
    body = <TransactionsView onOpen={setDialog} />;
  } else if (view === 'summary') {
    body = <SummaryView />;
  } else {
    body = <SettingsView user={user} />;
  }

  return (
    <Shell view={view} onAdd={() => setDialog('new')} canAdd={data.status === 'ready'}>
      {data.writeError && (
        <p className="error inline-banner" role="alert">
          {data.writeError}{' '}
          <button className="link" onClick={data.dismissWriteError}>Dismiss</button>
        </p>
      )}
      {body}
      {dialog && <TxDialog target={dialog} onClose={() => setDialog(null)} />}
    </Shell>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (!isConfigured) {
    return (
      <main className="center-screen">
        <h1 className="brand-lg">My Money</h1>
        <p className="error" role="alert">
          Firebase is not configured. Copy .env.example to .env.local, fill in your web app config, and restart the dev server.
        </p>
      </main>
    );
  }
  if (user === undefined) {
    return (
      <main className="center-screen">
        <p className="muted">Loading…</p>
      </main>
    );
  }
  if (user === null) return <SignIn />;

  return (
    <DataProvider uid={user.uid}>
      <Main user={user} />
    </DataProvider>
  );
}
