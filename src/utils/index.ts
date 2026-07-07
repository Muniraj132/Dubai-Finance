import { Expense, Income, MonthlyStats, Investment, InvestmentTransaction, AppSettings } from '../types';

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

// Builds one AED→INR rate per month from that month's Salary income entries
// (amount-weighted average across multiple entries), so every other AED
// figure in that month — expenses, other income — is valued at the rate the
// user's salary was actually converted at, not whatever the live rate
// happened to be on the day each transaction was logged. Months with no
// Salary entry fall back to the caller-supplied rate.
export const buildSalaryRateMap = (incomes: Income[], fallbackRate: number): Map<string, number> => {
  const groups = new Map<string, { weightedSum: number; totalWeight: number }>();
  incomes.filter(i => i.source === 'Salary').forEach(i => {
    const m = getMonthKey(i.date);
    const weight = resolveAed(i.amount, i.currency, i.amountAed, fallbackRate);
    const rate = i.exchangeRateUsed ?? fallbackRate;
    const g = groups.get(m) ?? { weightedSum: 0, totalWeight: 0 };
    g.weightedSum += rate * weight;
    g.totalWeight += weight;
    groups.set(m, g);
  });
  const map = new Map<string, number>();
  groups.forEach((g, m) => map.set(m, g.totalWeight > 0 ? g.weightedSum / g.totalWeight : fallbackRate));
  return map;
};

export const getMonthSalaryRate = (month: string, rateMap: Map<string, number>, fallbackRate: number): number =>
  rateMap.get(month) ?? fallbackRate;

export const computeMonthlyStats = (
  expenses: Expense[],
  incomes: Income[],
  rate: number
): MonthlyStats[] => {
  const rateMap = buildSalaryRateMap(incomes, rate);
  const monthMap = new Map<string, MonthlyStats>();
  const emptyStats = (m: string): MonthlyStats => ({ month: m, income: 0, expenses: 0, savings: 0, incomeInr: 0, expensesInr: 0, savingsInr: 0 });

  incomes.forEach(inc => {
    const m = getMonthKey(inc.date);
    if (!monthMap.has(m)) monthMap.set(m, emptyStats(m));
    const s = monthMap.get(m)!;
    const aed = resolveAed(inc.amount, inc.currency, inc.amountAed, rate);
    s.income += aed;
    s.incomeInr += aed * getMonthSalaryRate(m, rateMap, rate);
  });

  expenses.forEach(exp => {
    const m = getMonthKey(exp.date);
    if (!monthMap.has(m)) monthMap.set(m, emptyStats(m));
    const s = monthMap.get(m)!;
    const aed = resolveAed(exp.amount, exp.currency, exp.amountAed, rate);
    s.expenses += aed;
    s.expensesInr += aed * getMonthSalaryRate(m, rateMap, rate);
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

// Groups once (O(m)) instead of the O(n×m) that `transactions.filter(...)`
// per investment would cost — matters once a portfolio has many holdings
// and a long transaction history (SIPs accumulate fast).
export const groupByInvestmentId = (transactions: InvestmentTransaction[]): Map<string, InvestmentTransaction[]> => {
  const map = new Map<string, InvestmentTransaction[]>();
  transactions.forEach(t => {
    const list = map.get(t.investment_id);
    if (list) list.push(t);
    else map.set(t.investment_id, [t]);
  });
  return map;
};

export const computePortfolioStats = (
  investments: Investment[],
  transactions: InvestmentTransaction[],
  rate: number
): Omit<InvestmentStats, 'gainPct' | 'totalUnits'> & { gainPct: number } => {
  const byInvestment = groupByInvestmentId(transactions);
  const totals = investments.reduce((acc, inv) => {
    const s = computeInvestmentStats(inv, byInvestment.get(inv.id) ?? [], rate);
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

export interface WelcomeInsight {
  emoji: string;
  message: string;
}

// Day-of-year, used to deterministically rotate phrasing variants — same
// input always produces the same output (still a pure function, no
// Math.random()), but consecutive days land on different variants instead
// of repeating the same sentence for a week straight.
const dayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
};

const pickVariant = <T,>(variants: T[], seed: number): T => variants[seed % variants.length];

// Picks the single most positive, genuinely data-driven thing to greet the
// user with on their first login of the day — a rare Dubai-days milestone
// takes priority, then this month's savings, then the most recent past
// month that had positive savings, then investment growth, and finally a
// generic (but still true-for-everyone) fallback for brand-new accounts.
// Each tier has a few phrasing variants so the same underlying fact doesn't
// read as the exact same sentence on consecutive days.
export const getWelcomeInsight = (
  expenses: Expense[],
  incomes: Income[],
  investments: Investment[],
  investmentTransactions: InvestmentTransaction[],
  settings: AppSettings
): WelcomeInsight => {
  const rate = settings.aedToInrRate;
  const seed = dayOfYear(new Date());

  if (settings.dubaiArrivalDate) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(settings.dubaiArrivalDate).getTime()) / 86400000));
    if (days > 0 && days % 100 === 0) {
      const message = pickVariant([
        `Day ${days} of your Dubai journey — quite a milestone!`,
        `${days} days in Dubai today. Look how far you've come!`,
        `Milestone unlocked: Day ${days} in Dubai.`,
      ], seed);
      return { emoji: '🎉', message };
    }
  }

  const monthlyStats = computeMonthlyStats(expenses, incomes, rate);
  const currentMonth = getCurrentMonthKey();
  const currentStats = monthlyStats.find(s => s.month === currentMonth);
  if (currentStats && currentStats.savings > 0) {
    const aed = Math.round(currentStats.savings).toLocaleString('en-AE');
    const inr = Math.round(currentStats.savingsInr).toLocaleString('en-IN');
    const message = pickVariant([
      `You've saved AED ${aed} (≈₹${inr}) so far this month. Keep it up!`,
      `AED ${aed} saved this month already (≈₹${inr}) — nice discipline.`,
      `You're AED ${aed} ahead this month (≈₹${inr}). Keep the streak going!`,
    ], seed);
    return { emoji: '💰', message };
  }

  const pastPositive = [...monthlyStats].reverse().find(s => s.month !== currentMonth && s.savings > 0);
  if (pastPositive) {
    const label = getMonthLabel(pastPositive.month);
    const aed = Math.round(pastPositive.savings).toLocaleString('en-AE');
    const message = pickVariant([
      `In ${label} you saved AED ${aed} — great momentum to build on.`,
      `${label} was a strong month: AED ${aed} saved. Let's keep that going.`,
      `Looking back, ${label} added AED ${aed} to your savings.`,
    ], seed);
    return { emoji: '📈', message };
  }

  const portfolioStats = computePortfolioStats(investments, investmentTransactions, rate);
  if (portfolioStats.gainAed > 0) {
    const aed = Math.round(portfolioStats.gainAed).toLocaleString('en-AE');
    const inr = Math.round(portfolioStats.gainInr).toLocaleString('en-IN');
    const message = pickVariant([
      `Your investments are up AED ${aed} (≈₹${inr}) overall.`,
      `Portfolio update: up AED ${aed} (≈₹${inr}) since you started investing.`,
      `Your investments have grown by AED ${aed} (≈₹${inr}) — steady progress.`,
    ], seed);
    return { emoji: '📊', message };
  }

  const message = pickVariant([
    'Welcome back! Every day you track brings you closer to your goals.',
    'Welcome back! Small consistent steps add up over time.',
    'Good to see you again — tracking today is a win in itself.',
  ], seed);
  return { emoji: '👋', message };
};
