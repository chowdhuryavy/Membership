
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
  Users
} from 'lucide-react';

/**
 * AUTHORIZATION REGISTRY
 * To add a new feature in the future, simply add it here. 
 * The UI will automatically generate the corresponding controls.
 */
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
        label: 'Portfolio Assets', 
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

type TabId = 'company' | 'properties' | 'roles' | 'currency' | 'outlets';

const SettingsPage = () => {
  const { settings, currencies, roles, outlets, properties, refreshSettings, hasPermission } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('company');

  const [companyForm, setCompanyForm] = useState<CompanySettings>({ name: '', logo_url: '', address: '', currency_id: '' });
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
      { id: 'properties', label: 'Portfolio', visible: !!canViewProperties },
      { id: 'outlets', label: 'Facilities', visible: !!canViewOutlets },
      { id: 'roles', label: 'Security Matrix', visible: !!canManageRoles },
      { id: 'currency', label: 'Monetary', visible: !!canViewSettings },
    ];
    return tabs.filter(t => t.visible);
  }, [canViewSettings, canViewProperties, canViewOutlets, canManageRoles]);

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

  const handleSaveProperty = async () => {
      if (!canEditProperties || !propForm.name) return;
      setIsSaving(true);
      try {
          if (editingPropId) {
              await db.updateProperty(editingPropId, propForm);
          } else {
              await db.addProperty(propForm);
          }
          setPropForm({ name: '', logo_url: '', address: '' });
          setEditingPropId(null);
          await refreshSettings();
          showStatus('Property assets synchronized.');
      } catch (e: any) {
          showStatus(`Sync error: ${e.message}`, 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveOutlet = async () => {
    if (!canEditOutlets || !newOutletName || !outletPropertyId) return;
    setIsSaving(true);
    try {
        if (editingOutlet) {
          await db.updateOutlet(editingOutlet.id, { name: newOutletName, property_id: outletPropertyId });
        } else {
          await db.addOutlet(newOutletName, outletPropertyId);
        }
        setNewOutletName('');
        setOutletPropertyId('');
        setEditingOutlet(null);
        await refreshSettings();
        showStatus('Facility context saved.');
    } catch (e: any) {
        showStatus(`Facility sync failed: ${e.message}`, 'error');
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

  const saveRole = async () => {
    if (!canManageRoles || !newRole.name) return;
    setIsSaving(true);
    try {
        if (editingRoleId) {
            await db.updateRole(editingRoleId, newRole);
        } else {
            await db.addRole(newRole);
        }
        setNewRole({ name: '', permissions: [] });
        setEditingRoleId(null);
        await refreshSettings();
        showStatus('Security protocol updated.');
    } catch (e: any) {
        showStatus(`Sync failed: ${e.message}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditRole = (role: Role) => {
      setNewRole({ name: role.name, permissions: role.permissions });
      setEditingRoleId(role.id);
  };

  const handleDeleteRole = async () => {
      if (roleToDelete) {
          try {
              await db.deleteRole(roleToDelete);
              setRoleToDelete(null);
              await refreshSettings();
              showStatus('Security tier purged.');
          } catch (e: any) {
              showStatus(`Purge error: ${e.message}`, 'error');
          }
      }
  };

  const resetRoleForm = () => {
      setNewRole({ name: '', permissions: [] });
      setEditingRoleId(null);
  };

  // Fixed: Added missing handleEditCurrency to populate the currency form when an edit action is triggered.
  const handleEditCurrency = (c: Currency) => {
    setNewCurrency({ 
      code: c.code, 
      symbol: c.symbol, 
      rate: c.rate, 
      is_default: c.is_default 
    });
    setEditingCurrencyId(c.id);
  };

  const handleSaveCurrency = async () => {
    if (!canEditSettings || !newCurrency.code || !newCurrency.symbol) return;
    setIsSaving(true);
    try {
        if (editingCurrencyId) {
            await db.updateCurrency(editingCurrencyId, newCurrency);
        } else {
            await db.addCurrency(newCurrency as Omit<Currency, 'id'>);
        }
        setEditingCurrencyId(null);
        setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false });
        await new Promise(r => setTimeout(r, 500));
        await refreshSettings();
        showStatus('Monetary standards updated.');
    } catch (e: any) {
        showStatus(`Currency error: ${e.message}`, 'error');
    } finally {
        setIsSaving(false);
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
        <Button variant="outline" onClick={refreshSettings} className="rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-slate-200">
            <RefreshCcw className="w-4 h-4 mr-2" /> Live Reload
        </Button>
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

      {/* GLOBAL SETTINGS TAB */}
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
                            <UserCircle2 className="w-5 h-5 text-indigo-600" /> Signatory Authorities
                        </CardTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Roles printed on authoritative financial ledgers</p>
                      </CardHeader>
                      <CardContent className="p-8 space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level 1: Preparation</label>
                                <Input value={companyForm.signatory_prepared_role || ''} onChange={e => setCompanyForm({...companyForm, signatory_prepared_role: e.target.value})} className="h-12 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level 2: Verification</label>
                                <Input value={companyForm.signatory_reviewed_role || ''} onChange={e => setCompanyForm({...companyForm, signatory_reviewed_role: e.target.value})} className="h-12 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level 3: Executive Approval</label>
                                <Input value={companyForm.signatory_approved_role || ''} onChange={e => setCompanyForm({...companyForm, signatory_approved_role: e.target.value})} className="h-12 rounded-xl font-bold" />
                            </div>
                          </div>
                          
                          {canEditSettings && (
                            <div className="pt-6">
                              <Button onClick={saveCompany} isLoading={isSaving} className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-indigo-100">Commit Global Changes</Button>
                            </div>
                          )}
                      </CardContent>
                  </Card>
              </div>

              <div className="lg:col-span-1">
                 <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white h-fit">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                    <Lock className="absolute top-[-10%] right-[-5%] w-48 h-48 opacity-10" />
                    <h4 className="text-xl font-black tracking-tight mb-4 relative z-10">Data Integrity Protocol</h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6 relative z-10">
                      Changes to the Global Framework affect all facilities and properties instantly. Signatory adjustments are legally binding on generated reports.
                    </p>
                    <div className="space-y-4 relative z-10">
                       <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">A</div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Master Identity Sync</span>
                       </div>
                       <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">B</div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Ledger Continuity</span>
                       </div>
                    </div>
                 </div>
              </div>
          </div>
      )}

      {/* ROLES TAB - THE DYNAMIC ENGINE */}
      {activeTab === 'roles' && canManageRoles && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <Card className="lg:col-span-4 rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit animate-in slide-in-from-left-4">
                  <CardHeader className="bg-slate-900 text-white p-8">
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                        <Shield className="w-5 h-5 text-indigo-400" /> {editingRoleId ? 'Refine Protocol' : 'Deploy Protocol'}
                    </CardTitle>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Security Authorization Matrix</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Tier Designation</label>
                        <Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="e.g. Cluster Auditor" className="h-12 rounded-xl font-bold" />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Functional Clearances</label>
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                                {newRole.permissions.length} Enabled
                            </span>
                        </div>
                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar p-1">
                          {PERMISSION_REGISTRY.map(module => (
                            <div key={module.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 group hover:border-indigo-200 transition-colors">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <module.icon className="w-4 h-4" />
                                </div>
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{module.label}</h5>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {module.actions.map(action => {
                                  const perm = `${module.id}:${action.id}` as Permission;
                                  const isChecked = newRole.permissions.includes(perm);
                                  return (
                                    <button 
                                      key={action.id}
                                      type="button"
                                      onClick={() => handleTogglePermission(perm)}
                                      className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600'}`}
                                    >
                                      <div className="flex items-center gap-2">
                                         <action.icon className="w-3.5 h-3.5" /> 
                                         <span>{action.label}</span>
                                      </div>
                                      {isChecked && <Check className="w-3 h-3" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4 border-t border-slate-100">
                        {editingRoleId && <Button variant="outline" onClick={resetRoleForm} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200">Cancel</Button>}
                        <Button onClick={saveRole} isLoading={isSaving} className="flex-1 h-14 rounded-2xl font-black shadow-xl shadow-indigo-100">{editingRoleId ? 'Sync Security' : 'Deploy Identity'}</Button>
                      </div>
                  </CardContent>
              </Card>

              <div className="lg:col-span-8 space-y-6">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden animate-in slide-in-from-right-4">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                           <h3 className="text-xl font-black text-slate-900 tracking-tight">Active Security Tiers</h3>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Clearance Protocols</p>
                        </div>
                        <ShieldCheck className="w-8 h-8 text-slate-200" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <tbody className="divide-y divide-slate-100">
                                {roles.map(r => (
                                    <tr key={r.id} className="bg-white hover:bg-indigo-50/20 transition-all group">
                                        <td className="px-8 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-sm">
                                                    <Key className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 tracking-tight text-lg">{r.name}</div>
                                                    <div className="flex gap-2 mt-1.5">
                                                        {r.is_system && (
                                                            <span className="text-[9px] bg-slate-950 text-white px-2.5 py-1 rounded-lg font-black tracking-widest uppercase flex items-center gap-1.5">
                                                                <Lock className="w-2.5 h-2.5" /> Core System
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-black tracking-widest uppercase border border-indigo-100">
                                                            {r.permissions.length} Authorized Modules
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => handleEditRole(r)} className="p-3.5 text-slate-400 hover:text-indigo-600 bg-white shadow-xl rounded-2xl border border-slate-100 transition-all hover:scale-110">
                                                    <Edit2 className="w-4 h-4"/>
                                                </button>
                                                {!r.is_system && (
                                                  <button onClick={() => setRoleToDelete(r.id)} className="p-3.5 text-slate-400 hover:text-red-600 bg-white shadow-xl rounded-2xl border border-slate-100 transition-all hover:scale-110">
                                                      <Trash2 className="w-4 h-4"/>
                                                  </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
              </div>
          </div>
      )}

      {/* REMAINDER OF TABS MAINTAINED WITH IMPROVED UI TIGHTNESS */}
      {activeTab === 'properties' && canViewProperties && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {canEditProperties && (
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                    <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black tracking-tight">{editingPropId ? 'Modify Asset' : 'Register Asset'}</CardTitle></CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <Input label="Asset Branding Name" value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} className="h-12 rounded-xl font-bold" />
                        <Input label="Logo Endpoint (URL)" value={propForm.logo_url} onChange={e => setPropForm({...propForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                        <Input label="Physical Location" value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} className="h-12 rounded-xl" />
                        <Button onClick={handleSaveProperty} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black mt-4">Sync Asset Portfolio</Button>
                    </CardContent>
                </Card>
              )}
              <Card className={`${canEditProperties ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                  <table className="w-full text-sm text-left">
                      <tbody className="divide-y divide-slate-100">
                          {properties.length === 0 ? (
                              <tr><td className="px-8 py-20 text-center text-slate-400 italic font-bold">No registered properties in current portfolio.</td></tr>
                          ) : properties.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-8 py-8 flex items-center gap-6">
                                      <div className="w-16 h-16 bg-white rounded-3xl border border-slate-200 p-2 overflow-hidden flex items-center justify-center shadow-sm group-hover:shadow-indigo-100 transition-all">
                                         {p.logo_url ? <img src={p.logo_url} className="w-full h-full object-contain" /> : <Building2 className="w-8 h-8 text-slate-300" />}
                                      </div>
                                      <div>
                                          <div className="font-black text-slate-900 tracking-tight text-lg">{p.name}</div>
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.address}</div>
                                      </div>
                                  </td>
                                  {canEditProperties && (
                                    <td className="px-8 py-8 text-right">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => { setEditingPropId(p.id); setPropForm(p); }} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={() => db.deleteProperty(p.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </Card>
          </div>
      )}

      {/* OUTLETS TAB */}
      {activeTab === 'outlets' && canViewOutlets && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {canEditOutlets && (
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                            <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Store className="w-5 h-5 text-indigo-600" /> New Facility
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <Input label="Facility Designation" value={newOutletName} onChange={e => setNewOutletName(e.target.value)} className="h-12 rounded-xl font-bold" />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portfolio Hierarchy</label>
                                <Select options={[{ value: '', label: 'Assign to Portfolio...' }, ...properties.map(p => ({ value: p.id, label: p.name }))]} value={outletPropertyId} onChange={e => setOutletPropertyId(e.target.value)} className="h-12 rounded-xl font-bold" />
                            </div>
                            <Button onClick={handleSaveOutlet} isLoading={isSaving} className="w-full h-14 rounded-2xl font-black shadow-xl shadow-indigo-100 mt-4">Authorize Facility</Button>
                        </CardContent>
                    </Card>
                )}
                <Card className={`${canEditOutlets ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-slate-100">
                            {outlets.length === 0 ? (
                                <tr><td className="px-8 py-20 text-center text-slate-400 italic font-bold">Facility contexts required for operation.</td></tr>
                            ) : outlets.map(o => {
                                const parent = properties.find(p => p.id === o.property_id);
                                return (
                                    <tr key={o.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                    <Activity className="w-5 h-5"/>
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 tracking-tight text-lg">{o.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Assigned Portfolio: <span className="text-indigo-600 font-black">{parent?.name || 'Isolated'}</span></div>
                                                </div>
                                            </div>
                                        </td>
                                        {canEditOutlets && (
                                          <td className="px-8 py-8 text-right">
                                              <div className="flex justify-end gap-3">
                                                  <button onClick={() => { setEditingOutlet(o); setNewOutletName(o.name); setOutletPropertyId(o.property_id); }} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                                  <button onClick={() => db.deleteOutlet(o.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                              </div>
                                          </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
           </div>
      )}

      {/* CURRENCY TAB */}
      {activeTab === 'currency' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {canEditSettings && (
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                      <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Coins className="w-5 h-5 text-amber-500" /> Standardize Monetary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <Input label="ISO Code" placeholder="USD" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl font-bold" />
                            <Input label="Symbol" placeholder="$" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} className="h-12 rounded-xl font-bold" />
                          </div>
                          <div className="space-y-2">
                              <label className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all border border-slate-100 group shadow-inner">
                                  <input 
                                    type="checkbox" 
                                    checked={newCurrency.is_default} 
                                    onChange={e => setNewCurrency({...newCurrency, is_default: e.target.checked})}
                                    className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                                  />
                                  <div>
                                     <p className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">System Default</p>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Force as primary reporting standard</p>
                                  </div>
                              </label>
                          </div>
                          <div className="flex gap-2">
                              {editingCurrencyId && <Button variant="outline" onClick={() => { setEditingCurrencyId(null); setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false }); }} className="flex-1 h-14 rounded-2xl font-black">Cancel</Button>}
                              <Button onClick={handleSaveCurrency} isLoading={isSaving} className="flex-1 h-14 rounded-2xl font-black shadow-xl shadow-amber-100">{editingCurrencyId ? 'Commit' : 'Deploy Standard'}</Button>
                          </div>
                      </CardContent>
                  </Card>
              )}
              <Card className={`${canEditSettings ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                  <table className="w-full text-sm text-left">
                      <tbody className="divide-y divide-slate-100">
                          {currencies.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-8 py-8">
                                      <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                                              <Coins className="w-6 h-6" />
                                          </div>
                                          <div>
                                              <div className="font-black text-slate-900 tracking-tight text-lg">{c.code} ({c.symbol})</div>
                                              {c.is_default && <span className="text-[9px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg font-black tracking-[0.2em] uppercase mt-1 inline-block">Primary Standard</span>}
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-8 py-8 text-right">
                                      <div className="flex justify-end gap-3">
                                          <button onClick={() => handleEditCurrency(c)} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                          {!c.is_default && (
                                              <button onClick={() => db.deleteCurrency(c.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </Card>
          </div>
      )}
      
      <ConfirmationModal 
        isOpen={!!roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleDeleteRole}
        title="Identity Protocol Purge"
        description="Terminating this security tier will immediately revoke all authorized permissions for users currently assigned to this level. This action is recorded in the master audit log."
        confirmText="Confirm Purge"
        isDestructive={true}
      />
    </div>
  );
};

export default SettingsPage;
