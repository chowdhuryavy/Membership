
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


import { CompanySettings, Currency, Role, Permission, Outlet, Property, UserPermissionOverride, PermissionGroup, UserProfile } from '../types';
import { db } from '../services/mockSupabase';
import { useAuth } from './AuthContext';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';

interface SettingsContextType {
  settings: CompanySettings | null;
  currency: Currency | null;
  roles: Role[];
  currencies: Currency[];
  outlets: Outlet[];
  userAllowedOutlets: Outlet[];
  properties: Property[];
  currentOutlet: Outlet | null;
  currentProperty: Property | null;
  setCurrentOutlet: (outlet: Outlet) => void;
  refreshSettings: () => Promise<void>;
  formatMoney: (amount: number | undefined | null) => string;
  hasPermission: (userRoleId: string, permission: Permission, userId?: string) => boolean;
  checkShortcut: (e: KeyboardEvent, actionId: string) => boolean;
  isLoading: boolean;
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
  permissionRegistry: PermissionGroup[];
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function safeParse<T>(key: string, fallback: T): T {
  try {
    const cached = safeStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (e) {
    console.warn("Storage access failed:", e);
  }
  return fallback;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUser, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(() => {
    return safeParse<CompanySettings | null>('company_settings_cache', null);
  });
  const [currencies, setCurrencies] = useState<Currency[]>(() => {
    return safeParse<Currency[]>('company_currencies_cache', []);
  });
  const [roles, setRoles] = useState<Role[]>(() => {
    return safeParse<Role[]>('company_roles_cache', []);
  });
  const [outlets, setOutlets] = useState<Outlet[]>(() => {
    return safeParse<Outlet[]>('company_outlets_cache', []);
  });
  const [properties, setProperties] = useState<Property[]>(() => {
    return safeParse<Property[]>('company_properties_cache', []);
  });
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const lastUserRef = useRef<UserProfile | null>(null);

  const userAllowedOutlets = useMemo(() => {
    if (!user) return [];
    return isSuperAdmin
        ? outlets 
        : outlets.filter(o => user.allowed_outlets?.includes(o.id));
  }, [user, outlets, isSuperAdmin]);

  const permissionRegistry = useMemo(() => db.getPermissionRegistry(), []);

  const bcRef = useRef<BroadcastChannel | null>(null);

  const refreshSettings = async (broadcast = true) => {
    console.log('[SettingsSync] Starting refresh...', { broadcast });
    try {
        console.log('[SettingsSync] Calling database...');
      const [s, c, r] = await Promise.all([
        db.getSettings(),
        db.getCurrencies(),
        db.getRoles()
      ]);
      const [o, p] = await Promise.all([
        db.getOutlets(),
        db.getProperties()
      ]);
        console.log('[SettingsSync] Database calls returned');
        
        setSettings({ ...s });
        safeStorage.setItem('company_settings_cache', JSON.stringify(s));
        setCurrencies([...c]);
        setRoles([...r]);
        setOutlets([...o]);
        setProperties([...p]);
        
        if (user) await refreshUser();

        // Broadcast to other tabs for immediate real-time sync
        if (broadcast && bcRef.current) {
            console.log('[SettingsSync] Broadcasting REFRESH_SETTINGS');
            bcRef.current.postMessage('REFRESH_SETTINGS');
        }
    } catch (e) {
        console.error("Critical Settings Load Failure:", e);
    } finally {
        setIsLoading(false);
        console.log('[SettingsSync] Refresh finished');
    }
  };

  // Listen for sync messages from other tabs
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('settings_sync');
            bcRef.current = bc;
            bc.onmessage = (event) => {
                if (event.data === 'REFRESH_SETTINGS') {
                    console.log('[SettingsSync] Broadcast received, synchronizing settings cross-tab...');
                    refreshSettings(false); // Don't broadcast back to avoid infinite loops
                }
            };
            return () => {
                bc.close();
                bcRef.current = null;
            };
        } catch (e) {
            console.warn("BroadcastChannel not available or blocked in this environment");
        }
    }
  }, []);

  const currentProperty = useMemo(() => {
      if (!currentOutlet || properties.length === 0) return null;
      return properties.find(p => p.id === currentOutlet.property_id) || null;
  }, [currentOutlet, properties]);

  useEffect(() => {
      if (currencies.length > 0) {
          let activeCurr = null;
          if (currentProperty) {
              activeCurr = currencies.find(c => c.property_id === currentProperty.id && c.is_default) || 
                           currencies.find(c => c.property_id === currentProperty.id);
          }
          if (!activeCurr) {
              activeCurr = (settings && currencies.find(curr => curr.id === settings.currency_id)) || 
                           currencies.find(curr => curr.is_default && !curr.property_id) || 
                           currencies[0];
          }
          setCurrency(activeCurr || null);
      }
  }, [currentProperty, currencies, settings]);

  const setCurrentOutlet = (outlet: Outlet) => {
      setCurrentOutletState(outlet);
      try {
          safeStorage.setItem('membership_last_outlet', outlet.id);
      } catch (e) {
          console.warn("Storage write failed:", e);
      }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    if (user && outlets.length > 0) {
      setCurrentOutletState(prev => {
          const userChanged = !lastUserRef.current || lastUserRef.current.id !== user.id;
          const defaultChanged = lastUserRef.current?.default_outlet_id !== user.default_outlet_id;
          lastUserRef.current = user;

          if (userAllowedOutlets.length === 0) return null;

          const isAllowed = prev && userAllowedOutlets.find(o => o.id === prev.id);
          
          if (!prev || !isAllowed || userChanged || defaultChanged) {
              // Priority: Browser's last used outlet -> User's Admin-assigned default outlet -> First allowed outlet
              let storedOutletId = null;
              try {
                  storedOutletId = safeStorage.getItem('membership_last_outlet');
              } catch (e) {
                  console.warn("Storage access failed:", e);
              }
              const storedOutlet = userAllowedOutlets.find(out => out.id === storedOutletId);
              if (storedOutlet) return storedOutlet;

              const defaultOutlet = user.default_outlet_id ? userAllowedOutlets.find(o => o.id === user.default_outlet_id) : null;
              if (defaultOutlet) return defaultOutlet;

              return userAllowedOutlets[0];
          } else {
              return isAllowed;
          }
      });
    }
  }, [user, outlets, isSuperAdmin, userAllowedOutlets]);

  const formatMoney = (amount: number | undefined | null) => {
    const safeAmount = (amount === null || amount === undefined || isNaN(Number(amount))) ? 0 : Number(amount);
    
    const value = safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!currency) return value;
    return `${currency.symbol}\u00A0${value}`;
  };

  /**
   * Performance-Critical Hybrid Permission Resolver
   * REFINED: Supports Global Feature Control overrides and Module-Scoped logic.
   */
  const hasPermission = useCallback((userRoleId: string, permission: Permission, userId?: string): boolean => {
    if (!userRoleId) return false;
    const normalizedRoleId = userRoleId.toLowerCase();
    
    // 1. SYSTEM SUPERUSER BYPASS
    // Super Admins (Admins/Owners) always have full system clearance.
    if (isSuperAdmin) return true;

    // 2. GLOBAL FEATURE CONTROL (Refined Logic)
    if (settings?.restricted_permissions && settings.restricted_permissions.length > 0) {
        // Module-Scoped Restriction: ONLY APPLES TO 'settings' GROUP
        // This prevents other admins from accessing global configurations like Properties or Outlets
        // unless explicitly granted via "Feature Visibility"
        if (permission.startsWith('settings:')) {
            if (!settings.restricted_permissions.includes(permission)) {
                return false;
            }
        }
    }

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

  const settingsContextValue = useMemo(() => ({ 
    settings, 
    currency, 
    roles, 
    currencies, 
    outlets,
    userAllowedOutlets,
    properties,
    currentOutlet,
    currentProperty,
    setCurrentOutlet,
    refreshSettings, 
    formatMoney,
    hasPermission,
    checkShortcut,
    isLoading,
    pageLoading,
    setPageLoading,
    permissionRegistry
  }), [settings, currency, roles, currencies, outlets, userAllowedOutlets, properties, currentOutlet, currentProperty, setCurrentOutlet, refreshSettings, formatMoney, hasPermission, checkShortcut, isLoading, pageLoading, setPageLoading, permissionRegistry]);

  return (
    <SettingsContext.Provider value={settingsContextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
