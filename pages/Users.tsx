
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { UserProfile, Role, Outlet, Permission, UserPermissionOverride, Staff } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getReportData } from '../src/shared/reportLogic';
import { Trash2, Edit2, Shield, Store, AlertTriangle, Lock, Eye, RefreshCcw, UserCheck, Plus, X, ArrowLeft, Building2, Command, Search, Filter, ShieldAlert, Check, ChevronRight, Award, TrendingUp, Sparkles, User as UserIcon, Calendar, ChevronDown, CheckCircle, MousePointer, ShieldCheck, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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
    const { hasPermission, permissionRegistry, settings, formatMoney } = useSettings();
    const { user: currentUser, isSuperAdmin } = useAuth();
    
    const [linkedStaff, setLinkedStaff] = useState<Staff | null>(null);
    const [incentiveData, setIncentiveData] = useState<any[]>([]);
    const [incentiveSummary, setIncentiveSummary] = useState<any>({});
    const [incentiveLoading, setIncentiveLoading] = useState(false);
    const [incentiveDate, setIncentiveDate] = useState(new Date());

    useEffect(() => {
      findLinkedStaff();
    }, [user.email]);

    useEffect(() => {
      if (linkedStaff) {
        loadIncentives();
      }
    }, [linkedStaff, incentiveDate]);

    const findLinkedStaff = async () => {
      try {
        // Use currentProperty.id from settings if available, otherwise fetch all staff
        const propId = user.allowed_outlets?.[0] ? outlets.find(o => o.id === user.allowed_outlets[0])?.property_id : '';
        const staffList = await db.getStaff(propId || '', !propId);
        const match = staffList.find(s => s.email?.toLowerCase() === user.email.toLowerCase());
        setLinkedStaff(match || null);
      } catch (error) {
        console.error("Error finding linked staff:", error);
      }
    };

    const loadIncentives = async () => {
      if (!linkedStaff) return;
      setIncentiveLoading(true);
      try {
        const propertyId = linkedStaff.property_id;
        const depts: ('Massage' | 'Membership' | 'Personal Training' | 'Referral' | 'Sale')[] = ['Massage', 'Membership', 'Personal Training', 'Referral', 'Sale'];
        let allRows: any[] = [];
        let totalInc = 0;

        for (const dept of depts) {
          const result = await getReportData({
            supabase,
            propertyId,
            outletId: 'all',
            reportType: 'incentives',
            date: incentiveDate,
            incentiveDept: dept
          });

          const staffRows = result.rows.filter(r => r.staff_splits && r.staff_splits[linkedStaff.id]);
          const rowsWithDept = staffRows.map(r => ({
            ...r,
            department: dept,
            my_incentive: r.staff_splits[linkedStaff.id]
          }));

          allRows = [...allRows, ...rowsWithDept];
          totalInc += rowsWithDept.reduce((sum, r) => sum + r.my_incentive, 0);
        }

        allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setIncentiveData(allRows);
        setIncentiveSummary({ total: totalInc, count: allRows.length });
      } catch (error) {
        console.error("Failed to load incentives:", error);
      } finally {
        setIncentiveLoading(false);
      }
    };

    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown';
    const isUnlinked = !user.auth_id;

    const isSelf = currentUser?.id === user.id;
    const canManageOverrides = currentUser && hasPermission(currentUser.role_id, 'users:manage_overrides') && (!isSelf || isSuperAdmin);
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

    const isSuperTarget = user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin';
    const isSuperCurrent = isSuperAdmin;
    const canEditUser = currentUser && hasPermission(currentUser.role_id, 'users:edit');
    const canEditSelf = currentUser && hasPermission(currentUser.role_id, 'users:edit_self');
    const canModifyThisUser = (!isSuperTarget || isSuperCurrent) && canEditUser && (!isSelf || isSuperAdmin || canEditSelf);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 relative z-0">
        <motion.button 
          whileHover={{ scale: 1.02, x: -4 }} 
          whileTap={{ scale: 0.98 }}
          onClick={onBack} 
          className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-all bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-100 group"
        >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Directory
        </motion.button>
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
                            {canModifyThisUser && (
                                <div className="mt-6 flex justify-center gap-2">
                                    <Button onClick={() => onEdit(user)} size="sm" className="rounded-xl font-bold">Edit Profile</Button>
                                    <Button onClick={() => onDelete(user.id)} size="sm" variant="danger" className="rounded-xl">Revoke</Button>
                                </div>
                            )}
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
                                <span className="font-bold text-slate-500">Role</span>
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

                    {linkedStaff && (
                      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm"><Award className="w-5 h-5 text-indigo-600" /></div>
                            <div>
                                <CardTitle className="text-lg font-black tracking-tight">Incentive Earnings</CardTitle>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Linked Staff Performance Data</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() - 1, 1))}
                              className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                            >
                              <RefreshCcw className="w-3.5 h-3.5 rotate-[-90deg]" />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 min-w-[80px] text-center">
                              {format(incentiveDate, 'MMM yyyy')}
                            </span>
                            <button 
                              onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() + 1, 1))}
                              className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                            >
                              <RefreshCcw className="w-3.5 h-3.5 rotate-[90deg]" />
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Earnings</div>
                              <div className="text-2xl font-black text-white">{formatMoney(incentiveSummary.total)}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Services</div>
                              <div className="text-2xl font-black text-slate-900">{incentiveSummary.count || 0}</div>
                            </div>
                          </div>

                          {incentiveLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Calculating...</p>
                            </div>
                          ) : incentiveData.length === 0 ? (
                            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200/60 text-center">
                              <Award className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No incentives for this period</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                              <AnimatePresence mode="popLayout">
                                {incentiveData.map((item, index) => (
                                  <motion.div 
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${
                                        item.department === 'Massage' ? 'bg-indigo-50 text-indigo-600' :
                                        item.department === 'Membership' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-amber-50 text-amber-600'
                                      }`}>
                                        {item.department === 'Massage' ? <Sparkles className="w-4 h-4" /> :
                                         item.department === 'Membership' ? <TrendingUp className="w-4 h-4" /> :
                                         <Award className="w-4 h-4" />}
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.item_name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <Calendar className="w-2.5 h-2.5 text-slate-300" />
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <p className="text-sm font-black text-indigo-600">{formatMoney(item.my_incentive)}</p>
                                      <div className="flex items-center gap-2 mt-1 opacity-60">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Price: {formatMoney(item.actual_price)}</span>
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Net: {formatMoney(item.net_revenue)}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

const Users = () => {
  const { user: currentUser, isSuperAdmin, refreshUser } = useAuth();
  const { roles, outlets, properties, currentProperty, hasPermission, checkShortcut } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState<{ 
    id: string; 
    name: string; 
    email: string; 
    role_id: string; 
    allowed_outlets: string[]; 
    default_outlet_id: string;
    password?: string; 
    is_active: boolean; 
  }>({ 
    id: '', 
    name: '', 
    email: '', 
    role_id: '', 
    allowed_outlets: [], 
    default_outlet_id: '',
    password: '', 
    is_active: true 
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
            setIsFilterOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRole = useMemo(() => {
    if (roleFilter === 'all') return { id: 'all', name: 'All Roles', icon: ShieldCheck };
    const role = roles.find(r => r.id === roleFilter);
    return { id: role?.id || 'all', name: role?.name || 'All Roles', icon: ShieldCheck };
  }, [roleFilter, roles]);

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
      setFormData({ id: '', name: '', email: '', role_id: '', allowed_outlets: [], default_outlet_id: '', password: '', is_active: true });
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
          default_outlet_id: u.default_outlet_id || '',
          password: '',
          is_active: u.is_active ?? true
      });
      setIsEditing(true);
      setShowForm(true);
  };

  const callEdgeFunction = async (funcName: string, payload: any) => {
    const { data: { session } } = await (supabase.auth as any).getSession();
    if (!session) throw new Error("Session expired. Please refresh the page or login again.");
    
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${funcName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, accessToken: session.access_token })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned status ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error: any) {
        console.error(`Edge function call failed: ${funcName}`, error);
        throw new Error(`Failed to call edge function ${funcName}: ${error.message}`);
    }
  };

  const canViewUsers = currentUser && hasPermission(currentUser.role_id, 'users:view');
  const canCreate = currentUser && hasPermission(currentUser.role_id, 'users:create');
  const canEdit = currentUser && hasPermission(currentUser.role_id, 'users:edit');
  const canDelete = currentUser && hasPermission(currentUser.role_id, 'users:delete');
  const canModifyTable = canEdit || canDelete;
  const canEditEmail = currentUser && (hasPermission(currentUser.role_id, 'users:edit_email') || !isEditing);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Hide Super Admin from non-Super Admins
      if ((u.role_id?.toLowerCase() === 'admin' || u.role_id?.toLowerCase() === 'system_admin') && !isSuperAdmin) {
          return false;
      }

      // Property-based filtering: Only show users who have access to at least one outlet the current user has access to
      if (!isSuperAdmin && currentUser) {
          const hasCommonOutlet = u.allowed_outlets.some(outletId => currentUser.allowed_outlets.includes(outletId));
          if (!hasCommonOutlet) return false;
      }

      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role_id === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter, isSuperAdmin, currentUser]);

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
                <h3 className="text-lg font-bold text-red-600">Access Denied</h3>
                <p className="text-slate-600 mt-2 text-sm">Permission insufficient to access the user directory.</p>
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
        setError("Name, Email, and Role are required.");
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
                default_outlet_id: formData.default_outlet_id || null,
                password: formData.password || undefined,
                is_active: formData.is_active
            } as any);
        } else {
            await db.addUser({
                name: formData.name, email: formData.email, role_id: formData.role_id,
                allowed_outlets: formData.allowed_outlets, 
                default_outlet_id: formData.default_outlet_id || null,
                password: formData.password,
                is_active: formData.is_active
            } as any);
        }
        handleFormCancel();
        await loadUsers();
        if (formData.id === currentUser?.id) {
            await refreshUser();
        }
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
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-100">
                    <Shield className="w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Security Matrix</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{currentProperty?.name || 'Authorized Directives'} • {filteredUsers.length} Identities Found</p>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto">
                {/* Search */}
                <div className="relative group min-w-[240px]">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all">
                        <Search className="h-4 w-4" />
                    </div>
                    <input 
                        placeholder="Search name or email..." 
                        className="w-full h-14 pl-14 pr-4 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold placeholder:text-slate-400 shadow-inner"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {/* Custom Role Filter Dropdown */}
                <div className="relative min-w-[200px] z-[60]" ref={filterRef}>
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`h-14 w-full px-5 rounded-2xl border transition-all flex items-center justify-between group/btn shadow-sm ${isFilterOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100 transition-colors ${isFilterOpen ? 'text-indigo-600' : 'text-slate-400'}`}>
                                <currentRole.icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col items-start overflow-hidden text-left">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Access Level</span>
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate w-full">{currentRole.name}</span>
                            </div>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-300 ${isFilterOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <div className="absolute top-full mt-3 left-0 right-0 bg-white border border-slate-200 rounded-[1.8rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
                            <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Tier</span>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={() => { setRoleFilter('all'); setIsFilterOpen(false); }}
                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group/item ${roleFilter === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'}`}
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${roleFilter === 'all' ? 'bg-white/20 border-white/20' : 'bg-white border-slate-100 shadow-sm'}`}>
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-tight">All Access Roles</span>
                                    </div>
                                    {roleFilter === 'all' && <CheckCircle className="w-4 h-4 text-white" />}
                                </button>

                                {roles.filter(r => {
                                    const isSuperUser = isSuperAdmin;
                                    if ((r.id === 'admin' || r.name === 'System Administrator') && !isSuperUser) return false;
                                    return true;
                                }).map(r => {
                                    const isSelected = roleFilter === r.id;
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => {
                                                setRoleFilter(r.id);
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group/item ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'}`}
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${isSelected ? 'bg-white/20 border-white/20' : 'bg-white border-slate-100 shadow-sm'}`}>
                                                    <UserCog className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-tight">{r.name}</span>
                                            </div>
                                            {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                            {!isSelected && <MousePointer className="w-3 h-3 text-indigo-300 opacity-0 group-hover/item:opacity-100 transition-opacity" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadUsers} className="rounded-2xl h-14 px-5 font-black border-slate-200 transition-all hover:bg-indigo-50 hover:text-indigo-600" title="Synchronize Directory">
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {canCreate && (
                        <Button onClick={handleAddNew} className="rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-indigo-100 bg-indigo-600 whitespace-nowrap transition-transform active:scale-95">
                            <Plus className="w-4 h-4 mr-2" /> Provision Profile
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
                              <th className="px-8 py-6">Role</th>
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
                                                  .filter(o => o !== undefined && (isSuperAdmin || currentUser?.allowed_outlets.includes(o.id)));
                                              
                                              if (validOutlets.length === 0) {
                                                  // Show "Other Facilities" if they have access but admin can't see which ones
                                                  const totalHidden = (u.allowed_outlets || []).length;
                                                  if (totalHidden > 0 && !isSuperAdmin) {
                                                    return <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest flex items-center bg-slate-50 px-2.5 py-1 rounded-lg"><Shield className="w-3.5 h-3.5 mr-1.5"/> Access to {totalHidden} other scopes</span>;
                                                  }
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
                                            {canEdit && (u.id !== currentUser?.id || isSuperAdmin || hasPermission(currentUser.role_id, 'users:edit_self')) && <button onClick={() => handleEdit(u)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>}
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
                        <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Edit User' : 'Add User'}</CardTitle>
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2">User Settings</p>
                        <button onClick={handleFormCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Full Name</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Email Address</label>
                                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@enterprise.com" className={`h-12 rounded-xl ${!canEditEmail ? 'bg-slate-50 text-slate-500' : ''}`} disabled={!canEditEmail} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">{isEditing ? 'New Password' : 'Password'}</label>
                                <div className="relative group">
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2"><Lock className="w-4 h-4 text-slate-400" /></div>
                                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={isEditing ? "Leave blank to preserve" : "••••••••"} className="w-full h-12 pl-11 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50" />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Role</label>
                                <Select 
                                    options={[{ value: '', label: 'Select Role...' }, ...roles.filter(r => {
                                        const isSuperUser = isSuperAdmin;
                                        if ((r.id === 'admin' || r.name === 'System Administrator') && !isSuperUser) return false;
                                        return true;
                                    }).map(r => ({ value: r.id, label: r.name }))]} 
                                    value={formData.role_id} 
                                    onChange={e => setFormData({...formData, role_id: e.target.value})} 
                                    className="h-12 rounded-xl" 
                                    disabled={!isSuperAdmin && currentUser?.id === formData.id && !hasPermission(currentUser.role_id, 'users:edit_self')}
                                />
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
                                  {outlets.filter(o => isSuperAdmin || currentUser?.allowed_outlets.includes(o.id)).map(o => {
                                      const property = properties.find(p => p.id === o.property_id);
                                      return (
                                        <label key={o.id} className={`flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group ${(!isSuperAdmin && currentUser?.id === formData.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={formData.allowed_outlets.includes(o.id)} 
                                                onChange={() => toggleOutlet(o.id)} 
                                                disabled={!isSuperAdmin && currentUser?.id === formData.id}
                                                className="h-5 w-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 shrink-0 mt-0.5"
                                            />
                                            <div>
                                                <span className="text-xs font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-600 block">{o.name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter block">{property?.name || 'Unassigned'}</span>
                                            </div>
                                        </label>
                                      );
                                  })}
                              </div>
                          </div>

                          {formData.allowed_outlets.length > 1 && (
                            <div className="space-y-2 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1 mb-2 block">Primary Account Home (Default Outlet)</label>
                                <Select 
                                    options={[
                                        { value: '', label: 'None (Browser Remembers Last Outlet)' }, 
                                        ...outlets
                                            .filter(o => 
                                                formData.allowed_outlets.includes(o.id) && 
                                                (isSuperAdmin || currentUser?.allowed_outlets.includes(o.id))
                                            )
                                            .map(o => {
                                                const prop = properties.find(p => p.id === o.property_id);
                                                return { 
                                                    value: o.id, 
                                                    label: prop ? `${prop.name} | ${o.name}` : o.name 
                                                };
                                            })
                                    ]}
                                    value={formData.default_outlet_id}
                                    onChange={e => setFormData({ ...formData, default_outlet_id: e.target.value })}
                                    className="h-12 rounded-xl"
                                />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide px-2 mt-1">This outlet will be automatically selected whenever this user logs in.</p>
                            </div>
                          )}
                          {error && <div className="bg-red-50 text-red-600 text-[11px] font-bold p-4 rounded-2xl border border-red-100 flex items-start gap-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="leading-relaxed">{error}</span></div>}
                          <div className="flex gap-3 pt-4">
                              <Button type="button" variant="secondary" onClick={handleFormCancel} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200">
                                <span className="flex items-center gap-2"><Command className="w-3 h-3 text-slate-400"/> Cancel</span>
                              </Button>
                              <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl shadow-indigo-100">
                                <span className="flex items-center gap-2">
                                    {isEditing ? 'Save Changes' : 'Add User'}
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

      <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} title="Delete User" description="This profile and all associated facility access scopes will be permanently purged. Access is terminated immediately upon revocation." confirmText="Confirm Deletion" isDestructive={true} />
    </div>
  );
};

export default Users;
