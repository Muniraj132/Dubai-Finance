import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { Expense, Income, Goal, Budget, GoldPurchase, AppSettings, ChitFund, ChitInstallment, Currency } from '../types';
import { generateId, convertToAED, convertToINR } from '../utils';

const getUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user!.id;
};

const snapshotRates = (amount: number, currency: Currency, rate: number) => ({
  amountAed: convertToAED(amount, currency, rate),
  amountInr: convertToINR(amount, currency, rate),
  exchangeRateUsed: rate,
});

const DEFAULT_SETTINGS: AppSettings = {
  aedToInrRate: 23,
  dubaiArrivalDate: new Date().toISOString().split('T')[0],
  theme: 'dark',
  currency: 'AED',
  rateFetchedAt: null,
};

interface AppState {
  expenses: Expense[];
  incomes: Income[];
  goals: Goal[];
  budgets: Budget[];
  goldPurchases: GoldPurchase[];
  chitFunds: ChitFund[];
  chitInstallments: ChitInstallment[];
  settings: AppSettings;
  isLoading: boolean;
  rateJustUpdated: boolean;
  lastError: string | null;

  initialize: () => Promise<void>;
  setRateJustUpdated: (v: boolean) => void;
  clearError: () => void;
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

  addChitFund: (fund: Omit<ChitFund, 'id' | 'createdAt'>) => Promise<void>;
  updateChitFund: (id: string, fund: Partial<ChitFund>) => Promise<void>;
  deleteChitFund: (id: string) => Promise<void>;

  addChitInstallment: (inst: Omit<ChitInstallment, 'id' | 'createdAt'>) => Promise<void>;
  updateChitInstallment: (id: string, inst: Partial<ChitInstallment>) => Promise<void>;
  deleteChitInstallment: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => {
  // Every mutating action applies `optimisticValue` immediately, then fires the
  // Supabase call. If it fails, the optimistic change is rolled back to `prev`
  // and lastError is set (surfaced by the banner in Layout.tsx) instead of
  // silently leaving local state out of sync with the database.
  const writeThrough = async <K extends keyof AppState>(
    key: K,
    optimisticValue: AppState[K],
    call: () => PromiseLike<{ error: any }>
  ) => {
    const prev = get()[key];
    set({ [key]: optimisticValue } as Partial<AppState>);
    const { error } = await call();
    if (error) {
      set({ [key]: prev, lastError: 'Failed to save your change. Please try again.' } as Partial<AppState>);
    }
  };

  return {
    expenses: [],
    incomes: [],
    goals: [],
    budgets: [],
    goldPurchases: [],
    chitFunds: [],
    chitInstallments: [],
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    rateJustUpdated: false,
    lastError: null,

    setRateJustUpdated: (v) => set({ rateJustUpdated: v }),
    clearError: () => set({ lastError: null }),

    initialize: async () => {
      set({ isLoading: true });
      const [expenses, incomes, goals, budgets, goldPurchases, chitFunds, chitInstallments, settings] = await Promise.all([
        supabase.from('expenses').select('*').order('createdAt', { ascending: false }),
        supabase.from('incomes').select('*').order('createdAt', { ascending: false }),
        supabase.from('goals').select('*').order('createdAt', { ascending: false }),
        supabase.from('budgets').select('*'),
        supabase.from('gold_purchases').select('*').order('createdAt', { ascending: false }),
        supabase.from('chit_funds').select('*').order('createdAt', { ascending: false }),
        supabase.from('chit_installments').select('*').order('month_no', { ascending: true }),
        supabase.from('settings').select('*').maybeSingle(),
      ]);
      set({
        expenses: expenses.data ?? [],
        incomes: incomes.data ?? [],
        goals: goals.data ?? [],
        budgets: budgets.data ?? [],
        goldPurchases: goldPurchases.data ?? [],
        chitFunds: chitFunds.data ?? [],
        chitInstallments: chitInstallments.data ?? [],
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
      chitFunds: [],
      chitInstallments: [],
      settings: DEFAULT_SETTINGS,
      lastError: null,
    }),

    addExpense: async (expense) => {
      const rate = get().settings.aedToInrRate;
      const newExpense: Expense = {
        ...expense,
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...snapshotRates(expense.amount, expense.currency, rate),
      };
      const uid = await getUid();
      await writeThrough('expenses', [newExpense, ...get().expenses], () =>
        supabase.from('expenses').insert({ ...newExpense, user_id: uid })
      );
    },
    updateExpense: async (id, patch) => {
      const existing = get().expenses.find((e) => e.id === id);
      const extra = existing && (patch.amount !== undefined || patch.currency !== undefined)
        ? snapshotRates(patch.amount ?? existing.amount, patch.currency ?? existing.currency, get().settings.aedToInrRate)
        : {};
      const fullPatch = { ...patch, ...extra };
      await writeThrough('expenses', get().expenses.map((e) => (e.id === id ? { ...e, ...fullPatch } : e)), () =>
        supabase.from('expenses').update(fullPatch).eq('id', id)
      );
    },
    deleteExpense: async (id) => {
      await writeThrough('expenses', get().expenses.filter((e) => e.id !== id), () =>
        supabase.from('expenses').delete().eq('id', id)
      );
    },

    addIncome: async (income) => {
      const rate = get().settings.aedToInrRate;
      const newIncome: Income = {
        ...income,
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...snapshotRates(income.amount, income.currency, rate),
      };
      const uid = await getUid();
      await writeThrough('incomes', [newIncome, ...get().incomes], () =>
        supabase.from('incomes').insert({ ...newIncome, user_id: uid })
      );
    },
    updateIncome: async (id, patch) => {
      const existing = get().incomes.find((i) => i.id === id);
      const extra = existing && (patch.amount !== undefined || patch.currency !== undefined)
        ? snapshotRates(patch.amount ?? existing.amount, patch.currency ?? existing.currency, get().settings.aedToInrRate)
        : {};
      const fullPatch = { ...patch, ...extra };
      await writeThrough('incomes', get().incomes.map((i) => (i.id === id ? { ...i, ...fullPatch } : i)), () =>
        supabase.from('incomes').update(fullPatch).eq('id', id)
      );
    },
    deleteIncome: async (id) => {
      await writeThrough('incomes', get().incomes.filter((i) => i.id !== id), () =>
        supabase.from('incomes').delete().eq('id', id)
      );
    },

    addGoal: async (goal) => {
      const rate = get().settings.aedToInrRate;
      const newGoal: Goal = {
        ...goal,
        id: generateId(),
        createdAt: new Date().toISOString(),
        targetAmountAed: convertToAED(goal.targetAmount, goal.currency, rate),
        targetAmountInr: convertToINR(goal.targetAmount, goal.currency, rate),
        currentAmountAed: convertToAED(goal.currentAmount, goal.currency, rate),
        currentAmountInr: convertToINR(goal.currentAmount, goal.currency, rate),
        exchangeRateUsed: rate,
      };
      const uid = await getUid();
      await writeThrough('goals', [newGoal, ...get().goals], () =>
        supabase.from('goals').insert({ ...newGoal, user_id: uid })
      );
    },
    updateGoal: async (id, patch) => {
      const existing = get().goals.find((g) => g.id === id);
      let extra: Partial<Goal> = {};
      if (existing && (patch.targetAmount !== undefined || patch.currentAmount !== undefined || patch.currency !== undefined)) {
        const rate = get().settings.aedToInrRate;
        const currency = patch.currency ?? existing.currency;
        extra = { exchangeRateUsed: rate };
        if (patch.targetAmount !== undefined || patch.currency !== undefined) {
          const targetAmount = patch.targetAmount ?? existing.targetAmount;
          extra.targetAmountAed = convertToAED(targetAmount, currency, rate);
          extra.targetAmountInr = convertToINR(targetAmount, currency, rate);
        }
        if (patch.currentAmount !== undefined || patch.currency !== undefined) {
          const currentAmount = patch.currentAmount ?? existing.currentAmount;
          extra.currentAmountAed = convertToAED(currentAmount, currency, rate);
          extra.currentAmountInr = convertToINR(currentAmount, currency, rate);
        }
      }
      const fullPatch = { ...patch, ...extra };
      await writeThrough('goals', get().goals.map((g) => (g.id === id ? { ...g, ...fullPatch } : g)), () =>
        supabase.from('goals').update(fullPatch).eq('id', id)
      );
    },
    deleteGoal: async (id) => {
      await writeThrough('goals', get().goals.filter((g) => g.id !== id), () =>
        supabase.from('goals').delete().eq('id', id)
      );
    },

    setBudget: async (budget) => {
      const rate = get().settings.aedToInrRate;
      const withSnapshot = { ...budget, ...snapshotRates(budget.amount, budget.currency, rate) };
      const existing = get().budgets.find(
        (b) => b.month === budget.month && b.category === budget.category
      );
      if (existing) {
        await writeThrough('budgets', get().budgets.map((b) => (b.id === existing.id ? { ...b, ...withSnapshot } : b)), () =>
          supabase.from('budgets').update(withSnapshot).eq('id', existing.id)
        );
      } else {
        const newBudget: Budget = { ...withSnapshot, id: generateId() };
        const uid = await getUid();
        await writeThrough('budgets', [...get().budgets, newBudget], () =>
          supabase.from('budgets').insert({ ...newBudget, user_id: uid })
        );
      }
    },
    deleteBudget: async (id) => {
      await writeThrough('budgets', get().budgets.filter((b) => b.id !== id), () =>
        supabase.from('budgets').delete().eq('id', id)
      );
    },

    addGoldPurchase: async (purchase) => {
      const rate = get().settings.aedToInrRate;
      const totalValue = purchase.weightGrams * purchase.pricePerGram;
      const newPurchase: GoldPurchase = {
        ...purchase,
        id: generateId(),
        createdAt: new Date().toISOString(),
        totalValueAed: convertToAED(totalValue, purchase.currency, rate),
        totalValueInr: convertToINR(totalValue, purchase.currency, rate),
        exchangeRateUsed: rate,
      };
      const uid = await getUid();
      await writeThrough('goldPurchases', [newPurchase, ...get().goldPurchases], () =>
        supabase.from('gold_purchases').insert({ ...newPurchase, user_id: uid })
      );
    },
    updateGoldPurchase: async (id, patch) => {
      const existing = get().goldPurchases.find((g) => g.id === id);
      let extra: Partial<GoldPurchase> = {};
      if (existing && (patch.weightGrams !== undefined || patch.pricePerGram !== undefined || patch.currency !== undefined)) {
        const rate = get().settings.aedToInrRate;
        const weightGrams = patch.weightGrams ?? existing.weightGrams;
        const pricePerGram = patch.pricePerGram ?? existing.pricePerGram;
        const currency = patch.currency ?? existing.currency;
        const totalValue = weightGrams * pricePerGram;
        extra = {
          totalValueAed: convertToAED(totalValue, currency, rate),
          totalValueInr: convertToINR(totalValue, currency, rate),
          exchangeRateUsed: rate,
        };
      }
      const fullPatch = { ...patch, ...extra };
      await writeThrough('goldPurchases', get().goldPurchases.map((g) => (g.id === id ? { ...g, ...fullPatch } : g)), () =>
        supabase.from('gold_purchases').update(fullPatch).eq('id', id)
      );
    },
    deleteGoldPurchase: async (id) => {
      await writeThrough('goldPurchases', get().goldPurchases.filter((g) => g.id !== id), () =>
        supabase.from('gold_purchases').delete().eq('id', id)
      );
    },

    addChitFund: async (fund) => {
      const newFund: ChitFund = { ...fund, id: generateId(), createdAt: new Date().toISOString() };
      const uid = await getUid();
      await writeThrough('chitFunds', [newFund, ...get().chitFunds], () =>
        supabase.from('chit_funds').insert({ ...newFund, user_id: uid })
      );
    },
    updateChitFund: async (id, fund) => {
      await writeThrough('chitFunds', get().chitFunds.map((c) => (c.id === id ? { ...c, ...fund } : c)), () =>
        supabase.from('chit_funds').update(fund).eq('id', id)
      );
    },
    deleteChitFund: async (id) => {
      const prevInstallments = get().chitInstallments;
      await writeThrough('chitFunds', get().chitFunds.filter((c) => c.id !== id), async () => {
        set({ chitInstallments: prevInstallments.filter((i) => i.chit_id !== id) });
        const { error } = await supabase.from('chit_funds').delete().eq('id', id);
        if (error) set({ chitInstallments: prevInstallments });
        return { error };
      });
    },

    addChitInstallment: async (inst) => {
      const newInst: ChitInstallment = { ...inst, id: generateId(), createdAt: new Date().toISOString() };
      const uid = await getUid();
      await writeThrough('chitInstallments', [...get().chitInstallments, newInst], () =>
        supabase.from('chit_installments').insert({ ...newInst, user_id: uid })
      );
    },
    updateChitInstallment: async (id, inst) => {
      await writeThrough('chitInstallments', get().chitInstallments.map((i) => (i.id === id ? { ...i, ...inst } : i)), () =>
        supabase.from('chit_installments').update(inst).eq('id', id)
      );
    },
    deleteChitInstallment: async (id) => {
      await writeThrough('chitInstallments', get().chitInstallments.filter((i) => i.id !== id), () =>
        supabase.from('chit_installments').delete().eq('id', id)
      );
    },

    updateSettings: async (settings) => {
      const merged = { ...get().settings, ...settings };
      const { data: { user } } = await supabase.auth.getUser();
      await writeThrough('settings', merged, async () => {
        if (!user) return { error: null };
        return supabase.from('settings').upsert({ user_id: user.id, ...merged });
      });
    },
  };
});

export const useSettings = () => useAppStore((s) => s.settings);
export const useExpenses = () => useAppStore((s) => s.expenses);
export const useIncomes = () => useAppStore((s) => s.incomes);
export const useGoals = () => useAppStore((s) => s.goals);
export const useBudgets = () => useAppStore((s) => s.budgets);
export const useGoldPurchases = () => useAppStore((s) => s.goldPurchases);
export const useChitFunds = () => useAppStore((s) => s.chitFunds);
export const useChitInstallments = () => useAppStore((s) => s.chitInstallments);
