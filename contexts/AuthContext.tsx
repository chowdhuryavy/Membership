
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ error: string | null, requiresPasswordChange: boolean }>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
      const stored = sessionStorage.getItem('membership_session');
      return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
      const storedUser = sessionStorage.getItem('membership_session');
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
              if (freshUser) {
                  // CRITICAL: Hydrate overrides during refresh to maintain custom permissions
                  const overrides = await db.getPermissionOverrides(freshUser.id);
                  const hydrated = { ...freshUser, overrides };
                  setUser(hydrated);
                  sessionStorage.setItem('membership_session', JSON.stringify(hydrated));
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
      sessionStorage.setItem('membership_session', JSON.stringify(foundUser));
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
      sessionStorage.setItem('membership_session', JSON.stringify(updatedUser));
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('membership_session');
    localStorage.removeItem('membership_last_outlet');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, changePassword, updateProfile, refreshUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
