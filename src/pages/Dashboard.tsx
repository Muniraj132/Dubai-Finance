import { useMemo } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Percent, ArrowRightLeft, AlertTriangle, Landmark } from 'lucide-react';
import { useExpenses, useIncomes, useGoldPurchases, useInvestments, useSettings } from '../stores/useAppStore';
import { StatCard } from '../components/ui';
import { resolveAed, resolveInr, formatCurrency, getCurrentMonthKey, getMonthKey, getMonthLabel, computeMonthlyStats, buildSalaryRateMap, getMonthSalaryRate, CATEGORY_COLORS } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 shadow-xl text-sm">
      <div className="text-muted mb-2">{label}</div>
      {payload.map((p: any) => {
        const inrValue = p.payload?.[`${p.dataKey}Inr`];
        return (
          <div key={p.name} className="mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-primary capitalize">{p.name}:</span>
              <span className="font-semibold text-primary">AED {p.value?.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</span>
            </div>
            {typeof inrValue === 'number' && (
              <div className="text-xs text-muted ml-4">≈ ₹{inrValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function Dashboard() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const goldPurchases = useGoldPurchases();
  const investments = useInvestments();
  const settings = useSettings();
  const { aedToInrRate } = settings;

  const currentMonth = getCurrentMonthKey();

  // Every AED figure for a given month is valued at that month's salary
  // conversion rate (see buildSalaryRateMap) instead of each transaction's
  // own frozen/live rate — so "balance after expenses" reflects real
  // converted rupees, not a rate that drifted day to day within the month.
  const salaryRateMap = useMemo(() => buildSalaryRateMap(incomes, aedToInrRate), [incomes, aedToInrRate]);
  const currentMonthRate = getMonthSalaryRate(currentMonth, salaryRateMap, aedToInrRate);

  const monthExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.date) === currentMonth)
      .reduce((sum, e) => sum + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0),
    [expenses, currentMonth, aedToInrRate]
  );
  const monthExpensesInr = useMemo(() => monthExpenses * currentMonthRate, [monthExpenses, currentMonthRate]);

  const monthIncome = useMemo(() =>
    incomes.filter(i => getMonthKey(i.date) === currentMonth)
      .reduce((sum, i) => sum + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0),
    [incomes, currentMonth, aedToInrRate]
  );
  const monthIncomeInr = useMemo(() => monthIncome * currentMonthRate, [monthIncome, currentMonthRate]);

  const monthSavings = monthIncome - monthExpenses;
  const monthSavingsInr = monthIncomeInr - monthExpensesInr;
  const savingsRate = monthIncome > 0 ? (monthSavings / monthIncome) * 100 : 0;

  // Spending warnings
  const spendingRatio = monthIncome > 0 ? monthExpenses / monthIncome : 0;
  const showOverBudget = monthIncome > 0 && spendingRatio >= 1;
  const showHighSpending = monthIncome > 0 && spendingRatio >= 0.8 && spendingRatio < 1;

  const monthlyStats = useMemo(() =>
    computeMonthlyStats(expenses, incomes, aedToInrRate).slice(-6),
    [expenses, incomes, aedToInrRate]
  );

  // Net worth (assets-only — this app doesn't track liabilities): all-time
  // savings + gold's current value + investments' current value, all
  // resolved through their frozen historical snapshots (§7.1).
  const netWorth = useMemo(() => {
    const allTimeIncome = incomes.reduce((s, i) => s + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0);
    const allTimeExpenses = expenses.reduce((s, e) => s + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0);
    const goldValue = goldPurchases.reduce((s, g) => s + resolveAed(g.weightGrams * g.pricePerGram, g.currency, g.totalValueAed, aedToInrRate), 0);
    const investmentsValue = investments.reduce((s, i) => s + resolveAed(i.currentValue, i.currency, i.currentValueAed, aedToInrRate), 0);
    return (allTimeIncome - allTimeExpenses) + goldValue + investmentsValue;
  }, [incomes, expenses, goldPurchases, investments, aedToInrRate]);

  const netWorthInr = useMemo(() => {
    const allTimeIncomeInr = incomes.reduce((s, i) => {
      const aed = resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(i.date), salaryRateMap, aedToInrRate);
    }, 0);
    const allTimeExpensesInr = expenses.reduce((s, e) => {
      const aed = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
    }, 0);
    const goldValueInr = goldPurchases.reduce((s, g) => s + resolveInr(g.weightGrams * g.pricePerGram, g.currency, g.totalValueInr, aedToInrRate), 0);
    const investmentsValueInr = investments.reduce((s, i) => s + resolveInr(i.currentValue, i.currency, i.currentValueInr, aedToInrRate), 0);
    return (allTimeIncomeInr - allTimeExpensesInr) + goldValueInr + investmentsValueInr;
  }, [incomes, expenses, goldPurchases, investments, aedToInrRate, salaryRateMap]);

  const chartData = monthlyStats.map(s => ({
    month: getMonthLabel(s.month),
    income: Math.round(s.income),
    expenses: Math.round(s.expenses),
    savings: Math.round(s.savings),
    incomeInr: Math.round(s.incomeInr),
    expensesInr: Math.round(s.expensesInr),
    savingsInr: Math.round(s.savingsInr),
  }));

  const categoryData = useMemo(() => {
    const map = new Map<string, { value: number; valueInr: number }>();
    expenses
      .filter(e => getMonthKey(e.date) === currentMonth)
      .forEach(e => {
        const amt = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
        const prev = map.get(e.category) ?? { value: 0, valueInr: 0 };
        map.set(e.category, { value: prev.value + amt, valueInr: prev.valueInr + amt * currentMonthRate });
      });
    return Array.from(map.entries()).map(([name, v]) => ({ name, value: Math.round(v.value), valueInr: Math.round(v.valueInr) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, currentMonth, aedToInrRate, currentMonthRate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted mt-1">{getMonthLabel(currentMonth)} Overview</p>
      </div>

      {/* Spending warnings */}
      {showOverBudget && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-400">Expenses exceed income this month!</div>
            <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
              Spent AED {monthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} (₹{monthExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) vs income AED {monthIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}. Reduce spending to avoid a deficit.
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
              AED {monthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} spent (₹{monthExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}). Only AED {(monthIncome - monthExpenses).toLocaleString('en-AE', { maximumFractionDigits: 0 })} remaining this month.
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Income"
          value={`AED ${monthIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(monthIncomeInr, 'INR')}`}
          icon={<TrendingUp size={16} />}
          color="green"
        />
        <StatCard
          title="Total Expenses"
          value={`AED ${monthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(monthExpensesInr, 'INR')}`}
          icon={<TrendingDown size={16} />}
          color="red"
        />
        <StatCard
          title="Savings"
          value={`AED ${monthSavings.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(monthSavingsInr, 'INR')}`}
          icon={<PiggyBank size={16} />}
          color="blue"
        />
        <StatCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          sub={savingsRate >= 30 ? '🎉 Excellent!' : savingsRate >= 20 ? '👍 Good' : '⚠️ Low'}
          icon={<Percent size={16} />}
          color="theme"
        />
      </div>

      {/* Net Worth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Net Worth"
          value={`AED ${netWorth.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(netWorthInr, 'INR')} · savings + gold + investments`}
          icon={<Landmark size={16} />}
          color="blue"
        />
      </div>

      {/* Exchange rate banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#A6445D]/10 to-[#C75B76]/10 border border-[#A6445D]/20">
        <ArrowRightLeft size={16} className="text-[#A6445D] shrink-0" />
        <span className="text-sm text-[#C75B76]">
          <span className="font-semibold">{salaryRateMap.has(currentMonth) ? "This Month's Salary Rate:" : 'Live Rate:'}</span> 1 AED = ₹{currentMonthRate.toFixed(2)} INR &nbsp;·&nbsp;
          AED {monthIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })} = ₹{(monthIncome * currentMonthRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-primary mb-4">6-Month Overview</h2>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted text-sm">No data yet. Add income & expenses to see trends.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip aedToInrRate={aedToInrRate} />} />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="expenses" />
                <Bar dataKey="savings" fill="#3b82f6" radius={[4, 4, 0, 0]} name="savings" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-end">
            {[{ label: 'Income', color: '#22c55e' }, { label: 'Expenses', color: '#ef4444' }, { label: 'Savings', color: '#3b82f6' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-4">Spending by Category</h2>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted text-sm text-center">No expenses this month yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#78716c'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, _name: string, entry: any) => [`AED ${v.toLocaleString()} · ₹${(entry?.payload?.valueInr ?? v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {categoryData.slice(0, 5).map(cat => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat.name] ?? '#78716c' }} />
                      <span className="text-muted">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-primary font-medium">AED {cat.value.toLocaleString()}</div>
                      <div className="text-muted">≈ ₹{cat.valueInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-4">Recent Expenses</h2>
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">No expenses yet. Start tracking your spending!</div>
        ) : (
          <div className="space-y-2">
            {expenses.slice(0, 5).map(exp => {
              const expMonthRate = getMonthSalaryRate(getMonthKey(exp.date), salaryRateMap, aedToInrRate);
              const inAED = exp.currency === 'AED' ? exp.amount : exp.amount / expMonthRate;
              const inINR = exp.currency === 'AED' ? exp.amount * expMonthRate : exp.amount;
              return (
                <div key={exp.id} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: CATEGORY_COLORS[exp.category] ?? '#78716c' }}>
                      {exp.category[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-primary">{exp.category}</div>
                      <div className="text-xs text-muted">{exp.notes || exp.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-400">-{exp.currency} {exp.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted">
                      {exp.currency === 'AED'
                        ? `≈ ₹${inINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        : `≈ AED ${inAED.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
