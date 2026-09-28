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

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');

  const [dynamicPropertyName, setDynamicPropertyName] = useState(currentProperty?.name || settings?.name || 'Health Club Management');
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState(currentProperty?.logo_url || settings?.logo_url || null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

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

    const existing = guestAuth.getActiveSession();
    if (existing && existing.email && !existing.must_change_password) {
      navigate('/guest-portal');
      return;
    }

    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1500);

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

  if (initialLoading || loading) {
    return (
      <GuestLoadingScreen
        propertyName={dynamicPropertyName}
        logoUrl={dynamicLogoUrl}
        message={loading ? "Authenticating & Loading Your Privileges..." : "Connecting to Guest Portal..."}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 text-slate-100 selection:bg-indigo-500">
      
      {/* Background Soft Ambient Lights */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 bg-slate-900/90 rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        
        {/* Left Hero Sidebar */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white relative overflow-hidden border-r border-white/10">
          <div className="absolute top-[-10%] right-[-5%] w-80 h-80 bg-amber-400/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 mb-12">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.3em]">Guest Mobile Portal</span>
            </div>
            
            <h1 className="text-6xl font-black tracking-tighter leading-[0.9] mb-6 text-white">
              Member<br />Privileges
            </h1>
            
            <p className="text-slate-300 text-base font-medium max-w-sm leading-relaxed">
              Access your digital membership card, touchless check-in QR code, PT sessions, and spa treatments.
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  &copy; {new Date().getFullYear()} <span className="text-amber-300">Perfection</span>. All Rights Reserved.
              </p>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-slate-900/90 text-white relative">
          
          <div className="mb-8 flex flex-col items-center text-center">
             {dynamicLogoUrl ? (
               <img 
                src={dynamicLogoUrl} 
                alt="Logo" 
                referrerPolicy="no-referrer"
                className="w-32 h-auto object-contain mb-4 filter drop-shadow-md max-h-16" 
               />
             ) : (
               <div className="w-20 h-24 bg-gradient-to-tr from-indigo-600 to-indigo-800 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl mb-4 border border-white/10">
                <Sparkles className="w-10 h-10 text-amber-300" />
               </div>
             )}

            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-1 leading-tight uppercase">
              {view === 'login' && dynamicPropertyName}
              {view === 'force_change' && 'Establish Password'}
              {view === 'forgot_email' && 'Password Recovery'}
              {view === 'forgot_otp' && 'Verify Security PIN'}
              {view === 'forgot_new_pass' && 'Reset Password'}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-white/10"></div>
              <p className="text-amber-400 text-[9px] font-black uppercase tracking-[0.3em] whitespace-nowrap">
                {view === 'login' && 'Guest Secure Sign In'}
                {view === 'force_change' && 'First-Time Security Directive'}
                {view === 'forgot_email' && 'Enter Account Email'}
                {view === 'forgot_otp' && '6-Digit Code Verification'}
                {view === 'forgot_new_pass' && 'Secure Key Generation'}
              </p>
              <div className="h-px w-8 bg-white/10"></div>
            </div>
          </div>

          {/* VIEW: 1. STANDARD LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-sm mx-auto w-full">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="guest@resort.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1 mr-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setView('forgot_email'); }}
                    className="text-[9px] font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold p-3 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] group" 
                  isLoading={loading}
                >
                  <span className="flex items-center justify-center gap-2">
                    Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </div>
            </form>
          )}

          {/* VIEW: 2. FORCE PASSWORD CHANGE */}
          {view === 'force_change' && (
            <form onSubmit={handleForcePasswordChange} className="space-y-4 max-w-sm mx-auto w-full animate-in slide-in-from-right-10 duration-500">
              <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl">
                <p className="text-amber-800 text-xs font-bold leading-relaxed">
                  First-time access detected. Please replace your temporary password with your permanent private key.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Permanent Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-300" />
                  </div>
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showNewPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CheckCircle2 className={`w-4 h-4 ${validation.isMatch ? 'text-emerald-500' : 'text-slate-300'}`} />
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={!validation.isValid || loading} 
                  isLoading={loading}
                  className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${validation.isValid ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Update &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* VIEW: 3. FORGOT PASSWORD EMAIL */}
          {view === 'forgot_email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4 max-w-sm mx-auto w-full">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-300" />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="guest@resort.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold shadow-sm" 
                    required 
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  isLoading={loading}
                  className="w-full h-12 rounded-xl bg-[#1a237e] hover:bg-indigo-900 text-white font-black text-xs uppercase tracking-widest shadow-lg"
                >
                  Send Verification Code &rarr;
                </Button>
              </div>

              <button 
                type="button" 
                onClick={() => { setError(''); setView('login'); }}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
              >
                &larr; Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: 4. FORGOT PASSWORD OTP */}
          {view === 'forgot_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 max-w-sm mx-auto w-full text-center">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enter 6-Digit PIN</label>
                <div className="flex justify-center">
                  <input 
                    type="text" 
                    maxLength={6}
                    value={otpCode} 
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-48 h-14 text-center text-2xl font-mono font-black tracking-[0.4em] rounded-2xl bg-slate-50 border-2 border-indigo-200 text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10" 
                    autoFocus
                    required 
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Code expires in 15 minutes.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={otpCode.length !== 6}
                className="w-full h-12 rounded-xl bg-[#1a237e] hover:bg-indigo-900 text-white font-black text-xs uppercase tracking-widest shadow-lg"
              >
                Verify Code &rarr;
              </Button>

              <div className="flex justify-between items-center text-xs px-2 pt-2">
                <button type="button" onClick={() => setView('forgot_email')} className="font-bold text-slate-500 hover:text-slate-800">
                  Change Email
                </button>
                <button 
                  type="button" 
                  disabled={resendCooldown > 0} 
                  onClick={handleRequestOtp}
                  className={`font-bold ${resendCooldown > 0 ? 'text-slate-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 5. FORGOT PASSWORD NEW PASS */}
          {view === 'forgot_new_pass' && (
            <form onSubmit={handleResetPasswordWithOtp} className="space-y-4 max-w-sm mx-auto w-full">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-300" />
                  </div>
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showNewPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CheckCircle2 className={`w-4 h-4 ${validation.isMatch ? 'text-emerald-500' : 'text-slate-300'}`} />
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={!validation.isValid || loading} 
                  isLoading={loading}
                  className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${validation.isValid ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Reset &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
