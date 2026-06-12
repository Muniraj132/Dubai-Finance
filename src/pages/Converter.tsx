import { useState } from 'react';
import { ArrowRightLeft, Calculator, Settings } from 'lucide-react';
import { useAppStore, useSettings } from '../stores/useAppStore';
import { PageHeader, FormField, Input, Button, Card } from '../components/ui';

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];

export default function Converter() {
  const settings = useSettings();
  const updateSettings = useAppStore(s => s.updateSettings);

  const [aedAmount, setAedAmount] = useState('');
  const [inrAmount, setInrAmount] = useState('');
  const [editRate, setEditRate] = useState(false);
  const [newRate, setNewRate] = useState(settings.aedToInrRate.toString());

  const handleAED = (val: string) => {
    setAedAmount(val);
    const num = parseFloat(val);
    setInrAmount(isNaN(num) ? '' : (num * settings.aedToInrRate).toFixed(2));
  };

  const handleINR = (val: string) => {
    setInrAmount(val);
    const num = parseFloat(val);
    setAedAmount(isNaN(num) ? '' : (num / settings.aedToInrRate).toFixed(2));
  };

  const handleSwap = () => {
    handleINR(aedAmount);
    setAedAmount(inrAmount);
    setInrAmount(aedAmount);
  };

  const saveRate = () => {
    const r = parseFloat(newRate);
    if (!isNaN(r) && r > 0) {
      updateSettings({ aedToInrRate: r });
    }
    setEditRate(false);
  };

  const setQuick = (amt: number) => {
    setAedAmount(amt.toString());
    setInrAmount((amt * settings.aedToInrRate).toFixed(2));
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <PageHeader title="AED → INR Converter" subtitle="Convert between UAE Dirham and Indian Rupee" />

      {/* Rate Banner */}
      <div className="card bg-gradient-to-r from-[#A6445D]/10 to-[#C75B76]/10 border-[#A6445D]/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted mb-1">Current Rate</div>
            <div className="text-2xl font-bold text-[#A6445D]">1 AED = ₹{settings.aedToInrRate}</div>
          </div>
          <button
            onClick={() => { setEditRate(true); setNewRate(settings.aedToInrRate.toString()); }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
          >
            <Settings size={12} /> Update Rate
          </button>
        </div>
        {editRate && (
          <div className="mt-4 flex gap-2">
            <Input
              type="number"
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              placeholder="Enter new rate"
              className="flex-1"
            />
            <Button onClick={saveRate}>Save</Button>
            <Button variant="secondary" onClick={() => setEditRate(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Converter */}
      <div className="card space-y-4">
        <FormField label="Amount in AED (د.إ)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium text-sm">AED</span>
            <Input
              type="number"
              value={aedAmount}
              onChange={e => handleAED(e.target.value)}
              placeholder="0.00"
              className="pl-12 text-xl font-bold"
            />
          </div>
        </FormField>

        <div className="flex justify-center">
          <button
            onClick={handleSwap}
            className="w-10 h-10 rounded-full bg-[#A6445D]/15 border border-[#A6445D]/30 flex items-center justify-center text-[#A6445D] hover:bg-[#A6445D]/25 transition-colors"
          >
            <ArrowRightLeft size={16} />
          </button>
        </div>

        <FormField label="Amount in INR (₹)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium text-sm">INR</span>
            <Input
              type="number"
              value={inrAmount}
              onChange={e => handleINR(e.target.value)}
              placeholder="0.00"
              className="pl-12 text-xl font-bold"
            />
          </div>
        </FormField>

        {aedAmount && inrAmount && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
            <div className="text-green-400 font-bold text-lg">
              AED {parseFloat(aedAmount).toLocaleString('en-AE', { maximumFractionDigits: 2 })} = ₹{parseFloat(inrAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* Quick amounts */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-3">Quick Convert (AED)</h2>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map(amt => (
            <button
              key={amt}
              onClick={() => setQuick(amt)}
              className="flex flex-col items-center py-3 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#A6445D]/30 transition-all group"
            >
              <span className="text-sm font-semibold text-primary group-hover:text-[#A6445D]">AED {amt.toLocaleString()}</span>
              <span className="text-xs text-muted mt-0.5">₹{(amt * settings.aedToInrRate).toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Salary reference */}
      <div className="card">
        <h2 className="text-sm font-semibold text-primary mb-3">Salary Reference</h2>
        <div className="space-y-2">
          {[5000, 8000, 10000, 12000, 15000, 20000].map(sal => (
            <div key={sal} className="flex justify-between items-center py-1.5 border-b border-card-border last:border-0 text-sm">
              <span className="text-muted">AED {sal.toLocaleString()}/mo</span>
              <span className="text-primary font-semibold">₹{(sal * settings.aedToInrRate).toLocaleString('en-IN')}/mo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
