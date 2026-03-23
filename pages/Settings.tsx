
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { reportService } from '../services/reportService';
import { Role, Permission, Currency, CompanySettings, Outlet, Property, IncentiveRule, MassageType, MembershipCategory, PermissionGroup, InventoryItem, MassageRoom, MembershipType, ReportRecipient } from '../types';
import { BookingSettings } from '../components/BookingSettings';
import { 
  Trash2, 
  Edit2, 
  Shield, 
  ShieldCheck,
  Check,
  Plus,
  Coins,
  Eraser,
  Building2, 
  Store,
  Settings, 
  Award,
  Target,
  MapPin,
  ClipboardList,
  LayoutTemplate,
  ShieldAlert,
  ListOrdered,
  Keyboard,
  FileCode,
  ChevronUp,
  ChevronDown,
  Zap,
  DollarSign,
  Timer,
  Clock,
  Command,
  User,
  Users,
  Globe,
  Lock,
  FileText,
  AlertTriangle,
  ChevronRight,
  Info,
  RefreshCcw,
  Key,
  Filter,
  Mail
} from 'lucide-react';

const PermissionMatrix = ({ 
  registry, 
  selectedPermissions, 
  onChange,
  readOnly = false
}: { 
  registry: PermissionGroup[], 
  selectedPermissions: Permission[], 
  onChange: (perms: Permission[]) => void,
  readOnly?: boolean
}) => {
  const [expanded, setExpanded] = useState<string[]>([registry[0]?.id]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePermission = (key: Permission) => {
    if (readOnly) return;
    const isSelected = selectedPermissions.includes(key);
    if (isSelected) {
      onChange(selectedPermissions.filter(p => p !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  };

  const toggleAllInGroup = (groupId: string) => {
    if (readOnly) return;
    const group = registry.find(g => g.id === groupId);
    if (!group) return;
    const keys = group.permissions.map(p => p.key);
    const allSelected = keys.every(k => selectedPermissions.includes(k));
    
    if (allSelected) {
      onChange(selectedPermissions.filter(p => !keys.includes(p)));
    } else {
      const newPerms = [...selectedPermissions];
      keys.forEach(k => { if (!newPerms.includes(k)) newPerms.push(k); });
      onChange(newPerms);
    }
  };

  return (
    <div className="space-y-4">
      {registry.map(group => {
        const isExpanded = expanded.includes(group.id);
        const groupKeys = group.permissions.map(p => p.key);
        const selectedCount = groupKeys.filter(k => selectedPermissions.includes(k)).length;
        const allSelected = selectedCount === groupKeys.length;

        return (
          <div key={group.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
            <div className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'bg-white'}`} onClick={() => toggleGroup(group.id)}>
              <div className="flex items-center gap-4">
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <div>
                  <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">{group.label}</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">{selectedCount} of {groupKeys.length} Authorized</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {!readOnly && (
                   <button 
                    onClick={(e) => { e.stopPropagation(); toggleAllInGroup(group.id); }}
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${allSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-white hover:text-indigo-600'}`}
                   >
                     {allSelected ? 'Disable Module' : 'Enable Module'}
                   </button>
                 )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-300">
                {group.permissions.map(p => {
                  const isSelected = selectedPermissions.includes(p.key);
                  return (
                    <div 
                      key={p.key} 
                      onClick={() => togglePermission(p.key)}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer group ${isSelected ? 'bg-indigo-50/50 border-indigo-600 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-wide leading-none ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{p.label}</p>
                        <p className="text-[9px] font-medium text-slate-400 leading-tight">{p.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

type TabId = 'company' | 'incentives' | 'navigation' | 'properties' | 'outlets' | 'roles' | 'currency' | 'shortcuts' | 'documents' | 'maintenance' | 'booking' | 'massage_rooms' | 'functions' | 'membership_types' | 'reports_config';

const SignatoryConfig = ({
  config = {},
  onChange,
  labelPrefix = ""
}: {
  config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>,
  onChange: (newConfig: Record<string, { prepared?: string, reviewed?: string, approved?: string }>) => void,
  labelPrefix?: string
}) => {
  const reports = [
    { id: 'daily_sales', label: 'Daily Sales Ledger' },
    { id: 'massage_yield', label: 'Massage Yield Report' },
    { id: 'members_joined', label: 'Members Joined Audit' },
    { id: 'expiring_memberships', label: 'Expiring Memberships Audit' },
    { id: 'incentives', label: 'Staff Incentives Report' },
    { id: 'revenue_recognition', label: 'Revenue Recognition Report' },
  ];

  const updateReportConfig = (reportId: string, field: 'prepared' | 'reviewed' | 'approved', value: string) => {
    const newConfig = { ...config };
    if (!newConfig[reportId]) newConfig[reportId] = {};
    newConfig[reportId] = { ...newConfig[reportId], [field]: value };
    
    // Clean up if all empty
    if (!newConfig[reportId].prepared && !newConfig[reportId].reviewed && !newConfig[reportId].approved) {
      delete newConfig[reportId];
    }
    
    onChange(newConfig);
  };

  const toggleReport = (reportId: string) => {
    const newConfig = { ...config };
    if (newConfig[reportId]) {
      delete newConfig[reportId];
    } else {
      newConfig[reportId] = { prepared: '', reviewed: '', approved: '' };
    }
    onChange(newConfig);
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-5 h-5 text-indigo-600" />
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{labelPrefix} Signatory Matrix</h4>
      </div>
      
      <div className="space-y-4">
        {reports.map(report => {
          const isActive = !!config[report.id];
          const reportConfig = config[report.id] || {};
          
          return (
            <div key={report.id} className={`p-4 rounded-2xl border-2 transition-all ${isActive ? 'bg-white border-indigo-600 shadow-sm' : 'bg-slate-100/50 border-transparent opacity-60'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleReport(report.id)}>
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-200'}`}>
                    {isActive && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-tight ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{report.label}</span>
                </div>
                {isActive && <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">Active Protocol</span>}
              </div>

              {isActive && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Prepared By</label>
                    <Input 
                      placeholder="e.g. Accountant" 
                      value={reportConfig.prepared || ''} 
                      onChange={e => updateReportConfig(report.id, 'prepared', e.target.value)} 
                      className="h-10 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reviewed By</label>
                    <Input 
                      placeholder="e.g. Manager" 
                      value={reportConfig.reviewed || ''} 
                      onChange={e => updateReportConfig(report.id, 'reviewed', e.target.value)} 
                      className="h-10 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Approved By</label>
                    <Input 
                      placeholder="e.g. Director" 
                      value={reportConfig.approved || ''} 
                      onChange={e => updateReportConfig(report.id, 'approved', e.target.value)} 
                      className="h-10 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  // Fix: Destructured currentOutlet and currentProperty from useSettings to provide necessary context for data fetching
  const { settings, currencies, roles, outlets, properties, refreshSettings, hasPermission, formatMoney, permissionRegistry, currentOutlet, currentProperty } = useSettings();
  const { user, isSuperAdmin } = useAuth();
  const availableTabs = useMemo(() => {
    const isSuper = isSuperAdmin;
    
    return [
      // Super Admin Only
      { id: 'company', label: 'Global Scope', visible: hasPermission(user?.role_id || '', 'settings:view_global'), icon: Building2 },
      { id: 'properties', label: 'Facility Portfolios', visible: hasPermission(user?.role_id || '', 'settings:view_properties'), icon: MapPin },
      { id: 'outlets', label: 'Asset Contexts', visible: hasPermission(user?.role_id || '', 'settings:view_outlets'), icon: Store },
      { id: 'currency', label: 'Monetary Standards', visible: hasPermission(user?.role_id || '', 'settings:view_currency'), icon: Globe },
      { id: 'navigation', label: 'UI Architecture', visible: hasPermission(user?.role_id || '', 'settings:view_navigation'), icon: ListOrdered },
      { id: 'functions', label: 'Feature Visibility', visible: isSuper || hasPermission(user?.role_id || '', 'settings:manage_visibility'), icon: ShieldAlert },
      { id: 'maintenance', label: 'Maintenance', visible: hasPermission(user?.role_id || '', 'settings:view_maintenance'), icon: Zap },
      
      // Accessible to others with permission
      { id: 'roles', label: 'Security Tiers', visible: hasPermission(user?.role_id || '', 'settings:view_roles'), icon: Shield },
      { id: 'incentives', label: 'Contract Logic', visible: hasPermission(user?.role_id || '', 'settings:view_incentives') && !!currentOutlet, icon: Award },
      { id: 'shortcuts', label: 'Executive Hotkeys', visible: hasPermission(user?.role_id || '', 'settings:view_shortcuts'), icon: Keyboard },
      { id: 'documents', label: 'Audit Templates', visible: hasPermission(user?.role_id || '', 'settings:view_documents'), icon: FileCode },
      { id: 'booking', label: 'Booking Engine', visible: hasPermission(user?.role_id || '', 'settings:view_outlets') && !!currentProperty, icon: Timer },
      { id: 'membership_types', label: 'Membership Types', visible: hasPermission(user?.role_id || '', 'settings:view_global') && !!currentOutlet, icon: Target },
      { id: 'massage_rooms', label: 'Massage Rooms', visible: isSuper && !!currentProperty, icon: Store },
      { id: 'reports_config', label: 'Report Distribution', visible: hasPermission(user?.role_id || '', 'settings:view_global'), icon: Mail },
    ].filter(t => t.visible);
  }, [user, roles, hasPermission, currentProperty, currentOutlet]);

  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0]?.id as TabId || 'company');

  useEffect(() => {
    if (!availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id as TabId || 'company');
    }
  }, [availableTabs, activeTab]);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: string, id: string, name: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [massageRooms, setMassageRooms] = useState<MassageRoom[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [membershipTypeForm, setMembershipTypeForm] = useState<Omit<MembershipType, 'id' | 'created_at'>>({ name: '', outlet_id: '' });
  const [reportRecipients, setReportRecipients] = useState<ReportRecipient[]>([]);
  const [reportRecipientForm, setReportRecipientForm] = useState<Omit<ReportRecipient, 'id' | 'created_at'>>({ 
    email: '', 
    property_id: '', 
    outlet_id: 'all', 
    report_type: 'revenue_recognition', 
    send_time: '08:00',
    is_active: true 
  });

  const filteredProperties = useMemo(() => {
    if (isSuperAdmin) return properties;
    return properties.filter(p => 
      outlets.some(o => o.property_id === p.id && user?.allowed_outlets?.includes(o.id))
    );
  }, [properties, outlets, user, isSuperAdmin]);

  const filteredOutletsForForm = useMemo(() => {
    const propertyOutlets = outlets.filter(o => o.property_id === reportRecipientForm.property_id);
    if (isSuperAdmin) return propertyOutlets;
    return propertyOutlets.filter(o => user?.allowed_outlets?.includes(o.id));
  }, [outlets, reportRecipientForm.property_id, user, isSuperAdmin]);

  useEffect(() => {
    if (currentOutlet) {
      db.getMassageRooms(currentOutlet.id).then(setMassageRooms);
      db.getMembershipTypes(currentOutlet.id).then(setMembershipTypes);
    } else if (currentProperty) {
      db.getMassageRooms(undefined, currentProperty.id).then(setMassageRooms);
      db.getMembershipTypes().then(setMembershipTypes);
    } else {
      db.getMassageRooms().then(setMassageRooms);
      db.getMembershipTypes().then(setMembershipTypes);
    }
  }, [currentOutlet, currentProperty]);

  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'members', label: 'Members' },
    { id: 'staff', label: 'Staff Roster' },
    { id: 'bookings', label: 'Booking' },
    { id: 'sales', label: 'Sales & Retail' },
    { id: 'categories', label: 'Membership Tiers' },
    { id: 'users', label: 'Users & Security' },
    { id: 'reports', label: 'Financial Reports' },
    { id: 'logs', label: 'Audit Logs' },
    { id: 'settings', label: 'System Settings' },
  ], []);

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ 
    name: '', 
    logo_url: '', 
    address: '', 
    currency_id: '', 
    report_title: '',
    report_subtitle: '',
    signatory_config: {},
    navigation_order: [], 
    conditions: '', 
    keyboard_shortcuts: {} 
  });
  const [propertyForm, setPropertyForm] = useState<Omit<Property, 'id'>>({ 
    name: '', 
    logo_url: '', 
    address: '',
    signatory_config: {}
  });
  const [roomForm, setRoomForm] = useState<Omit<MassageRoom, 'id'>>({ property_id: '', outlet_id: '', name: '', number: '', is_active: true });
  const [outletForm, setOutletForm] = useState<Omit<Outlet, 'id'>>({ 
    name: '', 
    property_id: '', 
    signatory_config: {},
    contract_template: '',
    conditions: '' 
  });
  const [roleForm, setRoleForm] = useState<Omit<Role, 'id'>>({ name: '', permissions: [] });
  const [currencyForm, setCurrencyForm] = useState<Omit<Currency, 'id'>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [incentiveForm, setIncentiveForm] = useState<Omit<IncentiveRule, 'id'>>({
      name: '', scope: 'Global', scope_id: 'global', applies_to: 'Massage', target_id: 'all', distribution_type: 'Individual', calculation_type: 'Percentage', value: 0, min_price: 0, max_price: 99999, min_duration_minutes: 0, max_duration_minutes: 999, apply_discount_percentage: true, is_active: true
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [incentiveRules, setIncentiveRules] = useState<IncentiveRule[]>([]);
  const [allMassageTypes, setAllMassageTypes] = useState<MassageType[]>([]);
  const [allCategories, setAllCategories] = useState<MembershipCategory[]>([]); 
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);

  useEffect(() => { 
    if (settings) {
      setCompanyForm({ 
        ...settings,
        name: settings.name || '',
        logo_url: settings.logo_url || '',
        address: settings.address || '',
        report_title: settings.report_title || '',
        report_subtitle: settings.report_subtitle || '',
        signatory_config: settings.signatory_config || {},
        contract_template: settings.contract_template || '',
        conditions: settings.conditions || '',
        keyboard_shortcuts: settings.keyboard_shortcuts || {}
      }); 
    }
  }, [settings]);

  const currentNavOrder = useMemo(() => {
    const savedOrder = companyForm.navigation_order || [];
    const validSaved = savedOrder.filter(id => navItems.some(n => n.id === id));
    const missing = navItems.filter(n => !validSaved.includes(n.id)).map(n => n.id);
    return [...validSaved, ...missing];
  }, [companyForm.navigation_order, navItems]);

  const loadData = async () => {
      if (activeTab === 'incentives' && currentOutlet) {
          const [rules, mTypes, allCats, inv, memTypes] = await Promise.all([
              db.getIncentiveRules(), 
              db.getMassageTypes(currentOutlet.id), 
              db.getCategories(currentOutlet.id),
              db.getInventory('all', true),
              db.getMembershipTypes(currentOutlet.id)
          ]);
          setIncentiveRules(rules);
          setAllMassageTypes(mTypes);
          setAllCategories(allCats);
          setAllInventory(inv);
          setMembershipTypes(memTypes);
      }
      if (activeTab === 'membership_types' && currentOutlet) {
          const types = await db.getMembershipTypes(currentOutlet.id);
          setMembershipTypes(types);
      }
      if (activeTab === 'reports_config') {
          const recipients = await db.getReportRecipients();
          setReportRecipients(recipients);
      }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateCompany = async () => { 
    if (!isSuperAdmin) {
        showStatus('Unauthorized: Super Admin access required.', 'error');
        return;
    }
    setIsSaving(true); 
    try { 
      await db.updateSettings(companyForm); 
      await refreshSettings(); 
      showStatus('Global Framework synchronized.'); 
    } catch (e: any) { 
      showStatus(e.message, 'error'); 
    } finally { 
      setIsSaving(false); 
    } 
  };

  const handlePropertySubmit = async () => {
    if (!isSuperAdmin) {
        showStatus('Unauthorized: Super Admin access required.', 'error');
        return;
    }
    setIsSaving(true);
    try {
      if (editingId) await db.updateProperty(editingId, propertyForm);
      else await db.addProperty(propertyForm);
      await refreshSettings();
      setShowForm(false);
      showStatus('Property Asset Record Updated.');
    } catch (e: any) { showStatus(e.message, 'error'); }
    finally { setIsSaving(false); }
  };

  const handleRoomSubmit = async () => {
    if (!isSuperAdmin) {
        showStatus('Unauthorized: Super Admin access required.', 'error');
        return;
    }
    setIsSaving(true);
    try {
      const roomData = { ...roomForm, outlet_id: currentOutlet?.id || roomForm.outlet_id, property_id: currentOutlet?.property_id || roomForm.property_id };
      if (editingId) {
          await db.updateMassageRoom(editingId, roomData);
          setMassageRooms(prev => prev.map(r => r.id === editingId ? { ...r, ...roomData } as MassageRoom : r));
      } else {
          const newRoom = await db.addMassageRoom(roomData);
          if (newRoom && newRoom[0]) {
              setMassageRooms(prev => [...prev, newRoom[0]]);
          } else {
              const updatedRooms = await db.getMassageRooms(currentOutlet?.id, currentProperty?.id);
              setMassageRooms(updatedRooms);
          }
      }
      await refreshSettings();
      setShowForm(false);
      showStatus('Massage Room Record Updated.');
    } catch (e: any) { showStatus(e.message, 'error'); }
    finally { setIsSaving(false); }
  };

  const handleOutletSubmit = async () => {
    if (!isSuperAdmin) {
        showStatus('Unauthorized: Super Admin access required.', 'error');
        return;
    }
    setIsSaving(true);
    try {
      if (editingId) await db.updateOutlet(editingId, outletForm);
      else await db.addOutlet(outletForm);
      await refreshSettings();
      setShowForm(false);
      showStatus('Facility Context Updated.');
    } catch (e: any) { showStatus(e.message, 'error'); }
    finally { setIsSaving(false); }
  };

  const handleRoleSubmit = async () => {
    if (!hasPermission(user?.role_id || '', 'settings:manage_roles')) {
        showStatus('Unauthorized: Role Management clearance required.', 'error');
        return;
    }
    
    // Protect System Administrator role
    const isSuperUser = isSuperAdmin;
    if ((roleForm.id === 'admin' || roleForm.name === 'System Administrator') && !isSuperUser) {
         showStatus('Unauthorized: Only Super Admin can modify System Administrator role.', 'error');
         return;
    }

    setIsSaving(true);
    try {
      if (editingId) await db.updateRole(editingId, roleForm);
      else await db.addRole(roleForm);
      await refreshSettings();
      setShowForm(false);
      showStatus('Security Protocol Tier Committed.');
    } catch (e: any) { showStatus(e.message, 'error'); }
    finally { setIsSaving(false); }
  };

  const handleCurrencySubmit = async () => {
    if (!isSuperAdmin) {
        showStatus('Unauthorized: Super Admin access required.', 'error');
        return;
    }
    setIsSaving(true);
    try {
      if (editingId) await db.updateCurrency(editingId, currencyForm);
      else await db.addCurrency(currencyForm);
      await refreshSettings();
      setShowForm(false);
      showStatus('Monetary Standard Synchronized.');
    } catch (e: any) { showStatus(e.message, 'error'); }
    finally { setIsSaving(false); }
  };

  const handleIncentiveSubmit = async () => { 
    setIsSaving(true); 
    try { 
      if (editingId) await db.updateIncentiveRule(editingId, incentiveForm); 
      else await db.addIncentiveRule(incentiveForm); 
      setShowForm(false); 
      await loadData(); 
      showStatus('Strategic Logic Authorized.'); 
    } catch (e: any) { 
      showStatus(e.message, 'error'); 
    } finally { 
      setIsSaving(false); 
    } 
  };

  const handleNavReorder = async (id: string, direction: 'up' | 'down') => {
      if (!isSuperAdmin) {
          showStatus('Unauthorized: Super Admin access required.', 'error');
          return;
      }
      
      try {
        const order = [...currentNavOrder];
        const idx = order.indexOf(id);
        if (idx === -1) return;
        
        if (direction === 'up' && idx > 0) {
            [order[idx], order[idx-1]] = [order[idx-1], order[idx]];
        } else if (direction === 'down' && idx < order.length - 1) {
            [order[idx], order[idx+1]] = [order[idx+1], order[idx]];
        }
        
        const updated = { ...companyForm, navigation_order: order };
        setCompanyForm(updated);
        
        // Use specific update for navigation order to avoid overwriting other settings or hitting RLS issues
        await db.updateNavigationOrder(order);
        
        await refreshSettings();
        showStatus('Navigation order updated successfully.', 'success');
      } catch (e: any) {
        console.error("Navigation reorder failed:", e);
        showStatus('Failed to update navigation order: ' + e.message, 'error');
        await refreshSettings(); // Revert state
      }
  };

  const handleMembershipTypeSubmit = async () => {
    if (!currentOutlet) return;
    setIsSaving(true);
    try {
      if (editingId) await db.updateMembershipType(editingId, membershipTypeForm);
      else await db.addMembershipType({ ...membershipTypeForm, outlet_id: currentOutlet.id });
      await loadData();
      setShowForm(false);
      showStatus('Membership Type configuration updated.');
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReportRecipientSubmit = async () => {
    setIsSaving(true);
    try {
      if (editingId) await db.updateReportRecipient(editingId, reportRecipientForm);
      else await db.addReportRecipient(reportRecipientForm);
      await loadData();
      setShowForm(false);
      showStatus('Report recipient configuration updated.');
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestReport = async (recipient: ReportRecipient) => {
    try {
      const property = properties.find(p => p.id === recipient.property_id);
      if (!property) throw new Error('Property context not found.');
      
      const outlet = recipient.outlet_id === 'all' ? 'all' : outlets.find(o => o.id === recipient.outlet_id);
      if (!outlet) throw new Error('Facility context not found.');

      showStatus(`Dispatching test report intelligence to ${recipient.email}...`);
      
      await db.sendTestReport(recipient.id);
      
      showStatus(`Test report intelligence successfully dispatched to ${recipient.email}.`);
      
    } catch (e: any) {
      showStatus(e.message, 'error');
    }
  };

  const handleApplyTimeToAllInProperty = async () => {
    if (!reportRecipientForm.property_id || !reportRecipientForm.send_time) {
      showStatus('Please select a property and specify a time.', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      const recipientsToUpdate = reportRecipients.filter(r => r.property_id === reportRecipientForm.property_id);
      
      if (recipientsToUpdate.length === 0) {
        showStatus('No recipients found in this property to update.', 'error');
        return;
      }
      
      await Promise.all(recipientsToUpdate.map(r => 
        db.updateReportRecipient(r.id, { ...r, send_time: reportRecipientForm.send_time })
      ));
      
      const updatedRecipients = await db.getReportRecipients();
      setReportRecipients(updatedRecipients);
      showStatus(`Successfully updated ${recipientsToUpdate.length} recipients in this property.`);
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => { 
    if (!itemToDelete) return; 
    
    const isSuper = isSuperAdmin;
    
    // Check if destructive action is allowed
    const superOnlyTypes = ['property', 'outlet', 'currency', 'report_recipient'];
    if (superOnlyTypes.includes(itemToDelete.type) && !isSuper) {
        showStatus('Unauthorized: Super Admin access required for this deletion.', 'error');
        setItemToDelete(null);
        return;
    }

    if (itemToDelete.type === 'role') {
        if (!hasPermission(user?.role_id || '', 'settings:manage_roles')) {
            showStatus('Unauthorized: Role Management clearance required for this deletion.', 'error');
            setItemToDelete(null);
            return;
        }
        // Protect System Administrator role
        if ((itemToDelete.id === 'admin' || itemToDelete.name === 'System Administrator') && !isSuper) {
             showStatus('Unauthorized: Only Super Admin can delete System Administrator role.', 'error');
             setItemToDelete(null);
             return;
        }
    }

    try { 
      if (itemToDelete.type === 'incentive') await db.deleteIncentiveRule(itemToDelete.id); 
      else if (itemToDelete.type === 'property') await db.deleteProperty(itemToDelete.id);
      else if (itemToDelete.type === 'outlet') await db.deleteOutlet(itemToDelete.id);
      else if (itemToDelete.type === 'membership_type') await db.deleteMembershipType(itemToDelete.id);
      else if (itemToDelete.type === 'role') await db.deleteRole(itemToDelete.id);
      else if (itemToDelete.type === 'currency') await db.deleteCurrency(itemToDelete.id);
      else if (itemToDelete.type === 'report_recipient') await db.deleteReportRecipient(itemToDelete.id);
      else if (itemToDelete.type === 'massage_room') {
          await db.deleteMassageRoom(itemToDelete.id);
          setMassageRooms(prev => prev.filter(r => r.id !== itemToDelete.id));
      }
      
      await loadData(); 
      await refreshSettings();
      showStatus('Record Purged.'); 
    } catch (e: any) { 
      showStatus(e.message, 'error'); 
    } finally { 
      setItemToDelete(null); 
    } 
  };

  const updateShortcut = (id: string, value: string) => {
      setCompanyForm(prev => ({
          ...prev,
          keyboard_shortcuts: {
              ...(prev.keyboard_shortcuts || {}),
              [id]: value
          }
      }));
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-indigo-600 rounded-[2.2rem] flex items-center justify-center text-white shadow-2xl ring-8 ring-indigo-50"><Settings className="w-8 h-8" /></div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">System Framework</h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Operational Control Center</p>
        </div>
      </div>
      
      <div className="flex gap-2 bg-slate-100 p-2 rounded-[2rem] w-full flex-wrap border border-slate-200/50 shadow-inner overflow-x-auto">
          {availableTabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabId); setShowForm(false); setEditingId(null); }} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-xl border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
      </div>

      {message && (
        <div className={`p-5 rounded-2xl text-xs font-black border animate-in zoom-in-95 flex items-center gap-4 shadow-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
            <ShieldCheck className="w-6 h-6"/> <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className={`${showForm ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-6 transition-all duration-500`}>
              
              {activeTab === 'massage_rooms' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-900">Massage Rooms</h2>
                <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                  <Plus className="w-4 h-4 mr-2" /> Add Room
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {massageRooms.map(room => (
                  <Card key={room.id} className="p-4 rounded-2xl border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{room.name}</h3>
                        <p className="text-xs text-slate-500">Room #{room.number}</p>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">
                          {outlets.find(o => o.id === room.outlet_id)?.name || 'No Outlet'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { 
                          setEditingId(room.id);
                          setRoomForm({
                            property_id: room.property_id,
                            outlet_id: room.outlet_id,
                            name: room.name,
                            number: room.number,
                            is_active: room.is_active
                          });
                          setShowForm(true);
                        }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setItemToDelete({ type: 'massage_room', id: room.id, name: room.name })}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'company' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-12 border-b border-slate-100"><CardTitle className="text-2xl font-black tracking-tight uppercase">Global Scope Configuration</CardTitle></CardHeader>
                      <CardContent className="p-12 space-y-12">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                              <Input label="Global Legal Name" value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="h-16 rounded-2xl font-bold border-2" />
                              <Input label="Brand Asset URL (Logo)" value={companyForm.logo_url} onChange={e => setCompanyForm({...companyForm, logo_url: e.target.value})} className="h-16 rounded-2xl font-bold border-2" />
                              <div className="md:col-span-2"><Input label="Registry HQ Address" value={companyForm.address} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} className="h-16 rounded-2xl font-bold border-2" /></div>
                              <Input label="Report Title" value={companyForm.report_title || ''} onChange={e => setCompanyForm({...companyForm, report_title: e.target.value})} className="h-16 rounded-2xl font-bold border-2" />
                              <Input label="Report Subtitle" value={companyForm.report_subtitle || ''} onChange={e => setCompanyForm({...companyForm, report_subtitle: e.target.value})} className="h-16 rounded-2xl font-bold border-2" />
                          </div>
                          <SignatoryConfig 
                            labelPrefix="Global"
                            config={companyForm.signatory_config}
                            onChange={(config) => setCompanyForm({ ...companyForm, signatory_config: config })}
                          />
                          <Button onClick={handleUpdateCompany} isLoading={isSaving} className="w-full h-20 rounded-[2.5rem] font-black text-lg uppercase bg-indigo-600 shadow-2xl">Commit Global Scope</Button>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'properties' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><MapPin className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Facility Portfolios</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setPropertyForm({name:'', logo_url:'', address:'', signatory_config: {}}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Register Asset</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Brand</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">HQ Location</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{properties.map(p => (
                                  <tr key={p.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border">{p.logo_url ? <img src={p.logo_url} className="w-full h-full object-contain p-1" /> : <Building2 className="w-6 h-6 text-slate-300" />}</div><div className="font-black text-slate-900 text-lg uppercase">{p.name}</div></div></td>
                                      <td className="px-10 py-8 font-bold text-slate-500 text-xs">{p.address}</td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(p.id); setPropertyForm({
                                          name: p.name,
                                          logo_url: p.logo_url || '',
                                          address: p.address || '',
                                          signatory_config: p.signatory_config || {}
                                      }); setShowForm(true);}} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button><button onClick={()=>setItemToDelete({type:'property', id:p.id, name:p.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div></td>
                                  </tr>
                              ))}</tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'outlets' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><Store className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Asset Contexts</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setOutletForm({name:'', property_id:'', signatory_config: {}, contract_template: '', conditions:''}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Commission Outlet</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Facility Designation</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Link</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{outlets
                                  .filter(o => !currentProperty || o.property_id === currentProperty.id)
                                  .map(o => (
                                  <tr key={o.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="font-black text-slate-900 text-lg uppercase">{o.name}</div></td>
                                      <td className="px-10 py-8"><span className="bg-indigo-50 px-3 py-1 rounded-lg text-[10px] font-black uppercase text-indigo-600 border border-indigo-100">{properties.find(p=>p.id===o.property_id)?.name || 'Detached'}</span></td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(o.id); setOutletForm({
                                          name: o.name,
                                          property_id: o.property_id,
                                          signatory_config: o.signatory_config || {},
                                          contract_template: o.contract_template || '',
                                          conditions: o.conditions || ''
                                      }); setShowForm(true);}} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button><button onClick={()=>setItemToDelete({type:'outlet', id:o.id, name:o.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div></td>
                                  </tr>
                              ))}</tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'roles' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><Shield className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Security Tiers</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setRoleForm({name:'', permissions:[]}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Define Protocol</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Tier</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clearance Vol.</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{roles.filter(r => {
                                  const isSuperUser = isSuperAdmin;
                                  // Hide System Administrator role (usually id='admin' or name='System Administrator') from non-super users
                                  if ((r.id === 'admin' || r.name === 'System Administrator') && !isSuperUser) {
                                      return false;
                                  }
                                  return true;
                              }).map(r => (
                                  <tr key={r.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="font-black text-slate-900 text-lg uppercase flex items-center gap-3">{r.name} {r.is_system && <ShieldCheck className="w-4 h-4 text-emerald-500"/>}</div></td>
                                      <td className="px-10 py-8"><span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black uppercase text-slate-500">{r.permissions.length} Privileges</span></td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(r.id); setRoleForm(r); setShowForm(true);}} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>{!r.is_system && <button onClick={()=>setItemToDelete({type:'role', id:r.id, name:r.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}</div></td>
                                  </tr>
                              ))}</tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'currency' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><Globe className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Monetary Standards</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setCurrencyForm({code:'', symbol:'', rate:1, is_default:false}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Define Unit</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ISO Code</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Rate Link</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{currencies.map(c => (
                                  <tr key={c.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="font-black text-slate-900 text-lg uppercase flex items-center gap-3">{c.code} <span className="text-indigo-600">[{c.symbol}]</span> {c.is_default && <Check className="w-4 h-4 text-emerald-500"/>}</div></td>
                                      <td className="px-10 py-8 font-bold text-slate-500 text-xs">1.00 USD = {c.rate} {c.code}</td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(c.id); setCurrencyForm(c); setShowForm(true);}} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>{!c.is_default && <button onClick={()=>setItemToDelete({type:'currency', id:c.id, name:c.code})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}</div></td>
                                  </tr>
                              ))}</tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'navigation' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center gap-3">
                          <ListOrdered className="w-8 h-8 text-indigo-600" />
                          <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">UI Architecture</CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 mb-8">
                              <p className="text-xs font-bold text-indigo-700 leading-relaxed uppercase">
                                  Rearrange the sidebar navigation order for all users. Newly added modules are appended automatically.
                              </p>
                          </div>
                          <div className="space-y-3">
                              {currentNavOrder.map((id, idx, arr) => {
                                  const item = navItems.find(n => n.id === id);
                                  if (!item) return null;
                                  return (
                                      <div key={id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                          <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                  <span className="text-xs font-black">{idx + 1}</span>
                                              </div>
                                              <span className="font-black text-slate-700 uppercase text-xs tracking-widest">{item.label}</span>
                                          </div>
                                          <div className="flex gap-2">
                                              <button onClick={() => handleNavReorder(id, 'up')} disabled={idx === 0} className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ChevronUp className="w-5 h-5" /></button>
                                              <button onClick={() => handleNavReorder(id, 'down')} disabled={idx === arr.length - 1} className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ChevronDown className="w-5 h-5" /></button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'shortcuts' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center gap-3">
                          <Keyboard className="w-8 h-8 text-indigo-600" />
                          <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Executive Hotkeys</CardTitle>
                      </CardHeader>
                      <CardContent className="p-12 space-y-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {[
                                  { id: 'nav_dashboard', label: 'Navigation: Dashboard' },
                                  { id: 'nav_members', label: 'Navigation: Members' },
                                  { id: 'nav_settings', label: 'Navigation: Settings' },
                                  { id: 'global_search', label: 'Global Search Overlay' },
                                  { id: 'action_create', label: 'Action: Create New Record' },
                                  { id: 'action_save', label: 'Action: Save/Submit Form' },
                                  { id: 'action_cancel', label: 'Action: Close/Cancel' },
                                  { id: 'action_view_contract', label: 'Action: View Contract' }
                              ].map(item => (
                                  <div key={item.id} className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">{item.label}</label>
                                      <Input 
                                        value={companyForm.keyboard_shortcuts?.[item.id] || ''} 
                                        onChange={e => updateShortcut(item.id, e.target.value)}
                                        placeholder="e.g. Alt+D"
                                        className="h-12 rounded-xl font-mono text-xs border-2"
                                      />
                                  </div>
                              ))}
                          </div>
                          <Button onClick={handleUpdateCompany} isLoading={isSaving} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl bg-indigo-600">Commit Shortcuts</Button>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'documents' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center gap-3">
                          <FileCode className="w-8 h-8 text-indigo-600" />
                          <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Audit Templates</CardTitle>
                      </CardHeader>
                      <CardContent className="p-12 space-y-10">
                          <div className="space-y-6">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership Agreement Body (Global)</label>
                                  <textarea 
                                    value={companyForm.contract_template || ''} 
                                    onChange={e => setCompanyForm({...companyForm, contract_template: e.target.value})}
                                    className="w-full min-h-[300px] p-6 rounded-2xl border-2 border-slate-100 font-medium text-sm focus:outline-none focus:border-indigo-600 transition-all custom-scrollbar"
                                    placeholder="Enter raw template text..."
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Standard Terms & Conditions (Append)</label>
                                  <textarea 
                                    value={companyForm.conditions || ''} 
                                    onChange={e => setCompanyForm({...companyForm, conditions: e.target.value})}
                                    className="w-full min-h-[150px] p-6 rounded-2xl border-2 border-slate-100 font-medium text-sm focus:outline-none focus:border-indigo-600 transition-all custom-scrollbar"
                                    placeholder="Legal boilerplate..."
                                  />
                              </div>
                          </div>
                          <Button onClick={handleUpdateCompany} isLoading={isSaving} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl bg-indigo-600">Commit Legal Schema</Button>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'booking' && (
                  <BookingSettings />
              )}

              {activeTab === 'functions' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                          <div className="flex items-center gap-5">
                              <ShieldAlert className="w-8 h-8 text-indigo-600" />
                              <div>
                                  <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Global Feature Control</CardTitle>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Define which functions are enabled for the entire organization</p>
                              </div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-8">
                          <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl mb-8 flex items-start gap-4">
                              <Info className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                              <div className="space-y-1">
                                  <p className="text-xs font-black text-amber-900 uppercase">Global Settings Visibility</p>
                                  <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                                      Use this to control which settings tabs are visible to regular administrators. 
                                      If you enable specific settings below, <b>only those settings tabs</b> will be visible to non-superadmin users. 
                                      This prevents other admins from accessing global configurations like Properties or Outlets.
                                  </p>
                              </div>
                          </div>
                          <PermissionMatrix 
                              registry={permissionRegistry.filter(g => g.id === 'settings' || g.id === 'security')} 
                              selectedPermissions={(settings?.restricted_permissions || []) as Permission[]} 
                              onChange={async (perms) => {
                                  try {
                                      const updatedSettings = { ...settings!, restricted_permissions: perms };
                                      await db.updateSettings(updatedSettings);
                                      await refreshSettings();
                                      showStatus('Feature visibility updated successfully.', 'success');
                                  } catch (e: any) {
                                      showStatus('Failed to update feature visibility: ' + e.message, 'error');
                                  }
                              }} 
                          />
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'membership_types' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><Target className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Membership Types</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setMembershipTypeForm({name:'', outlet_id: currentOutlet?.id || ''}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Define Type</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type Designation</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created At</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{membershipTypes.map(t => (
                                  <tr key={t.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="font-black text-slate-900 text-lg uppercase">{t.name}</div></td>
                                      <td className="px-10 py-8"><span className="text-[10px] font-bold text-slate-500">{new Date(t.created_at).toLocaleDateString()}</span></td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(t.id); setMembershipTypeForm({name: t.name, outlet_id: t.outlet_id}); setShowForm(true);}} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button><button onClick={()=>setItemToDelete({type:'membership_type', id:t.id, name:t.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div></td>
                                  </tr>
                              ))}</tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'maintenance' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-red-50 p-8 border-b border-red-100 flex items-center gap-3">
                          <Zap className="w-8 h-8 text-red-600" />
                          <CardTitle className="text-2xl font-black text-red-900 uppercase tracking-tighter">Terminal Operations</CardTitle>
                      </CardHeader>
                      <CardContent className="p-12 space-y-8">
                          <div className="flex items-start gap-5 p-8 bg-red-50/50 border border-red-100 rounded-[2rem]">
                              <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
                              <div>
                                  <h4 className="font-black text-red-900 uppercase tracking-tight">Destructive Mutations</h4>
                                  <p className="text-red-700/60 text-sm mt-1">Actions performed here bypass standard validation and irreversibly modify the database schema or data state.</p>
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Button variant="danger" className="h-20 rounded-3xl font-black uppercase tracking-widest"><RefreshCcw className="w-5 h-5 mr-3" /> Purge Cache & Sync</Button>
                              <Button variant="outline" className="h-20 rounded-3xl font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50"><Eraser className="w-5 h-5 mr-3" /> Hard Reset System</Button>
                          </div>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'incentives' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden min-h-[600px] flex flex-col bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><Award className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Contract Intelligence</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setIncentiveForm({ name: '', scope: 'Global', scope_id: 'global', applies_to: 'Massage', target_id: 'all', distribution_type: 'Individual', calculation_type: 'Percentage', value: 0, min_price: 0, max_price: 99999, min_duration_minutes: 0, max_duration_minutes: 999, apply_discount_percentage: true, is_active: true }); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-5 h-5 mr-2" /> Authorize Logic</Button>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 overflow-hidden">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Strategy</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Eligibility Ranges</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Yield</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Actions</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {incentiveRules.map(rule => (
                                          <tr key={rule.id} className="hover:bg-indigo-50/20 transition-all group">
                                              <td className="px-10 py-8"><div className="flex items-center gap-4 mb-2"><span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${rule.scope === 'Global' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{rule.scope}</span><div className="font-black text-slate-900 uppercase text-base">{rule.name}</div></div><p className="text-[10px] font-bold text-slate-400 uppercase">{rule.applies_to} &rarr; {rule.target_id === 'all' ? 'Catch-all' : (rule.applies_to === 'Membership' ? (rule.target_id.startsWith('type:') ? (membershipTypes.find(t => t.id === rule.target_id.replace('type:', ''))?.name + ' (Type)') : (allCategories.find(c => c.id === rule.target_id)?.name || 'Specific Tier')) : (rule.applies_to === 'Massage' ? (allMassageTypes.find(m => m.id === rule.target_id)?.name || 'Specific Treatment') : (rule.applies_to === 'Personal Training' ? (allInventory.find(i => i.id === rule.target_id)?.name || 'Specific PT Package') : 'Specific Asset')))} <span className="ml-2 text-indigo-600 font-black">[{(rule.distribution_type || 'Individual').toUpperCase()}]</span></p></td>
                                              <td className="px-10 py-8 text-center">
                                                  <div className="flex flex-col gap-1 items-center">
                                                      <span className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1"><DollarSign className="w-3 h-3 text-indigo-600"/> {formatMoney(rule.min_price || 0)} - {formatMoney(rule.max_price || 99999)}</span>
                                                      {rule.applies_to === 'Massage' && <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Timer className="w-2.5 h-2.5"/> {rule.min_duration_minutes || 0}m - {rule.max_duration_minutes || 999}m</span>}
                                                  </div>
                                              </td>
                                              <td className="px-10 py-8 text-right font-black text-indigo-600 text-base">{rule.calculation_type === 'Percentage' ? `${rule.value}%` : formatMoney(rule.value)}</td>
                                              <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-opacity"><button onClick={() => { 
                                                setEditingId(rule.id); 
                                                setIncentiveForm({
                                                  ...rule,
                                                  min_price: rule.min_price || 0,
                                                  max_price: rule.max_price || 99999,
                                                  min_duration_minutes: rule.min_duration_minutes || 0,
                                                  max_duration_minutes: rule.max_duration_minutes || 999
                                                }); 
                                                setShowForm(true); 
                                              }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button><button onClick={() => setItemToDelete({type:'incentive', id:rule.id, name:rule.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'reports_config' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5">
                              <Mail className="w-8 h-8 text-indigo-600" />
                              <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Report Distribution</CardTitle>
                          </div>
                          <Button 
                              onClick={() => { 
                                  setEditingId(null); 
                                  setReportRecipientForm({ 
                                      email: '', 
                                      property_id: '', 
                                      outlet_id: 'all', 
                                      report_type: 'revenue_recognition', 
                                      send_time: '08:00',
                                      is_active: true 
                                  }); 
                                  setShowForm(true); 
                              }} 
                              className="h-14 px-8 rounded-2xl font-black text-xs uppercase"
                          >
                              <Plus className="w-4 h-4 mr-2" /> Authorize Recipient
                          </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b">
                                  <tr>
                                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient</th>
                                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Context</th>
                                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</th>
                                      <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {reportRecipients.map(recipient => (
                                      <tr key={recipient.id} className="hover:bg-indigo-50/20 group">
                                          <td className="px-10 py-8">
                                              <div className="flex items-center gap-4">
                                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${recipient.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                      <Mail className="w-5 h-5" />
                                                  </div>
                                                  <div>
                                                      <div className="font-black text-slate-900 uppercase text-base">{recipient.email}</div>
                                                      <div className="text-[10px] font-bold text-slate-400 uppercase">{recipient.report_type.replace('_', ' ')}</div>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-10 py-8">
                                              <div className="space-y-1">
                                                  <div className="text-xs font-black text-slate-700 uppercase">{properties.find(p => p.id === recipient.property_id)?.name || 'Unknown'}</div>
                                                  <div className="text-[10px] font-bold text-slate-400 uppercase">{recipient.outlet_id === 'all' ? 'All Facilities' : outlets.find(o => o.id === recipient.outlet_id)?.name || 'Unknown'}</div>
                                              </div>
                                          </td>
                                          <td className="px-10 py-8">
                                              <div className="flex items-center gap-2 text-indigo-600 font-black text-sm">
                                                  <Clock className="w-4 h-4" />
                                                  {recipient.send_time}
                                              </div>
                                          </td>
                                          <td className="px-10 py-8 text-right">
                                              <div className="flex justify-end gap-2">
                                                  <button 
                                                      onClick={() => handleSendTestReport(recipient)}
                                                      className="p-2 text-slate-400 hover:text-indigo-600"
                                                      title="Send Test Report"
                                                  >
                                                      <Zap className="w-4 h-4" />
                                                  </button>
                                                  <button 
                                                      onClick={() => {
                                                          setEditingId(recipient.id);
                                                          setReportRecipientForm({
                                                              email: recipient.email,
                                                              property_id: recipient.property_id,
                                                              outlet_id: recipient.outlet_id,
                                                              report_type: recipient.report_type,
                                                              send_time: recipient.send_time,
                                                              is_active: recipient.is_active
                                                          });
                                                          setShowForm(true);
                                                      }}
                                                      className="p-2 text-slate-400 hover:text-indigo-600"
                                                  >
                                                      <Edit2 className="w-4 h-4" />
                                                  </button>
                                                  <button 
                                                      onClick={() => setItemToDelete({ id: recipient.id, type: 'report_recipient', name: recipient.email })}
                                                      className="p-2 text-slate-400 hover:text-red-500"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  ))}
                                  {reportRecipients.length === 0 && (
                                      <tr>
                                          <td colSpan={4} className="px-10 py-20 text-center">
                                              <div className="flex flex-col items-center gap-3">
                                                  <Mail className="w-12 h-12 text-slate-200" />
                                                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No distribution protocols defined</p>
                                              </div>
                                          </td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </CardContent>
                  </Card>
              )}
          </div>

          <div className={`${showForm ? 'lg:col-span-6' : 'hidden'} animate-in slide-in-from-right-10 duration-500`}>
              <Card className="rounded-[3.5rem] border-slate-200/60 shadow-2xl sticky top-24 overflow-hidden bg-white">
                  <CardHeader className="bg-indigo-600 text-white p-10 flex flex-col gap-1">
                      <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                        {editingId ? <Edit2 className="w-6 h-6"/> : <Plus className="w-6 h-6" />}
                        {activeTab === 'properties' ? 'Property Asset Config' : activeTab === 'outlets' ? 'Outlet Context Commission' : activeTab === 'roles' ? 'Security Policy Protocol' : activeTab === 'currency' ? 'Monetary Standard' : activeTab === 'reports_config' ? 'Distribution Protocol' : 'Management Logic'}
                      </CardTitle>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Authorized Synchronization</p>
                  </CardHeader>
                  <CardContent className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      {activeTab === 'properties' && (
                        <div className="space-y-6">
                            <Input label="Portfolio Designation *" value={propertyForm.name} onChange={e => setPropertyForm({...propertyForm, name: e.target.value})} className="h-14 rounded-xl" />
                            <Input label="Brand Asset URL" value={propertyForm.logo_url} onChange={e => setPropertyForm({...propertyForm, logo_url: e.target.value})} className="h-14 rounded-xl" />
                            <Input label="HQ Physical Address" value={propertyForm.address} onChange={e => setPropertyForm({...propertyForm, address: e.target.value})} className="h-14 rounded-xl" />
                            <SignatoryConfig 
                                labelPrefix="Property"
                                config={propertyForm.signatory_config}
                                onChange={(config) => setPropertyForm({ ...propertyForm, signatory_config: config })}
                            />
                            <Button onClick={handlePropertySubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">Commit Asset</Button>
                        </div>
                      )}
                      {activeTab === 'massage_rooms' && (
                        <div className="space-y-6">
                            <Select 
                              label="Linked Facility Outlet *" 
                              options={[
                                {value:'', label:'Select Outlet...'}, 
                                ...outlets
                                  .filter(o => !currentProperty || o.property_id === currentProperty.id)
                                  .map(o=>({value:o.id, label:o.name}))
                              ]} 
                              value={roomForm.outlet_id} 
                              onChange={e => {
                                const selectedOutlet = outlets.find(o => o.id === e.target.value);
                                setRoomForm({...roomForm, outlet_id: e.target.value, property_id: selectedOutlet?.property_id || ''});
                            }} className="h-14 rounded-xl" />
                            <Input label="Room Name *" value={roomForm.name} onChange={e => setRoomForm({...roomForm, name: e.target.value})} className="h-14 rounded-xl" />
                            <Input label="Room Number *" value={roomForm.number} onChange={e => setRoomForm({...roomForm, number: e.target.value})} className="h-14 rounded-xl" />
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <input type="checkbox" checked={roomForm.is_active} onChange={e => setRoomForm({...roomForm, is_active: e.target.checked})} className="w-5 h-5 rounded border-slate-300" />
                                <span className="text-xs font-black text-slate-700 uppercase">Is Active</span>
                            </div>
                            <Button onClick={handleRoomSubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">Commit Room</Button>
                        </div>
                      )}
                      {activeTab === 'outlets' && (
                        <div className="space-y-6">
                            <Input label="Facility Name *" value={outletForm.name} onChange={e => setOutletForm({...outletForm, name: e.target.value})} className="h-14 rounded-xl font-bold" />
                            <Select label="Linked Property Portfolio" options={[{value:'', label:'Select Property...'}, ...properties.map(p=>({value:p.id, label:p.name}))]} value={outletForm.property_id} onChange={e => setOutletForm({...outletForm, property_id: e.target.value})} className="h-14 rounded-xl" />
                            <SignatoryConfig 
                                labelPrefix="Outlet"
                                config={outletForm.signatory_config}
                                onChange={(config) => setOutletForm({ ...outletForm, signatory_config: config })}
                            />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Outlet Contract Template</label>
                                <textarea 
                                    value={outletForm.contract_template || ''} 
                                    onChange={e => setOutletForm({...outletForm, contract_template: e.target.value})}
                                    className="w-full min-h-[100px] p-4 rounded-xl border-2 border-slate-100 font-medium text-xs focus:outline-none focus:border-indigo-600 transition-all"
                                    placeholder="Outlet-specific template..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Outlet Terms & Conditions</label>
                                <textarea 
                                    value={outletForm.conditions || ''} 
                                    onChange={e => setOutletForm({...outletForm, conditions: e.target.value})}
                                    className="w-full min-h-[100px] p-4 rounded-xl border-2 border-slate-100 font-medium text-xs focus:outline-none focus:border-indigo-600 transition-all"
                                    placeholder="Outlet-specific conditions..."
                                />
                            </div>
                            <Button onClick={handleOutletSubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">Deploy Outlet</Button>
                        </div>
                      )}
                      {activeTab === 'roles' && (
                          <div className="space-y-8">
                              <Input label="Protocol Designation *" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} className="h-14 rounded-xl font-black" />
                              <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <ShieldAlert className="w-5 h-5 text-indigo-600"/>
                                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Policy Ruleset</h4>
                                </div>
                                <PermissionMatrix registry={permissionRegistry} selectedPermissions={roleForm.permissions} onChange={(perms) => setRoleForm({ ...roleForm, permissions: perms })} />
                              </div>
                              <Button onClick={handleRoleSubmit} className="w-full h-16 rounded-2xl font-black uppercase tracking-widest bg-indigo-600 shadow-xl shadow-indigo-100">Deploy Security Tier</Button>
                          </div>
                      )}
                      {activeTab === 'currency' && (
                        <div className="space-y-6">
                            <Input label="ISO Currency Code *" value={currencyForm.code} onChange={e => setCurrencyForm({...currencyForm, code: e.target.value.toUpperCase()})} placeholder="e.g. QAR" className="h-14 rounded-xl" />
                            <Input label="Graphic Symbol *" value={currencyForm.symbol} onChange={e => setCurrencyForm({...currencyForm, symbol: e.target.value})} placeholder="e.g. ر.ق" className="h-14 rounded-xl" />
                            <Input label="Exchange Rate (Rel. to USD)" type="number" value={currencyForm.rate} onChange={e => setCurrencyForm({...currencyForm, rate: parseFloat(e.target.value) || 1})} className="h-14 rounded-xl" />
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <input type="checkbox" checked={currencyForm.is_default} onChange={e => setCurrencyForm({...currencyForm, is_default: e.target.checked})} className="w-5 h-5 rounded border-slate-300" />
                                <span className="text-xs font-black text-slate-700 uppercase">Set as System Base Currency</span>
                            </div>
                            <Button onClick={handleCurrencySubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">Sync Standard</Button>
                        </div>
                      )}
                      {activeTab === 'reports_config' && (
                        <div className="space-y-6">
                            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Mail className="w-5 h-5 text-indigo-600" />
                                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Report Distribution Engine</h3>
                                </div>
                                <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                                    Configure automated daily revenue reports to be delivered via email. Reports are generated in professional PDF format and sent to the designated recipients based on property and facility access.
                                </p>
                            </div>

                            <Input 
                                label="Recipient Email Address(es) *" 
                                type="text"
                                value={reportRecipientForm.email} 
                                onChange={e => setReportRecipientForm({...reportRecipientForm, email: e.target.value})} 
                                placeholder="e.g. admin@property.com, manager@property.com"
                                className="h-14 rounded-xl font-black border-2" 
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Select 
                                    label="Target Property Context *" 
                                    options={[{value:'', label:'Select Property...'}, ...filteredProperties.map(p=>({value:p.id, label:p.name}))]} 
                                    value={reportRecipientForm.property_id} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, property_id: e.target.value, outlet_id: 'all'})} 
                                    className="h-14 rounded-xl border-2" 
                                />
                                <Select 
                                    label="Facility Access *" 
                                    options={[
                                        {value:'all', label:'All Facilities (Consolidated)'}, 
                                        ...filteredOutletsForForm.map(o=>({value:o.id, label:o.name}))
                                    ]} 
                                    value={reportRecipientForm.outlet_id} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, outlet_id: e.target.value})} 
                                    disabled={!reportRecipientForm.property_id}
                                    className="h-14 rounded-xl border-2" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Select 
                                    label="Report Send Day *" 
                                    options={[
                                        {value:'Monday', label:'Monday'},
                                        {value:'Tuesday', label:'Tuesday'},
                                        {value:'Wednesday', label:'Wednesday'},
                                        {value:'Thursday', label:'Thursday'},
                                        {value:'Friday', label:'Friday'},
                                        {value:'Saturday', label:'Saturday'},
                                        {value:'Sunday', label:'Sunday'}
                                    ]} 
                                    value={reportRecipientForm.send_day || 'Monday'} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, send_day: e.target.value})} 
                                    className="h-14 rounded-xl border-2" 
                                />
                                <Select 
                                    label="Strategic Report Type *" 
                                    options={[
                                        {value:'revenue_recognition', label:'Revenue Recognition'},
                                        {value:'incentives', label:'Incentive Audit'},
                                        {value:'daily_sales', label:'Daily Sales Ledger'},
                                        {value:'members_joined', label:'Members Joined'},
                                        {value:'expiring_memberships', label:'Expiring Memberships'},
                                        {value:'massage_room_revenue', label:'Massage Room Revenue'}
                                    ]} 
                                    value={reportRecipientForm.report_type} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, report_type: e.target.value as any})} 
                                    className="h-14 rounded-xl border-2" 
                                />
                            </div>
                            
                            {reportRecipientForm.report_type === 'daily_sales' && (
                                <Select 
                                    label="Report Date Context *" 
                                    options={[
                                        {value:'today', label:'Today'},
                                        {value:'yesterday', label:'Yesterday'}
                                    ]} 
                                    value={reportRecipientForm.report_date_type || 'today'} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, report_date_type: e.target.value as any})} 
                                    className="h-14 rounded-xl border-2" 
                                />
                            )}
                            
                            <div className="space-y-1.5">
                                <Input 
                                    label="Scheduled Dispatch Time *" 
                                    type="time"
                                    value={reportRecipientForm.send_time} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, send_time: e.target.value})} 
                                    className="h-14 rounded-xl font-black border-2" 
                                />
                                {isSuperAdmin && reportRecipientForm.property_id && (
                                    <button 
                                        type="button"
                                        onClick={handleApplyTimeToAllInProperty}
                                        disabled={isSaving}
                                        className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors flex items-center gap-1 ml-1"
                                    >
                                        <RefreshCcw className="w-2.5 h-2.5" /> Apply to All in Property
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 h-14">
                                <input 
                                    type="checkbox" 
                                    checked={reportRecipientForm.is_active} 
                                    onChange={e => setReportRecipientForm({...reportRecipientForm, is_active: e.target.checked})} 
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Active Distribution</span>
                            </div>

                            <Button 
                                onClick={handleReportRecipientSubmit} 
                                disabled={!reportRecipientForm.email || !reportRecipientForm.property_id || isSaving}
                                className="w-full h-16 rounded-2xl font-black uppercase shadow-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Synchronizing...' : (editingId ? 'Update Distribution' : 'Authorize Recipient')}
                            </Button>
                        </div>
                      )}
                      {activeTab === 'incentives' && (
                         <div className="space-y-6">
                              <Input label="Strategic Designation *" value={incentiveForm.name} onChange={e => setIncentiveForm({...incentiveForm, name: e.target.value})} className="h-14 rounded-xl font-black border-2" />
                              <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1 flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Recognition Distribution</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-12">
                                        <button type="button" onClick={() => setIncentiveForm({...incentiveForm, distribution_type: 'Individual'})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${incentiveForm.distribution_type === 'Individual' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}><User className="w-3 h-3" /> Individual</button>
                                        <button type="button" onClick={() => setIncentiveForm({...incentiveForm, distribution_type: 'Shared'})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${incentiveForm.distribution_type === 'Shared' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}><Users className="w-3 h-3" /> Shared Pool</button>
                                    </div>
                              </div>
                              <Select label="Governance Scope" options={[{value:'Global', label:'Global (Portfolio)'}, {value:'Property', label:'Property-Specific'}, {value:'Outlet', label:'Facility-Specific'}]} value={incentiveForm.scope} onChange={e => setIncentiveForm({...incentiveForm, scope: e.target.value as any, scope_id: e.target.value === 'Global' ? 'global' : ''})} className="h-14 rounded-xl border-2" />
                              
                              {incentiveForm.scope === 'Property' && (
                                <Select label="Target Property Portfolio *" options={[{value:'', label:'Select Property...'}, ...properties.map(p=>({value:p.id, label:p.name}))]} value={incentiveForm.scope_id} onChange={e => setIncentiveForm({...incentiveForm, scope_id: e.target.value})} className="h-14 rounded-xl border-2 animate-in slide-in-from-top-2" />
                              )}
                              {incentiveForm.scope === 'Outlet' && (
                                <Select label="Target Facility Context *" options={[{value:'', label:'Select Outlet...'}, ...outlets.map(o=>({value:o.id, label:`${o.name} - ${properties.find(p => p.id === o.property_id)?.name || 'Unknown'}`}))]} value={incentiveForm.scope_id} onChange={e => setIncentiveForm({...incentiveForm, scope_id: e.target.value})} className="h-14 rounded-xl border-2 animate-in slide-in-from-top-2" />
                              )}

                              <Select label="Recognition Department" options={[{value:'Massage', label:'Treatment Services'}, {value:'Membership', label:'Membership Enrollments'}, {value:'Personal Training', label:'Personal Training'}, {value:'Sale', label:'POS & Retail'}]} value={incentiveForm.applies_to} onChange={e => setIncentiveForm({...incentiveForm, applies_to: e.target.value as any, target_id: 'all'})} className="h-14 rounded-xl border-2" />
                              
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Strategic Target (Tier/Type/Treatment)</label>
                                  <div className="relative">
                                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                      <select 
                                        value={incentiveForm.target_id} 
                                        onChange={e => setIncentiveForm({...incentiveForm, target_id: e.target.value})}
                                        className="w-full h-14 pl-12 pr-4 rounded-xl bg-white border-2 border-slate-100 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 appearance-none"
                                      >
                                          <option value="all">Apply to All Assets in Dept</option>
                                          {incentiveForm.applies_to === 'Membership' && (
                                              <>
                                                  <optgroup label="Membership Types">
                                                      {membershipTypes.map(t => (
                                                          <option key={`type-${t.id}`} value={`type:${t.id}`}>{t.name} (Type)</option>
                                                      ))}
                                                  </optgroup>
                                                  <optgroup label="Membership Tiers">
                                                      {allCategories.map(c => (
                                                          <option key={c.id} value={c.id}>{c.name} (Tier)</option>
                                                      ))}
                                                  </optgroup>
                                              </>
                                          )}
                                          {incentiveForm.applies_to === 'Massage' && allMassageTypes.map(m => (
                                              <option key={m.id} value={m.id}>{m.name} (Treatment)</option>
                                          ))}
                                          {incentiveForm.applies_to === 'Personal Training' && allInventory.filter(i => i.category === 'Personal Training').map(i => (
                                              <option key={i.id} value={i.id}>{i.name} (PT Package)</option>
                                          ))}
                                          {incentiveForm.applies_to === 'Sale' && (['Retail', 'Entrance Fee', 'Other']).map(c => (
                                              <option key={c} value={c}>{c} (Category)</option>
                                          ))}
                                      </select>
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase ml-1">Math Logic</label><div className="flex bg-slate-100 p-1 rounded-xl h-14"><button type="button" onClick={() => setIncentiveForm({...incentiveForm, calculation_type:'Percentage'})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${incentiveForm.calculation_type === 'Percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>%</button><button type="button" onClick={() => setIncentiveForm({...incentiveForm, calculation_type:'Fixed'})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${incentiveForm.calculation_type === 'Fixed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>FIXED</button></div></div>
                                  <Input label="Yield Value *" type="number" value={incentiveForm.value} onChange={e => setIncentiveForm({...incentiveForm, value: parseFloat(e.target.value) || 0})} className="h-14 rounded-xl font-black border-2" />
                                  <div className="flex items-center gap-2">
                                      <input 
                                          type="checkbox" 
                                          checked={incentiveForm.apply_discount_percentage} 
                                          onChange={e => setIncentiveForm({...incentiveForm, apply_discount_percentage: e.target.checked})}
                                          className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Apply Discount to Incentive</label>
                                  </div>
                              </div>

                              {incentiveForm.applies_to === 'Massage' && (
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        <Filter className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Eligibility Criteria</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <Input 
                                            label="Min Price Amount" 
                                            type="number" 
                                            value={incentiveForm.min_price} 
                                            onChange={e => setIncentiveForm({...incentiveForm, min_price: parseFloat(e.target.value) || 0})} 
                                            className="h-12 rounded-xl text-xs font-bold border-2" 
                                        />
                                        <Input 
                                            label="Max Price Amount" 
                                            type="number" 
                                            value={incentiveForm.max_price} 
                                            onChange={e => setIncentiveForm({...incentiveForm, max_price: parseFloat(e.target.value) || 99999})} 
                                            className="h-12 rounded-xl text-xs font-bold border-2" 
                                        />
                                    </div>
                                </div>
                              )}

                              <Button onClick={handleIncentiveSubmit} className="w-full h-16 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Authorize Logic</Button>
                          </div>
                      )}
                      {activeTab === 'membership_types' && (
                        <div className="space-y-6">
                            <Input label="Type Name *" value={membershipTypeForm.name} onChange={e => setMembershipTypeForm({...membershipTypeForm, name: e.target.value})} className="h-14 rounded-xl font-bold" />
                            <Button onClick={handleMembershipTypeSubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">{editingId ? 'Commit Changes' : 'Deploy Type'}</Button>
                        </div>
                      )}
                  </CardContent>
                  <CardHeader className="bg-slate-50 p-6 border-t flex justify-end">
                      <button onClick={() => setShowForm(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Discard Adjustments</button>
                  </CardHeader>
              </Card>
          </div>
      </div>
      
      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title={`Terminal Reset`} description={`Permanently purge '${itemToDelete?.name}' from the registry?`} confirmText="Authorize Terminal Purge" isDestructive={true} />
    </div>
  );
};

export default SettingsPage;
