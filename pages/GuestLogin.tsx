import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestAuth } from '../services/guestAuthService';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  Building2,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../components/ui';
import {
  PasswordComplexityChecker,
  validatePasswordComplexity
} from '../components/PasswordComplexityChecker';
import { GuestLoadingScreen } from '../components/GuestLoadingScreen';
import toast from 'react-hot-toast';

type LoginView = 'login' | 'force_change' | 'forgot_email' | 'forgot_otp' | 'forgot_new_pass';

export default function GuestLogin() {
  const navigate = useNavigate();
  const { settings, currentProperty } = useSettings();

  // Loading state
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // First-login / Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password OTP state
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Property Branding
  const propertyName = currentProperty?.name || settings?.name || 'Luxury Health Club & Spa';
  const logoUrl = currentProperty?.logo_url || settings?.logo_url || null;

  // Domain checks
  useEffect(() => {
    localStorage.setItem('preferred_portal', 'guest');

    // Host check: if on main domain or staff domain specifically requested
    const host = window.location.hostname.toLowerCase();
    if (host.includes('hcm.perfection.my') && !host.includes('hcm-guest') && !host.includes('hcm-staff')) {
      // If user came to hcm.perfection.my/#/guest-login, that is valid
    }

    // Auto login check if already has session
    const existing = guestAuth.getActiveSession();
    if (existing && existing.email && !existing.must_change_password) {
      navigate('/guest-portal');
      return;
    }

    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [navigate]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Complexity validation for new password
  const validation = validatePasswordComplexity(newPassword, confirmPassword);

  // --- ACTIONS ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await guestAuth.loginGuest(email, password);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      if (res.requiresPasswordChange) {
        toast('Mandatory first-time password update required.', {
          icon: '🔒',
          style: { borderRadius: '16px', background: '#0f172a', color: '#fff' }
        });
        setView('force_change');
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${res.account?.name || 'Member'}!`);
      navigate('/guest-portal');
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setError('Please fulfill all security requirements before proceeding.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await guestAuth.changeGuestPassword(email, newPassword);
      if (!res.success) {
        setError(res.error || 'Failed to update password.');
        return;
      }

      toast.success('Your permanent password has been established successfully!');
      navigate('/guest-portal');
    } catch (err: any) {
      setError(err?.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your registered email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await guestAuth.requestPasswordResetOtp(email);
      if (!res.success) {
        setError(res.error || 'Unable to request verification code.');
        return;
      }

      toast.success(res.message || 'Verification code sent to your email.');
      setResendCooldown(60);
      setView('forgot_otp');
    } catch (err: any) {
      setError(err?.message || 'Failed to request verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError('');
    setView('forgot_new_pass');
  };

  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setError('Please fulfill all security requirements before proceeding.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await guestAuth.verifyPasswordResetOtpAndSetPassword(email, otpCode, newPassword);
      if (!res.success) {
        setError(res.error || 'Invalid or expired verification code.');
        return;
      }

      toast.success('Password successfully reset! Welcome to your portal.');
      navigate('/guest-portal');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <GuestLoadingScreen propertyName={propertyName} logoUrl={logoUrl} message="Connecting to Guest Portal..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 selection:bg-indigo-500 selection:text-white">
      {/* Ambient Luxury Lighting */}
      <div className="absolute top-[-20%] right-[-10%] w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10 bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.45)] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        {/* Top Decorative Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-indigo-600 to-amber-400" />

        <div className="p-8 sm:p-10 space-y-6">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            {logoUrl ? (
              <div className="h-16 w-32 flex items-center justify-center mb-1">
                <img
                  src={logoUrl}
                  alt={propertyName}
                  className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-1">
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
            )}

            <div className="space-y-1">
              <span className="inline-block text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Member Mobile Portal
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {view === 'login' && 'Member Access'}
                {view === 'force_change' && 'Set Permanent Key'}
                {view === 'forgot_email' && 'Password Recovery'}
                {view === 'forgot_otp' && 'Enter 6-Digit OTP'}
                {view === 'forgot_new_pass' && 'Establish New Key'}
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {view === 'login' && 'Sign in with your registered email and access password.'}
                {view === 'force_change' && 'Please establish your permanent password to continue.'}
                {view === 'forgot_email' && 'Enter your account email to receive a verification code.'}
                {view === 'forgot_otp' && `Verification code sent to ${email}.`}
                {view === 'forgot_new_pass' && 'Create your new private password.'}
              </p>
            </div>
          </div>

          {/* VIEW: 1. STANDARD LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@domain.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Access Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setView('forgot_email');
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-in shake">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                isLoading={loading}
                className="w-full h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-[0.98]"
              >
                Access Guest Portal <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {/* VIEW: 2. MANDATORY FIRST-TIME PASSWORD CHANGE */}
          {view === 'force_change' && (
            <form onSubmit={handleForcePasswordChange} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold leading-relaxed">
                👋 First-time sign in detected! For your private security, please establish your permanent password.
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  New Permanent Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      validation.isMatch ? 'text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* LIVE PASSWORD COMPLEXITY CHECKER */}
              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={!validation.isValid || loading}
                isLoading={loading}
                className={`w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                  validation.isValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Save &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {/* VIEW: 3. FORGOT PASSWORD - EMAIL INPUT */}
          {view === 'forgot_email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@domain.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                isLoading={loading}
                className="w-full h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all"
              >
                Send 6-Digit Verification Code &rarr;
              </Button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setView('login');
                }}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 py-1"
              >
                &larr; Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: 4. FORGOT PASSWORD - 6-DIGIT OTP */}
          {view === 'forgot_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2 text-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Enter 6-Digit Security Code
                </label>
                <div className="relative flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-48 h-14 text-center text-2xl font-mono font-black tracking-[0.4em] rounded-2xl bg-slate-50 border-2 border-indigo-200 text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Code expires in 15 minutes. Check your spam folder if not received.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={otpCode.length !== 6}
                className="w-full h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all"
              >
                Verify Code &amp; Continue &rarr;
              </Button>

              <div className="flex justify-between items-center text-xs px-2">
                <button
                  type="button"
                  onClick={() => setView('forgot_email')}
                  className="font-bold text-slate-400 hover:text-slate-600"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleRequestOtp}
                  className={`font-bold ${
                    resendCooldown > 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-800'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 5. FORGOT PASSWORD - NEW PASSWORD & COMPLEXITY */}
          {view === 'forgot_new_pass' && (
            <form onSubmit={handleResetPasswordWithOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <CheckCircle2
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      validation.isMatch ? 'text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* LIVE PASSWORD COMPLEXITY CHECKER */}
              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={!validation.isValid || loading}
                isLoading={loading}
                className={`w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                  validation.isValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Reset &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {/* Portal Switcher Footer */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Need another portal?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const host = window.location.hostname.toLowerCase();
                  if (host.includes('perfection.my')) {
                    window.location.href = 'https://hcm-staff.perfection.my/#/staff-login';
                  } else {
                    navigate('/staff-login');
                  }
                }}
                className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Staff Portal
              </button>
              <span className="text-slate-300">&bull;</span>
              <button
                onClick={() => {
                  const host = window.location.hostname.toLowerCase();
                  if (host.includes('perfection.my')) {
                    window.location.href = 'https://hcm.perfection.my/#/login';
                  } else {
                    navigate('/login');
                  }
                }}
                className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Admin Management
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
