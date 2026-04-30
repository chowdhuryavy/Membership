
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

export const isSuperAdminRole = (roleId: string | undefined | null) => {
    const id = roleId?.toLowerCase();
    return id === 'admin' || id === 'system_admin' || id === 'super_admin' || id === 'superadmin' || id === 'owner';
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

const setSessionCookie = () => {
    document.cookie = "membership_admin_active=true; path=/; SameSite=Lax";
};

const getSessionCookie = () => {
    return document.cookie.split('; ').find(row => row.startsWith('membership_admin_active='))?.split('=')[1];
};

const removeSessionCookie = () => {
    document.cookie = "membership_admin_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
      const storedLocal = localStorage.getItem('membership_session');
      if (storedLocal) {
          const parsed = JSON.parse(storedLocal);
          // For super admins, check if session cookie still exists (shared across tabs, dies on browser close)
          if (isSuperAdminRole(parsed.role_id)) {
              if (getSessionCookie()) {
                  return parsed;
              } else {
                  localStorage.removeItem('membership_session');
                  return null;
              }
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

  const refreshUser = async () => {
      const storedUser = localStorage.getItem('membership_session');
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          // If super admin and session cookie is gone, enforce logout
          if (isSuperAdminRole(parsed.role_id) && !getSessionCookie()) {
              logout();
              return;
          }

          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
              if (freshUser) {
                  if (freshUser.is_active === false) {
                      logout();
                      return;
                  }
                  // CRITICAL: Hydrate overrides during refresh to maintain custom permissions
                  const overrides = await db.getPermissionOverrides(freshUser.id);
                  const hydrated = { ...freshUser, overrides };
                  setUser(hydrated);
                  localStorage.setItem('membership_session', JSON.stringify(hydrated));
                  
                  if (isSuperAdminRole(hydrated.role_id)) {
                      setSessionCookie();
                  }
              }
          } catch (e) {
              console.warn("User state sync failed, using cached session.");
          }
      }
  };

  useEffect(() => {
    const init = async () => {
        await refreshUser();
        setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: foundUser, error, requiresPasswordChange } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('membership_session', JSON.stringify(foundUser));
      if (isSuperAdminRole(foundUser.role_id)) {
          setSessionCookie();
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
          setSessionCookie();
      }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('membership_session');
    sessionStorage.removeItem('membership_session'); // Clear old session storage too
    localStorage.removeItem('membership_last_outlet');
    removeSessionCookie();
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
