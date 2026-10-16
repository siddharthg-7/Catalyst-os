import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, Lock, ShieldCheck, AlertCircle, ArrowRight, Loader2, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CatalystLogo from './CatalystLogo';

export default function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const { resetPassword } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'No reset token was provided in the link.');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from the link.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and retry.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, newPassword);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError(result.error || 'Failed to reset password. The link may have expired.');
      }
    } catch (err: any) {
      setError(err?.message || 'A network error occurred while resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <CatalystLogo className="w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Catalyst OS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose a new password for your account
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8"
        >
          {success ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/40">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Password Reset Successfully
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                Your new password is now active. Redirecting you to your workspace...
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>Go to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/40 mb-2">
                  <Key className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Set New Password
                </h2>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start space-x-2.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/auth"
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center space-x-1"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
