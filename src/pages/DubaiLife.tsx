import { useMemo } from 'react';
import { Palmtree, Calendar, TrendingUp, PiggyBank, Gem, Heart } from 'lucide-react';
import { useExpenses, useIncomes, useGoldPurchases, useSettings } from '../stores/useAppStore';
import { PageHeader, StatCard } from '../components/ui';
import { convertToAED, formatCurrency, EXPENSE_CATEGORIES } from '../utils';

export default function DubaiLife() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const goldPurchases = useGoldPurchases();
  const settings = useSettings();
  const { aedToInrRate, dubaiArrivalDate } = settings;

  const daysInDubai = useMemo(() => {
    if (!dubaiArrivalDate) return 0;
    const diff = Date.now() - new Date(dubaiArrivalDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [dubaiArrivalDate]);

  const totalEarnings = useMemo(() =>
    incomes.reduce((s, i) => s + convertToAED(i.amount, i.currency, aedToInrRate), 0),
    [incomes, aedToInrRate]
  );

  const totalExpenses = useMemo(() =>
    expenses.reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0),
    [expenses, aedToInrRate]
  );

  const totalSavings = totalEarnings - totalExpenses;

  const totalGoldGrams = useMemo(() =>
    goldPurchases.reduce((s, g) => s + g.weightGrams, 0),
    [goldPurchases]
  );

  const totalGoldValue = useMemo(() =>
    goldPurchases.reduce((s, g) => {
      const val = g.weightGrams * g.pricePerGram;
      return s + (g.currency === 'AED' ? val : val / aedToInrRate);
    }, 0),
    [goldPurchases, aedToInrRate]
  );

  const familySupport = useMemo(() =>
    expenses.filter(e => e.category === 'Family Support')
      .reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0),
    [expenses, aedToInrRate]
  );

  const savingsRate = totalEarnings > 0 ? (totalSavings / totalEarnings) * 100 : 0;
  const dailyEarning = daysInDubai > 0 ? totalEarnings / daysInDubai : 0;
  const dailySaving = daysInDubai > 0 ? totalSavings / daysInDubai : 0;

  const milestones = [
    { label: '1 Month', days: 30, done: daysInDubai >= 30 },
    { label: '3 Months', days: 90, done: daysInDubai >= 90 },
    { label: '6 Months', days: 180, done: daysInDubai >= 180 },
    { label: '1 Year', days: 365, done: daysInDubai >= 365 },
    { label: '2 Years', days: 730, done: daysInDubai >= 730 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dubai Life" subtitle="Your personal journey dashboard" />

      {/* Hero */}
      <div className="card bg-gradient-to-br from-orange-500/15 to-amber-500/10 border-orange-500/20 text-center py-8">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Palmtree size={28} className="text-white" />
          </div>
        </div>
        <div className="text-5xl font-black text-primary tracking-tight">{daysInDubai}</div>
        <div className="text-muted mt-1">Days in Dubai 🇦🇪</div>
        {dubaiArrivalDate && (
          <div className="text-xs text-muted mt-1">Since {new Date(dubaiArrivalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={`AED ${totalEarnings.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(totalEarnings * aedToInrRate, 'INR')}`}
          icon={<TrendingUp size={16} />}
          color="green"
        />
        <StatCard
          title="Total Savings"
          value={`AED ${totalSavings.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`${savingsRate.toFixed(1)}% savings rate`}
          icon={<PiggyBank size={16} />}
          color="blue"
        />
        <StatCard
          title="Gold Purchased"
          value={`${totalGoldGrams.toFixed(4)} g`}
          sub={`AED ${totalGoldValue.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          icon={<Gem size={16} />}
          color="yellow"
        />
        <StatCard
          title="Family Support"
          value={`AED ${familySupport.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(familySupport * aedToInrRate, 'INR')}`}
          icon={<Heart size={16} />}
          color="pink"
        />
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-xs text-muted mb-1">Daily Earning (avg)</div>
          <div className="text-xl font-bold text-green-400">AED {dailyEarning.toFixed(0)}</div>
          <div className="text-xs text-muted">≈ ₹{(dailyEarning * aedToInrRate).toFixed(0)}/day</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-muted mb-1">Daily Saving (avg)</div>
          <div className={`text-xl font-bold ${dailySaving >= 0 ? 'text-blue-400' : 'text-red-400'}`}>AED {dailySaving.toFixed(0)}</div>
          <div className="text-xs text-muted">≈ ₹{(dailySaving * aedToInrRate).toFixed(0)}/day</div>
        </div>
      </div>

      {/* Journey Milestones */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-4">Journey Milestones</h2>
        <div className="space-y-3">
          {milestones.map(m => (
            <div key={m.label} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.done ? 'bg-green-500 text-white' : 'bg-white/10 text-muted'}`}>
                {m.done ? '✓' : '○'}
              </div>
              <div className="flex-1">
                <div className={`text-sm ${m.done ? 'text-primary' : 'text-muted'}`}>{m.label}</div>
              </div>
              <div className={`text-xs ${m.done ? 'text-green-400' : 'text-muted'}`}>
                {m.done ? 'Achieved! 🎉' : `${m.days - daysInDubai} days to go`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Health Score */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-4">Financial Health Score</h2>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={savingsRate >= 30 ? '#22c55e' : savingsRate >= 20 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 32 * Math.min(savingsRate, 100) / 100} ${2 * Math.PI * 32}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{savingsRate.toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className={`text-lg font-bold ${savingsRate >= 30 ? 'text-green-400' : savingsRate >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
              {savingsRate >= 30 ? '🌟 Excellent' : savingsRate >= 20 ? '👍 Good' : savingsRate >= 10 ? '⚠️ Fair' : '🔴 Needs Work'}
            </div>
            <div className="text-xs text-muted mt-1">
              {savingsRate >= 30 ? "You're saving over 30% of your income. Keep it up!" :
               savingsRate >= 20 ? "Good savings rate! Try to reach 30%." :
               "Consider reducing expenses to improve savings."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
