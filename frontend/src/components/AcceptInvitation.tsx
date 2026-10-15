/**
 * P1 Task 8 — invitation acceptance screen.
 *
 * Public route (/accept-invitation?token=...). The raw token in the URL is the
 * credential. Two paths:
 *   - the email already has a CatalystOS account -> accept, no password asked
 *   - the email is new                           -> set a password, account created
 * Both call POST /api/invitations/accept, which issues a normal session JWT via
 * the existing auth architecture.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';

interface InvitationPreview {
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  companyName: string;
  expiresAt: string;
  requiresAccount: boolean;
}

const STATUS_COPY: Record<string, string> = {
  ACCEPTED: 'This invitation has already been used. Try signing in instead.',
  EXPIRED: 'This invitation has expired. Ask your administrator to resend it.',
  REVOKED: 'This invitation was revoked and can no longer be used.'
};

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This invitation link is missing its token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/invitations/accept/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'This invitation link is not valid.');
        } else if (data.status !== 'PENDING') {
          setError(STATUS_COPY[data.status] || 'This invitation is no longer valid.');
        } else {
          setPreview(data);
          setName(data.email?.split('@')[0] || '');
        }
      } catch {
        setError('The invitation could not be verified. Check your connection and retry.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Pass any existing session so the backend can bind acceptance to it.
      const existingToken = localStorage.getItem('catalystos_token');
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {})
        },
        body: JSON.stringify({
          token,
          name: name.trim() || undefined,
          password: preview?.requiresAccount ? password : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'The invitation could not be accepted.');
        return;
      }
      // Reuse the existing session contract, then enter the shared workspace.
      localStorage.setItem('catalystos_token', data.token);
      localStorage.setItem('catalystos_user', JSON.stringify(data.user));
      const roleUpper = (data.user?.role || data.role || '').toUpperCase();
      const isEmployee = !['FOUNDER', 'ADMIN'].includes(roleUpper);
      window.location.replace(isEmployee ? '/employee' : '/dashboard');
    } catch {
      setError('The invitation could not be accepted. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F0EE] text-[#141413] flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[20px] border border-[#141413]/10 shadow-sm p-7 space-y-5">
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-[#696969] py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying your invitation…</span>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold">Invitation unavailable</h1>
              <p className="text-xs text-[#696969]">{error}</p>
            </div>
            <button
              onClick={() => navigate('/auth')}
              className="w-full px-4 py-2.5 rounded-[12px] bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-bold transition-all cursor-pointer"
            >
              Go to sign in
            </button>
          </div>
        ) : preview ? (
          <form onSubmit={handleAccept} className="space-y-5">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-bold">Join {preview.companyName}</h1>
                <p className="text-xs text-[#696969]">
                  You were invited as <span className="font-semibold text-[#141413]">{preview.role}</span>.
                </p>
              </div>
            </div>

            <div className="rounded-[12px] bg-[#F3F0EE]/60 border border-[#141413]/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="w-3.5 h-3.5 text-[#696969]" />
                <span className="text-[#696969]">Company</span>
                <span className="ml-auto font-semibold">{preview.companyName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#696969] pl-5">Email</span>
                <span className="ml-auto font-semibold">{preview.email}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="invite-name" className="text-[10px] uppercase font-mono tracking-widest text-[#696969] font-bold block">
                Your Name
              </label>
              <input
                id="invite-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#F3F0EE]/40 border border-[#141413]/15 rounded-[12px] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#141413] focus:bg-white transition-all"
              />
            </div>

            {preview.requiresAccount && (
              <div className="space-y-1">
                <label htmlFor="invite-password" className="text-[10px] uppercase font-mono tracking-widest text-[#696969] font-bold block">
                  Set a Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                  placeholder="At least 6 characters"
                  className="w-full bg-[#F3F0EE]/40 border border-[#141413]/15 rounded-[12px] px-3.5 py-2.5 text-xs placeholder-[#696969]/60 focus:outline-none focus:border-[#141413] focus:bg-white transition-all"
                />
              </div>
            )}

            {!preview.requiresAccount && (
              <p className="text-[11px] text-[#696969]">
                You already have a CatalystOS account for this email, so no new password is needed.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#141413] hover:bg-[#262627] disabled:opacity-60 text-[#F3F0EE] text-xs font-bold transition-all cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Joining…' : 'Accept invitation'}</span>
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
