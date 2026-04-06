import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, ShieldAlert, CheckCircle2, UserCircle2 } from 'lucide-react';
import { db } from '../services/mockSupabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState<'email' | 'password' | 'new_password' | 'confirm_password' | null>(null);
  
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  const { login, changePassword } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
      setPasswordsMatch(newPassword !== '' && newPassword === confirmPassword);
  }, [newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error: err, requiresPasswordChange } = await login(email, password);
    setLoading(false);
    
    if (err) {
      setError(err);
    } else if (requiresPasswordChange) {
      setMustChangePassword(true);
    } else {
      const session = JSON.parse(sessionStorage.getItem('membership_session') || '{}');
      db.logAction('AUTH_LOGIN', `User session authenticated for: ${session.name || email} (${email.toLowerCase()}) at ${new Date().toLocaleString()}`);
      navigate('/');
    }
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!passwordsMatch) return;
      
      setLoading(true);
      setError('');
      try {
          await changePassword(password, newPassword);
          db.logAction('AUTH_SECURITY_UPDATE', `Credential migration completed for: ${email.toLowerCase()}`);
          setMustChangePassword(false);
          navigate('/');
      } catch (err: any) {
          setError(err.message || "Failed to update security credentials.");
      } finally {
          setLoading(false);
      }
  };

  const companyName = settings?.name || 'Health Club Management';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#fcfdfe] selection:bg-indigo-100">
      
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-50/50 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-50/30 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[3rem] shadow-[0_100px_200px_-50px_rgba(0,0,0,0.1)] border border-slate-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        
        <div className="hidden lg:flex flex-col justify-between p-12 bg-[#1a237e] text-white relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 mb-12">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em]">Authorized Access Terminal</span>
            </div>
            
            <h1 className="text-6xl font-black tracking-tighter leading-[0.9] mb-6" style={{ textShadow: '0 0 20px rgba(255, 255, 255, 0.1)' }}>
              {mustChangePassword ? 'Security\nUpgrade' : 'Core\nIdentity'}
            </h1>
            
            <p className="text-indigo-100/60 text-base font-medium max-w-sm leading-relaxed">
              {mustChangePassword 
                ? 'Your account requires a mandatory credential update to comply with corporate security protocols.' 
                : 'Professional asset logistics and membership intelligence for luxury hospitality portfolios.'}
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10">
              <p className="text-indigo-300/50 text-[10px] font-black uppercase tracking-widest">
                  &copy; {new Date().getFullYear()} Perfection. All Rights Reserved.
              </p>
          </div>
        </div>

        <div className="flex flex-col justify-start p-8 md:p-12 lg:p-16 pt-10 md:pt-16 bg-white relative">
          {/* Staff Portal Link Icon */}
          <button 
            type="button"
            onClick={() => navigate('/staff-login')}
            className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl border border-slate-100 transition-all group"
            title="Staff Portal"
          >
            <UserCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
          
          <div className="mb-6 flex flex-col items-center text-center">
             {settings?.logo_url ? (
               <img 
                src={settings.logo_url} 
                alt="Logo" 
                referrerPolicy="no-referrer"
                className="w-32 h-auto object-contain mb-4 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.05)]" 
               />
             ) : (
               <div className="w-24 h-24 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100 mb-4">
                <Sparkles className="w-12 h-12" />
               </div>
             )}

            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-tight">
              {mustChangePassword ? 'Set New Password' : companyName}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-slate-200"></div>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] whitespace-nowrap">
                {mustChangePassword ? 'Security Protocol' : 'Product of Perfection BD'}
              </p>
              <div className="h-px w-8 bg-slate-200"></div>
            </div>
          </div>

          {!mustChangePassword ? (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto w-full">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Access Email</label>
                <div className={`relative transition-all duration-300 ${isFocused === 'email' ? 'translate-x-1' : ''}`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className={`w-4 h-4 transition-colors ${isFocused === 'email' ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onFocus={() => setIsFocused('email')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="name@enterprise.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Secret Access Key</label>
                <div className={`relative transition-all duration-300 ${isFocused === 'password' ? 'translate-x-1' : ''}`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`w-4 h-4 transition-colors ${isFocused === 'password' ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onFocus={() => setIsFocused('password')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-[#1a237e] hover:bg-indigo-900 text-white font-black text-xs uppercase tracking-widest shadow-[0_15px_30px_-10px_rgba(26,35,126,0.3)] transition-all active:scale-[0.98] group" 
                  isLoading={loading}
                >
                  <span className="flex items-center justify-center gap-2">
                    Authenticate <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForcePasswordChange} className="space-y-5 max-w-sm mx-auto w-full animate-in slide-in-from-right-10 duration-500">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-4">
                <p className="text-amber-800 text-xs font-bold leading-relaxed">
                  First-time access detected. For your security, please update your temporary password.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Permanent Password</label>
                <div className={`relative transition-all duration-300 ${isFocused === 'new_password' ? 'translate-x-1' : ''}`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`w-4 h-4 transition-colors ${isFocused === 'new_password' ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                  <input type="password" value={newPassword} onFocus={() => setIsFocused('new_password')} onBlur={() => setIsFocused(null)} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm" required />
                </div>
              </div>

              <div className="space-y-1.5">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                    {confirmPassword !== '' && (
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                            {passwordsMatch ? 'Keys Match' : 'Keys Do Not Match'}
                        </span>
                    )}
                 </div>
                <div className={`relative transition-all duration-300 ${isFocused === 'confirm_password' ? 'translate-x-1' : ''}`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CheckCircle2 className={`w-4 h-4 transition-colors ${confirmPassword === '' ? 'text-slate-300' : passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`} />
                  </div>
                  <input type="password" value={confirmPassword} onFocus={() => setIsFocused('confirm_password')} onBlur={() => setIsFocused(null)} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold shadow-sm ${confirmPassword === '' ? 'border-slate-200' : passwordsMatch ? 'border-emerald-500' : 'border-red-500'}`} required />
                </div>
              </div>
              
              <div className="pt-2">
                <Button type="submit" disabled={!passwordsMatch || loading} className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] group ${passwordsMatch ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`} isLoading={loading}>
                  <span className="flex items-center justify-center gap-2">
                    Update Credentials <ShieldCheck className="w-4 h-4" />
                  </span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;