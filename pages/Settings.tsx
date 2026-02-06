
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
  Eye, 
  PlusSquare, 
  FileEdit, 
  Trash, 
  Download, 
  Building2, 
  Activity, 
  Coins, 
  Globe, 
  Key, 
  Settings, 
  AlertTriangle, 
  RefreshCcw, 
  UserCircle2, 
  Mail,
  ShieldCheck,
  Zap,
  Lock,
  PieChart,
  History,
  Users,
  Keyboard,
  Command,
  Database,
  FileJson,
  Plus,
  Save,
  PenTool,
  BadgeCheck
} from 'lucide-react';

const PERMISSION_REGISTRY = [
    { 
        id: 'members', 
        label: 'Membership Engine', 
        icon: Users,
        actions: [
            { id: 'view', label: 'Directory Access', icon: Eye },
            { id: 'create', label: 'Enrollment Power', icon: PlusSquare },
            { id: 'edit', label: 'Profile Modification', icon: FileEdit },
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
            { id: 'edit_email', label: 'Primary Email Sync', icon: Mail },
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

type TabId = 'company' | 'properties' | 'roles' | 'currency' | 'outlets' | 'shortcuts' | 'maintenance';

const SHORTCUT_DEFINITIONS = [
    { id: 'nav_dashboard', label: 'Navigate to Dashboard', default: 'Alt+D' },
    { id: 'nav_members', label: 'Navigate to Directory', default: 'Alt+M' },
    { id: 'nav_settings', label: 'Navigate to Settings', default: 'Alt+S' },
    { id: 'global_search', label: 'Focus Search Input', default: 'Alt+K' },
    { id: 'action_create', label: 'Create New Record', default: 'Alt+N' },
    { id: 'action_save', label: 'Save / Confirm Action', default: 'Alt+Enter' },
    { id: 'action_cancel', label: 'Cancel / Close Modal', default: 'Escape' },
];

const SettingsPage = () => {
  const { settings, currencies, roles, outlets, properties, currentOutlet, refreshSettings, hasPermission } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('company');

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ 
      name: '', 
      logo_url: '', 
      address: '', 
      currency_id: '', 
      keyboard_shortcuts: {},
      signatory_prepared_role: '',
      signatory_reviewed_role: '',
      signatory_approved_role: ''
  });
  const [newCurrency, setNewCurrency] = useState<Partial<Currency>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);

  const [newRole, setNewRole] = useState<{ name: string, permissions: Permission[] }>({ name: '', permissions: [] });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  
  const [newOutletName, setNewOutletName] = useState('');
  const [outletPropertyId, setOutletPropertyId] = useState('');
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);

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
      { id: 'maintenance', label: 'Maintenance', visible: !!canEditSettings },
    ];
    return tabs.filter(t => t.visible);
  }, [canViewSettings, canViewProperties, canViewOutlets, canManageRoles, canEditSettings]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs]);

  useEffect(() => { 
      if (settings) {
          setCompanyForm({
              ...settings,
              signatory_prepared_role: settings.signatory_prepared_role || 'Cluster Income Auditor',
              signatory_reviewed_role: settings.signatory_reviewed_role || 'Cluster Assist. Financial Controller',
              signatory_approved_role: settings.signatory_approved_role || 'Cluster Ex- Assist. Director of Finance'
          }); 
      }
  }, [settings]);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 8000);
  };

  const saveCompany = async () => {
    if (!canEditSettings) return;
    setIsSaving(true);
    try {
        await db.updateSettings(companyForm);
        await refreshSettings();
        showStatus('Framework successfully updated.');
    } catch (e: any) {
        showStatus(`Update failed: ${e.message}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleExportData = async () => {
      setIsSaving(true);
      try {
          const members = await db.getMembers(currentOutlet?.id);
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(members, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", `MemberExport_${currentOutlet?.name || 'Global'}_${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
          showStatus('System data backup successful.');
      } catch (e) {
          showStatus('Export failed. Check console for details.', 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleKeyRecord = (e: React.KeyboardEvent, actionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const parts = [];
      if (e.metaKey) parts.push('Meta');
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;
      parts.push(e.key);
      const shortcut = parts.join('+');
      setCompanyForm(prev => ({
          ...prev,
          keyboard_shortcuts: { ...prev.keyboard_shortcuts, [actionId]: shortcut }
      }));
      setRecordingKey(null);
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
    if (!canEditOutlets || !newOutletName || !outletPropertyId) return;
    setIsSaving(true);
    try {
        if (editingOutlet) { await db.updateOutlet(editingOutlet.id, { name: newOutletName, property_id: outletPropertyId }); } 
        // Fix: Corrected the call to `db.addOutlet` by passing a single object argument as required, instead of two separate arguments.
        else { await db.addOutlet({ name: newOutletName, property_id: outletPropertyId }); }
        setNewOutletName('');
        setOutletPropertyId('');
        setEditingOutlet(null);
        await refreshSettings();
        showStatus('Facility context saved.');
    } catch (e: any) { showStatus(`Facility sync failed: ${e.message}`, 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleTogglePermission = (permission: Permission) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
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
          showStatus(`${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} removed.`);
      } catch (e: any) {
          showStatus(`Removal failed: ${e.message}`, 'error');
      } finally {
          setItemToDelete(null);
      }
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
        <div className={`${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'} p-5 rounded-3xl text-xs font-black border animate-in fade-in zoom-in flex items-center gap-3 shadow-sm`}>
            {message.type === 'success' ? <ShieldCheck className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5 shrink-0"/>} 
            <span className="leading-relaxed">{message.text}</span>
        </div>
      )}

      {/* GLOBAL SCOPE TAB */}
      {activeTab === 'company' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Globe className="w-5 h-5 text-indigo-600" /> Identity Branding
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company / Group Name</label>
                                <Input value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="h-12 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corporate Logo Endpoint (URL)</label>
                                <Input value={companyForm.logo_url} onChange={e => setCompanyForm({...companyForm, logo_url: e.target.value})} className="h-12 rounded-xl font-medium" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Headquarters Address</label>
                            <Input value={companyForm.address} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} className="h-12 rounded-xl font-medium" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Reporting Currency</label>
                            <Select 
                                options={currencies.map(c => ({ value: c.id, label: `${c.code} (${c.symbol}) - System Standard` }))} 
                                value={companyForm.currency_id} 
                                onChange={e => setCompanyForm({...companyForm, currency_id: e.target.value})}
                                className="h-12 rounded-xl font-bold"
                            />
                          </div>
                      </CardContent>
                  </Card>

                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <PenTool className="w-5 h-5 text-indigo-600" /> Signatory Configuration
                        </CardTitle>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Designated roles for financial reports</p>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prepared By Role</label>
                                <Input value={companyForm.signatory_prepared_role} onChange={e => setCompanyForm({...companyForm, signatory_prepared_role: e.target.value})} className="h-12 rounded-xl" placeholder="e.g. Income Auditor" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reviewed By Role</label>
                                <Input value={companyForm.signatory_reviewed_role} onChange={e => setCompanyForm({...companyForm, signatory_reviewed_role: e.target.value})} className="h-12 rounded-xl" placeholder="e.g. Financial Controller" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Approved By Role</label>
                                <Input value={companyForm.signatory_approved_role} onChange={e => setCompanyForm({...companyForm, signatory_approved_role: e.target.value})} className="h-12 rounded-xl" placeholder="e.g. Director of Finance" />
                            </div>
                        </div>
                      </CardContent>
                      <div className="bg-slate-50 p-6 flex justify-end">
                        <Button onClick={saveCompany} isLoading={isSaving} className="h-12 px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                           <Save className="w-4 h-4 mr-2" /> Sync Framework
                        </Button>
                      </div>
                  </Card>
              </div>

              <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                    <h4 className="text-xl font-black tracking-tight mb-4 relative z-10">Asset Integrity</h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6 relative z-10">
                        Changes to the Global Scope propagate across all facilities and financial ledgers. Ensure Legal Identity and Currency standards align with corporate requirements.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest">
                       <BadgeCheck className="w-3 h-3 text-emerald-400" /> Authorized Administrator
                    </div>
                  </div>
              </div>
          </div>
      )}

      {/* PROPERTIES TAB */}
      {activeTab === 'properties' && canViewProperties && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                      <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-indigo-600" /> Asset Management
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                      <div className="space-y-6">
                          {properties.map(p => (
                              <div key={p.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 group">
                                  <div className="flex items-center gap-4">
                                      {p.logo_url ? (
                                          <img src={p.logo_url} className="w-12 h-12 rounded-xl object-contain bg-white border shadow-sm" alt="" />
                                      ) : (
                                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border text-slate-300">
                                              <Building2 className="w-6 h-6" />
                                          </div>
                                      )}
                                      <div>
                                          <h4 className="font-black text-slate-900 uppercase tracking-tight">{p.name}</h4>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{p.address}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setPropForm(p); setEditingPropId(p.id); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                      <button onClick={() => setItemToDelete({ type: 'property', id: p.id, name: p.name })} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-indigo-600 text-white p-8">
                      <CardTitle className="text-xl font-black tracking-tight">{editingPropId ? 'Modify Asset' : 'Add Property Asset'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <Input label="Asset Name" value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} className="h-12 rounded-xl font-bold" />
                      <Input label="Logo Endpoint (URL)" value={propForm.logo_url} onChange={e => setPropForm({...propForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                      <Input label="Asset Location / Address" value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} className="h-12 rounded-xl" />
                      <div className="flex gap-3 pt-4">
                          {editingPropId && (
                              <Button variant="secondary" onClick={() => { setEditingPropId(null); setPropForm({name:'', logo_url:'', address:''}); }} className="h-14 rounded-2xl font-bold flex-1">Cancel</Button>
                          )}
                          <Button onClick={handleSaveProperty} isLoading={isSaving} className="h-14 rounded-2xl font-black flex-1 shadow-lg shadow-indigo-100">
                             {editingPropId ? 'Sync Updates' : 'Add Asset'}
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* OUTLETS TAB */}
      {activeTab === 'outlets' && canViewOutlets && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                      <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                          <Store className="w-5 h-5 text-indigo-600" /> Facility Contexts
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                      <div className="space-y-4">
                          {outlets.map(o => {
                              const prop = properties.find(p => p.id === o.property_id);
                              return (
                                  <div key={o.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 group shadow-sm">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs">
                                              {o.name.charAt(0)}
                                          </div>
                                          <div>
                                              <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{o.name}</h4>
                                              <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{prop?.name || 'Unassigned'}</span>
                                          </div>
                                      </div>
                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => { setEditingOutlet(o); setNewOutletName(o.name); setOutletPropertyId(o.property_id); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                          <button onClick={() => setItemToDelete({ type: 'outlet', id: o.id, name: o.name })} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8">
                      <CardTitle className="text-xl font-black tracking-tight">{editingOutlet ? 'Modify Facility' : 'Commission New Facility'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Facility Name</label>
                        <Input value={newOutletName} onChange={e => setNewOutletName(e.target.value)} className="h-12 rounded-xl font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign to Property Asset</label>
                        <Select 
                            options={[{ value: '', label: 'Select Property...' }, ...properties.map(p => ({ value: p.id, label: p.name }))]} 
                            value={outletPropertyId} 
                            onChange={e => setOutletPropertyId(e.target.value)}
                            className="h-12 rounded-xl font-bold"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                          {editingOutlet && (
                              <Button variant="secondary" onClick={() => { setEditingOutlet(null); setNewOutletName(''); setOutletPropertyId(''); }} className="h-14 rounded-2xl font-bold flex-1">Cancel</Button>
                          )}
                          <Button onClick={handleSaveOutlet} isLoading={isSaving} className="h-14 rounded-2xl font-black flex-1 shadow-lg shadow-indigo-100">
                             {editingOutlet ? 'Sync Facility' : 'Commission Facility'}
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* SECURITY MATRIX (ROLES) TAB */}
      {activeTab === 'roles' && canManageRoles && (
          <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                          <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                              <Shield className="w-5 h-5 text-indigo-600" /> Security Directory
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8">
                          <div className="space-y-4">
                              {roles.map(r => (
                                  <div key={r.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 group shadow-sm transition-all hover:border-indigo-200">
                                      <div className="flex items-center gap-4">
                                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${r.is_system ? 'bg-indigo-600 shadow-indigo-100' : 'bg-slate-900 shadow-slate-100'} shadow-lg`}>
                                              <Lock className="w-4 h-4" />
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{r.name}</h4>
                                                  {r.is_system && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Protected</span>}
                                              </div>
                                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{r.permissions.length} Authorized Protocols</span>
                                          </div>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => { setEditingRoleId(r.id); setNewRole({ name: r.name, permissions: r.permissions }); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                          {!r.is_system && (
                                              <button onClick={() => setItemToDelete({ type: 'role', id: r.id, name: r.name })} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </CardContent>
                  </Card>

                  <div className="space-y-8">
                      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                          <CardHeader className="bg-slate-900 text-white p-8 flex justify-between items-center">
                              <div>
                                  <CardTitle className="text-xl font-black tracking-tight">{editingRoleId ? 'Modify Protocol' : 'Provision Security Tier'}</CardTitle>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Matrix Policy Designer</p>
                              </div>
                              <ShieldCheck className="w-8 h-8 text-indigo-400 opacity-50" />
                          </CardHeader>
                          <CardContent className="p-8 space-y-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tier Name</label>
                                <Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="h-12 rounded-xl font-bold" placeholder="e.g. Senior Auditor" />
                              </div>
                              
                              <div className="pt-4 border-t border-slate-100">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4 block">Authorized Protocol Scopes</label>
                                  <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                      {PERMISSION_REGISTRY.map(group => (
                                          <div key={group.id} className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                              <div className="flex items-center gap-2 mb-3">
                                                  <group.icon className="w-4 h-4 text-indigo-600" />
                                                  <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">{group.label}</span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                  {group.actions.map(action => {
                                                      const permId = `${group.id}:${action.id}` as Permission;
                                                      const isChecked = newRole.permissions.includes(permId);
                                                      return (
                                                          <button 
                                                              key={action.id}
                                                              onClick={() => handleTogglePermission(permId)}
                                                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isChecked ? 'bg-white border-indigo-200 text-indigo-600 shadow-sm ring-2 ring-indigo-500/5' : 'bg-slate-100 border-transparent text-slate-400 grayscale hover:grayscale-0'}`}
                                                          >
                                                              <action.icon className="w-3.5 h-3.5" />
                                                              <span className="text-[9px] font-black uppercase tracking-tighter">{action.label}</span>
                                                          </button>
                                                      );
                                                  })}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <div className="flex gap-3 pt-6">
                                  {editingRoleId && (
                                      <Button variant="secondary" onClick={() => { setEditingRoleId(null); setNewRole({name:'', permissions:[]}); }} className="h-14 rounded-2xl font-bold flex-1">Cancel</Button>
                                  )}
                                  <Button onClick={saveRole} isLoading={isSaving} className="h-14 rounded-2xl font-black flex-1 shadow-lg shadow-indigo-100">
                                     {editingRoleId ? 'Apply Protocols' : 'Deploy Tier'}
                                  </Button>
                              </div>
                          </CardContent>
                      </Card>
                  </div>
              </div>
          </div>
      )}

      {/* CURRENCY TAB */}
      {activeTab === 'currency' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                      <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                          <Coins className="w-5 h-5 text-indigo-600" /> Monetary Standards
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                      <div className="space-y-4">
                          {currencies.map(c => (
                              <div key={c.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 group shadow-sm transition-all hover:border-indigo-200">
                                  <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${c.is_default ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'} shadow-md`}>
                                          {c.symbol}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{c.code}</h4>
                                              {c.is_default && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Standard</span>}
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rate: {c.rate} Units/USD</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setEditingCurrencyId(c.id); setNewCurrency(c); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                      <button onClick={() => setItemToDelete({ type: 'currency', id: c.id, name: c.code })} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-indigo-600 text-white p-8">
                      <CardTitle className="text-xl font-black tracking-tight">{editingCurrencyId ? 'Update Standard' : 'Define Monetary Standard'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ISO Code</label>
                            <Input value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl font-bold" placeholder="USD" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Glyph (Symbol)</label>
                            <Input value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} className="h-12 rounded-xl font-black" placeholder="$" />
                          </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Exchange Rate</label>
                        <Input type="number" step="0.000001" value={newCurrency.rate} onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value) || 1})} className="h-12 rounded-xl font-bold" />
                      </div>
                      <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer group" onClick={() => setNewCurrency({...newCurrency, is_default: !newCurrency.is_default})}>
                          <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${newCurrency.is_default ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                              {newCurrency.is_default && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <span className="text-xs font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Set as Default Financial Standard</span>
                      </div>
                      <div className="flex gap-3 pt-4">
                          {editingCurrencyId && (
                              <Button variant="secondary" onClick={() => { setEditingCurrencyId(null); setNewCurrency({code:'', symbol:'', rate:1, is_default:false}); }} className="h-14 rounded-2xl font-bold flex-1">Cancel</Button>
                          )}
                          <Button onClick={handleSaveCurrency} isLoading={isSaving} className="h-14 rounded-2xl font-black flex-1 shadow-lg shadow-indigo-100">
                             {editingCurrencyId ? 'Update Standard' : 'Deploy Standard'}
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* SHORTCUTS TAB */}
      {activeTab === 'shortcuts' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex items-center justify-between">
                      <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                          <Keyboard className="w-5 h-5 text-indigo-600" /> Kinetic Accelerators
                      </CardTitle>
                      <Command className="w-6 h-6 text-slate-300" />
                  </CardHeader>
                  <CardContent className="p-8">
                      <div className="space-y-3">
                          {SHORTCUT_DEFINITIONS.map(def => {
                              const configured = companyForm.keyboard_shortcuts?.[def.id] || def.default;
                              const isRecording = recordingKey === def.id;
                              return (
                                  <div key={def.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{def.label}</span>
                                      <button 
                                        onClick={() => setRecordingKey(isRecording ? null : def.id)}
                                        onKeyDown={(e) => isRecording && handleKeyRecord(e, def.id)}
                                        className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${isRecording ? 'bg-indigo-600 text-white animate-pulse shadow-lg ring-4 ring-indigo-500/20' : 'bg-slate-100 text-indigo-600 hover:bg-slate-200'}`}
                                      >
                                          {isRecording ? 'Press Key...' : configured}
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  </CardContent>
                  <div className="bg-slate-50 p-6 flex justify-end">
                    <Button onClick={saveCompany} isLoading={isSaving} className="h-12 px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                        <Save className="w-4 h-4 mr-2" /> Commit Accelerators
                    </Button>
                  </div>
              </Card>

              <div className="space-y-6">
                <div className="bg-indigo-900 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                        <Zap className="w-40 h-40" />
                    </div>
                    <h4 className="text-2xl font-black tracking-tighter mb-4 relative z-10 leading-none">Operational Speed</h4>
                    <p className="text-indigo-200 text-sm font-medium leading-relaxed mb-8 relative z-10">
                        Configure custom keyboard triggers to bypass navigation and accelerate record entry. Ideal for high-volume audit environments.
                    </p>
                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Supports Meta, Alt, Shift combos</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Instant Global Availability</span>
                        </div>
                    </div>
                </div>
              </div>
          </div>
      )}

      {/* MAINTENANCE TAB */}
      {activeTab === 'maintenance' && canEditSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8">
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                        <Database className="w-5 h-5 text-indigo-400" /> System Integrity
                    </CardTitle>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Data Portability & Migration Tools</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-white rounded-2xl shadow-sm">
                                  <FileJson className="w-6 h-6 text-indigo-600" />
                              </div>
                              <div>
                                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Bulk Export</h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Full member repository backup</p>
                              </div>
                          </div>
                          <Button onClick={handleExportData} isLoading={isSaving} className="h-12 px-6 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-100">
                             Download JSON
                          </Button>
                      </div>

                      <div className="p-6 bg-red-50/50 rounded-3xl border border-red-100/50 flex items-start gap-4">
                          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                              <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Security Warning</h4>
                              <p className="text-xs font-medium text-red-700/70 leading-relaxed mt-1 italic">
                                Exports contain sensitive guest information and financial history. Handle backups in accordance with GDPR and corporate privacy protocols.
                              </p>
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <div className="space-y-6">
                <div className="bg-indigo-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white h-fit">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                    <History className="absolute top-[-10%] right-[-5%] w-48 h-48 opacity-10" />
                    <h4 className="text-xl font-black tracking-tight mb-4 relative z-10">Audit Readiness</h4>
                    <p className="text-indigo-200 text-xs font-bold leading-relaxed mb-6 relative z-10">
                      The maintenance suite is designed for cluster administrators to ensure facility data parity. Frequent backups are recommended before performing major tier adjustments or user re-provisioning.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest">
                       <ShieldCheck className="w-3 h-3 text-indigo-400" /> System Tier: {user?.role_id}
                    </div>
                 </div>
              </div>
          </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmationModal 
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleDeleteConfirmed}
          title={`Revoke ${itemToDelete?.type}`}
          description={`Are you sure you want to remove '${itemToDelete?.name}'? This action is permanent and may impact associated facility mappings.`}
          confirmText={`Confirm Removal`}
          isDestructive={true}
      />
    </div>
  );
};

export default SettingsPage;
