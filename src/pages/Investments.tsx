import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Plus, Edit2, Trash2, LineChart, Wallet,
  TrendingUp, TrendingDown, Coins, PiggyBank, RefreshCw, X,
} from 'lucide-react';
import { useAppStore, useInvestments, useInvestmentTransactions, useSettings } from '../stores/useAppStore';
import { Investment, InvestmentTransaction, InvestmentType, InvestmentStatus, InvestmentTxnType, Currency } from '../types';
import {
  PageHeader, Button, Modal, FormField, Input, Select, Textarea,
  ConfirmDialog, EmptyState, StatCard, Badge,
} from '../components/ui';
import {
  formatDate, formatCurrency, convertToAED, computeInvestmentStats, computePortfolioStats, groupByInvestmentId,
  INVESTMENT_TYPES, INVESTMENT_TYPE_BADGE,
} from '../utils';
import { searchMfSchemes, fetchLatestNav, MfSchemeSearchResult } from '../utils/mfNav';
import { useIsDubai } from '../hooks';

const STATUS_BADGE: Record<InvestmentStatus, string> = { active: 'theme', closed: 'red' };
const TXN_TYPE_BADGE: Record<InvestmentTxnType, string> = { Buy: 'green', SIP: 'blue', Sell: 'red', Dividend: 'amber' };

// Mutual Funds/Stocks/ETFs move in units/NAV; FDs/PPF/NPS are just cash in and out.
const isUnitBased = (type: InvestmentType) => type === 'Mutual Fund' || type === 'Stock' || type === 'ETF';
const isFixedIncome = (type: InvestmentType) => type === 'Fixed Deposit' || type === 'PPF' || type === 'NPS';

type InvestmentForm = {
  type: InvestmentType;
  name: string;
  currency: Currency;
  currentValue: string;
  maturityDate: string;
  interestRate: string;
  schemeCode: number | null;
  sipEnabled: boolean;
  sipAmount: string;
  sipDay: string;
  status: InvestmentStatus;
  notes: string;
};

type TxnForm = {
  type: InvestmentTxnType;
  date: string;
  units: string;
  pricePerUnit: string;
  amount: string;
  currency: Currency;
  notes: string;
};

const defaultInvestmentForm = (currency: Currency): InvestmentForm => ({
  type: 'Mutual Fund',
  name: '',
  currency,
  currentValue: '',
  maturityDate: '',
  interestRate: '',
  schemeCode: null,
  sipEnabled: false,
  sipAmount: '',
  sipDay: '',
  status: 'active',
  notes: '',
});

const defaultTxnForm = (currency: Currency): TxnForm => ({
  type: 'Buy',
  date: new Date().toISOString().split('T')[0],
  units: '',
  pricePerUnit: '',
  amount: '',
  currency,
  notes: '',
});

export default function Investments() {
  const {
    addInvestment, updateInvestment, deleteInvestment,
    addInvestmentTransaction, updateInvestmentTransaction, deleteInvestmentTransaction,
    pushToast,
  } = useAppStore();
  const investments = useInvestments();
  const transactions = useInvestmentTransactions();
  const { aedToInrRate } = useSettings();
  const isDubai = useIsDubai();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Investment modals
  const [invModal, setInvModal] = useState(false);
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [deleteInvId, setDeleteInvId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState<InvestmentForm>(defaultInvestmentForm(isDubai ? 'AED' : 'INR'));

  // AMFI scheme search (for linking a Mutual Fund to live NAV refresh)
  const [schemeQuery, setSchemeQuery] = useState('');
  const [schemeResults, setSchemeResults] = useState<MfSchemeSearchResult[]>([]);

  // Live NAV refresh
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Current-value quick-update modal
  const [valueModalId, setValueModalId] = useState<string | null>(null);
  const [valueForm, setValueForm] = useState('');

  // Transaction modals
  const [txnModal, setTxnModal] = useState(false);
  const [editTxnId, setEditTxnId] = useState<string | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
  const [txnForm, setTxnForm] = useState<TxnForm>(defaultTxnForm(isDubai ? 'AED' : 'INR'));

  // ── Derived data ──────────────────────────────────────────────────

  const selectedInvestment = useMemo(
    () => investments.find(i => i.id === selectedId) ?? null,
    [investments, selectedId],
  );

  const selectedTransactions = useMemo(
    () => transactions
      .filter(t => t.investment_id === selectedId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, selectedId],
  );

  const portfolioStats = useMemo(
    () => computePortfolioStats(investments, transactions, aedToInrRate),
    [investments, transactions, aedToInrRate],
  );

  // Grouped once per transactions change instead of `.filter()`-ing the full
  // array for every investment on every render (O(n×m) → O(n+m)).
  const txnsByInvestmentId = useMemo(() => groupByInvestmentId(transactions), [transactions]);

  const statsFor = (inv: Investment) =>
    computeInvestmentStats(inv, txnsByInvestmentId.get(inv.id) ?? [], aedToInrRate);

  const detailStats = selectedInvestment ? statsFor(selectedInvestment) : null;

  // Debounced AMFI scheme search as the user types in the "link a fund" field.
  useEffect(() => {
    if (schemeQuery.trim().length < 3) return;
    const t = setTimeout(async () => {
      const results = await searchMfSchemes(schemeQuery);
      setSchemeResults(results.slice(0, 8));
    }, 400);
    return () => clearTimeout(t);
  }, [schemeQuery]);

  // ── Investment handlers ───────────────────────────────────────────

  const openAddInvestment = () => {
    setInvForm(defaultInvestmentForm(isDubai ? 'AED' : 'INR'));
    setEditInvId(null);
    setSchemeQuery('');
    setSchemeResults([]);
    setInvModal(true);
  };

  const openEditInvestment = (inv: Investment) => {
    setInvForm({
      type: inv.type,
      name: inv.name,
      currency: inv.currency,
      currentValue: String(inv.currentValue),
      maturityDate: inv.maturityDate ?? '',
      interestRate: inv.interestRate != null ? String(inv.interestRate) : '',
      schemeCode: inv.schemeCode ?? null,
      sipEnabled: inv.sipEnabled,
      sipAmount: inv.sipAmount != null ? String(inv.sipAmount) : '',
      sipDay: inv.sipDay != null ? String(inv.sipDay) : '',
      status: inv.status,
      notes: inv.notes,
    });
    setEditInvId(inv.id);
    setSchemeQuery('');
    setSchemeResults([]);
    setInvModal(true);
  };

  const handleSaveInvestment = async () => {
    if (!invForm.name) return;
    const sipEnabled = invForm.type === 'Mutual Fund' && invForm.sipEnabled;
    if (sipEnabled && (!invForm.sipAmount || !invForm.sipDay)) return;
    const data = {
      type: invForm.type,
      name: invForm.name,
      currency: invForm.currency,
      currentValue: Number(invForm.currentValue) || 0,
      maturityDate: invForm.maturityDate || null,
      interestRate: invForm.interestRate ? Number(invForm.interestRate) : null,
      schemeCode: invForm.type === 'Mutual Fund' ? invForm.schemeCode : null,
      sipEnabled,
      sipAmount: sipEnabled ? Number(invForm.sipAmount) || 0 : null,
      sipDay: sipEnabled ? Number(invForm.sipDay) || 1 : null,
      status: invForm.status,
      notes: invForm.notes,
    };
    // sipLastRunDate is server-maintained (the cron job stamps it) — only
    // initialize it on create; an update must never clobber the cron's history.
    if (editInvId) await updateInvestment(editInvId, data);
    else await addInvestment({ ...data, sipLastRunDate: null });
    setInvModal(false);
  };

  // ── Live NAV refresh ──────────────────────────────────────────────
  // mfapi.in wraps the official AMFI daily NAV data as free, CORS-open JSON
  // (see docs/ARCHITECTURE.md §7.10) — no live feed exists for Stock/ETF/
  // FD/PPF/NPS, so this only ever applies to Mutual Fund holdings that have
  // been explicitly linked to a scheme code.
  // Updates the store silently — refreshing NAVs is a background sync, not a
  // form submit, so a single item's success/failure isn't worth its own toast.
  // Callers below report one consolidated toast for the whole refresh instead.
  const refreshNav = async (inv: Investment) => {
    if (!inv.schemeCode) return false;
    setRefreshingId(inv.id);
    try {
      const latest = await fetchLatestNav(inv.schemeCode);
      const totalUnits = statsFor(inv).totalUnits;
      if (latest && totalUnits > 0) {
        const valueInr = totalUnits * latest.nav;
        const currentValue = inv.currency === 'INR' ? valueInr : convertToAED(valueInr, 'INR', aedToInrRate);
        await updateInvestment(inv.id, { currentValue }, { silent: true });
        return true;
      }
      return false;
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshNavWithToast = async (inv: Investment) => {
    const ok = await refreshNav(inv);
    pushToast(ok ? 'NAV updated' : 'No live price available for this fund', ok ? 'success' : 'error');
  };

  const linkedMfInvestments = investments.filter(i => i.type === 'Mutual Fund' && i.schemeCode);

  const refreshAllNavs = async () => {
    setRefreshingAll(true);
    try {
      const results = await Promise.all(linkedMfInvestments.map(inv => refreshNav(inv)));
      const updated = results.filter(Boolean).length;
      if (updated === results.length) pushToast(`Refreshed ${updated} NAV${updated === 1 ? '' : 's'}`, 'success');
      else if (updated === 0) pushToast('Could not refresh any NAVs', 'error');
      else pushToast(`Refreshed ${updated} of ${results.length} NAVs`, 'success');
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleDeleteInvestment = async () => {
    if (!deleteInvId) return;
    await deleteInvestment(deleteInvId);
    if (selectedId === deleteInvId) setSelectedId(null);
    setDeleteInvId(null);
  };

  const openValueUpdate = (inv: Investment) => {
    setValueForm(String(inv.currentValue));
    setValueModalId(inv.id);
  };

  const handleUpdateValue = async () => {
    if (!valueModalId || valueForm === '') return;
    await updateInvestment(valueModalId, { currentValue: Number(valueForm) });
    setValueModalId(null);
  };

  // ── Transaction handlers ──────────────────────────────────────────

  const openAddTxn = () => {
    setTxnForm(defaultTxnForm(selectedInvestment?.currency ?? (isDubai ? 'AED' : 'INR')));
    setEditTxnId(null);
    setTxnModal(true);
  };

  const openEditTxn = (t: InvestmentTransaction) => {
    setTxnForm({
      type: t.type,
      date: t.date,
      units: t.units != null ? String(t.units) : '',
      pricePerUnit: t.pricePerUnit != null ? String(t.pricePerUnit) : '',
      amount: String(t.amount),
      currency: t.currency,
      notes: t.notes,
    });
    setEditTxnId(t.id);
    setTxnModal(true);
  };

  const txnUsesUnits = !!selectedInvestment && isUnitBased(selectedInvestment.type) && txnForm.type !== 'Dividend';

  const handleSaveTxn = async () => {
    if (!selectedId || !txnForm.date) return;
    const amount = txnUsesUnits
      ? (Number(txnForm.units) || 0) * (Number(txnForm.pricePerUnit) || 0)
      : Number(txnForm.amount) || 0;
    if (!amount) return;
    const data = {
      investment_id: selectedId,
      type: txnForm.type,
      date: txnForm.date,
      units: txnUsesUnits ? Number(txnForm.units) || 0 : null,
      pricePerUnit: txnUsesUnits ? Number(txnForm.pricePerUnit) || 0 : null,
      amount,
      currency: txnForm.currency,
      notes: txnForm.notes,
    };
    if (editTxnId) await updateInvestmentTransaction(editTxnId, data);
    else await addInvestmentTransaction(data);
    setTxnModal(false);
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {!selectedId && (
        <>
          <PageHeader
            title="Investments"
            subtitle={`${investments.length} holding${investments.length !== 1 ? 's' : ''}`}
            action={
              <div className="flex flex-wrap gap-2">
                {linkedMfInvestments.length > 0 && (
                  <Button variant="secondary" onClick={refreshAllNavs} disabled={refreshingAll}>
                    <RefreshCw size={16} className={refreshingAll ? 'animate-spin' : ''} /> Refresh NAVs
                  </Button>
                )}
                <Button onClick={openAddInvestment}><Plus size={16} /> Add Investment</Button>
              </div>
            }
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Invested"
              value={formatCurrency(portfolioStats.investedInr, 'INR')}
              sub={isDubai ? `≈ AED ${portfolioStats.investedAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : undefined}
              icon={<Wallet size={16} />}
              color="theme"
            />
            <StatCard
              title="Current Value"
              value={formatCurrency(portfolioStats.currentValueInr, 'INR')}
              sub={isDubai ? `≈ AED ${portfolioStats.currentValueAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : undefined}
              icon={<LineChart size={16} />}
              color="blue"
            />
            <StatCard
              title="Gain / Loss"
              value={`${portfolioStats.gainInr >= 0 ? '+' : ''}${formatCurrency(portfolioStats.gainInr, 'INR')}`}
              sub={isDubai
                ? `≈ AED ${portfolioStats.gainAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })} · ${portfolioStats.gainPct >= 0 ? '+' : ''}${portfolioStats.gainPct.toFixed(1)}%`
                : `${portfolioStats.gainPct >= 0 ? '+' : ''}${portfolioStats.gainPct.toFixed(1)}%`}
              icon={portfolioStats.gainAed >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              color={portfolioStats.gainAed >= 0 ? 'green' : 'red'}
            />
            <StatCard
              title="Dividends Received"
              value={formatCurrency(portfolioStats.dividendsInr, 'INR')}
              sub={isDubai ? `≈ AED ${portfolioStats.dividendsAed.toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : undefined}
              icon={<Coins size={16} />}
              color="amber"
            />
          </div>

          {investments.length === 0 ? (
            <EmptyState
              icon={<LineChart size={40} />}
              title="No investments yet"
              description="Track mutual funds, stocks, ETFs, fixed deposits, PPF, NPS and more."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {investments.map(inv => {
                const s = statsFor(inv);
                return (
                  <div key={inv.id} className="card group flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-primary text-sm break-words">{inv.name}</h3>
                          {inv.status === 'closed' && <Badge color={STATUS_BADGE[inv.status]}>closed</Badge>}
                        </div>
                        <p className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <Badge color={INVESTMENT_TYPE_BADGE[inv.type]}>{inv.type}</Badge>
                          {inv.sipEnabled && <Badge color="blue">SIP · Day {inv.sipDay}</Badge>}
                        </p>
                      </div>
                      {/* Always visible on mobile (no hover to reveal on touch); hover-reveal kicks in from sm: up. */}
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEditInvestment(inv)} className="p-1 text-muted hover:text-primary"><Edit2 size={12} /></button>
                        <button onClick={() => setDeleteInvId(inv.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted">Invested</p>
                        <p className="text-primary font-semibold">{formatCurrency(inv.currency === 'AED' ? s.investedAed : s.investedInr, inv.currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted">Current Value</p>
                        <p className="text-primary font-semibold">{formatCurrency(inv.currency === 'AED' ? s.currentValueAed : s.currentValueInr, inv.currency)}</p>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${s.gainAed >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <span className={s.gainAed >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {s.gainAed >= 0 ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
                        {s.gainAed >= 0 ? 'Gain' : 'Loss'}
                      </span>
                      <span className={`font-semibold ${s.gainAed >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.gainPct >= 0 ? '+' : ''}{s.gainPct.toFixed(1)}%
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      className="w-full text-xs py-1.5 mt-auto"
                      onClick={() => setSelectedId(inv.id)}
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
      {selectedId && selectedInvestment && detailStats && (
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
                  <h1 className="text-xl font-bold text-primary tracking-tight break-words">{selectedInvestment.name}</h1>
                  <Badge color={INVESTMENT_TYPE_BADGE[selectedInvestment.type]}>{selectedInvestment.type}</Badge>
                  {selectedInvestment.status === 'closed' && <Badge color={STATUS_BADGE.closed}>closed</Badge>}
                </div>
                {isFixedIncome(selectedInvestment.type) && (selectedInvestment.maturityDate || selectedInvestment.interestRate != null) && (
                  <p className="text-sm text-muted mt-0.5">
                    {selectedInvestment.interestRate != null && <>{selectedInvestment.interestRate}% p.a.</>}
                    {selectedInvestment.interestRate != null && selectedInvestment.maturityDate && ' · '}
                    {selectedInvestment.maturityDate && <>Matures {formatDate(selectedInvestment.maturityDate)}</>}
                  </p>
                )}
                {selectedInvestment.sipEnabled && (
                  <p className="text-sm text-muted mt-0.5">
                    SIP: {formatCurrency(selectedInvestment.sipAmount ?? 0, selectedInvestment.currency)} on day {selectedInvestment.sipDay} of each month
                    {selectedInvestment.sipLastRunDate && <> · last auto-run {formatDate(selectedInvestment.sipLastRunDate)}</>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedInvestment.type === 'Mutual Fund' && selectedInvestment.schemeCode && (
                <Button
                  variant="secondary"
                  onClick={() => refreshNavWithToast(selectedInvestment)}
                  disabled={refreshingId === selectedInvestment.id}
                >
                  <RefreshCw size={16} className={refreshingId === selectedInvestment.id ? 'animate-spin' : ''} /> Refresh NAV
                </Button>
              )}
              <Button variant="secondary" onClick={() => openValueUpdate(selectedInvestment)}>Update Value</Button>
              <Button onClick={openAddTxn}><Plus size={16} /> Add Transaction</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Invested"
              value={formatCurrency(selectedInvestment.currency === 'AED' ? detailStats.investedAed : detailStats.investedInr, selectedInvestment.currency)}
              icon={<Wallet size={18} />}
              color="theme"
            />
            <StatCard
              title="Current Value"
              value={formatCurrency(selectedInvestment.currency === 'AED' ? detailStats.currentValueAed : detailStats.currentValueInr, selectedInvestment.currency)}
              icon={<LineChart size={18} />}
              color="blue"
            />
            <StatCard
              title="Gain / Loss"
              value={`${detailStats.gainPct >= 0 ? '+' : ''}${detailStats.gainPct.toFixed(1)}%`}
              sub={formatCurrency(selectedInvestment.currency === 'AED' ? detailStats.gainAed : detailStats.gainInr, selectedInvestment.currency)}
              icon={detailStats.gainAed >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              color={detailStats.gainAed >= 0 ? 'green' : 'red'}
            />
            {isUnitBased(selectedInvestment.type) ? (
              <StatCard title="Units Held" value={detailStats.totalUnits.toFixed(4)} icon={<PiggyBank size={18} />} color="amber" />
            ) : (
              <StatCard
                title="Dividends"
                value={formatCurrency(selectedInvestment.currency === 'AED' ? detailStats.dividendsAed : detailStats.dividendsInr, selectedInvestment.currency)}
                icon={<Coins size={18} />}
                color="amber"
              />
            )}
          </div>

          {selectedTransactions.length === 0 ? (
            <EmptyState
              icon={<LineChart size={40} />}
              title="No transactions yet"
              description="Record a Buy, SIP, Sell, or Dividend to start the ledger for this holding."
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Date</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Type</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Units</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Price/Unit</th>
                      <th className="text-right text-xs text-muted font-medium px-4 py-3">Amount</th>
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
                        <td className="px-4 py-3 text-right text-xs text-primary hidden md:table-cell">{t.units != null ? t.units.toFixed(4) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-primary hidden md:table-cell">{t.pricePerUnit != null ? t.pricePerUnit.toLocaleString() : '—'}</td>
                        <td className={`px-4 py-3 text-right text-xs font-semibold ${t.type === 'Sell' || t.type === 'Dividend' ? 'text-green-400' : 'text-primary'}`}>
                          {t.currency} {t.amount.toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                        </td>
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

      {/* Investment Modal */}
      <Modal open={invModal} onClose={() => setInvModal(false)} title={editInvId ? 'Edit Investment' : 'Add Investment'}>
        <div className="space-y-4">
          <div className={isDubai ? 'grid grid-cols-2 gap-4' : ''}>
            <FormField label="Type">
              <Select value={invForm.type} onChange={e => setInvForm(f => ({ ...f, type: e.target.value as InvestmentType }))}>
                {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            {isDubai && (
              <FormField label="Currency">
                <Select value={invForm.currency} onChange={e => setInvForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                  <option value="AED">AED</option>
                  <option value="INR">INR</option>
                </Select>
              </FormField>
            )}
          </div>
          <FormField label="Name">
            <Input
              value={invForm.name}
              onChange={e => setInvForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. HDFC Flexicap Fund, Reliance Industries, SBI FD 2028"
            />
          </FormField>
          {invForm.type === 'Mutual Fund' && (
            <FormField label="Link to AMFI Scheme (optional — enables live NAV refresh)">
              {invForm.schemeCode != null ? (
                <div className="input flex items-center justify-between">
                  <span className="text-sm text-primary">Linked · Scheme #{invForm.schemeCode}</span>
                  <button
                    type="button"
                    onClick={() => setInvForm(f => ({ ...f, schemeCode: null }))}
                    className="text-muted hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={schemeQuery}
                    onChange={e => setSchemeQuery(e.target.value)}
                    placeholder="Search fund name, e.g. HDFC Flexicap"
                  />
                  {schemeQuery.trim().length >= 3 && schemeResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto bg-card border border-card-border rounded-lg shadow-xl">
                      {schemeResults.map(r => (
                        <button
                          key={r.schemeCode}
                          type="button"
                          onClick={() => {
                            setInvForm(f => ({ ...f, schemeCode: r.schemeCode, name: f.name || r.schemeName }));
                            setSchemeQuery('');
                            setSchemeResults([]);
                          }}
                          className="block w-full text-left px-3 py-2 text-xs text-muted hover:bg-white/5 hover:text-primary transition-colors"
                        >
                          {r.schemeName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </FormField>
          )}
          {invForm.type === 'Mutual Fund' && (
            <>
              <FormField label="Investment Mode">
                <Select
                  value={invForm.sipEnabled ? 'sip' : 'onetime'}
                  onChange={e => setInvForm(f => ({ ...f, sipEnabled: e.target.value === 'sip' }))}
                >
                  <option value="onetime">One-time / Lumpsum</option>
                  <option value="sip">SIP (recurring monthly)</option>
                </Select>
              </FormField>
              {invForm.sipEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={`SIP Amount (${invForm.currency})`}>
                      <Input
                        type="number" min="0" step="0.01"
                        value={invForm.sipAmount}
                        onChange={e => setInvForm(f => ({ ...f, sipAmount: e.target.value }))}
                        placeholder="e.g. 500"
                      />
                    </FormField>
                    <FormField label="Day of Month (1–28)">
                      <Input
                        type="number" min="1" max="28"
                        value={invForm.sipDay}
                        onChange={e => setInvForm(f => ({ ...f, sipDay: e.target.value }))}
                        placeholder="e.g. 5"
                      />
                    </FormField>
                  </div>
                  <p className="text-xs text-muted -mt-2">
                    Auto-creates a SIP transaction on this day every month, even if you don't open the app. Turning this off stops future entries — past ones stay.
                  </p>
                </>
              )}
            </>
          )}
          <FormField label="Current Value">
            <Input
              type="number" min="0" step="0.01"
              value={invForm.currentValue}
              onChange={e => setInvForm(f => ({ ...f, currentValue: e.target.value }))}
              placeholder="Latest mark-to-market value"
            />
          </FormField>
          {isFixedIncome(invForm.type) && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Interest Rate (% p.a.)">
                <Input
                  type="number" min="0" step="0.01"
                  value={invForm.interestRate}
                  onChange={e => setInvForm(f => ({ ...f, interestRate: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Maturity Date">
                <Input
                  type="date"
                  value={invForm.maturityDate}
                  onChange={e => setInvForm(f => ({ ...f, maturityDate: e.target.value }))}
                />
              </FormField>
            </div>
          )}
          <FormField label="Status">
            <Select value={invForm.status} onChange={e => setInvForm(f => ({ ...f, status: e.target.value as InvestmentStatus }))}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} placeholder="Broker, folio number, account details..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setInvModal(false)}>Cancel</Button>
            <Button onClick={handleSaveInvestment}>{editInvId ? 'Update' : 'Add'} Investment</Button>
          </div>
        </div>
      </Modal>

      {/* Update Current Value Modal */}
      <Modal open={!!valueModalId} onClose={() => setValueModalId(null)} title="Update Current Value">
        <div className="space-y-4">
          <p className="text-sm text-muted">Enter the latest value of this holding as of today — this is what feeds Net Worth and gain/loss.</p>
          <FormField label="Current Value">
            <Input type="number" min="0" step="0.01" value={valueForm} onChange={e => setValueForm(e.target.value)} autoFocus />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setValueModalId(null)}>Cancel</Button>
            <Button onClick={handleUpdateValue}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal open={txnModal} onClose={() => setTxnModal(false)} title={editTxnId ? 'Edit Transaction' : 'Add Transaction'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type">
              <Select value={txnForm.type} onChange={e => setTxnForm(f => ({ ...f, type: e.target.value as InvestmentTxnType }))}>
                <option value="Buy">Buy</option>
                <option value="SIP">SIP</option>
                <option value="Sell">Sell</option>
                <option value="Dividend">Dividend</option>
              </Select>
            </FormField>
            <FormField label="Date">
              <Input type="date" value={txnForm.date} onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
          </div>
          {txnUsesUnits ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Units">
                  <Input type="number" min="0" step="0.0001" value={txnForm.units} onChange={e => setTxnForm(f => ({ ...f, units: e.target.value }))} placeholder="e.g. 12.5" />
                </FormField>
                <FormField label="Price per Unit">
                  <Input type="number" min="0" step="0.01" value={txnForm.pricePerUnit} onChange={e => setTxnForm(f => ({ ...f, pricePerUnit: e.target.value }))} placeholder="0.00" />
                </FormField>
              </div>
              {isDubai && (
                <FormField label="Currency">
                  <Select value={txnForm.currency} onChange={e => setTxnForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </Select>
                </FormField>
              )}
              {Number(txnForm.units) > 0 && Number(txnForm.pricePerUnit) > 0 && (
                <div className="p-3 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-sm">
                  <span className="text-[#6366F1] font-medium">
                    Total: {txnForm.currency} {(Number(txnForm.units) * Number(txnForm.pricePerUnit)).toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={isDubai ? 'grid grid-cols-2 gap-4' : ''}>
              <FormField label="Amount">
                <Input type="number" min="0" step="0.01" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </FormField>
              {isDubai && (
                <FormField label="Currency">
                  <Select value={txnForm.currency} onChange={e => setTxnForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </Select>
                </FormField>
              )}
            </div>
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

      {/* Delete Investment */}
      <ConfirmDialog
        open={!!deleteInvId}
        onClose={() => setDeleteInvId(null)}
        onConfirm={handleDeleteInvestment}
        title="Delete Investment"
        message="This will delete the investment and all its transactions. Are you sure?"
      />

      {/* Delete Transaction */}
      <ConfirmDialog
        open={!!deleteTxnId}
        onClose={() => setDeleteTxnId(null)}
        onConfirm={async () => {
          if (deleteTxnId) {
            await deleteInvestmentTransaction(deleteTxnId);
            setDeleteTxnId(null);
          }
        }}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction?"
      />
    </div>
  );
}
