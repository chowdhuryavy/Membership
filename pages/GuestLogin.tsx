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

  // Loading & Branding states
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');

  // Dynamic Property Branding per guest
  const [dynamicPropertyName, setDynamicPropertyName] = useState(currentProperty?.name || settings?.name || 'Luxury Health Club & Spa');
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState(currentProperty?.logo_url || settings?.logo_url || null);

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // First-time / Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password OTP state
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check email to dynamically load property branding
  const handleEmailBlur = async () => {
    if (!email || !email.includes('@')) return;
    try {
      const account = await guestAuth.getAccountByEmail(email);
      if (account && account.property_id) {
        const props = await db.getProperties().catch(() => []);
        const matchedProp = props.find((p: any) => p.id === account.property_id);
        if (matchedProp) {
          if (matchedProp.name) setDynamicPropertyName(matchedProp.name);
          if (matchedProp.logo_url) setDynamicLogoUrl(matchedProp.logo_url);
        }
      }
    } catch (e) {
      console.warn('Could not load property branding by email:', e);
    }
  };

  useEffect(() => {
    localStorage.setItem('preferred_portal', 'guest');

    // Auto login check if valid session exists
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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const validation = validatePasswordComplexity(newPassword, confirmPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check account property branding before finishing login
      const account = await guestAuth.getAccountByEmail(email);
      if (account && account.property_id) {
        const props = await db.getProperties().catch(() => []);
        const matchedProp = props.find((p: any) => p.id === account.property_id);
        if (matchedProp) {
          if (matchedProp.name) setDynamicPropertyName(matchedProp.name);
          if (matchedProp.logo_url) setDynamicLogoUrl(matchedProp.logo_url);
        }
      }

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
    return <GuestLoadingScreen propertyName={dynamicPropertyName} logoUrl={dynamicLogoUrl} message="Connecting to Guest Portal..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 selection:bg-amber-500 selection:text-slate-950">
      {/* 5-Star Resort Ambient Glows */}
      <div className="absolute top-[-25%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-600/20 to-amber-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[550px] h-[550px] bg-gradient-to-tr from-amber-600/10 to-indigo-900/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Glassmorphism Container */}
      <div className="w-full max-w-md z-10 bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] shadow-[0_30px_90px_rgba(0,0,0,0.6)] border border-white/15 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        {/* Luxury Gold/Indigo Accent Line */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-indigo-500 to-amber-400" />

        <div className="p-8 sm:p-12 space-y-7">
          {/* Dynamic Property Branding Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            {dynamicLogoUrl ? (
              <div className="h-20 w-36 flex items-center justify-center p-2 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
                <img
                  src={dynamicLogoUrl}
                  alt={dynamicPropertyName}
                  className="max-h-full max-w-full object-contain filter drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30">
                <Sparkles className="w-9 h-9 text-amber-200 animate-pulse" />
              </div>
            )}

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-[0.3em]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Member Portal
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase leading-tight">
                {view === 'login' && dynamicPropertyName}
                {view === 'force_change' && 'Security Upgrade'}
                {view === 'forgot_email' && 'Password Recovery'}
                {view === 'forgot_otp' && 'Security Code'}
                {view === 'forgot_new_pass' && 'New Password'}
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide max-w-xs mx-auto">
                {view === 'login' && 'Access your digital membership card, fitness packages, and spa reservations.'}
                {view === 'force_change' && 'Please establish your permanent private password to continue.'}
                {view === 'forgot_email' && 'Enter your registered email to receive a verification PIN.'}
                {view === 'forgot_otp' && `Enter the 6-digit code sent to ${email}.`}
                {view === 'forgot_new_pass' && 'Create a secure new password for your account.'}
              </p>
            </div>
          </div>

          {/* VIEW: 1. STANDARD LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="guest@resort.com"
                    className="w-full h-13 pl-11 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 text-sm font-bold transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Access Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setView('forgot_email');
                    }}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
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
                    className="w-full h-13 pl-11 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 text-sm font-bold transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3 animate-in shake">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                isLoading={loading}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]"
              >
                Sign In To Portal <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {/* VIEW: 2. MANDATORY FIRST-TIME PASSWORD CHANGE */}
          {view === 'force_change' && (
            <form onSubmit={handleForcePasswordChange} className="space-y-5">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs font-semibold leading-relaxed">
                🔐 First-time login detected. Please create your secure permanent password to unlock your guest privileges.
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-13 pl-11 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      validation.isMatch ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-13 pl-11 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={!validation.isValid || loading}
                isLoading={loading}
                className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                  validation.isValid
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                Save &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {/* VIEW: 3. FORGOT PASSWORD - EMAIL INPUT */}
          {view === 'forgot_email' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@resort.com"
                    className="w-full h-13 pl-11 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                isLoading={loading}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all"
              >
                Send Verification Code &rarr;
              </Button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setView('login');
                }}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-white py-1 transition-colors"
              >
                &larr; Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: 4. FORGOT PASSWORD - 6-DIGIT OTP */}
          {view === 'forgot_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Enter 6-Digit Verification PIN
                </label>
                <div className="relative flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-52 h-16 text-center text-3xl font-mono font-black tracking-[0.4em] rounded-2xl bg-white/5 border-2 border-indigo-500/50 text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-400"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Code expires in 15 minutes. Check your email inbox.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={otpCode.length !== 6}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all"
              >
                Verify Code &amp; Continue &rarr;
              </Button>

              <div className="flex justify-between items-center text-xs px-2">
                <button
                  type="button"
                  onClick={() => setView('forgot_email')}
                  className="font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleRequestOtp}
                  className={`font-bold transition-colors ${
                    resendCooldown > 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 5. FORGOT PASSWORD - NEW PASSWORD & COMPLEXITY */}
          {view === 'forgot_new_pass' && (
            <form onSubmit={handleResetPasswordWithOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-13 pl-11 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <CheckCircle2
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      validation.isMatch ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-13 pl-11 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={!validation.isValid || loading}
                isLoading={loading}
                className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                  validation.isValid
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 active:scale-[0.98]'
                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                Reset &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
