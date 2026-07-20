import { useEffect, useRef, useState } from 'react';
import { Modal, Button } from './ui';
import { useAppStore, useExpenses, useIncomes, useInvestments, useInvestmentTransactions, useSettings } from '../stores/useAppStore';
import { getWelcomeInsight, WelcomeInsight } from '../utils';

const STORAGE_KEY = 'dft_welcome_last_shown';

// Shows once per calendar day, right after data finishes loading — the
// `decided` ref (not just the isLoading dep) guarantees the localStorage
// check + insight computation only ever runs once per mount, even though
// the effect also depends on data arrays that keep changing as the user
// works (adding an expense elsewhere shouldn't reopen this popup).
export default function WelcomeModal() {
  const isLoading = useAppStore((s) => s.isLoading);
  const expenses = useExpenses();
  const incomes = useIncomes();
  const investments = useInvestments();
  const investmentTransactions = useInvestmentTransactions();
  const settings = useSettings();

  const [insight, setInsight] = useState<WelcomeInsight | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    if (isLoading || decided.current) return;
    decided.current = true;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE_KEY) === today) return;
    localStorage.setItem(STORAGE_KEY, today);

    // One-time sync with an external system (localStorage) gated on async data
    // load completing, not derived state — safe to set directly here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInsight(getWelcomeInsight(expenses, incomes, investments, investmentTransactions, settings));
  }, [isLoading, expenses, incomes, investments, investmentTransactions, settings]);

  if (!insight) return null;

  return (
    <Modal open onClose={() => setInsight(null)} title="Welcome back">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="text-4xl">{insight.emoji}</div>
        <p className="text-sm text-primary">{insight.message}</p>
        <Button onClick={() => setInsight(null)} className="mt-2">Let's go</Button>
      </div>
    </Modal>
  );
}
