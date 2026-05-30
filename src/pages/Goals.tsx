import { useState } from 'react';
import { Plus, Edit2, Trash2, Target, Plus as PlusIcon } from 'lucide-react';
import { useAppStore, useGoals } from '../stores/useAppStore';
import { Goal, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, ConfirmDialog, EmptyState, ProgressBar } from '../components/ui';
import { GOAL_COLORS, formatCurrency, formatDate } from '../utils';

const defaultForm = () => ({
  name: '',
  targetAmount: 0,
  currentAmount: 0,
  targetDate: '',
  currency: 'AED' as Currency,
  color: GOAL_COLORS[0],
});

export default function Goals() {
  const goals = useGoals();
  const { addGoal, updateGoal, deleteGoal } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());

  const openAdd = () => { setForm(defaultForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (g: Goal) => {
    setForm({ name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate, currency: g.currency, color: g.color });
    setEditId(g.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.targetAmount) return;
    if (editId) updateGoal(editId, form);
    else addGoal(form);
    setModalOpen(false);
  };

  const handleContribute = () => {
    if (!contributeId || contributeAmount <= 0) return;
    const goal = goals.find(g => g.id === contributeId);
    if (!goal) return;
    updateGoal(contributeId, { currentAmount: goal.currentAmount + contributeAmount });
    setContributeId(null);
    setContributeAmount(0);
  };

  const getDaysLeft = (targetDate: string) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goals"
        subtitle={`${goals.length} financial goals`}
        action={<Button onClick={openAdd}><Plus size={16} /> New Goal</Button>}
      />

      {goals.length === 0 ? (
        <EmptyState icon={<Target size={40} />} title="No goals yet" description="Set financial goals like Emergency Fund, Gold, Wedding, Travel, etc." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map(goal => {
            const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const remaining = goal.targetAmount - goal.currentAmount;
            const daysLeft = getDaysLeft(goal.targetDate);

            return (
              <div key={goal.id} className="card group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: goal.color }}>
                      {goal.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary text-sm">{goal.name}</h3>
                      {goal.targetDate && (
                        <p className="text-xs text-muted">
                          {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : 'Overdue'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(goal)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                    <button onClick={() => setDeleteId(goal.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <ProgressBar value={pct} color={goal.color} />
                  <div className="flex justify-between text-xs">
                    <span className="text-primary font-semibold">{formatCurrency(goal.currentAmount, goal.currency)}</span>
                    <span className="text-muted">of {formatCurrency(goal.targetAmount, goal.currency)}</span>
                  </div>
                </div>

                {remaining > 0 && (
                  <div className="text-xs text-muted mb-3">
                    Need <span className="text-primary font-medium">{formatCurrency(remaining, goal.currency)}</span> more
                  </div>
                )}
                {pct >= 100 && (
                  <div className="text-xs text-green-400 font-medium mb-3">🎉 Goal Achieved!</div>
                )}

                <Button
                  variant="secondary"
                  className="w-full text-xs py-1.5"
                  onClick={() => { setContributeId(goal.id); setContributeAmount(0); }}
                >
                  <PlusIcon size={12} /> Add Funds
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Goal' : 'New Goal'}>
        <div className="space-y-4">
          <FormField label="Goal Name">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency Fund" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
            <FormField label="Target Date">
              <Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Target Amount">
            <Input type="number" min="0" value={form.targetAmount || ''} onChange={e => setForm(f => ({ ...f, targetAmount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </FormField>
          <FormField label="Current Amount">
            <Input type="number" min="0" value={form.currentAmount || ''} onChange={e => setForm(f => ({ ...f, currentAmount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </FormField>
          <FormField label="Color">
            <div className="flex gap-2 flex-wrap">
              {GOAL_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Create'} Goal</Button>
          </div>
        </div>
      </Modal>

      {/* Contribute Modal */}
      <Modal open={!!contributeId} onClose={() => setContributeId(null)} title="Add Funds to Goal">
        <div className="space-y-4">
          {contributeId && (() => {
            const g = goals.find(g => g.id === contributeId);
            return g ? <p className="text-sm text-muted">Adding funds to <span className="text-primary font-medium">{g.name}</span></p> : null;
          })()}
          <FormField label="Amount">
            <Input type="number" min="0" step="0.01" value={contributeAmount || ''} onChange={e => setContributeAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" autoFocus />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setContributeId(null)}>Cancel</Button>
            <Button onClick={handleContribute}>Add Funds</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteGoal(deleteId)}
        title="Delete Goal"
        message="Are you sure you want to delete this goal?"
      />
    </div>
  );
}
