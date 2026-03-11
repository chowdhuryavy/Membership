
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { Role, Permission, Currency, CompanySettings, Outlet, Property, IncentiveRule, MassageType, MembershipCategory, PermissionGroup, InventoryItem } from '../types';
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
  Filter
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
                     {allSelected ? 'Revoke Module' : 'Authorize Module'}
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

type TabId = 'company' | 'incentives' | 'navigation' | 'properties' | 'outlets' | 'roles' | 'currency' | 'shortcuts' | 'documents' | 'maintenance' | 'booking';

const SignatoryConfig = ({
  requiredSignatories = [],
  onChange,
  preparedRole = '',
  onPreparedRoleChange,
  reviewedRole = '',
  onReviewedRoleChange,
  approvedRole = '',
  onApprovedRoleChange,
  labelPrefix = ""
}: {
  requiredSignatories?: string[],
  onChange: (reports: string[]) => void,
  preparedRole?: string,
  onPreparedRoleChange: (val: string) => void,
  reviewedRole?: string,
  onReviewedRoleChange: (val: string) => void,
  approvedRole?: string,
  onApprovedRoleChange: (val: string) => void,
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

  const toggleReport = (id: string) => {
    if (requiredSignatories.includes(id)) {
      onChange(requiredSignatories.filter(r => r !== id));
    } else {
      onChange([...requiredSignatories, id]);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-5 h-5 text-indigo-600" />
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{labelPrefix} Signatory Protocol</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Prepared By Role" value={preparedRole} onChange={e => onPreparedRoleChange(e.target.value)} className="h-12 rounded-xl text-xs font-bold" />
        <Input label="Reviewed By Role" value={reviewedRole} onChange={e => onReviewedRoleChange(e.target.value)} className="h-12 rounded-xl text-xs font-bold" />
        <Input label="Approved By Role" value={approvedRole} onChange={e => onApprovedRoleChange(e.target.value)} className="h-12 rounded-xl text-xs font-bold" />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Required for Reports:</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {reports.map(report => (
            <div 
              key={report.id} 
              onClick={() => toggleReport(report.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${requiredSignatories.includes(report.id) ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100 hover:border-slate-200'}`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${requiredSignatories.includes(report.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'}`}>
                {requiredSignatories.includes(report.id) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-tight ${requiredSignatories.includes(report.id) ? 'text-indigo-900' : 'text-slate-600'}`}>{report.label}</span>
            </div>
          ))}
        </div>
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
      { id: 'company', label: 'Global Scope', visible: isSuper, icon: Building2 },
      { id: 'properties', label: 'Facility Portfolios', visible: isSuper, icon: MapPin },
      { id: 'outlets', label: 'Asset Contexts', visible: isSuper, icon: Store },
      { id: 'currency', label: 'Monetary Standards', visible: isSuper, icon: Globe },
      { id: 'navigation', label: 'UI Architecture', visible: isSuper, icon: ListOrdered },
      { id: 'maintenance', label: 'Maintenance', visible: isSuper, icon: Zap },
      
      // Accessible to others with permission
      { id: 'roles', label: 'Security Tiers', visible: hasPermission(user?.role_id || '', 'settings:view_roles'), icon: Shield },
      { id: 'incentives', label: 'Contract Logic', visible: hasPermission(user?.role_id || '', 'settings:view_incentives'), icon: Award },
      { id: 'shortcuts', label: 'Executive Hotkeys', visible: hasPermission(user?.role_id || '', 'settings:view_shortcuts'), icon: Keyboard },
      { id: 'documents', label: 'Audit Templates', visible: hasPermission(user?.role_id || '', 'settings:view_documents'), icon: FileCode },
      { id: 'booking', label: 'Booking Engine', visible: hasPermission(user?.role_id || '', 'settings:view_outlets'), icon: Timer },
    ].filter(t => t.visible);
  }, [user, roles, hasPermission]);

  const [activeTab, setActiveTab] = useState<TabId>(availableTabs[0]?.id as TabId || 'company');

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id as TabId);
    }
  }, [availableTabs, activeTab]);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: string, id: string, name: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

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
    signatory_prepared_role: '', 
    signatory_reviewed_role: '', 
    signatory_approved_role: '', 
    required_signatories: [],
    navigation_order: [], 
    conditions: '', 
    keyboard_shortcuts: {} 
  });
  const [propertyForm, setPropertyForm] = useState<Omit<Property, 'id'>>({ 
    name: '', 
    logo_url: '', 
    address: '',
    signatory_prepared_role: '',
    signatory_reviewed_role: '',
    signatory_approved_role: '',
    required_signatories: []
  });
  const [outletForm, setOutletForm] = useState<Omit<Outlet, 'id'>>({ 
    name: '', 
    property_id: '', 
    signatory_prepared_role: '', 
    signatory_reviewed_role: '', 
    signatory_approved_role: '', 
    required_signatories: [],
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
        signatory_prepared_role: settings.signatory_prepared_role || '',
        signatory_reviewed_role: settings.signatory_reviewed_role || '',
        signatory_approved_role: settings.signatory_approved_role || '',
        required_signatories: settings.required_signatories || [],
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
          const [rules, mTypes, allCats, inv] = await Promise.all([
              db.getIncentiveRules(), 
              db.getMassageTypes(currentOutlet.id), 
              db.getCategories(currentOutlet.id),
              db.getInventory('all', true)
          ]);
          setIncentiveRules(rules);
          setAllMassageTypes(mTypes);
          setAllCategories(allCats);
          setAllInventory(inv);
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

  const handleDeleteConfirmed = async () => { 
    if (!itemToDelete) return; 
    
    const isSuper = isSuperAdmin;
    
    // Check if destructive action is allowed
    const superOnlyTypes = ['property', 'outlet', 'currency'];
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
      else if (itemToDelete.type === 'role') await db.deleteRole(itemToDelete.id);
      else if (itemToDelete.type === 'currency') await db.deleteCurrency(itemToDelete.id);
      
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
                            requiredSignatories={companyForm.required_signatories}
                            onChange={(reports) => setCompanyForm({ ...companyForm, required_signatories: reports })}
                            preparedRole={companyForm.signatory_prepared_role}
                            onPreparedRoleChange={(val) => setCompanyForm({ ...companyForm, signatory_prepared_role: val })}
                            reviewedRole={companyForm.signatory_reviewed_role}
                            onReviewedRoleChange={(val) => setCompanyForm({ ...companyForm, signatory_reviewed_role: val })}
                            approvedRole={companyForm.signatory_approved_role}
                            onApprovedRoleChange={(val) => setCompanyForm({ ...companyForm, signatory_approved_role: val })}
                          />
                          <Button onClick={handleUpdateCompany} isLoading={isSaving} className="w-full h-20 rounded-[2.5rem] font-black text-lg uppercase bg-indigo-600 shadow-2xl">Commit Global Scope</Button>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'properties' && (
                  <Card className="rounded-[3.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-5"><MapPin className="w-8 h-8 text-indigo-600" /><CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Facility Portfolios</CardTitle></div>
                          <Button onClick={() => { setEditingId(null); setPropertyForm({name:'', logo_url:'', address:''}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Register Asset</Button>
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
                                          signatory_prepared_role: p.signatory_prepared_role || '',
                                          signatory_reviewed_role: p.signatory_reviewed_role || '',
                                          signatory_approved_role: p.signatory_approved_role || '',
                                          required_signatories: p.required_signatories || []
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
                          <Button onClick={() => { setEditingId(null); setOutletForm({name:'', property_id:'', signatory_prepared_role:'', signatory_reviewed_role:'', signatory_approved_role:'', contract_template: '', conditions:''}); setShowForm(true); }} className="h-14 px-8 rounded-2xl font-black text-xs uppercase"><Plus className="w-4 h-4 mr-2" /> Commission Outlet</Button>
                      </CardHeader>
                      <CardContent className="p-0">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b"><tr><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Facility Designation</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Link</th><th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{outlets.map(o => (
                                  <tr key={o.id} className="hover:bg-indigo-50/20 group">
                                      <td className="px-10 py-8"><div className="font-black text-slate-900 text-lg uppercase">{o.name}</div></td>
                                      <td className="px-10 py-8"><span className="bg-indigo-50 px-3 py-1 rounded-lg text-[10px] font-black uppercase text-indigo-600 border border-indigo-100">{properties.find(p=>p.id===o.property_id)?.name || 'Detached'}</span></td>
                                      <td className="px-10 py-8 text-right"><div className="flex justify-end gap-2 opacity-100 transition-all"><button onClick={()=>{setEditingId(o.id); setOutletForm({
                                          name: o.name,
                                          property_id: o.property_id,
                                          signatory_prepared_role: o.signatory_prepared_role || '',
                                          signatory_reviewed_role: o.signatory_reviewed_role || '',
                                          signatory_approved_role: o.signatory_approved_role || '',
                                          required_signatories: o.required_signatories || [],
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
                                              <td className="px-10 py-8"><div className="flex items-center gap-4 mb-2"><span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${rule.scope === 'Global' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{rule.scope}</span><div className="font-black text-slate-900 uppercase text-base">{rule.name}</div></div><p className="text-[10px] font-bold text-slate-400 uppercase">{rule.applies_to} &rarr; {rule.target_id === 'all' ? 'Catch-all' : (rule.applies_to === 'Membership' ? (allCategories.find(c => c.id === rule.target_id)?.name || 'Specific Tier') : (rule.applies_to === 'Massage' ? (allMassageTypes.find(m => m.id === rule.target_id)?.name || 'Specific Treatment') : (rule.applies_to === 'Personal Training' ? (allInventory.find(i => i.id === rule.target_id)?.name || 'Specific PT Package') : 'Specific Asset')))} <span className="ml-2 text-indigo-600 font-black">[{(rule.distribution_type || 'Individual').toUpperCase()}]</span></p></td>
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
          </div>

          <div className={`${showForm ? 'lg:col-span-6' : 'hidden'} animate-in slide-in-from-right-10 duration-500`}>
              <Card className="rounded-[3.5rem] border-slate-200/60 shadow-2xl sticky top-24 overflow-hidden bg-white">
                  <CardHeader className="bg-indigo-600 text-white p-10 flex flex-col gap-1">
                      <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                        {editingId ? <Edit2 className="w-6 h-6"/> : <Plus className="w-6 h-6" />}
                        {activeTab === 'properties' ? 'Property Asset Config' : activeTab === 'outlets' ? 'Outlet Context Commission' : activeTab === 'roles' ? 'Security Policy Protocol' : activeTab === 'currency' ? 'Monetary Standard' : 'Management Logic'}
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
                                requiredSignatories={propertyForm.required_signatories}
                                onChange={(reports) => setPropertyForm({ ...propertyForm, required_signatories: reports })}
                                preparedRole={propertyForm.signatory_prepared_role}
                                onPreparedRoleChange={(val) => setPropertyForm({ ...propertyForm, signatory_prepared_role: val })}
                                reviewedRole={propertyForm.signatory_reviewed_role}
                                onReviewedRoleChange={(val) => setPropertyForm({ ...propertyForm, signatory_reviewed_role: val })}
                                approvedRole={propertyForm.signatory_approved_role}
                                onApprovedRoleChange={(val) => setPropertyForm({ ...propertyForm, signatory_approved_role: val })}
                            />
                            <Button onClick={handlePropertySubmit} className="w-full h-16 rounded-2xl font-black uppercase shadow-xl">Commit Asset</Button>
                        </div>
                      )}
                      {activeTab === 'outlets' && (
                        <div className="space-y-6">
                            <Input label="Facility Name *" value={outletForm.name} onChange={e => setOutletForm({...outletForm, name: e.target.value})} className="h-14 rounded-xl font-bold" />
                            <Select label="Linked Property Portfolio" options={[{value:'', label:'Select Property...'}, ...properties.map(p=>({value:p.id, label:p.name}))]} value={outletForm.property_id} onChange={e => setOutletForm({...outletForm, property_id: e.target.value})} className="h-14 rounded-xl" />
                            <SignatoryConfig 
                                labelPrefix="Outlet"
                                requiredSignatories={outletForm.required_signatories}
                                onChange={(reports) => setOutletForm({ ...outletForm, required_signatories: reports })}
                                preparedRole={outletForm.signatory_prepared_role}
                                onPreparedRoleChange={(val) => setOutletForm({ ...outletForm, signatory_prepared_role: val })}
                                reviewedRole={outletForm.signatory_reviewed_role}
                                onReviewedRoleChange={(val) => setOutletForm({ ...outletForm, signatory_reviewed_role: val })}
                                approvedRole={outletForm.signatory_approved_role}
                                onApprovedRoleChange={(val) => setOutletForm({ ...outletForm, signatory_approved_role: val })}
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
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Strategic Target (Tier/Treatment)</label>
                                  <div className="relative">
                                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                      <select 
                                        value={incentiveForm.target_id} 
                                        onChange={e => setIncentiveForm({...incentiveForm, target_id: e.target.value})}
                                        className="w-full h-14 pl-12 pr-4 rounded-xl bg-white border-2 border-slate-100 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 appearance-none"
                                      >
                                          <option value="all">Apply to All Assets in Dept</option>
                                          {incentiveForm.applies_to === 'Membership' && allCategories.map(c => (
                                              <option key={c.id} value={c.id}>{c.name} (Tier)</option>
                                          ))}
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
                              </div>

                              {incentiveForm.applies_to === 'Massage' && (
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        <Filter className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Eligibility Criteria</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
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
