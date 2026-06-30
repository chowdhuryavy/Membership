
const safeSessionStorage = {
  getItem(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch(e) { return null; }
  },
  setItem(key: string, value: string): void {
    try { sessionStorage.setItem(key, value); } catch(e) {}
  },
  removeItem(key: string): void {
    try { sessionStorage.removeItem(key); } catch(e) {}
  }
};


const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch(e) {}
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch(e) {}
  }
};


import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

export const isSuperAdminRole = (roleId: string | undefined | null) => {
    const id = roleId?.toLowerCase();
    return id === 'super_admin' || 
           id === 'superadmin' || 
           id === 'owner' || 
           id === 'admin' || 
           id === 'system_admin' || 
           id === 'system_administrator' || 
           id === 'administrator' ||
           id === '0958cdaa-7dd0-48bd-a80d-21d856d2526b';
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
      try {
          const stored = safeStorage.getItem('membership_session');
          if (stored) {
              return JSON.parse(stored);
          }
      } catch (e) {
          console.warn('Storage access failed:', e);
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
    try {
        safeStorage.removeItem('membership_session');
        safeSessionStorage.removeItem('membership_session');
        safeSessionStorage.removeItem('admin_session_active');
        safeStorage.removeItem('membership_last_outlet');
    } catch (e) {
        console.warn('Storage cleanup failed:', e);
    }
  };

  const refreshUser = async () => {
      try {
          const storedUser = safeStorage.getItem('membership_session');
          if (storedUser) {
              const parsed = JSON.parse(storedUser);
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
                  safeStorage.setItem('membership_session', JSON.stringify(hydrated));
              }
          }
      } catch (e) {
          console.warn("User state sync failed, using cached session or storage blocked.", e);
      }
  };

  useEffect(() => {
    const init = async () => {
        try {
            const stored = safeStorage.getItem('membership_session');
            if (stored) {
                await refreshUser();
            }
        } catch (e) {
            console.warn("Storage access failed during init:", e);
        }
        setIsLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: foundUser, error, requiresPasswordChange } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      try {
          safeStorage.setItem('membership_session', JSON.stringify(foundUser));
          if (isSuperAdminRole(foundUser.role_id)) {
              safeSessionStorage.setItem('admin_session_active', 'true');
          }
      } catch (e) {
          console.warn("Storage failed during login:", e);
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
      safeStorage.setItem('membership_session', JSON.stringify(updatedUser));
      
      if (isSuperAdminRole(updatedUser.role_id)) {
          safeSessionStorage.setItem('admin_session_active', 'true');
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
