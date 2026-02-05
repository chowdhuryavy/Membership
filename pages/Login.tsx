import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Card, CardContent } from '../components/ui';
import * as ReactRouterDOM from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Activity, ShieldCheck } from 'lucide-react';

const { useNavigate } = ReactRouterDOM;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const err = await login(email, password);
    setLoading(false);
    
    if (err) {
      setError(err);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#0a0f1e]">
      {/* Immersive Background Layer */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full"></div>
      <div className="absolute inset-0 opacity-30 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

      <div className="w-full max-w-[460px] z-10">
        {/* Branding Section */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <div className="flex justify-center mb-8 relative group">
               {settings?.logo_url ? (
                   <img 
                     src={settings.logo_url} 
                     alt="Company Logo" 
                     className="w-56 h-auto object-contain relative z-10 transition-transform duration-500 hover:scale-105" 
                   />
               ) : (
                   <Activity className="w-24 h-24 text-indigo-400 relative z-10" />
               )}
           </div>
           <h1 className="text-4xl font-black text-white tracking-tighter mb-3">
             {settings?.name || 'Membership System'}
           </h1>
           <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-indigo-500/30"></span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
                Enterprise Access Portal
              </p>
              <span className="h-px w-8 bg-indigo-500/30"></span>
           </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          <Card className="border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-3xl overflow-visible rounded-[2rem]">
            <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Email Input Field */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Credential ID</label>
                  </div>
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input 
                          type="email" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          placeholder="name@company.com"
                          className="w-full h-14 pl-14 pr-5 rounded-2xl bg-slate-950/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-slate-950/60 transition-all text-base font-medium"
                          required
                      />
                  </div>
                </div>

                {/* Password Input Field */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Access Key</label>
                  </div>
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input 
                          type={showPassword ? "text" : "password"} 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          placeholder="••••••••"
                          className="w-full h-14 pl-14 pr-14 rounded-2xl bg-slate-950/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-slate-950/60 transition-all text-base font-medium"
                          required
                      />
                      <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white focus:outline-none transition-colors p-1"
                      >
                          {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                      </button>
                  </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                           <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">{error}</span>
                    </div>
                )}
                
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg shadow-[0_20px_40px_-12px_rgba(79,70,229,0.4)] transition-all transform hover:-translate-y-1 active:scale-[0.98] active:translate-y-0" 
                    isLoading={loading}
                  >
                    <span className="flex items-center justify-center gap-3 tracking-tight">
                      Authorize Access <ArrowRight className="w-5 h-5" />
                    </span>
                  </Button>
                </div>

                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-relaxed">
                        Notice: System monitoring is active.<br/>Authorized Personnel Only.
                    </p>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <div className="mt-10 flex flex-col items-center gap-4">
            <p className="text-slate-600 text-[10px] font-bold tracking-[0.3em] uppercase">
              &copy; {new Date().getFullYear()} Membership ERP &bull; Version 2.4.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;