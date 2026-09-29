import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestAuth, DEFAULT_GUEST_PORTAL_SETTINGS } from '../services/guestAuthService';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { GuestPortalSettings } from '../types';
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
  ArrowLeft,
  Smartphone,
  Phone,
  ExternalLink,
  AlertTriangle,
  Power
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

  // Master System App Name from Settings Page
  const fullAppName = settings?.name || 'Perfection Health Club & Spa';

  const [dynamicPropertyName, setDynamicPropertyName] = useState(
    currentProperty?.name || settings?.name || 'Luxury Health Club & Spa'
  );
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState<string | null>(
    currentProperty?.logo_url || settings?.logo_url || null
  );

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

  // Portal Online/Offline & Preferences State from Database
  const [portalSettings, setPortalSettings] = useState<GuestPortalSettings>(DEFAULT_GUEST_PORTAL_SETTINGS);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchPortalSettings = useCallback(async (scopeId?: string) => {
    try {
      const activeScope = scopeId || currentProperty?.id;
      const ps = await guestAuth.getPortalSettings(activeScope);
      setPortalSettings(ps);
    } catch (e) {
      console.warn('Error reading portal settings:', e);
    }
  }, [currentProperty?.id]);

  useEffect(() => {
    fetchPortalSettings();
  }, [fetchPortalSettings]);

  // Sync settings and properties reactively when context updates
  useEffect(() => {
    if (currentProperty?.name) {
      setDynamicPropertyName(currentProperty.name);
    } else if (settings?.name) {
      setDynamicPropertyName(settings.name);
    }

    if (currentProperty?.logo_url) {
      setDynamicLogoUrl(currentProperty.logo_url);
    } else if (settings?.logo_url) {
      setDynamicLogoUrl(settings.logo_url);
    }
  }, [settings, currentProperty]);

  const handleEmailBlur = async () => {
    if (!email || !email.includes('@')) return;
    try {
      const account = await guestAuth.getAccountByEmail(email);
      if (account) {
        if (account.property_id || account.outlet_id) {
          fetchPortalSettings(account.outlet_id || account.property_id);
        }
        if (account.property_id) {
          const props = await db.getProperties().catch(() => []);
          const matchedProp = props.find((p: any) => p.id === account.property_id);
          if (matchedProp) {
            if (matchedProp.name) setDynamicPropertyName(matchedProp.name);
            if (matchedProp.logo_url) setDynamicLogoUrl(matchedProp.logo_url);
          }
        }
      }
    } catch (e) {
      console.warn('Could not load property branding by email:', e);
    }
  };

  const handleRecheckStatus = async () => {
    setCheckingStatus(true);
    try {
      await fetchPortalSettings();
      toast.success('Portal status verified from database.');
    } catch (e) {
      toast.error('Unable to verify portal status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('preferred_portal', 'guest');

    const host = window.location.hostname.toLowerCase();
    if ((host.includes('hcm.perfection.my') || host.includes('hcm-staff.perfection.my')) && !host.includes('hcm-guest')) {
      window.location.href = 'https://hcm-guest.perfection.my/#/guest-login';
      return;
    }

    const existing = guestAuth.getActiveSession();
    if (existing && existing.email && !existing.must_change_password) {
      navigate('/guest-portal');
      return;
    }

    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1200);

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

  if (initialLoading) {
    return (
      <GuestLoadingScreen
        propertyName={dynamicPropertyName}
        logoUrl={dynamicLogoUrl}
        message="Connecting to Guest Portal..."
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-slate-950 text-slate-100 selection:bg-indigo-500">
      {/* Background Soft Ambient Lights */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 bg-slate-900/90 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        {/* Left Hero Sidebar */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white relative overflow-hidden border-r border-white/10">
          <div className="absolute top-[-10%] right-[-5%] w-80 h-80 bg-amber-400/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            {/* Full App Name System Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 mb-10 shadow-sm">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.25em]">
                {fullAppName}
              </span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-black tracking-tighter leading-[0.95] mb-6 text-white uppercase">
              Guest<br />Portal<br />Access
            </h1>

            <p className="text-slate-300 text-sm xl:text-base font-medium max-w-sm leading-relaxed">
              Access your digital membership pass, touchless check-in QR code, PT tracking, and spa treatments.
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 space-y-1">
            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">
              {fullAppName}
            </p>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Perfection. All Rights Reserved.
            </p>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="flex flex-col justify-center p-6 sm:p-10 md:p-14 bg-slate-900/90 text-white relative">
          <div className="mb-8 flex flex-col items-center text-center">
            {dynamicLogoUrl ? (
              <img
                src={dynamicLogoUrl}
                alt="Logo"
                referrerPolicy="no-referrer"
                className="w-44 sm:w-52 h-auto object-contain mb-4 filter drop-shadow-lg max-h-24 sm:max-h-28 transition-all"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-indigo-600 to-indigo-800 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-4 border border-white/10">
                <Sparkles className="w-10 h-10 text-amber-300 animate-pulse" />
              </div>
            )}

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-1.5 uppercase leading-tight">
              {view === 'login' && dynamicPropertyName}
              {view === 'force_change' && 'Establish Password'}
              {view === 'forgot_email' && 'Password Recovery'}
              {view === 'forgot_otp' && 'Verify Security PIN'}
              {view === 'forgot_new_pass' && 'Reset Password'}
            </h2>

            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-white/10"></div>
              <p className="text-amber-400 text-[9px] font-black uppercase tracking-[0.25em] whitespace-nowrap">
                {view === 'login' && 'Guest Secure Sign In'}
                {view === 'force_change' && 'First-Time Security Directive'}
                {view === 'forgot_email' && 'Enter Account Email'}
                {view === 'forgot_otp' && '6-Digit Code Verification'}
                {view === 'forgot_new_pass' && 'Secure Key Generation'}
              </p>
              <div className="h-px w-8 bg-white/10"></div>
            </div>
          </div>

          {/* VIEW: 1. STANDARD LOGIN (OR NICE OFFLINE CONCIERGE MESSAGE IF PORTAL IS DISABLED) */}
          {view === 'login' && (
            <>
              {portalSettings && !portalSettings.is_enabled ? (
                /* OFFLINE PORTAL NOTICE WITH LUXURY GUEST CONCIERGE MESSAGE */
                <div className="space-y-6 max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-500 text-center">
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-amber-500/30 shadow-2xl relative overflow-hidden text-left space-y-4">
                    {/* Ambient Glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest">
                        <Power className="w-3 h-3 text-amber-400 animate-pulse" /> Portal Status: Offline
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {dynamicPropertyName}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">
                        Concierge Notice
                      </h3>
                      <p className="text-slate-300 text-sm font-medium leading-relaxed">
                        {portalSettings.welcome_message ||
                          'Our digital guest portal is currently offline for scheduled concierge maintenance. Please visit our front desk reception or contact us directly below.'}
                      </p>
                    </div>

                    {/* CONTACT RECEPTION BAR */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Front Desk &amp; Concierge Assistance
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {portalSettings.support_phone && (
                          <a
                            href={`tel:${portalSettings.support_phone}`}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 rounded-xl flex items-center gap-2.5 transition-all group"
                          >
                            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                              <Phone className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="text-[8px] font-black uppercase text-slate-400 block">Call Front Desk</span>
                              <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                                {portalSettings.support_phone}
                              </span>
                            </div>
                          </a>
                        )}

                        {portalSettings.support_email && (
                          <a
                            href={`mailto:${portalSettings.support_email}`}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 rounded-xl flex items-center gap-2.5 transition-all group"
                          >
                            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                              <Mail className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="text-[8px] font-black uppercase text-slate-400 block">Email Concierge</span>
                              <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors truncate block">
                                {portalSettings.support_email}
                              </span>
                            </div>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      onClick={handleRecheckStatus}
                      isLoading={checkingStatus}
                      className="w-full sm:w-auto h-11 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${checkingStatus ? 'animate-spin' : ''}`} />
                      Check Portal Status
                    </Button>
                  </div>
                </div>
              ) : (
                /* ONLINE STANDARD LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-sm mx-auto w-full">
                  {/* Nice Welcome Concierge Banner when Online */}
                  {portalSettings.welcome_message && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-indigo-200/90 font-medium leading-relaxed">
                        {portalSettings.welcome_message}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Registered Email Address
                    </label>
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
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Private Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setView('forgot_email');
                        }}
                        className="text-[9px] font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center gap-3 animate-in shake duration-300">
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
                        Sign In to Portal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* VIEW: 2. FORCE PASSWORD CHANGE */}
          {view === 'force_change' && (
            <form onSubmit={handleForcePasswordChange} className="space-y-4 max-w-sm mx-auto w-full animate-in slide-in-from-right-10 duration-500">
              <div className="bg-indigo-950/60 border border-indigo-500/30 p-3.5 rounded-xl">
                <p className="text-indigo-200 text-xs font-medium leading-relaxed">
                  First-time access detected. Please replace your temporary password with your permanent private key.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Permanent Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showNewPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CheckCircle2 className={`w-4 h-4 ${validation.isMatch ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={!validation.isValid || loading} 
                  isLoading={loading}
                  className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${validation.isValid ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                >
                  Update &amp; Enter Portal <ShieldCheck className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* VIEW: 3. FORGOT PASSWORD EMAIL */}
          {view === 'forgot_email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4 max-w-sm mx-auto w-full animate-in slide-in-from-right-10 duration-500">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="guest@resort.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm" 
                    required 
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  isLoading={loading}
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30"
                >
                  Send Verification Code &rarr;
                </Button>
              </div>

              <button 
                type="button" 
                onClick={() => { setError(''); setView('login'); }}
                className="w-full text-center text-xs font-bold text-amber-400 hover:text-amber-300 py-1 transition-colors"
              >
                &larr; Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: 4. FORGOT PASSWORD OTP */}
          {view === 'forgot_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 max-w-sm mx-auto w-full text-center animate-in slide-in-from-right-10 duration-500">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enter 6-Digit Verification PIN</label>
                <div className="flex justify-center">
                  <input 
                    type="text" 
                    maxLength={6}
                    value={otpCode} 
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-48 h-14 text-center text-2xl font-mono font-black tracking-[0.4em] rounded-2xl bg-slate-950 border-2 border-indigo-500/40 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/40 shadow-inner" 
                    autoFocus
                    required 
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Verification code expires in 15 minutes.</p>
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center justify-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={otpCode.length !== 6}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30"
              >
                Verify Code &rarr;
              </Button>

              <div className="flex justify-between items-center text-xs px-2 pt-2">
                <button type="button" onClick={() => setView('forgot_email')} className="font-bold text-slate-400 hover:text-white transition-colors">
                  Change Email
                </button>
                <button 
                  type="button" 
                  disabled={resendCooldown > 0} 
                  onClick={handleRequestOtp}
                  className={`font-bold ${resendCooldown > 0 ? 'text-slate-600' : 'text-amber-400 hover:text-amber-300 transition-colors'}`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 5. FORGOT PASSWORD NEW PASS */}
          {view === 'forgot_new_pass' && (
            <form onSubmit={handleResetPasswordWithOtp} className="space-y-4 max-w-sm mx-auto w-full animate-in slide-in-from-right-10 duration-500">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showNewPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CheckCircle2 className={`w-4 h-4 ${validation.isMatch ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm" 
                    required 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={!validation.isValid || loading} 
                  isLoading={loading}
                  className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${validation.isValid ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
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
