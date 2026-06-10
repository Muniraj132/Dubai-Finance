import { useState, useEffect } from 'react';
import { useAppStore, useSettings } from '../stores/useAppStore';
import { PageHeader, FormField, Input, Button } from '../components/ui';

export default function Settings () {
  const settings = useSettings();
  const updateSettings = useAppStore(s => s.updateSettings);

  const [rate, setRate] = useState(settings.aedToInrRate.toString());
  const [arrivalDate, setArrivalDate] = useState(settings.dubaiArrivalDate);

  // Sync local state when the store finishes loading from Supabase after a page refresh
  useEffect(() => {
    setRate(settings.aedToInrRate.toString());
  }, [settings.aedToInrRate]);

  useEffect(() => {
    setArrivalDate(settings.dubaiArrivalDate);
  }, [settings.dubaiArrivalDate]);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const r = parseFloat(rate);
    updateSettings({
      aedToInrRate: isNaN(r) ? settings.aedToInrRate : r,
      dubaiArrivalDate: arrivalDate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-lg">
      <PageHeader title="Settings" subtitle="Configure your Dubai Finance Tracker" />

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-primary">Exchange Rate</h2>
        <FormField label="AED to INR Rate">
          <Input
            type="number"
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="23"
            step="0.01"
          />
        </FormField>
        <p className="text-xs text-muted">Current: 1 AED = ₹{settings.aedToInrRate}. Update this manually to match current market rates.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-primary">Dubai Journey</h2>
        <FormField label="Dubai Arrival Date">
          <Input
            type="date"
            value={arrivalDate}
            onChange={e => setArrivalDate(e.target.value)}
          />
        </FormField>
        <p className="text-xs text-muted">Used to calculate your days in Dubai on the Dubai Life page.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-primary">Theme</h2>
        <div className="flex gap-3">
          {(['dark', 'light'] as const).map(t => (
            <button
              key={t}
              onClick={() => updateSettings({ theme: t })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                settings.theme === t
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                  : 'bg-white/5 border-white/10 text-muted hover:border-white/20'
              }`}
            >
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}
