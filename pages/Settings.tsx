
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { Role, Permission, Currency, CompanySettings } from '../types';
import { Trash2, Plus, Check, Store } from 'lucide-react';

const PERMISSIONS_LIST: { id: Permission, label: string }[] = [
    { id: 'manage_members', label: 'Manage Members' },
    { id: 'manage_categories', label: 'Manage Categories' },
    { id: 'manage_users', label: 'Manage Users & Roles' },
    { id: 'manage_settings', label: 'Manage System Settings' },
    { id: 'view_reports', label: 'View Financial Reports' },
    { id: 'view_logs', label: 'View Audit Logs' },
];

const SettingsPage = () => {
  const { settings, currencies, roles, outlets, refreshSettings } = useSettings();
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'company' | 'roles' | 'currency' | 'outlets'>('company');

  // Local State for Forms
  const [companyForm, setCompanyForm] = useState<CompanySettings>({ name: '', logo_url: '', address: '', currency_id: '' });
  const [newCurrency, setNewCurrency] = useState<Partial<Currency>>({ code: '', symbol: '', rate: 1, is_default: false });
  const [newRole, setNewRole] = useState<{ name: string, permissions: Permission[] }>({ name: '', permissions: [] });
  const [newOutletName, setNewOutletName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) setCompanyForm(settings);
  }, [settings]);

  const saveCompany = async () => {
    await db.updateSettings(companyForm);
    await refreshSettings();
    setMessage('Company settings saved successfully.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddCurrency = async () => {
    if (!newCurrency.code || !newCurrency.symbol) return;
    await db.addCurrency(newCurrency as Currency);
    setNewCurrency({ code: '', symbol: '', rate: 1, is_default: false });
    refreshSettings();
  };

  const handleDeleteCurrency = async (id: string) => {
    if (confirm('Delete this currency?')) {
        await db.deleteCurrency(id);
        refreshSettings();
    }
  };

  const handleAddRole = async () => {
      if (!newRole.name) return;
      await db.addRole({ name: newRole.name, permissions: newRole.permissions });
      setNewRole({ name: '', permissions: [] });
      refreshSettings();
  };

  const handleDeleteRole = async (id: string) => {
      if (confirm('Delete this role? Users assigned to this role may lose access.')) {
          try {
            await db.deleteRole(id);
            refreshSettings();
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  const handleAddOutlet = async () => {
      if (!newOutletName) return;
      const newOutlet = await db.addOutlet(newOutletName);
      
      // Auto-assign permission to current user so they can access it immediately
      if (user) {
          try {
             // We need fresh user data to avoid overwriting recent changes
             const users = await db.getUsers();
             const currentUserData = users.find(u => u.id === user.id);
             
             if (currentUserData) {
                 const currentAccess = currentUserData.allowed_outlets || [];
                 if (!currentAccess.includes(newOutlet.id)) {
                     await db.updateUser(user.id, {
                         allowed_outlets: [...currentAccess, newOutlet.id]
                     });
                     await refreshUser(); // Update context so the switcher sees it immediately
                 }
             }
          } catch (e) {
              console.error("Failed to auto-assign outlet permission", e);
          }
      }

      setNewOutletName('');
      refreshSettings();
  }

  const handleDeleteOutlet = async (id: string) => {
      if (confirm('Are you sure you want to delete this outlet? Data associated with it might become inaccessible.')) {
          try {
            await db.deleteOutlet(id);
            refreshSettings();
          } catch (e: any) {
              alert(e.message);
          }
      }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
      
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('company')}
            className={`pb-2 px-1 text-sm font-medium ${activeTab === 'company' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
            Company Profile
          </button>
          <button 
            onClick={() => setActiveTab('outlets')}
            className={`pb-2 px-1 text-sm font-medium ${activeTab === 'outlets' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
            Outlets / Facilities
          </button>
          <button 
            onClick={() => setActiveTab('roles')}
            className={`pb-2 px-1 text-sm font-medium ${activeTab === 'roles' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
            Roles & Permissions
          </button>
          <button 
            onClick={() => setActiveTab('currency')}
            className={`pb-2 px-1 text-sm font-medium ${activeTab === 'currency' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}
          >
            Currencies
          </button>
      </div>

      {message && <div className="bg-green-50 text-green-700 p-3 rounded text-sm flex items-center gap-2"><Check className="w-4 h-4"/> {message}</div>}

      {activeTab === 'company' && (
          <Card>
              <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                  <Input 
                    label="Company Name" 
                    value={companyForm.name} 
                    onChange={e => setCompanyForm({...companyForm, name: e.target.value})} 
                  />
                  <Input 
                    label="Logo URL" 
                    value={companyForm.logo_url} 
                    onChange={e => setCompanyForm({...companyForm, logo_url: e.target.value})} 
                  />
                  {companyForm.logo_url && <img src={companyForm.logo_url} alt="Preview" className="h-12 object-contain border p-1 rounded" />}
                  
                  <Input 
                    label="Address / Footer Info" 
                    value={companyForm.address} 
                    onChange={e => setCompanyForm({...companyForm, address: e.target.value})} 
                  />

                  <Select
                    label="Default System Currency"
                    options={currencies.map(c => ({ value: c.id, label: `${c.code} (${c.symbol})` }))}
                    value={companyForm.currency_id}
                    onChange={e => setCompanyForm({...companyForm, currency_id: e.target.value})}
                  />
                  
                  <Button onClick={saveCompany}>Save Changes</Button>
              </CardContent>
          </Card>
      )}

      {activeTab === 'outlets' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Add New Outlet</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Input 
                            label="Outlet Name" 
                            placeholder="e.g. Spa, Swimming Pool" 
                            value={newOutletName} 
                            onChange={e => setNewOutletName(e.target.value)} 
                        />
                        <Button onClick={handleAddOutlet} className="w-full">Create Outlet</Button>
                        <p className="text-xs text-slate-500 mt-2">
                            Creates a new data scope for members and categories.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Manage Outlets</CardTitle></CardHeader>
                    <div className="p-0">
                         <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Outlet Name</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outlets.map(o => (
                                    <tr key={o.id} className="border-b last:border-0">
                                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                                            <Store className="w-4 h-4 text-slate-400"/> {o.name}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => handleDeleteOutlet(o.id)} 
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
           </div>
      )}

      {activeTab === 'currency' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                  <CardHeader><CardTitle>Add Currency</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input label="Code" placeholder="USD" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} />
                        <Input label="Symbol" placeholder="$" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} />
                      </div>
                      <Input label="Exchange Rate (vs Base)" type="number" step="0.01" value={newCurrency.rate} onChange={e => setNewCurrency({...newCurrency, rate: parseFloat(e.target.value)})} />
                      <Button onClick={handleAddCurrency} className="w-full">Add Currency</Button>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader><CardTitle>Existing Currencies</CardTitle></CardHeader>
                  <div className="p-0">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                              <tr>
                                  <th className="px-4 py-3">Code</th>
                                  <th className="px-4 py-3">Symbol</th>
                                  <th className="px-4 py-3">Rate</th>
                                  <th className="px-4 py-3 text-right">Action</th>
                              </tr>
                          </thead>
                          <tbody>
                              {currencies.map(c => (
                                  <tr key={c.id} className="border-b last:border-0">
                                      <td className="px-4 py-3 font-medium">{c.code}</td>
                                      <td className="px-4 py-3">{c.symbol}</td>
                                      <td className="px-4 py-3">{c.rate}</td>
                                      <td className="px-4 py-3 text-right">
                                          {!c.is_default && (
                                              <button onClick={() => handleDeleteCurrency(c.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4"/></button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      )}

      {activeTab === 'roles' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                  <CardHeader><CardTitle>Create Role</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      <Input label="Role Name" placeholder="e.g. Manager" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} />
                      
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Permissions</label>
                          <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
                              {PERMISSIONS_LIST.map(perm => (
                                  <label key={perm.id} className="flex items-center gap-2 text-sm text-slate-700">
                                      <input 
                                        type="checkbox" 
                                        checked={newRole.permissions.includes(perm.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setNewRole({...newRole, permissions: [...newRole.permissions, perm.id]});
                                            } else {
                                                setNewRole({...newRole, permissions: newRole.permissions.filter(p => p !== perm.id)});
                                            }
                                        }}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                      />
                                      {perm.label}
                                  </label>
                              ))}
                          </div>
                      </div>

                      <Button onClick={handleAddRole} className="w-full">Create Role</Button>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader><CardTitle>Role Management</CardTitle></CardHeader>
                  <div className="p-4 space-y-4">
                      {roles.map(role => (
                          <div key={role.id} className="border rounded-lg p-4 bg-white relative group">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h3 className="font-bold text-slate-800">{role.name}</h3>
                                      <div className="flex flex-wrap gap-1 mt-2">
                                          {role.permissions.map(p => (
                                              <span key={p} className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                                  {PERMISSIONS_LIST.find(pl => pl.id === p)?.label || p}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                                  {!role.is_system && (
                                      <button onClick={() => handleDeleteRole(role.id)} className="text-slate-400 hover:text-red-600 p-1">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              </Card>
          </div>
      )}
    </div>
  );
};

export default SettingsPage;
