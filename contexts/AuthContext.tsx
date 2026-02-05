
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<string | null>;
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
                  setUser(freshUser);
                  sessionStorage.setItem('membership_session', JSON.stringify(freshUser));
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
    const { user: foundUser, error } = await db.login(email, password);
    if (foundUser) {
      setUser(foundUser);
      sessionStorage.setItem('membership_session', JSON.stringify(foundUser));
      return null;
    }
    return error || 'Authentication failed.';
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: createdUser, error } = await db.signUp(email, password, name);
    if (createdUser) {
        return await login(email, password);
    }
    return error || 'Registration failed';
  };

  const changePassword = async (currentPass: string, newPass: string) => {
      if (!user) throw new Error("Not authenticated");
      await db.changePassword(user.id, currentPass, newPass);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
      if (!user) throw new Error("Not authenticated");
      
      // If email is changing, update Auth provider as well
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
