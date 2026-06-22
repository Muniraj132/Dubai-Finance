import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, AlertTriangle } from 'lucide-react';
import { useAppStore, useExpenses, useSettings, useIncomes } from '../stores/useAppStore';
import { Expense, ExpenseCategory, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, EmptyState, Badge } from '../components/ui';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS, formatDate, getCurrentMonthKey, getMonthKey, generateId, convertToAED } from '../utils';

const defaultForm = (): Omit<Expense, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  currency: 'AED',
  category: 'Food',
  notes: '',
});

export default function Expenses() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const { addExpense, updateExpense, deleteExpense } = useAppStore();
  const settings = useSettings();
  const { aedToInrRate } = settings;

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthKey());
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => getMonthKey(e.date)));
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchMonth = filterMonth === 'all' || getMonthKey(e.date) === filterMonth;
      const matchCat = filterCategory === 'All' || e.category === filterCategory;
      const matchSearch = !search || e.notes.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
      return matchMonth && matchCat && matchSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filterMonth, filterCategory, search]);

  const totalFiltered = filtered.reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0);
  const totalFilteredINR = totalFiltered * aedToInrRate;

  // Spending warning for current month
  const currentMonth = getCurrentMonthKey();
  const monthlyExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.date) === currentMonth)
      .reduce((s, e) => s + convertToAED(e.amount, e.currency, aedToInrRate), 0),
    [expenses, currentMonth, aedToInrRate]
  );
  const monthlyIncome = useMemo(() =>
    incomes.filter(i => getMonthKey(i.date) === currentMonth)
      .reduce((s, i) => s + convertToAED(i.amount, i.currency, aedToInrRate), 0),
    [incomes, currentMonth, aedToInrRate]
  );
  const spendingRatio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 0;
  const showOverBudget = filterMonth === currentMonth && monthlyIncome > 0 && spendingRatio >= 1;
  const showHighSpending = filterMonth === currentMonth && monthlyIncome > 0 && spendingRatio >= 0.8 && spendingRatio < 1;

  // Live conversion preview in modal
  const convertedAmount = form.amount > 0
    ? form.currency === 'AED'
      ? form.amount * aedToInrRate
      : form.amount / aedToInrRate
    : 0;
  const convertedLabel = form.currency === 'AED'
    ? `≈ ₹${convertedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR`
    : `≈ AED ${convertedAmount.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;

  const openAdd = () => { setForm(defaultForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (exp: Expense) => {
    setForm({ date: exp.date, amount: exp.amount, currency: exp.currency, category: exp.category, notes: exp.notes });
    setEditId(exp.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.amount || !form.date) return;
    if (editId) updateExpense(editId, form);
    else addExpense(form);
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        subtitle={`${filtered.length} transactions · AED ${totalFiltered.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · ₹${totalFilteredINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
        action={<Button onClick={openAdd}><Plus size={16} /> Add Expense</Button>}
      />

      {/* Spending warnings */}
      {showOverBudget && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-400">Expenses exceed income this month!</div>
            <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
              Spent AED {monthlyExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} (₹{(monthlyExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}) vs income AED {monthlyIncome.toLocaleString('en-AE', { maximumFractionDigits: 0 })}. Reduce spending to avoid a deficit.
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
              AED {monthlyExpenses.toLocaleString('en-AE', { maximumFractionDigits: 0 })} spent (₹{(monthlyExpenses * aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}). Only AED {(monthlyIncome - monthlyExpenses).toLocaleString('en-AE', { maximumFractionDigits: 0 })} remaining this month.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full sm:w-40">
          <option value="all">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full sm:w-40">
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Filter size={40} />} title="No expenses found" description="Add your first expense or adjust your filters." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden sm:table-cell">Notes</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filtered.map(exp => {
                  const inINR = exp.currency === 'AED' ? exp.amount * aedToInrRate : exp.amount;
                  const inAED = exp.currency === 'INR' ? exp.amount / aedToInrRate : exp.amount;
                  return (
                    <tr key={exp.id} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: CATEGORY_COLORS[exp.category] ?? '#78716c' }}>
                            {exp.category[0]}
                          </div>
                          <span className="text-primary font-medium text-xs">{exp.category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell max-w-[200px] truncate">{exp.notes || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-red-400 text-sm">
                          {exp.currency} {exp.amount.toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          {exp.currency === 'AED'
                            ? `≈ ₹${inINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : `≈ AED ${inAED.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(exp)} className="p-1 text-muted hover:text-primary transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteId(exp.id)} className="p-1 text-muted hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Expense' : 'Add Expense'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date">
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Amount">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
            {form.amount > 0 && (
              <div className="text-xs text-[#A6445D] font-medium">{convertedLabel}</div>
            )}
          </FormField>
          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add'} Expense</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteExpense(deleteId)}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </div>
  );
}
