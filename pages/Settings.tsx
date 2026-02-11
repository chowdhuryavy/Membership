
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { Role, Permission, Currency, CompanySettings, Outlet, Property } from '../types';
import { 
  Trash2, 
  Check, 
  Store, 
  Edit2, 
  X, 
  Shield, 
  ShieldCheck,
  Eye, 
  PlusSquare, 
  FileEdit, 
  Trash, 
  Download, 
  Building2, 
  Settings, 
  AlertTriangle, 
  Zap,
  Save,
  PenTool,
  Globe,
  History,
  Users,
  Keyboard,
  Command,
  ArrowRight,
  ScrollText,
  ListChecks,
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
  Briefcase
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
        icon: Zap,
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
        id: 'reports', 
        label: 'Financial Intelligence', 
        icon: PieChart,
        actions: [
            { id: 'view', label: 'Generate Ledgers', icon: Eye },
            { id: 'export', label: 'Export Authority (PDF)', icon: Download }
        ] 
    },
    { 
        id: 'properties', 
        label: 'Properties', 
        icon: Building2,
        actions: [
            { id: 'view', label: 'View Properties', icon: Eye },
            { id: 'edit', label: 'Asset Management', icon: FileEdit }
        ] 
    },
    { 
        id: 'outlets', 
        label: 'Facility Contexts', 
        icon: Store,
        actions: [
            { id: 'view', label: 'View Outlets', icon: Eye },
            { id: 'edit', label: 'Facility Control', icon: FileEdit }
        ] 
    },
    { 
        id: 'settings', 
        label: 'System Framework', 
        icon: Settings,
        actions: [
            { id: 'view', label: 'Core Config View', icon: Eye },
            { id: 'edit', label: 'Framework Mutation', icon: FileEdit }
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

type TabId = 'company' | 'properties' | 'roles' | 'currency' | 'outlets' | 'shortcuts' | 'documents' | 'maintenance';

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

const SettingsPage = () => {
  const { settings, currencies, roles, outlets, properties, refreshSettings, hasPermission } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('company');

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ 
      name: '', logo_url: '', address: '', currency_id: '', 
      keyboard_shortcuts: {}, signatory_prepared_role: '', 
      signatory_reviewed_role: '', signatory_approved_role: '', 
      contract_template: '' 
  });
  const [newCurrency, setNewCurrency] = useState<Partial<Currency>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);

  const [newRole, setNewRole] = useState<{ name: string, permissions: Permission[] }>({ name: '', permissions: [] });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  
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
  const canViewProperties = user && hasPermission(user.role_id, 'properties:view');
  const canEditProperties = user && hasPermission(user.role_id, 'properties:edit');
  const canViewOutlets = user && hasPermission(user.role_id, 'outlets:view');
  const canEditOutlets = user && hasPermission(user.role_id, 'outlets:edit');
  const canManageRoles = user && hasPermission(user.role_id, 'users:edit');
  const canViewSettings = user && hasPermission(user.role_id, 'settings:view');

  const availableTabs = useMemo(() => {
    const tabs: { id: TabId; label: string; visible: boolean }[] = [
      { id: 'company', label: 'Global Scope', visible: !!canViewSettings },
      { id: 'properties', label: 'Properties', visible: !!canViewProperties },
      { id: 'outlets', label: 'Facilities', visible: !!canViewOutlets },
      { id: 'roles', label: 'Security Matrix', visible: !!canManageRoles },
      { id: 'currency', label: 'Monetary', visible: !!canViewSettings },
      { id: 'shortcuts', label: 'Keyboard', visible: !!canViewSettings },
      { id: 'documents', label: 'Global Defaults', visible: !!canViewSettings },
      { id: 'maintenance', label: 'Maintenance', visible: !!canEditSettings },
    ];
    return tabs.filter(t => t.visible);
  }, [canViewSettings, canViewProperties, canViewOutlets, canManageRoles, canEditSettings]);

  useEffect(() => { 
      if (settings) {
          setCompanyForm({
              ...settings,
              signatory_prepared_role: settings.signatory_prepared_role || 'Income Auditor',
              signatory_reviewed_role: settings.signatory_reviewed_role || 'Financial Controller',
              signatory_approved_role: settings.signatory_approved_role || 'Director of Finance',
              contract_template: settings.contract_template || ''
          }); 
      }
  }, [settings]);

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
    if (!canManageRoles || !newRole.name) return;
    setIsSaving(true);
    try {
        if (editingRoleId) { await db.updateRole(editingRoleId, newRole); } 
        else { await db.addRole(newRole); }
        setNewRole({ name: '', permissions: [] });
        setEditingRoleId(null);
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

  const handleTogglePermission = (permission: Permission) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

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
      {activeTab === 'company' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
          </div>
      )}

      {/* --- PROPERTIES TAB --- */}
      {activeTab === 'properties' && canViewProperties && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                  <button onClick={() => { setEditingPropId(p.id); setPropForm(p); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setItemToDelete({ type: 'property', id: p.id, name: p.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                  <CardHeader className="bg-indigo-600 text-white p-8"><CardTitle className="text-xl font-black">{editingPropId ? 'Modify Asset' : 'Register Asset'}</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <Input label="Name" value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} className="h-12 rounded-xl" />
                      <Input label="Address" value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} className="h-12 rounded-xl" />
                      <Input label="Logo URL" value={propForm.logo_url} onChange={e => setPropForm({...propForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                      <Button onClick={handleSaveProperty} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Commit Asset</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- FACILITIES TAB --- */}
      {activeTab === 'outlets' && canViewOutlets && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Active Facilities</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      {outlets.map(o => (
                          <div key={o.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                              <div><h4 className="font-black text-slate-900 uppercase text-xs">{o.name}</h4><span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{properties.find(p => p.id === o.property_id)?.name}</span></div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingOutletId(o.id); setOutletForm(o); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setItemToDelete({ type: 'outlet', id: o.id, name: o.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-xl font-black">{editingOutletId ? 'Edit Facility' : 'New Facility'}</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <Input label="Facility Name" value={outletForm.name} onChange={e => setOutletForm({...outletForm, name: e.target.value})} className="h-12 rounded-xl" />
                      <Select label="Property Mapping" options={[{value:'', label:'Select...'}, ...properties.map(p => ({value:p.id, label:p.name}))]} value={outletForm.property_id} onChange={e => setOutletForm({...outletForm, property_id: e.target.value})} className="h-12 rounded-xl" />
                      <Button onClick={handleSaveOutlet} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Commission Context</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- SECURITY MATRIX TAB --- */}
      {activeTab === 'roles' && canManageRoles && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                  {roles.map(r => (
                      <Card key={r.id} onClick={() => { setEditingRoleId(r.id); setNewRole(r); }} className={`cursor-pointer transition-all ${editingRoleId === r.id ? 'ring-2 ring-indigo-600 shadow-xl' : 'hover:bg-slate-50'}`}>
                          <CardContent className="p-6 flex items-center justify-between">
                              <div><h4 className="font-black text-slate-900 uppercase text-xs">{r.name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{r.permissions.length} PERMISSIONS</p></div>
                              {!r.is_system && <button onClick={(e) => { e.stopPropagation(); setItemToDelete({type:'role', id:r.id, name:r.name}); }} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>}
                          </CardContent>
                      </Card>
                  ))}
                  <Button onClick={() => { setEditingRoleId(null); setNewRole({name:'', permissions:[]}); }} variant="outline" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest border-dashed border-2 border-slate-300"><Plus className="w-4 h-4 mr-2"/> NEW SECURITY TIER</Button>
              </div>

              <Card className="lg:col-span-2 rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8 flex flex-row items-center justify-between">
                      <div><CardTitle className="text-xl font-black tracking-tight">{editingRoleId ? 'Modify Policy' : 'New Security Policy'}</CardTitle><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Granular Permission Matrix</p></div>
                      <Shield className="w-8 h-8 text-slate-700" />
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                      <Input label="Role Designation" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="h-12 rounded-xl font-black" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {PERMISSION_REGISTRY.map(module => (
                              <div key={module.id} className="space-y-3">
                                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                                      <module.icon className="w-4 h-4 text-indigo-600" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{module.label}</span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                      {module.actions.map(action => {
                                          const permId = `${module.id}:${action.id}` as Permission;
                                          const isActive = newRole.permissions.includes(permId);
                                          return (
                                              <button key={permId} onClick={() => handleTogglePermission(permId)} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                                  <div className="flex items-center gap-2"><action.icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-300'}`} /> {action.label}</div>
                                                  {isActive && <Check className="w-3 h-3" />}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>
                      <Button onClick={saveRole} isLoading={isSaving} className="w-full h-16 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-200">Authorize Policy Changes</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- MONETARY TAB --- */}
      {activeTab === 'currency' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                  <CardHeader className="p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3"><Coins className="w-5 h-5 text-indigo-600"/> Currency Standards</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      {currencies.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 group shadow-sm">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm">{c.symbol}</div>
                                  <div><h4 className="font-black text-slate-900 uppercase text-xs">{c.code}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rate: {c.rate}</p></div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingCurrencyId(c.id); setNewCurrency(c); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                  {!c.is_default && <button onClick={() => setItemToDelete({type:'currency', id:c.id, name:c.code})} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
              <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                  <CardHeader className="bg-indigo-600 text-white p-8"><CardTitle className="text-xl font-black">{editingCurrencyId ? 'Update Rate' : 'New Currency'}</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4"><Input label="ISO Code" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} /><Input label="Symbol" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} /></div>
                      <Input label="Exchange Rate (Base)" type="number" step="0.0001" value={newCurrency.rate} onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value)})} />
                      <Button onClick={handleSaveCurrency} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Save Standard</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- KEYBOARD TAB --- */}
      {activeTab === 'shortcuts' && canViewSettings && (
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden max-w-4xl mx-auto h-fit">
              <CardHeader className="bg-slate-900 text-white p-8 flex items-center justify-between">
                  <div><CardTitle className="text-xl font-black tracking-tight">Macro Configuration</CardTitle><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Accelerated Workflow Mappings</p></div>
                  <Keyboard className="w-8 h-8 text-slate-700" />
              </CardHeader>
              <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {SHORTCUT_DEFINITIONS.map(def => (
                          <div key={def.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group transition-all hover:bg-white hover:shadow-lg">
                              <div><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">{def.label}</h4><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Action Identifier: {def.id}</p></div>
                              <button onClick={() => setRecordingKey(def.id)} onKeyDown={(e) => recordingKey === def.id && (e.preventDefault(), e.stopPropagation(), setCompanyForm(prev => ({...prev, keyboard_shortcuts: {...prev.keyboard_shortcuts, [def.id]: `${e.altKey ? 'Alt+' : ''}${e.key.toUpperCase()}`}})), setRecordingKey(null))} className={`min-w-[80px] h-10 px-4 rounded-xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 ${recordingKey === def.id ? 'bg-indigo-600 border-indigo-600 text-white animate-pulse' : 'bg-white border-slate-200 text-indigo-600'}`}>
                                  {recordingKey === def.id ? 'REC...' : companyForm.keyboard_shortcuts?.[def.id] || def.default}
                              </button>
                          </div>
                      ))}
                  </div>
                  <Button onClick={() => { db.updateSettings(companyForm); showStatus('Macros synchronized.'); }} className="w-full h-16 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-100 mt-10">Deploy Macro Framework</Button>
              </CardContent>
          </Card>
      )}

      {/* --- GLOBAL DEFAULTS TAB --- */}
      {activeTab === 'documents' && canViewSettings && (
          <div className="space-y-8">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3"><ScrollText className="w-5 h-5 text-indigo-600"/> Agreement Framework</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Standard Legal Template (HTML/Markdown)</p>
                      <textarea value={companyForm.contract_template} onChange={e => setCompanyForm({...companyForm, contract_template: e.target.value})} className="w-full h-96 p-6 rounded-3xl bg-slate-50 border border-slate-100 font-mono text-[11px] focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none" placeholder="Enter base contract structure... Use {{placeholder}} for dynamic injection." />
                      <Button onClick={() => { db.updateSettings(companyForm); showStatus('Global template synchronized.'); }} className="h-14 px-12 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Commit Global Format</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* --- MAINTENANCE TAB --- */}
      {activeTab === 'maintenance' && canEditSettings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-[2.5rem] border-red-200/60 bg-red-50/20 shadow-xl h-fit border overflow-hidden">
                  <CardHeader className="bg-red-600 text-white p-8 flex items-center gap-3"><Eraser className="w-6 h-6"/><CardTitle className="text-xl font-black">Memory Purge</CardTitle></CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <p className="text-slate-600 text-sm font-medium">Resetting audit buffers will permanently remove historical system logs. This action is audited and irreversible.</p>
                      <Button variant="danger" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest">Execute Buffer Reset</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title={`Revoke ${itemToDelete?.type}`} description={`Are you sure you want to remove '${itemToDelete?.name}'? This action is permanent and will be logged.`} confirmText={`Confirm Removal`} isDestructive={true} />
    </div>
  );
};

export default SettingsPage;
