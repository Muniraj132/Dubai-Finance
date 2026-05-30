import { Expense, Income, MonthlyStats } from '../types';

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

export const computeMonthlyStats = (
  expenses: Expense[],
  incomes: Income[],
  rate: number
): MonthlyStats[] => {
  const monthMap = new Map<string, MonthlyStats>();

  incomes.forEach(inc => {
    const m = getMonthKey(inc.date);
    if (!monthMap.has(m)) monthMap.set(m, { month: m, income: 0, expenses: 0, savings: 0 });
    const s = monthMap.get(m)!;
    s.income += convertToAED(inc.amount, inc.currency, rate);
  });

  expenses.forEach(exp => {
    const m = getMonthKey(exp.date);
    if (!monthMap.has(m)) monthMap.set(m, { month: m, income: 0, expenses: 0, savings: 0 });
    const s = monthMap.get(m)!;
    s.expenses += convertToAED(exp.amount, exp.currency, rate);
  });

  return Array.from(monthMap.values())
    .map(s => ({ ...s, savings: s.income - s.expenses }))
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
