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

interface AuthFormProps {
  onBackToLanding: () => void;
}

export default function AuthForm({ onBackToLanding }: AuthFormProps) {
  const navigate = useNavigate();
  const { signin, signup, loginAsDemo, forgotPassword } = useAuth();

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
        const cleanName = fullName.trim() || (role === 'Employee' ? 'Team Member' : 'Founder');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  // Reusable input and label styling in Warm Luxury Enterprise Carbon
  const inputBaseCls =
    'w-full bg-[#FDFCFA] border border-[rgba(20,20,19,0.12)] rounded-xl px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8E8D8A] focus:outline-none focus:border-[#141413] focus:ring-2 focus:ring-[#141413]/08 focus:bg-white transition-all font-sans shadow-2xs';
  const labelCls =
    'block text-[10px] font-bold tracking-widest uppercase text-[#666562] mb-1.5 font-mono';

  return (
    <div className="flex flex-col justify-between p-8 sm:p-10 xl:p-12 bg-white relative">
      {/* ── Top Navigation Row with "Back to Landing" ──────────────────────── */}
      <div className="flex items-center justify-end mb-6 sm:mb-8">
        {/* Interactive "Back to Landing" with Subtle Carbon Border */}
        <div>
          <Magnet padding={35} magnetStrength={0.22}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onBackToLanding}
              className="group relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#666562] hover:text-[#141413] bg-[#FDFCFA] hover:bg-white border border-[rgba(20,20,19,0.10)] hover:border-[rgba(20,20,19,0.22)] shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer overflow-hidden"
              title="Return to Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1 text-[#8E8D8A] group-hover:text-[#141413]" />
              <span className="relative z-10 font-sans tracking-tight">Back to Landing</span>
            </motion.button>
          </Magnet>
        </div>
      </div>

      {/* ── Form Header: Clean Executive Typography ────────────────────────── */}
      <div className="max-w-md w-full mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#141413] tracking-tight mb-2 font-sans">
            Welcome to{' '}
            <span className="text-[#141413]">
              CatalystOS
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-[#666562] font-sans leading-relaxed">
            {authTab === 'signin'
              ? 'Enter your credentials to access your autonomous executive council.'
              : 'Deploy your organization workspace with multi-agent orchestration.'}
          </p>
        </div>

        {/* ── Tab Switcher with sliding pill ─────────────────────────────────── */}
        <div className="flex p-1 bg-[#F3F0EE] rounded-xl mb-6 border border-[rgba(20,20,19,0.08)] relative">
          <button
            type="button"
            onClick={() => {
              setAuthTab('signin');
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all relative z-10 cursor-pointer ${
              authTab === 'signin'
                ? 'text-[#141413] font-bold'
                : 'text-[#666562] hover:text-[#141413]'
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
                ? 'text-[#141413] font-bold'
                : 'text-[#666562] hover:text-[#141413]'
            }`}
          >
            Create Account
          </button>
          {/* Animated active pill background */}
          <motion.div
            layoutId="activeAuthTabPill"
            className="absolute top-1 bottom-1 bg-white rounded-lg shadow-xs border border-[rgba(20,20,19,0.08)]"
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
              className="mb-4 p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
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
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8D8A]">
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
                <div className="grid grid-cols-2 gap-2">
                  {(['Founder', 'Employee'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        role === r
                          ? 'bg-[#141413] border-[#141413] text-[#FDFCFA] font-bold shadow-xs'
                          : 'bg-[#FDFCFA] border-[rgba(20,20,19,0.10)] text-[#666562] hover:border-[rgba(20,20,19,0.20)] hover:bg-white hover:text-[#141413]'
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
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8D8A]">
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
                  className="text-[11px] font-semibold text-[#141413] hover:text-[#666562] transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8D8A]">
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
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8E8D8A] hover:text-[#141413] transition-colors cursor-pointer"
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
                  className="w-4 h-4 rounded border-[rgba(20,20,19,0.20)] text-[#141413] focus:ring-[#141413] cursor-pointer accent-[#141413]"
                />
                <span className="text-xs text-[#666562] font-sans">Remember this device for 30 days</span>
              </label>
            </div>
          )}

          {/* ── Primary Sign-In / Sign-Up Button (Executive Carbon with Magnet) ── */}
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
                className="group relative w-full py-3.5 px-5 rounded-xl bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] font-bold text-xs tracking-wide shadow-sm hover:shadow-md border border-[#141413] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 overflow-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Subtle shimmer sweep */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />

                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FDFCFA]" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <ShinyText
                      text={authTab === 'signin' ? 'Sign In to CatalystOS' : 'Create Founder Workspace'}
                      shineColor="rgba(255, 255, 255, 0.95)"
                      speed={3}
                      className="text-[#FDFCFA] font-bold"
                    />
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-[#FDFCFA]" />
                  </>
                )}
              </button>
            </Magnet>
          </div>
        </form>

        {/* ── Divider ──────────────────────────────────────────────────────── */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[rgba(20,20,19,0.08)]" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest text-[#8E8D8A]">
            <span className="bg-white px-3 font-semibold">Or Instant Access</span>
          </div>
        </div>

        {/* ── 1-Click Demo Access (Executive Warm Surface) ─────────────────── */}
        <button
          type="button"
          onClick={handleDemoAccess}
          disabled={isSubmitting}
          className="group w-full py-3 px-4 rounded-xl bg-[#FDFCFA] hover:bg-white border border-[rgba(20,20,19,0.12)] hover:border-[rgba(20,20,19,0.25)] text-[#141413] font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-[#141413] transition-transform group-hover:rotate-12 group-hover:scale-110" />
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
            className="text-xs text-[#666562] hover:text-[#141413] transition-colors cursor-pointer"
          >
            {authTab === 'signin' ? (
              <>
                Need a new organization?{' '}
                <span className="text-[#141413] font-bold hover:underline">
                  Create account
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span className="text-[#141413] font-bold hover:underline">
                  Sign in here
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Bottom Security Micro-Footnote ─────────────────────────────────── */}
      <div className="mt-8 pt-4 border-t border-[rgba(20,20,19,0.08)] flex items-center justify-between text-[11px] text-[#8E8D8A] font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#141413]" />
          <span className="text-[#666562]">TLS 1.3 Encrypted Session</span>
        </div>
        <span className="text-[#141413] font-semibold">SOC-2 Ready</span>
      </div>

      {/* ── Forgot Password Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs"
            onClick={() => setIsForgotModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl p-6 border border-[rgba(20,20,19,0.12)] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F3F0EE] text-[#141413] flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] font-sans">Reset Your Password</h3>
                </div>
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="p-1 rounded-md text-[#8E8D8A] hover:text-[#141413] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {forgotSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#141413]">Recovery Instructions Dispatched</h4>
                  <p className="text-xs text-[#666562]">
                    If an account exists for <span className="font-semibold text-[#141413]">{forgotEmail}</span>, a secure reset token has been generated.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotModalOpen(false);
                      setForgotSent(false);
                      setForgotEmail('');
                    }}
                    className="mt-2 px-4 py-2 bg-[#141413] text-[#FDFCFA] rounded-xl text-xs font-semibold hover:bg-[#262627] transition-colors shadow-xs cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-[#666562] leading-relaxed">
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
                      className="px-4 py-2 text-xs font-semibold text-[#666562] hover:bg-[#F3F0EE] rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 text-xs font-semibold bg-[#141413] text-[#FDFCFA] hover:bg-[#262627] rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
