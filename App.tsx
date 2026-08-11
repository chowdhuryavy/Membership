import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { 
  BrowserRouter as Router, 
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
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationBell } from './components/NotificationBell';
import { schedulerService } from './services/emailService';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import PTMembers from './pages/PTMembers';
import EntranceFee from './pages/EntranceFee';
import Categories from './pages/Categories';
import UsersPage from './pages/Users';
import StaffPage from './pages/Staff'; 
import StaffLogin from './pages/StaffLogin';
import StaffSchedule from './pages/StaffSchedule';
import Reports from './pages/Reports';
import Logs from './pages/Logs';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import NotificationsPage from './pages/Notifications';
import AttendanceCheckIn from './pages/AttendanceCheckIn';
import MassageScheduling from './massage-scheduling/MassageScheduling'; 
import Sales from './pages/Sales'; 
import { PublicMemberPass } from './pages/PublicMemberPass'; 
import { 
  LayoutDashboard, 
  Users, 
  QrCode,
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
  Contact2,
  Dumbbell,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Permission, Property } from './types';
import { db } from './services/mockSupabase';
import UserActivityTracker from './components/UserActivityTracker';
import TopLoader from './components/TopLoader';
import SplashLoading from './components/SplashLoading';

const PortfolioSelector = ({ isMobile = false }: { isMobile?: boolean }) => {
    const { user } = useAuth();
    const { outlets, userAllowedOutlets, properties, currentOutlet, setCurrentOutlet } = useSettings();
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

    const groupedData = useMemo(() => {
        const groups: { [key: string]: { property: Property; outlets: any[] } } = {};
        userAllowedOutlets.forEach(o => {
            const prop = properties.find(p => p.id === o.property_id);
            if (prop) {
                if (!groups[prop.id]) groups[prop.id] = { property: prop, outlets: [] };
                groups[prop.id].outlets.push(o);
            }
        });
        
        const sortedGroups = Object.values(groups).sort((a, b) => a.property.name.localeCompare(b.property.name));
        
        sortedGroups.forEach(group => {
            group.outlets.sort((a, b) => a.name.localeCompare(b.name));
        });
        
        return sortedGroups;
    }, [userAllowedOutlets, properties]);

    const currentProp = useMemo(() => 
        properties.find(p => p.id === currentOutlet?.property_id)
    , [currentOutlet, properties]);

    const isAdmin = user?.role_id?.toLowerCase() === 'admin';

    if (userAllowedOutlets.length === 0) return (
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
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100 overflow-hidden p-1 border border-slate-100 relative">
                    {(currentOutlet?.logo_url || currentProp?.logo_url) ? (
                        <img 
                            src={currentOutlet?.logo_url || currentProp?.logo_url || ''} 
                            alt="Logo" 
                            referrerPolicy="no-referrer" 
                            className="w-full h-full object-contain" 
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div className={`logo-fallback w-full h-full bg-indigo-600 items-center justify-center rounded-lg ${!(currentOutlet?.logo_url || currentProp?.logo_url) ? 'flex' : 'hidden'}`}>
                        <Building2 className="w-4 h-4 text-white" />
                    </div>
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
    const { roles } = useSettings();
    
    const roleName = useMemo(() => {
        if (!user?.role_id) return 'No Role';
        const role = roles.find(r => r.id === user.role_id);
        return role ? role.name : user.role_id;
    }, [user?.role_id, roles]);

    return (
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[100] print:hidden shadow-sm">
            <div className="flex items-center gap-4">
                <PortfolioSelector />
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-left">Portfolio</span>
                    <span className="text-sm font-black text-slate-900 leading-none text-left">Console</span>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <NotificationBell />
                <div className="h-8 w-px bg-slate-100 mx-2"></div>
                <Link to="/profile" className="flex items-center gap-3 p-1.5 pl-3 pr-1.5 hover:bg-slate-50 rounded-2xl transition-all group">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-900 tracking-tight leading-none mb-1">{user?.name}</span>
                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest leading-none">{roleName}</span>
                    </div>
                    <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black group-hover:scale-105 transition-transform text-xs">
                        {user?.name?.charAt(0)}
                    </div>
                </Link>
            </div>
        </header>
    );
};

const ProtectedLayout = ({ portalType }: { portalType: 'admin' | 'staff' }) => {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const location = useLocation();
  const { checkShortcut, isLoading: isSettingsLoading, currentOutlet, outlets, pageLoading } = useSettings();
  const [showSplash, setShowSplash] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const navigate = useNavigate();

  const hasStaffSession = !!localStorage.getItem('staff_session');
  const isAuthenticated = portalType === 'staff' ? (!!user || hasStaffSession) : !!user;

  const isInitialLoad = useRef(true);
  const splashPaths = useMemo(() => [
    '/', 
    '/members', 
    '/sales', 
    '/reports', 
    '/staff', 
    '/bookings', 
    '/categories', 
    '/users', 
    '/logs', 
    '/settings', 
    '/profile', 
    '/notifications'
  ], []);

  const isSplashPage = useMemo(() => {
    return splashPaths.some(path => 
      path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    );
  }, [location.pathname, splashPaths]);

  const isAppInitializing = isAuthLoading || isSettingsLoading;
  
  // Track route changes to reset initial load state for splash pages
  const lastPathname = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== lastPathname.current) {
      if (isSplashPage) {
        isInitialLoad.current = true;
      }
      lastPathname.current = location.pathname;
    }
  }, [location.pathname, isSplashPage, isAuthLoading, isSettingsLoading, user, outlets, currentOutlet, pageLoading]);

  // IMMEDIATELY show loading if we are on a splash page and haven't finished its first render
  // or if the component signal it's loading via pageLoading
  const combinedLoading = isAppInitializing || (isSplashPage && pageLoading);
  
  // Track if we've successfully finished initial boot at least once
  const initialBootFinished = useRef(false);
  useEffect(() => {
    if (!combinedLoading && !isAuthLoading) {
      initialBootFinished.current = true;
    }
  }, [combinedLoading, isAuthLoading]);

  useEffect(() => {
    if (!combinedLoading) {
      // Shorter delay for a snappier feel
      const timer = setTimeout(() => {
        setShowSplash(false);
        isInitialLoad.current = false;
      }, 500); 
      return () => clearTimeout(timer);
    } else {
      // Re-trigger splash if we are initializing or on a splash-enabled page
      // but ONLY if we haven't finished the initial boot, to avoid getting stuck during reactive updates
      if (isAuthLoading || (isInitialLoad.current && isSplashPage)) {
        setShowSplash(true);
      }
    }
  }, [combinedLoading, isSplashPage, isAuthLoading]);
  
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
        if (checkShortcut(e, 'nav_checkin')) {
            e.preventDefault();
            navigate('/checkin');
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

  if (!isAuthenticated && !combinedLoading) {
    const loginPath = portalType === 'staff' ? '/staff-login' : '/login';
    if (location.pathname === '/' || location.pathname === loginPath) {
        return portalType === 'staff' ? <StaffLogin /> : <Login />;
    }
    return <Navigate to={loginPath} replace />;
  }
  
  return (
    <>
      {!showSplash && <TopLoader />}
      {showSplash && <SplashLoading />}
      {isAuthenticated && (
        <div className={`flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible transition-opacity duration-1000 ${showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <Sidebar onLogout={handleLogout} isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          <div className="flex-1 flex flex-col min-w-0 relative overflow-y-auto custom-scrollbar print:overflow-visible print:block">
            <TopHeader />
            <MobileHeader onLogout={handleLogout} />
            <main className="flex-1 p-4 md:p-8 print:p-0 print:overflow-visible print:block">
              <RouterOutlet />
            </main>
          </div>
        </div>
      )}
    </>
  );
};

const Sidebar = ({ onLogout, isCollapsed, onToggle }: { onLogout: () => void, isCollapsed: boolean, onToggle: () => void }) => {
    const { user } = useAuth();
    const { settings, hasPermission, currentOutlet } = useSettings();
    const location = useLocation();

    const ALL_NAV_ITEMS = useMemo(() => {
        const items = [
            { id: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard:view' as Permission },
            { id: 'checkin', to: '/checkin', icon: QrCode, label: 'Facility Check-In', permission: 'checkin:view' as Permission },
            { id: 'members', to: '/members', icon: Users, label: 'Members', permission: 'members:view' as Permission },
            { id: 'pt-members', to: '/pt-members', icon: Dumbbell, label: 'PT Members', permission: 'members:view' as Permission },
            { id: 'entrance-fee', to: '/entrance-fee', icon: Ticket, label: 'Entrance Fee', permission: 'sales:view' as Permission },
            { id: 'staff', to: '/staff', icon: Contact2, label: 'Staff Roster', permission: 'staff:view' as Permission },
            { id: 'bookings', to: '/bookings', icon: CalendarClock, label: 'Booking', permission: 'bookings:view' as Permission },
            { id: 'sales', to: '/sales', icon: ShoppingBag, label: 'Sales & Retail', permission: 'sales:view' as Permission },
            { id: 'categories', to: '/categories', icon: Tag, label: 'Membership Tiers', permission: 'categories:view' as Permission },
            { id: 'users', to: '/users', icon: Shield, label: 'Users & Roles', permission: 'users:view' as Permission },
            { id: 'reports', to: '/reports', icon: BarChart3, label: 'Financial Reports', permission: 'reports:view' as Permission },
            { id: 'logs', to: '/logs', icon: History, label: 'Audit Logs', permission: 'logs:view' as Permission },
            { id: 'settings', to: '/settings', icon: Settings, label: 'System Settings', permission: 'settings:view' as Permission },
        ];
        if (currentOutlet && currentOutlet.booking_enabled === false) {
            return items.filter(item => item.id !== 'bookings');
        }
        return items;
    }, [currentOutlet]);

    const orderedNavItems = useMemo(() => {
        const rawOrder = settings?.navigation_order || [];
        const order = [...rawOrder];
        if (order.length > 0 && !order.includes('entrance-fee')) {
            const ptIndex = order.indexOf('pt-members');
            const salesIndex = order.indexOf('sales');
            const insertPos = ptIndex !== -1 ? ptIndex + 1 : (salesIndex !== -1 ? salesIndex + 1 : order.length);
            order.splice(insertPos, 0, 'entrance-fee');
        }
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
                className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-5'} py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${
                    isActive 
                    ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200/50' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 group/nav'
                }`}
                title={isCollapsed ? label : ""}
            >
                <motion.div
                    whileHover={{ scale: 1.2, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ 
                        scale: isActive ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 400, damping: 10 },
                        rotate: { type: "spring", stiffness: 400, damping: 10 }
                    }}
                    className={`${isCollapsed ? 'mr-0' : 'mr-4'}`}
                >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover/nav:text-indigo-600'}`} />
                </motion.div>
                {!isCollapsed && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                    >
                        {label}
                    </motion.span>
                )}
            </Link>
        );
    };

    return (
        <aside className={`hidden md:flex ${isCollapsed ? 'w-24' : 'w-72'} flex-col bg-white border-r border-slate-200 h-screen sticky top-0 print:hidden shrink-0 shadow-sm overflow-hidden transition-all duration-300 ease-in-out`}>
            <div className={`p-8 shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
                <button 
                    onClick={onToggle}
                    className="flex items-center gap-4 group/logo transition-all active:scale-95 outline-none"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <div className={`w-14 h-14 flex items-center justify-center shrink-0 transition-all duration-500 group-hover/logo:scale-110 relative`}>
                        {settings?.logo_url ? (
                             <img 
                                src={settings.logo_url} 
                                alt="Logo" 
                                referrerPolicy="no-referrer" 
                                className="w-full h-full object-contain drop-shadow-md animate-[spin_10s_linear_infinite]" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                             />
                        ) : null}
                        <div className={`logo-fallback w-full h-full bg-indigo-600 rounded-2xl items-center justify-center text-white shadow-xl shadow-indigo-100 ${settings?.logo_url ? 'hidden' : 'flex'}`}>
                            <Sparkles className="w-7 h-7 animate-[spin_10s_linear_infinite]" />
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden text-left transition-all duration-300 group-hover/logo:translate-x-1">
                            <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-snug">
                                {settings?.name || 'System Identity'}
                            </h1>
                            <span className="block text-[9px] text-slate-400 uppercase tracking-[0.2em] font-black mt-1 whitespace-nowrap">
                                Designed by Perfection
                            </span>
                        </div>
                    )}
                </button>
            </div>
            
            <nav className={`flex-1 space-y-1.5 ${isCollapsed ? 'px-4' : 'px-4'} mt-4 overflow-y-auto custom-scrollbar pb-8`}>
                {orderedNavItems.map((item) => (
                    <NavItem key={item.id} to={item.to} icon={item.icon} label={item.label} permission={item.permission} />
                ))}
            </nav>

            <div className={`p-6 border-t-2 border-slate-100 bg-slate-50/50 shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
                <button 
                    onClick={onLogout}
                    className={`flex ${isCollapsed ? 'w-12 h-12 p-0' : 'w-full px-4 py-4'} items-center justify-center text-[11px] font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all border border-red-100 shadow-sm active:scale-95`}
                    title={isCollapsed ? "Logout" : ""}
                >
                    <LogOut className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
};

const MobileHeader = ({ onLogout }: { onLogout: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const { settings, hasPermission, currentOutlet } = useSettings();
    const location = useLocation();

    const ALL_NAV_ITEMS = useMemo(() => {
        const items = [
            { id: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard:view' as Permission },
            { id: 'checkin', to: '/checkin', icon: QrCode, label: 'Facility Check-In', permission: 'checkin:view' as Permission },
            { id: 'members', to: '/members', icon: Users, label: 'Members', permission: 'members:view' as Permission },
            { id: 'pt-members', to: '/pt-members', icon: Dumbbell, label: 'PT Members', permission: 'members:view' as Permission },
            { id: 'entrance-fee', to: '/entrance-fee', icon: Ticket, label: 'Entrance Fee', permission: 'sales:view' as Permission },
            { id: 'staff', to: '/staff', icon: Contact2, label: 'Staff Roster', permission: 'staff:view' as Permission },
            { id: 'bookings', to: '/bookings', icon: CalendarClock, label: 'Booking', permission: 'bookings:view' as Permission },
            { id: 'sales', to: '/sales', icon: ShoppingBag, label: 'Sales & Retail', permission: 'sales:view' as Permission },
            { id: 'categories', to: '/categories', icon: Tag, label: 'Membership Tiers', permission: 'categories:view' as Permission },
            { id: 'users', to: '/users', icon: Shield, label: 'Users & Roles', permission: 'users:view' as Permission },
            { id: 'reports', to: '/reports', icon: BarChart3, label: 'Financial Reports', permission: 'reports:view' as Permission },
            { id: 'logs', to: '/logs', icon: History, label: 'Audit Logs', permission: 'logs:view' as Permission },
            { id: 'settings', to: '/settings', icon: Settings, label: 'System Settings', permission: 'settings:view' as Permission },
        ];
        if (currentOutlet && currentOutlet.booking_enabled === false) {
            return items.filter(item => item.id !== 'bookings');
        }
        return items;
    }, [currentOutlet]);

    const orderedNavItems = useMemo(() => {
        const rawOrder = settings?.navigation_order || [];
        const order = [...rawOrder];
        if (order.length > 0 && !order.includes('entrance-fee')) {
            const ptIndex = order.indexOf('pt-members');
            const salesIndex = order.indexOf('sales');
            const insertPos = ptIndex !== -1 ? ptIndex + 1 : (salesIndex !== -1 ? salesIndex + 1 : order.length);
            order.splice(insertPos, 0, 'entrance-fee');
        }
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
                    isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-900 hover:bg-slate-50 group/mobile-nav'
                }`}
            >
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover/mobile-nav:text-indigo-600'}`} />
                </motion.div>
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex flex-col sticky top-0 z-[100] print:hidden shadow-sm">
            <div className="flex justify-between items-center w-full mb-3">
                <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-lg p-1 overflow-hidden border border-slate-100 transition-transform duration-500 relative`}>
                         {settings?.logo_url ? (
                             <img 
                                src={settings.logo_url} 
                                alt="Logo" 
                                referrerPolicy="no-referrer" 
                                className="w-full h-full object-contain animate-[spin_15s_linear_infinite]" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                             />
                         ) : null}
                         <div className={`logo-fallback w-full h-full bg-indigo-600 rounded-lg items-center justify-center text-white ${settings?.logo_url ? 'hidden' : 'flex'}`}>
                             <Sparkles className="w-5 h-5 animate-[spin_15s_linear_infinite]" />
                         </div>
                     </div>
                     <div className="flex flex-col text-left">
                        <h1 className="font-black text-slate-900 tracking-tighter max-w-[150px] leading-tight">
                            {settings?.name || 'Identity Sync'}
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Corporate Solution</span>
                            <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                            <span className="text-[7px] font-black text-indigo-600 uppercase tracking-widest">Console</span>
                        </div>
                     </div>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 p-3 bg-slate-50 rounded-xl transition-colors border border-slate-100">
                        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', height: '100vh', zIndex: 9999, position: 'relative' }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    // @ts-expect-error React types issue
    return this.props.children;
  }
}

const DynamicHead = ({ portalType }: { portalType: 'admin' | 'staff' }) => {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings) {
      if (settings.name) {
        document.title = `${settings.name} | Console`;
      }
      
      const logoUrl = settings.logo_url;
      const isExternalLogo = logoUrl && logoUrl.startsWith('http');
      const isVercelLegacy = isExternalLogo && (logoUrl.includes('vercel.app') || logoUrl.includes('health-club-management'));
      
      // Only apply external logos if they are not from the legacy vercel domain
      // and appear to be valid. Otherwise fallback to local icons.
      if (isExternalLogo && !isVercelLegacy) {
        const setLink = (rel: string, extraProps?: Record<string, string>) => {
          let link = document.querySelector(`link[rel~='${rel}']`) as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = rel;
            document.head.appendChild(link);
          }
          link.href = logoUrl.endsWith('/') ? `${logoUrl}favicon.png?v=pwa-v10` : `${logoUrl}?v=pwa-v10`;
          if (extraProps) {
            Object.entries(extraProps).forEach(([key, val]) => link.setAttribute(key, val));
          }
        };

        setLink('icon');
        setLink('shortcut icon');
        setLink('apple-touch-icon');
        setLink('apple-touch-icon-precomposed');
        setLink('mask-icon', { color: '#4f46e5' });
      } else {
        // Explicitly reset to branded icons if settings logo is problematic or missing
        const resetLink = (rel: string, targetHref: string) => {
          let link = document.querySelector(`link[rel~='${rel}']`) as HTMLLinkElement;
          if (link) {
            link.href = targetHref;
          }
        };
        const brandedIcon = 'https://i.imgur.com/oZVRrvo.png';
        resetLink('icon', brandedIcon);
        resetLink('shortcut icon', brandedIcon);
        resetLink('apple-touch-icon', brandedIcon);
      }

      // Set theme color for mobile browser bars
      let meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = '#4f46e5';
    }
  }, [settings]);

  // Dynamic PWA Manifest based on current view (Staff vs Admin)
  useEffect(() => {
    if (!settings) return;

    const isStaff = portalType === 'staff';
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    
    if (manifestLink) {
      // Use static manifest files for iPhone compatibility
      const manifestPath = isStaff ? '/manifest-staff.json' : '/manifest.json';
      manifestLink.setAttribute('href', window.location.origin + manifestPath);
    }

    // Update iOS-specific meta tags dynamically
    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const portalName = isStaff ? "Staff Portal" : (settings.name || "Health Club");
    updateMeta('apple-mobile-web-app-title', portalName);
    updateMeta('application-name', portalName);
  }, [settings, portalType]);

  return null;
};

const SecurityConsoleLog = () => {
  const { isSuperAdmin, isLoading } = useAuth();
  
  useEffect(() => {
      if (isLoading) return;

      if (!isSuperAdmin) {
          const timer = setTimeout(() => {
              console.clear();
              
              if (!(window as any)._originalConsoleLog) {
                  (window as any)._originalConsoleLog = console.log;
                  (window as any)._originalConsoleInfo = console.info;
                  (window as any)._originalConsoleWarn = console.warn;
                  (window as any)._originalConsoleError = console.error;
                  (window as any)._originalConsoleDebug = console.debug;
              }

              const _log = (window as any)._originalConsoleLog;
              
              _log(
                  "%cStop!",
                  "color: red; font-family: sans-serif; font-size: 50px; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;"
              );
              _log(
                  "%cThe developer console is for advanced users only. Pasting or typing code here can cause security issues.\nIf someone instructs you to paste code here, it may be a scam.",
                  "font-family: sans-serif; font-size: 16px; font-weight: bold; color: #333;"
              );

              console.log = () => {};
              console.info = () => {};
              console.warn = () => {};
              console.error = () => {};
              console.debug = () => {};
          }, 1500);
          return () => clearTimeout(timer);
      } else {
          if ((window as any)._originalConsoleLog) {
              console.log = (window as any)._originalConsoleLog;
              console.info = (window as any)._originalConsoleInfo;
              console.warn = (window as any)._originalConsoleWarn;
              console.error = (window as any)._originalConsoleError;
              console.debug = (window as any)._originalConsoleDebug;
          }
      }
  }, [isSuperAdmin, isLoading]);
  
  return null;
};

const App = () => {
  const [portalType] = useState<'admin' | 'staff'>(() => {
    const hostname = window.location.hostname;
    return hostname.includes('hcm-staff') ? 'staff' : 'admin';
  });

  // Scheduler effect
  useEffect(() => {
    schedulerService.processScheduledReports();
    const interval = setInterval(() => {
      schedulerService.processScheduledReports();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ErrorBoundary>
      <DynamicHead portalType={portalType} />
      <SecurityConsoleLog />
      <Toaster position="top-right" />
      <UserActivityTracker />
      <Router>
        <Routes>
          {/* Staff Portal Routes */}
          {portalType === 'staff' ? (
            <>
              <Route path="/" element={<StaffLogin />} />
              <Route path="/staff-login" element={<StaffLogin />} />
              <Route element={<ProtectedLayout portalType="staff" />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="checkin" element={<AttendanceCheckIn />} />
                <Route path="bookings" element={<MassageScheduling />} />
                <Route path="staff-schedule" element={<StaffSchedule />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // Admin Portal Routes
            <>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/pass" element={<PublicMemberPass />} />
              <Route element={<ProtectedLayout portalType="admin" />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="checkin" element={<AttendanceCheckIn />} />
                <Route path="members" element={<Members />} />
                <Route path="pt-members" element={<PTMembers />} />
                <Route path="entrance-fee" element={<EntranceFee />} />
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
                <Route path="notifications" element={<NotificationsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;