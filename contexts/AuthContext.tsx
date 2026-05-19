
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

export const isSuperAdminRole = (roleId: string | undefined | null) => {
    const id = roleId?.toLowerCase();
    return id === 'super_admin' || id === 'superadmin' || id === 'owner';
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
  logout: () => void;
  isLoading: boolean;
  isSuperAdmin: boolean;
  checkIsSuperAdmin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
      const stored = localStorage.getItem('membership_session');
      if (stored) {
          const parsed = JSON.parse(stored);
          // NEW: If it's an admin and there's no session heartbeat in this tab, don't set user yet
          // The useEffect will try to recover it from other tabs or logout if none
          if (isSuperAdminRole(parsed?.role_id) && !sessionStorage.getItem('admin_session_active')) {
              return null;
          }
          return parsed;
      }
      return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const isSuperAdminState = useMemo(() => isSuperAdminRole(user?.role_id), [user]);

  const checkIsSuperAdmin = async (currentUser: UserProfile | null = user) => {
      return isSuperAdminRole(currentUser?.role_id);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('membership_session');
    sessionStorage.removeItem('membership_session');
    sessionStorage.removeItem('admin_session_active');
    localStorage.removeItem('membership_last_outlet');
  };

  const refreshUser = async () => {
      const storedUser = localStorage.getItem('membership_session');
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          
          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
              if (freshUser) {
                  if (freshUser.is_active === false) {
                      logout();
                      return;
                  }
                  const overrides = await db.getPermissionOverrides(freshUser.id);
                  const hydrated = { ...freshUser, overrides };
                  setUser(hydrated);
                  localStorage.setItem('membership_session', JSON.stringify(hydrated));
              }
          } catch (e) {
              console.warn("User state sync failed, using cached session.");
          }
      }
  };

  useEffect(() => {
    const channel = new BroadcastChannel('auth_session_sync');
    
    const init = async () => {
        const stored = localStorage.getItem('membership_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (isSuperAdminRole(parsed.role_id)) {
                // If we don't have a local session lock, ask other tabs
                if (!sessionStorage.getItem('admin_session_active')) {
                    channel.postMessage({ type: 'REQUEST_SESSION_STATUS' });
                    
                    // Delay to wait for answers from other tabs
                    await new Promise(resolve => setTimeout(resolve, 600));
                    
                    if (!sessionStorage.getItem('admin_session_active')) {
                        // No other tab responded. Force logout for admins.
                        console.log("No active admin session heartbeat found. Terminating session.");
                        logout();
                    } else {
                        // Recovered from another tab!
                        await refreshUser();
                    }
                } else {
                    // We already have the heartbeat in this tab
                    await refreshUser();
                }
            } else {
                // Not an admin, standard persistence applies
                await refreshUser();
            }
        }
        
        setIsLoading(false);
    };

    channel.onmessage = (event) => {
        if (event.data.type === 'REQUEST_SESSION_STATUS') {
            if (sessionStorage.getItem('admin_session_active')) {
                channel.postMessage({ type: 'SESSION_ALIVE' });
            }
        } else if (event.data.type === 'SESSION_ALIVE') {
            sessionStorage.setItem('admin_session_active', 'true');
        }
    };

    init();

    return () => {
        channel.close();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { user: foundUser, error, requiresPasswordChange } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('membership_session', JSON.stringify(foundUser));
      if (isSuperAdminRole(foundUser.role_id)) {
          sessionStorage.setItem('admin_session_active', 'true');
      }
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
      localStorage.setItem('membership_session', JSON.stringify(updatedUser));
      
      if (isSuperAdminRole(updatedUser.role_id)) {
          sessionStorage.setItem('admin_session_active', 'true');
      }
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
    checkIsSuperAdmin 
  }), [user, login, register, changePassword, updateProfile, refreshUser, logout, isLoading, isSuperAdminState, checkIsSuperAdmin]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
