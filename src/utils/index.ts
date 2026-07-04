import { Expense, Income, MonthlyStats, Investment, InvestmentTransaction } from '../types';

export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const formatCurrency = (amount: number, currency: 'AED' | 'INR' = 'AED') => {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }
  return `AED ${new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(amount)}`;
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

export const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const convertToAED = (amount: number, currency: 'AED' | 'INR', rate: number): number => {
  if (currency === 'AED') return amount;
  return amount / rate;
};

export const convertToINR = (amount: number, currency: 'AED' | 'INR', rate: number): number => {
  if (currency === 'INR') return amount;
  return amount * rate;
};

// Read-time accessors: prefer the AED/INR value frozen on the record at
// create/update time. Only falls back to a live conversion for legacy rows
// that predate this snapshot (stored value is null/undefined).
export const resolveAed = (amount: number, currency: 'AED' | 'INR', stored: number | null | undefined, rate: number): number =>
  stored ?? convertToAED(amount, currency, rate);

export const resolveInr = (amount: number, currency: 'AED' | 'INR', stored: number | null | undefined, rate: number): number =>
  stored ?? convertToINR(amount, currency, rate);

export const computeMonthlyStats = (
  expenses: Expense[],
  incomes: Income[],
  rate: number
): MonthlyStats[] => {
  const monthMap = new Map<string, MonthlyStats>();
  const emptyStats = (m: string): MonthlyStats => ({ month: m, income: 0, expenses: 0, savings: 0, incomeInr: 0, expensesInr: 0, savingsInr: 0 });

  incomes.forEach(inc => {
    const m = getMonthKey(inc.date);
    if (!monthMap.has(m)) monthMap.set(m, emptyStats(m));
    const s = monthMap.get(m)!;
    s.income += resolveAed(inc.amount, inc.currency, inc.amountAed, rate);
    s.incomeInr += resolveInr(inc.amount, inc.currency, inc.amountInr, rate);
  });

  expenses.forEach(exp => {
    const m = getMonthKey(exp.date);
    if (!monthMap.has(m)) monthMap.set(m, emptyStats(m));
    const s = monthMap.get(m)!;
    s.expenses += resolveAed(exp.amount, exp.currency, exp.amountAed, rate);
    s.expensesInr += resolveInr(exp.amount, exp.currency, exp.amountInr, rate);
  });

  return Array.from(monthMap.values())
    .map(s => ({ ...s, savings: s.income - s.expenses, savingsInr: s.incomeInr - s.expensesInr }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const EXPENSE_CATEGORIES = [
  'Rent','Food','Groceries','Transportation','Mobile',
  'Internet','Shopping','Entertainment','Travel','Gift','Family Support','Others'
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#f97316',
  Food: '#ef4444',
  Groceries: '#22c55e',
  Transportation: '#3b82f6',
  Mobile: '#8b5cf6',
  Internet: '#06b6d4',
  Shopping: '#ec4899',
  Entertainment: '#f59e0b',
  Travel: '#10b981',
  Gift: '#e11d48',
  'Family Support': '#6366f1',
  Others: '#78716c',
};

export const GOAL_COLORS = ['#f97316','#3b82f6','#22c55e','#8b5cf6','#ec4899','#f59e0b','#10b981','#e11d48'];

export const INVESTMENT_TYPES = ['Mutual Fund', 'Stock', 'ETF', 'Fixed Deposit', 'PPF', 'NPS', 'Other'] as const;

export const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  'Mutual Fund': '#3b82f6',
  Stock: '#a855f7',
  ETF: '#06b6d4',
  'Fixed Deposit': '#10b981',
  PPF: '#6366f1',
  NPS: '#f97316',
  Other: '#78716c',
};

// Keys into the Badge/StatCard colorMap in components/ui/index.tsx
export const INVESTMENT_TYPE_BADGE: Record<string, string> = {
  'Mutual Fund': 'blue',
  Stock: 'purple',
  ETF: 'cyan',
  'Fixed Deposit': 'emerald',
  PPF: 'indigo',
  NPS: 'orange',
  Other: 'theme',
};

export interface InvestmentStats {
  investedAed: number;
  investedInr: number;
  dividendsAed: number;
  dividendsInr: number;
  currentValueAed: number;
  currentValueInr: number;
  gainAed: number;
  gainInr: number;
  gainPct: number;
  totalUnits: number;
}

// Buy/SIP add to the cost basis and unit count, Sell reduces both, Dividend is
// cash received that doesn't touch the cost basis. currentValue is a separate
// manually-updated mark-to-market figure (§ investments in ARCHITECTURE.md),
// so gain/loss = currentValue - invested, not derived from transactions alone.
export const computeInvestmentStats = (
  investment: Investment,
  transactions: InvestmentTransaction[],
  rate: number
): InvestmentStats => {
  let investedAed = 0, investedInr = 0, dividendsAed = 0, dividendsInr = 0, totalUnits = 0;

  transactions.forEach(t => {
    const aed = resolveAed(t.amount, t.currency, t.amountAed, rate);
    const inr = resolveInr(t.amount, t.currency, t.amountInr, rate);
    if (t.type === 'Buy' || t.type === 'SIP') {
      investedAed += aed;
      investedInr += inr;
      totalUnits += t.units ?? 0;
    } else if (t.type === 'Sell') {
      investedAed -= aed;
      investedInr -= inr;
      totalUnits -= t.units ?? 0;
    } else if (t.type === 'Dividend') {
      dividendsAed += aed;
      dividendsInr += inr;
    }
  });

  const currentValueAed = resolveAed(investment.currentValue, investment.currency, investment.currentValueAed, rate);
  const currentValueInr = resolveInr(investment.currentValue, investment.currency, investment.currentValueInr, rate);
  const gainAed = currentValueAed - investedAed;
  const gainInr = currentValueInr - investedInr;
  const gainPct = investedAed > 0 ? (gainAed / investedAed) * 100 : 0;

  return { investedAed, investedInr, dividendsAed, dividendsInr, currentValueAed, currentValueInr, gainAed, gainInr, gainPct, totalUnits };
};

export const computePortfolioStats = (
  investments: Investment[],
  transactions: InvestmentTransaction[],
  rate: number
): Omit<InvestmentStats, 'gainPct' | 'totalUnits'> & { gainPct: number } => {
  const totals = investments.reduce((acc, inv) => {
    const s = computeInvestmentStats(inv, transactions.filter(t => t.investment_id === inv.id), rate);
    acc.investedAed += s.investedAed;
    acc.investedInr += s.investedInr;
    acc.dividendsAed += s.dividendsAed;
    acc.dividendsInr += s.dividendsInr;
    acc.currentValueAed += s.currentValueAed;
    acc.currentValueInr += s.currentValueInr;
    acc.gainAed += s.gainAed;
    acc.gainInr += s.gainInr;
    return acc;
  }, { investedAed: 0, investedInr: 0, dividendsAed: 0, dividendsInr: 0, currentValueAed: 0, currentValueInr: 0, gainAed: 0, gainInr: 0 });
  const gainPct = totals.investedAed > 0 ? (totals.gainAed / totals.investedAed) * 100 : 0;
  return { ...totals, gainPct };
};
