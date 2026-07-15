import { useMemo } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import { useExpenses, useIncomes, useInvestments, useInvestmentTransactions, useChitFunds, useChitInstallments, useSettings } from '../stores/useAppStore';
import { PageHeader } from '../components/ui';
import {
  computeMonthlyStats, computeInvestmentStats, computePortfolioStats, getMonthLabel, CATEGORY_COLORS, INVESTMENT_TYPE_COLORS,
  resolveAed, getCurrentMonthKey, getMonthKey, getMonthSalaryRate,
} from '../utils';
import { useSalaryRateMap } from '../hooks';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <div className="text-muted mb-1.5">{label}</div>
      {payload.map((p: any) => {
        const inrValue = p.payload?.[`${p.dataKey}Inr`];
        return (
          <div key={p.name} className="mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-primary capitalize">{p.name}:</span>
              <span className="font-semibold text-primary">
                {typeof inrValue === 'number' ? `₹${inrValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `AED ${typeof p.value === 'number' ? p.value.toLocaleString('en-AE', { maximumFractionDigits: 0 }) : p.value}`}
              </span>
            </div>
            {typeof inrValue === 'number' && (
              <div className="text-muted ml-4">≈ AED {typeof p.value === 'number' ? p.value.toLocaleString('en-AE', { maximumFractionDigits: 0 }) : p.value}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function Analytics() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const investments = useInvestments();
  const investmentTransactions = useInvestmentTransactions();
  const chitFunds = useChitFunds();
  const chitInstallments = useChitInstallments();
  const { aedToInrRate } = useSettings();
  const currentMonth = getCurrentMonthKey();

  // Every AED figure is valued at that transaction's month's salary
  // conversion rate (see buildSalaryRateMap in utils), not its own
  // frozen/live rate — matches Dashboard/Expenses so numbers stay consistent
  // across pages.
  const salaryRateMap = useSalaryRateMap(incomes, aedToInrRate);

  const monthlyStats = useMemo(() => computeMonthlyStats(expenses, incomes, aedToInrRate), [expenses, incomes, aedToInrRate]);
  const chartData = monthlyStats.slice(-12).map(s => ({
    month: getMonthLabel(s.month),
    income: Math.round(s.income),
    expenses: Math.round(s.expenses),
    savings: Math.round(s.savings),
    incomeInr: Math.round(s.incomeInr),
    expensesInr: Math.round(s.expensesInr),
    savingsInr: Math.round(s.savingsInr),
  }));

  // Overall (all-time) summary — income/expenses valued per-transaction at
  // that month's salary rate, same model as Dashboard's net worth.
  const allTimeIncome = useMemo(() =>
    incomes.reduce((s, i) => s + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0),
    [incomes, aedToInrRate]
  );
  const allTimeIncomeInr = useMemo(() =>
    incomes.reduce((s, i) => {
      if (i.currency === 'INR') return s + i.amount;
      const aed = resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(i.date), salaryRateMap, aedToInrRate);
    }, 0),
    [incomes, aedToInrRate, salaryRateMap]
  );
  const allTimeExpenses = useMemo(() =>
    expenses.reduce((s, e) => s + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0),
    [expenses, aedToInrRate]
  );
  const allTimeExpensesInr = useMemo(() =>
    expenses.reduce((s, e) => {
      if (e.currency === 'INR') return s + e.amount;
      const aed = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
    }, 0),
    [expenses, aedToInrRate, salaryRateMap]
  );
  const portfolioStats = useMemo(
    () => computePortfolioStats(investments, investmentTransactions, aedToInrRate),
    [investments, investmentTransactions, aedToInrRate]
  );
  const chitStats = useMemo(() => {
    const totalPaid = chitInstallments.reduce((s, i) => s + (i.paid_amount ?? 0), 0);
    const totalCommitted = chitFunds.reduce((s, c) => s + c.total_amount, 0);
    return { totalPaid, totalCommitted };
  }, [chitFunds, chitInstallments]);

  // Current month totals for spending warning
  const currentMonthExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.date) === currentMonth)
      .reduce((s, e) => s + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0),
    [expenses, currentMonth, aedToInrRate]
  );
  const currentMonthExpensesInr = useMemo(() =>
    expenses.filter(e => getMonthKey(e.date) === currentMonth).reduce((s, e) => {
      if (e.currency === 'INR') return s + e.amount;
      const aed = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
    }, 0),
    [expenses, currentMonth, salaryRateMap, aedToInrRate]
  );
  const currentMonthIncome = useMemo(() =>
    incomes.filter(i => getMonthKey(i.date) === currentMonth)
      .reduce((s, i) => s + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0),
    [incomes, currentMonth, aedToInrRate]
  );
  const currentMonthIncomeInr = useMemo(() =>
    incomes.filter(i => getMonthKey(i.date) === currentMonth).reduce((s, i) => {
      if (i.currency === 'INR') return s + i.amount;
      const aed = resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(i.date), salaryRateMap, aedToInrRate);
    }, 0),
    [incomes, currentMonth, salaryRateMap, aedToInrRate]
  );
  const spendingRatio = currentMonthIncome > 0 ? currentMonthExpenses / currentMonthIncome : 0;
  const showOverBudget = currentMonthIncome > 0 && spendingRatio >= 1;
  const showHighSpending = currentMonthIncome > 0 && spendingRatio >= 0.8 && spendingRatio < 1;

  const categoryData = useMemo(() => {
    const map = new Map<string, { value: number; valueInr: number }>();
    expenses.forEach(e => {
      const amt = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      const inrAmt = e.currency === 'INR' ? e.amount : amt * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
      const prev = map.get(e.category) ?? { value: 0, valueInr: 0 };
      map.set(e.category, { value: prev.value + amt, valueInr: prev.valueInr + inrAmt });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, value: Math.round(v.value), valueInr: Math.round(v.valueInr) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, aedToInrRate, salaryRateMap]);

  const currentMonthCategoryData = useMemo(() => {
    const map = new Map<string, { value: number; valueInr: number }>();
    expenses.filter(e => getMonthKey(e.date) === currentMonth).forEach(e => {
      const amt = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      const inrAmt = e.currency === 'INR' ? e.amount : amt * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
      const prev = map.get(e.category) ?? { value: 0, valueInr: 0 };
      map.set(e.category, { value: prev.value + amt, valueInr: prev.valueInr + inrAmt });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, value: Math.round(v.value), valueInr: Math.round(v.valueInr) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, currentMonth, aedToInrRate, salaryRateMap]);

  const portfolioAllocation = useMemo(() => {
    const map = new Map<string, { value: number; valueInr: number }>();
    investments.forEach(inv => {
      const s = computeInvestmentStats(inv, investmentTransactions.filter(t => t.investment_id === inv.id), aedToInrRate);
      const prev = map.get(inv.type) ?? { value: 0, valueInr: 0 };
      map.set(inv.type, { value: prev.value + s.currentValueAed, valueInr: prev.valueInr + s.currentValueInr });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, value: Math.round(v.value), valueInr: Math.round(v.valueInr) }))
      .sort((a, b) => b.value - a.value);
  }, [investments, investmentTransactions, aedToInrRate]);

  const investmentComparison = useMemo(() =>
    investments.map(inv => {
      const s = computeInvestmentStats(inv, investmentTransactions.filter(t => t.investment_id === inv.id), aedToInrRate);
      return {
        name: inv.name,
        invested: Math.round(s.investedInr), investedAed: Math.round(s.investedAed),
        current: Math.round(s.currentValueInr), currentAed: Math.round(s.currentValueAed),
      };
    }).sort((a, b) => b.current - a.current),
    [investments, investmentTransactions, aedToInrRate]
  );

  const bestSavingMonth = monthlyStats.length > 0
    ? monthlyStats.reduce((best, cur) => cur.savings > best.savings ? cur : best)
    : null;

  const worstSpendingMonth = monthlyStats.length > 0
    ? monthlyStats.reduce((worst, cur) => cur.expenses > worst.expenses ? cur : worst)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Insights into your financial trends" />

      {/* Spending warnings */}
      {showOverBudget && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-400">Expenses exceed income this month!</div>
            <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
              Spent ₹{currentMonthExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}) vs income ₹{currentMonthIncomeInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Review your spending categories below.
            </div>
          </div>
        </div>
      )}
      {showHighSpending && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">High spending — {(spendingRatio * 100).toFixed(0)}% of income used</div>
            <div className="text-xs text-yellow-700/80 dark:text-yellow-300/80 mt-0.5">
              ₹{currentMonthExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent (AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}). Only ₹{(currentMonthIncomeInr - currentMonthExpensesInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })} left this month.
            </div>
          </div>
        </div>
      )}

      {/* Overall Summary */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={15} className="text-[#6366F1]" />
          <h2 className="text-sm font-semibold text-primary">Overall Summary</h2>
          <span className="text-xs text-muted ml-auto">All-time</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Total Income</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              ₹{allTimeIncomeInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              ≈ AED {allTimeIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Total Expenses</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              ₹{allTimeExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              ≈ AED {allTimeExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Investments</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              ₹{portfolioStats.currentValueInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              ≈ AED {portfolioStats.currentValueAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Chit Fund Paid</div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              ₹{chitStats.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              of ₹{chitStats.totalCommitted.toLocaleString('en-IN', { maximumFractionDigits: 0 })} committed
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {monthlyStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestSavingMonth && (
            <div className="card bg-green-500/5 border-green-500/20">
              <div className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">🏆 Best Saving Month</div>
              <div className="text-primary font-bold">{getMonthLabel(bestSavingMonth.month)}</div>
              <div className="text-sm text-muted">₹{bestSavingMonth.savingsInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} saved</div>
              <div className="text-xs text-muted mt-0.5">≈ AED {bestSavingMonth.savings.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</div>
            </div>
          )}
          {worstSpendingMonth && (
            <div className="card bg-red-500/5 border-red-500/20">
              <div className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">📊 Highest Spending Month</div>
              <div className="text-primary font-bold">{getMonthLabel(worstSpendingMonth.month)}</div>
              <div className="text-sm text-muted">₹{worstSpendingMonth.expensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent</div>
              <div className="text-xs text-muted mt-0.5">≈ AED {worstSpendingMonth.expenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</div>
            </div>
          )}
        </div>
      )}

      {/* Income vs Expenses */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-4">Income vs Expenses Trend</h2>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">No data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="income" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="expenses" />
              <Line type="monotone" dataKey="savings" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} strokeDasharray="4 2" name="savings" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-4">Portfolio Allocation</h2>
          {portfolioAllocation.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm text-center">No investments yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={portfolioAllocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {portfolioAllocation.map(entry => (
                      <Cell key={entry.name} fill={INVESTMENT_TYPE_COLORS[entry.name] ?? '#78716c'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, _name: string, entry: any) => [`₹${(entry?.payload?.valueInr ?? v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} · AED ${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {portfolioAllocation.map(t => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: INVESTMENT_TYPE_COLORS[t.name] ?? '#78716c' }} />
                      <span className="text-muted">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-primary font-medium">₹{t.valueInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      <span className="text-muted ml-1.5">≈ AED {t.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-4">Invested vs Current Value</h2>
          {investmentComparison.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">No investments yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, investmentComparison.length * 40)}>
              <BarChart data={investmentComparison} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v: number, name: string, entry: any) => {
                  const aed = name === 'invested' ? entry?.payload?.investedAed : entry?.payload?.currentAed;
                  return [`₹${v.toLocaleString('en-IN')} · AED ${(aed ?? 0).toLocaleString()}`, name === 'invested' ? 'Invested' : 'Current Value'];
                }} />
                <Bar dataKey="invested" fill="#78716c" radius={[0, 4, 4, 0]} name="invested" />
                <Bar dataKey="current" fill="#3b82f6" radius={[0, 4, 4, 0]} name="current" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Month Spending */}
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-1">This Month — by Category</h2>
          <div className="text-xs text-muted mb-4">
            Total: ₹{currentMonthExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          <span className="ml-2 text-[#6366F1]">≈ AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</span>
          </div>
          {currentMonthCategoryData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">No expenses this month.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={currentMonthCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {currentMonthCategoryData.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#78716c'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, _name: string, entry: any) => [`₹${(entry?.payload?.valueInr ?? v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} · AED ${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {currentMonthCategoryData.map(cat => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat.name] ?? '#78716c' }} />
                      <span className="text-muted">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-primary font-medium">₹{cat.valueInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      <span className="text-muted ml-1.5">≈ AED {cat.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* All-time Category */}
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-4">All-Time Spending by Category</h2>
          {categoryData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">No data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number, _name: string, entry: any) => [`₹${(entry?.payload?.valueInr ?? v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} · AED ${v.toLocaleString()}`, 'Total']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryData.map(entry => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#78716c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Savings Trend */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-4">Monthly Savings Trend</h2>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">No data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="savings" fill="#06b6d4" radius={[4, 4, 0, 0]} name="savings">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.savings >= 0 ? '#06b6d4' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
