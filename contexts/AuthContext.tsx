
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
      const storedLocal = localStorage.getItem('membership_session');
      if (storedLocal) {
          const parsed = JSON.parse(storedLocal);
          if (!isSuperAdminRole(parsed.role_id)) return parsed;
          // If it was an admin session in localStorage (shouldn't happen with new logic but for safety), clear it
          localStorage.removeItem('membership_session');
      }
      
      const storedSession = sessionStorage.getItem('membership_session');
      return storedSession ? JSON.parse(storedSession) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const isSuperAdminState = useMemo(() => isSuperAdminRole(user?.role_id), [user]);

  const checkIsSuperAdmin = async (currentUser: UserProfile | null = user) => {
      return isSuperAdminRole(currentUser?.role_id);
  };

  const refreshUser = async () => {
      const storedUser = sessionStorage.getItem('membership_session') || localStorage.getItem('membership_session');
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
                  // CRITICAL: Hydrate overrides during refresh to maintain custom permissions
                  const overrides = await db.getPermissionOverrides(freshUser.id);
                  const hydrated = { ...freshUser, overrides };
                  setUser(hydrated);
                  
                  if (isSuperAdminRole(hydrated.role_id)) {
                      sessionStorage.setItem('membership_session', JSON.stringify(hydrated));
                      localStorage.removeItem('membership_session');
                  } else {
                      localStorage.setItem('membership_session', JSON.stringify(hydrated));
                      sessionStorage.removeItem('membership_session');
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
      if (isSuperAdminRole(foundUser.role_id)) {
          sessionStorage.setItem('membership_session', JSON.stringify(foundUser));
          localStorage.removeItem('membership_session');
      } else {
          localStorage.setItem('membership_session', JSON.stringify(foundUser));
          sessionStorage.removeItem('membership_session');
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
      
      if (isSuperAdminRole(updatedUser.role_id)) {
          sessionStorage.setItem('membership_session', JSON.stringify(updatedUser));
          localStorage.removeItem('membership_session');
      } else {
          localStorage.setItem('membership_session', JSON.stringify(updatedUser));
          sessionStorage.removeItem('membership_session');
      }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('membership_session');
    sessionStorage.removeItem('membership_session');
    localStorage.removeItem('membership_last_outlet');
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
