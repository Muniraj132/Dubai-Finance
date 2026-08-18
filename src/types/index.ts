export type Currency = 'AED' | 'INR';

// 'dubai' users see AED + INR everywhere (existing behavior, unchanged).
// 'india' users work INR-only — AED pickers, sub-labels, and Dubai-specific
// pages (Converter, Dubai Life) are hidden. Chosen once at registration
// (src/pages/Auth.tsx), stored on `settings.accountType`.
export type AccountType = 'dubai' | 'india';

export type ExpenseCategory =
  | 'Rent'
  | 'Food'
  | 'Groceries'
  | 'Transportation'
  | 'Mobile'
  | 'Internet'
  | 'Shopping'
  | 'Entertainment'
  | 'Travel'
  | 'Gift'
  | 'Family Support'
  | 'Others';

export type IncomeSource = 'Salary' | 'Bonus' | 'Freelance' | 'Others';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  notes: string;
  createdAt: string;
  // AED/INR value of `amount`, frozen at create/update time. Null on legacy rows.
  amountAed?: number | null;
  amountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface Income {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  source: IncomeSource;
  notes: string;
  createdAt: string;
  amountAed?: number | null;
  amountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  currency: Currency;
  color: string;
  createdAt: string;
  targetAmountAed?: number | null;
  targetAmountInr?: number | null;
  currentAmountAed?: number | null;
  currentAmountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
  amountAed?: number | null;
  amountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface GoldPurchase {
  id: string;
  date: string;
  weightGrams: number;
  pricePerGram: number;
  currency: Currency;
  notes: string;
  createdAt: string;
  // AED/INR value of weightGrams * pricePerGram, frozen at create/update time.
  totalValueAed?: number | null;
  totalValueInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface AppSettings {
  aedToInrRate: number;
  dubaiArrivalDate: string;
  theme: 'light' | 'dark';
  currency: Currency;
  // ISO timestamp of the last automatic exchange-rate fetch. Null on
  // legacy rows/first run — treated as "always stale" by exchangeRate.ts.
  rateFetchedAt?: string | null;
  accountType: AccountType;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  incomeInr: number;
  expensesInr: number;
  savingsInr: number;
}

export type ChitStatus = 'active' | 'completed' | 'dropped';
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'missed';

export interface ChitFund {
  id: string;
  name: string;
  total_amount: number;
  duration_months: number;
  organizer: string;
  start_date: string;
  end_date: string;
  status: ChitStatus;
  received_amount: number | null;
  received_month_no: number | null;
  notes: string;
  createdAt: string;
}

export interface ChitInstallment {
  id: string;
  chit_id: string;
  month_no: number;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  paid_date: string;
  payment_mode: string;
  status: InstallmentStatus;
  remark: string;
  createdAt: string;
}

export type InvestmentType = 'Mutual Fund' | 'Stock' | 'ETF' | 'Fixed Deposit' | 'PPF' | 'NPS' | 'Other';
export type InvestmentStatus = 'active' | 'closed';
export type InvestmentTxnType = 'Buy' | 'SIP' | 'Sell' | 'Dividend';

export interface Investment {
  id: string;
  type: InvestmentType;
  name: string;
  currency: Currency;
  // Manually-updated mark-to-market value, in `currency` — there's no live
  // price feed in this app, so this is refreshed by the user periodically.
  currentValue: number;
  maturityDate: string | null; // Fixed Deposit / PPF / NPS
  interestRate: number | null; // Fixed Deposit / PPF / NPS, annual %, informational only
  // AMFI scheme code (from mfapi.in) — only set for type = 'Mutual Fund' holdings
  // linked to live NAV refresh. Null for everything else (no live price source).
  schemeCode: number | null;
  // SIP (recurring monthly investment). When true, a database-side cron job
  // (see supabase/migrations/0006_investment_sip.sql) auto-inserts a SIP
  // transaction on sipDay of every month — this runs independent of whether
  // the app is open. Turning sipEnabled off stops future auto-generated
  // entries; it never deletes ones already created.
  sipEnabled: boolean;
  sipAmount: number | null; // in `currency`, required when sipEnabled
  sipDay: number | null; // 1–28, required when sipEnabled
  sipLastRunDate: string | null; // last date (YYYY-MM-DD) the cron job fired for this holding
  status: InvestmentStatus;
  notes: string;
  createdAt: string;
  // AED/INR value of currentValue, frozen at create/update time. Null on legacy rows.
  currentValueAed?: number | null;
  currentValueInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface InvestmentTransaction {
  id: string;
  investment_id: string;
  type: InvestmentTxnType;
  date: string;
  // units/pricePerUnit are null for Dividend and for FD/PPF/NPS transactions
  // (Buy = deposit, SIP = recurring contribution, Sell = withdrawal there).
  units: number | null;
  pricePerUnit: number | null;
  amount: number;
  currency: Currency;
  notes: string;
  createdAt: string;
  amountAed?: number | null;
  amountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export type LiabilityType = 'Loan' | 'Credit Card' | 'Other';
export type LiabilityStatus = 'active' | 'closed';
export type LiabilityTxnType = 'Charge' | 'Payment';

export interface Liability {
  id: string;
  type: LiabilityType;
  name: string;
  currency: Currency;
  // Opening balance — what you owed when this liability was first added.
  // The current outstanding amount is derived from this plus the
  // liability_transactions ledger (see computeLiabilityStats in utils),
  // not stored redundantly — same philosophy as Investment.currentValue
  // vs. its transaction ledger.
  balance: number;
  status: LiabilityStatus;
  notes: string;
  createdAt: string;
  // AED/INR value of balance, frozen at create/update time. Null on legacy rows.
  balanceAed?: number | null;
  balanceInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface LiabilityTransaction {
  id: string;
  liability_id: string;
  type: LiabilityTxnType;
  date: string;
  // Total cash amount of this event. For a Payment, this may include an
  // interest portion (see interestAmount) — only (amount - interestAmount)
  // reduces the outstanding balance; the rest is a pure cash cost.
  amount: number;
  // Payment only: portion of `amount` that's interest, not principal.
  // Null/0 for Charge, and for a Payment with no interest component.
  interestAmount: number | null;
  currency: Currency;
  notes: string;
  createdAt: string;
  amountAed?: number | null;
  amountInr?: number | null;
  exchangeRateUsed?: number | null;
}

export interface LiabilityStats {
  outstandingAed: number;
  outstandingInr: number;
  chargesAed: number;
  chargesInr: number;
  principalPaidAed: number;
  principalPaidInr: number;
  interestPaidAed: number;
  interestPaidInr: number;
}

// Breakdown of where a period's income actually went: living expenses,
// investments (converted, not spent), chit fund contributions (also
// converted, not spent — a pooled forced-savings scheme), debt paid down
// (also converted, not spent), debt interest (a genuine cost), and cash
// left over. See docs/ARCHITECTURE.md §7.11 for the full model.
export interface FinancialSummary {
  income: number;
  incomeInr: number;
  livingExpenses: number;
  livingExpensesInr: number;
  investments: number;
  investmentsInr: number;
  chitContributions: number;
  chitContributionsInr: number;
  debtPrincipalPaid: number;
  debtPrincipalPaidInr: number;
  debtInterest: number;
  debtInterestInr: number;
  cashRemaining: number;
  cashRemainingInr: number;
  totalSaved: number;
  totalSavedInr: number;
  savingsRate: number;
}
