import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Scale, CheckCircle2, CreditCard, HandCoins } from 'lucide-react';
import { useAppStore, useLiabilities, useLiabilityTransactions, useSettings } from '../stores/useAppStore';
import { Liability, LiabilityTransaction, LiabilityType, LiabilityStatus, LiabilityTxnType, Currency } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, EmptyState, StatCard, Badge } from '../components/ui';
import {
  formatDate, formatCurrency, computeLiabilityStats, computePortfolioLiabilityStats, groupByLiabilityId,
  LIABILITY_TYPES, LIABILITY_TYPE_BADGE,
} from '../utils';

const STATUS_BADGE: Record<LiabilityStatus, string> = { active: 'theme', closed: 'green' };
const TXN_TYPE_BADGE: Record<LiabilityTxnType, string> = { Charge: 'red', Payment: 'green' };

type LiabilityForm = {
  type: LiabilityType;
  name: string;
  currency: Currency;
  balance: string;
  status: LiabilityStatus;
  notes: string;
};

type TxnForm = {
  type: LiabilityTxnType;
  date: string;
  amount: string;
  interestAmount: string;
  currency: Currency;
  notes: string;
};

const defaultLiabilityForm = (): LiabilityForm => ({
  type: 'Loan',
  name: '',
  currency: 'AED',
  balance: '',
  status: 'active',
  notes: '',
});

const defaultTxnForm = (currency: Currency = 'AED'): TxnForm => ({
  type: 'Payment',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  interestAmount: '',
  currency,
  notes: '',
});

export default function Liabilities() {
  const {
    addLiability, updateLiability, deleteLiability,
    addLiabilityTransaction, updateLiabilityTransaction, deleteLiabilityTransaction,
  } = useAppStore();
  const liabilities = useLiabilities();
  const transactions = useLiabilityTransactions();
  const { aedToInrRate } = useSettings();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Liability modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payOffId, setPayOffId] = useState<string | null>(null);
  const [form, setForm] = useState<LiabilityForm>(defaultLiabilityForm());

  // Transaction modals
  const [txnModal, setTxnModal] = useState(false);
  const [editTxnId, setEditTxnId] = useState<string | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
  const [txnForm, setTxnForm] = useState<TxnForm>(defaultTxnForm());

  // ── Derived data ──────────────────────────────────────────────────

  const selectedLiability = useMemo(
    () => liabilities.find(l => l.id === selectedId) ?? null,
    [liabilities, selectedId],
  );

  const selectedTransactions = useMemo(
    () => transactions
      .filter(t => t.liability_id === selectedId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, selectedId],
  );

  const portfolioStats = useMemo(
    () => computePortfolioLiabilityStats(liabilities, transactions, aedToInrRate),
    [liabilities, transactions, aedToInrRate],
  );

  const txnsByLiabilityId = useMemo(() => groupByLiabilityId(transactions), [transactions]);

  const statsFor = (l: Liability) => computeLiabilityStats(l, txnsByLiabilityId.get(l.id) ?? [], aedToInrRate);

  const detailStats = selectedLiability ? statsFor(selectedLiability) : null;

  // ── Liability handlers ────────────────────────────────────────────

  const openAdd = () => { setForm(defaultLiabilityForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (l: Liability) => {
    setForm({ type: l.type, name: l.name, currency: l.currency, balance: String(l.balance), status: l.status, notes: l.notes });
    setEditId(l.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const data = {
      type: form.type,
      name: form.name,
      currency: form.currency,
      balance: Number(form.balance) || 0,
      status: form.status,
      notes: form.notes,
    };
    if (editId) await updateLiability(editId, data);
    else await addLiability(data);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteLiability(deleteId);
    if (selectedId === deleteId) setSelectedId(null);
    setDeleteId(null);
  };

  const payOffLiability = useMemo(() => liabilities.find(l => l.id === payOffId) ?? null, [liabilities, payOffId]);
  const payOffRemaining = payOffLiability
    ? (payOffLiability.currency === 'AED' ? statsFor(payOffLiability).outstandingAed : statsFor(payOffLiability).outstandingInr)
    : 0;

  // Marking a liability "paid off" must also zero out its actual balance —
  // otherwise the badge says closed while Outstanding/Net Worth still count
  // the full debt. If anything's still owed, record it as a real Payment
  // (principal only — we don't know an interest breakdown for "whatever's
  // left") so the ledger and the status stay consistent.
  const handleMarkPaidOff = async () => {
    if (!payOffLiability) return;
    if (payOffRemaining > 0.01) {
      await addLiabilityTransaction({
        liability_id: payOffLiability.id,
        type: 'Payment',
        date: new Date().toISOString().split('T')[0],
        amount: payOffRemaining,
        interestAmount: null,
        currency: payOffLiability.currency,
        notes: 'Final payment — auto-recorded when marked as paid off',
      });
    }
    await updateLiability(payOffLiability.id, { status: 'closed' });
    setPayOffId(null);
  };

  // ── Transaction handlers ──────────────────────────────────────────

  const openAddTxn = () => { setTxnForm(defaultTxnForm(selectedLiability?.currency)); setEditTxnId(null); setTxnModal(true); };
  const openEditTxn = (t: LiabilityTransaction) => {
    setTxnForm({
      type: t.type,
      date: t.date,
      amount: String(t.amount),
      interestAmount: t.interestAmount != null ? String(t.interestAmount) : '',
      currency: t.currency,
      notes: t.notes,
    });
    setEditTxnId(t.id);
    setTxnModal(true);
  };

  const handleSaveTxn = async () => {
    if (!selectedId || !txnForm.date) return;
    const amount = Number(txnForm.amount) || 0;
    if (!amount) return;
    const interestAmount = txnForm.type === 'Payment' && txnForm.interestAmount
      ? Math.min(Number(txnForm.interestAmount) || 0, amount)
      : null;
    const data = {
      liability_id: selectedId,
      type: txnForm.type,
      date: txnForm.date,
      amount,
      interestAmount,
      currency: txnForm.currency,
      notes: txnForm.notes,
    };
    if (editTxnId) await updateLiabilityTransaction(editTxnId, data);
    else await addLiabilityTransaction(data);
    setTxnModal(false);
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {!selectedId && (
        <>
          <PageHeader
            title="Liabilities"
            subtitle={`${liabilities.length} liabilit${liabilities.length !== 1 ? 'ies' : 'y'} — subtracted from Net Worth`}
            action={<Button onClick={openAdd}><Plus size={16} /> Add Liability</Button>}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Outstanding"
              value={formatCurrency(portfolioStats.outstandingInr, 'INR')}
              sub={`≈ AED ${portfolioStats.outstandingAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
              icon={<Scale size={16} />}
              color="red"
            />
            <StatCard
              title="Total Charged"
              value={formatCurrency(portfolioStats.chargesInr, 'INR')}
              sub={`≈ AED ${portfolioStats.chargesAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
              icon={<CreditCard size={16} />}
              color="orange"
            />
            <StatCard
              title="Principal Paid"
              value={formatCurrency(portfolioStats.principalPaidInr, 'INR')}
              sub={`≈ AED ${portfolioStats.principalPaidAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
              icon={<HandCoins size={16} />}
              color="green"
            />
            <StatCard
              title="Interest Paid"
              value={formatCurrency(portfolioStats.interestPaidInr, 'INR')}
              sub={`≈ AED ${portfolioStats.interestPaidAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`}
              icon={<Scale size={16} />}
              color="amber"
            />
          </div>

          {liabilities.length === 0 ? (
            <EmptyState icon={<Scale size={40} />} title="No liabilities tracked" description="Add a loan, credit card, or other debt to see a true Net Worth." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {liabilities.map(l => {
                const s = statsFor(l);
                return (
                  <div key={l.id} className="card group flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-primary text-sm break-words">{l.name}</h3>
                          {l.status === 'closed' && <Badge color={STATUS_BADGE.closed}>paid off</Badge>}
                        </div>
                        <p className="text-xs mt-0.5">
                          <Badge color={LIABILITY_TYPE_BADGE[l.type] ?? 'theme'}>{l.type}</Badge>
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEdit(l)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                        <button onClick={() => setDeleteId(l.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted">Outstanding Balance</p>
                      <p className="text-lg font-bold text-red-400">{formatCurrency(l.currency === 'AED' ? s.outstandingAed : s.outstandingInr, l.currency)}</p>
                    </div>

                    <Button
                      variant="secondary"
                      className="w-full text-xs py-1.5 mt-auto"
                      onClick={() => setSelectedId(l.id)}
                    >
                      View Transactions →
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── DETAIL VIEW ───────────────────────────────────────────── */}
      {selectedId && selectedLiability && detailStats && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedId(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-primary transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-primary tracking-tight break-words">{selectedLiability.name}</h1>
                  <Badge color={LIABILITY_TYPE_BADGE[selectedLiability.type] ?? 'theme'}>{selectedLiability.type}</Badge>
                  {selectedLiability.status === 'closed' && <Badge color={STATUS_BADGE.closed}>paid off</Badge>}
                </div>
                <p className="text-sm text-muted mt-0.5">
                  Opening balance {formatCurrency(selectedLiability.balance, selectedLiability.currency)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedLiability.status === 'active' && (
                <Button variant="secondary" onClick={() => setPayOffId(selectedLiability.id)}>
                  <CheckCircle2 size={16} /> Mark as Paid Off
                </Button>
              )}
              <Button onClick={openAddTxn}><Plus size={16} /> Add Transaction</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Outstanding"
              value={formatCurrency(selectedLiability.currency === 'AED' ? detailStats.outstandingAed : detailStats.outstandingInr, selectedLiability.currency)}
              icon={<Scale size={18} />}
              color="red"
            />
            <StatCard
              title="Charged"
              value={formatCurrency(selectedLiability.currency === 'AED' ? detailStats.chargesAed : detailStats.chargesInr, selectedLiability.currency)}
              icon={<CreditCard size={18} />}
              color="orange"
            />
            <StatCard
              title="Principal Paid"
              value={formatCurrency(selectedLiability.currency === 'AED' ? detailStats.principalPaidAed : detailStats.principalPaidInr, selectedLiability.currency)}
              icon={<HandCoins size={18} />}
              color="green"
            />
            <StatCard
              title="Interest Paid"
              value={formatCurrency(selectedLiability.currency === 'AED' ? detailStats.interestPaidAed : detailStats.interestPaidInr, selectedLiability.currency)}
              icon={<Scale size={18} />}
              color="amber"
            />
          </div>

          {selectedTransactions.length === 0 ? (
            <EmptyState
              icon={<Scale size={40} />}
              title="No transactions yet"
              description="Record a Charge (new debt) or Payment (cash paid toward this debt) to start the ledger."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Date</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Type</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3">Amount</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Interest</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden lg:table-cell">Notes</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransactions.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`border-b border-card-border last:border-0 hover:bg-white/[0.03] transition-colors group ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                      >
                        <td className="px-4 py-3 text-muted text-xs">{formatDate(t.date)}</td>
                        <td className="px-4 py-3"><Badge color={TXN_TYPE_BADGE[t.type]}>{t.type}</Badge></td>
                        <td className={`px-4 py-3 text-right text-xs font-semibold ${t.type === 'Payment' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.currency} {t.amount.toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-primary hidden md:table-cell">{t.interestAmount ? `${t.currency} ${t.interestAmount.toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3 text-muted text-xs hidden lg:table-cell max-w-[160px] truncate">{t.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditTxn(t)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                            <button onClick={() => setDeleteTxnId(t.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────────────── */}

      {/* Liability Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Liability' : 'Add Liability'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type">
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LiabilityType }))}>
                {LIABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Name">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Car Loan, HDFC Credit Card" />
          </FormField>
          <FormField label={editId ? 'Opening Balance' : 'Current Balance (as of today)'}>
            <Input type="number" min="0" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" />
          </FormField>
          {editId && (
            <p className="text-xs text-muted -mt-2">
              This is the anchor point — the actual amount you owe is this plus every Charge, minus every Payment's principal, logged in the transaction ledger.
            </p>
          )}
          <FormField label="Status">
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LiabilityStatus }))}>
              <option value="active">Active</option>
              <option value="closed">Paid Off / Closed</option>
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Lender, due date, interest rate..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add'} Liability</Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal open={txnModal} onClose={() => setTxnModal(false)} title={editTxnId ? 'Edit Transaction' : 'Add Transaction'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type">
              <Select value={txnForm.type} onChange={e => setTxnForm(f => ({ ...f, type: e.target.value as LiabilityTxnType }))}>
                <option value="Charge">Charge (new debt)</option>
                <option value="Payment">Payment (cash paid)</option>
              </Select>
            </FormField>
            <FormField label="Date">
              <Input type="date" value={txnForm.date} onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Amount">
              <Input type="number" min="0" step="0.01" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label="Currency">
              <Select value={txnForm.currency} onChange={e => setTxnForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </Select>
            </FormField>
          </div>
          {txnForm.type === 'Payment' && (
            <FormField label="Of which, interest (optional)">
              <Input type="number" min="0" step="0.01" value={txnForm.interestAmount} onChange={e => setTxnForm(f => ({ ...f, interestAmount: e.target.value }))} placeholder="0.00" />
            </FormField>
          )}
          {txnForm.type === 'Payment' && (
            <p className="text-xs text-muted -mt-2">
              Only the amount minus interest reduces what you owe — interest is a real cost, tracked but not principal.
            </p>
          )}
          <FormField label="Notes">
            <Input value={txnForm.notes} onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setTxnModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTxn}>{editTxnId ? 'Update' : 'Add'} Transaction</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Liability */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Liability"
        message="This will delete the liability and all its transactions. Are you sure?"
      />

      {/* Delete Transaction */}
      <ConfirmDialog
        open={!!deleteTxnId}
        onClose={() => setDeleteTxnId(null)}
        onConfirm={async () => {
          if (deleteTxnId) {
            await deleteLiabilityTransaction(deleteTxnId);
            setDeleteTxnId(null);
          }
        }}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction?"
      />

      {/* Mark as Paid Off */}
      <ConfirmDialog
        open={!!payOffId}
        onClose={() => setPayOffId(null)}
        onConfirm={handleMarkPaidOff}
        title="Mark as Paid Off"
        message={
          payOffRemaining > 0.01
            ? `This will record a final Payment of ${payOffLiability?.currency} ${payOffRemaining.toLocaleString('en-AE', { maximumFractionDigits: 2 })} to bring the balance to zero, then mark this liability as closed. Continue?`
            : 'This will mark the liability as closed. Continue?'
        }
        confirmLabel="Mark as Paid Off"
        confirmVariant="primary"
      />
    </div>
  );
}
