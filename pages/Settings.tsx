
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { Role, Permission, Currency, CompanySettings, Outlet, Property } from '../types';
import { 
  Trash2, 
  Store, 
  Edit2, 
  X, 
  Shield, 
  ShieldCheck,
  Check,
  Eye, 
  PlusSquare, 
  FileEdit, 
  Trash, 
  Download, 
  Building2, 
  Settings, 
  AlertTriangle, 
  Save,
  PenTool,
  Globe,
  History,
  Users,
  Keyboard,
  ScrollText,
  PieChart,
  CalendarClock,
  LayoutDashboard,
  Plus,
  Coins,
  Eraser,
  DollarSign,
  Printer,
  Snowflake,
  RefreshCcw,
  EyeOff,
  Briefcase,
  ShoppingBag,
  PackageSearch,
  ChevronUp,
  ChevronDown,
  Navigation,
  Tag,
  BarChart3,
  Lock,
  Zap,
  RotateCcw
} from 'lucide-react';

const PERMISSION_REGISTRY = [
    { 
        id: 'dashboard', 
        label: 'Intelligence Terminal', 
        icon: LayoutDashboard,
        actions: [
            { id: 'view', label: 'Monitor Dashboard', icon: Eye },
            { id: 'view_financials', label: 'Financial Data Visibility', icon: DollarSign }
        ] 
    },
    { 
        id: 'bookings', 
        label: 'Resource Scheduling', 
        icon: CalendarClock,
        actions: [
            { id: 'view', label: 'View Service Grid', icon: Eye },
            { id: 'create', label: 'Authorized Booking', icon: PlusSquare },
            { id: 'edit', label: 'Modify Reservation', icon: FileEdit },
            { id: 'delete', label: 'Cancel Reservation', icon: Trash },
            { id: 'manage_resources', label: 'Manage Staff & Portfolio', icon: Briefcase }
        ] 
    },
    { 
        id: 'sales', 
        label: 'POS & Retail Engine', 
        icon: ShoppingBag,
        actions: [
            { id: 'view', label: 'View Sales Ledger', icon: Eye },
            { id: 'create', label: 'Record Transaction', icon: PlusSquare },
            { id: 'edit', label: 'Modify Transaction', icon: FileEdit },
            { id: 'delete', label: 'Void Transaction', icon: Trash }
        ] 
    },
    { 
        id: 'inventory', 
        label: 'Inventory & Tracking', 
        icon: PackageSearch,
        actions: [
            { id: 'view', label: 'Audit Stockpile', icon: Eye },
            { id: 'manage', label: 'Master Item Management', icon: FileEdit }
        ] 
    },
    { 
        id: 'members', 
        label: 'Membership Engine', 
        icon: Users,
        actions: [
            { id: 'view', label: 'Directory Access', icon: Eye },
            { id: 'view_contact_info', label: 'View Sensitive Info (Phone/Email)', icon: EyeOff },
            { id: 'create', label: 'Enrollment Power', icon: PlusSquare },
            { id: 'edit', label: 'Profile Modification', icon: FileEdit },
            { id: 'renew', label: 'Process Renewal', icon: RefreshCcw },
            { id: 'freeze', label: 'Manage Freezes', icon: Snowflake },
            { id: 'print_contract', label: 'Print Agreements', icon: Printer },
            { id: 'delete', label: 'Record Purging', icon: Trash }
        ] 
    },
    { 
        id: 'categories', 
        label: 'Revenue Tiers', 
        icon: Tag,
        actions: [
            { id: 'view', label: 'View Tiers', icon: Eye },
            { id: 'create', label: 'Deploy New Tier', icon: PlusSquare },
            { id: 'edit', label: 'Adjust Rates', icon: FileEdit },
            { id: 'delete', label: 'Decommission', icon: Trash }
        ] 
    },
    { 
        id: 'users', 
        label: 'Identity & Security', 
        icon: Shield,
        actions: [
            { id: 'view', label: 'Audit Userbase', icon: Eye },
            { id: 'create', label: 'Provision Users', icon: PlusSquare },
            { id: 'edit', label: 'Modify Profiles', icon: FileEdit },
            { id: 'edit_email', label: 'Primary Email Sync', icon: Zap },
            { id: 'delete', label: 'Revoke Identity', icon: Trash }
        ] 
    },
    { 
        id: 'properties', 
        label: 'Property Management', 
        icon: Building2,
        actions: [
            { id: 'view', label: 'View Properties', icon: Eye },
            { id: 'edit', label: 'Manage Property Assets', icon: FileEdit }
        ] 
    },
    { 
        id: 'outlets', 
        label: 'Facility Management', 
        icon: Store,
        actions: [
            { id: 'view', label: 'View Outlets', icon: Eye },
            { id: 'edit', label: 'Manage Facilities', icon: FileEdit }
        ] 
    },
    { 
        id: 'reports', 
        label: 'Financial Intelligence', 
        icon: PieChart,
        actions: [
            { id: 'view', label: 'Generate Ledgers', icon: Eye },
            { id: 'export', label: 'Export Authority (PDF)', icon: Download }
        ] 
    },
    { 
        id: 'settings', 
        label: 'System Settings & Framework', 
        icon: Settings,
        actions: [
            { id: 'view', label: 'Core Config View', icon: Eye },
            { id: 'edit', label: 'Framework Mutation', icon: FileEdit },
            { id: 'view_global', label: 'View Global Scope Tab', icon: Globe },
            { id: 'view_properties', label: 'View Properties Tab', icon: Building2 },
            { id: 'view_outlets', label: 'View Facilities Tab', icon: Store },
            { id: 'view_roles', label: 'View Security Matrix Tab', icon: ShieldCheck },
            { id: 'view_currency', label: 'View Monetary Tab', icon: Coins },
            { id: 'view_shortcuts', label: 'View Keyboard Tab', icon: Keyboard },
            { id: 'view_documents', label: 'View Global Defaults Tab', icon: ScrollText },
            { id: 'view_maintenance', label: 'View Maintenance Tab', icon: Eraser },
            { id: 'view_navigation', label: 'View Navigation Tab', icon: Navigation }
        ] 
    },
    { 
        id: 'logs', 
        label: 'Audit Integrity', 
        icon: History,
        actions: [
            { id: 'view', label: 'Access Audit Logs', icon: Eye }
        ] 
    },
];

type TabId = 'company' | 'properties' | 'roles' | 'currency' | 'outlets' | 'shortcuts' | 'documents' | 'maintenance' | 'navigation';

const SHORTCUT_DEFINITIONS = [
    { id: 'nav_dashboard', label: 'Navigate to Dashboard', default: 'Alt+D' },
    { id: 'nav_members', label: 'Navigate to Directory', default: 'Alt+M' },
    { id: 'nav_settings', label: 'Navigate to Settings', default: 'Alt+S' },
    { id: 'global_search', label: 'Focus Search Input', default: 'Alt+K' },
    { id: 'action_create', label: 'Create New Record', default: 'Alt+N' },
    { id: 'action_view_contract', label: 'Preview Member Contract', default: 'Alt+P' },
    { id: 'action_save', label: 'Save / Confirm Action', default: 'Alt+Enter' },
    { id: 'action_cancel', label: 'Cancel / Close Modal', default: 'Escape' },
];

const NAV_METADATA = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'bookings', label: 'Booking', icon: CalendarClock },
    { id: 'sales', label: 'Sales & Retail', icon: ShoppingBag },
    { id: 'categories', label: 'Membership Tiers', icon: Tag },
    { id: 'users', label: 'Users & Security', icon: Shield },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    { id: 'logs', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'System Settings', icon: Settings },
];

const SettingsPage = () => {
  const { settings, currencies, roles, outlets, properties, refreshSettings, hasPermission } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('company');

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ 
      name: '', logo_url: '', address: '', currency_id: '', 
      keyboard_shortcuts: {}, signatory_prepared_role: '', 
      signatory_reviewed_role: '', signatory_approved_role: '', 
      contract_template: '',
      navigation_order: []
  });

  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [newCurrency, setNewCurrency] = useState<Partial<Currency>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<{ name: string, permissions: Permission[] }>({ name: '', permissions: [] });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  
  const initialOutletFormState = { name: '', property_id: '', signatory_prepared_role: '', signatory_reviewed_role: '', signatory_approved_role: '', contract_template: '', conditions: '' };
  const [outletForm, setOutletForm] = useState<Partial<Outlet>>(initialOutletFormState);
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [propForm, setPropForm] = useState<Omit<Property, 'id'>>({ name: '', logo_url: '', address: '' });
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: string, id: string, name: string } | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  const canEditSettings = user && hasPermission(user.role_id, 'settings:edit');
  const canEditProperties = user && hasPermission(user.role_id, 'properties:edit');
  const canEditOutlets = user && hasPermission(user.role_id, 'outlets:edit');
  const isAdmin = user?.role_id === 'admin';

  const availableTabs = useMemo(() => {
    const tabs: { id: TabId; label: string; visible: boolean }[] = [
      { id: 'company', label: 'Global Scope', visible: !!(user && hasPermission(user.role_id, 'settings:view_global')) },
      { id: 'navigation', label: 'Navigation', visible: !!(user && hasPermission(user.role_id, 'settings:view_navigation')) },
      { id: 'properties', label: 'Properties', visible: !!(user && hasPermission(user.role_id, 'settings:view_properties')) },
      { id: 'outlets', label: 'Facilities', visible: !!(user && hasPermission(user.role_id, 'settings:view_outlets')) },
      { id: 'roles', label: 'Security Matrix', visible: !!(user && hasPermission(user.role_id, 'settings:view_roles')) },
      { id: 'currency', label: 'Monetary', visible: !!(user && hasPermission(user.role_id, 'settings:view_currency')) },
      { id: 'shortcuts', label: 'Keyboard', visible: !!(user && hasPermission(user.role_id, 'settings:view_shortcuts')) },
      { id: 'documents', label: 'Global Defaults', visible: !!(user && hasPermission(user.role_id, 'settings:view_documents')) },
      { id: 'maintenance', label: 'Maintenance', visible: !!(user && hasPermission(user.role_id, 'settings:view_maintenance')) },
    ];
    return tabs.filter(t => t.visible);
  }, [user, roles]);

  useEffect(() => { 
      if (settings) {
          const defaultOrder = NAV_METADATA.map(m => m.id);
          const currentOrder = settings.navigation_order || defaultOrder;
          
          setCompanyForm({
              ...settings,
              signatory_prepared_role: settings.signatory_prepared_role || 'Income Auditor',
              signatory_reviewed_role: settings.signatory_reviewed_role || 'Financial Controller',
              signatory_approved_role: settings.signatory_approved_role || 'Director of Finance',
              contract_template: settings.contract_template || '',
              navigation_order: currentOrder
          }); 
          setNavOrder(currentOrder);
      }
  }, [settings]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs]);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 8000);
  };

  const handleSaveProperty = async () => {
      if (!canEditProperties || !propForm.name) return;
      setIsSaving(true);
      try {
          if (editingPropId) { await db.updateProperty(editingPropId, propForm); } 
          else { await db.addProperty(propForm); }
          setPropForm({ name: '', logo_url: '', address: '' });
          setEditingPropId(null);
          await refreshSettings();
          showStatus('Property assets synchronized.');
      } catch (e: any) { showStatus(`Sync error: ${e.message}`, 'error'); } 
      finally { setIsSaving(false); }
  };

  const handleSaveOutlet = async () => {
    if (!canEditOutlets || !outletForm.name || !outletForm.property_id) return;
    setIsSaving(true);
    try {
        if (editingOutletId) { await db.updateOutlet(editingOutletId, outletForm); } 
        else { await db.addOutlet(outletForm as Omit<Outlet, 'id'>); }
        setEditingOutletId(null);
        setOutletForm(initialOutletFormState);
        await refreshSettings();
        showStatus('Facility contexts updated.');
    } catch (e: any) { showStatus(`Facility error: ${e.message}`, 'error'); } 
    finally { setIsSaving(false); }
  };

  const saveRole = async () => {
    if (!canEditSettings || !newRole.name) return;
    setIsSaving(true);
    try {
        if (editingRoleId) { await db.updateRole(editingRoleId, newRole); } 
        else { await db.addRole(newRole); }
        setNewRole({ name: '', permissions: [] });
        setEditingRoleId(null);
        setShowRoleForm(false);
        await refreshSettings();
        showStatus('Security protocol updated.');
    } catch (e: any) { showStatus(`Sync failed: ${e.message}`, 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleSaveCurrency = async () => {
    if (!canEditSettings || !newCurrency.code || !newCurrency.symbol) return;
    setIsSaving(true);
    try {
        if (editingCurrencyId) { await db.updateCurrency(editingCurrencyId, newCurrency); } 
        else { await db.addCurrency(newCurrency as Omit<Currency, 'id'>); }
        setEditingCurrencyId(null);
        setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false });
        await refreshSettings();
        showStatus('Monetary standards updated.');
    } catch (e: any) { showStatus(`Currency error: ${e.message}`, 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleDeleteConfirmed = async () => {
      if (!itemToDelete) return;
      try {
          if (itemToDelete.type === 'property') await db.deleteProperty(itemToDelete.id);
          if (itemToDelete.type === 'outlet') await db.deleteOutlet(itemToDelete.id);
          if (itemToDelete.type === 'role') await db.deleteRole(itemToDelete.id);
          if (itemToDelete.type === 'currency') await db.deleteCurrency(itemToDelete.id);
          await refreshSettings();
          showStatus(`${itemToDelete.type} removed.`);
      } catch (e: any) { showStatus(`Removal failed: ${e.message}`, 'error'); } 
      finally { setItemToDelete(null); }
  };

  const moveNavItem = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...navOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return;
      const [movedItem] = newOrder.splice(index, 1);
      newOrder.splice(targetIndex, 0, movedItem);
      setNavOrder(newOrder);
  };

  const handleSaveNavOrder = async () => {
      if (!canEditSettings) return;
      setIsSaving(true);
      try {
          await db.updateSettings({ ...companyForm, navigation_order: navOrder });
          await refreshSettings();
          showStatus('Navigation architecture synchronized.');
      } catch (e: any) {
          showStatus(`Sync error: ${e.message}`, 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleTogglePermission = (permission: Permission) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleClearMatrix = () => {
    setNewRole(prev => ({ ...prev, permissions: [] }));
  };

  const startShortcutRecording = (actionId: string) => {
    setRecordingKey(actionId);
  };

  useEffect(() => {
    if (!recordingKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        const modifiers = [];
        if (e.altKey) modifiers.push('Alt');
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Meta');
        
        const key = e.key.charAt(0).toUpperCase() + e.key.slice(1);
        if (['Alt', 'Control', 'Shift', 'Meta'].includes(key)) return;
        
        const finalShortcut = [...modifiers, key].join('+');
        setCompanyForm(prev => ({
            ...prev,
            keyboard_shortcuts: {
                ...(prev.keyboard_shortcuts || {}),
                [recordingKey]: finalShortcut
            }
        }));
        setRecordingKey(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">System Framework</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Operational Control Center</p>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit flex-wrap border border-slate-200/50">
          {availableTabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {message && (
        <div className={`${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'} p-4 rounded-xl text-xs font-black border animate-in fade-in zoom-in flex items-center gap-3 shadow-sm`}>
            {message.type === 'success' ? <ShieldCheck className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>} 
            <span>{message.text}</span>
        </div>
      )}

      {/* --- GLOBAL SCOPE TAB --- */}
      {activeTab === 'company' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Identity Branding</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <Input label="Company Name" value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="h-12 rounded-xl font-bold" />
                      <Input label="Logo URL" value={companyForm.logo_url} onChange={e => setCompanyForm({...companyForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                      <Input label="Headquarters Address" value={companyForm.address} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} className="h-12 rounded-xl" />
                      <Select label="Reporting Currency" options={currencies.map(c => ({ value: c.id, label: `${c.code} (${c.symbol})` }))} value={companyForm.currency_id} onChange={e => setCompanyForm({...companyForm, currency_id: e.target.value})} className="h-12 rounded-xl font-bold" />
                      <Button onClick={() => { db.updateSettings(companyForm); showStatus('Branding updated.'); }} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Sync Branding</Button>
                  </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-xl font-black">Audit Signatories</CardTitle><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Default Report Authorization Roles</p></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Prepared By Role</label>
                        <Input value={companyForm.signatory_prepared_role} onChange={e => setCompanyForm({...companyForm, signatory_prepared_role: e.target.value})} className="h-12 rounded-xl font-bold" placeholder="e.g. Income Auditor" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Reviewed By Role</label>
                        <Input value={companyForm.signatory_reviewed_role} onChange={e => setCompanyForm({...companyForm, signatory_reviewed_role: e.target.value})} className="h-12 rounded-xl font-bold" placeholder="e.g. Financial Controller" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Approved By Role</label>
                        <Input value={companyForm.signatory_approved_role} onChange={e => setCompanyForm({...companyForm, signatory_approved_role: e.target.value})} className="h-12 rounded-xl font-bold" placeholder="e.g. Director of Finance" />
                      </div>
                      <Button onClick={() => { db.updateSettings(companyForm); showStatus('Signatory defaults updated.'); }} variant="secondary" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200">Sync Signatories</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- NAVIGATION TAB --- */}
      {activeTab === 'navigation' && (
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden max-w-2xl mx-auto h-fit animate-in fade-in slide-in-from-top-4">
              <CardHeader className="bg-slate-950 text-white p-8 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black tracking-tight">Sidebar Architecture</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hierarchical Priority Management</p>
                  </div>
                  <Navigation className="w-8 h-8 text-slate-700" />
              </CardHeader>
              <CardContent className="p-8">
                  <div className="space-y-2 mb-10">
                      {navOrder.map((id, index) => {
                          const meta = NAV_METADATA.find(m => m.id === id);
                          if (!meta) return null;
                          return (
                              <div key={id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:shadow-xl transition-all">
                                  <div className="flex items-center gap-4">
                                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                          <meta.icon className="w-4 h-4 text-indigo-600" />
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{meta.label}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => moveNavItem(index, 'up')} disabled={index === 0} className={`p-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${index === 0 ? 'cursor-not-allowed opacity-30' : ''}`}><ChevronUp className="w-4 h-4" /></button>
                                      <button onClick={() => moveNavItem(index, 'down')} disabled={index === navOrder.length - 1} className={`p-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${index === navOrder.length - 1 ? 'cursor-not-allowed opacity-30' : ''}`}><ChevronDown className="w-4 h-4" /></button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  {canEditSettings && <Button onClick={handleSaveNavOrder} isLoading={isSaving} className="w-full h-16 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-200">Commit Navigation Priority</Button>}
              </CardContent>
          </Card>
      )}

      {/* --- PROPERTIES TAB --- */}
      {activeTab === 'properties' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Managed Assets</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      {properties.map(p => (
                          <div key={p.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs">{p.name.charAt(0)}</div>
                                  <div><h4 className="font-black text-slate-900 uppercase text-xs tracking-tight">{p.name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase">{p.address}</p></div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {canEditProperties && <button onClick={() => { setEditingPropId(p.id); setPropForm(p); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>}
                                  {canEditProperties && <button onClick={() => setItemToDelete({ type: 'property', id: p.id, name: p.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
              {canEditProperties && (
                <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                    <CardHeader className="bg-indigo-600 text-white p-8"><CardTitle className="text-xl font-black">{editingPropId ? 'Modify Asset' : 'Register Asset'}</CardTitle></CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <Input label="Name" value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} className="h-12 rounded-xl" />
                        <Input label="Address" value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} className="h-12 rounded-xl" />
                        <Input label="Logo URL" value={propForm.logo_url} onChange={e => setPropForm({...propForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                        <Button onClick={handleSaveProperty} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Commit Asset</Button>
                    </CardContent>
                </Card>
              )}
          </div>
      )}

      {/* --- FACILITIES TAB --- */}
      {activeTab === 'outlets' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Active Facilities</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      {outlets.map(o => (
                          <div key={o.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                              <div><h4 className="font-black text-slate-900 uppercase text-xs">{o.name}</h4><span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{properties.find(p => p.id === o.property_id)?.name}</span></div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {canEditOutlets && <button onClick={() => { setEditingOutletId(o.id); setOutletForm(o); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>}
                                  {canEditOutlets && <button onClick={() => setItemToDelete({ type: 'outlet', id: o.id, name: o.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
              {canEditOutlets && (
                <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                    <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-xl font-black">{editingOutletId ? 'Edit Facility' : 'New Facility'}</CardTitle></CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <Input label="Facility Name" value={outletForm.name} onChange={e => setOutletForm({...outletForm, name: e.target.value})} className="h-12 rounded-xl" />
                        <Select label="Property Mapping" options={[{value:'', label:'Select...'}, ...properties.map(p => ({value:p.id, label:p.name}))]} value={outletForm.property_id} onChange={e => setOutletForm({...outletForm, property_id: e.target.value})} className="h-12 rounded-xl" />
                        <Button onClick={handleSaveOutlet} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Commission Context</Button>
                    </CardContent>
                </Card>
              )}
          </div>
      )}

      {/* --- ROLES (SECURITY MATRIX) TAB --- */}
      {activeTab === 'roles' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex justify-between items-center">
                    <CardTitle className="text-xl font-black text-slate-900">Security Protocols</CardTitle>
                    {canEditSettings && (
                        <Button onClick={() => { setEditingRoleId(null); setNewRole({ name: '', permissions: [] }); setShowRoleForm(true); }} className="rounded-xl font-black text-[10px] uppercase tracking-widest px-6 h-10 shadow-lg shadow-indigo-100">
                            <Plus className="w-4 h-4 mr-2" /> Deploy New Protocol
                        </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {roles.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm group hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><Shield className="w-6 h-6"/></div>
                                    <div>
                                        <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">{r.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.permissions.length} Authorized Actions</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEditSettings && (isAdmin || !r.is_system) && (
                                        <button onClick={() => { setEditingRoleId(r.id); setNewRole({ name: r.name, permissions: r.permissions }); setShowRoleForm(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                    )}
                                    {canEditSettings && !r.is_system && (
                                        <button onClick={() => setItemToDelete({ type: 'role', id: r.id, name: r.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                      </div>
                  </CardContent>
              </Card>

              {showRoleForm && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <CardHeader className="bg-slate-950 text-white p-8 relative shrink-0">
                            <CardTitle className="text-xl font-black">{editingRoleId ? 'Modify Protocol' : 'Deploy New Protocol'}</CardTitle>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Security Authorization Interface</p>
                            <button onClick={() => setShowRoleForm(false)} className="absolute top-6 right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </CardHeader>
                        <CardContent className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-6">
                                    <Input label="Protocol Designation" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="h-14 rounded-2xl font-black text-lg tracking-tight shadow-sm" placeholder="e.g. Regional Director" />
                                    
                                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
                                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                                        <div>
                                            <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1">Identity Safety Protocol</h4>
                                            <p className="text-xs text-amber-800/70 font-medium leading-relaxed">Changes to high-clearance roles like Admin impact all system visibility immediately. Verified changes only.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-6 flex flex-col gap-4">
                                        <Button onClick={handleClearMatrix} variant="secondary" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 border-none shadow-sm flex items-center justify-center gap-2">
                                            <RotateCcw className="w-4 h-4" /> Clear Access Matrix
                                        </Button>
                                        <Button onClick={saveRole} isLoading={isSaving} className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100">
                                            Commit Protocol Architecture
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-indigo-600" /> Authorized Action Matrix
                                    </label>
                                    <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-6 h-[500px] overflow-y-auto custom-scrollbar space-y-8 shadow-inner">
                                        {PERMISSION_REGISTRY.map(module => (
                                            <div key={module.id} className="space-y-3">
                                                <div className="flex items-center gap-3 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm w-fit">
                                                    <module.icon className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{module.label}</span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1.5 pl-4">
                                                    {module.actions.map(action => {
                                                        const fullId = `${module.id}:${action.id}` as Permission;
                                                        const isChecked = newRole.permissions.includes(fullId);
                                                        return (
                                                            <label key={fullId} className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border group ${isChecked ? 'bg-indigo-50/50 border-indigo-100' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}>
                                                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-indigo-400'}`}>
                                                                    {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                                                </div>
                                                                <input type="checkbox" checked={isChecked} onChange={() => handleTogglePermission(fullId)} className="hidden" />
                                                                <span className={`text-[11px] font-bold uppercase tracking-tight ${isChecked ? 'text-indigo-900' : 'text-slate-400 group-hover:text-slate-600'}`}>{action.label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
              )}
          </div>
      )}

      {/* --- MONETARY TAB --- */}
      {activeTab === 'currency' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Monetary Standards</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      {currencies.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-lg font-black">{c.symbol}</div>
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <h4 className="font-black text-slate-900 uppercase text-xs">{c.code}</h4>
                                          {c.is_default && <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shadow-sm">Default Ledger</span>}
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rate: 1.00 = {c.rate.toFixed(4)}</p>
                                  </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {canEditSettings && <button onClick={() => { setEditingCurrencyId(c.id); setNewCurrency(c); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>}
                                  {canEditSettings && !c.is_default && <button onClick={() => setItemToDelete({ type: 'currency', id: c.id, name: c.code })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>

              {canEditSettings && (
                  <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                      <CardHeader className="bg-emerald-600 text-white p-8"><CardTitle className="text-xl font-black">{editingCurrencyId ? 'Modify Currency' : 'Add Currency'}</CardTitle></CardHeader>
                      <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                              <Input label="ISO Code" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl font-black" placeholder="e.g. QAR" />
                              <Input label="Symbol" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} className="h-12 rounded-xl font-black" placeholder="e.g. ر.ق" />
                          </div>
                          <Input label="Exchange Rate" type="number" value={newCurrency.rate} onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value) || 1})} className="h-12 rounded-xl font-bold" />
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                              <input type="checkbox" checked={newCurrency.is_default} onChange={e => setNewCurrency({...newCurrency, is_default: e.target.checked})} className="h-5 w-5 text-emerald-600 rounded-lg" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Primary Ledger Currency</span>
                          </label>
                          <Button onClick={handleSaveCurrency} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100 border-none">Commit Monetary Standard</Button>
                      </CardContent>
                  </Card>
              )}
          </div>
      )}

      {/* --- KEYBOARD TAB --- */}
      {activeTab === 'shortcuts' && (
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden max-w-4xl mx-auto h-fit animate-in fade-in slide-in-from-top-4">
              <CardHeader className="bg-indigo-600 text-white p-8 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black tracking-tight">Rapid Navigation</CardTitle>
                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Accelerated Operational Access</p>
                  </div>
                  <Keyboard className="w-8 h-8 text-indigo-400" />
              </CardHeader>
              <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                      {SHORTCUT_DEFINITIONS.map(sc => {
                          const currentVal = companyForm.keyboard_shortcuts?.[sc.id] || sc.default;
                          const isRecording = recordingKey === sc.id;
                          return (
                              <div key={sc.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
                                  <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{sc.label}</p>
                                      <div className="flex items-center gap-2">
                                          {currentVal.split('+').map((part, idx) => (
                                              <React.Fragment key={idx}>
                                                  <span className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black shadow-sm text-slate-600">{part}</span>
                                                  {idx < currentVal.split('+').length - 1 && <span className="text-slate-300">+</span>}
                                              </React.Fragment>
                                          ))}
                                      </div>
                                  </div>
                                  <button onClick={() => startShortcutRecording(sc.id)} className={`p-3 rounded-xl border transition-all ${isRecording ? 'bg-indigo-600 border-indigo-600 text-white animate-pulse' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 shadow-sm'}`}>
                                      {isRecording ? <span className="text-[9px] font-black uppercase">Recording...</span> : <PenTool className="w-4 h-4"/>}
                                  </button>
                              </div>
                          );
                      })}
                  </div>
                  {canEditSettings && (
                      <Button onClick={() => { db.updateSettings(companyForm); showStatus('Shortcut architecture synchronized.'); }} className="w-full h-16 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-indigo-200">Synchronize Hotkey Matrix</Button>
                  )}
              </CardContent>
          </Card>
      )}

      {/* --- GLOBAL DEFAULTS (DOCUMENTS) TAB --- */}
      {activeTab === 'documents' && (
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden max-w-4xl mx-auto h-fit animate-in fade-in slide-in-from-top-4">
              <CardHeader className="bg-slate-900 text-white p-8">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><ScrollText className="w-6 h-6 text-indigo-400" /></div>
                      <div>
                        <CardTitle className="text-xl font-black tracking-tight">Contractual Archetype</CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Default Terms & Agreement Architecture</p>
                      </div>
                  </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-2"><PenTool className="w-4 h-4 text-indigo-600" /> Master Agreement Header</label>
                      <textarea 
                        value={companyForm.contract_template} 
                        onChange={e => setCompanyForm({...companyForm, contract_template: e.target.value})} 
                        className="w-full h-40 p-6 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all custom-scrollbar"
                        placeholder="Enter the primary contractual body used for enrollment printing..."
                      />
                  </div>
                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 border-dashed">
                      <div className="flex items-center gap-3 mb-4">
                          <AlertTriangle className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900">Legal Variables Control</h4>
                      </div>
                      <p className="text-xs text-indigo-900/60 leading-relaxed font-medium">This template serves as the global baseline. Facility-specific overrides can be configured for individual outlets requiring localized conditions.</p>
                  </div>
                  {canEditSettings && (
                      <Button onClick={() => { db.updateSettings(companyForm); showStatus('Contract archetype synchronized.'); }} className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200">Synchronize Defaults</Button>
                  )}
              </CardContent>
          </Card>
      )}

      {/* --- MAINTENANCE TAB --- */}
      {activeTab === 'maintenance' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-red-50 text-red-600 p-8 border-b border-red-100">
                      <div className="flex items-center gap-4">
                          <Eraser className="w-6 h-6" />
                          <CardTitle className="text-xl font-black tracking-tight uppercase">System Sanitization</CardTitle>
                      </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="p-6 bg-red-50/30 rounded-[1.5rem] border border-red-100">
                          <h4 className="text-xs font-black text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2"><Lock className="w-3.5 h-3.5"/> Destructive Operations</h4>
                          <p className="text-xs text-red-600/70 font-medium leading-relaxed">These actions are non-reversible and will be recorded in the audit trail.</p>
                      </div>
                      <div className="space-y-4">
                          <Button variant="danger" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-50 cursor-not-allowed">Flush Audit Buffers (Logs)</Button>
                          <Button variant="danger" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-50 cursor-not-allowed">Purge Operational State</Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title={`Revoke ${itemToDelete?.type}`} description={`Are you sure you want to remove '${itemToDelete?.name}'? This action is permanent and will be logged.`} confirmText={`Confirm Removal`} isDestructive={true} />
    </div>
  );
};

export default SettingsPage;
