
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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUser, isSuperAdmin, isOwner } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(() => {
    const cached = localStorage.getItem('company_settings_cache');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const lastUserRef = useRef<UserProfile | null>(null);

  const userAllowedOutlets = useMemo(() => {
    if (!user) return [];
    const isAdmin = isSuperAdmin || user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin';
    return isAdmin
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
        localStorage.setItem('company_settings_cache', JSON.stringify(s));
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
      localStorage.setItem('membership_last_outlet', outlet.id);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    if (currentOutlet) {
      const updatedOutlet = outlets.find(o => o.id === currentOutlet.id);
      if (updatedOutlet && JSON.stringify(updatedOutlet) !== JSON.stringify(currentOutlet)) {
        setCurrentOutletState(updatedOutlet);
      }
    }
  }, [outlets, currentOutlet]);

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
              const storedOutletId = localStorage.getItem('membership_last_outlet');
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
    // True Super Admins (Owners) always have full system clearance and bypass the blacklist.
    if (isOwner) return true;

    const isAdminRole = normalizedRoleId === 'admin' || normalizedRoleId === 'system_admin' || normalizedRoleId === 'system_administrator';

    // 1.2. SETTINGS PAGE ENTRY BYPASS
    // Always allow admins to enter the settings page itself, even if it was accidentally restricted globally.
    // Restrictions will still apply to individual tabs within the settings page.
    if (permission === 'settings:view' && isAdminRole) return true;

    // 2. GLOBAL FEATURE CONTROL (BLACKLIST LOGIC)
    // If a permission is in the restricted_permissions list, it is globally HIDDEN for all non-owners.
    if (settings?.restricted_permissions && settings.restricted_permissions.length > 0) {
        if (settings.restricted_permissions.includes(permission)) {
            return false;
        }
    }

    // 1.5. LEGACY ADMIN BYPASS
    // Standard admins get everything that isn't blacklisted.
    if (isAdminRole) return true;

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
  }, [roles, user, isSuperAdmin, settings]);

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
