
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Input, Card, CardContent } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Activity, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { settings } = useSettings(); // Get dynamic company info
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simulate network delay for better UX feel
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const err = await login(email, password);
    setLoading(false);
    
    if (err) {
      setError(err);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100">
      <div className="w-full max-w-md">
        {/* Branding Section */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex justify-center mb-4">
               {settings?.logo_url ? (
                   <img 
                     src={settings.logo_url} 
                     alt="Company Logo" 
                     className="h-16 w-auto object-contain drop-shadow-md" 
                   />
               ) : (
                   <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                       <Activity className="w-8 h-8 text-white" />
                   </div>
               )}
           </div>
           <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
             {settings?.name || 'Nexus Membership OS'}
           </h1>
           <p className="text-slate-500 mt-2">Sign in to access your dashboard</p>
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email Input */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <Input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="name@company.com"
                        className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        required
                    />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
                <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <Input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                    </button>
                </div>
              </div>

              {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in-95">
                      <ShieldCheck className="w-4 h-4" />
                      {error}
                  </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-11 text-base shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all mt-2" 
                isLoading={loading}
              >
                Sign In <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
                    Demo Accounts
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => { setEmail('admin@nexus.com'); setPassword('password'); }}
                        className="text-xs bg-slate-50 hover:bg-slate-100 p-2 rounded border border-slate-200 text-slate-600 transition-colors"
                    >
                        <span className="font-bold block text-indigo-600">Admin</span>
                        admin@nexus.com
                    </button>
                    <button 
                         onClick={() => { setEmail('staff@nexus.com'); setPassword('password'); }}
                         className="text-xs bg-slate-50 hover:bg-slate-100 p-2 rounded border border-slate-200 text-slate-600 transition-colors"
                    >
                        <span className="font-bold block text-indigo-600">Staff</span>
                        staff@nexus.com
                    </button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
