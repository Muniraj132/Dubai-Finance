import { useMemo } from 'react';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useExpenses, useIncomes, useSettings } from '../stores/useAppStore';
import { PageHeader } from '../components/ui';
import { computeMonthlyStats, getMonthLabel, CATEGORY_COLORS, convertToAED, getCurrentMonthKey, getMonthKey } from '../utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const CustomTooltip = ({ active, payload, label, aedToInrRate }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <div className="text-muted mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-primary capitalize">{p.name}:</span>
            <span className="font-semibold text-primary">AED {typeof p.value === 'number' ? p.value.toLocaleString('en-AE', { maximumFractionDigits: 0 }) : p.value}</span>
          </div>
          {typeof p.value === 'number' && aedToInrRate > 0 && (
            <div className="text-muted ml-4">≈ ₹{(p.value * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const { aedToInrRate } = useSettings();
  const currentMonth = getCurrentMonthKey();
  const today = new Date().toISOString().split('T')[0];

  const monthlyStats = useMemo(() => computeMonthlyStats(expenses, incomes, aedToInrRate), [expenses, incomes, aedToInrRate]);
  const chartData = monthlyStats.slice(-12).map(s => ({
    month: getMonthLabel(s.month),
    income: Math.round(s.income),
    expenses: Math.round(s.expenses),
    savings: Math.round(s.savings),
  }));

  // Today's summary
  const todayExpenses = useMemo(() =>
    expenses.filter(e => e.date === today)
      .reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0),
    [expenses, today, aedToInrRate]
  );
  const todayIncome = useMemo(() =>
    incomes.filter(i => i.date === today)
      .reduce((s, i) => s + convertToAED(i.amount, i.currency, aedToInrRate), 0),
    [incomes, today, aedToInrRate]
  );

  // Current month totals for spending warning
  const currentMonthExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.date) === currentMonth)
      .reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0),
    [expenses, currentMonth, aedToInrRate]
  );
  const currentMonthIncome = useMemo(() =>
    incomes.filter(i => getMonthKey(i.date) === currentMonth)
      .reduce((s, i) => s + convertToAED(i.amount, i.currency, aedToInrRate), 0),
    [incomes, currentMonth, aedToInrRate]
  );
  const spendingRatio = currentMonthIncome > 0 ? currentMonthExpenses / currentMonthIncome : 0;
  const showOverBudget = currentMonthIncome > 0 && spendingRatio >= 1;
  const showHighSpending = currentMonthIncome > 0 && spendingRatio >= 0.8 && spendingRatio < 1;

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const amt = convertToAED(e.amount, e.currency, aedToInrRate);
      map.set(e.category, (map.get(e.category) ?? 0) + amt);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, aedToInrRate]);

  const currentMonthCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.filter(e => getMonthKey(e.date) === currentMonth).forEach(e => {
      const amt = convertToAED(e.amount, e.currency, aedToInrRate);
      map.set(e.category, (map.get(e.category) ?? 0) + amt);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, currentMonth, aedToInrRate]);

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
              Spent AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} (₹{(currentMonthExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}) vs income AED {currentMonthIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}. Review your spending categories below.
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
              AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} spent (₹{(currentMonthExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}). Only AED {(currentMonthIncome - currentMonthExpenses).toLocaleString('en-AE', { maximumFractionDigits: 0 })} left this month.
            </div>
          </div>
        </div>
      )}

      {/* Today's Summary */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={15} className="text-[#A6445D]" />
          <h2 className="text-sm font-semibold text-primary">Today's Summary</h2>
          <span className="text-xs text-muted ml-auto">{today}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Expenses Today</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              AED {todayExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              ≈ ₹{(todayExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-4 py-3">
            <div className="text-xs text-muted mb-1">Income Today</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              AED {todayIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              ≈ ₹{(todayIncome * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
              <div className="text-sm text-muted">AED {bestSavingMonth.savings.toLocaleString('en-AE', { maximumFractionDigits: 0 })} saved</div>
              <div className="text-xs text-muted mt-0.5">≈ ₹{(bestSavingMonth.savings * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          )}
          {worstSpendingMonth && (
            <div className="card bg-red-500/5 border-red-500/20">
              <div className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">📊 Highest Spending Month</div>
              <div className="text-primary font-bold">{getMonthLabel(worstSpendingMonth.month)}</div>
              <div className="text-sm text-muted">AED {worstSpendingMonth.expenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} spent</div>
              <div className="text-xs text-muted mt-0.5">≈ ₹{(worstSpendingMonth.expenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
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
              <Tooltip content={<CustomTooltip aedToInrRate={aedToInrRate} />} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="income" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="expenses" />
              <Line type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} strokeDasharray="4 2" name="savings" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Month Spending */}
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-1">This Month — by Category</h2>
          <div className="text-xs text-muted mb-4">
            Total: AED {currentMonthExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
          <span className="ml-2 text-[#A6445D]">≈ ₹{(currentMonthExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
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
                  <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()} · ₹${(v * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, '']} />
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
                      <span className="text-primary font-medium">AED {cat.value.toLocaleString()}</span>
                      <span className="text-muted ml-1.5">≈ ₹{(cat.value * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
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
                <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()} · ₹${(v * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Total']} />
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
              <Tooltip content={<CustomTooltip aedToInrRate={aedToInrRate} />} />
              <Bar dataKey="savings" fill="#3b82f6" radius={[4, 4, 0, 0]} name="savings">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.savings >= 0 ? '#3b82f6' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
