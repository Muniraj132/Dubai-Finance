import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Percent, ArrowRightLeft, AlertTriangle, Landmark, LineChart, Wallet, HandCoins, IndianRupee } from 'lucide-react';
import { useExpenses, useIncomes, useGoldPurchases, useInvestments, useInvestmentTransactions, useLiabilities, useLiabilityTransactions, useChitFunds, useChitInstallments, useSettings } from '../stores/useAppStore';
import { StatCard, Select } from '../components/ui';
import {
  resolveAed, resolveInr, formatCurrency, getCurrentMonthKey, getMonthKey, getMonthLabel, computeMonthlyStats, getMonthSalaryRate, CATEGORY_COLORS,
  computeInvestmentCashFlow, computeGoldCashFlow, computeDebtCashFlow, computeChitCashFlow, computeChitNetValue, computeFinancialSummary, computeNetWorth, computePortfolioLiabilityStats,
} from '../utils';
import { useSalaryRateMap } from '../hooks';
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
              <span className="font-semibold text-primary">
                {typeof inrValue === 'number' ? `₹${inrValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `AED ${p.value?.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
              </span>
            </div>
            {typeof inrValue === 'number' && (
              <div className="text-xs text-muted ml-4">≈ AED {p.value?.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</div>
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
  const investmentTransactions = useInvestmentTransactions();
  const liabilities = useLiabilities();
  const liabilityTransactions = useLiabilityTransactions();
  const chitFunds = useChitFunds();
  const chitInstallments = useChitInstallments();
  const settings = useSettings();
  const { aedToInrRate } = settings;

  const currentMonth = getCurrentMonthKey();

  // Month filter — 'all' aggregates every transaction, otherwise scoped to one month key (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const isAllTime = selectedMonth === 'all';

  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    expenses.forEach(e => set.add(getMonthKey(e.date)));
    incomes.forEach(i => set.add(getMonthKey(i.date)));
    investmentTransactions.forEach(t => set.add(getMonthKey(t.date)));
    goldPurchases.forEach(g => set.add(getMonthKey(g.date)));
    liabilityTransactions.forEach(t => set.add(getMonthKey(t.date)));
    chitInstallments.forEach(i => { if (i.paid_amount) set.add(getMonthKey(i.paid_date)); });
    return Array.from(set).sort().reverse();
  }, [expenses, incomes, investmentTransactions, goldPurchases, liabilityTransactions, chitInstallments, currentMonth]);

  // Every AED figure for a given month is valued at that month's salary
  // conversion rate (see buildSalaryRateMap) instead of each transaction's
  // own frozen/live rate — so "balance after expenses" reflects real
  // converted rupees, not a rate that drifted day to day within the month.
  const salaryRateMap = useSalaryRateMap(incomes, aedToInrRate);
  const selectedMonthRate = isAllTime ? aedToInrRate : getMonthSalaryRate(selectedMonth, salaryRateMap, aedToInrRate);

  const filteredExpenses = useMemo(() =>
    isAllTime ? expenses : expenses.filter(e => getMonthKey(e.date) === selectedMonth),
    [expenses, isAllTime, selectedMonth]
  );
  const filteredIncomes = useMemo(() =>
    isAllTime ? incomes : incomes.filter(i => getMonthKey(i.date) === selectedMonth),
    [incomes, isAllTime, selectedMonth]
  );
  const filteredInvestmentTxns = useMemo(() =>
    isAllTime ? investmentTransactions : investmentTransactions.filter(t => getMonthKey(t.date) === selectedMonth),
    [investmentTransactions, isAllTime, selectedMonth]
  );
  const filteredGoldPurchases = useMemo(() =>
    isAllTime ? goldPurchases : goldPurchases.filter(g => getMonthKey(g.date) === selectedMonth),
    [goldPurchases, isAllTime, selectedMonth]
  );
  const filteredLiabilityTxns = useMemo(() =>
    isAllTime ? liabilityTransactions : liabilityTransactions.filter(t => getMonthKey(t.date) === selectedMonth),
    [liabilityTransactions, isAllTime, selectedMonth]
  );
  const filteredChitInstallments = useMemo(() =>
    isAllTime ? chitInstallments : chitInstallments.filter(i => getMonthKey(i.paid_date) === selectedMonth),
    [chitInstallments, isAllTime, selectedMonth]
  );

  const periodExpenses = useMemo(() =>
    filteredExpenses.reduce((sum, e) => sum + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0),
    [filteredExpenses, aedToInrRate]
  );
  const periodExpensesInr = useMemo(() =>
    filteredExpenses.reduce((sum, e) => {
      if (e.currency === 'INR') return sum + e.amount;
      const aed = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      return sum + aed * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
    }, 0),
    [filteredExpenses, salaryRateMap, aedToInrRate]
  );

  const periodIncome = useMemo(() =>
    filteredIncomes.reduce((sum, i) => sum + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0),
    [filteredIncomes, aedToInrRate]
  );
  const periodIncomeInr = useMemo(() =>
    filteredIncomes.reduce((sum, i) => {
      if (i.currency === 'INR') return sum + i.amount;
      const aed = resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate);
      return sum + aed * getMonthSalaryRate(getMonthKey(i.date), salaryRateMap, aedToInrRate);
    }, 0),
    [filteredIncomes, salaryRateMap, aedToInrRate]
  );

  // Investments — cash converted into a different asset (stocks, funds,
  // gold, ...), never a living expense. See computeFinancialSummary in utils.
  const periodInvestmentCash = useMemo(() =>
    computeInvestmentCashFlow(filteredInvestmentTxns, aedToInrRate, salaryRateMap),
    [filteredInvestmentTxns, aedToInrRate, salaryRateMap]
  );
  const periodGoldCash = useMemo(() =>
    computeGoldCashFlow(filteredGoldPurchases, aedToInrRate, salaryRateMap),
    [filteredGoldPurchases, aedToInrRate, salaryRateMap]
  );
  const periodInvestments = periodInvestmentCash.aed + periodGoldCash.aed;
  const periodInvestmentsInr = periodInvestmentCash.inr + periodGoldCash.inr;

  // Debt paid down is also "saved" (cash converted into reduced debt, same
  // as an investment); debt interest is a genuine cost, like a living
  // expense. See computeDebtCashFlow / computeFinancialSummary in utils.
  const periodDebtCash = useMemo(() =>
    computeDebtCashFlow(filteredLiabilityTxns, aedToInrRate, salaryRateMap),
    [filteredLiabilityTxns, aedToInrRate, salaryRateMap]
  );

  // Chit fund contributions — a pooled forced-savings scheme, not a living
  // expense (see computeChitCashFlow / docs/ARCHITECTURE.md §7.11).
  const periodChitCash = useMemo(() =>
    computeChitCashFlow(filteredChitInstallments, aedToInrRate),
    [filteredChitInstallments, aedToInrRate]
  );

  const summary = useMemo(() => computeFinancialSummary({
    income: periodIncome, incomeInr: periodIncomeInr,
    livingExpenses: periodExpenses, livingExpensesInr: periodExpensesInr,
    investments: periodInvestments, investmentsInr: periodInvestmentsInr,
    chitContributions: periodChitCash.aed, chitContributionsInr: periodChitCash.inr,
    debtPrincipalPaid: periodDebtCash.principalAed, debtPrincipalPaidInr: periodDebtCash.principalInr,
    debtInterest: periodDebtCash.interestAed, debtInterestInr: periodDebtCash.interestInr,
  }), [periodIncome, periodIncomeInr, periodExpenses, periodExpensesInr, periodInvestments, periodInvestmentsInr, periodChitCash, periodDebtCash]);

  // Spending warnings — based on living expenses vs. income only; investing
  // heavily isn't overspending, it's saving in a different form.
  const spendingRatio = periodIncome > 0 ? periodExpenses / periodIncome : 0;
  const showOverBudget = periodIncome > 0 && spendingRatio >= 1;
  const showHighSpending = periodIncome > 0 && spendingRatio >= 0.8 && spendingRatio < 1;
  const periodLabel = isAllTime ? 'this period' : 'this month';

  const monthlyStats = useMemo(() =>
    computeMonthlyStats(expenses, incomes, aedToInrRate).slice(-6),
    [expenses, incomes, aedToInrRate]
  );

  // Net Worth = cash on hand + everything you own today − what you owe.
  // Cash on hand must subtract every dirham/rupee that ever left the bank to
  // buy an investment/gold or to pay down a debt (principal and interest
  // both), or it's counted twice: once as cash still sitting there, and
  // again as the asset it became or the debt it paid off. See computeNetWorth.
  const { netWorth, netWorthInr } = useMemo(() => {
    const allTimeIncome = incomes.reduce((s, i) => s + resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate), 0);
    const allTimeIncomeInr = incomes.reduce((s, i) => {
      if (i.currency === 'INR') return s + i.amount;
      const aed = resolveAed(i.amount, i.currency, i.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(i.date), salaryRateMap, aedToInrRate);
    }, 0);
    const allTimeExpenses = expenses.reduce((s, e) => s + resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate), 0);
    const allTimeExpensesInr = expenses.reduce((s, e) => {
      if (e.currency === 'INR') return s + e.amount;
      const aed = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      return s + aed * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
    }, 0);

    const allTimeInvestmentCash = computeInvestmentCashFlow(investmentTransactions, aedToInrRate, salaryRateMap);
    const allTimeGoldCash = computeGoldCashFlow(goldPurchases, aedToInrRate, salaryRateMap);
    const investmentsValue = investments.reduce((s, i) => s + resolveAed(i.currentValue, i.currency, i.currentValueAed, aedToInrRate), 0);
    const investmentsValueInr = investments.reduce((s, i) => s + resolveInr(i.currentValue, i.currency, i.currentValueInr, aedToInrRate), 0);
    // Gold has no live price feed — cost basis doubles as current value.
    const allTimeDebtCash = computeDebtCashFlow(liabilityTransactions, aedToInrRate, salaryRateMap);
    const liabilityStats = computePortfolioLiabilityStats(liabilities, liabilityTransactions, aedToInrRate);
    // Chit funds have no separate market value either — net contributed
    // (paid minus any lump-sum already received) doubles as their value,
    // same reasoning as gold. Folded into the same investedCash/
    // investmentsValue pair so it nets out correctly (see computeChitNetValue).
    const chitNetValue = computeChitNetValue(chitFunds, chitInstallments, aedToInrRate);

    return computeNetWorth({
      allTimeIncome, allTimeIncomeInr,
      allTimeLivingExpenses: allTimeExpenses, allTimeLivingExpensesInr: allTimeExpensesInr,
      investedCash: allTimeInvestmentCash.aed + allTimeGoldCash.aed + chitNetValue.aed,
      investedCashInr: allTimeInvestmentCash.inr + allTimeGoldCash.inr + chitNetValue.inr,
      investmentsValue: investmentsValue + allTimeGoldCash.aed + chitNetValue.aed,
      investmentsValueInr: investmentsValueInr + allTimeGoldCash.inr + chitNetValue.inr,
      debtPrincipalPaid: allTimeDebtCash.principalAed, debtPrincipalPaidInr: allTimeDebtCash.principalInr,
      debtInterestPaid: allTimeDebtCash.interestAed, debtInterestPaidInr: allTimeDebtCash.interestInr,
      liabilitiesOutstanding: liabilityStats.outstandingAed, liabilitiesOutstandingInr: liabilityStats.outstandingInr,
    });
  }, [incomes, expenses, goldPurchases, investments, investmentTransactions, liabilities, liabilityTransactions, chitFunds, chitInstallments, aedToInrRate, salaryRateMap]);

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
    filteredExpenses.forEach(e => {
      const amt = resolveAed(e.amount, e.currency, e.amountAed, aedToInrRate);
      const inrAmt = e.currency === 'INR' ? e.amount : amt * getMonthSalaryRate(getMonthKey(e.date), salaryRateMap, aedToInrRate);
      const prev = map.get(e.category) ?? { value: 0, valueInr: 0 };
      map.set(e.category, { value: prev.value + amt, valueInr: prev.valueInr + inrAmt });
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, value: Math.round(v.value), valueInr: Math.round(v.valueInr) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, salaryRateMap, aedToInrRate]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">{isAllTime ? 'All Time' : getMonthLabel(selectedMonth)} Overview</p>
        </div>
        <Select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-40">
          <option value="all">All Time</option>
          {availableMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
        </Select>
      </div>

      {/* Spending warnings */}
      {showOverBudget && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-400">Living expenses exceed income {periodLabel}!</div>
            <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
              Spent ₹{periodExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (AED {periodExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}) vs income ₹{periodIncomeInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Reduce spending to avoid a deficit.
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
              ₹{periodExpensesInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent (AED {periodExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}). Only ₹{(periodIncomeInr - periodExpensesInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })} remaining {periodLabel}.
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Income"
          value={formatCurrency(summary.incomeInr, 'INR')}
          sub={`≈ AED ${summary.income.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp size={16} />}
          color="green"
        />
        <StatCard
          title="Living Expenses"
          value={formatCurrency(summary.livingExpensesInr, 'INR')}
          sub={`≈ AED ${summary.livingExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          icon={<TrendingDown size={16} />}
          color="red"
        />
        <StatCard
          title="Investments"
          value={formatCurrency(summary.investmentsInr, 'INR')}
          sub={`≈ AED ${summary.investments.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · stocks, funds, gold`}
          icon={<LineChart size={16} />}
          color="blue"
        />
        <StatCard
          title="Cash Remaining"
          value={formatCurrency(summary.cashRemainingInr, 'INR')}
          sub={`≈ AED ${summary.cashRemaining.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          icon={<Wallet size={16} />}
          color="cyan"
        />
      </div>

      {/* Chit Contributions, Debt Paid Down, Total Saved, Savings Rate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chit Contributions"
          value={formatCurrency(summary.chitContributionsInr, 'INR')}
          sub={`≈ AED ${summary.chitContributions.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · pooled savings`}
          icon={<IndianRupee size={16} />}
          color="purple"
        />
        <StatCard
          title="Debt Paid Down"
          value={formatCurrency(summary.debtPrincipalPaidInr, 'INR')}
          sub={`≈ AED ${summary.debtPrincipalPaid.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · +${formatCurrency(summary.debtInterestInr, 'INR')} interest`}
          icon={<HandCoins size={16} />}
          color="green"
        />
        <StatCard
          title="Total Saved"
          value={formatCurrency(summary.totalSavedInr, 'INR')}
          sub={`≈ AED ${summary.totalSaved.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · investments + chits + debt paid + cash`}
          icon={<PiggyBank size={16} />}
          color="cyan"
        />
        <StatCard
          title="Savings Rate"
          value={`${summary.savingsRate.toFixed(1)}%`}
          sub={summary.savingsRate >= 30 ? '🎉 Excellent!' : summary.savingsRate >= 20 ? '👍 Good' : '⚠️ Low'}
          icon={<Percent size={16} />}
          color="theme"
        />
      </div>

      {/* Net Worth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Net Worth"
          value={formatCurrency(netWorthInr, 'INR')}
          sub={`≈ AED ${netWorth.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · cash + investments + gold + chits − liabilities`}
          icon={<Landmark size={16} />}
          color="blue"
        />
      </div>

      {/* Exchange rate banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#6366F1]/10 to-[#818CF8]/10 border border-[#6366F1]/20">
        <ArrowRightLeft size={16} className="text-[#6366F1] shrink-0" />
        <span className="text-sm text-[#818CF8]">
          <span className="font-semibold">{!isAllTime && salaryRateMap.has(selectedMonth) ? "This Month's Salary Rate:" : 'Live Rate:'}</span> 1 AED = ₹{selectedMonthRate.toFixed(2)} INR &nbsp;·&nbsp;
          ₹{periodIncomeInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} = AED {periodIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}
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
                <Bar dataKey="savings" fill="#06b6d4" radius={[4, 4, 0, 0]} name="savings" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-end">
            {[{ label: 'Income', color: '#22c55e' }, { label: 'Expenses', color: '#ef4444' }, { label: 'Savings', color: '#06b6d4' }].map(l => (
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
                  <Tooltip formatter={(v: number, _name: string, entry: any) => [`₹${(entry?.payload?.valueInr ?? v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} · AED ${v.toLocaleString()}`, '']} />
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
                      <div className="text-primary font-medium">₹{cat.valueInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="text-muted">≈ AED {cat.value.toLocaleString()}</div>
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
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            {isAllTime ? 'No expenses yet. Start tracking your spending!' : 'No expenses for this month.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.slice(0, 5).map(exp => {
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
