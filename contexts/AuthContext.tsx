
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';
import { getDeviceSessionItem, setDeviceSessionItem, removeDeviceSessionItem } from '../services/deviceStorage';

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
  logout: () => void;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  checkIsSuperAdmin: () => Promise<boolean>;
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
  
  const isSuperAdminState = useMemo(() => isSuperAdminRole(user?.role_id), [user]);
  const isOwnerState = useMemo(() => isOwnerRole(user?.role_id), [user]);

  const checkIsSuperAdmin = async (currentUser: UserProfile | null = user) => {
      return isSuperAdminRole(currentUser?.role_id);
  };

  const logout = () => {
    setUser(null);
    clearSession();
    localStorage.removeItem('membership_last_outlet');
  };

  const refreshUser = async () => {
      const storedUser = getStoredSessionStr();
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
                  saveSession(hydrated);
              }
          } catch (e) {
              console.warn("User state sync failed, using cached session.");
          }
      }
  };

  useEffect(() => {
    const init = async () => {
        const stored = getStoredSessionStr();
        if (stored) {
            await refreshUser();
        }
        setIsLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: foundUser, error, requiresPasswordChange } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      saveSession(foundUser);
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
    checkIsSuperAdmin 
  }), [user, login, register, changePassword, updateProfile, refreshUser, logout, isLoading, isSuperAdminState, isOwnerState, checkIsSuperAdmin]);

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
