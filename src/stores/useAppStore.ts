import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { Expense, Income, Goal, Budget, GoldPurchase, AppSettings } from '../types';
import { generateId } from '../utils';

const getUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user!.id;
};

const DEFAULT_SETTINGS: AppSettings = {
  aedToInrRate: 23,
  dubaiArrivalDate: new Date().toISOString().split('T')[0],
  theme: 'dark',
  currency: 'AED',
};

interface AppState {
  expenses: Expense[];
  incomes: Income[];
  goals: Goal[];
  budgets: Budget[];
  goldPurchases: GoldPurchase[];
  settings: AppSettings;
  isLoading: boolean;

  initialize: () => Promise<void>;
  reset: () => void;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addIncome: (income: Omit<Income, 'id' | 'createdAt'>) => Promise<void>;
  updateIncome: (id: string, income: Partial<Income>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => Promise<void>;
  updateGoal: (id: string, goal: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  setBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  addGoldPurchase: (purchase: Omit<GoldPurchase, 'id' | 'createdAt'>) => Promise<void>;
  updateGoldPurchase: (id: string, purchase: Partial<GoldPurchase>) => Promise<void>;
  deleteGoldPurchase: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  expenses: [],
  incomes: [],
  goals: [],
  budgets: [],
  goldPurchases: [],
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });
    const [expenses, incomes, goals, budgets, goldPurchases, settings] = await Promise.all([
      supabase.from('expenses').select('*').order('createdAt', { ascending: false }),
      supabase.from('incomes').select('*').order('createdAt', { ascending: false }),
      supabase.from('goals').select('*').order('createdAt', { ascending: false }),
      supabase.from('budgets').select('*'),
      supabase.from('gold_purchases').select('*').order('createdAt', { ascending: false }),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    set({
      expenses: expenses.data ?? [],
      incomes: incomes.data ?? [],
      goals: goals.data ?? [],
      budgets: budgets.data ?? [],
      goldPurchases: goldPurchases.data ?? [],
      settings: settings.data ?? DEFAULT_SETTINGS,
      isLoading: false,
    });
  },

  reset: () => set({
    expenses: [],
    incomes: [],
    goals: [],
    budgets: [],
    goldPurchases: [],
    settings: DEFAULT_SETTINGS,
  }),

  addExpense: async (expense) => {
    const newExpense: Expense = { ...expense, id: generateId(), createdAt: new Date().toISOString() };
    set((s) => ({ expenses: [newExpense, ...s.expenses] }));
    await supabase.from('expenses').insert({ ...newExpense, user_id: await getUid() });
  },
  updateExpense: async (id, expense) => {
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...expense } : e)) }));
    await supabase.from('expenses').update(expense).eq('id', id);
  },
  deleteExpense: async (id) => {
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    await supabase.from('expenses').delete().eq('id', id);
  },

  addIncome: async (income) => {
    const newIncome: Income = { ...income, id: generateId(), createdAt: new Date().toISOString() };
    set((s) => ({ incomes: [newIncome, ...s.incomes] }));
    await supabase.from('incomes').insert({ ...newIncome, user_id: await getUid() });
  },
  updateIncome: async (id, income) => {
    set((s) => ({ incomes: s.incomes.map((i) => (i.id === id ? { ...i, ...income } : i)) }));
    await supabase.from('incomes').update(income).eq('id', id);
  },
  deleteIncome: async (id) => {
    set((s) => ({ incomes: s.incomes.filter((i) => i.id !== id) }));
    await supabase.from('incomes').delete().eq('id', id);
  },

  addGoal: async (goal) => {
    const newGoal: Goal = { ...goal, id: generateId(), createdAt: new Date().toISOString() };
    set((s) => ({ goals: [newGoal, ...s.goals] }));
    await supabase.from('goals').insert({ ...newGoal, user_id: await getUid() });
  },
  updateGoal: async (id, goal) => {
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...goal } : g)) }));
    await supabase.from('goals').update(goal).eq('id', id);
  },
  deleteGoal: async (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    await supabase.from('goals').delete().eq('id', id);
  },

  setBudget: async (budget) => {
    const existing = get().budgets.find(
      (b) => b.month === budget.month && b.category === budget.category
    );
    if (existing) {
      set((s) => ({ budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, ...budget } : b)) }));
      await supabase.from('budgets').update(budget).eq('id', existing.id);
    } else {
      const newBudget: Budget = { ...budget, id: generateId() };
      set((s) => ({ budgets: [...s.budgets, newBudget] }));
      await supabase.from('budgets').insert({ ...newBudget, user_id: await getUid() });
    }
  },
  deleteBudget: async (id) => {
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
    await supabase.from('budgets').delete().eq('id', id);
  },

  addGoldPurchase: async (purchase) => {
    const newPurchase: GoldPurchase = { ...purchase, id: generateId(), createdAt: new Date().toISOString() };
    set((s) => ({ goldPurchases: [newPurchase, ...s.goldPurchases] }));
    await supabase.from('gold_purchases').insert({ ...newPurchase, user_id: await getUid() });
  },
  updateGoldPurchase: async (id, purchase) => {
    set((s) => ({ goldPurchases: s.goldPurchases.map((g) => (g.id === id ? { ...g, ...purchase } : g)) }));
    await supabase.from('gold_purchases').update(purchase).eq('id', id);
  },
  deleteGoldPurchase: async (id) => {
    set((s) => ({ goldPurchases: s.goldPurchases.filter((g) => g.id !== id) }));
    await supabase.from('gold_purchases').delete().eq('id', id);
  },

  updateSettings: async (settings) => {
    const merged = { ...get().settings, ...settings };
    set({ settings: merged });
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('settings').upsert({ user_id: user!.id, ...merged });
  },
}));

export const useSettings = () => useAppStore((s) => s.settings);
export const useExpenses = () => useAppStore((s) => s.expenses);
export const useIncomes = () => useAppStore((s) => s.incomes);
export const useGoals = () => useAppStore((s) => s.goals);
export const useBudgets = () => useAppStore((s) => s.budgets);
export const useGoldPurchases = () => useAppStore((s) => s.goldPurchases);
