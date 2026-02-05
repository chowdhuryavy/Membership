

import React, { useState, useEffect, useMemo, useRef } from 'react';
// Fix: Use named imports for react-router-dom components as per v6.
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation, 
  Navigate, 
  Outlet as RouterOutlet 
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Categories from './pages/Categories';
import UsersPage from './pages/Users';
import Reports from './pages/Reports';
import Logs from './pages/Logs';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import { LayoutDashboard, Users, Tag, BarChart3, LogOut, Menu, X, Shield, Settings, Store, ChevronDown, History, UserCircle, Activity, Loader2, Building2, Check, Globe, ChevronsUpDown, Bell, Search, Info } from 'lucide-react';
import { Permission, Property } from './types';
import { db } from './services/mockSupabase';

const SplashLoading = () => {
  const { settings } = useSettings();
  const displayTitle = (settings && settings.name) ? settings.name : "The Torch Hospitality";
  
  return (
    <div className="fixed inset-0 z-[100000] bg-[#020617] flex flex-col items-center justify-center overflow-hidden selection:bg-indigo-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[70vw] h-[70vw] bg-indigo-600/10 rounded-full blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[70vw] h-[70vw] bg-blue-600/10 rounded-full blur-[100px] animate-[pulse_10s_ease-in-out_infinite_reverse]" />
          <div className="absolute inset-0 opacity-[0.03]" 
               style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_100%)]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Central Core Animation */}
        <div className="relative w-48 h-48 flex items-center justify-center mb-12">
            {/* Rotating Rings */}
            <div className="absolute inset-0 rounded-full border border-indigo-500/10 animate-[spin_12s_linear_infinite]"></div>
            <div className="absolute inset-0 rounded-full border-t border-indigo-400/40 animate-[spin_12s_linear_infinite]"></div>
            
            <div className="absolute inset-4 rounded-full border border-white/5 animate-[spin_15s_linear_infinite_reverse]"></div>
            <div className="absolute inset-4 rounded-full border-b border-indigo-300/30 animate-[spin_15s_linear_infinite_reverse]"></div>

            {/* Glowing Core */}
            <div className="absolute inset-12 bg-indigo-500/10 blur-xl rounded-full animate-pulse"></div>
            
            <div className="relative w-24 h-24 bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-white/10 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(79,70,229,0.3)] overflow-hidden group">
                 {/* Shiny Swipe Effect */}
                 <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] skew-x-12"></div>
                 
                 {settings?.logo_url ? (
                    <img src={settings.logo_url} alt="Logo" className="w-14 h-14 object-contain relative z-10" />
                 ) : (
                    <Globe className="w-12 h-12 text-indigo-400 relative z-10" />
                 )}
            </div>
        </div>

        {/* Typography */}
        <div className="text-center space-y-4 z-10">
           <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tighter uppercase animate-in fade-in slide-in-from-bottom-4 duration-700">
             {displayTitle}
           </h2>
           
           <div className="flex items-center justify-center gap-3 animate-in fade-in zoom-in duration-700 delay-150">
              <div className="flex gap-1">
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></span>
              </div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">
                System Handshake
              </span>
           </div>
        </div>
      </div>
      
      {/* Custom Styles for Shimmer */}
      <style>{`
        @keyframes shimmer {
          100% { left: 200%; }
        }
      `}</style>
    </div>
  );
};

const PortfolioSelector = ({ isMobile = false }: { isMobile?: boolean }) => {
    const { user } = useAuth();
    const { outlets, properties, currentOutlet, setCurrentOutlet } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allowedOutlets = useMemo(() => {
        if (!user) return [];
        // ADMIN OVERRIDE: Admins always see all outlets, fixing "No Access Scopes"
        if (user.role_id === 'admin') return outlets;
        return outlets.filter(o => user.allowed_outlets?.includes(o.id));
    }, [outlets, user]);

    const groupedData = useMemo(() => {
        const groups: { [key: string]: { property: Property; outlets: any[] } } = {};
        allowedOutlets.forEach(o => {
            const prop = properties.find(p => p.id === o.property_id);
            if (prop) {
                if (!groups[prop.id]) groups[prop.id] = { property: prop, outlets: [] };
                groups[prop.id].outlets.push(o);
            }
        });
        return Object.values(groups);
    }, [allowedOutlets, properties]);

    const currentProp = useMemo(() => 
        properties.find(p => p.id === currentOutlet?.property_id)
    , [currentOutlet, properties]);

    const isAdmin = user?.role_id === 'admin';

    if (allowedOutlets.length === 0) return (
        <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 ${isAdmin ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
            {isAdmin ? <Info className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span className="text-[9px] font-black uppercase tracking-widest">
                {isAdmin ? 'System Boot (No Facilities Found)' : 'Restricted Access'}
            </span>
        </div>
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-4 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] ${isOpen ? 'ring-2 ring-indigo-500/10 border-indigo-500/50' : ''}`}
            >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100">
                    <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col items-start overflow-hidden pr-2 text-left">
                    <span className="text-[9px] font-black tracking-widest truncate w-full uppercase text-slate-400 leading-none mb-1">
                        {currentProp?.name || 'Facility Scope'}
                    </span>
                    <span className="text-xs font-black text-slate-900 truncate w-full leading-none">
                        {currentOutlet?.name || 'Select Outlet'}
                    </span>
                </div>
                <ChevronsUpDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 md:left-0 min-w-[280px] mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Facilities</span>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-3 space-y-4">
                        {groupedData.map(group => (
                            <div key={group.property.id} className="space-y-1">
                                <div className="px-3 py-1 flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">{group.property.name}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {group.outlets.map(o => {
                                        const isSelected = currentOutlet?.id === o.id;
                                        return (
                                            <button
                                                key={o.id}
                                                onClick={() => {
                                                    setCurrentOutlet(o);
                                                    setIsOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                                            >
                                                <span className="text-xs font-black tracking-tight">{o.name}</span>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const TopHeader = () => {
    const { user } = useAuth();
    return (
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
            <div className="flex items-center gap-4">
                <PortfolioSelector />
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-left">Portfolio</span>
                    <span className="text-sm font-black text-slate-900 leading-none text-left">Management Console</span>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div className="h-8 w-px bg-slate-100 mx-2"></div>
                <Link to="/profile" className="flex items-center gap-3 p-1.5 pl-3 pr-1.5 hover:bg-slate-50 rounded-2xl transition-all group">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-900 tracking-tight leading-none mb-1">{user?.name}</span>
                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest leading-none">{user?.role_id}</span>
                    </div>
                    <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black group-hover:scale-105 transition-transform text-xs">
                        {user?.name?.charAt(0)}
                    </div>
                </Link>
            </div>
        </header>
    );
};

const ProtectedLayout = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isSettingsLoading } = useSettings();
  const [showSplash, setShowSplash] = useState(true);

  const combinedLoading = isAuthLoading || isSettingsLoading;

  useEffect(() => {
    if (!combinedLoading) {
      const timer = setTimeout(() => setShowSplash(false), 800);
      return () => clearTimeout(timer);
    }
  }, [combinedLoading]);
  
  // PERSISTENT METADATA SYNC
  // Ensures that Supabase Auth Dashboard is updated with the profile name whenever the user is active
  useEffect(() => {
    if (user && !combinedLoading) {
      db.syncAuthMetadata(user).catch(console.warn);
    }
  }, [user, combinedLoading]);

  if (showSplash) return <SplashLoading />;
  if (!user) return <Navigate to="/login" replace />;
  
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader />
        <MobileHeader />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:overflow-visible custom-scrollbar">
          <RouterOutlet />
        </main>
      </div>
    </div>
  );
};

const Sidebar = () => {
    const { user, logout } = useAuth();
    const { settings, hasPermission } = useSettings();
    const location = useLocation();

    const NavItem = ({ to, icon: Icon, label, permission }: { to: string, icon: any, label: string, permission?: Permission }) => {
        if (permission && user && !hasPermission(user.role_id, permission)) return null;
        
        const isActive = location.pathname === to;
        return (
            <Link 
                to={to} 
                className={`flex items-center px-5 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${
                    isActive 
                    ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200/50' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
                <Icon className={`w-5 h-5 mr-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {label}
            </Link>
        );
    };

    return (
        <aside className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 h-screen sticky top-0 print:hidden shrink-0 shadow-sm overflow-hidden">
            <div className="p-8 shrink-0">
                <div className="flex items-center gap-4">
                    {settings?.logo_url ? (
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-slate-100 p-2 overflow-hidden border border-slate-100">
                             <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <Globe className="w-6 h-6" />
                        </div>
                    )}
                    <div className="overflow-hidden text-left">
                        <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-snug">
                            {settings?.name || 'System Identity'}
                        </h1>
                        <span className="block text-[9px] text-slate-400 uppercase tracking-[0.2em] font-black mt-1 whitespace-nowrap">
                            Corporate Solution
                        </span>
                    </div>
                </div>
            </div>
            
            <nav className="flex-1 space-y-1.5 px-4 mt-4 overflow-y-auto custom-scrollbar pb-8">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/members" icon={Users} label="Members" permission="members:view" />
                <NavItem to="/categories" icon={Tag} label="Membership Tiers" permission="categories:view" />
                <NavItem to="/users" icon={Shield} label="Users & Security" permission="users:view" />
                <NavItem to="/reports" icon={BarChart3} label="Financial Reports" permission="reports:view" />
                <NavItem to="/logs" icon={History} label="Audit Logs" permission="logs:view" />
                <NavItem to="/settings" icon={Settings} label="System Settings" permission="settings:view" />
            </nav>

            <div className="p-6 border-t-2 border-slate-100 bg-slate-50/50 shrink-0">
                <button 
                    onClick={logout}
                    className="flex w-full items-center justify-center px-4 py-4 text-[11px] font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all border border-red-100 shadow-sm active:scale-95"
                >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

const MobileHeader = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const { settings, hasPermission } = useSettings();
    const location = useLocation();

    const MobileNavItem = ({ to, icon: Icon, label, permission }: { to: string, icon: any, label: string, permission?: Permission }) => {
        if (permission && user && !hasPermission(user.role_id, permission)) return null;
        const isActive = location.pathname === to;
        return (
            <Link 
                to={to} 
                onClick={() => setIsOpen(false)} 
                className={`p-5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-4 transition-colors ${
                    isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} /> {label}
            </Link>
        );
    };

    return (
        <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex flex-col sticky top-0 z-50 print:hidden shadow-sm">
            <div className="flex justify-between items-center w-full mb-3">
                <div className="flex items-center gap-3">
                     {settings?.logo_url ? (
                         <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-lg p-1 overflow-hidden border border-slate-100">
                             <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                         </div>
                     ) : (
                         <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                             <Globe className="w-5 h-5" />
                         </div>
                     )}
                     <div className="flex flex-col text-left">
                        <h1 className="font-black text-slate-900 tracking-tighter max-w-[150px] leading-tight">
                            {settings?.name || 'Identity Sync'}
                        </h1>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Corporate Solution</span>
                     </div>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 p-3 bg-slate-50 rounded-xl transition-colors border border-slate-100">
                    {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            <PortfolioSelector isMobile />

            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl p-6 flex flex-col gap-2 z-50 animate-in slide-in-from-top-4 duration-300 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
                    <MobileNavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                    <MobileNavItem to="/members" icon={Users} label="Members" permission="members:view" />
                    <MobileNavItem to="/categories" icon={Tag} label="Membership Tiers" permission="categories:view" />
                    <MobileNavItem to="/users" icon={Shield} label="Users & Security" permission="users:view" />
                    <MobileNavItem to="/reports" icon={BarChart3} label="Financial Reports" permission="reports:view" />
                    <MobileNavItem to="/logs" icon={History} label="Audit Logs" permission="logs:view" />
                    <MobileNavItem to="/settings" icon={Settings} label="System Settings" permission="settings:view" />
                    <div className="h-px bg-slate-100 my-4 shrink-0" />
                    <MobileNavItem to="/profile" icon={UserCircle} label="My Profile" />
                    <button onClick={logout} className="p-5 text-left text-red-600 bg-red-50 rounded-2xl font-black uppercase tracking-widest flex items-center gap-4 transition-colors shrink-0">
                        <LogOut className="w-5 h-5" /> Terminate Session
                    </button>
                    <div className="h-4 shrink-0" />
                </div>
            )}
        </div>
    );
};

const App = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
