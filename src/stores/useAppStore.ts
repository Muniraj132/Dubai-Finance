import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Expense, Income, Goal, Budget, GoldPurchase, AppSettings } from '../types';
import { generateId, getCurrentMonthKey } from '../utils';

interface AppState {
  expenses: Expense[];
  incomes: Income[];
  goals: Goal[];
  budgets: Budget[];
  goldPurchases: GoldPurchase[];
  settings: AppSettings;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Income actions
  addIncome: (income: Omit<Income, 'id' | 'createdAt'>) => void;
  updateIncome: (id: string, income: Partial<Income>) => void;
  deleteIncome: (id: string) => void;

  // Goal actions
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, goal: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  // Budget actions
  setBudget: (budget: Omit<Budget, 'id'>) => void;
  deleteBudget: (id: string) => void;

  // Gold actions
  addGoldPurchase: (purchase: Omit<GoldPurchase, 'id' | 'createdAt'>) => void;
  updateGoldPurchase: (id: string, purchase: Partial<GoldPurchase>) => void;
  deleteGoldPurchase: (id: string) => void;

  // Settings
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      expenses: [],
      incomes: [],
      goals: [],
      budgets: [],
      goldPurchases: [],
      settings: {
        aedToInrRate: 23,
        dubaiArrivalDate: new Date().toISOString().split('T')[0],
        theme: 'dark',
        currency: 'AED',
      },

      addExpense: (expense) =>
        set((s) => ({
          expenses: [{ ...expense, id: generateId(), createdAt: new Date().toISOString() }, ...s.expenses],
        })),
      updateExpense: (id, expense) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...expense } : e)) })),
      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      addIncome: (income) =>
        set((s) => ({
          incomes: [{ ...income, id: generateId(), createdAt: new Date().toISOString() }, ...s.incomes],
        })),
      updateIncome: (id, income) =>
        set((s) => ({ incomes: s.incomes.map((i) => (i.id === id ? { ...i, ...income } : i)) })),
      deleteIncome: (id) =>
        set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) })),

      addGoal: (goal) =>
        set((s) => ({
          goals: [{ ...goal, id: generateId(), createdAt: new Date().toISOString() }, ...s.goals],
        })),
      updateGoal: (id, goal) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...goal } : g)) })),
      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      setBudget: (budget) =>
        set((s) => {
          const existing = s.budgets.find(
            (b) => b.month === budget.month && b.category === budget.category
          );
          if (existing) {
            return { budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, ...budget } : b)) };
          }
          return { budgets: [...s.budgets, { ...budget, id: generateId() }] };
        }),
      deleteBudget: (id) =>
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      addGoldPurchase: (purchase) =>
        set((s) => ({
          goldPurchases: [{ ...purchase, id: generateId(), createdAt: new Date().toISOString() }, ...s.goldPurchases],
        })),
      updateGoldPurchase: (id, purchase) =>
        set((s) => ({ goldPurchases: s.goldPurchases.map((g) => (g.id === id ? { ...g, ...purchase } : g)) })),
      deleteGoldPurchase: (id) =>
        set((s) => ({ goldPurchases: s.goldPurchases.filter((g) => g.id !== id) })),

      updateSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),
    }),
    { name: 'dubai-finance-tracker' }
  )
);

export const useSettings = () => useAppStore((s) => s.settings);
export const useExpenses = () => useAppStore((s) => s.expenses);
export const useIncomes = () => useAppStore((s) => s.incomes);
export const useGoals = () => useAppStore((s) => s.goals);
export const useBudgets = () => useAppStore((s) => s.budgets);
export const useGoldPurchases = () => useAppStore((s) => s.goldPurchases);
