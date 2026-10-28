export type TxType = 'income' | 'expense' | 'transfer';
export type SourceId = 'mom' | 'dad' | 'rent' | 'personal';

export interface Account {
  id: string;
  name: string;
  /** Opening balance in integer paise. */
  openingPaise: number;
  order: number;
}

export interface Settings {
  lockDays: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Always positive, integer paise. Direction comes from `type`. */
  amountPaise: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Account money leaves (expense, transfer) or enters (income). */
  accountId: string;
  /** Destination account, transfers only. */
  toAccountId: string | null;
  /** Null for transfers. */
  sourceId: SourceId | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields the user supplies; timestamps are added when writing. */
export type TxInput = Pick<
  Transaction,
  'type' | 'amountPaise' | 'date' | 'accountId' | 'toAccountId' | 'sourceId' | 'note'
>;

export const DEFAULT_LOCK_DAYS = 7;
