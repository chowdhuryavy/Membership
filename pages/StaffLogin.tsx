import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { LogIn, ShieldAlert, UserCircle2, ArrowRight, Sparkles, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../components/ui';

const StaffLogin = () => {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const staff = await db.loginStaff(employeeNumber, password);
      if (staff) {
        // Store staff session
        localStorage.setItem('staff_session', JSON.stringify(staff));
        navigate('/staff-schedule');
      } else {
        setError('Invalid employee number or password, or access denied.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const companyName = settings?.name || 'Health Club Management';

  useEffect(() => {
    localStorage.setItem('preferred_portal', 'staff');
    
    // Check for existing session and redirect if valid
    const sessionStr = localStorage.getItem('staff_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.id) {
          navigate('/staff-schedule');
        }
      } catch (e) {
        console.error("Invalid session found, clearing...");
        localStorage.removeItem('staff_session');
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#fcfdfe] selection:bg-indigo-100">
      
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-emerald-50/50 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-50/30 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[3rem] shadow-[0_100px_200px_-50px_rgba(0,0,0,0.1)] border border-slate-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        
        <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 z-0">
             <img 
               src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
               alt="Spa Background" 
               referrerPolicy="no-referrer"
               className="w-full h-full object-cover opacity-40 mix-blend-overlay" 
             />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
          </div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 mb-12">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.3em]">Staff Portal</span>
            </div>
            
            <h1 className="text-5xl font-black tracking-tighter leading-[1.1] mb-6" style={{ textShadow: '0 0 20px rgba(0, 0, 0, 0.5)' }}>
              Therapist<br/>Schedule<br/>Access
            </h1>
            
            <p className="text-slate-300 text-sm font-medium max-w-sm leading-relaxed">
              Securely access your daily appointments, manage your schedule, and view guest details.
            </p>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10">
              <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
                © 2026 <span className="text-white">Perfection</span>. All Rights Reserved.
              </p>
          </div>
        </div>

        <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-start pt-10 md:pt-16 bg-white relative">
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
              {companyName}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-slate-200"></div>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] whitespace-nowrap">
                Staff Authentication Portal
              </p>
              <div className="h-px w-8 bg-slate-200"></div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 max-w-sm mx-auto w-full">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in shake duration-300">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle2 className="w-5 h-5 text-slate-300" />
                  </div>
                  <input 
                    type="text" 
                    value={employeeNumber} 
                    onChange={e => setEmployeeNumber(e.target.value)} 
                    required 
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                    placeholder="e.g. EMP001"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-300" />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-[0.98] group" 
                isLoading={loading}
              >
                <span className="flex items-center justify-center gap-2">
                  Authenticate <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
