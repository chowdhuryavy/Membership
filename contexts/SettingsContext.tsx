
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CompanySettings, Currency, Role, Permission, Outlet, Property } from '../types';
import { db } from '../services/mockSupabase';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  settings: CompanySettings | null;
  currency: Currency | null;
  roles: Role[];
  currencies: Currency[];
  outlets: Outlet[];
  properties: Property[];
  currentOutlet: Outlet | null;
  currentProperty: Property | null;
  setCurrentOutlet: (outlet: Outlet) => void;
  refreshSettings: () => Promise<void>;
  formatMoney: (amount: number) => string;
  hasPermission: (userRoleId: string, permission: Permission) => boolean;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSettings = async () => {
    setIsLoading(true);
    try {
        const [s, c, r, o, p] = await Promise.all([
            db.getSettings(), 
            db.getCurrencies(), 
            db.getRoles(),
            db.getOutlets(),
            db.getProperties()
        ]);
        
        setSettings(s);
        setCurrencies(c);
        setRoles(r);
        setOutlets(o);
        setProperties(p);
        
        const activeCurr = c.find(curr => curr.id === s.currency_id) || c.find(curr => curr.is_default) || c[0];
        setCurrency(activeCurr);
        
        if (user) await refreshUser();
    } catch (e) {
        console.error("Critical Settings Load Failure:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const currentProperty = useMemo(() => {
      if (!currentOutlet || properties.length === 0) return null;
      return properties.find(p => p.id === currentOutlet.property_id) || null;
  }, [currentOutlet, properties]);

  const setCurrentOutlet = (outlet: Outlet) => {
      setCurrentOutletState(outlet);
      localStorage.setItem('membership_last_outlet', outlet.id);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    if (user && outlets.length > 0) {
      const allowed = user.role_id === 'admin' 
          ? outlets 
          : outlets.filter(o => user.allowed_outlets?.includes(o.id));

      if (allowed.length > 0) {
        const isAllowed = currentOutlet && allowed.find(o => o.id === currentOutlet.id);
        
        if (!currentOutlet || !isAllowed) {
            const storedOutletId = localStorage.getItem('membership_last_outlet');
            const storedOutlet = allowed.find(out => out.id === storedOutletId);
            setCurrentOutletState(storedOutlet || allowed[0]);
        }
      } else {
          setCurrentOutletState(null);
      }
    }
  }, [user, outlets]);

  const formatMoney = (amount: number) => {
    const value = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!currency) return value;
    const isRtl = /[\u0600-\u06FF]/.test(currency.symbol);
    return isRtl ? `${value} ${currency.symbol}` : `${currency.symbol} ${value}`;
  };

  /**
   * REFINED PERMISSION LOGIC
   * Includes an Administrative Master Key to prevent UI lockouts.
   */
  const hasPermission = (userRoleId: string, permission: Permission): boolean => {
    // Master Key: Admins always have all permissions
    if (userRoleId === 'admin') return true;
    
    const role = roles.find(r => r.id === userRoleId);
    if (!role) return false;
    return role.permissions.includes(permission);
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      currency, 
      roles, 
      currencies, 
      outlets,
      properties,
      currentOutlet,
      currentProperty,
      setCurrentOutlet,
      refreshSettings, 
      formatMoney,
      hasPermission,
      isLoading
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
