import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Key, ShieldAlert, CheckCircle2, AlertCircle, ArrowRight, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ForcedPasswordChangeModalProps {
  onSuccess?: () => void;
}

export default function ForcedPasswordChangeModal({ onSuccess }: ForcedPasswordChangeModalProps) {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user?.mustChangePassword && !success) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current or temporary password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Your new password must be at least 6 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current temporary password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify and retry.');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1200);
      } else {
        setError(result.error || 'Failed to update password. Please check your current password.');
      }
    } catch (err: any) {
      setError(err?.message || 'A network error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-6 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Password Setup Required
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Temporary credentials detected. Set a permanent password to continue.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-6 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Password Updated Successfully
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your credentials have been securely updated. Unlocking your workspace...
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start space-x-2.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Current / Temporary Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter temporary password"
                      className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    New Secure Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                    />
                    <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
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
                      placeholder="Confirm new password"
                      className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                    />
                    <ShieldAlert className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between space-x-3">
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center space-x-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-md shadow-amber-600/20 flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Update & Proceed</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
