import { useState, useMemo } from 'react';
import {
  ArrowLeft, Plus, Edit2, Trash2, IndianRupee,
  CheckCircle2, Clock, Banknote,
} from 'lucide-react';
import { useAppStore, useChitFunds, useChitInstallments } from '../stores/useAppStore';
import { ChitFund as ChitFundType, ChitInstallment, ChitStatus, InstallmentStatus } from '../types';
import {
  PageHeader, Button, Modal, FormField, Input, Select, Textarea,
  ConfirmDialog, EmptyState, StatCard, Badge, ProgressBar,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils';

const fmt = (n: number) => formatCurrency(n, 'INR');

const STATUS_BADGE: Record<InstallmentStatus, string> = {
  pending: 'blue',
  paid: 'green',
  partial: 'yellow',
  missed: 'red',
};

const CHIT_STATUS_BADGE: Record<ChitStatus, string> = {
  active: 'theme',
  completed: 'green',
  dropped: 'red',
};

type ChitForm = {
  name: string;
  total_amount: string;
  duration_months: string;
  organizer: string;
  start_date: string;
  end_date: string;
  status: ChitStatus;
  received_amount: string;
  received_month_no: string;
  notes: string;
};

type InstallForm = {
  month_no: string;
  due_date: string;
  amount: string;
  paid_amount: string;
  paid_date: string;
  payment_mode: string;
  status: InstallmentStatus;
  remark: string;
};

const defaultChitForm = (): ChitForm => ({
  name: '',
  total_amount: '',
  duration_months: '',
  organizer: '',
  start_date: '',
  end_date: '',
  status: 'active',
  received_amount: '',
  received_month_no: '',
  notes: '',
});

const defaultInstallForm = (): InstallForm => ({
  month_no: '',
  due_date: '',
  amount: '',
  paid_amount: '',
  paid_date: '',
  payment_mode: '',
  status: 'pending',
  remark: '',
});

export default function ChitFunds() {
  const {
    addChitFund, updateChitFund, deleteChitFund,
    addChitInstallment, updateChitInstallment, deleteChitInstallment,
  } = useAppStore();
  const chitFunds = useChitFunds();
  const chitInstallments = useChitInstallments();

  const [selectedChitId, setSelectedChitId] = useState<string | null>(null);

  // Chit fund modals
  const [chitModal, setChitModal] = useState(false);
  const [editChitId, setEditChitId] = useState<string | null>(null);
  const [deleteChitId, setDeleteChitId] = useState<string | null>(null);
  const [chitForm, setChitForm] = useState<ChitForm>(defaultChitForm());

  // Installment modals
  const [installModal, setInstallModal] = useState(false);
  const [editInstallId, setEditInstallId] = useState<string | null>(null);
  const [deleteInstallId, setDeleteInstallId] = useState<string | null>(null);
  const [payModalId, setPayModalId] = useState<string | null>(null);
  const [installForm, setInstallForm] = useState<InstallForm>(defaultInstallForm());
  const [payForm, setPayForm] = useState({ paid_amount: '', paid_date: '', payment_mode: '' });

  // ── Derived data ──────────────────────────────────────────────────

  const selectedChit = useMemo(
    () => chitFunds.find(c => c.id === selectedChitId) ?? null,
    [chitFunds, selectedChitId],
  );

  const selectedInstallments = useMemo(
    () => chitInstallments
      .filter(i => i.chit_id === selectedChitId)
      .sort((a, b) => a.month_no - b.month_no),
    [chitInstallments, selectedChitId],
  );

  const getChitInstalls = (chitId: string) =>
    chitInstallments.filter(i => i.chit_id === chitId);

  const getTotalPaid = (chitId: string) =>
    getChitInstalls(chitId).reduce((s, i) => s + (i.paid_amount ?? 0), 0);

  const getPaidMonths = (chitId: string) =>
    getChitInstalls(chitId).filter(i => i.status === 'paid').length;

  const getNextDue = (chitId: string) =>
    getChitInstalls(chitId)
      .filter(i => i.status === 'pending' || i.status === 'partial' || i.status === 'missed')
      .sort((a, b) => a.month_no - b.month_no)[0] ?? null;

  const listStats = useMemo(() => {
    const active = chitFunds.filter(c => c.status === 'active').length;
    const totalPaid = chitInstallments.reduce((s, i) => s + (i.paid_amount ?? 0), 0);
    const totalPending = chitInstallments
      .filter(i => i.status !== 'paid')
      .reduce((s, i) => s + (i.amount - (i.paid_amount ?? 0)), 0);
    const totalReceived = chitFunds.reduce((s, c) => s + (c.received_amount ?? 0), 0);
    return { active, totalPaid, totalPending, totalReceived };
  }, [chitFunds, chitInstallments]);

  const detailStats = useMemo(() => {
    const paid = selectedChitId ? getTotalPaid(selectedChitId) : 0;
    const pending = selectedInstallments
      .filter(i => i.status !== 'paid')
      .reduce((s, i) => s + (i.amount - (i.paid_amount ?? 0)), 0);
    const paidMonths = selectedInstallments.filter(i => i.status === 'paid').length;
    return { paid, pending, paidMonths };
  }, [selectedChitId, selectedInstallments]);

  // ── Chit fund handlers ────────────────────────────────────────────

  const openAddChit = () => {
    setChitForm(defaultChitForm());
    setEditChitId(null);
    setChitModal(true);
  };

  const openEditChit = (c: ChitFundType) => {
    setChitForm({
      name: c.name,
      total_amount: String(c.total_amount),
      duration_months: String(c.duration_months),
      organizer: c.organizer,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      received_amount: c.received_amount != null ? String(c.received_amount) : '',
      received_month_no: c.received_month_no != null ? String(c.received_month_no) : '',
      notes: c.notes,
    });
    setEditChitId(c.id);
    setChitModal(true);
  };

  const handleSaveChit = async () => {
    if (!chitForm.name || !chitForm.total_amount || !chitForm.duration_months || !chitForm.start_date) return;
    const data = {
      name: chitForm.name,
      total_amount: Number(chitForm.total_amount),
      duration_months: Number(chitForm.duration_months),
      organizer: chitForm.organizer,
      start_date: chitForm.start_date,
      end_date: chitForm.end_date,
      status: chitForm.status,
      received_amount: chitForm.received_amount ? Number(chitForm.received_amount) : null,
      received_month_no: chitForm.received_month_no ? Number(chitForm.received_month_no) : null,
      notes: chitForm.notes,
    };
    if (editChitId) await updateChitFund(editChitId, data);
    else await addChitFund(data);
    setChitModal(false);
  };

  const handleDeleteChit = async () => {
    if (!deleteChitId) return;
    await deleteChitFund(deleteChitId);
    if (selectedChitId === deleteChitId) setSelectedChitId(null);
    setDeleteChitId(null);
  };

  // ── Installment handlers ──────────────────────────────────────────

  const openAddInstall = () => {
    const next = selectedInstallments.length > 0
      ? Math.max(...selectedInstallments.map(i => i.month_no)) + 1
      : 1;
    setInstallForm({ ...defaultInstallForm(), month_no: String(next) });
    setEditInstallId(null);
    setInstallModal(true);
  };

  const openEditInstall = (i: ChitInstallment) => {
    setInstallForm({
      month_no: String(i.month_no),
      due_date: i.due_date,
      amount: String(i.amount),
      paid_amount: i.paid_amount != null ? String(i.paid_amount) : '',
      paid_date: i.paid_date,
      payment_mode: i.payment_mode,
      status: i.status,
      remark: i.remark,
    });
    setEditInstallId(i.id);
    setInstallModal(true);
  };

  const handleSaveInstall = async () => {
    if (!installForm.month_no || !installForm.due_date || !installForm.amount || !selectedChitId) return;
    const data = {
      chit_id: selectedChitId,
      month_no: Number(installForm.month_no),
      due_date: installForm.due_date,
      amount: Number(installForm.amount),
      paid_amount: installForm.paid_amount ? Number(installForm.paid_amount) : null,
      paid_date: installForm.paid_date,
      payment_mode: installForm.payment_mode,
      status: installForm.status,
      remark: installForm.remark,
    };
    if (editInstallId) await updateChitInstallment(editInstallId, data);
    else await addChitInstallment(data);
    setInstallModal(false);
  };

  const openPay = (inst: ChitInstallment) => {
    const remaining = inst.amount - (inst.paid_amount ?? 0);
    setPayForm({
      paid_amount: String(remaining > 0 ? remaining : inst.amount),
      paid_date: new Date().toISOString().split('T')[0],
      payment_mode: inst.payment_mode || '',
    });
    setPayModalId(inst.id);
  };

  const handlePay = async () => {
    if (!payModalId || !payForm.paid_amount) return;
    const inst = chitInstallments.find(i => i.id === payModalId);
    if (!inst) return;
    const paid = Number(payForm.paid_amount);
    const status: InstallmentStatus = paid >= inst.amount ? 'paid' : paid > 0 ? 'partial' : 'pending';
    await updateChitInstallment(payModalId, {
      paid_amount: paid,
      paid_date: payForm.paid_date,
      payment_mode: payForm.payment_mode,
      status,
    });
    setPayModalId(null);
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {!selectedChitId && (
        <>
          <PageHeader
            title="Chit Funds"
            subtitle={`${chitFunds.length} chit fund${chitFunds.length !== 1 ? 's' : ''}`}
            action={<Button onClick={openAddChit}><Plus size={16} /> New Chit</Button>}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active Chits" value={String(listStats.active)} icon={<IndianRupee size={18} />} color="theme" />
            <StatCard title="Total Paid" value={fmt(listStats.totalPaid)} icon={<CheckCircle2 size={18} />} color="green" />
            <StatCard title="Total Pending" value={fmt(listStats.totalPending)} icon={<Clock size={18} />} color="yellow" />
            <StatCard
              title="Pot Received"
              value={listStats.totalReceived > 0 ? fmt(listStats.totalReceived) : '—'}
              sub="Lump sum collected from your chit turn"
              icon={<Banknote size={18} />}
              color="blue"
            />
          </div>

          {chitFunds.length === 0 ? (
            <EmptyState
              icon={<IndianRupee size={40} />}
              title="No chit funds yet"
              description="Add your village or office chit fund to track monthly payments."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {chitFunds.map(chit => {
                const paid = getTotalPaid(chit.id);
                const paidMonths = getPaidMonths(chit.id);
                const nextDue = getNextDue(chit.id);
                const progress = chit.duration_months > 0 ? (paidMonths / chit.duration_months) * 100 : 0;

                return (
                  <div key={chit.id} className="card group flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-primary text-sm">{chit.name}</h3>
                          <Badge color={CHIT_STATUS_BADGE[chit.status]}>{chit.status}</Badge>
                        </div>
                        {chit.organizer && (
                          <p className="text-xs text-muted mt-0.5">{chit.organizer}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEditChit(chit)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                        <button onClick={() => setDeleteChitId(chit.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted">Total</p>
                        <p className="text-primary font-semibold">{fmt(chit.total_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted">Duration</p>
                        <p className="text-primary font-semibold">{chit.duration_months} months</p>
                      </div>
                    </div>

                    <div>
                      <ProgressBar value={progress} showLabel={false} />
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted">{paidMonths}/{chit.duration_months} months paid</span>
                        <span className="text-primary font-medium">{fmt(paid)}</span>
                      </div>
                    </div>

                    {nextDue ? (
                      <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-muted">Next Due · Month {nextDue.month_no}</span>
                        <span className="text-primary font-semibold">{fmt(nextDue.amount)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-muted">All installments paid</span>
                        <CheckCircle2 size={12} className="text-green-400" />
                      </div>
                    )}

                    {chit.received_amount != null && (
                      <div className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle2 size={12} />
                        <span>Pot received · {fmt(chit.received_amount)}</span>
                      </div>
                    )}

                    <Button
                      variant="secondary"
                      className="w-full text-xs py-1.5 mt-auto"
                      onClick={() => setSelectedChitId(chit.id)}
                    >
                      View Installments →
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── DETAIL VIEW ───────────────────────────────────────────── */}
      {selectedChitId && selectedChit && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedChitId(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-primary transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-primary tracking-tight">{selectedChit.name}</h1>
                  <Badge color={CHIT_STATUS_BADGE[selectedChit.status]}>{selectedChit.status}</Badge>
                </div>
                {selectedChit.organizer && (
                  <p className="text-sm text-muted mt-0.5">{selectedChit.organizer}</p>
                )}
              </div>
            </div>
            <Button onClick={openAddInstall}><Plus size={16} /> Add Month</Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Amount" value={fmt(selectedChit.total_amount)} icon={<IndianRupee size={18} />} color="theme" />
            <StatCard title="Total Paid" value={fmt(detailStats.paid)} icon={<CheckCircle2 size={18} />} color="green" />
            <StatCard title="Remaining" value={fmt(detailStats.pending)} icon={<Clock size={18} />} color="yellow" />
            {selectedChit.received_amount != null ? (
              <StatCard title="Pot Received" value={fmt(selectedChit.received_amount)} sub="Lump sum collected from your chit turn" icon={<Banknote size={18} />} color="blue" />
            ) : (
              <StatCard
                title="Months Done"
                value={`${detailStats.paidMonths} / ${selectedChit.duration_months}`}
                icon={<Banknote size={18} />}
                color="blue"
              />
            )}
          </div>

          {selectedInstallments.length === 0 ? (
            <EmptyState
              icon={<IndianRupee size={40} />}
              title="No installments yet"
              description="Click 'Add Month' to record your monthly chit payments."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Month</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Due Date</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3">Amount</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3">Paid</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Paid On</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden lg:table-cell">Mode</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Status</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden xl:table-cell">Remark</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInstallments.map((inst, idx) => (
                      <tr
                        key={inst.id}
                        className={`border-b border-card-border last:border-0 hover:bg-white/[0.03] transition-colors ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                      >
                        <td className="px-4 py-3 text-primary font-semibold text-xs">#{inst.month_no}</td>
                        <td className="px-4 py-3 text-muted text-xs">{formatDate(inst.due_date)}</td>
                        <td className="px-4 py-3 text-right text-primary text-xs font-medium">{fmt(inst.amount)}</td>
                        <td className="px-4 py-3 text-right text-xs">
                          {inst.paid_amount != null
                            ? <span className="text-green-400 font-medium">{fmt(inst.paid_amount)}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">
                          {inst.paid_date ? formatDate(inst.paid_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs hidden lg:table-cell">
                          {inst.payment_mode
                            ? <span className="capitalize text-muted">{inst.payment_mode}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={STATUS_BADGE[inst.status]}>{inst.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs hidden xl:table-cell max-w-[120px] truncate">
                          {inst.remark || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {(inst.status === 'pending' || inst.status === 'partial' || inst.status === 'missed') && (
                              <button
                                onClick={() => openPay(inst)}
                                className="px-2 py-1 text-xs rounded-md bg-[#A6445D]/15 text-[#A6445D] hover:bg-[#A6445D]/25 transition-colors font-medium"
                              >
                                Pay
                              </button>
                            )}
                            <button onClick={() => openEditInstall(inst)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                            <button onClick={() => setDeleteInstallId(inst.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-card-border bg-white/[0.02]">
                      <td colSpan={2} className="px-4 py-3 text-xs text-muted font-medium">Total</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-primary">
                        {fmt(selectedInstallments.reduce((s, i) => s + i.amount, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-green-400">
                        {fmt(selectedInstallments.reduce((s, i) => s + (i.paid_amount ?? 0), 0))}
                      </td>
                      <td colSpan={5} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────────────── */}

      {/* Chit Fund Modal */}
      <Modal open={chitModal} onClose={() => setChitModal(false)} title={editChitId ? 'Edit Chit Fund' : 'New Chit Fund'}>
        <div className="space-y-4">
          <FormField label="Chit Name">
            <Input
              value={chitForm.name}
              onChange={e => setChitForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Village Chit 3L"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Total Amount (₹)">
              <Input
                type="number"
                min="0"
                value={chitForm.total_amount}
                onChange={e => setChitForm(f => ({ ...f, total_amount: e.target.value }))}
                placeholder="300000"
              />
            </FormField>
            <FormField label="Duration (months)">
              <Input
                type="number"
                min="1"
                value={chitForm.duration_months}
                onChange={e => setChitForm(f => ({ ...f, duration_months: e.target.value }))}
                placeholder="20"
              />
            </FormField>
          </div>
          <FormField label="Organizer">
            <Input
              value={chitForm.organizer}
              onChange={e => setChitForm(f => ({ ...f, organizer: e.target.value }))}
              placeholder="e.g. Murugan Chit Fund"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date">
              <Input
                type="date"
                value={chitForm.start_date}
                onChange={e => setChitForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                value={chitForm.end_date}
                onChange={e => setChitForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Status">
            <Select
              value={chitForm.status}
              onChange={e => setChitForm(f => ({ ...f, status: e.target.value as ChitStatus }))}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Pot Received (₹)">
              <Input
                type="number"
                min="0"
                value={chitForm.received_amount}
                onChange={e => setChitForm(f => ({ ...f, received_amount: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Pot Month No.">
              <Input
                type="number"
                min="1"
                value={chitForm.received_month_no}
                onChange={e => setChitForm(f => ({ ...f, received_month_no: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea
              value={chitForm.notes}
              onChange={e => setChitForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setChitModal(false)}>Cancel</Button>
            <Button onClick={handleSaveChit}>{editChitId ? 'Update' : 'Create'} Chit</Button>
          </div>
        </div>
      </Modal>

      {/* Installment Modal */}
      <Modal open={installModal} onClose={() => setInstallModal(false)} title={editInstallId ? 'Edit Installment' : 'Add Installment'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Month No.">
              <Input
                type="number"
                min="1"
                value={installForm.month_no}
                onChange={e => setInstallForm(f => ({ ...f, month_no: e.target.value }))}
                placeholder="1"
              />
            </FormField>
            <FormField label="Due Date">
              <Input
                type="date"
                value={installForm.due_date}
                onChange={e => setInstallForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Amount Due (₹)">
            <Input
              type="number"
              min="0"
              value={installForm.amount}
              onChange={e => setInstallForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 15000"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Paid Amount (₹)">
              <Input
                type="number"
                min="0"
                value={installForm.paid_amount}
                onChange={e => setInstallForm(f => ({ ...f, paid_amount: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Paid Date">
              <Input
                type="date"
                value={installForm.paid_date}
                onChange={e => setInstallForm(f => ({ ...f, paid_date: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Payment Mode">
              <Select
                value={installForm.payment_mode}
                onChange={e => setInstallForm(f => ({ ...f, payment_mode: e.target.value }))}
              >
                <option value="">Select...</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
              </Select>
            </FormField>
            <FormField label="Status">
              <Select
                value={installForm.status}
                onChange={e => setInstallForm(f => ({ ...f, status: e.target.value as InstallmentStatus }))}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="missed">Missed</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Remark">
            <Input
              value={installForm.remark}
              onChange={e => setInstallForm(f => ({ ...f, remark: e.target.value }))}
              placeholder="Optional note..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setInstallModal(false)}>Cancel</Button>
            <Button onClick={handleSaveInstall}>{editInstallId ? 'Update' : 'Add'} Installment</Button>
          </div>
        </div>
      </Modal>

      {/* Quick Pay Modal */}
      <Modal open={!!payModalId} onClose={() => setPayModalId(null)} title="Record Payment">
        <div className="space-y-4">
          {payModalId && (() => {
            const inst = chitInstallments.find(i => i.id === payModalId);
            return inst ? (
              <p className="text-sm text-muted">
                Month <span className="text-primary font-medium">#{inst.month_no}</span>
                {' · '}Due: <span className="text-primary font-medium">{fmt(inst.amount)}</span>
              </p>
            ) : null;
          })()}
          <FormField label="Paid Amount (₹)">
            <Input
              type="number"
              min="0"
              value={payForm.paid_amount}
              onChange={e => setPayForm(f => ({ ...f, paid_amount: e.target.value }))}
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Paid Date">
              <Input
                type="date"
                value={payForm.paid_date}
                onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))}
              />
            </FormField>
            <FormField label="Payment Mode">
              <Select
                value={payForm.payment_mode}
                onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}
              >
                <option value="">Select...</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI</option>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPayModalId(null)}>Cancel</Button>
            <Button onClick={handlePay}>Record Payment</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Chit Fund */}
      <ConfirmDialog
        open={!!deleteChitId}
        onClose={() => setDeleteChitId(null)}
        onConfirm={handleDeleteChit}
        title="Delete Chit Fund"
        message="This will delete the chit fund and all its installments. Are you sure?"
      />

      {/* Delete Installment */}
      <ConfirmDialog
        open={!!deleteInstallId}
        onClose={() => setDeleteInstallId(null)}
        onConfirm={async () => {
          if (deleteInstallId) {
            await deleteChitInstallment(deleteInstallId);
            setDeleteInstallId(null);
          }
        }}
        title="Delete Installment"
        message="Are you sure you want to delete this installment?"
      />
    </div>
  );
}
