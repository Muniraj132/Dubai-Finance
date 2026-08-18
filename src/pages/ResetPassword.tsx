import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { Button, FormField, Input } from '../components/ui';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { updatePassword, error, clearError } = useAuthStore();

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (mismatch) return;
    setSubmitting(true);
    await updatePassword(password);
    const { error: err } = useAuthStore.getState();
    if (!err) setDone(true);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#818CF8] to-[#6366F1] flex items-center justify-center shadow-xl shadow-[#6366F1]/30 mb-3">
            <Palmtree size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Dubai Finance</h1>
          <p className="text-sm text-muted">Tracker</p>
        </div>

        <div className="card">
          {done ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">✅</div>
              <p className="text-sm font-medium text-primary">Password updated</p>
              <p className="text-xs text-muted">You're signed in with your new password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-primary">Set a new password</h2>
                <p className="text-xs text-muted mt-1">Choose a new password for your account.</p>
              </div>

              <FormField label="New Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  autoFocus
                />
              </FormField>

              <FormField label="Confirm Password" error={mismatch ? 'Passwords do not match' : undefined}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </FormField>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full mt-1" disabled={submitting || mismatch}>
                {submitting ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
