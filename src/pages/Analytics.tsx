import { useMemo } from 'react';
import { useExpenses, useIncomes, useSettings } from '../stores/useAppStore';
import { PageHeader, Card } from '../components/ui';
import { computeMonthlyStats, getMonthLabel, CATEGORY_COLORS, convertToAED, getCurrentMonthKey, getMonthKey } from '../utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <div className="text-muted mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-primary capitalize">{p.name}:</span>
          <span className="font-semibold text-primary">AED {typeof p.value === 'number' ? p.value.toLocaleString('en-AE', { maximumFractionDigits: 0 }) : p.value}</span>
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

  const monthlyStats = useMemo(() => computeMonthlyStats(expenses, incomes, aedToInrRate), [expenses, incomes, aedToInrRate]);
  const chartData = monthlyStats.slice(-12).map(s => ({
    month: getMonthLabel(s.month),
    income: Math.round(s.income),
    expenses: Math.round(s.expenses),
    savings: Math.round(s.savings),
  }));

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

      {/* Insights */}
      {monthlyStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestSavingMonth && (
            <div className="card bg-green-500/5 border-green-500/20">
              <div className="text-xs text-green-400 font-medium mb-1">🏆 Best Saving Month</div>
              <div className="text-primary font-bold">{getMonthLabel(bestSavingMonth.month)}</div>
              <div className="text-sm text-muted">AED {bestSavingMonth.savings.toLocaleString('en-AE', { maximumFractionDigits: 0 })} saved</div>
            </div>
          )}
          {worstSpendingMonth && (
            <div className="card bg-red-500/5 border-red-500/20">
              <div className="text-xs text-red-400 font-medium mb-1">📊 Highest Spending Month</div>
              <div className="text-primary font-bold">{getMonthLabel(worstSpendingMonth.month)}</div>
              <div className="text-sm text-muted">AED {worstSpendingMonth.expenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} spent</div>
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
              <Line type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} strokeDasharray="4 2" name="savings" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Month Spending */}
        <div className="card">
          <h2 className="text-sm font-semibold text-primary mb-4">This Month — by Category</h2>
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
                  <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {currentMonthCategoryData.map(cat => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat.name] ?? '#78716c' }} />
                      <span className="text-muted">{cat.name}</span>
                    </div>
                    <span className="text-primary font-medium">AED {cat.value.toLocaleString()}</span>
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
                <Tooltip formatter={(v: number) => [`AED ${v.toLocaleString()}`, 'Total']} />
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
