import { signOut, type User } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { useData } from '../data/DataContext';
import { auth } from '../lib/firebase';
import { paiseToInput, parseAmount } from '../lib/money';

export function SettingsView({ user }: { user: User }) {
  const { accounts, settings, actions } = useData();

  const [days, setDays] = useState(String(settings.lockDays));
  const [daysError, setDaysError] = useState<string | null>(null);
  const [daysSaved, setDaysSaved] = useState(false);

  const [drafts, setDrafts] = useState(() =>
    accounts.map((a) => ({ id: a.id, name: a.name, opening: paiseToInput(a.openingPaise) })),
  );
  const [accError, setAccError] = useState<string | null>(null);
  const [accSaved, setAccSaved] = useState(false);

  useEffect(() => setDays(String(settings.lockDays)), [settings.lockDays]);

  function saveDays(e: FormEvent) {
    e.preventDefault();
    setDaysSaved(false);
    const n = Number(days);
    if (!/^\d+$/.test(days.trim()) || n < 1 || n > 3650) return setDaysError('Enter a whole number of days between 1 and 3650.');
    setDaysError(null);
    actions.saveLockDays(n);
    setDaysSaved(true);
  }

  function saveAccounts(e: FormEvent) {
    e.preventDefault();
    setAccSaved(false);
    const parsed = [];
    for (const d of drafts) {
      const name = d.name.trim();
      const opening = parseAmount(d.opening, true);
      if (!name || name.length > 40) return setAccError('Account names must be 1 to 40 characters.');
      if (opening === null) return setAccError(`Opening balance for ${name} is not a valid amount.`);
      const original = accounts.find((a) => a.id === d.id);
      if (original) parsed.push({ ...original, name, openingPaise: opening });
    }
    setAccError(null);
    parsed.forEach((a) => actions.saveAccount(a));
    setAccSaved(true);
  }

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">Locking</h2>
        <form onSubmit={saveDays} className="inline-form" noValidate>
          <label className="field">
            <span>Lock transactions after (days)</span>
            <input className="mono narrow" inputMode="numeric" value={days} onChange={(e) => { setDays(e.target.value); setDaysSaved(false); }} id="lock-days" />
          </label>
          <button className="btn primary" type="submit">Save</button>
        </form>
        <p className="muted small">Locked transactions cannot be edited or deleted. Firestore rules enforce this using the creation time.</p>
        {daysError && <p className="error" role="alert">{daysError}</p>}
        {daysSaved && <p className="muted small" role="status">Saved.</p>}
      </section>

      <section>
        <h2 className="section-title">Accounts</h2>
        <form onSubmit={saveAccounts} className="stack-sm" noValidate>
          {drafts.map((d, i) => (
            <div key={d.id} className="account-row">
              <label className="field">
                <span>Name</span>
                <input
                  value={d.name}
                  maxLength={40}
                  onChange={(e) => { setAccSaved(false); setDrafts((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))); }}
                />
              </label>
              <label className="field">
                <span>Opening balance (₹)</span>
                <input
                  className="mono"
                  inputMode="decimal"
                  value={d.opening}
                  onChange={(e) => { setAccSaved(false); setDrafts((all) => all.map((x, j) => (j === i ? { ...x, opening: e.target.value } : x))); }}
                />
              </label>
            </div>
          ))}
          {drafts.length === 0 && <p className="muted">No accounts found.</p>}
          {accError && <p className="error" role="alert">{accError}</p>}
          <div className="inline-form">
            <button className="btn primary" type="submit" disabled={drafts.length === 0}>Save accounts</button>
            {accSaved && <span className="muted small" role="status">Saved.</span>}
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-title">Account</h2>
        <p className="muted small">Signed in as <span className="mono">{user.email ?? user.uid}</span></p>
        <button className="btn ghost" onClick={() => void signOut(auth)} id="sign-out">Sign out</button>
      </section>
    </div>
  );
}
