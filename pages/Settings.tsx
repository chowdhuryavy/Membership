
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { Role, Permission, Currency, CompanySettings, Outlet, Property } from '../types';
import { Trash2, Check, Store, Edit2, X, Shield, Eye, PlusSquare, FileEdit, Trash, Download, Building2, Activity, Coins, Globe, Key, Settings, AlertTriangle } from 'lucide-react';

const PERMISSION_MODULES = [
    { id: 'members', label: 'Membership Management', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'create', label: 'Create', icon: PlusSquare }, { id: 'edit', label: 'Edit', icon: FileEdit }, { id: 'delete', label: 'Delete', icon: Trash }] },
    { id: 'categories', label: 'Revenue Tiers / Categories', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'create', label: 'Create', icon: PlusSquare }, { id: 'edit', label: 'Edit', icon: FileEdit }, { id: 'delete', label: 'Delete', icon: Trash }] },
    { id: 'users', label: 'Users & Security', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'create', label: 'Create', icon: PlusSquare }, { id: 'edit', label: 'Edit', icon: FileEdit }, { id: 'delete', label: 'Delete', icon: Trash }] },
    { id: 'properties', label: 'Property Portfolio', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'edit', label: 'Edit/Manage', icon: FileEdit }] },
    { id: 'outlets', label: 'Facility Management', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'edit', label: 'Edit/Manage', icon: FileEdit }] },
    { id: 'settings', label: 'System Configurations', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'edit', label: 'Edit', icon: FileEdit }] },
    { id: 'reports', label: 'Financial Reports', actions: [{ id: 'view', label: 'View', icon: Eye }, { id: 'export', label: 'Export (CSV/PDF)', icon: Download }] },
    { id: 'logs', label: 'Audit History', actions: [{ id: 'view', label: 'View', icon: Eye }] },
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

  const [message, setMessage] = useState('');

  // Permission Checks
  const canEditSettings = user && hasPermission(user.role_id, 'settings:edit');
  const canViewProperties = user && hasPermission(user.role_id, 'properties:view');
  const canEditProperties = user && hasPermission(user.role_id, 'properties:edit');
  const canViewOutlets = user && hasPermission(user.role_id, 'outlets:view');
  const canEditOutlets = user && hasPermission(user.role_id, 'outlets:edit');
  const canManageRoles = user && hasPermission(user.role_id, 'users:edit');
  const canViewSettings = user && hasPermission(user.role_id, 'settings:view');

  const availableTabs = useMemo(() => {
    const tabs: { id: TabId; label: string; visible: boolean }[] = [
      { id: 'company', label: 'Global', visible: !!canViewSettings },
      { id: 'properties', label: 'Properties', visible: !!canViewProperties },
      { id: 'outlets', label: 'Outlets', visible: !!canViewOutlets },
      { id: 'roles', label: 'Permissions', visible: !!canManageRoles },
      { id: 'currency', label: 'Currency', visible: !!canViewSettings },
    ];
    return tabs.filter(t => t.visible);
  }, [canViewSettings, canViewProperties, canViewOutlets, canManageRoles]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs]);

  useEffect(() => { if (settings) setCompanyForm(settings); }, [settings]);

  const saveCompany = async () => {
    if (!canEditSettings) return;
    await db.updateSettings(companyForm);
    await refreshSettings();
    setMessage('Global settings updated successfully.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveProperty = async () => {
      if (!canEditProperties || !propForm.name) return;
      if (editingPropId) {
          await db.updateProperty(editingPropId, propForm);
      } else {
          await db.addProperty(propForm);
      }
      setPropForm({ name: '', logo_url: '', address: '' });
      setEditingPropId(null);
      refreshSettings();
      setMessage('Property saved successfully.');
  };

  const handleSaveOutlet = async () => {
    if (!canEditOutlets || !newOutletName || !outletPropertyId) return;
    if (editingOutlet) {
      await db.updateOutlet(editingOutlet.id, { name: newOutletName, property_id: outletPropertyId });
    } else {
      await db.addOutlet(newOutletName, outletPropertyId);
    }
    setNewOutletName('');
    setOutletPropertyId('');
    setEditingOutlet(null);
    refreshSettings();
    setMessage('Outlet saved successfully.');
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
    if (editingRoleId) {
        await db.updateRole(editingRoleId, newRole);
    } else {
        await db.addRole(newRole);
    }
    setNewRole({ name: '', permissions: [] });
    setEditingRoleId(null);
    refreshSettings();
    setMessage('Security role state updated.');
  };

  const handleEditRole = (role: Role) => {
      setNewRole({ name: role.name, permissions: role.permissions });
      setEditingRoleId(role.id);
  };

  const handleDeleteRole = async () => {
      if (roleToDelete) {
          await db.deleteRole(roleToDelete);
          setRoleToDelete(null);
          refreshSettings();
          setMessage('Security role purged from database.');
      }
  };

  const resetRoleForm = () => {
      setNewRole({ name: '', permissions: [] });
      setEditingRoleId(null);
  };

  const handleSaveCurrency = async () => {
    if (!canEditSettings || !newCurrency.code || !newCurrency.symbol) return;
    
    if (editingCurrencyId) {
        await db.updateCurrency(editingCurrencyId, newCurrency);
    } else {
        await db.addCurrency(newCurrency as Omit<Currency, 'id'>);
    }
    
    setEditingCurrencyId(null);
    setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false });
    await refreshSettings();
    setMessage('Monetary standard synchronized.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEditCurrency = (c: Currency) => {
      setEditingCurrencyId(c.id);
      setNewCurrency(c);
  }

  if (availableTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-6" />
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h3>
          <p className="text-slate-500 max-w-md font-medium mt-2 leading-relaxed">
            Your current security clearance does not allow modification of system configurations. Please contact a Tier-1 Administrator for authorization.
          </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Settings className="w-10 h-10 text-indigo-600" />
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">System Control</h1>
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
        <div className="bg-emerald-50 text-emerald-700 p-5 rounded-3xl text-xs font-black border border-emerald-100 animate-in fade-in zoom-in flex items-center gap-3 shadow-sm">
            <Check className="w-5 h-5"/> {message}
        </div>
      )}

      {/* GLOBAL SETTINGS TAB */}
      {activeTab === 'company' && canViewSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <Card className="lg:col-span-2 rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                  <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                    <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <Globe className="w-5 h-5 text-indigo-600" /> Core Framework Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Name</label>
                            <Input value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Logo URL</label>
                            <Input value={companyForm.logo_url} onChange={e => setCompanyForm({...companyForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corporate Headquarters Address</label>
                        <Input value={companyForm.address} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} className="h-12 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Currency</label>
                        <Select 
                            options={currencies.map(c => ({ value: c.id, label: `${c.code} (${c.symbol})` }))} 
                            value={companyForm.currency_id} 
                            onChange={e => setCompanyForm({...companyForm, currency_id: e.target.value})}
                            className="h-12 rounded-xl"
                        />
                      </div>
                      {canEditSettings && (
                        <div className="pt-6">
                          <Button onClick={saveCompany} className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-indigo-100">Update Global State</Button>
                        </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      )}

      {/* PROPERTIES TAB */}
      {activeTab === 'properties' && canViewProperties && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {canEditProperties && (
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                    <CardHeader className="bg-slate-50 p-8 border-b border-slate-100"><CardTitle className="text-xl font-black tracking-tight">{editingPropId ? 'Edit Property' : 'New Property'}</CardTitle></CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Property Name</label>
                            <Input value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branded Logo URL</label>
                            <Input value={propForm.logo_url} onChange={e => setPropForm({...propForm, logo_url: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Property Address</label>
                            <Input value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                        <Button onClick={handleSaveProperty} className="w-full h-14 rounded-2xl font-black mt-4">Save Property</Button>
                    </CardContent>
                </Card>
              )}
              <Card className={`${canEditProperties ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border-b">
                          <tr><th className="px-8 py-5">Property</th>{canEditProperties && <th className="px-8 py-5 text-right">Actions</th>}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {properties.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-6 flex items-center gap-4">
                                      {p.logo_url ? <img src={p.logo_url} className="w-12 h-12 object-contain rounded-xl border p-2 bg-white" /> : <Building2 className="w-12 h-12 p-3 bg-slate-100 rounded-xl" />}
                                      <div>
                                          <div className="font-black text-slate-900 tracking-tight">{p.name}</div>
                                          <div className="text-[9px] font-bold text-slate-400 uppercase">{p.address}</div>
                                      </div>
                                  </td>
                                  {canEditProperties && (
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setEditingPropId(p.id); setPropForm(p); }} className="p-3 text-slate-400 hover:text-indigo-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={() => db.deleteProperty(p.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
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

      {/* ROLES TAB */}
      {activeTab === 'roles' && canManageRoles && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <Card className="lg:col-span-4 rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                  <CardHeader className="bg-slate-900 text-white p-8">
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                        <Key className="w-5 h-5 text-indigo-400" /> {editingRoleId ? 'Modify Existing Role' : 'Define New Role'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                        <Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="e.g. Finance Auditor" className="h-12 rounded-xl" />
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorization Matrix</label>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {PERMISSION_MODULES.map(module => (
                            <div key={module.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <h5 className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">{module.label}</h5>
                              <div className="flex flex-wrap gap-2">
                                {module.actions.map(action => {
                                  const perm = `${module.id}:${action.id}` as Permission;
                                  const isChecked = newRole.permissions.includes(perm);
                                  return (
                                    <button 
                                      key={action.id}
                                      type="button"
                                      onClick={() => handleTogglePermission(perm)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                                    >
                                      <action.icon className="w-3 h-3" /> {action.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {editingRoleId && <Button variant="outline" onClick={resetRoleForm} className="flex-1 h-14 rounded-2xl font-black">Cancel</Button>}
                        <Button onClick={saveRole} className="flex-1 h-14 rounded-2xl font-black shadow-xl shadow-indigo-100">{editingRoleId ? 'Sync Identity' : 'Deploy Identity'}</Button>
                      </div>
                  </CardContent>
              </Card>

              <div className="lg:col-span-8 space-y-6">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border-b">
                            <tr><th className="px-8 py-5">Security Identifier</th><th className="px-8 py-5 text-right">Management</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {roles.map(r => (
                                <tr key={r.id} className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 rounded-lg"><Shield className="w-4 h-4 text-indigo-600" /></div>
                                            <div>
                                                <div className="font-black text-slate-900 tracking-tight">{r.name}</div>
                                                <div className="flex gap-1 mt-1">
                                                    {r.is_system && <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded font-black tracking-widest uppercase">System</span>}
                                                    <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-black tracking-widest uppercase">{r.permissions.length} Perms</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEditRole(r)} className="p-3 text-slate-400 hover:text-indigo-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors">
                                                <Edit2 className="w-4 h-4"/>
                                            </button>
                                            {!r.is_system && (
                                              <button onClick={() => setRoleToDelete(r.id)} className="p-3 text-slate-400 hover:text-red-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors">
                                                  <Trash2 className="w-4 h-4"/>
                                              </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
              </div>
          </div>
      )}

      {/* OUTLETS TAB */}
      {activeTab === 'outlets' && canViewOutlets && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {canEditOutlets && (
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                            <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Store className="w-5 h-5 text-indigo-600" /> {editingOutlet ? 'Edit Facility' : 'New Facility'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Facility Name</label>
                                <Input placeholder="Main Facility" value={newOutletName} onChange={e => setNewOutletName(e.target.value)} className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portfolio Parent</label>
                                <Select options={[{ value: '', label: 'Select Portfolio...' }, ...properties.map(p => ({ value: p.id, label: p.name }))]} value={outletPropertyId} onChange={e => setOutletPropertyId(e.target.value)} className="h-12 rounded-xl" />
                            </div>
                            <Button onClick={handleSaveOutlet} className="w-full h-14 rounded-2xl font-black shadow-xl shadow-indigo-100 mt-4">Save Configuration</Button>
                        </CardContent>
                    </Card>
                )}
                <Card className={`${canEditOutlets ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border-b">
                            <tr><th className="px-8 py-5">Facility Context</th>{canEditOutlets && <th className="px-8 py-5 text-right">Actions</th>}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {outlets.map(o => {
                                const parent = properties.find(p => p.id === o.property_id);
                                return (
                                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-4 h-4 text-indigo-400"/>
                                                <div>
                                                    <div className="font-black text-slate-900 tracking-tight">{o.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Portfolio: {parent?.name || 'Isolated'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {canEditOutlets && (
                                          <td className="px-8 py-6 text-right">
                                              <div className="flex justify-end gap-2">
                                                  <button onClick={() => { setEditingOutlet(o); setNewOutletName(o.name); setOutletPropertyId(o.property_id); }} className="p-3 text-slate-400 hover:text-indigo-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                                  <button onClick={() => db.deleteOutlet(o.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
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
                            <Coins className="w-5 h-5 text-amber-500" /> {editingCurrencyId ? 'Update Standard' : 'Monetary Standard'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ISO Code</label>
                                <Input placeholder="USD" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol</label>
                                <Input placeholder="$" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} className="h-12 rounded-xl" />
                            </div>
                          </div>
                          <div className="space-y-2">
                              <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors border border-slate-100">
                                  <input 
                                    type="checkbox" 
                                    checked={newCurrency.is_default} 
                                    onChange={e => setNewCurrency({...newCurrency, is_default: e.target.checked})}
                                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Mark as System Default</span>
                              </label>
                          </div>
                          <div className="flex gap-2">
                              {editingCurrencyId && <Button variant="outline" onClick={() => { setEditingCurrencyId(null); setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false }); }} className="flex-1 h-14 rounded-2xl font-black">Cancel</Button>}
                              <Button onClick={handleSaveCurrency} className="flex-1 h-14 rounded-2xl font-black shadow-xl shadow-amber-100">{editingCurrencyId ? 'Commit' : 'Sync Currency'}</Button>
                          </div>
                      </CardContent>
                  </Card>
              )}
              <Card className={`${canEditSettings ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden`}>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border-b">
                          <tr><th className="px-8 py-5">Currency</th><th className="px-8 py-5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {currencies.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-6">
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-amber-50 rounded-lg"><Coins className="w-4 h-4 text-amber-600" /></div>
                                          <div>
                                              <div className="font-black text-slate-900 tracking-tight">{c.code} ({c.symbol})</div>
                                              {c.is_default && <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black tracking-widest uppercase">System Default</span>}
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => handleEditCurrency(c)} className="p-3 text-slate-400 hover:text-indigo-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors">
                                              <Edit2 className="w-4 h-4"/>
                                          </button>
                                          {!c.is_default && (
                                              <button onClick={() => db.deleteCurrency(c.id).then(refreshSettings)} className="p-3 text-slate-400 hover:text-red-600 bg-white shadow-sm rounded-xl border border-slate-100 transition-colors">
                                                  <Trash2 className="w-4 h-4"/>
                                              </button>
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
        title="Purge Identity Tier"
        description="Are you sure you want to delete this role? This will remove all associated permissions from users in this tier."
        confirmText="Confirm Purge"
        isDestructive={true}
      />
    </div>
  );
};

export default SettingsPage;
