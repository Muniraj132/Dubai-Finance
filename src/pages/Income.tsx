import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, CircleCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore, useIncomes, useSettings } from '../stores/useAppStore';
import { Income, IncomeSource, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, EmptyState } from '../components/ui';
import { formatDate, getCurrentMonthKey, getMonthKey, resolveAed, resolveInr } from '../utils';
import { useMonthOptions } from '../hooks';

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
  const [page, setPage] = useState(1);

  const months = useMonthOptions(incomes);

  const filtered = useMemo(() =>
    filterMonth === 'all' ? incomes : incomes.filter(i => getMonthKey(i.date) === filterMonth),
    [incomes, filterMonth]
  );

  const total = filtered.reduce((s, i) => s + resolveAed(i.amount, i.currency, i.amountAed, settings.aedToInrRate), 0);
  const totalInr = filtered.reduce((s, i) => s + resolveInr(i.amount, i.currency, i.amountInr, settings.aedToInrRate), 0);

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openAdd = () => { setForm({ ...defaultForm(), exchangeRateUsed: settings.aedToInrRate }); setEditId(null); setModalOpen(true); };
  const openEdit = (inc: Income) => {
    setForm({
      date: inc.date,
      amount: inc.amount,
      currency: inc.currency,
      source: inc.source,
      notes: inc.notes,
      exchangeRateUsed: inc.exchangeRateUsed ?? settings.aedToInrRate,
    });
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
        subtitle={`${filtered.length} entries · AED ${total.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · ₹${totalInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
        action={<Button onClick={openAdd}><Plus size={16} /> Add Income</Button>}
      />
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30">
                <CircleCheck size={16} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Happy to see your income growing! Consider setting up a budget to manage your expenses effectively.
                  </div>
                  <div className="text-xs text-green-700/80 dark:text-green-300/80 mt-0.5">
                  Tip: Allocate a portion of your income towards savings or investments to build a secure financial future.
                  </div>
                </div>
      </div>
      <div className="flex justify-end">
        <Select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} className="w-40">
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
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Amount (INR)</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {paginated.map(inc => (
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
                  <td className="px-4 py-3 text-right text-muted text-xs whitespace-nowrap">
                    ₹{resolveInr(inc.amount, inc.currency, inc.amountInr, settings.aedToInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    {inc.exchangeRateUsed != null && (
                      <div className="text-[10px] text-muted/60">@ {inc.exchangeRateUsed.toFixed(2)}</div>
                    )}
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-card-border text-xs text-muted">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-card-border text-muted hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-primary font-medium">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-card-border text-muted hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
          <FormField label="Exchange Rate (1 AED = ? INR)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.exchangeRateUsed ?? ''}
              onChange={e => setForm(f => ({ ...f, exchangeRateUsed: parseFloat(e.target.value) || 0 }))}
              placeholder={String(settings.aedToInrRate)}
            />
            <div className="text-[11px] text-muted mt-1">
              Defaults to today's rate ({settings.aedToInrRate}). Override with the exact rate your bank used — it's locked to this entry and won't change later.
            </div>
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
