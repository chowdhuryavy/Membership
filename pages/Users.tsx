
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { UserProfile, Role, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Info, Lock, Eye, EyeOff } from 'lucide-react';

const Users = () => {
  const { user } = useAuth();
  const { roles, outlets, hasPermission } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<{
      id: string;
      name: string;
      email: string;
      role_id: string;
      allowed_outlets: string[];
      password?: string;
  }>({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await db.getUsers();
    setUsers(data);
  };

  const resetForm = () => {
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
      setIsEditing(false);
      setError('');
      setShowPassword(false);
  }

  // Proper permission check using granular strings
  const canViewUsers = user && hasPermission(user.role_id, 'users:view');
  const canManageUsers = user && (hasPermission(user.role_id, 'users:create') || hasPermission(user.role_id, 'users:edit')); 

  if (!canViewUsers) {
    return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md text-center p-6 border-red-100 bg-red-50/30">
                <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-red-600">Access Protocol Rejected</h3>
                <p className="text-slate-600 mt-2 text-sm">Security clearance insufficient to access the user directory.</p>
            </Card>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
        setError("You do not have permission to create or modify users.");
        return;
    }
    setError('');
    
    if (!formData.name || !formData.email) {
        setError("Name and Email are required.");
        return;
    }
    if (!formData.role_id) {
        setError("You must assign a role to this user.");
        return;
    }
    if (formData.allowed_outlets.length === 0) {
        setError("You must assign at least one outlet.");
        return;
    }
    if (!isEditing && (!formData.password || formData.password.length < 6)) {
        setError("Initial Access Key must be at least 6 characters.");
        return;
    }
    
    try {
        if (isEditing && formData.id) {
            await db.updateUser(formData.id, {
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets,
                password: formData.password || undefined // Only update if provided
            } as any);
        } else {
            await db.addUser({
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets,
                password: formData.password
            } as any);
        }
        resetForm();
        await loadUsers();
    } catch (err: any) {
        setError(err.message);
    }
  };

  const handleEdit = (u: UserProfile) => {
      setFormData({
          id: u.id,
          name: u.name,
          email: u.email,
          role_id: u.role_id,
          allowed_outlets: u.allowed_outlets || [],
          password: '' // Reset password field for editing
      });
      setIsEditing(true);
      setError('');
      setShowPassword(false);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await db.deleteUser(deleteId);
          await loadUsers();
          setDeleteId(null);
      }
  };

  const toggleOutlet = (outletId: string) => {
      setFormData(prev => {
          if (prev.allowed_outlets.includes(outletId)) {
              return { ...prev, allowed_outlets: prev.allowed_outlets.filter(id => id !== outletId) };
          } else {
              return { ...prev, allowed_outlets: [...prev.allowed_outlets, outletId] };
          }
      });
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-indigo-600" />
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Identity Management</h1>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className={canManageUsers ? "xl:col-span-2 space-y-6" : "xl:col-span-3 space-y-6"}>
            <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                    <CardTitle className="text-xl font-black">Authorized Directory</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50/50 border-b">
                            <tr>
                                <th className="px-8 py-5">Profile</th>
                                <th className="px-8 py-5">Security Tier</th>
                                <th className="px-8 py-5">Access Scopes</th>
                                {canManageUsers && <th className="px-8 py-5 text-right">Operations</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => (
                                <tr key={u.id} className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="font-black text-slate-900 tracking-tight">{u.name}</div>
                                        <div className="text-slate-400 text-xs font-bold">{u.email}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            {getRoleName(u.role_id)}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-wrap gap-2">
                                            {(!u.allowed_outlets || u.allowed_outlets.length === 0) ? (
                                                <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-red-50 px-2 py-1 rounded-lg"><AlertTriangle className="w-3 h-3 mr-1"/> Zero Scopes</span>
                                            ) : (
                                                u.allowed_outlets.map(outId => {
                                                    const outName = outlets.find(o => o.id === outId)?.name;
                                                    return outName ? (
                                                        <span key={outId} className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-xl text-slate-600 flex items-center border border-slate-200">
                                                            <Store className="w-3 h-3 mr-1.5 text-slate-400"/> {outName}
                                                        </span>
                                                    ) : null;
                                                })
                                            )}
                                        </div>
                                    </td>
                                    {canManageUsers && (
                                      <td className="px-8 py-6 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button type="button" onClick={() => handleEdit(u)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 rounded-xl transition-all">
                                                  <Edit2 className="w-4 h-4" />
                                              </button>
                                              {u.id !== user?.id && (
                                                  <button type="button" onClick={() => setDeleteId(u.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 rounded-xl transition-all">
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              )}
                                          </div>
                                      </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>

        {canManageUsers && (
          <div className="space-y-6">
              <Card className="sticky top-8 rounded-[2rem] border-slate-200/60 shadow-2xl overflow-hidden">
                  <CardHeader className="bg-slate-900 text-white p-8">
                      <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Identity' : 'Initialize Identity'}</CardTitle>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Security Credential Provisioning</p>
                  </CardHeader>
                  <CardContent className="p-8">
                      <form onSubmit={handleSubmit} className="space-y-6">
                          {!isEditing && (
                              <div className="bg-blue-50/50 p-4 rounded-2xl text-[11px] font-bold text-blue-700 border border-blue-100 flex gap-3">
                                  <Info className="w-5 h-5 shrink-0 text-blue-500" />
                                  <p>Provide an initial access key. The user can update this after their first login.</p>
                              </div>
                          )}

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Name</label>
                              <Input 
                                  value={formData.name} 
                                  onChange={e => setFormData({...formData, name: e.target.value})} 
                                  placeholder="John Doe"
                                  className="h-12 rounded-xl"
                              />
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                              <Input 
                                  type="email"
                                  value={formData.email} 
                                  onChange={e => setFormData({...formData, email: e.target.value})} 
                                  placeholder="user@enterprise.com"
                                  className="h-12 rounded-xl"
                              />
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {isEditing ? 'Update Access Key (Optional)' : 'Initial Access Key'}
                              </label>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    placeholder={isEditing ? "Leave blank to keep current" : "••••••••"}
                                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Tier</label>
                              <Select
                                  options={[
                                      { value: '', label: 'Select Tier...' },
                                      ...roles.map(r => ({ value: r.id, label: r.name }))
                                  ]}
                                  value={formData.role_id}
                                  onChange={e => setFormData({...formData, role_id: e.target.value})}
                                  className="h-12 rounded-xl"
                              />
                          </div>

                          <div className="space-y-2 pt-4 border-t border-slate-50">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Facility Scopes</label>
                              <div className="grid grid-cols-1 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto shadow-inner">
                                  {outlets.map(outlet => (
                                      <label key={outlet.id} className="flex items-center space-x-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                                          <input 
                                              type="checkbox"
                                              checked={formData.allowed_outlets.includes(outlet.id)}
                                              onChange={() => toggleOutlet(outlet.id)}
                                              className="h-5 w-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                                          />
                                          <span className="text-xs font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-600">
                                              {outlet.name}
                                          </span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                          
                          {error && (
                              <div className="bg-red-50 text-red-600 text-[11px] font-bold p-4 rounded-2xl border border-red-100 flex items-start gap-3 animate-in zoom-in-95">
                                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>{error}</span>
                              </div>
                          )}

                          <div className="flex gap-3 pt-4">
                              {isEditing && (
                                  <Button type="button" variant="secondary" onClick={resetForm} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200">
                                      Cancel
                                  </Button>
                              )}
                              <Button type="submit" className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl shadow-indigo-100">
                                  {isEditing ? 'Update Profile' : 'Deploy User'}
                              </Button>
                          </div>
                      </form>
                  </CardContent>
              </Card>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Logout"
        description="Are you sure you want to permanently remove this user account? All access privileges will be revoked immediately."
        confirmText="Confirm Termination"
        isDestructive={true}
      />
    </div>
  );
};

export default Users;
