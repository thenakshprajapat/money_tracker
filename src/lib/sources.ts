import type { SourceId, TxType } from './types';

export interface SourceDef {
  id: SourceId;
  label: string;
  /** Transaction types this source may be used with. */
  allows: readonly Exclude<TxType, 'transfer'>[];
}

export const SOURCES: readonly SourceDef[] = [
  { id: 'mom', label: 'Mom', allows: ['income'] },
  { id: 'dad', label: 'Dad', allows: ['income'] },
  { id: 'rent', label: 'Rent', allows: ['income'] },
  { id: 'personal', label: 'Personal', allows: ['income', 'expense'] },
];

export function sourceLabel(id: SourceId | null): string {
  return SOURCES.find((s) => s.id === id)?.label ?? 'Transfer';
}

export function sourcesFor(type: TxType): SourceDef[] {
  if (type === 'transfer') return [];
  return SOURCES.filter((s) => s.allows.includes(type));
}

export const SEED_ACCOUNTS: readonly { id: string; name: string; order: number }[] = [
  { id: 'icici', name: 'ICICI Bank', order: 0 },
  { id: 'sbi', name: 'SBI Bank', order: 1 },
  { id: 'kotak', name: 'Kotak 811', order: 2 },
  { id: 'wallet', name: 'Wallet', order: 3 },
];
