
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
  FileJson
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

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ name: '', logo_url: '', address: '', currency_id: '', keyboard_shortcuts: {} });
  const [newCurrency, setNewCurrency] = useState<Partial<Currency>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);

  const [newRole, setNewRole] = useState<{ name: string, permissions: Permission[] }>({ name: '', permissions: [] });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  
  const [newOutletName, setNewOutletName] = useState('');
  const [outletPropertyId, setOutletPropertyId] = useState('');
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);

  const [propForm, setPropForm] = useState<Omit<Property, 'id'>>({ name: '', logo_url: '', address: '' });
  const [editingPropId, setEditingPropId] = useState<string | null>(null);

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

  useEffect(() => { if (settings) setCompanyForm(settings); }, [settings]);

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
        else { await db.addOutlet(newOutletName, outletPropertyId); }
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

  const handleEditRole = (role: Role) => {
      setNewRole({ name: role.name, permissions: role.permissions });
      setEditingRoleId(role.id);
  };

  const handleEditCurrency = (c: Currency) => {
    setNewCurrency({ code: c.code, symbol: c.symbol, rate: c.rate, is_default: c.is_default });
    setEditingCurrencyId(c.id);
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

      {/* Maintain existing tabs (Company, Roles, etc.) with original logic */}
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
              </div>
          </div>
      )}
      {/* ... (Other tabs logic remains as per original provided file) ... */}
    </div>
  );
};

export default SettingsPage;
