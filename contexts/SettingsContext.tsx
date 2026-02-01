
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CompanySettings, Currency, Role, Permission, Outlet } from '../types';
import { db } from '../services/mockSupabase';

interface SettingsContextType {
  settings: CompanySettings | null;
  currency: Currency | null;
  roles: Role[];
  currencies: Currency[];
  outlets: Outlet[];
  currentOutlet: Outlet | null;
  setCurrentOutlet: (outlet: Outlet) => void;
  refreshSettings: () => Promise<void>;
  formatMoney: (amount: number) => string;
  hasPermission: (userRoleId: string, permission: Permission) => boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);

  const refreshSettings = async () => {
    const [s, c, r, o] = await Promise.all([
        db.getSettings(), 
        db.getCurrencies(), 
        db.getRoles(),
        db.getOutlets()
    ]);
    setSettings(s);
    setCurrencies(c);
    setRoles(r);
    setOutlets(o);
    
    const activeCurr = c.find(curr => curr.id === s.currency_id) || c[0];
    setCurrency(activeCurr);

    // Initial Outlet Setup
    if (o.length > 0 && !currentOutlet) {
        // Check local storage for last used outlet
        const storedOutletId = localStorage.getItem('nexus_last_outlet');
        const found = o.find(out => out.id === storedOutletId);
        setCurrentOutletState(found || o[0]);
    } else if (currentOutlet) {
        // Refresh current object in case name changed
        const found = o.find(out => out.id === currentOutlet.id);
        if (found) setCurrentOutletState(found);
    }
  };

  const setCurrentOutlet = (outlet: Outlet) => {
      setCurrentOutletState(outlet);
      localStorage.setItem('nexus_last_outlet', outlet.id);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const formatMoney = (amount: number) => {
    if (!currency) return `${amount.toFixed(2)}`;
    return `${currency.symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasPermission = (userRoleId: string, permission: Permission): boolean => {
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
      currentOutlet,
      setCurrentOutlet,
      refreshSettings, 
      formatMoney,
      hasPermission
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
