
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { UserProfile, Role, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Shield, CheckCircle, XCircle, Store, AlertTriangle, Info } from 'lucide-react';

const Users = () => {
  const { user } = useAuth();
  const { roles, outlets, hasPermission } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Form State
  const [formData, setFormData] = useState<{
      id: string;
      name: string;
      email: string;
      role_id: string;
      allowed_outlets: string[];
  }>({ id: '', name: '', email: '', role_id: '', allowed_outlets: [] });
  
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
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [] });
      setIsEditing(false);
      setError('');
  }

  // Permission Check
  if (!user || !hasPermission(user.role_id, 'manage_users')) {
    return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md text-center p-6">
                <h3 className="text-lg font-bold text-red-600">Access Denied</h3>
                <p className="text-slate-600 mt-2">You do not have permission to manage users.</p>
            </Card>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validations
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
    
    try {
        if (isEditing && formData.id) {
            await db.updateUser(formData.id, {
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets
            });
        } else {
            await db.addUser({
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets
            });
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
          allowed_outlets: u.allowed_outlets || []
      });
      setIsEditing(true);
      setError('');
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
      <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* User List Column */}
        <div className="xl:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>System Users</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-3">User Profile</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Assigned Outlets</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="bg-white border-b last:border-0 hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{u.name}</div>
                                        <div className="text-slate-500 text-xs">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            <Shield className="w-3 h-3 mr-1" />
                                            {getRoleName(u.role_id)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(!u.allowed_outlets || u.allowed_outlets.length === 0) ? (
                                                <span className="text-red-500 text-xs flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> No Access</span>
                                            ) : (
                                                u.allowed_outlets.map(outId => {
                                                    const outName = outlets.find(o => o.id === outId)?.name;
                                                    return outName ? (
                                                        <span key={outId} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 flex items-center border border-slate-200">
                                                            <Store className="w-3 h-3 mr-1 text-slate-400"/> {outName}
                                                        </span>
                                                    ) : null;
                                                })
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button type="button" onClick={() => handleEdit(u)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        {u.id !== user?.id && (
                                            <button type="button" onClick={() => setDeleteId(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>

        {/* Form Column */}
        <div>
            <Card className="sticky top-6">
                <CardHeader>
                    <CardTitle>{isEditing ? 'Edit User Profile' : 'Register New User'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Notice for new users */}
                        {!isEditing && (
                            <div className="bg-blue-50 p-3 rounded text-xs text-blue-700 border border-blue-100 flex gap-2">
                                <Info className="w-4 h-4 shrink-0" />
                                <div>
                                    New users are created with the default password <strong>"password"</strong>. 
                                    They must change it via their Profile page upon first login.
                                </div>
                            </div>
                        )}

                        <Input 
                            label="Full Name" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            placeholder="e.g. John Doe"
                        />
                        <Input 
                            type="email"
                            label="Email Address" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                            placeholder="user@nexus.com"
                        />
                        
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">Role Assignment <span className="text-red-500">*</span></label>
                            {roles.length > 0 ? (
                                <Select
                                    options={[
                                        { value: '', label: 'Select a Role...' },
                                        ...roles.map(r => ({ value: r.id, label: r.name }))
                                    ]}
                                    value={formData.role_id}
                                    onChange={e => setFormData({...formData, role_id: e.target.value})}
                                    className={!formData.role_id ? 'border-amber-300 ring-1 ring-amber-100' : ''}
                                />
                            ) : (
                                <p className="text-xs text-red-500">No roles found. Please configure roles in Settings first.</p>
                            )}
                            <p className="text-xs text-slate-400">Determines what actions the user can perform.</p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label className="block text-sm font-medium text-slate-700">Access Scope (Outlets) <span className="text-red-500">*</span></label>
                            <div className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200 max-h-48 overflow-y-auto">
                                {outlets.length === 0 && <p className="text-xs text-slate-400">No outlets configured in settings.</p>}
                                {outlets.map(outlet => (
                                    <label key={outlet.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                        <input 
                                            type="checkbox"
                                            checked={formData.allowed_outlets.includes(outlet.id)}
                                            onChange={() => toggleOutlet(outlet.id)}
                                            className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-slate-700 flex items-center gap-2">
                                            <Store className="w-3 h-3 text-slate-400"/> {outlet.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            {formData.allowed_outlets.length === 0 && (
                                <p className="text-xs text-amber-600">Please select at least one outlet.</p>
                            )}
                        </div>
                        
                        {error && (
                            <div className="bg-red-50 text-red-600 text-xs p-3 rounded border border-red-100 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            {isEditing && (
                                <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
                                    Cancel
                                </Button>
                            )}
                            <Button type="submit" className="flex-1">
                                {isEditing ? 'Save Changes' : 'Create User'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        description="Are you sure you want to remove this user? This action cannot be undone."
        confirmText="Remove User"
        isDestructive={true}
      />
    </div>
  );
};

export default Users;
