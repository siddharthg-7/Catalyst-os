import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  ArrowLeft,
  KeyRound,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import Magnet from './Magnet';
import ShinyText from './ShinyText';
import CatalystLogo from '../CatalystLogo';

interface AuthFormProps {
  onBackToLanding: () => void;
}

export default function AuthForm({ onBackToLanding }: AuthFormProps) {
  const navigate = useNavigate();
  const { signin, signup, loginAsDemo } = useAuth();

  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Founder');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    // Basic client validation
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authTab === 'signin') {
        const res = await signin(email.trim(), password);
        if (!res.success) {
          setAuthError(res.error || 'Invalid credentials. Please verify your email and password.');
        } else {
          setAuthSuccess('Authentication verified. Accessing your workspace...');
          setTimeout(() => {
            const roleUpper = (res.user?.role || '').toUpperCase();
            const isEmployee = roleUpper && !['FOUNDER', 'ADMIN'].includes(roleUpper);
            if (isEmployee) {
              navigate('/employee');
            } else if (res.onboarded) {
              navigate('/dashboard');
            } else {
              navigate('/onboarding');
            }
          }, 450);
        }
      } else {
        const cleanName = fullName.trim() || 'Founder';
        const res = await signup(email.trim(), password, cleanName, role);
        if (!res.success) {
          setAuthError(res.error || 'Registration failed. An account with this email may already exist.');
        } else {
          setAuthSuccess('Account initialized successfully. Welcome aboard!');
          setTimeout(() => {
            const roleUpper = (role || '').toUpperCase();
            const isEmployee = !['FOUNDER', 'ADMIN'].includes(roleUpper);
            if (isEmployee) {
              navigate('/employee');
            } else if (res.onboarded) {
              navigate('/dashboard');
            } else {
              navigate('/onboarding');
            }
          }, 450);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccess = async () => {
    setIsSubmitting(true);
    try {
      await loginAsDemo();
      localStorage.setItem('catalystos_onboarding_completed_usr_founder_demo', 'true');
      setAuthSuccess('Demo session active. Launching founder command center...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 350);
    } catch (err: any) {
      setAuthError(err.message || 'Unable to start demo mode.');
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setTimeout(() => {
      setForgotLoading(false);
      setForgotSent(true);
    }, 800);
  };

  // Reusable input and label styling
  const inputBaseCls =
    'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all font-sans shadow-xs';
  const labelCls =
    'block text-[11px] font-semibold tracking-wide uppercase text-slate-600 mb-1.5 font-mono';

  return (
    <div className="flex flex-col justify-between p-8 sm:p-10 xl:p-12 bg-white relative">
      {/* ── Top Navigation Row with Animated Magnetic "Back to Landing" ───── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
            <CatalystLogo className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 tracking-tight block">CatalystOS</span>
            <span className="text-[9px] font-mono text-indigo-600 uppercase font-semibold">Executive Platform</span>
          </div>
        </div>

        {/* Enhanced Interactive "Back to Landing" with Magnet & Soft Indigo Hover */}
        <div className="ml-auto">
          <Magnet padding={35} magnetStrength={0.22}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onBackToLanding}
              className="group relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/60 border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-[0_4px_16px_rgba(79,70,229,0.12)] transition-all duration-200 cursor-pointer overflow-hidden"
              title="Return to Landing Page"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
              <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1 text-slate-400 group-hover:text-indigo-600" />
              <span className="relative z-10 font-sans tracking-tight">Back to Landing</span>
            </motion.button>
          </Magnet>
        </div>
      </div>

      {/* ── Form Header with Gradient Brand Accent ────────────────────────── */}
      <div className="max-w-md w-full mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 font-sans">
            Welcome back to{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              CatalystOS
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed">
            {authTab === 'signin'
              ? 'Enter your credentials to access your autonomous executive council.'
              : 'Deploy your organization workspace with multi-agent orchestration.'}
          </p>
        </div>

        {/* ── Tab Switcher with sliding pill ─────────────────────────────────── */}
        <div className="flex p-1 bg-slate-100/90 rounded-xl mb-6 border border-slate-200/80 relative">
          <button
            type="button"
            onClick={() => {
              setAuthTab('signin');
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative z-10 cursor-pointer ${
              authTab === 'signin'
                ? 'text-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('signup');
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative z-10 cursor-pointer ${
              authTab === 'signup'
                ? 'text-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Create Account
          </button>
          {/* Animated active pill background with subtle glow */}
          <motion.div
            layoutId="activeAuthTabPill"
            className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm border border-slate-200/60"
            style={{
              width: 'calc(50% - 4px)',
              left: authTab === 'signin' ? '4px' : 'calc(50% + 0px)',
            }}
            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
          />
        </div>

        {/* ── Status Alerts (Error & Success) ────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="mb-4 p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-sans leading-relaxed">{authError}</div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-rose-500 hover:text-rose-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {authSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="mb-4 p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-2.5 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-indigo-600 mt-0.5" />
              <div className="flex-1 font-sans leading-relaxed font-semibold">{authSuccess}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Authentication Form ────────────────────────────────────────────── */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authTab === 'signup' && (
            <>
              {/* Full Name */}
              <div className="space-y-1">
                <label className={labelCls} htmlFor="fullName">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className={`${inputBaseCls} pl-10`}
                  />
                </div>
              </div>

              {/* Organization Role Selection */}
              <div className="space-y-1">
                <label className={labelCls} htmlFor="role">
                  Platform Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Founder', 'Executive', 'Investor'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        role === r
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold shadow-xs ring-1 ring-indigo-600/30'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <label className={labelCls} htmlFor="email">
              Work Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@venture.com"
                className={`${inputBaseCls} pl-10`}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password with Visibility Toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={labelCls} htmlFor="password">
                Password
              </label>
              {authTab === 'signin' && (
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`${inputBaseCls} pl-10 pr-10`}
                autoComplete={authTab === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          {authTab === 'signin' && (
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-sans">Remember this device for 30 days</span>
              </label>
            </div>
          )}

          {/* ── Primary Sign-In / Sign-Up Button (Vibrant Indigo-Violet Gradient with Magnet) ── */}
          <div className="pt-2">
            <Magnet
              padding={40}
              magnetStrength={0.20}
              wrapperClassName="w-full block"
              innerClassName="w-full"
            >
              <button
                type="submit"
                disabled={isSubmitting}
                data-cursor="primary"
                className="group relative w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-violet-500 text-white font-bold text-xs tracking-wide shadow-[0_12px_28px_-6px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(79,70,229,0.55)] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 overflow-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Shimmer light sweep */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />

                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <ShinyText
                      text={authTab === 'signin' ? 'Sign In to CatalystOS' : 'Create Founder Workspace'}
                      shineColor="rgba(255, 255, 255, 0.95)"
                      speed={3}
                      className="text-white font-bold"
                    />
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-white" />
                  </>
                )}
              </button>
            </Magnet>
          </div>
        </form>

        {/* ── Divider ──────────────────────────────────────────────────────── */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest text-slate-400">
            <span className="bg-white px-3 font-semibold">Or Instant Access</span>
          </div>
        </div>

        {/* ── 1-Click Demo Access with Soft Amber-Indigo Glow ───────────────── */}
        <button
          type="button"
          onClick={handleDemoAccess}
          disabled={isSubmitting}
          className="group w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/5 via-indigo-500/5 to-violet-500/5 hover:from-amber-500/10 hover:via-indigo-500/10 hover:to-violet-500/10 border border-indigo-200/80 hover:border-indigo-400 text-slate-800 font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-amber-500 transition-transform group-hover:rotate-12 group-hover:scale-110" />
          <span className="font-sans">Launch Founder Demo (1-Click Instant Sandbox)</span>
        </button>

        {/* ── Footer Switcher ──────────────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setAuthTab(authTab === 'signin' ? 'signup' : 'signin');
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className="text-xs text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {authTab === 'signin' ? (
              <>
                Need a new organization?{' '}
                <span className="text-indigo-600 font-bold hover:underline">
                  Create account
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span className="text-indigo-600 font-bold hover:underline">
                  Sign in here
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Bottom Security Micro-Footnote ─────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-slate-500">TLS 1.3 Encrypted Session</span>
        </div>
        <span className="text-indigo-600 font-semibold">SOC-2 Ready</span>
      </div>

      {/* ── Forgot Password Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsForgotModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Reset Your Password</h3>
                </div>
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {forgotSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Recovery Instructions Dispatched</h4>
                  <p className="text-xs text-slate-500">
                    If an account exists for <span className="font-semibold text-slate-700">{forgotEmail}</span>, a secure reset token has been generated.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotModalOpen(false);
                      setForgotSent(false);
                      setForgotEmail('');
                    }}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter the email address registered with your startup workspace and we will dispatch password recovery instructions.
                  </p>
                  <div className="space-y-1">
                    <label className={labelCls} htmlFor="forgotEmail">
                      Account Email
                    </label>
                    <input
                      id="forgotEmail"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="founder@venture.com"
                      className={inputBaseCls}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2"
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Send Recovery Link</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
