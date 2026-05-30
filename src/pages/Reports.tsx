import { Download, FileText } from 'lucide-react';
import { useExpenses, useIncomes, useGoals } from '../stores/useAppStore';
import { PageHeader, Button, Card } from '../components/ui';
import { exportToCSV, formatDate } from '../utils';

export default function Reports() {
  const expenses = useExpenses();
  const incomes = useIncomes();
  const goals = useGoals();

  const exportExpenses = () => {
    exportToCSV(
      expenses.map(e => ({ Date: e.date, Category: e.category, Amount: e.amount, Currency: e.currency, Notes: e.notes })),
      'expenses'
    );
  };

  const exportIncome = () => {
    exportToCSV(
      incomes.map(i => ({ Date: i.date, Source: i.source, Amount: i.amount, Currency: i.currency, Notes: i.notes })),
      'income'
    );
  };

  const exportGoals = () => {
    exportToCSV(
      goals.map(g => ({ Name: g.name, Target: g.targetAmount, Current: g.currentAmount, Currency: g.currency, TargetDate: g.targetDate })),
      'goals'
    );
  };

  const reports = [
    { title: 'Expenses Report', description: `${expenses.length} expense records`, action: exportExpenses, color: 'red' },
    { title: 'Income Report', description: `${incomes.length} income records`, action: exportIncome, color: 'green' },
    { title: 'Goals Report', description: `${goals.length} financial goals`, action: exportGoals, color: 'blue' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Export your financial data" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reports.map(r => (
          <div key={r.title} className="card flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-primary">{r.title}</div>
              <div className="text-xs text-muted mt-1">{r.description}</div>
            </div>
            <Button variant="secondary" onClick={r.action} className="w-full">
              <Download size={14} /> Export CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
