import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { isAuthenticated, saveSession, getStoredUser } from '../lib/auth';
import { adminAPI, setAuthToken } from '../lib/adminApi';
import { API_BASE_URL, API_HEADERS } from '../config/apiConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'login' | 'forgot' | 'otp' | 'reset' | 'success';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Shared step-transition variants ──────────────────────────────────────────

const stepVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -24 },
};

const stepTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  // ── Global step state ──
  const [step, setStep] = useState<Step>('login');

  // ── Shared context that persists across steps ──
  const [email, setEmail]     = useState('');
  const [otpCode, setOtpCode] = useState(''); // verified OTP, passed to reset step

  const navigate  = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getStoredUser();
      navigate(user?.role === 'admin' ? '/' : '/member-cv', { replace: true });
    }
  }, [navigate]);

  // ── Step transition helper — also resets any local step state via key ──
  const goTo = (next: Step) => setStep(next);

  // ──────────────────────────────────────────────────────────────────────────
  // Outer shell — never changes
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-pastel-gradient-login">
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 min-h-0">
        <div className="w-full max-w-[1000px] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14">

          {/* Left Side: Branding & Logo — always visible */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="hidden lg:flex flex-1 flex-col items-center space-y-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-300 via-cyan-200 to-teal-300 rounded-full blur-xl opacity-80 animate-pulse" />
              <motion.img
                src="/SRL Logo.svg"
                alt="Students Research Lab Logo"
                className="w-64 h-64 xl:w-80 xl:h-80 drop-shadow-2xl transition-transform duration-500 rounded-full border-4 border-teal-400/70 shadow-2xl shadow-teal-400/70"
                whileHover={{ scale: 1.05 }}
              />
            </div>
            <div className="w-full text-center">
              <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tighter">
                <span className="animate-gradient-text">Students Research Lab</span>
              </h1>
            </div>
          </motion.div>

          {/* Right Side: Card shell — always the same card, inner content swaps */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-[390px] flex flex-col gap-3"
          >
            <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 lg:p-10 shadow-2xl flex flex-col items-center overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {step === 'login'   && <LoginStep   key="login"   email={email} setEmail={setEmail} goTo={goTo} navigate={navigate} toast={toast} />}
                {step === 'forgot'  && <ForgotStep  key="forgot"  email={email} setEmail={setEmail} goTo={goTo} />}
                {step === 'otp'     && <OtpStep     key="otp"     email={email} setOtpCode={setOtpCode} goTo={goTo} />}
                {step === 'reset'   && <ResetStep   key="reset"   email={email} otp={otpCode} goTo={goTo} />}
                {step === 'success' && <SuccessStep key="success" goTo={goTo} />}
              </AnimatePresence>
            </div>

            <div className="text-center py-2">
              <p className="text-[11px] text-teal-950/60 font-extrabold tracking-[0.05em] uppercase">
                © 2026 Students Research Lab. All rights reserved.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Login
// ─────────────────────────────────────────────────────────────────────────────

function LoginStep({ email, setEmail, goTo, navigate, toast }: {
  email: string;
  setEmail: (v: string) => void;
  goTo: (s: Step) => void;
  navigate: ReturnType<typeof useNavigate>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [emailError,    setEmailError]    = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error,         setError]         = useState('');

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (error) setError('');
  };

  const validate = (): boolean => {
    let valid = true;
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setEmailError('Enter your email'); valid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Enter a valid email address'); valid = false;
    }
    if (!trimmedPassword) {
      setPasswordError('Enter your password'); valid = false;
    }
    return valid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await adminAPI.login(email.trim(), password.trim());
      if (!response.success || !response.token) throw new Error(response.message || 'Login failed');

      setAuthToken(response.token);
      const user = response.user;
      const enrollmentNo: string | undefined = user.enrollmentNo || user.enrollment_no || undefined;
      saveSession({
        email: user.email,
        name: user.name,
        enrollmentNo,
        role: user.is_admin ? 'admin' : (user.role || 'member'),
      }, response.token);

      toast({
        title: 'Login successful',
        description: user.role === 'admin' ? 'Admin access enabled.' : 'Member access granted.',
      });

      navigate(user.role === 'admin' ? '/' : '/member-cv', { replace: true });
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('networkerror') ||
        msg.toLowerCase().includes('network request failed') ||
        msg.toLowerCase().includes('load failed')
      ) {
        setError('Unable to connect. Please try again.');
      } else if (err?.name === 'TypeError' || msg.toLowerCase().includes('unexpected token')) {
        setError('Something went wrong. Please try again.');
      } else {
        setError('Incorrect email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full flex flex-col items-center"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
    >
      <p className="text-[11px] sm:text-[12px] leading-relaxed text-center italic text-teal-950/80 mb-5 font-semibold max-w-[300px] tracking-tight">
        "Fostering a disciplined research culture, consistency in academic practice, and excellence through collaborative scholarly engagement"
      </p>
      <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Login to SRL</h2>
      <p className="text-xs sm:text-sm text-teal-800/80 mb-5 font-bold tracking-wide">Enter your credentials below</p>

      <form onSubmit={handleLogin} className="w-full space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Login Email ID</Label>
          <div className="relative flex items-center">
            <Mail className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
            <Input
              id="login-email"
              type="email"
              placeholder="Email"
              className="!pl-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
              value={email}
              onChange={handleEmailChange}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          {emailError && <p className="text-red-600 text-xs ml-1">{emailError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Password</Label>
          <div className="relative flex items-center">
            <Lock className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="!pl-14 !pr-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
              value={password}
              onChange={handlePasswordChange}
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 text-teal-700/60 hover:text-teal-900 transition-colors z-10"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordError && <p className="text-red-600 text-xs ml-1">{passwordError}</p>}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 mt-2 text-base tracking-wide"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Logging in...
            </span>
          ) : 'Log in'}
        </Button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => goTo('forgot')}
            className="text-xs text-teal-700/70 hover:text-teal-900 font-semibold transition-colors"
          >
            Forgot Password?
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Forgot Password
// ─────────────────────────────────────────────────────────────────────────────

function ForgotStep({ email, setEmail, goTo }: {
  email: string;
  setEmail: (v: string) => void;
  goTo: (s: Step) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong.');
      setEmail(trimmed);
      goTo('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full flex flex-col items-center"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
    >
      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mb-5">
        <KeyRound className="w-6 h-6 text-teal-700" />
      </div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Forgot Password</h2>
      <p className="text-xs sm:text-sm text-teal-800/80 mb-5 font-bold tracking-wide text-center">
        Enter your registered email and we'll send you an OTP.
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="forgot-email" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Email Address</Label>
          <div className="relative flex items-center">
            <Mail className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
            <Input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              className="!pl-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 mt-2 text-base tracking-wide"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending OTP...
            </span>
          ) : 'Send OTP'}
        </Button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => goTo('login')}
            className="text-xs text-teal-700/70 hover:text-teal-900 font-semibold transition-colors"
          >
            Back to Login
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — OTP Verification
// ─────────────────────────────────────────────────────────────────────────────

function OtpStep({ email, setOtpCode, goTo }: {
  email: string;
  setOtpCode: (v: string) => void;
  goTo: (s: Step) => void;
}) {
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid or expired OTP.');
      setOtpCode(otp);
      goTo('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not resend OTP.');
      setResendMsg('A new OTP has been sent to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      className="w-full flex flex-col items-center"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
    >
      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mb-5">
        <Mail className="w-6 h-6 text-teal-700" />
      </div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Enter OTP</h2>
      <p className="text-xs sm:text-sm text-teal-800/80 mb-2 font-bold tracking-wide text-center">
        We sent a 6-digit OTP to <span className="text-teal-900">{email}</span>
      </p>

      <div className="w-full bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-4 py-3 mb-5 font-semibold">
        This OTP expires in <strong>10 minutes</strong>. Check your inbox and spam folder.
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="otp-input" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">6-Digit OTP</Label>
          <Input
            id="otp-input"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={handleOtpChange}
            placeholder="• • • • • •"
            className="h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm text-teal-950 font-mono text-2xl tracking-widest text-center"
            maxLength={6}
            disabled={loading}
            autoComplete="one-time-code"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}
        {resendMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{resendMsg}</div>
        )}

        <Button
          type="submit"
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 mt-2 text-base tracking-wide"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying...
            </span>
          ) : 'Verify OTP'}
        </Button>

        <div className="text-center pt-1 space-y-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-xs text-teal-700/70 hover:text-teal-900 font-semibold transition-colors disabled:opacity-50"
          >
            {resending ? 'Resending...' : 'Resend OTP'}
          </button>
          <br />
          <button
            type="button"
            onClick={() => goTo('forgot')}
            className="text-xs text-teal-700/70 hover:text-teal-900 font-semibold transition-colors"
          >
            Back
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Reset Password
// ─────────────────────────────────────────────────────────────────────────────

function ResetStep({ email, otp, goTo }: {
  email: string;
  otp: string;
  goTo: (s: Step) => void;
}) {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6)          { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword)  { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not reset password.');
      goTo('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full flex flex-col items-center"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
    >
      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-teal-700" />
      </div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Reset Password</h2>
      <p className="text-xs sm:text-sm text-teal-800/80 mb-5 font-bold tracking-wide text-center">
        Choose a new password for <span className="text-teal-900">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">New Password</Label>
          <div className="relative flex items-center">
            <Lock className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
            <Input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              className="!pl-14 !pr-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
              disabled={loading}
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-4 text-teal-700/60 hover:text-teal-900 transition-colors z-10" disabled={loading}>
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-[11px] font-extrabold text-teal-950 ml-1 uppercase tracking-[0.12em]">Confirm Password</Label>
          <div className="relative flex items-center">
            <Lock className="absolute left-4 w-5 h-5 text-teal-700/70 z-10 pointer-events-none" />
            <Input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter password"
              className="!pl-14 !pr-14 h-14 bg-white/70 border-teal-200/50 hover:border-teal-400 focus:border-teal-600 rounded-2xl transition-all shadow-sm focus:shadow-teal-200/30 text-teal-950 font-medium"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
              disabled={loading}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-4 text-teal-700/60 hover:text-teal-900 transition-colors z-10" disabled={loading}>
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <Button
          type="submit"
          className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 mt-2 text-base tracking-wide"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Resetting...
            </span>
          ) : 'Reset Password'}
        </Button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => goTo('otp')}
            className="text-xs text-teal-700/70 hover:text-teal-900 font-semibold transition-colors"
          >
            Back
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Success
// ─────────────────────────────────────────────────────────────────────────────

function SuccessStep({ goTo }: { goTo: (s: Step) => void }) {
  return (
    <motion.div
      className="w-full flex flex-col items-center text-center"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
    >
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
        <CheckCircle2 className="w-6 h-6 text-green-600" />
      </div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-teal-950 mb-1 tracking-tight">Password Reset!</h2>
      <p className="text-xs sm:text-sm text-teal-800/80 mb-8 font-bold tracking-wide max-w-[280px] text-center">
        Your password has been updated successfully. You can now log in with your new password.
      </p>

      <Button
        type="button"
        onClick={() => goTo('login')}
        className="w-full h-14 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white font-extrabold transition-all shadow-xl hover:shadow-teal-700/30 text-base tracking-wide"
      >
        Back to Login
      </Button>
    </motion.div>
  );
}
