export type Currency = 'AED' | 'INR';

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
}

export interface Income {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  source: IncomeSource;
  notes: string;
  createdAt: string;
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
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
}

export interface GoldPurchase {
  id: string;
  date: string;
  weightGrams: number;
  pricePerGram: number;
  currency: Currency;
  notes: string;
  createdAt: string;
}

export interface AppSettings {
  aedToInrRate: number;
  dubaiArrivalDate: string;
  theme: 'light' | 'dark';
  currency: Currency;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}
