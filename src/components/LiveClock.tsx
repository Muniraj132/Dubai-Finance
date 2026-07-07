import { useEffect, useState } from 'react';

// Fits this app's whole premise — tracking money that moves between Dubai
// and India — by keeping both clocks visible regardless of which side
// you're actually viewing from.
const ZONES = [
  { label: 'Dubai', timeZone: 'Asia/Dubai' },
  { label: 'India', timeZone: 'Asia/Kolkata' },
];

const formatTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      {ZONES.map(z => (
        <div key={z.timeZone} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-card-border">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-wide">{z.label}</span>
          <span className="font-mono font-semibold text-sm text-primary tabular-nums">{formatTime(now, z.timeZone)}</span>
        </div>
      ))}
    </div>
  );
}
