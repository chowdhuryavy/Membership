import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { UserProfile, Role, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Info, Lock, Eye, EyeOff, RefreshCcw, UserCheck, ShieldAlert, ServerCrash, Activity } from 'lucide-react';

const Users = () => {
  const { user: currentUser } = useAuth();
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
  const [diagInfo, setDiagInfo] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const data = await db.getUsers();
        setUsers(data);
    } catch (err) {
        console.error("Directory Load Error:", err);
    } finally {
        setLoading(false);
    }
  };

  const resetForm = () => {
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], password: '' });
      setIsEditing(false);
      setError('');
      setDiagInfo(null);
      setShowPassword(false);
  }

  const callEdgeFunction = async (funcName: string, payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        throw new Error("Session expired. Please refresh the page or login again.");
    }

    console.log(`[Frontend] Invoking ${funcName} for: ${session.user.email}`);

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${funcName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...payload, accessToken: session.access_token })
        });

        const data = await response.json();

        if (data && data.error) {
            console.error(`[Frontend] Function ${funcName} Application Error:`, data.error);
            throw new Error(data.error);
        }

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        
        return data;
    } catch (err: any) {
        console.error(`[Frontend] Function ${funcName} Failed:`, err);
        throw new Error(err.message || "Network request failed.");
    }
  };

  const canViewUsers = currentUser && hasPermission(currentUser.role_id, 'users:view');
  
  // Specific Permissions
  const canCreate = currentUser && hasPermission(currentUser.role_id, 'users:create');
  const canEdit = currentUser && hasPermission(currentUser.role_id, 'users:edit');
  const canDelete = currentUser && hasPermission(currentUser.role_id, 'users:delete');
  
  // Logical grouping for UI elements
  const canModifyTable = canEdit || canDelete;
  const canSeeForm = canCreate || (isEditing && canEdit);
  const canEditEmail = currentUser && (hasPermission(currentUser.role_id, 'users:edit_email') || !isEditing);

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

    // Strict Permission Check
    if (isEditing && !canEdit) return;
    if (!isEditing && !canCreate) return;

    setError('');
    setDiagInfo(null);
    
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
        if (isEditing && formData.id) {
            const currentUserProfile = users.find(u => u.id === formData.id);
            
            // Sync with Auth if user is linked
            if (currentUserProfile?.auth_id) {
                const updates: { password?: string; email?: string; name?: string } = {};
                if (formData.password?.trim()) updates.password = formData.password;
                if (canEditEmail && formData.email !== currentUserProfile.email) updates.email = formData.email;
                if (formData.name !== currentUserProfile.name) updates.name = formData.name;
                
                if (Object.keys(updates).length > 0) {
                    try {
                        await callEdgeFunction('admin-reset-user', { userId: currentUserProfile.auth_id, ...updates });
                        setDiagInfo("Success: Identity updated via secure Edge Function.");
                    } catch (err: any) {
                        console.error("Auth Sync Error:", err);
                        setDiagInfo(`Auth Sync Warning: ${err.message}. Database updated locally.`);
                    }
                }
            }
            
            await db.updateUser(formData.id, {
                name: formData.name,
                email: canEditEmail ? formData.email : undefined,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets,
                password: formData.password || undefined 
            } as any);
        } else {
            // Creation logic
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
        console.error("Submission Failure:", err);
        setError(err.message || "Database update failed.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEdit = (u: UserProfile) => {
      if (!canEdit) return;
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
      setDiagInfo(null);
      setShowPassword(false);
  };

  const confirmDelete = async () => {
    if (!deleteId || !canDelete) return;
    setIsSubmitting(true);
    setError('');

    try {
        const currentUserProfile = users.find(u => u.id === deleteId);
        
        if (currentUserProfile?.auth_id) {
            try {
                await callEdgeFunction('dynamic-action', { action: 'delete', userId: currentUserProfile.auth_id });
            } catch (err: any) {
                console.warn("Auth Deletion Warning:", err.message);
                setDiagInfo(`Warning: Could not purge from Auth provider: ${err.message}. Database record was cleared.`);
            }
        }

        await db.deleteUser(deleteId);
        await loadUsers();
        setDeleteId(null);
    } catch (err: any) {
        setError(err.message || "Revocation failed.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const toggleOutlet = (outletId: string) => {
      setFormData(prev => ({
          ...prev,
          allowed_outlets: prev.allowed_outlets.includes(outletId)
              ? prev.allowed_outlets.filter(id => id !== outletId)
              : [...prev.allowed_outlets, outletId]
      }));
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
        <div className={canSeeForm ? "xl:col-span-2 space-y-8" : "xl:col-span-3 space-y-8"}>
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
                                            <div className="flex flex-wrap gap-2">
                                                {(!u.allowed_outlets || u.allowed_outlets.length === 0) ? (
                                                    <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-red-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5 mr-1.5"/> No Access</span>
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
                                        {canModifyTable && (
                                          <td className="px-8 py-6 text-right">
                                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  {canEdit && (
                                                    <button type="button" onClick={() => handleEdit(u)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                  )}
                                                  {canDelete && u.id !== currentUser?.id && (
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
                    <ServerCrash className="w-48 h-48 text-indigo-500" />
                </div>
                <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40">
                            <ShieldAlert className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h4 className="text-white font-black uppercase tracking-[0.2em] text-lg">System Management Diagnostics</h4>
                            <p className="text-indigo-400 text-xs font-bold">Admin-Only Deployment Notes</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
                            <h5 className="text-indigo-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <Info className="w-4 h-4"/> Why use Edge Functions?
                            </h5>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                                Supabase clients can sign up, but only the <strong>Service Role</strong> can modify another user's email or password. This app uses Edge Functions to securely execute these management actions.
                            </p>
                        </div>

                        <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
                            <h5 className="text-amber-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4"/> Error Diagnostics
                            </h5>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                                <strong>401 Unauthorized:</strong> The function rejected your token. Try logging out and back in.
                                <br/>
                                <strong>404 Not Found:</strong> The function is not deployed. Run <code>npx supabase functions deploy</code>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {canSeeForm && (
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
                                  className={`h-12 rounded-xl ${!canEditEmail ? 'bg-slate-50 text-slate-500' : ''}`}
                                  disabled={!canEditEmail}
                              />
                              {!canEditEmail && <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider ml-1">Modification Restricted</p>}
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {isEditing ? 'Management Override Key' : 'Initial Access Key'}
                              </label>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    placeholder={isEditing ? "Leave blank to preserve" : "••••••••"}
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
                                  <span className="leading-relaxed">{error}</span>
                              </div>
                          )}

                          {diagInfo && (
                              <div className="bg-indigo-50 text-indigo-700 text-[10px] font-bold p-4 rounded-2xl border border-indigo-100 flex items-start gap-3 animate-in slide-in-from-top-2">
                                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">{diagInfo}</span>
                              </div>
                          )}

                          <div className="flex gap-3 pt-4">
                              {isEditing && (
                                  <button type="button" onClick={resetForm} className="flex-1 h-14 rounded-2xl font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                                      Cancel
                                  </button>
                              )}
                              <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl shadow-indigo-100">
                                  {isEditing ? 'Commit Sync' : 'Provision User'}
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
        description="This profile and all associated facility access scopes will be permanently purged. Access is terminated immediately upon revocation."
        confirmText="Confirm Revocation"
        isDestructive={true}
      />
    </div>
  );
};

export default Users;