
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { UserProfile, Role, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Lock, Eye, RefreshCcw, UserCheck, Plus, X, ArrowLeft, Building2, Command } from 'lucide-react';

const UserDetail = ({ user, roles, outlets, onBack, onEdit, onDelete }: { user: UserProfile, roles: Role[], outlets: Outlet[], onBack: () => void, onEdit: (user: UserProfile) => void, onDelete: (id: string) => void }) => {
    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown';
    const isUnlinked = !user.auth_id;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 relative z-0">
            <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Directory</button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                        <CardContent className="p-8 text-center">
                            <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                                <div className="w-24 h-24 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                                    {user.name.charAt(0)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{user.name}</h3>
                            <p className="text-xs font-bold text-indigo-600 mt-1">{user.email}</p>
                            <div className="mt-6 flex justify-center gap-2">
                                <Button onClick={() => onEdit(user)} size="sm" className="rounded-xl font-bold">Edit Profile</Button>
                                <Button onClick={() => onDelete(user.id)} size="sm" variant="danger" className="rounded-xl">Revoke</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <Shield className="w-5 h-5 text-indigo-600" /> Security Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            <div className="flex justify-between items-center text-sm p-4 bg-slate-50 rounded-xl">
                                <span className="font-bold text-slate-500">Sync Status</span>
                                {isUnlinked ? (
                                    <div className="inline-flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                                        <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Shadow Profile</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                        <UserCheck className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Auth Linked</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center text-sm p-4 bg-slate-50 rounded-xl">
                                <span className="font-bold text-slate-500">Security Tier</span>
                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                    {getRoleName(user.role_id)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                     <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-indigo-600" /> Facility Access Scopes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            {(!user.allowed_outlets || user.allowed_outlets.length === 0) ? (
                                <div className="text-center py-8">
                                    <span className="text-red-500 text-xs font-black uppercase tracking-widest flex items-center justify-center bg-red-50 px-4 py-2 rounded-lg"><AlertTriangle className="w-4 h-4 mr-2"/> No Access Scopes Assigned</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {user.allowed_outlets.map(outId => {
                                        const outName = outlets.find(o => o.id === outId)?.name;
                                        return outName ? (
                                            <div key={outId} className="bg-slate-50 p-4 rounded-xl flex items-center gap-3 border border-slate-100">
                                                <Store className="w-4 h-4 text-slate-400"/>
                                                <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{outName}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

const Users = () => {
  const { user: currentUser } = useAuth();
  const { roles, outlets, hasPermission, checkShortcut } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState<{ id: string; name: string; email: string; role_id: string; allowed_outlets: string[]; password?: string; }>({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const data = await db.getUsers();
        setUsers(data);
    } catch (err) { console.error("Directory Load Error:", err); } 
    finally { setLoading(false); }
  };

  const resetForm = () => {
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
      setIsEditing(false);
      setError('');
      setShowPassword(false);
  }
  
  const handleFormCancel = () => {
      resetForm();
      setShowForm(false);
  };
  
  const handleAddNew = () => {
      resetForm();
      setIsEditing(false);
      setShowForm(true);
  };

  const handleEdit = (u: UserProfile) => {
      if (!canEdit) return;
      setFormData({
          id: u.id, name: u.name, email: u.email, role_id: u.role_id,
          allowed_outlets: u.allowed_outlets || [], password: '' 
      });
      setIsEditing(true);
      setShowForm(true);
  };

  const callEdgeFunction = async (funcName: string, payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Session expired. Please refresh the page or login again.");
    const response = await fetch(`${supabaseUrl}/functions/v1/${funcName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, accessToken: session.access_token })
    });
    const data = await response.json();
    if (data && data.error) throw new Error(data.error);
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);
    return data;
  };

  const canViewUsers = currentUser && hasPermission(currentUser.role_id, 'users:view');
  const canCreate = currentUser && hasPermission(currentUser.role_id, 'users:create');
  const canEdit = currentUser && hasPermission(currentUser.role_id, 'users:edit');
  const canDelete = currentUser && hasPermission(currentUser.role_id, 'users:delete');
  const canModifyTable = canEdit || canDelete;
  const canEditEmail = currentUser && (hasPermission(currentUser.role_id, 'users:edit_email') || !isEditing);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
        if (showForm) {
            if (checkShortcut(e, 'action_save')) {
                e.preventDefault();
                handleSubmit(e as any);
            }
            if (checkShortcut(e, 'action_cancel')) {
                e.preventDefault();
                handleFormCancel();
            }
        } else {
            // View shortcuts
            if (checkShortcut(e, 'action_create') && canCreate) {
                e.preventDefault();
                handleAddNew();
            }
            // Add search focus logic here if search input ref is available
        }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [showForm, canCreate, checkShortcut]); // Dependencies for closure freshness

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
    if (isSubmitting) return;
    if ((isEditing && !canEdit) || (!isEditing && !canCreate)) return;

    setError('');
    if (!formData.name || !formData.email || !formData.role_id) {
        setError("Name, Email, and Security Tier are required.");
        return;
    }
    
    setIsSubmitting(true);
    try {
        if (isEditing && formData.id) {
            const userProfile = users.find(u => u.id === formData.id);
            if (userProfile?.auth_id) {
                const updates: { password?: string; email?: string; name?: string } = {};
                if (formData.password?.trim()) updates.password = formData.password;
                if (canEditEmail && formData.email !== userProfile.email) updates.email = formData.email;
                if (formData.name !== userProfile.name) updates.name = formData.name;
                if (Object.keys(updates).length > 0) {
                    await callEdgeFunction('admin-reset-user', { userId: userProfile.auth_id, ...updates });
                }
            }
            await db.updateUser(formData.id, {
                name: formData.name, email: canEditEmail ? formData.email : undefined,
                role_id: formData.role_id, allowed_outlets: formData.allowed_outlets,
                password: formData.password || undefined 
            } as any);
        } else {
            await db.addUser({
                name: formData.name, email: formData.email, role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets, password: formData.password
            } as any);
        }
        handleFormCancel();
        await loadUsers();
    } catch (err: any) {
        setError(err.message || "Database update failed.");
    } finally { setIsSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId || !canDelete) return;
    setIsSubmitting(true);
    setError('');
    try {
        const userProfile = users.find(u => u.id === deleteId);
        if (userProfile?.auth_id) {
            await callEdgeFunction('dynamic-action', { action: 'delete', userId: userProfile.auth_id });
        }
        await db.deleteUser(deleteId);
        await loadUsers();
        setDeleteId(null);
        setView('list'); // Go back to list if deleting from detail view
    } catch (err: any) {
        setError(err.message || "Revocation failed.");
    } finally { setIsSubmitting(false); }
  };

  const toggleOutlet = (outletId: string) => {
      setFormData(prev => ({ ...prev, allowed_outlets: prev.allowed_outlets.includes(outletId) ? prev.allowed_outlets.filter(id => id !== outletId) : [...prev.allowed_outlets, outletId] }));
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {view === 'detail' && selectedUser ? (
        <UserDetail 
            user={selectedUser} 
            roles={roles} 
            outlets={outlets} 
            onBack={() => setView('list')} 
            onEdit={handleEdit} 
            onDelete={setDeleteId} 
        />
      ) : (
        <>
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
            <div className="flex gap-2">
                <Button variant="outline" onClick={loadUsers} className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest border-slate-200">
                    <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
                </Button>
                {canCreate && (
                    <Button onClick={handleAddNew} className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">
                        <Plus className="w-4 h-4 mr-2" /> Provision User
                    </Button>
                )}
            </div>
          </div>
          
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50 border-b">
                          <tr>
                              <th className="px-8 py-6">Profile</th>
                              <th className="px-8 py-6 text-center">Sync Status</th>
                              <th className="px-8 py-6">Security Tier</th>
                              <th className="px-8 py-6">Access Scopes</th>
                              {canModifyTable && <th className="px-8 py-6 text-right">Operations</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {users.map(u => (
                              <tr key={u.id} onClick={() => { setSelectedUser(u); setView('detail'); }} className="bg-white hover:bg-slate-50 transition-colors group cursor-pointer">
                                  <td className="px-8 py-6">
                                      <div className="font-black text-slate-900 tracking-tight text-base">{u.name}</div>
                                      <div className="text-indigo-600 text-xs font-bold">{u.email}</div>
                                  </td>
                                  <td className="px-8 py-6 text-center">
                                      {!u.auth_id ? (
                                          <div className="inline-flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 w-fit">
                                              <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" />
                                              <span className="text-[9px] font-black uppercase tracking-widest">Shadow Profile</span>
                                          </div>
                                      ) : (
                                          <div className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 w-fit">
                                              <UserCheck className="w-3.5 h-3.5" />
                                              <span className="text-[9px] font-black uppercase tracking-widest">Auth Linked</span>
                                          </div>
                                      )}
                                  </td>
                                  <td className="px-8 py-6">
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                          {getRoleName(u.role_id)}
                                      </span>
                                  </td>
                                  <td className="px-8 py-6">
                                      <div className="flex flex-wrap gap-2 max-w-xs">
                                          {(!u.allowed_outlets || u.allowed_outlets.length === 0) ? (
                                              <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-red-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5 mr-1.5"/> No Access</span>
                                          ) : u.allowed_outlets.map(outId => {
                                              const outName = outlets.find(o => o.id === outId)?.name;
                                              return outName ? (
                                                  <span key={outId} className="text-[10px] font-black uppercase tracking-widest bg-white px-3 py-1 rounded-xl text-slate-500 flex items-center border border-slate-200 shadow-sm">
                                                      <Store className="w-3 h-3 mr-1.5 text-slate-300"/> {outName}
                                                  </span>
                                              ) : null;
                                          })}
                                      </div>
                                  </td>
                                  {canModifyTable && (
                                    <td className="px-8 py-6 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canEdit && <button onClick={() => handleEdit(u)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>}
                                            {canDelete && u.id !== currentUser?.id && <button onClick={() => setDeleteId(u.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>}
                                        </div>
                                    </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Card>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl relative">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardHeader className="bg-indigo-600 text-white p-8 relative">
                        <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Identity' : 'Provision User'}</CardTitle>
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2">Security Lifecycle</p>
                        <button onClick={handleFormCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Name</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@enterprise.com" className={`h-12 rounded-xl ${!canEditEmail ? 'bg-slate-50 text-slate-500' : ''}`} disabled={!canEditEmail} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{isEditing ? 'Override Key' : 'Initial Access Key'}</label>
                                <div className="relative group">
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2"><Lock className="w-4 h-4 text-slate-400" /></div>
                                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={isEditing ? "Leave blank to preserve" : "••••••••"} className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50" />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Tier</label>
                                <Select options={[{ value: '', label: 'Select Tier...' }, ...roles.map(r => ({ value: r.id, label: r.name }))]} value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})} className="h-12 rounded-xl" />
                            </div>
                          </div>
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Facility Access Scopes</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto shadow-inner">
                                  {outlets.map(o => (
                                      <label key={o.id} className="flex items-center space-x-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                                          <input type="checkbox" checked={formData.allowed_outlets.includes(o.id)} onChange={() => toggleOutlet(o.id)} className="h-5 w-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"/>
                                          <span className="text-xs font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-600">{o.name}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                          {error && <div className="bg-red-50 text-red-600 text-[11px] font-bold p-4 rounded-2xl border border-red-100 flex items-start gap-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="leading-relaxed">{error}</span></div>}
                          <div className="flex gap-3 pt-4">
                              <Button type="button" variant="secondary" onClick={handleFormCancel} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200">
                                <span className="flex items-center gap-2"><Command className="w-3 h-3 text-slate-400"/> Cancel</span>
                              </Button>
                              <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl shadow-indigo-100">
                                <span className="flex items-center gap-2">
                                    {isEditing ? 'Commit Sync' : 'Provision User'}
                                    <Command className="w-3 h-3 opacity-50"/>
                                </span>
                              </Button>
                          </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}

      <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} title="Revoke Identity Protocol" description="This profile and all associated facility access scopes will be permanently purged. Access is terminated immediately upon revocation." confirmText="Confirm Revocation" isDestructive={true} />
    </div>
  );
};

export default Users;
