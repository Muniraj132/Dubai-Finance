import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Gem } from 'lucide-react';
import { useAppStore, useGoldPurchases, useSettings } from '../stores/useAppStore';
import { GoldPurchase, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, EmptyState, StatCard } from '../components/ui';
import { formatDate, formatCurrency } from '../utils';

const defaultForm = (): Omit<GoldPurchase, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().split('T')[0],
  weightGrams: 0,
  pricePerGram: 0,
  currency: 'AED',
  notes: '',
});

const GOLD_TARGET_GRAMS = 2;

export default function GoldTracker() {
  const purchases = useGoldPurchases();
  const { addGoldPurchase, updateGoldPurchase, deleteGoldPurchase } = useAppStore();
  const settings = useSettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());

  const stats = useMemo(() => {
    const totalWeight = purchases.reduce((s, p) => s + p.weightGrams, 0);
    const totalValue = purchases.reduce((s, p) => {
      const value = p.weightGrams * p.pricePerGram;
      return s + (p.currency === 'AED' ? value : value / settings.aedToInrRate);
    }, 0);
    return { totalWeight, totalValue };
  }, [purchases, settings.aedToInrRate]);

  const needMore = Math.max(0, GOLD_TARGET_GRAMS - stats.totalWeight);
  const pct = Math.min(100, (stats.totalWeight / GOLD_TARGET_GRAMS) * 100);

  const openAdd = () => { setForm(defaultForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (p: GoldPurchase) => {
    setForm({ date: p.date, weightGrams: p.weightGrams, pricePerGram: p.pricePerGram, currency: p.currency, notes: p.notes });
    setEditId(p.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.weightGrams || !form.date) return;
    if (editId) updateGoldPurchase(editId, form);
    else addGoldPurchase(form);
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gold Tracker"
        subtitle="Track your gold purchases in Dubai"
        action={<Button onClick={openAdd}><Plus size={16} /> Add Purchase</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Gold"
          value={`${stats.totalWeight.toFixed(4)} g`}
          sub={`Target: ${GOLD_TARGET_GRAMS}g`}
          icon={<Gem size={16} />}
          color="yellow"
        />
        <StatCard
          title="Total Value"
          value={`AED ${stats.totalValue.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
          sub={`≈ ${formatCurrency(stats.totalValue * settings.aedToInrRate, 'INR')}`}
          icon={<Gem size={16} />}
          color="orange"
        />
        <StatCard
          title="Purchases"
          value={`${purchases.length}`}
          sub="Total entries"
          icon={<Gem size={16} />}
          color="amber"
        />
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">Gold Goal Progress</h2>
          <span className="text-xs text-muted">{GOLD_TARGET_GRAMS}g Target</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-amber-400 font-semibold">{stats.totalWeight.toFixed(4)}g collected</span>
          {needMore > 0 ? (
            <span className="text-muted">Need <span className="text-primary font-medium">{needMore.toFixed(4)}g</span> more</span>
          ) : (
            <span className="text-green-400 font-medium">🎉 Target reached!</span>
          )}
        </div>
      </div>

      {/* Table */}
      {purchases.length === 0 ? (
        <EmptyState icon={<Gem size={40} />} title="No gold purchases yet" description="Start tracking your gold investments in Dubai." />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Weight (g)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Price/g</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden sm:table-cell">Notes</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-white/3 transition-colors group">
                  <td className="px-4 py-3 text-muted text-xs">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-400">{p.weightGrams.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-primary text-xs">{p.currency} {p.pricePerGram.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary text-xs">{p.currency} {(p.weightGrams * p.pricePerGram).toLocaleString('en-AE', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">{p.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)} className="p-1 text-muted hover:text-primary"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteId(p.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Gold Purchase' : 'Add Gold Purchase'}>
        <div className="space-y-4">
          <FormField label="Date">
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Weight (grams)">
              <Input type="number" min="0" step="0.0001" value={form.weightGrams || ''} onChange={e => setForm(f => ({ ...f, weightGrams: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 1.8246" />
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Price per Gram">
            <Input type="number" min="0" step="0.01" value={form.pricePerGram || ''} onChange={e => setForm(f => ({ ...f, pricePerGram: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </FormField>
          {form.weightGrams > 0 && form.pricePerGram > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <span className="text-amber-400 font-medium">Total: {form.currency} {(form.weightGrams * form.pricePerGram).toLocaleString('en-AE', { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Shop name, occasion..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add'} Purchase</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteGoldPurchase(deleteId)} title="Delete Purchase" message="Delete this gold purchase?" />
    </div>
  );
}
