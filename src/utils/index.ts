import { Expense, Income, MonthlyStats, Investment, InvestmentTransaction, GoldPurchase, Liability, LiabilityTransaction, LiabilityStats, ChitFund, ChitInstallment, AppSettings, FinancialSummary } from '../types';

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
    s.incomeInr += inc.currency === 'INR' ? inc.amount : aed * getMonthSalaryRate(m, rateMap, rate);
  });

  expenses.forEach(exp => {
    const m = getMonthKey(exp.date);
    if (!monthMap.has(m)) monthMap.set(m, emptyStats(m));
    const s = monthMap.get(m)!;
    const aed = resolveAed(exp.amount, exp.currency, exp.amountAed, rate);
    s.expenses += aed;
    s.expensesInr += exp.currency === 'INR' ? exp.amount : aed * getMonthSalaryRate(m, rateMap, rate);
  });

  return Array.from(monthMap.values())
    .map(s => ({ ...s, savings: s.income - s.expenses, savingsInr: s.incomeInr - s.expensesInr }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

// ------------------------------------------------------------------
// Financial model: Income vs. Living Expenses vs. Investments.
//
// Investing is converting cash into a different asset (stocks, mutual
// funds, gold, ...), not spending it — it must never be counted as an
// expense or vanish from "savings". See docs/ARCHITECTURE.md §7.11.
// ------------------------------------------------------------------

// Net cash that left the bank account to fund investment holdings, over the
// given transactions. Buy/SIP pull cash out; Sell/Dividend put cash back in
// (a dividend is money credited to your account — it only leaves cash again
// if a separate Buy/SIP records reinvesting it).
export const computeInvestmentCashFlow = (
  transactions: InvestmentTransaction[],
  rate: number,
  salaryRateMap: Map<string, number>
): { aed: number; inr: number } => {
  let aed = 0, inr = 0;
  transactions.forEach(t => {
    const a = resolveAed(t.amount, t.currency, t.amountAed, rate);
    const sign = (t.type === 'Buy' || t.type === 'SIP') ? 1 : -1;
    const inrValue = t.currency === 'INR' ? t.amount : a * getMonthSalaryRate(getMonthKey(t.date), salaryRateMap, rate);
    aed += sign * a;
    inr += sign * inrValue;
  });
  return { aed, inr };
};

// Cash spent on gold. Gold has no live price feed in this app (see
// GoldTracker) — its "current value" is always its cost basis, so this
// number doubles as gold's contribution to Net Worth's asset side.
export const computeGoldCashFlow = (
  purchases: GoldPurchase[],
  rate: number,
  salaryRateMap: Map<string, number>
): { aed: number; inr: number } => {
  let aed = 0, inr = 0;
  purchases.forEach(g => {
    const value = g.weightGrams * g.pricePerGram;
    const a = resolveAed(value, g.currency, g.totalValueAed, rate);
    aed += a;
    inr += g.currency === 'INR' ? value : a * getMonthSalaryRate(getMonthKey(g.date), salaryRateMap, rate);
  });
  return { aed, inr };
};

// Cash paid into a chit fund pool this period — a forced-savings scheme,
// not spending (see docs/ARCHITECTURE.md §7.6/§7.11). Chit amounts are
// always INR-native in this app (chit_funds/chit_installments have no
// currency column) — `inr` is the exact rupee amount paid, never derived
// via a round-trip through AED, so it never drifts from what was actually
// paid. AED is the approximate/derived figure here, at the live rate.
export const computeChitCashFlow = (
  installments: ChitInstallment[],
  rate: number
): { aed: number; inr: number } => {
  let aed = 0, inr = 0;
  installments.forEach(i => {
    const paid = i.paid_amount ?? 0;
    if (!paid) return;
    aed += convertToAED(paid, 'INR', rate);
    inr += paid;
  });
  return { aed, inr };
};

// All-time net value tied up across every chit fund: what you've paid in,
// minus any lump-sum payout(s) already received. Chit funds have no
// separate market value in this app (no gain/loss modeled), so this net
// figure does double duty in Net Worth — it's both the cash that left the
// bank (to subtract) and the current value of what you're owed (to add
// back), the same way gold's cost basis doubles as its value. Can go
// negative after receiving a payout early, correctly acting like debt for
// the remaining installments still owed.
export const computeChitNetValue = (
  chitFunds: ChitFund[],
  installments: ChitInstallment[],
  rate: number
): { aed: number; inr: number } => {
  const totalPaid = installments.reduce((s, i) => s + (i.paid_amount ?? 0), 0);
  const totalReceived = chitFunds.reduce((s, c) => s + (c.received_amount ?? 0), 0);
  const netInr = totalPaid - totalReceived;
  return { aed: convertToAED(netInr, 'INR', rate), inr: netInr };
};

// The core "where did this period's income go" breakdown. `investments` is
// cash converted into investment assets (from computeInvestmentCashFlow +
// computeGoldCashFlow); `chitContributions` is cash paid into a chit fund
// pool (from computeChitCashFlow); `debtPrincipalPaid` is cash converted
// into reduced debt (from computeDebtCashFlow) — all three are "saved," not
// spent, so none of them is part of `livingExpenses`. `debtInterest` is a
// genuine cost of borrowing, so it does reduce Cash Remaining, same as a
// living expense would. Total Saved = Investments + Chit Contributions +
// Debt Principal Paid + Cash Remaining, which algebraically always equals
// Income − Living Expenses − Debt Interest; it's computed via its
// components anyway so the breakdown stays visible and consistent.
export const computeFinancialSummary = (opts: {
  income: number; incomeInr: number;
  livingExpenses: number; livingExpensesInr: number;
  investments: number; investmentsInr: number;
  chitContributions?: number; chitContributionsInr?: number;
  debtPrincipalPaid?: number; debtPrincipalPaidInr?: number;
  debtInterest?: number; debtInterestInr?: number;
}): FinancialSummary => {
  const { income, incomeInr, livingExpenses, livingExpensesInr, investments, investmentsInr } = opts;
  const chitContributions = opts.chitContributions ?? 0;
  const chitContributionsInr = opts.chitContributionsInr ?? 0;
  const debtPrincipalPaid = opts.debtPrincipalPaid ?? 0;
  const debtPrincipalPaidInr = opts.debtPrincipalPaidInr ?? 0;
  const debtInterest = opts.debtInterest ?? 0;
  const debtInterestInr = opts.debtInterestInr ?? 0;

  const cashRemaining = income - livingExpenses - investments - chitContributions - debtInterest - debtPrincipalPaid;
  const cashRemainingInr = incomeInr - livingExpensesInr - investmentsInr - chitContributionsInr - debtInterestInr - debtPrincipalPaidInr;
  const totalSaved = investments + chitContributions + debtPrincipalPaid + cashRemaining;
  const totalSavedInr = investmentsInr + chitContributionsInr + debtPrincipalPaidInr + cashRemainingInr;
  const savingsRate = income > 0 ? (totalSaved / income) * 100 : 0;
  return {
    income, incomeInr, livingExpenses, livingExpensesInr,
    investments, investmentsInr, chitContributions, chitContributionsInr,
    debtPrincipalPaid, debtPrincipalPaidInr,
    debtInterest, debtInterestInr, cashRemaining, cashRemainingInr,
    totalSaved, totalSavedInr, savingsRate,
  };
};

export interface NetWorthInputs {
  allTimeIncome: number; allTimeIncomeInr: number;
  allTimeLivingExpenses: number; allTimeLivingExpensesInr: number;
  // All-time cash that left the bank for investments + gold (cost basis).
  investedCash: number; investedCashInr: number;
  // Current mark-to-market value of everything invested (investments + gold).
  investmentsValue: number; investmentsValueInr: number;
  // All-time cash spent paying down debt principal, and on interest.
  debtPrincipalPaid: number; debtPrincipalPaidInr: number;
  debtInterestPaid: number; debtInterestPaidInr: number;
  // Current outstanding balance across all liabilities (derived from their
  // ledgers — see computePortfolioLiabilityStats).
  liabilitiesOutstanding: number; liabilitiesOutstandingInr: number;
}

// Net Worth = cash on hand + what everything you own is worth today − what
// you owe. Cash on hand must subtract every dirham/rupee that ever left the
// bank to buy an investment/gold or to pay down a debt (principal and
// interest both) — otherwise that money is counted twice: once as cash
// still sitting there, and again as the asset it became or the debt it paid
// off.
export const computeNetWorth = (inputs: NetWorthInputs): { netWorth: number; netWorthInr: number } => {
  const cash = inputs.allTimeIncome - inputs.allTimeLivingExpenses - inputs.investedCash
    - inputs.debtPrincipalPaid - inputs.debtInterestPaid;
  const cashInr = inputs.allTimeIncomeInr - inputs.allTimeLivingExpensesInr - inputs.investedCashInr
    - inputs.debtPrincipalPaidInr - inputs.debtInterestPaidInr;
  return {
    netWorth: cash + inputs.investmentsValue - inputs.liabilitiesOutstanding,
    netWorthInr: cashInr + inputs.investmentsValueInr - inputs.liabilitiesOutstandingInr,
  };
};

export const exportToCSV = (data: Record<string, string | number | boolean | null | undefined>[], filename: string) => {
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
  'Family Support': '#d946ef',
  Others: '#78716c',
};

export const GOAL_COLORS = ['#f97316','#3b82f6','#22c55e','#8b5cf6','#ec4899','#f59e0b','#10b981','#e11d48'];

export const INVESTMENT_TYPES = ['Mutual Fund', 'Stock', 'ETF', 'Fixed Deposit', 'PPF', 'NPS', 'Other'] as const;

export const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  'Mutual Fund': '#3b82f6',
  Stock: '#a855f7',
  ETF: '#06b6d4',
  'Fixed Deposit': '#10b981',
  PPF: '#eab308',
  NPS: '#f97316',
  Other: '#78716c',
};

// Keys into the Badge/StatCard colorMap in components/ui/index.tsx
export const INVESTMENT_TYPE_BADGE: Record<string, string> = {
  'Mutual Fund': 'blue',
  Stock: 'purple',
  ETF: 'cyan',
  'Fixed Deposit': 'emerald',
  PPF: 'yellow',
  NPS: 'orange',
  Other: 'theme',
};

export const LIABILITY_TYPES = ['Loan', 'Credit Card', 'Other'] as const;

export const LIABILITY_TYPE_COLORS: Record<string, string> = {
  Loan: '#ef4444',
  'Credit Card': '#f97316',
  Other: '#78716c',
};

// Keys into the Badge/StatCard colorMap in components/ui/index.tsx
export const LIABILITY_TYPE_BADGE: Record<string, string> = {
  Loan: 'red',
  'Credit Card': 'orange',
  Other: 'theme',
};

// Charge (new debt incurred) increases the outstanding balance; Payment
// decreases it, but only by the principal portion — a Payment's
// interestAmount is a pure cash cost that never touches the balance.
export const computeLiabilityStats = (
  liability: Liability,
  transactions: LiabilityTransaction[],
  rate: number
): LiabilityStats => {
  let chargesAed = 0, chargesInr = 0, principalPaidAed = 0, principalPaidInr = 0, interestPaidAed = 0, interestPaidInr = 0;

  transactions.forEach(t => {
    const txnRate = t.exchangeRateUsed ?? rate;
    if (t.type === 'Charge') {
      chargesAed += convertToAED(t.amount, t.currency, txnRate);
      chargesInr += convertToINR(t.amount, t.currency, txnRate);
    } else {
      const interestRaw = t.interestAmount ?? 0;
      const principalRaw = t.amount - interestRaw;
      principalPaidAed += convertToAED(principalRaw, t.currency, txnRate);
      principalPaidInr += convertToINR(principalRaw, t.currency, txnRate);
      interestPaidAed += convertToAED(interestRaw, t.currency, txnRate);
      interestPaidInr += convertToINR(interestRaw, t.currency, txnRate);
    }
  });

  const openingAed = resolveAed(liability.balance, liability.currency, liability.balanceAed, rate);
  const openingInr = resolveInr(liability.balance, liability.currency, liability.balanceInr, rate);
  const outstandingAed = openingAed + chargesAed - principalPaidAed;
  const outstandingInr = openingInr + chargesInr - principalPaidInr;

  return { outstandingAed, outstandingInr, chargesAed, chargesInr, principalPaidAed, principalPaidInr, interestPaidAed, interestPaidInr };
};

export const groupByLiabilityId = (transactions: LiabilityTransaction[]): Map<string, LiabilityTransaction[]> => {
  const map = new Map<string, LiabilityTransaction[]>();
  transactions.forEach(t => {
    const list = map.get(t.liability_id);
    if (list) list.push(t);
    else map.set(t.liability_id, [t]);
  });
  return map;
};

// Portfolio-wide totals across every liability — outstanding is what Net
// Worth subtracts; the rest is for the Liabilities list view's stat cards.
export const computePortfolioLiabilityStats = (
  liabilities: Liability[],
  transactions: LiabilityTransaction[],
  rate: number
): LiabilityStats => {
  const byLiability = groupByLiabilityId(transactions);
  return liabilities.reduce((acc, l) => {
    const s = computeLiabilityStats(l, byLiability.get(l.id) ?? [], rate);
    acc.outstandingAed += s.outstandingAed;
    acc.outstandingInr += s.outstandingInr;
    acc.chargesAed += s.chargesAed;
    acc.chargesInr += s.chargesInr;
    acc.principalPaidAed += s.principalPaidAed;
    acc.principalPaidInr += s.principalPaidInr;
    acc.interestPaidAed += s.interestPaidAed;
    acc.interestPaidInr += s.interestPaidInr;
    return acc;
  }, { outstandingAed: 0, outstandingInr: 0, chargesAed: 0, chargesInr: 0, principalPaidAed: 0, principalPaidInr: 0, interestPaidAed: 0, interestPaidInr: 0 });
};

// Cash that moved because of debt this period: principal paid down (money
// converted into reduced debt, like an investment) and interest paid (a
// genuine cost). Charges are excluded — a charge increases what you owe
// without any cash leaving the bank yet, so it never appears as a cash flow.
export const computeDebtCashFlow = (
  transactions: LiabilityTransaction[],
  rate: number,
  salaryRateMap: Map<string, number>
): { principalAed: number; principalInr: number; interestAed: number; interestInr: number } => {
  let principalAed = 0, principalInr = 0, interestAed = 0, interestInr = 0;
  transactions.forEach(t => {
    if (t.type !== 'Payment') return;
    const txnRate = t.exchangeRateUsed ?? rate;
    const interestRaw = t.interestAmount ?? 0;
    const principalRaw = t.amount - interestRaw;
    const pAed = convertToAED(principalRaw, t.currency, txnRate);
    const iAed = convertToAED(interestRaw, t.currency, txnRate);
    principalAed += pAed;
    interestAed += iAed;
    if (t.currency === 'INR') {
      principalInr += principalRaw;
      interestInr += interestRaw;
    } else {
      const monthRate = getMonthSalaryRate(getMonthKey(t.date), salaryRateMap, rate);
      principalInr += pAed * monthRate;
      interestInr += iAed * monthRate;
    }
  });
  return { principalAed, principalInr, interestAed, interestInr };
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
  const isDubai = settings.accountType !== 'india';

  if (isDubai && settings.dubaiArrivalDate) {
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
    const aed = isDubai ? ` (≈AED ${Math.round(currentStats.savings).toLocaleString('en-AE')})` : '';
    const inr = Math.round(currentStats.savingsInr).toLocaleString('en-IN');
    const message = pickVariant([
      `You've saved ₹${inr}${aed} so far this month. Keep it up!`,
      `₹${inr} saved this month already${aed} — nice discipline.`,
      `You're ₹${inr} ahead this month${aed}. Keep the streak going!`,
    ], seed);
    return { emoji: '💰', message };
  }

  const pastPositive = [...monthlyStats].reverse().find(s => s.month !== currentMonth && s.savings > 0);
  if (pastPositive) {
    const label = getMonthLabel(pastPositive.month);
    const inr = Math.round(pastPositive.savingsInr).toLocaleString('en-IN');
    const message = pickVariant([
      `In ${label} you saved ₹${inr} — great momentum to build on.`,
      `${label} was a strong month: ₹${inr} saved. Let's keep that going.`,
      `Looking back, ${label} added ₹${inr} to your savings.`,
    ], seed);
    return { emoji: '📈', message };
  }

  const portfolioStats = computePortfolioStats(investments, investmentTransactions, rate);
  if (portfolioStats.gainAed > 0) {
    const aed = isDubai ? ` (≈AED ${Math.round(portfolioStats.gainAed).toLocaleString('en-AE')})` : '';
    const inr = Math.round(portfolioStats.gainInr).toLocaleString('en-IN');
    const message = pickVariant([
      `Your investments are up ₹${inr}${aed} overall.`,
      `Portfolio update: up ₹${inr}${aed} since you started investing.`,
      `Your investments have grown by ₹${inr}${aed} — steady progress.`,
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
