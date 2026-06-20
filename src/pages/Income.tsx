import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, CircleCheck } from 'lucide-react';
import { useAppStore, useIncomes, useSettings } from '../stores/useAppStore';
import { Income, IncomeSource, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, EmptyState } from '../components/ui';
import { formatDate, getCurrentMonthKey, getMonthKey } from '../utils';

const SOURCES: IncomeSource[] = ['Salary', 'Bonus', 'Freelance', 'Others'];
const SOURCE_COLORS: Record<string, string> = { Salary: '#22c55e', Bonus: '#f59e0b', Freelance: '#3b82f6', Others: '#8b5cf6' };

const defaultForm = (): Omit<Income, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  currency: 'AED',
  source: 'Salary',
  notes: '',
});

export default function IncomePage() {
  const incomes = useIncomes();
  const { addIncome, updateIncome, deleteIncome } = useAppStore();
  const settings = useSettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthKey());

  const months = useMemo(() => {
    const set = new Set(incomes.map(i => getMonthKey(i.date)));
    return Array.from(set).sort().reverse();
  }, [incomes]);

  const filtered = useMemo(() =>
    filterMonth === 'all' ? incomes : incomes.filter(i => getMonthKey(i.date) === filterMonth),
    [incomes, filterMonth]
  );

  const total = filtered.reduce((s, i) => s + (i.currency === 'AED' ? i.amount : i.amount / settings.aedToInrRate), 0);

  const openAdd = () => { setForm(defaultForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (inc: Income) => {
    setForm({ date: inc.date, amount: inc.amount, currency: inc.currency, source: inc.source, notes: inc.notes });
    setEditId(inc.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.amount || !form.date) return;
    if (editId) updateIncome(editId, form);
    else addIncome(form);
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Income"
        subtitle={`${filtered.length} entries · AED ${total.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
        action={<Button onClick={openAdd}><Plus size={16} /> Add Income</Button>}
      />
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30">
                <CircleCheck size={16} className="text-green-400 shrink-0 mt-0.5" />
                <div>
                <div className="text-sm font-semibold text-green-400">
                  Happy to see your income growing! Consider setting up a budget to manage your expenses effectively.
                  </div>
                  <div className="text-xs text-green-300/80 mt-0.5">
                  Tip: Allocate a portion of your income towards savings or investments to build a secure financial future.
                  </div>
                </div>
      </div>
      <div className="flex justify-end">
        <Select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40">
          <option value="all">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<TrendingUp size={40} />} title="No income entries" description="Record your salary, bonuses, or freelance income." />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden sm:table-cell">Notes</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filtered.map(inc => (
                <tr key={inc.id} className="hover:bg-white/3 transition-colors group">
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDate(inc.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: SOURCE_COLORS[inc.source] ?? '#78716c' }}>
                        {inc.source[0]}
                      </div>
                      <span className="text-primary font-medium text-xs">{inc.source}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell max-w-[200px] truncate">{inc.notes || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap">
                    +{inc.currency} {inc.amount.toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(inc)} className="p-1 text-muted hover:text-primary transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteId(inc.id)} className="p-1 text-muted hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Income' : 'Add Income'}>
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
            <Input type="number" min="0" step="0.01" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </FormField>
          <FormField label="Source">
            <Select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as IncomeSource }))}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add'} Income</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteIncome(deleteId)}
        title="Delete Income"
        message="Are you sure you want to delete this income entry?"
      />
    </div>
  );
}
