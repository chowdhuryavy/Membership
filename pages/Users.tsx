
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { UserProfile, Role, Outlet, Permission, UserPermissionOverride } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Lock, Eye, RefreshCcw, UserCheck, Plus, X, ArrowLeft, Building2, Command, Search, Filter, ShieldAlert, Check, ChevronRight } from 'lucide-react';

const UserDetail = ({ 
  user, 
  roles, 
  outlets, 
  onBack, 
  onEdit, 
  onDelete,
  onRefresh
}: { 
  user: UserProfile, 
  roles: Role[], 
  outlets: Outlet[], 
  onBack: () => void, 
  onEdit: (user: UserProfile) => void, 
  onDelete: (id: string) => void,
  onRefresh: () => void
}) => {
    const { hasPermission, permissionRegistry } = useSettings();
    const { user: currentUser } = useAuth();
    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown';
    const isUnlinked = !user.auth_id;

    const canManageOverrides = currentUser && hasPermission(currentUser.role_id, 'users:manage_overrides');
    const rolePermissions = roles.find(r => r.id === user.role_id)?.permissions || [];

    const handleToggleOverride = async (key: Permission, currentState: boolean | null) => {
      if (!canManageOverrides) return;
      
      // Cycle: No Override -> Granted -> Denied -> No Override
      if (currentState === null) {
        await db.savePermissionOverride({ user_id: user.id, permission_key: key, is_granted: true });
      } else if (currentState === true) {
        await db.savePermissionOverride({ user_id: user.id, permission_key: key, is_granted: false });
      } else {
        await db.deletePermissionOverride(user.id, key);
      }
      onRefresh();
    };

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
                            <div className="mt-3">
                                {user.is_active !== false ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Active Account
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        Inactive Account
                                    </span>
                                )}
                            </div>
                            <div className="mt-6 flex justify-center gap-2">
                                <Button onClick={() => onEdit(user)} size="sm" className="rounded-xl font-bold">Edit Profile</Button>
                                <Button onClick={() => onDelete(user.id)} size="sm" variant="danger" className="rounded-xl">Revoke</Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <Shield className="w-5 h-5 text-indigo-600" /> Account Context
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
                </div>
                
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3 uppercase">
                                <ShieldAlert className="w-5 h-5 text-indigo-400" /> Granular Policy Overrides
                            </CardTitle>
                            {canManageOverrides && (
                              <div className="bg-white/10 px-4 py-1.5 rounded-xl border border-white/10">
                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-200">Cycle: Default → Grant → Deny</p>
                              </div>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                              {permissionRegistry.map(group => (
                                <div key={group.id} className="p-0">
                                  <div className="bg-slate-50/80 px-8 py-3 flex items-center gap-3">
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{group.label}</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                                    {group.permissions.map(p => {
                                      const override = user.overrides?.find(o => o.permission_key === p.key);
                                      const isRoleDefault = rolePermissions.includes(p.key);
                                      const currentStatus = override === undefined ? null : override.is_granted;
                                      
                                      return (
                                        <div 
                                          key={p.key} 
                                          onClick={() => handleToggleOverride(p.key, currentStatus)}
                                          className={`p-6 flex items-center justify-between bg-white transition-all ${canManageOverrides ? 'cursor-pointer hover:bg-indigo-50/30' : ''}`}
                                        >
                                          <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{p.label}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                              Default: {isRoleDefault ? 'Granted' : 'Restricted'}
                                            </p>
                                          </div>
                                          
                                          <div className="flex items-center gap-2">
                                            {currentStatus === null ? (
                                              <div className="px-2 py-1 rounded bg-slate-100 text-slate-400 text-[8px] font-black uppercase tracking-tighter border border-slate-200">Role Default</div>
                                            ) : currentStatus === true ? (
                                              <div className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-tighter border border-emerald-200 flex items-center gap-1"><Check className="w-2 h-2"/> Manual Grant</div>
                                            ) : (
                                              <div className="px-2 py-1 rounded bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-tighter border border-red-200 flex items-center gap-1"><X className="w-2 h-2"/> Manual Deny</div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
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
  const { roles, outlets, properties, hasPermission, checkShortcut } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState<{ id: string; name: string; email: string; role_id: string; allowed_outlets: string[]; password?: string; is_active: boolean; }>({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '', is_active: true });
  
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const data = await db.getUsers();
        // Hydrate users with overrides
        const hydratedUsers = await Promise.all(data.map(async u => {
          const overrides = await db.getPermissionOverrides(u.id);
          return { ...u, overrides };
        }));
        setUsers(hydratedUsers);
        
        if (selectedUser) {
          const updated = hydratedUsers.find(u => u.id === selectedUser.id);
          if (updated) setSelectedUser(updated);
        }
    } catch (err) { console.error("Directory Load Error:", err); } 
    finally { setLoading(false); }
  };

  const resetForm = () => {
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '', is_active: true });
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
          id: u.id, 
          name: u.name || '', 
          email: u.email || '', 
          role_id: u.role_id || '',
          allowed_outlets: u.allowed_outlets || [], 
          password: '',
          is_active: u.is_active ?? true
      });
      setIsEditing(true);
      setShowForm(true);
  };

  const callEdgeFunction = async (funcName: string, payload: any) => {
    const { data: { session } } = await (supabase.auth as any).getSession();
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role_id === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

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
            if (checkShortcut(e, 'action_create') && canCreate) {
                e.preventDefault();
                handleAddNew();
            }
        }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [showForm, canCreate, checkShortcut]);

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
                password: formData.password || undefined,
                is_active: formData.is_active
            } as any);
        } else {
            await db.addUser({
                name: formData.name, email: formData.email, role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets, password: formData.password,
                is_active: formData.is_active
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
        setView('list'); 
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
            onRefresh={loadUsers}
        />
      ) : (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Identity Management</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized User Directory</p>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <div className="relative group flex-1 sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        placeholder="Search name or email..." 
                        className="w-full h-11 pl-11 pr-4 rounded-xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="relative flex-1 sm:w-48">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select 
                        className="w-full h-11 pl-11 pr-8 rounded-xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold appearance-none cursor-pointer text-slate-700"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadUsers} className="rounded-xl h-11 px-4 font-black border-slate-200" title="Refresh">
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {canCreate && (
                        <Button onClick={handleAddNew} className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 whitespace-nowrap">
                            <Plus className="w-4 h-4 mr-2" /> Provision
                        </Button>
                    )}
                </div>
            </div>
          </div>
          
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50 border-b">
                          <tr>
                              <th className="px-8 py-6">Profile</th>
                              <th className="px-8 py-6 text-center">Status</th>
                              <th className="px-8 py-6 text-center">Sync</th>
                              <th className="px-8 py-6">Security Tier</th>
                              <th className="px-8 py-6">Access Scopes</th>
                              {canModifyTable && <th className="px-8 py-6 text-right">Operations</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredUsers.length === 0 ? (
                              <tr>
                                  <td colSpan={canModifyTable ? 5 : 4} className="px-8 py-24 text-center">
                                      <div className="flex flex-col items-center">
                                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                              <Search className="w-6 h-6 text-slate-300" />
                                          </div>
                                          <p className="font-bold text-slate-900">No users found</p>
                                          <p className="text-xs text-slate-500 mt-1">Try adjusting your search filters.</p>
                                      </div>
                                  </td>
                              </tr>
                          ) : filteredUsers.map(u => (
                              <tr key={u.id} onClick={() => { setSelectedUser(u); setView('detail'); }} className="bg-white hover:bg-slate-50 transition-colors group cursor-pointer">
                                  <td className="px-8 py-6">
                                      <div className="font-black text-slate-900 tracking-tight text-base">{u.name}</div>
                                      <div className="text-indigo-600 text-xs font-bold">{u.email}</div>
                                  </td>
                                  <td className="px-8 py-6 text-center">
                                      {u.is_active !== false ? (
                                          <div className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 w-fit">
                                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                              <span className="text-[9px] font-black uppercase tracking-widest">Active</span>
                                          </div>
                                      ) : (
                                          <div className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 w-fit">
                                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                              <span className="text-[9px] font-black uppercase tracking-widest">Inactive</span>
                                          </div>
                                      )}
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
                                      <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                                          {(() => {
                                              const validOutlets = (u.allowed_outlets || [])
                                                  .map(id => outlets.find(o => o.id === id))
                                                  .filter(Boolean);
                                              
                                              if (validOutlets.length === 0) {
                                                  return <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-red-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5 mr-1.5"/> No Access</span>;
                                              }

                                              const displayLimit = 2;
                                              const visible = validOutlets.slice(0, displayLimit);
                                              const remaining = validOutlets.length - displayLimit;

                                              return (
                                                  <>
                                                      {visible.map(o => (
                                                          <span key={o!.id} className="text-[9px] font-black uppercase tracking-tight bg-white px-2.5 py-0.5 rounded-lg text-slate-500 flex items-center border border-slate-200 shadow-sm whitespace-nowrap">
                                                              <Store className="w-2.5 h-2.5 mr-1.5 text-slate-300"/> {o!.name}
                                                          </span>
                                                      ))}
                                                      {remaining > 0 && (
                                                          <span className="text-[9px] font-black uppercase tracking-tight bg-indigo-50 px-2.5 py-0.5 rounded-lg text-indigo-600 border border-indigo-100 whitespace-nowrap shadow-sm">
                                                              +{remaining} more
                                                          </span>
                                                      )}
                                                  </>
                                              );
                                          })()}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="w-full max-w-2xl relative my-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                    <CardHeader className="bg-indigo-600 text-white p-6 md:p-8 relative shrink-0">
                        <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Identity' : 'Provision User'}</CardTitle>
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2">Security Lifecycle</p>
                        <button onClick={handleFormCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Legal Name</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Work Email</label>
                                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@enterprise.com" className={`h-12 rounded-xl ${!canEditEmail ? 'bg-slate-50 text-slate-500' : ''}`} disabled={!canEditEmail} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">{isEditing ? 'Override Key' : 'Initial Access Key'}</label>
                                <div className="relative group">
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2"><Lock className="w-4 h-4 text-slate-400" /></div>
                                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={isEditing ? "Leave blank to preserve" : "••••••••"} className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50" />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Security Tier</label>
                                <Select options={[{ value: '', label: 'Select Tier...' }, ...roles.map(r => ({ value: r.id, label: r.name }))]} value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})} className="h-12 rounded-xl" />
                            </div>
                          </div>
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1 mb-2 block">Account Status</label>
                              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                  <button
                                      type="button"
                                      onClick={() => setFormData({ ...formData, is_active: true })}
                                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.is_active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 border border-slate-200'}`}
                                  >
                                      Active
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setFormData({ ...formData, is_active: false })}
                                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!formData.is_active ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-white text-slate-400 border border-slate-200'}`}
                                  >
                                      Inactive
                                  </button>
                              </div>
                          </div>
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1 mb-2 block">Facility Access Scopes</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-48 overflow-y-auto shadow-inner custom-scrollbar">
                                  {outlets.map(o => {
                                      const property = properties.find(p => p.id === o.property_id);
                                      return (
                                        <label key={o.id} className="flex items-start space-x-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                                            <input type="checkbox" checked={formData.allowed_outlets.includes(o.id)} onChange={() => toggleOutlet(o.id)} className="h-5 w-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 shrink-0 mt-0.5"/>
                                            <div>
                                                <span className="text-xs font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-600 block">{o.name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter block">{property?.name || 'Unassigned'}</span>
                                            </div>
                                        </label>
                                      );
                                  })}
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
