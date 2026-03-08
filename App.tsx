import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation, 
  Navigate, 
  useNavigate,
  Outlet as RouterOutlet
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Categories from './pages/Categories';
import UsersPage from './pages/Users';
import StaffPage from './pages/Staff'; 
import Reports from './pages/Reports';
import Logs from './pages/Logs';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import MassageScheduling from './massage-scheduling/MassageScheduling'; 
import Sales from './pages/Sales'; 
import { 
  LayoutDashboard, 
  Users, 
  Tag, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  Shield, 
  Settings, 
  Store, 
  ChevronDown, 
  History, 
  UserCircle, 
  Activity, 
  Loader2, 
  Building2, 
  Check, 
  Globe, 
  ChevronsUpDown, 
  Bell, 
  Search, 
  Info, 
  Cpu, 
  Zap, 
  Radio, 
  Sparkles, 
  CalendarClock, 
  ShoppingBag,
  Contact2
} from 'lucide-react';
import { Permission, Property } from './types';
import { db } from './services/mockSupabase';
import UserActivityTracker from './components/UserActivityTracker';

const SplashLoading = () => {
  const { settings } = useSettings();
  
  return (
    <div className="fixed inset-0 z-[100000] bg-white flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.03)_0%,_transparent_50%)] animate-[pulse_6s_ease-in-out_infinite]"></div>
        <div className="absolute inset-0 opacity-[0.01]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1.5px, transparent 1.5px)', backgroundSize: '50px 50px' }}></div>
      </div>

      <div className="relative flex flex-col items-center justify-center">
        <div className="relative w-80 h-80 flex items-center justify-center">
          <div className="absolute inset-0 border-[0.5px] border-indigo-500/10 rounded-full animate-[radiate_4s_linear_infinite]"></div>
          <div className="absolute inset-10 border-[0.5px] border-indigo-400/20 rounded-full animate-[radiate_4s_linear_infinite_1.3s]"></div>
          <div className="absolute inset-20 border-[0.5px] border-indigo-300/30 rounded-full animate-[radiate_4s_linear_infinite_2.6s]"></div>
          
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite]">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full blur-[2px]"></div>
          </div>
          <div className="absolute inset-4 animate-[spin_8s_linear_infinite_reverse]">
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full opacity-50"></div>
          </div>

          <div className="relative z-10 w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-600/5 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-full h-full flex items-center justify-center animate-[helios_3s_linear_infinite]">
              {settings?.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(79,70,229,0.2)]" 
                />
              ) : (
                <div className="bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100">
                  <Sparkles className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 opacity-0 animate-[fade-in_1.5s_ease-out_forwards_0.5s]">
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-[pulse_1s_infinite]"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-[pulse_1s_infinite_0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-[pulse_1s_infinite_0.4s]"></div>
            </div>
        </div>
      </div>

      <style>{`
        @keyframes helios {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes radiate {
          0% { transform: scale(0.5); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 0.6; transform: translateY(0); }
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
        if (user.role_id?.toLowerCase() === 'admin') return outlets;
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

    const isAdmin = user?.role_id?.toLowerCase() === 'admin';

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
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[40] print:hidden shadow-sm">
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
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const { checkShortcut, isLoading: isSettingsLoading, currentOutlet } = useSettings();
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  const combinedLoading = isAuthLoading || isSettingsLoading;

  useEffect(() => {
    if (!combinedLoading) {
      const timer = setTimeout(() => setShowSplash(false), 2000); 
      return () => clearTimeout(timer);
    }
  }, [combinedLoading]);
  
  useEffect(() => {
    if (user && !combinedLoading) {
      db.syncAuthMetadata(user).catch(console.warn);
    }
  }, [user, combinedLoading]);

  const handleLogout = () => {
    db.logAction('AUTH_LOGOUT', `User terminated session: ${user?.name} (${user?.email}) at ${new Date().toLocaleString()}`, currentOutlet?.id);
    logout();
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
        if (checkShortcut(e, 'nav_dashboard')) {
            e.preventDefault();
            navigate('/');
        }
        if (checkShortcut(e, 'nav_members')) {
            e.preventDefault();
            navigate('/members');
        }
        if (checkShortcut(e, 'nav_settings')) {
            e.preventDefault();
            navigate('/settings');
        }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [checkShortcut, navigate]);

  if (showSplash) return <SplashLoading />;
  if (!user) return <Navigate to="/login" replace />;
  
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible">
      <Sidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 relative overflow-y-auto custom-scrollbar print:overflow-visible print:block">
        <TopHeader />
        <MobileHeader onLogout={handleLogout} />
        <main className="flex-1 p-4 md:p-8 print:p-0 print:overflow-visible print:block">
          <RouterOutlet />
        </main>
      </div>
    </div>
  );
};

const Sidebar = ({ onLogout }: { onLogout: () => void }) => {
    const { user } = useAuth();
    const { settings, hasPermission } = useSettings();
    const location = useLocation();

    const ALL_NAV_ITEMS = useMemo(() => [
        { id: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard:view' as Permission },
        { id: 'members', to: '/members', icon: Users, label: 'Members', permission: 'members:view' as Permission },
        { id: 'staff', to: '/staff', icon: Contact2, label: 'Staff Roster', permission: 'staff:view' as Permission },
        { id: 'bookings', to: '/bookings', icon: CalendarClock, label: 'Booking', permission: 'bookings:view' as Permission },
        { id: 'sales', to: '/sales', icon: ShoppingBag, label: 'Sales & Retail', permission: 'sales:view' as Permission },
        { id: 'categories', to: '/categories', icon: Tag, label: 'Membership Tiers', permission: 'categories:view' as Permission },
        { id: 'users', to: '/users', icon: Shield, label: 'Users & Security', permission: 'users:view' as Permission },
        { id: 'reports', to: '/reports', icon: BarChart3, label: 'Financial Reports', permission: 'reports:view' as Permission },
        { id: 'logs', to: '/logs', icon: History, label: 'Audit Logs', permission: 'logs:view' as Permission },
        { id: 'settings', to: '/settings', icon: Settings, label: 'System Settings', permission: 'settings:view' as Permission },
    ], []);

    const orderedNavItems = useMemo(() => {
        const order = settings?.navigation_order || [];
        const sortedItems = order
            .map(id => ALL_NAV_ITEMS.find(item => item.id === id))
            .filter((item): item is typeof ALL_NAV_ITEMS[0] => !!item);
        const missingItems = ALL_NAV_ITEMS.filter(item => !order.includes(item.id));
        return [...sortedItems, ...missingItems];
    }, [settings?.navigation_order, ALL_NAV_ITEMS]);

    const NavItem: React.FC<{ to: string, icon: any, label: string, permission?: Permission }> = ({ to, icon: Icon, label, permission }) => {
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
                            <Sparkles className="w-6 h-6" />
                        </div>
                    )}
                    <div className="overflow-hidden text-left">
                        <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-snug">
                            {settings?.name || 'System Identity'}
                        </h1>
                        <span className="block text-[9px] text-slate-400 uppercase tracking-[0.2em] font-black mt-1 whitespace-nowrap">
                            Designed by Perfection
                        </span>
                    </div>
                </div>
            </div>
            
            <nav className="flex-1 space-y-1.5 px-4 mt-4 overflow-y-auto custom-scrollbar pb-8">
                {orderedNavItems.map((item) => (
                    <NavItem key={item.id} to={item.to} icon={item.icon} label={item.label} permission={item.permission} />
                ))}
            </nav>

            <div className="p-6 border-t-2 border-slate-100 bg-slate-50/50 shrink-0">
                <button 
                    onClick={onLogout}
                    className="flex w-full items-center justify-center px-4 py-4 text-[11px] font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all border border-red-100 shadow-sm active:scale-95"
                >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

const MobileHeader = ({ onLogout }: { onLogout: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const { settings, hasPermission } = useSettings();
    const location = useLocation();

    const ALL_NAV_ITEMS = useMemo(() => [
        { id: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard:view' as Permission },
        { id: 'members', to: '/members', icon: Users, label: 'Members', permission: 'members:view' as Permission },
        { id: 'staff', to: '/staff', icon: Contact2, label: 'Staff Roster', permission: 'staff:view' as Permission },
        { id: 'bookings', to: '/bookings', icon: CalendarClock, label: 'Booking', permission: 'bookings:view' as Permission },
        { id: 'sales', to: '/sales', icon: ShoppingBag, label: 'Sales & Retail', permission: 'sales:view' as Permission },
        { id: 'categories', to: '/categories', icon: Tag, label: 'Membership Tiers', permission: 'categories:view' as Permission },
        { id: 'users', to: '/users', icon: Shield, label: 'Users & Security', permission: 'users:view' as Permission },
        { id: 'reports', to: '/reports', icon: BarChart3, label: 'Financial Reports', permission: 'reports:view' as Permission },
        { id: 'logs', to: '/logs', icon: History, label: 'Audit Logs', permission: 'logs:view' as Permission },
        { id: 'settings', to: '/settings', icon: Settings, label: 'System Settings', permission: 'settings:view' as Permission },
    ], []);

    const orderedNavItems = useMemo(() => {
        const order = settings?.navigation_order || [];
        const sortedItems = order
            .map(id => ALL_NAV_ITEMS.find(item => item.id === id))
            .filter((item): item is typeof ALL_NAV_ITEMS[0] => !!item);
        const missingItems = ALL_NAV_ITEMS.filter(item => !order.includes(item.id));
        return [...sortedItems, ...missingItems];
    }, [settings?.navigation_order, ALL_NAV_ITEMS]);

    const MobileNavItem: React.FC<{ to: string, icon: any, label: string, permission?: Permission }> = ({ to, icon: Icon, label, permission }) => {
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
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex flex-col sticky top-0 z-[50] print:hidden shadow-sm">
            <div className="flex justify-between items-center w-full mb-3">
                <div className="flex items-center gap-3">
                     {settings?.logo_url ? (
                         <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-lg p-1 overflow-hidden border border-slate-100">
                             <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                         </div>
                     ) : (
                         <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                             <Sparkles className="w-5 h-5" />
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
                    {orderedNavItems.map((item) => (
                        <MobileNavItem key={item.id} to={item.to} icon={item.icon} label={item.label} permission={item.permission} />
                    ))}
                    <div className="h-px bg-slate-100 my-4 shrink-0" />
                    <MobileNavItem to="/profile" icon={UserCircle} label="My Profile" />
                    <button onClick={onLogout} className="p-5 text-left text-red-600 bg-red-50 rounded-2xl font-black uppercase tracking-widest flex items-center gap-4 transition-colors shrink-0">
                        <LogOut className="w-5 h-5" /> Terminate Session
                    </button>
                    <div className="h-4 shrink-0" />
                </div>
            )}
        </div>
    );
};

import RetailStockReport from './pages/RetailStockReport';

const App = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <UserActivityTracker />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="members" element={<Members />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="bookings" element={<MassageScheduling />} />
                <Route path="sales" element={<Sales />} />
                <Route path="sales/stock-report" element={<RetailStockReport />} />
                <Route path="categories" element={<Categories />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="reports" element={<Reports />} />
                <Route path="logs" element={<Logs />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;