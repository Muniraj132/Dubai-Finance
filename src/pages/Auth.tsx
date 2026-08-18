import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { Button, FormField, Input } from '../components/ui';
import { AccountType } from '../types';

type Mode = 'login' | 'register' | 'reset';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('dubai');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, sendPasswordReset, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === 'login') {
      await signIn(email, password);
    } else if (mode === 'register') {
      await signUp(email, password, accountType);
      const { error: err } = useAuthStore.getState();
      if (!err) setRegistered(true);
    } else {
      await sendPasswordReset(email);
      const { error: err } = useAuthStore.getState();
      if (!err) setResetSent(true);
    }
    setSubmitting(false);
  };

  const switchMode = (m: Mode) => {
    clearError();
    setRegistered(false);
    setResetSent(false);
    setMode(m);
  };


  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#818CF8] to-[#6366F1] flex items-center justify-center shadow-xl shadow-[#6366F1]/30 mb-3">
            <Palmtree size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Dubai Finance</h1>
          <p className="text-sm text-muted">Tracker</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tab switcher */}
          {mode !== 'reset' && (
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg mb-6">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                    mode === m
                      ? 'bg-[#6366F1] text-white shadow-sm shadow-[#6366F1]/30'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>
          )}

          {registered ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">✉️</div>
              <p className="text-sm font-medium text-primary">Check your email</p>
              <p className="text-xs text-muted">
                We sent a confirmation link to <span className="text-[#6366F1]">{email}</span>.
                Confirm then sign in.
              </p>
              <button
                onClick={() => { setRegistered(false); switchMode('login'); }}
                className="text-xs text-[#6366F1] hover:text-[#818CF8] underline mt-2 inline-block"
              >
                Back to Sign In
              </button>
            </div>
          ) : resetSent ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">✉️</div>
              <p className="text-sm font-medium text-primary">Check your email</p>
              <p className="text-xs text-muted">
                If an account exists for <span className="text-[#6366F1]">{email}</span>, we sent a
                password reset link to it.
              </p>
              <button
                onClick={() => switchMode('login')}
                className="text-xs text-[#6366F1] hover:text-[#818CF8] underline mt-2 inline-block"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'reset' && (
                <p className="text-xs text-muted -mt-1">
                  Enter your email and we'll send you a link to set a new password.
                </p>
              )}

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

              {mode !== 'reset' && (
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
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs text-[#6366F1] hover:text-[#818CF8] underline -mt-2"
                >
                  Forgot password?
                </button>
              )}

              {mode === 'register' && (
                <FormField label="I'm based in">
                  <div className="flex gap-4">
                    {([
                      { value: 'dubai', label: 'Dubai (AED + INR)' },
                      { value: 'india', label: 'India (INR only)' },
                    ] as const).map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                        <input
                          type="radio"
                          name="accountType"
                          value={opt.value}
                          checked={accountType === opt.value}
                          onChange={() => setAccountType(opt.value)}
                          className="accent-[#6366F1]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </FormField>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full mt-1" disabled={submitting}>
                {mode === 'reset'
                  ? (submitting ? 'Sending…' : 'Send Reset Link')
                  : submitting
                    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                    : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </Button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-muted hover:text-primary underline block mx-auto"
                >
                  Back to Sign In
                </button>
              )}

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
