import { useMemo } from 'react';
import { Income } from '../types';
import { getCurrentMonthKey, getMonthKey, buildSalaryRateMap } from '../utils';
import { useAppStore } from '../stores/useAppStore';

// Always includes the current month, even with zero entries in it — a
// <select> whose value doesn't match any of its <option>s falls back to
// showing the first option ("All Months") while still silently filtering by
// the (missing) current month underneath, which looks like a bug.
export const useMonthOptions = <T extends { date: string }>(records: T[]): string[] =>
  useMemo(() => {
    const set = new Set(records.map(r => getMonthKey(r.date)));
    set.add(getCurrentMonthKey());
    return Array.from(set).sort().reverse();
  }, [records]);

// Shared across Dashboard/Expenses/Analytics/DubaiLife so every page values
// AED figures at the same per-month salary conversion rate — see
// buildSalaryRateMap in utils for why.
export const useSalaryRateMap = (incomes: Income[], fallbackRate: number) =>
  useMemo(() => buildSalaryRateMap(incomes, fallbackRate), [incomes, fallbackRate]);

// The single gating check every page uses to hide AED pickers/labels and
// Dubai-specific pages for India-based users. `!== 'india'` (rather than
// `=== 'dubai'`) so legacy in-memory state without accountType yet set
// still defaults to showing Dubai's full feature set.
export const useIsDubai = () => useAppStore((s) => s.settings.accountType !== 'india');
