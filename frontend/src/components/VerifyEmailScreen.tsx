import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle, RefreshCw, ArrowRight, Mail, CheckCircle2, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CatalystLogo from './CatalystLogo';

export default function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const { verifyEmail, resendVerification, user } = useAuth();

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'No verification token was provided in the link.');
  const [resendEmail, setResendEmail] = useState(user?.email || '');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    (async () => {
      try {
        const result = await verifyEmail(token);
        if (!mounted) return;
        if (result.success) {
          setSuccess(true);
          setError(null);
        } else {
          setError(result.error || 'Failed to verify email. The token may be expired or already used.');
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'A network error occurred while verifying your email.');
        }
      } finally {
        if (mounted) setVerifying(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendSuccess(null);
    try {
      const result = await resendVerification(resendEmail);
      if (result.success) {
        setResendSuccess('Verification email dispatched! Please check your inbox.');
      } else {
        setError(result.error || 'Failed to resend verification link.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error requesting verification link.');
    } finally {
      setResending(false);
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
            Autonomous Startup Operating System
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8"
        >
          {verifying ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/40">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Verifying Email Address
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Validating your cryptographic verification token against the database...
              </p>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/40">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Email Successfully Verified!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                Your account is confirmed and fully activated. You now have complete access to your startup workspace.
              </p>
              <div className="pt-4">
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
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200/50 dark:border-rose-800/40">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Verification Required
                </h2>
                {error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/50 dark:border-rose-900/40">
                    {error}
                  </p>
                )}
              </div>

              {resendSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{resendSuccess}</span>
                </div>
              )}

              {/* Resend verification form */}
              <form onSubmit={handleResend} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Need a new verification link? Enter your email address below:
                </p>
                <div className="relative">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    className="w-full px-3.5 py-2 pl-9 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button
                  type="submit"
                  disabled={resending || !resendEmail}
                  className="w-full py-2 px-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {resending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Resend Verification Email</span>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <Link
                  to="/auth"
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center space-x-1"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
