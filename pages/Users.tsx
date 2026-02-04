
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { UserProfile, Role, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Info, Lock, Eye, EyeOff, RefreshCcw, CheckCircle2, UserCheck, ExternalLink, ShieldAlert, ChevronRight } from 'lucide-react';

const Users = () => {
  const { user } = useAuth();
  const { roles, outlets, hasPermission } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    setLoading(true);
    const data = await db.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const resetForm = () => {
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
      setIsEditing(false);
      setError('');
      setShowPassword(false);
  }

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
    if (!canManageUsers || isSubmitting) return;
    setError('');
    
    if (!formData.name || !formData.email) {
        setError("Name and Email are required.");
        return;
    }
    if (!formData.role_id) {
        setError("You must assign a role to this user.");
        return;
    }
    
    setIsSubmitting(true);
    try {
        // Sync with Auth via Edge Function first if editing an existing linked user
        if (isEditing && formData.id) {
            const currentUserProfile = users.find(u => u.id === formData.id);
            if (currentUserProfile?.auth_id) {
                try {
                    const response = await fetch(
                        "https://fqwfffkkaeknaqjorygy.supabase.co/functions/v1/update_user",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${(user as any)?.access_token || ''}`
                            },
                            body: JSON.stringify({ 
                                userId: currentUserProfile.auth_id,
                                email: formData.email,
                                password: formData.password || undefined,
                                name: formData.name
                            }),
                        }
                    );
                    const authRes = await response.json();
                    if (!authRes.success) {
                        console.warn("Auth Sync Warning:", authRes.message);
                        // We continue with profile update even if auth sync fails, as the user might be unlinked
                    }
                } catch (err) {
                    console.error("Auth Update Request Failed:", err);
                }
            }
            
            await db.updateUser(formData.id, {
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets,
                password: formData.password || undefined 
            } as any);
        } else {
            // New User: db.addUser already handles shadow signup attempt
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
        console.error("User Provisioning Failed:", err);
        setError(err.message || "Database sync failed.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEdit = (u: UserProfile) => {
      setFormData({
          id: u.id,
          name: u.name,
          email: u.email,
          role_id: u.role_id,
          allowed_outlets: u.allowed_outlets || [],
          password: '' 
      });
      setIsEditing(true);
      setError('');
      setShowPassword(false);
  };

 const confirmDelete = async () => {
    if (!deleteId) return;

    setIsSubmitting(true);

    try {
        const currentUserProfile = users.find(u => u.id === deleteId);
        
        // 1️⃣ Call Supabase Edge Function to delete Auth user if auth_id exists
        if (currentUserProfile?.auth_id) {
            const response = await fetch(
                "https://fqwfffkkaeknaqjorygy.supabase.co/functions/v1/delete_user",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${(user as any)?.access_token || ''}`
                    },
                    body: JSON.stringify({ userId: currentUserProfile.auth_id }),
                }
            );

            const data = await response.json();
            if (!data.success) {
                console.warn("Auth Deletion Warning:", data.message);
            }
        }

        // 2️⃣ Delete from profiles table
        await db.deleteUser(deleteId);

        // 3️⃣ Reload users table
        await loadUsers();

        setDeleteId(null);
    } catch (err: any) {
        console.error(err);
        setError("Revocation failed. Please ensure the 'delete_user' function is deployed.");
    } finally {
        setIsSubmitting(false);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                <Shield className="w-6 h-6" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Identity Management</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized User Directory</p>
            </div>
        </div>
        <Button variant="outline" onClick={loadUsers} className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest border-slate-200">
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        <div className={canManageUsers ? "xl:col-span-2 space-y-8" : "xl:col-span-3 space-y-8"}>
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50 border-b">
                            <tr>
                                <th className="px-8 py-6">Profile</th>
                                <th className="px-8 py-6 text-center">Identity Sync</th>
                                <th className="px-8 py-6">Security Tier</th>
                                <th className="px-8 py-6">Access Scopes</th>
                                {canManageUsers && <th className="px-8 py-6 text-right">Operations</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => {
                                const isUnlinked = !u.auth_id;
                                return (
                                    <tr key={u.id} className="bg-white hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-900 tracking-tight text-base">{u.name}</div>
                                            <div className="text-indigo-600 text-xs font-bold">{u.email}</div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {isUnlinked ? (
                                                <div className="inline-flex flex-col gap-1 items-center">
                                                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 w-fit">
                                                      <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" />
                                                      <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Login</span>
                                                  </div>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 w-fit">
                                                    <UserCheck className="w-3.5 h-3.5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Active Link</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                                {getRoleName(u.role_id)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-2">
                                                {(!u.allowed_outlets || u.allowed_outlets.length === 0) ? (
                                                    <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-red-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5 mr-1.5"/> Restricted</span>
                                                ) : (
                                                    u.allowed_outlets.map(outId => {
                                                        const outName = outlets.find(o => o.id === outId)?.name;
                                                        return outName ? (
                                                            <span key={outId} className="text-[10px] font-black uppercase tracking-widest bg-white px-3 py-1 rounded-xl text-slate-500 flex items-center border border-slate-200 shadow-sm">
                                                                <Store className="w-3 h-3 mr-1.5 text-slate-300"/> {outName}
                                                            </span>
                                                        ) : null;
                                                    })
                                                )}
                                            </div>
                                        </td>
                                        {canManageUsers && (
                                          <td className="px-8 py-6 text-right">
                                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button type="button" onClick={() => handleEdit(u)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all">
                                                      <Edit2 className="w-4 h-4" />
                                                  </button>
                                                  {u.id !== user?.id && (
                                                      <button type="button" onClick={() => setDeleteId(u.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all">
                                                          <Trash2 className="w-4 h-4" />
                                                      </button>
                                                  )}
                                              </div>
                                          </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="bg-slate-950 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Lock className="w-48 h-48 text-indigo-500" />
                </div>
                <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-red-600 rounded-2xl shadow-xl shadow-red-900/40">
                            <ShieldAlert className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h4 className="text-white font-black uppercase tracking-[0.2em] text-lg">Identity Revocation Policy</h4>
                            <p className="text-red-400 text-xs font-bold">Protocol for Terminating Personnel Access</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
                            <h5 className="text-indigo-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <Info className="w-4 h-4"/> Profile vs. Auth Sync
                            </h5>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                                Updating a user's email or name here triggers a sync attempt with <strong>Supabase Auth</strong>. If you have the 'update_user' Edge Function deployed, it will physically update the primary identity provider records.
                            </p>
                        </div>

                        <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
                            <h5 className="text-amber-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4"/> Manual Auth Cleanup
                            </h5>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                                To fully manage an email from the cloud project, visit your <strong>Supabase Dashboard &rarr; Auth &rarr; Users</strong>. This is where primary credentials and MFA settings are physically stored.
                            </p>
                            <a 
                                href="https://supabase.com/dashboard" 
                                target="_blank" 
                                className="inline-flex items-center justify-between w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group/link"
                            >
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Project Dashboard</span>
                                <ExternalLink className="w-4 h-4 text-slate-500 group-hover/link:text-indigo-400 group-hover/link:translate-x-1 transition-all" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {canManageUsers && (
          <div className="space-y-6">
              <Card className="sticky top-8 rounded-[2rem] border-slate-200/60 shadow-2xl overflow-hidden">
                  <CardHeader className="bg-indigo-600 text-white p-8">
                      <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Identity' : 'Provision User'}</CardTitle>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2">Security Lifecycle</p>
                  </CardHeader>
                  <CardContent className="p-8">
                      <form onSubmit={handleSubmit} className="space-y-6">
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
                                {isEditing ? 'Override Access Key' : 'Initial Access Key'}
                              </label>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    placeholder={isEditing ? "Leave blank to keep" : "••••••••"}
                                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-medium"
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

                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Facility Access Scopes</label>
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
                              <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl shadow-indigo-100">
                                  {isEditing ? 'Commit Changes' : 'Provision User'}
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
        title="Revoke Identity Protocol"
        description="This profile and all associated facility access scopes will be permanently purged from the ERP. Access is terminated immediately upon profile deletion."
        confirmText="Confirm Revocation"
        isDestructive={true}
      />
    </div>
  );
};

export default Users;
