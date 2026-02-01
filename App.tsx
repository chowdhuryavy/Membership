
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate, Outlet as RouterOutlet } from 'react-router-dom';
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
// Fix: Added missing UserCircle import from lucide-react
import { LayoutDashboard, Users, Tag, BarChart3, LogOut, Menu, X, Shield, Settings, Store, ChevronDown, History, UserCircle } from 'lucide-react';

const ProtectedLayout = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading Nexus OS...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          <RouterOutlet />
        </main>
      </div>
    </div>
  );
};

const OutletSwitcher = () => {
    const { user } = useAuth();
    const { outlets, currentOutlet, setCurrentOutlet } = useSettings();

    const allowedOutlets = useMemo(() => outlets.filter(o => 
        user?.allowed_outlets?.includes(o.id)
    ), [outlets, user]);

    useEffect(() => {
        if (allowedOutlets.length > 0) {
            const isAllowed = currentOutlet && allowedOutlets.find(o => o.id === currentOutlet.id);
            if (!currentOutlet || !isAllowed) {
                setCurrentOutlet(allowedOutlets[0]);
            }
        }
    }, [allowedOutlets, currentOutlet, setCurrentOutlet]);

    if (allowedOutlets.length === 0) return (
        <div className="px-6 pb-4 text-xs text-red-500">No outlets assigned.</div>
    );

    return (
        <div className="px-3 pb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase ml-2 mb-1 block">
                Current Outlet
            </label>
            <div className="relative">
                <select 
                    className="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-900 text-sm rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-default"
                    value={currentOutlet?.id || ''}
                    onChange={(e) => {
                        const found = allowedOutlets.find(o => o.id === e.target.value);
                        if(found) setCurrentOutlet(found);
                    }}
                    disabled={allowedOutlets.length === 1}
                >
                    {allowedOutlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
};

const Sidebar = () => {
    const { user, logout } = useAuth();
    const { settings, hasPermission } = useSettings();
    const location = useLocation();

    const NavItem = ({ to, icon: Icon, label }: any) => {
        const isActive = location.pathname === to;
        return (
            <Link 
                to={to} 
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
                <Icon className="w-5 h-5 mr-3" />
                {label}
            </Link>
        );
    };

    const canManageMembers = user && hasPermission(user.role_id, 'manage_members');
    const canManageCats = user && hasPermission(user.role_id, 'manage_categories');
    const canManageUsers = user && hasPermission(user.role_id, 'manage_users');
    const canManageSettings = user && hasPermission(user.role_id, 'manage_settings');
    const canViewReports = user && hasPermission(user.role_id, 'view_reports');
    const canViewLogs = user && hasPermission(user.role_id, 'view_logs');

    return (
        <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 h-screen sticky top-0 print:hidden">
            <div className="p-6">
                <div className="flex items-center gap-2">
                    {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="w-8 h-8 object-contain" />}
                    <h1 className="text-lg font-bold text-indigo-600 truncate">
                        {settings?.name || 'Nexus OS'}
                    </h1>
                </div>
            </div>
            
            <OutletSwitcher />
            
            <nav className="flex-1 space-y-1 px-3 mt-2">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                {canManageMembers && <NavItem to="/members" icon={Users} label="Members" />}
                {canManageCats && <NavItem to="/categories" icon={Tag} label="Categories" />}
                {canManageUsers && <NavItem to="/users" icon={Shield} label="Users" />}
                {canViewReports && <NavItem to="/reports" icon={BarChart3} label="Reports" />}
                {canViewLogs && <NavItem to="/logs" icon={History} label="Logs" />}
                {canManageSettings && <NavItem to="/settings" icon={Settings} label="Settings" />}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <Link to="/profile" className="flex items-center mb-4 px-2 hover:bg-slate-50 rounded p-1 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold group-hover:bg-indigo-200">
                        {user?.name.charAt(0)}
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-slate-700">{user?.name}</p>
                        <p className="text-xs text-slate-500">View Profile</p>
                    </div>
                </Link>
                <button 
                    onClick={logout}
                    className="flex w-full items-center px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};

const MobileHeader = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const { settings, outlets, currentOutlet, setCurrentOutlet, hasPermission } = useSettings();

    const allowedOutlets = useMemo(() => outlets.filter(o => 
        user?.allowed_outlets?.includes(o.id)
    ), [outlets, user]);

    const canManageMembers = user && hasPermission(user.role_id, 'manage_members');
    const canManageCats = user && hasPermission(user.role_id, 'manage_categories');
    const canManageUsers = user && hasPermission(user.role_id, 'manage_users');
    const canManageSettings = user && hasPermission(user.role_id, 'manage_settings');
    const canViewReports = user && hasPermission(user.role_id, 'view_reports');
    const canViewLogs = user && hasPermission(user.role_id, 'view_logs');

    return (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex flex-col sticky top-0 z-50 print:hidden">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2">
                     {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain" />}
                     <h1 className="font-bold text-indigo-600">{settings?.name || 'Nexus OS'}</h1>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600">
                    {isOpen ? <X /> : <Menu />}
                </button>
            </div>

            {allowedOutlets.length > 0 && (
                <div className="mt-3 pb-1 border-b border-slate-100">
                     <div className="relative">
                        <select 
                            className="w-full appearance-none bg-slate-50 text-sm p-2 rounded border border-slate-200 text-slate-900 font-medium disabled:opacity-75 pr-8"
                            value={currentOutlet?.id || ''}
                            onChange={(e) => {
                                const found = allowedOutlets.find(o => o.id === e.target.value);
                                if(found) setCurrentOutlet(found);
                            }}
                            disabled={allowedOutlets.length === 1}
                        >
                            {allowedOutlets.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <ChevronDown className="h-4 w-4" />
                        </div>
                     </div>
                </div>
            )}

            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-xl p-4 flex flex-col gap-2 z-50">
                    <Link to="/" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    {canManageMembers && (
                        <Link to="/members" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <Users className="w-4 h-4" /> Members
                        </Link>
                    )}
                    {canManageCats && (
                        <Link to="/categories" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <Tag className="w-4 h-4" /> Categories
                        </Link>
                    )}
                    {canManageUsers && (
                        <Link to="/users" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Users
                        </Link>
                    )}
                    {canViewReports && (
                        <Link to="/reports" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" /> Reports
                        </Link>
                    )}
                    {canViewLogs && (
                        <Link to="/logs" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <History className="w-4 h-4" /> Logs
                        </Link>
                    )}
                    {canManageSettings && (
                        <Link to="/settings" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Settings
                        </Link>
                    )}
                    <div className="h-px bg-slate-100 my-2" />
                    <Link to="/profile" onClick={() => setIsOpen(false)} className="p-3 text-slate-900 hover:bg-slate-50 rounded font-medium flex items-center gap-2">
                        <UserCircle className="w-4 h-4" /> Profile
                    </Link>
                    <button onClick={logout} className="p-3 text-left text-red-600 hover:bg-red-50 rounded font-medium flex items-center gap-2">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
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
