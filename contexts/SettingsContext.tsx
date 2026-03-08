
import { CompanySettings, Currency, Role, Permission, Outlet, Property, UserPermissionOverride, PermissionGroup } from '../types';
import { db } from '../services/mockSupabase';
import { useAuth } from './AuthContext';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

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
  formatMoney: (amount: number | undefined | null) => string;
  hasPermission: (userRoleId: string, permission: Permission, userId?: string) => boolean;
  checkShortcut: (e: KeyboardEvent, actionId: string) => boolean;
  isLoading: boolean;
  permissionRegistry: PermissionGroup[];
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUser, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const permissionRegistry = useMemo(() => db.getPermissionRegistry(), []);

  const refreshSettings = async () => {
    try {
        const [s, c, r, o, p] = await Promise.all([
            db.getSettings(), 
            db.getCurrencies(), 
            db.getRoles(),
            db.getOutlets(),
            db.getProperties()
        ]);
        
        setSettings({ ...s });
        setCurrencies([...c]);
        setRoles([...r]);
        setOutlets([...o]);
        setProperties([...p]);
        
        const activeCurr = (s && c.find(curr => curr.id === s.currency_id)) || 
                          c.find(curr => curr.is_default) || 
                          c[0];
                          
        setCurrency(activeCurr || null);
        
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
      const allowed = (user.role_id?.toLowerCase() === 'admin')
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

  const formatMoney = (amount: number | undefined | null) => {
    const safeAmount = (amount === null || amount === undefined || isNaN(Number(amount))) ? 0 : Number(amount);
    
    const value = safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!currency) return value;
    return `${currency.symbol} ${value}`;
  };

  /**
   * Performance-Critical Hybrid Permission Resolver
   * REFINED: Strictly follows DB roles and user overrides.
   */
  const hasPermission = useCallback((userRoleId: string, permission: Permission, userId?: string): boolean => {
    if (!userRoleId) return false;
    const normalizedRoleId = userRoleId.toLowerCase();
    
    // 1. SYSTEM SUPERUSER BYPASS
    // Only the specific Super Admin email has full system clearance.
    if (isSuperAdmin) return true;

    // 1.5. LEGACY ADMIN BYPASS
    // Restore the ability for the 'admin' role to have all permissions by default.
    if (normalizedRoleId === 'admin' || normalizedRoleId === 'system_admin') return true;

    // 2. USER-SPECIFIC OVERRIDES (High Priority)
    const targetUser = (userId === user?.id || !userId) ? user : null;
    if (targetUser?.overrides) {
        const override = targetUser.overrides.find(o => o.permission_key === permission);
        if (override !== undefined) return override.is_granted;
    }

    // 3. ROLE-BASED DEFINITIONS
    const role = roles.find(r => r.id.toLowerCase() === normalizedRoleId || r.name.toLowerCase() === normalizedRoleId);
    
    // If the role is found in the database, use its permissions strictly.
    if (role) {
        return role.permissions.includes(permission);
    }

    return false;
  }, [roles, user, isSuperAdmin]);

  const checkShortcut = useCallback((e: KeyboardEvent, actionId: string): boolean => {
    const defaults: Record<string, string> = {
        'nav_dashboard': 'Alt+D',
        'nav_members': 'Alt+M',
        'nav_settings': 'Alt+S',
        'global_search': 'Alt+K',
        'action_create': 'Alt+N',
        'action_save': 'Alt+Enter',
        'action_cancel': 'Escape',
        'action_view_contract': 'Alt+P'
    };
    
    const config = settings?.keyboard_shortcuts?.[actionId] || defaults[actionId];
    if (!config) return false;

    const parts = config.toLowerCase().split('+').map(p => p.trim());
    const targetKey = parts[parts.length - 1];
    
    const needsMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');
    const needsCtrl = parts.includes('ctrl') || parts.includes('control');
    const needsAlt = parts.includes('alt') || parts.includes('option');
    const needsShift = parts.includes('shift');

    if (needsMeta !== e.metaKey) return false;
    if (needsCtrl !== e.ctrlKey) return false;
    if (needsAlt !== e.altKey) return false;
    if (needsShift !== e.shiftKey) return false;

    const eventKey = e.key.toLowerCase();
    const eventCode = e.code.toLowerCase();

    if (targetKey === eventKey) return true;
    if (targetKey.length === 1) {
        const isLetter = /^[a-z]$/.test(targetKey);
        const isDigit = /^[0-9]$/.test(targetKey);
        if (isLetter && eventCode === `key${targetKey}`) return true;
        if (isDigit && eventCode === `digit${targetKey}`) return true;
    }
    if (targetKey === 'enter' && eventCode === 'numpadenter') return true;
    if (targetKey === 'alt' && (eventCode === 'altleft' || eventCode === 'altright')) return true;

    return false;
  }, [settings]);

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
      checkShortcut,
      isLoading,
      permissionRegistry
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
