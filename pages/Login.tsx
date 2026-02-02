
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Card, CardContent } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Activity, ShieldCheck, User, Info } from 'lucide-react';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    let err: string | null = null;
    if (isSignUp) {
        err = await register(email, password, name);
    } else {
        err = await login(email, password);
    }
    
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
           <div className="inline-flex p-5 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl border border-white/20 shadow-2xl mb-8 relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[2.6rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
               {settings?.logo_url ? (
                   <img 
                     src={settings.logo_url} 
                     alt="Company Logo" 
                     className="h-14 w-auto object-contain relative z-10" 
                   />
               ) : (
                   <Activity className="w-12 h-12 text-indigo-400 relative z-10" />
               )}
           </div>
           <h1 className="text-4xl font-black text-white tracking-tighter mb-3">
             {settings?.name || 'Membership System'}
           </h1>
           <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-indigo-500/30"></span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
                {isSignUp ? 'New Account Provisioning' : 'Resilience Framework'}
              </p>
              <span className="h-px w-8 bg-indigo-500/30"></span>
           </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          <Card className="border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-3xl overflow-visible rounded-[2rem]">
            <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {isSignUp && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Full Name</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <User className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                placeholder="Your Name"
                                className="w-full h-14 pl-14 pr-5 rounded-2xl bg-slate-950/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-slate-950/60 transition-all text-base font-medium"
                                required={isSignUp}
                            />
                        </div>
                    </div>
                )}

                {/* Email Input Field */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Identity</label>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Security Key</label>
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
                      {isSignUp ? 'Create Admin Account' : 'Sign in'} <ArrowRight className="w-5 h-5" />
                    </span>
                  </Button>
                </div>

                <div className="text-center">
                    <button 
                        type="button" 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
                    >
                        {isSignUp ? 'Back to sign in' : 'First time? Setup Admin account'}
                    </button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-6">
               <button className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-[0.2em]">Documentation</button>
               <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
               <button className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-[0.2em]">Support</button>
               <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
               <button className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-[0.2em]">Terms</button>
            </div>
            <p className="text-slate-600 text-[10px] font-bold tracking-[0.3em] uppercase">
              &copy; {new Date().getFullYear()} Membership System &bull; v2.8.4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
