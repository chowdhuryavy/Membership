
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../services/mockSupabase';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<string | null>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
      const storedUser = localStorage.getItem('nexus_session');
      if (storedUser) {
          const parsed = JSON.parse(storedUser);
          // Fetch fresh data from DB
          try {
              const users = await db.getUsers();
              const freshUser = users.find(u => u.id === parsed.id);
              if (freshUser) {
                  setUser(freshUser);
                  localStorage.setItem('nexus_session', JSON.stringify(freshUser));
              } else {
                  // User might have been deleted
                  logout(); 
              }
          } catch (e) {
              console.error("Failed to refresh session", e);
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
      localStorage.setItem('nexus_session', JSON.stringify(foundUser));
      return null;
    }
    return error || 'Unknown error';
  };

  const changePassword = async (currentPass: string, newPass: string) => {
      if (!user) throw new Error("Not authenticated");
      await db.changePassword(user.id, currentPass, newPass);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, changePassword, refreshUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
