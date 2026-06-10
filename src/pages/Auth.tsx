import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { Button, FormField, Input } from '../components/ui';

type Mode = 'login' | 'register';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const { signIn, signUp, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === 'login') {
      await signIn(email, password);
      if (!useAuthStore.getState().error) fetchexchagerate();
    } else {
      await signUp(email, password);
      const { error: err } = useAuthStore.getState();
      if (!err) setRegistered(true);
    }
    setSubmitting(false);
  };

  const switchMode = (m: Mode) => {
    clearError();
    setRegistered(false);
    setMode(m);
  };

  function fetchexchagerate() {
    if (sessionStorage.getItem('exchangeRateFetched')) return;
    fetch('https://api.exchangerate-api.com/v4/latest/AED')
      .then(response => response.json())
      .then(data => {
        if (data.rates.INR) {
          useAppStore.getState().updateSettings({ aedToInrRate: data.rates.INR });
          sessionStorage.setItem('exchangeRateFetched', 'true');
          useAppStore.getState().setRateJustUpdated(true);
        }
      })
      .catch(error => {
        console.error('Error fetching exchange rate:', error);
      });
  }



  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/30 mb-3">
            <Palmtree size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Dubai Finance</h1>
          <p className="text-sm text-muted">Tracker</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                  mode === m
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {registered ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">✉️</div>
              <p className="text-sm font-medium text-primary">Check your email</p>
              <p className="text-xs text-muted">
                We sent a confirmation link to <span className="text-orange-400">{email}</span>.
                Confirm then sign in.
              </p>
              <button
                onClick={() => { setRegistered(false); switchMode('login'); }}
                className="text-xs text-orange-400 hover:text-orange-300 underline mt-2 inline-block"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </FormField>

              <FormField label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </FormField>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full mt-1" disabled={submitting}>
                {submitting
                  ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </Button>

              {mode === 'register' && (
                <p className="text-xs text-muted text-center pt-1">
                  Your data is private and tied only to your account.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
