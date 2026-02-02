
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<string | null>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
      const storedUser = localStorage.getItem('membership_session');
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.id === parsed.id);
              if (freshUser) {
                  setUser(freshUser);
                  localStorage.setItem('membership_session', JSON.stringify(freshUser));
              } else {
                  setUser(parsed);
              }
          } catch (e) {
              setUser(parsed);
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
      localStorage.setItem('membership_session', JSON.stringify(foundUser));
      return null;
    }
    return error || 'Unknown error';
  };

  const changePassword = async (currentPass: string, newPass: string) => {
      if (!user) throw new Error("Not authenticated");
      await db.changePassword(user.id, currentPass, newPass);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
      if (!user) throw new Error("Not authenticated");
      await db.updateUser(user.id, updates);
      // Immediately sync state to avoid "System" name lag
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('membership_session', JSON.stringify(updatedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('membership_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, changePassword, updateProfile, refreshUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
