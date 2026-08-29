import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';
import { getDeviceSessionItem, setDeviceSessionItem, removeDeviceSessionItem, isMobileDevice } from '../services/deviceStorage';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';

export const isSuperAdminRole = (roleId: string | undefined | null) => {
    const id = roleId?.toLowerCase()?.trim();
    return id === 'super_admin' || 
           id === 'superadmin' || 
           id === 'owner' ||
           id === 'admin' || 
           id === 'system_admin' || 
           id === 'system_administrator' ||
           id === 'administrator';
};

export const isOwnerRole = (roleId: string | undefined | null) => {
    return isSuperAdminRole(roleId);
};

export const isSuperAdmin = (user: UserProfile | null) => {
    if (!user) return false;
    return isSuperAdminRole(user.role_id);
};

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ error: string | null, requiresPasswordChange: boolean }>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: (reason?: string) => void;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  checkIsSuperAdmin: () => Promise<boolean>;
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (minutes: number) => void;
  resetInactivityTimer: () => void;
  showInactivityWarning: boolean;
  dismissInactivityWarning: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getStoredSessionStr = () => {
      return getDeviceSessionItem('membership_session');
  };

  const saveSession = (userData: UserProfile) => {
      const str = JSON.stringify(userData);
      setDeviceSessionItem('membership_session', str);
      if (isSuperAdminRole(userData.role_id)) {
          setDeviceSessionItem('admin_session_active', 'true');
      }
  };

  const clearSession = () => {
      removeDeviceSessionItem('membership_session');
      removeDeviceSessionItem('admin_session_active');
  };

  const [user, setUser] = useState<UserProfile | null>(() => {
      const stored = getStoredSessionStr();
      if (stored) {
          try {
              return JSON.parse(stored);
          } catch (e) {
              return null;
          }
      }
      return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Session Inactivity State
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(() => {
    const cached = localStorage.getItem('company_settings_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (typeof parsed.session_timeout_minutes === 'number') return parsed.session_timeout_minutes;
      } catch (e) {}
    }
    return 15;
  });

  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  const setSessionTimeoutMinutes = useCallback((mins: number) => {
    setSessionTimeoutMinutesState(mins);
    try {
      const cached = localStorage.getItem('company_settings_cache');
      const existing = cached ? JSON.parse(cached) : {};
      localStorage.setItem('company_settings_cache', JSON.stringify({ ...existing, session_timeout_minutes: mins }));
    } catch (e) {}
  }, []);

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    localStorage.setItem('membership_last_activity', now.toString());
    setShowInactivityWarning(false);
  }, []);

  const dismissInactivityWarning = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const isSuperAdminState = useMemo(() => isSuperAdminRole(user?.role_id), [user]);
  const isOwnerState = useMemo(() => isOwnerRole(user?.role_id), [user]);

  const checkIsSuperAdmin = async (currentUser: UserProfile | null = user) => {
      return isSuperAdminRole(currentUser?.role_id);
  };

  const logout = useCallback((reason?: string) => {
    setUser(null);
    clearSession();
    localStorage.removeItem('membership_last_outlet');
    localStorage.removeItem('membership_last_activity');
    setShowInactivityWarning(false);
    if (reason) {
      sessionStorage.setItem('session_expired_reason', reason);
    }
  }, []);

  const refreshUser = async () => {
      const storedUser = getStoredSessionStr();
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          
          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
              if (freshUser) {
                  if (freshUser.is_active === false) {
                      logout('Account disabled by administrator.');
                      return;
                  }
                  const overrides = await db.getPermissionOverrides(freshUser.id);
                  const hydrated = { ...freshUser, overrides };
                  setUser(hydrated);
                  saveSession(hydrated);
              }
          } catch (e) {
              console.warn("User state sync failed, using cached session.");
          }
      }
  };

  // Broadcast Channel for Multi-Tab Sync
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
        setIsLoading(false);
        return;
    }
    
    const bc = new BroadcastChannel('auth_session_sync');
    
    bc.onmessage = (event) => {
      if (event.data.type === 'SESSION_REQUEST') {
        const session = getStoredSessionStr();
        if (session) {
          bc.postMessage({ type: 'SESSION_DATA', session });
        }
      } else if (event.data.type === 'SESSION_DATA') {
        if (!getStoredSessionStr() && event.data.session) {
           try {
             const parsed = JSON.parse(event.data.session);
             setDeviceSessionItem('membership_session', event.data.session);
             setUser(parsed);
             setIsLoading(false);
           } catch (e) {}
        }
      } else if (event.data.type === 'LOGOUT') {
        logout('Session terminated from another tab.');
      }
    };

    const init = async () => {
        const stored = getStoredSessionStr();
        if (stored) {
            await refreshUser();
            setIsLoading(false);
        } else if (!isMobileDevice()) {
            bc.postMessage({ type: 'SESSION_REQUEST' });
            const timeout = setTimeout(() => {
                setIsLoading(false);
            }, 300);
            return () => clearTimeout(timeout);
        } else {
            setIsLoading(false);
        }
    };

    init();
    return () => bc.close();
  }, []);

  // Inactivity & Session Expiration Tracker
  useEffect(() => {
    if (!user) {
      setShowInactivityWarning(false);
      return;
    }

    // Set initial activity timestamp if not present
    if (!localStorage.getItem('membership_last_activity')) {
      localStorage.setItem('membership_last_activity', Date.now().toString());
    }

    let lastThrottle = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottle > 4000) { // throttle writes
        lastThrottle = now;
        localStorage.setItem('membership_last_activity', now.toString());
        setShowInactivityWarning(false);
      }
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'focus'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      if (sessionTimeoutMinutes <= 0) return; // 0 means timeout disabled

      const lastActivityStr = localStorage.getItem('membership_last_activity');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
      const warningMs = Math.max(timeoutMs - 60000, timeoutMs * 0.85);

      if (elapsed >= timeoutMs) {
        // Session Expired due to inactivity
        db.logAction(
          'AUTH_EXPIRE',
          `Session expired for ${user.name} (${user.email}) due to ${sessionTimeoutMinutes} minutes of inactivity.`,
          user.default_outlet_id,
          { id: user.id, name: user.name },
          { module: 'Authentication', severity: 'warning', status: 'success' }
        );
        logout(`Session expired after ${sessionTimeoutMinutes} minutes of inactivity.`);
        toast.error(`Session expired due to ${sessionTimeoutMinutes} minutes of inactivity. Please sign in again.`, {
          id: 'session-timeout-toast',
          duration: 7000
        });
      } else if (elapsed >= warningMs) {
        setShowInactivityWarning(true);
      }
    }, 3000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [user, sessionTimeoutMinutes, logout]);

  const login = async (email: string, password: string) => {
    const { user: foundUser, error, requiresPasswordChange } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      saveSession(foundUser);
      localStorage.setItem('membership_last_activity', Date.now().toString());
      sessionStorage.removeItem('session_expired_reason');
      return { error: null, requiresPasswordChange };
    }
    return { error: error || 'Authentication failed.', requiresPasswordChange: false };
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: createdUser, error } = await db.signUp(email, password, name);
    if (createdUser) {
        const loginRes = await login(email, password);
        return loginRes.error;
    }
    return error || 'Registration failed';
  };

  const changePassword = async (currentPass: string, newPass: string) => {
      if (!user) throw new Error("Not authenticated");
      await db.changePassword(user.id, currentPass, newPass);
      await refreshUser();
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
      if (!user) throw new Error("Not authenticated");
      
      if (updates.email && updates.email !== user.email) {
          await db.updateEmail(updates.email);
      }

      await db.updateUser(user.id, updates);
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      saveSession(updatedUser);
  };

  const authContextValue = useMemo(() => ({ 
    user, 
    login, 
    register, 
    changePassword, 
    updateProfile, 
    refreshUser, 
    logout, 
    isLoading, 
    isSuperAdmin: isSuperAdminState,
    isOwner: isOwnerState, 
    checkIsSuperAdmin,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    resetInactivityTimer,
    showInactivityWarning,
    dismissInactivityWarning
  }), [
    user, 
    login, 
    register, 
    changePassword, 
    updateProfile, 
    refreshUser, 
    logout, 
    isLoading, 
    isSuperAdminState, 
    isOwnerState, 
    checkIsSuperAdmin,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    resetInactivityTimer,
    showInactivityWarning,
    dismissInactivityWarning
  ]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
      {showInactivityWarning && user && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-md w-full bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-amber-500/40 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 border border-amber-500/30">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Inactivity Timeout
                </h4>
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md uppercase tracking-wider">
                  Expiring Soon
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Your session will automatically expire due to {sessionTimeoutMinutes} minutes of inactivity. Click below to continue your session.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={resetInactivityTimer}
                  className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  Stay Signed In
                </button>
                <button
                  onClick={() => logout('User ended session from inactivity warning.')}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-slate-700 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
