import { useState, useMemo } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { useAppStore, useBudgets, useExpenses, useSettings } from '../stores/useAppStore';
import { ExpenseCategory, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, EmptyState } from '../components/ui';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS, getCurrentMonthKey, getMonthKey, convertToAED } from '../utils';

export default function BudgetPlanner() {
  const budgets = useBudgets();
  const expenses = useExpenses();
  const { setBudget, deleteBudget } = useAppStore();
  const settings = useSettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [form, setForm] = useState({ category: 'Food' as ExpenseCategory, amount: 0, currency: 'AED' as Currency });

  const monthBudgets = useMemo(() =>
    budgets.filter(b => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const monthExpenses = useMemo(() => {
    const map = new Map<string, number>();
    expenses.filter(e => getMonthKey(e.date) === selectedMonth).forEach(e => {
      const amt = convertToAED(e.amount, e.currency, settings.aedToInrRate);
      map.set(e.category, (map.get(e.category) ?? 0) + amt);
    });
    return map;
  }, [expenses, selectedMonth, settings.aedToInrRate]);

  const handleSave = () => {
    if (!form.amount) return;
    setBudget({ month: selectedMonth, category: form.category, amount: form.amount, currency: form.currency });
    setModalOpen(false);
  };

  // Generate month options (last 3 + next 3)
  const months = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = -3; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(key);
    }
    return list;
  }, []);

  const totalBudget = monthBudgets.reduce((s, b) => s + (b.currency === 'AED' ? b.amount : b.amount / settings.aedToInrRate), 0);
  const totalSpent = Array.from(monthExpenses.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budget Planner"
        subtitle={`Total budget: AED ${totalBudget.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · Spent: AED ${totalSpent.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
        action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Set Budget</Button>}
      />

      <div className="flex justify-end">
        <Select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-40">
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>

      {monthBudgets.length === 0 ? (
        <EmptyState
          icon={<Wallet size={40} />}
          title="No budgets for this month"
          description="Set category budgets to track your spending limits."
        />
      ) : (
        <div className="space-y-3">
          {monthBudgets.map(budget => {
            const budgetAED = budget.currency === 'AED' ? budget.amount : budget.amount / settings.aedToInrRate;
            const spent = monthExpenses.get(budget.category) ?? 0;
            const pct = budgetAED > 0 ? (spent / budgetAED) * 100 : 0;
            const remaining = budgetAED - spent;
            const isOver = pct >= 100;
            const isNear = pct >= 80 && pct < 100;

            const statusColor = isOver ? 'red' : isNear ? 'yellow' : 'green';
            const statusLabel = isOver ? 'Over Budget' : isNear ? 'Near Limit' : 'On Track';

            return (
              <div key={budget.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: CATEGORY_COLORS[budget.category] ?? '#78716c' }}>
                      {budget.category[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-primary">{budget.category}</div>
                      <div className="text-xs text-muted">Budget: {budget.currency} {budget.amount.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isOver ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
                      isNear ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                      'bg-green-500/15 text-green-700 dark:text-green-400'
                    }`}>
                      {statusLabel}
                    </div>
                  </div>
                </div>

                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: isOver ? '#ef4444' : isNear ? '#f59e0b' : CATEGORY_COLORS[budget.category] ?? '#22c55e'
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted">
                    Spent: <span className="text-primary font-medium">AED {spent.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</span>
                  </span>
                  <span className={remaining < 0 ? 'text-red-700 dark:text-red-400 font-medium' : 'text-muted'}>
                    {remaining < 0 ? `Over by AED ${Math.abs(remaining).toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : `AED ${remaining.toLocaleString('en-AE', { maximumFractionDigits: 0 })} left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Set Budget">
        <div className="space-y-4">
          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Amount">
              <Input type="number" min="0" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
          </div>
          <p className="text-xs text-muted">This will set the budget for <span className="text-primary font-medium">{form.category}</span> in <span className="text-primary font-medium">{selectedMonth}</span>.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Set Budget</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
