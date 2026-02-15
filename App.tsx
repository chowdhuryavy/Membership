
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import MassageScheduling from './massage-scheduling/MassageScheduling'; 
import Sales from './pages/Sales'; 
import { 
  LayoutDashboard, 
  Users, 
  Tag, 
  BarChart3, 
  LogOut, 
  Menu, 
  Shield, 
  Settings, 
  Building2, 
  Check, 
  ChevronsUpDown, 
  Info, 
  CalendarClock, 
  ShoppingBag,
  UserCircle,
  ChevronDown,
  History
} from 'lucide-react';
import { Permission, Property } from './types';

// Default logo for The Torch Collection to ensure brand continuity during initial load
const BRAND_FALLBACK_LOGO = "https://fqwfffkkaeknaqjorygy.supabase.co/storage/v1/object/public/logos/al_aziziyah_logo.png";

// Shared navigation metadata used across the app layout and settings
const NAV_METADATA = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'bookings', label: 'Booking', icon: CalendarClock },
    { id: 'sales', label: 'Sales & Retail', icon: ShoppingBag },
    { id: 'categories', label: 'Membership Tiers', icon: Tag },
    { id: 'users', label: 'Users & Security', icon: Shield },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    { id: 'logs', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'System Settings', icon: Settings },
];

// Fix: Complete implementation of SplashLoading component
const SplashLoading = () => {
  const { settings } = useSettings();
  const logoToUse = settings?.logo_url || BRAND_FALLBACK_LOGO;
  
  return (
    <div className="fixed inset-0 z-[100000] bg-white flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.04)_0%,_transparent_60%)] animate-[pulse_6s_ease-in-out_infinite]"></div>
      </div>

      <div className="relative flex flex-col items-center justify-center">
        <div className="relative w-80 h-80 flex items-center justify-center scale-75 md:scale-100">
          <div className="absolute inset-0 border-[0.5px] border-indigo-50/10 rounded-full"></div>
          <div className="absolute inset-10 border-[0.5px] border-indigo-400/20 rounded-full"></div>
          <div className="absolute inset-20 border-[0.5px] border-indigo-300/30 rounded-full"></div>
          
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite]">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-indigo-500 rounded-full blur-[1px] shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
          </div>
          <div className="absolute inset-8 animate-[spin_8s_linear_infinite_reverse]">
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-400 rounded-full opacity-60"></div>
          </div>

          <div className="relative z-10 w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-600/5 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-24 h-24 p-4 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center border border-slate-100/50 animate-in zoom-in-50 duration-700">
                   <img 
                      src={logoToUse} 
                      alt="Brand Logo" 
                      className="w-full h-full object-contain filter drop-shadow-[0_5px_10px_rgba(0,0,0,0.05)]" 
                    />
                </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 opacity-0 animate-[fade-in_1.5s_ease-out_forwards_0.5s]">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Initializing Core Sync</span>
            <div className="flex gap-1.5">
              <div className="w-1 h-1 bg-indigo-600 rounded-full animate-[pulse_1s_infinite]"></div>
              <div className="w-1 h-1 bg-indigo-400 rounded-full animate-[pulse_1s_infinite_0.2s]"></div>
              <div className="w-1 h-1 bg-indigo-200 rounded-full animate-[pulse_1s_infinite_0.4s]"></div>
            </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 0.6; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// Fix: Complete implementation of PortfolioSelector component
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
                <div className="absolute top-full right-0 md:left-0 min-w-[280px] mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] z-[100] overflow-hidden">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Available Facilities</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-4">
                        {groupedData.map(group => (
                            <div key={group.property.id} className="space-y-1">
                                <div className="px-3 py-1 flex items-center gap-2">
                                    <Building2 className="w-3 h-3 text-slate-300" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{group.property.name}</span>
                                </div>
                                <div className="space-y-0.5">
                                    {group.outlets.map(o => (
                                        <button 
                                            key={o.id} 
                                            onClick={() => { setCurrentOutlet(o); setIsOpen(false); }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${currentOutlet?.id === o.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >
                                            <span className="text-xs font-bold truncate">{o.name}</span>
                                            {currentOutlet?.id === o.id && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Fix: Implemented PrivateRoute helper for route protection
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) return <SplashLoading />;
    return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Fix: Implemented AppLayout component with sidebar and top navigation
const AppLayout = () => {
    const { user, logout } = useAuth();
    const { settings, currentOutlet, hasPermission } = useSettings();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navOrder = settings?.navigation_order || NAV_METADATA.map(m => m.id);
    
    const menuItems = useMemo(() => {
        return navOrder.map(id => {
            const meta = NAV_METADATA.find(m => m.id === id);
            if (!meta) return null;
            
            let permission: Permission | null = null;
            if (id === 'dashboard') permission = 'dashboard:view';
            if (id === 'members') permission = 'members:view';
            if (id === 'categories') permission = 'categories:view';
            if (id === 'users') permission = 'users:view';
            if (id === 'reports') permission = 'reports:view';
            if (id === 'logs') permission = 'logs:view';
            if (id === 'settings') permission = 'settings:view';
            if (id === 'bookings') permission = 'bookings:view';
            if (id === 'sales') permission = 'sales:view';

            if (permission && user && !hasPermission(user.role_id, permission)) return null;
            
            return {
                ...meta,
                path: id === 'dashboard' ? '/' : `/${id}`,
                isActive: id === 'dashboard' ? location.pathname === '/' : location.pathname.startsWith(`/${id}`)
            };
        }).filter(Boolean);
    }, [navOrder, user, location.pathname, hasPermission]);

    const logoUrl = settings?.logo_url || BRAND_FALLBACK_LOGO;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6">
                    <div className="flex items-center gap-4 mb-10 px-2">
                        <div className="w-12 h-12 p-2 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                             <img src={logoUrl} alt="Logo" className="w-full h-full object-contain filter invert brightness-0" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tighter leading-none">{settings?.name || 'PERFECTION'}</h2>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Management ERP</p>
                        </div>
                    </div>

                    <div className="mb-8 lg:hidden">
                        <PortfolioSelector isMobile />
                    </div>

                    <nav className="flex-1 space-y-1 custom-scrollbar overflow-y-auto">
                        {menuItems.map((item: any) => (
                            <Link 
                                key={item.id} 
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${item.isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${item.isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                                <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-slate-100">
                        <button 
                            onClick={logout}
                            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all group"
                        >
                            <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            <span className="text-xs font-black uppercase tracking-widest">Terminate Session</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl">
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden lg:block">
                            <PortfolioSelector />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative" ref={userDropdownRef}>
                            <button 
                                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl transition-all border ${isUserDropdownOpen ? 'bg-slate-100 border-slate-200' : 'bg-transparent border-transparent hover:bg-slate-50'}`}
                            >
                                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg shadow-slate-200">
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-xs font-black text-slate-900 leading-none">{user?.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role_id}</p>
                                </div>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isUserDropdownOpen && (
                                <div className="absolute top-full right-0 mt-3 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <Link to="/profile" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 transition-colors">
                                        <UserCircle className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-black uppercase tracking-widest">My Profile</span>
                                    </Link>
                                    <div className="h-px bg-slate-100 my-1 mx-2"></div>
                                    <button onClick={() => { logout(); setIsUserDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left">
                                        <LogOut className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-widest">Sign Out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 lg:p-10">
                    <RouterOutlet />
                </main>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)}></div>
            )}
        </div>
    );
};

// Fix: Final App component with routing configuration and default export
const App = () => {
    return (
        <AuthProvider>
            <SettingsProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                            <Route index element={<Dashboard />} />
                            <Route path="members" element={<Members />} />
                            <Route path="bookings" element={<MassageScheduling />} />
                            <Route path="sales" element={<Sales />} />
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
