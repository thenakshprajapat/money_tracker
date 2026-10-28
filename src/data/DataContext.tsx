import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { db } from '../lib/firebase';
import { SEED_ACCOUNTS } from '../lib/sources';
import {
  DEFAULT_LOCK_DAYS,
  type Account,
  type Settings,
  type SourceId,
  type Transaction,
  type TxInput,
  type TxType,
} from '../lib/types';

/* ---------- Parsing Firestore documents into strict types ---------- */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const toDate = (v: unknown): Date =>
  typeof v === 'object' && v !== null && 'toDate' in v && typeof v.toDate === 'function'
    ? (v.toDate() as Date)
    : new Date();

function parseTx(id: string, d: DocumentData): Transaction {
  const type = str(d.type) as TxType;
  return {
    id,
    type: type === 'income' || type === 'expense' || type === 'transfer' ? type : 'expense',
    amountPaise: num(d.amountPaise),
    date: str(d.date),
    accountId: str(d.accountId),
    toAccountId: typeof d.toAccountId === 'string' ? d.toAccountId : null,
    sourceId: typeof d.sourceId === 'string' ? (d.sourceId as SourceId) : null,
    note: str(d.note),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/** Errors while loading or seeding data (as opposed to saving a transaction). */
function loadErrorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'permission-denied') {
    const detail = e instanceof Error ? ` (${e.message})` : '';
    return `Firestore refused access. Publish firestore.rules to this project (README step 6), make sure Firestore is created in the same project as your .env.local, then reload.${detail}`;
  }
  return errorMessage(e);
}

function errorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = String((e as { code: unknown }).code);
    if (code === 'permission-denied') return 'Not allowed. The record may be locked, or the rules reject it.';
    if (code === 'unavailable') return 'Cannot reach Firestore right now.';
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/* ---------- Context ---------- */

export interface Actions {
  addTransaction: (input: TxInput) => void;
  updateTransaction: (id: string, input: TxInput) => void;
  deleteTransaction: (id: string) => void;
  saveLockDays: (days: number) => void;
  saveAccount: (account: Account) => void;
}

interface DataState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  accounts: Account[];
  transactions: Transaction[];
  settings: Settings;
  /** True while local writes have not yet reached the server. */
  hasPendingWrites: boolean;
  writeError: string | null;
  dismissWriteError: () => void;
  actions: Actions;
}

const DataContext = createContext<DataState | null>(null);

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

export function DataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({ lockDays: DEFAULT_LOCK_DAYS });
  const [loaded, setLoaded] = useState({ accounts: false, transactions: false, settings: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Unsubscribe[] = [];
    const base = `users/${uid}`;
    const settingsRef = doc(db, `${base}/settings/main`);

    async function start() {
      try {
        // Seed on first login. Needs one successful read; works offline once cached.
        const existing = await getDoc(settingsRef);
        if (!existing.exists()) {
          const batch = writeBatch(db);
          batch.set(settingsRef, { lockDays: DEFAULT_LOCK_DAYS });
          for (const a of SEED_ACCOUNTS) {
            batch.set(doc(db, `${base}/accounts/${a.id}`), {
              name: a.name,
              openingPaise: 0,
              order: a.order,
            });
          }
          await batch.commit();
        }
      } catch (e) {
        if (!cancelled) setError(loadErrorMessage(e));
        return;
      }
      if (cancelled) return;

      const fail = (e: Error) => setError(loadErrorMessage(e));

      unsubs.push(
        onSnapshot(
          settingsRef,
          (snap) => {
            const d = snap.data();
            setSettings({ lockDays: d ? num(d.lockDays, DEFAULT_LOCK_DAYS) : DEFAULT_LOCK_DAYS });
            setLoaded((l) => ({ ...l, settings: true }));
          },
          fail,
        ),
        onSnapshot(
          collection(db, `${base}/accounts`),
          (snap) => {
            setAccounts(
              snap.docs
                .map((d) => ({
                  id: d.id,
                  name: str(d.data().name, d.id),
                  openingPaise: num(d.data().openingPaise),
                  order: num(d.data().order),
                }))
                .sort((a, b) => a.order - b.order),
            );
            setLoaded((l) => ({ ...l, accounts: true }));
          },
          fail,
        ),
        onSnapshot(
          collection(db, `${base}/transactions`),
          (snap) => {
            // 'estimate' fills pending server timestamps locally so offline adds render.
            setTransactions(
              snap.docs.map((d) => parseTx(d.id, d.data({ serverTimestamps: 'estimate' }))),
            );
            setPending(snap.metadata.hasPendingWrites);
            setLoaded((l) => ({ ...l, transactions: true }));
          },
          fail,
        ),
      );
    }

    void start();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  // Writes resolve only after server acknowledgement, which never happens offline.
  // So they are fire-and-forget: the local cache updates at once, and a rejection
  // (for example by the lock rule) surfaces here as an inline message.
  const run = useCallback((p: Promise<unknown>) => {
    setWriteError(null);
    p.catch((e: unknown) => setWriteError(errorMessage(e)));
  }, []);

  const actions = useMemo<Actions>(() => {
    const txCol = collection(db, `users/${uid}/transactions`);
    return {
      addTransaction: (input) =>
        run(addDoc(txCol, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })),
      updateTransaction: (id, input) =>
        run(updateDoc(doc(txCol, id), { ...input, updatedAt: serverTimestamp() })),
      deleteTransaction: (id) => run(deleteDoc(doc(txCol, id))),
      saveLockDays: (days) => run(setDoc(doc(db, `users/${uid}/settings/main`), { lockDays: days })),
      saveAccount: (a) =>
        run(
          setDoc(doc(db, `users/${uid}/accounts/${a.id}`), {
            name: a.name,
            openingPaise: a.openingPaise,
            order: a.order,
          }),
        ),
    };
  }, [uid, run]);

  const value: DataState = {
    status: error ? 'error' : loaded.accounts && loaded.transactions && loaded.settings ? 'ready' : 'loading',
    error,
    accounts,
    transactions,
    settings,
    hasPendingWrites: pending,
    writeError,
    dismissWriteError: () => setWriteError(null),
    actions,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
