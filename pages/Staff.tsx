import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Staff, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { format, isWithinInterval, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { isStaffAssignedToOutletOnDate } from '../src/shared/reportLogic';
import { 
  Trash2, 
  Edit2, 
  Contact2, 
  Store, 
  Plus, 
  X, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Phone,
  CalendarX,
  LayoutGrid,
  UserPlus,
  RefreshCcw,
  ShieldAlert,
  Info,
  Terminal,
  History,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  ClipboardCheck,
  AlertCircle,
  Coins,
  Shield,
  Layers,
  CalendarDays
} from 'lucide-react';

import StaffProfileView from './StaffProfileView';

const StaffPage = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, hasPermission, outlets = [], setPageLoading } = useSettings();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Staff, 'id' | 'created_at'>>({ 
    name: '', 
    role: '', 
    email: '', 
    phone: '', 
    is_active: true,
    is_eligible_for_incentives: true,
    joining_date: format(new Date(), 'yyyy-MM-dd'),
    inactive_date: '',
    probation_start_date: '',
    probation_end_date: '',
    property_id: '',
    outlet_ids: [],
    outlet_assignments: [],
    can_login: false,
    employee_number: '',
    password: '',
    staff_portal_settings: {
      show_daily_schedule: true,
      show_monthly_summary: true,
      show_incentives: true,
      show_session_notes: true
    }
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isTransferMode, setIsTransferMode] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [newAssignment, setNewAssignment] = useState({ outlet_id: '', start_date: format(new Date(), 'yyyy-MM-dd') });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);

  const statusOptions = [
    { value: 'all', label: 'All Personnel', icon: Layers, color: 'text-slate-400' },
    { value: 'active', label: 'Active Only', icon: UserCheck, color: 'text-emerald-500' },
    { value: 'inactive', label: 'Inactive Only', icon: UserX, color: 'text-red-500' },
  ];

  const currentOption = statusOptions.find(o => o.value === statusFilter) || statusOptions[0];

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

  const outletMap = useMemo(() => {
    return Object.fromEntries((outlets || []).map(o => [o.id, o.name]));
  }, [outlets]);

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user || !outlets) return [];
    if (user.role_id?.toLowerCase() === 'admin') {
        return outlets.filter(o => o.property_id === currentProperty.id);
    }
    return outlets.filter(o => 
        o.property_id === currentProperty.id && 
        user.allowed_outlets?.includes(o.id)
    );
  }, [currentProperty, user, outlets]);

  // Security Check
  const canView = user && hasPermission(user.role_id, 'staff:view');
  const canManage = user && hasPermission(user.role_id, 'staff:manage');
  const canManageLeaves = user && hasPermission(user.role_id, 'staff:manage_leaves');
  const canManagePortalSettings = user && hasPermission(user.role_id, 'staff:manage_portal_settings');
  const canSwitchScope = user && hasPermission(user.role_id, 'settings:view_properties') && allowedOutletsInProperty.length > 1;

  const loadStaff = useCallback(async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    setPageLoading(true);
    setErrorMessage(null);
    setIsSchemaMissing(false);
    try {
      let data: Staff[] = [];
      if (viewScope === 'outlet') {
        data = await db.getStaff(currentOutlet.id);
      } else {
        // If property scope is active, fetch for all allowed outlets in property
        const allowedIds = allowedOutletsInProperty.map(o => o.id);
        data = await db.getStaff(currentProperty.id, true, allowedIds);
      }
      setStaff(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load staff roster.");
      if (err.message?.includes('schema cache') || err.message?.toLowerCase().includes('column')) {
        setIsSchemaMissing(true);
      }
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [currentOutlet, currentProperty, viewScope, allowedOutletsInProperty]);

  useEffect(() => {
    if (currentOutlet && canView) {
      loadStaff();
    } else if (!currentOutlet) {
      setLoading(false);
    }
  }, [currentOutlet, canView, loadStaff]);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!currentOutlet || !currentProperty || !canView) return;

    const channel = supabase
      .channel('realtime-staff')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => loadStaff()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_leaves' },
        () => loadStaff()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOutlet, currentProperty, canView, loadStaff]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const checkDate = `${selectedMonth}-01`;
      // Consistency fix: Use assignment logic for both modes to ensure "Active Only" matches roster deployment
      const isCurrentlyAssigned = viewScope === 'outlet' && currentOutlet 
        ? isStaffAssignedToOutletOnDate(s, currentOutlet.id, checkDate)
        : allowedOutletsInProperty.some(o => isStaffAssignedToOutletOnDate(s, o.id, checkDate));

      const matchesStatus = statusFilter === 'all' ? true : 
                            statusFilter === 'active' ? isCurrentlyAssigned : !isCurrentlyAssigned;

      return matchesSearch && matchesStatus;
    });
  }, [staff, searchTerm, statusFilter, selectedMonth, viewScope, currentOutlet, allowedOutletsInProperty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet || !canManage) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const dataToSave: any = {
        name: formData.name,
        role: formData.role,
        email: formData.email,
        phone: formData.phone,
        is_active: formData.is_active,
        is_eligible_for_incentives: formData.is_eligible_for_incentives,
        joining_date: formData.joining_date,
        inactive_date: formData.inactive_date || null,
        probation_start_date: formData.probation_start_date,
        probation_end_date: formData.probation_end_date,
        property_id: formData.property_id,
        outlet_ids: formData.outlet_ids,
        outlet_assignments: formData.outlet_assignments || [],
        can_login: !!formData.can_login,
        employee_number: formData.employee_number || '',
        staff_portal_settings: formData.staff_portal_settings
      };
      
      if (formData.password && !editingId) {
        dataToSave.password = formData.password;
      } else if (formData.password && editingId) {
        dataToSave.password = formData.password;
      }
      
      if (editingId) {
        await db.updateStaff(editingId, dataToSave);
      } else {
        await db.addStaff({ ...dataToSave, property_id: currentProperty.id, outlet_ids: dataToSave.outlet_ids });
      }
      setShowForm(false);
      setEditingId(null);
      if (selectedStaff && editingId === selectedStaff.id) {
        setSelectedStaff({ ...selectedStaff, ...dataToSave });
      }
      loadStaff();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save staff record.");
      if (err.message?.includes('schema cache') || err.message?.toLowerCase().includes('column')) {
        setIsSchemaMissing(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canView) return null;

  const MissingStaffColumnsPanel = () => (
    <Card className="max-w-4xl mx-auto rounded-[3rem] border-amber-200 bg-amber-50/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-amber-600 p-8 text-white flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Database className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Schema Repair Required</h2>
                <p className="text-amber-100 font-bold text-sm">The 'staff' table is missing columns for leave management and incentives.</p>
            </div>
        </div>
        <CardContent className="p-10 space-y-8">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                    <Terminal className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Maintenance Mode</h3>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">Please execute this script in your <span className="font-bold text-indigo-600">Supabase SQL Editor</span>. This will safely add the missing columns to your staff table.</p>
                </div>
            </div>

            <div className="relative group">
                <pre className="bg-slate-950 text-indigo-300 p-8 rounded-3xl overflow-x-auto text-[11px] font-mono leading-relaxed shadow-inner border border-white/10">
{`-- ADD MISSING COLUMNS TO staff TABLE
ALTER TABLE IF EXISTS public.staff 
ADD COLUMN IF NOT EXISTS is_eligible_for_incentives BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS probation_start_date TEXT,
ADD COLUMN IF NOT EXISTS probation_end_date TEXT,
ADD COLUMN IF NOT EXISTS employee_number TEXT,
ADD COLUMN IF NOT EXISTS can_login BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS inactive_date DATE,
ADD COLUMN IF NOT EXISTS joining_date DATE,
ADD COLUMN IF NOT EXISTS outlet_assignments JSONB DEFAULT '[]';

-- ENABLE RLS FOR INTERNAL SYSTEM OPERATIONS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS
GRANT ALL ON TABLE public.staff TO anon, authenticated, postgres;`}
                </pre>
            </div>
            <div className="flex gap-4">
                <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700">
                    <RefreshCcw className="w-4 h-4 mr-2" /> Verify Schema Sync
                </Button>
            </div>
        </CardContent>
    </Card>
  );

  const rosterContent = loading ? null : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStaff.map(s => (
        <Card key={s.id} onClick={() => setSelectedStaff(s)} className="rounded-[2rem] border-slate-200/60 shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-white cursor-pointer">
            <div className={`h-1.5 w-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <CardContent className="p-6">
            <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black uppercase ${s.is_active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s.name.charAt(0)}</div>
                {canManage && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { 
                          e.stopPropagation();
                          setEditingId(s.id); 
                          setFormData({
                            ...s,
                            email: s.email || '',
                            phone: s.phone || '',
                            probation_start_date: s.probation_start_date || '',
                            probation_end_date: s.probation_end_date || '',
                            property_id: s.property_id,
                            outlet_ids: s.outlet_ids || [],
                            outlet_assignments: s.outlet_assignments || [],
                            can_login: !!s.can_login,
                            employee_number: s.employee_number || '',
                            joining_date: s.joining_date || format(new Date(), 'yyyy-MM-dd'),
                            inactive_date: s.inactive_date || '',
                            password: '', // Don't pre-fill password for security
                            staff_portal_settings: {
                              show_daily_schedule: s.staff_portal_settings?.show_daily_schedule ?? true,
                              show_monthly_summary: s.staff_portal_settings?.show_monthly_summary ?? true,
                              show_incentives: s.staff_portal_settings?.show_incentives ?? true,
                              show_session_notes: s.staff_portal_settings?.show_session_notes ?? true
                            }
                          }); 
                          setShowForm(true); 
                        }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                )}
            </div>
            <h3 className="font-black text-slate-900 tracking-tight uppercase truncate">{s.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <div className="inline-flex items-center px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-black text-indigo-600 uppercase tracking-widest">{s.role}</div>
              {(() => {
                const leaves = (s as any).leaves || [];
                const today = startOfDay(new Date());
                const onLeave = leaves.some((l: any) => {
                  const start = startOfDay(new Date(l.start_date));
                  const end = startOfDay(new Date(l.end_date));
                  return isWithinInterval(today, { start, end });
                });
                if (onLeave) {
                  return (
                    <div className="inline-flex items-center px-2 py-0.5 bg-red-50 rounded text-[9px] font-black text-red-600 uppercase tracking-widest animate-pulse">
                      <CalendarX className="w-2.5 h-2.5 mr-1" /> On Leave
                    </div>
                  );
                }
                return null;
              })()}
              {viewScope === 'property' && (
                <div className="flex flex-wrap gap-1">
                  {s.outlet_ids.map(oid => (
                    <div key={oid} className="inline-flex items-center px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      <Store className="w-2.5 h-2.5 mr-1" />
                      {outlets.find(o => o.id === oid)?.name || 'Unknown'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 space-y-2 border-t border-slate-50 pt-4">
                <div className="flex items-center gap-3 text-slate-500"><Mail className="w-3.5 h-3.5" /><span className="text-[10px] font-bold truncate">{s.email || 'No email'}</span></div>
                <div className="flex items-center gap-3 text-slate-500"><Phone className="w-3.5 h-3.5" /><span className="text-[10px] font-bold">{s.phone || 'No phone'}</span></div>
            </div>
            </CardContent>
        </Card>
        ))}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {showForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-2xl rounded-[3rem] border-slate-200 shadow-2xl overflow-hidden bg-white animate-in zoom-in-95 duration-300 my-8 max-h-[90vh] flex flex-col">
            <CardHeader className="bg-slate-900 text-white p-8 flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-widest">{editingId ? 'Modify Personnel' : 'Enroll New Staff'}</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Facility Human Resources Management</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </CardHeader>
            <CardContent className="p-10 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Personal Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input label="Full Identity Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="h-14 rounded-2xl font-bold" />
                    <Input label="Professional Role *" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} required className="h-14 rounded-2xl font-bold" placeholder="e.g. Senior Therapist" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-14 rounded-2xl" />
                    <Input label="Contact Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="h-14 rounded-2xl" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Employment Details</h4>
                  <div className={`grid grid-cols-1 ${settings?.staff_portal_settings?.show_incentives ? 'md:grid-cols-2' : ''} gap-8`}>
                    {settings?.staff_portal_settings?.show_incentives && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incentive Eligibility</label>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                          <button type="button" onClick={() => setFormData({ ...formData, is_eligible_for_incentives: true })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${formData.is_eligible_for_incentives ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Eligible</button>
                          <button type="button" onClick={() => setFormData({ ...formData, is_eligible_for_incentives: false })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${!formData.is_eligible_for_incentives ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}>Exempt</button>
                        </div>
                      </div>
                    )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div className="relative">
                          <Input 
                            label="Joining Date *" 
                            type="date" 
                            value={formData.joining_date} 
                            onChange={e => setFormData({ ...formData, joining_date: e.target.value })} 
                            required 
                            className="h-14 rounded-2xl font-bold pl-12" 
                          />
                          <div className="absolute left-4 top-[38px] text-slate-400">
                             <CalendarDays className="w-5 h-5" />
                          </div>
                        </div>
                      <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departure Management</label>
                          {formData.inactive_date && (
                             <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${formData.inactive_date <= format(new Date(), 'yyyy-MM-dd') ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                               Scheduled {formData.inactive_date <= format(new Date(), 'yyyy-MM-dd') ? 'Inactivation' : 'Departure'}
                             </span>
                          )}
                        </div>
                        
                        {!formData.inactive_date ? (
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, inactive_date: format(new Date(), 'yyyy-MM-dd') })}
                            className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2"
                          >
                            <CalendarX className="w-4 h-4" /> Schedule Departure / Inactivation
                          </button>
                        ) : (
                          <div className="relative group animate-in slide-in-from-top-2 duration-300">
                            <Input 
                              label="Inactive Date (Effective from this day)" 
                              type="date" 
                              value={formData.inactive_date} 
                              onChange={e => {
                                const val = e.target.value;
                                const today = format(new Date(), 'yyyy-MM-dd');
                                const newStatus = (val && val <= today) ? false : formData.is_active;
                                setFormData({ ...formData, inactive_date: val, is_active: newStatus });
                              }} 
                              className="h-14 rounded-2xl font-black pl-12 pr-10 border-indigo-100 bg-indigo-50/10 focus:border-indigo-600" 
                            />
                            <div className="absolute left-4 top-[38px] text-indigo-400">
                               <CalendarX className="w-5 h-5" />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setFormData({ ...formData, inactive_date: '' })}
                              className="absolute right-3 top-[38px] p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-100 shadow-sm transition-all"
                              title="Cancel Departure"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200">
                          <button type="button" onClick={() => setFormData({ ...formData, is_active: true })} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${formData.is_active ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-100 border border-emerald-50' : 'text-slate-400 hover:text-slate-500'}`}>
                            <UserCheck className={`w-3.5 h-3.5 ${formData.is_active ? 'opacity-100' : 'opacity-40'}`} />
                            Active
                          </button>
                          <button type="button" onClick={() => setFormData({ ...formData, is_active: false })} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${!formData.is_active ? 'bg-white text-red-600 shadow-lg shadow-red-100 border border-red-50' : 'text-slate-400 hover:text-slate-500'}`}>
                            <UserX className={`w-3.5 h-3.5 ${!formData.is_active ? 'opacity-100' : 'opacity-40'}`} />
                            Inactive
                          </button>
                        </div>
                      </div>

                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Assigned Outlets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allowedOutletsInProperty.map(outlet => (
                      <label key={outlet.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                        <input 
                          type="checkbox" 
                          checked={formData.outlet_ids.includes(outlet.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, outlet_ids: [...formData.outlet_ids, outlet.id] });
                            } else {
                              setFormData({ ...formData, outlet_ids: formData.outlet_ids.filter(id => id !== outlet.id) });
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-700">{outlet.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Assignment History & Transfers</h4>
                    </div>
                    <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-all">
                      {showHistory ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Manage</>}
                    </button>
                  </div>
                  
                  {showHistory && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                        {(!formData.outlet_assignments || formData.outlet_assignments.length === 0) ? (
                          <div className="text-center py-4">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No historical transfers recorded</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {formData.outlet_assignments.map((a, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><Store className="w-4 h-4" /></div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{outletMap[a.outlet_id] || 'Outlet'}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                      {format(new Date(a.start_date), 'dd MMM yy')} — {a.end_date ? format(new Date(a.end_date), 'dd MMM yy') : 'Present'}
                                    </p>
                                  </div>
                                </div>
                                <button type="button" onClick={() => {
                                  const history = [...(formData.outlet_assignments || [])];
                                  history.splice(idx, 1);
                                  setFormData({ ...formData, outlet_assignments: history });
                                }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="pt-4 border-t border-slate-200">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Add Official Record</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div className="relative">
                              <select 
                                value={newAssignment.outlet_id} 
                                onChange={e => setNewAssignment({ ...newAssignment, outlet_id: e.target.value })}
                                className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">Select Outlet</option>
                                {allowedOutletsInProperty.map(o => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                              </select>
                            </div>
                            <Input 
                              type="date" 
                              label="Start Date"
                              value={newAssignment.start_date} 
                              onChange={e => setNewAssignment({ ...newAssignment, start_date: e.target.value })}
                              className="h-11 rounded-xl text-[10px]"
                            />
                          </div>
                          <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <label className="flex-1 flex items-center gap-3 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  checked={isTransferMode}
                                  onChange={e => setIsTransferMode(e.target.checked)}
                                  className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-indigo-900 uppercase tracking-tight">Record as Transfer</p>
                                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest leading-none mt-0.5">Closes all previous assignments</p>
                              </div>
                            </label>
                          </div>

                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                              if (!newAssignment.outlet_id || !newAssignment.start_date) return;
                              
                              let history = [...(formData.outlet_assignments || [])];
                              
                              // INITIALIZATION: Create records for current checkboxes if starting history
                              if (history.length === 0 && formData.outlet_ids.length > 0 && formData.joining_date) {
                                if (formData.joining_date < newAssignment.start_date) {
                                  const d = new Date(newAssignment.start_date);
                                  d.setDate(d.getDate() - 1);
                                  const prevEndDate = format(d, 'yyyy-MM-dd');
                                  
                                  formData.outlet_ids.forEach(oid => {
                                    history.push({
                                      outlet_id: oid,
                                      start_date: formData.joining_date || '',
                                      end_date: prevEndDate
                                    });
                                  });
                                }
                              }

                              // TRANSFER LOGIC: End-date all currently active assignments
                              if (isTransferMode) {
                                const d = new Date(newAssignment.start_date);
                                d.setDate(d.getDate() - 1);
                                const prevEndDate = format(d, 'yyyy-MM-dd');
                                
                                history = history.map(a => {
                                  if (!a.end_date && a.start_date < newAssignment.start_date) {
                                    return { ...a, end_date: prevEndDate };
                                  }
                                  return a;
                                });
                              } else {
                                // ADDITION LOGIC: Just ensure same outlet isn't double-active
                                const sameOutletOpenIdx = history.findIndex(a => a.outlet_id === newAssignment.outlet_id && !a.end_date);
                                if (sameOutletOpenIdx !== -1) return; // Already active there
                              }
                              
                              history.push({ ...newAssignment, end_date: null });
                              history.sort((a, b) => b.start_date.localeCompare(a.start_date));
                              
                              // Sync checkboxes with active assignments
                              const activeIds = history.filter(a => !a.end_date).map(a => a.outlet_id);
                              
                              setFormData({ ...formData, outlet_assignments: history, outlet_ids: activeIds });
                              setNewAssignment({ outlet_id: '', start_date: format(new Date(), 'yyyy-MM-dd') });
                            }} 
                            className="w-full h-11 text-[9px] uppercase font-black tracking-widest border-2"
                          >
                            <Plus className="w-3.5 h-3.5 mr-2" /> {isTransferMode ? 'Execute Transfer' : 'Add Assignment'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {canManagePortalSettings && (
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Staff Portal Permissions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={formData.staff_portal_settings?.show_daily_schedule ?? true}
                          onChange={e => setFormData({ 
                            ...formData, 
                            staff_portal_settings: { 
                              ...(formData.staff_portal_settings || {
                                show_daily_schedule: true,
                                show_monthly_summary: true,
                                show_incentives: true,
                                show_session_notes: true
                              }), 
                              show_daily_schedule: e.target.checked 
                            } 
                          })}
                          className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Daily Schedule</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Show daily appointments</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={formData.staff_portal_settings?.show_monthly_summary ?? true}
                          onChange={e => setFormData({ 
                            ...formData, 
                            staff_portal_settings: { 
                              ...(formData.staff_portal_settings || {
                                show_daily_schedule: true,
                                show_monthly_summary: true,
                                show_incentives: true,
                                show_session_notes: true
                              }), 
                              show_monthly_summary: e.target.checked 
                            } 
                          })}
                          className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Monthly Summary</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Show monthly performance</p>
                        </div>
                      </label>
                      {settings?.staff_portal_settings?.show_incentives && (
                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                          <input 
                            type="checkbox" 
                            checked={formData.staff_portal_settings?.show_incentives ?? true}
                            onChange={e => setFormData({ 
                              ...formData, 
                              staff_portal_settings: { 
                                ...(formData.staff_portal_settings || {
                                  show_daily_schedule: true,
                                  show_monthly_summary: true,
                                  show_incentives: true,
                                  show_session_notes: true
                                }), 
                                show_incentives: e.target.checked 
                              } 
                            })}
                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Incentives</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Show incentive calculations</p>
                          </div>
                        </label>
                      )}
                      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={formData.staff_portal_settings?.show_session_notes ?? true}
                          onChange={e => setFormData({ 
                            ...formData, 
                            staff_portal_settings: { 
                              ...(formData.staff_portal_settings || {
                                show_daily_schedule: true,
                                show_monthly_summary: true,
                                show_incentives: true,
                                show_session_notes: true
                              }), 
                              show_session_notes: e.target.checked 
                            } 
                          })}
                          className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Session Notes</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Allow writing private notes</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Mobile App Access</h4>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">
                      <input type="checkbox" checked={!!formData.can_login} onChange={e => {
                        setFormData({ ...formData, can_login: e.target.checked });
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      Enable Login
                    </label>
                  </div>
                  {formData.can_login && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-300">
                      <Input label="Employee Number *" value={formData.employee_number || ''} onChange={e => setFormData({ ...formData, employee_number: e.target.value })} className="h-14 rounded-2xl" placeholder="e.g. EMP001" required={formData.can_login} />
                      <Input label={editingId ? "New Password (leave blank to keep)" : "Password *"} type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} className="h-14 rounded-2xl" required={formData.can_login && !editingId} />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Probation Period</h4>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">
                      <input type="checkbox" checked={!!formData.probation_start_date || !!formData.probation_end_date} onChange={e => {
                        if (e.target.checked) {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          setFormData({ ...formData, probation_start_date: today, probation_end_date: today });
                        } else {
                          setFormData({ ...formData, probation_start_date: '', probation_end_date: '' });
                        }
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      Enable Probation
                    </label>
                  </div>
                  {(!!formData.probation_start_date || !!formData.probation_end_date) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-300">
                      <Input label="Probation Start Date" type="date" value={formData.probation_start_date} onChange={e => setFormData({ ...formData, probation_start_date: e.target.value })} className="h-14 rounded-2xl" />
                      <Input label="Probation End Date" type="date" value={formData.probation_end_date} onChange={e => setFormData({ ...formData, probation_end_date: e.target.value })} className="h-14 rounded-2xl" />
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in shake duration-300">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-xs font-bold uppercase tracking-tight">{errorMessage}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest">Discard</Button>
                  <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100">
                    {editingId ? 'Update Identity' : 'Authorize Enrollment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {isSchemaMissing && <MissingStaffColumnsPanel />}
      
      {selectedStaff ? (
        <StaffProfileView 
          staff={selectedStaff} 
          onBack={() => setSelectedStaff(null)} 
          canManage={canManage || false}
          canManageLeaves={canManageLeaves || false}
          loadStaff={loadStaff}
          onEdit={(s) => {
            setEditingId(s.id); 
            setFormData({
              ...s,
              email: s.email || '',
              phone: s.phone || '',
              probation_start_date: s.probation_start_date || '',
              probation_end_date: s.probation_end_date || '',
              property_id: s.property_id,
              outlet_ids: s.outlet_ids || [],
              can_login: !!s.can_login,
              employee_number: s.employee_number || '',
              password: '', // Don't pre-fill password for security
              staff_portal_settings: {
                show_daily_schedule: s.staff_portal_settings?.show_daily_schedule ?? true,
                show_monthly_summary: s.staff_portal_settings?.show_monthly_summary ?? true,
                show_incentives: s.staff_portal_settings?.show_incentives ?? true,
                show_session_notes: s.staff_portal_settings?.show_session_notes ?? true
              }
            }); 
            setShowForm(true);
          }}
        />
      ) : (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><Contact2 className="w-7 h-7" /></div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Staff Roster</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Store className="w-3 h-3 text-indigo-400" /> {currentOutlet?.name}
                    </p>
                    {canSwitchScope && (
                      <>
                        <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setViewScope('outlet')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                <Filter className="w-2.5 h-2.5" /> Outlet
                            </button>
                            <button onClick={() => setViewScope('property')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                <Building2 className="w-2.5 h-2.5" /> Property
                            </button>
                        </div>
                      </>
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto">
              {/* MONTH PICKER */}
              <div className="relative group min-w-[160px]">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 pointer-events-none group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full h-14 pl-14 pr-4 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold cursor-pointer shadow-inner appearance-none"
                />
              </div>

              {/* STATUS FILTER */}
              <div className="relative min-w-[200px] z-[60]" ref={filterRef}>
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`h-14 w-full px-5 rounded-2xl border transition-all flex items-center justify-between group/btn shadow-sm ${isFilterOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100 transition-colors ${isFilterOpen ? 'text-indigo-600' : 'text-slate-400'}`}>
                      <currentOption.icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                       <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate w-full">{currentOption.label}</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-300 ${isFilterOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>

                {isFilterOpen && (
                  <div className="absolute top-full mt-3 left-0 right-0 bg-white border border-slate-200 rounded-[1.8rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Filter</span>
                    </div>
                    <div className="p-2">
                      {statusOptions.map((opt) => {
                        const isSelected = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setStatusFilter(opt.value as any);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group/item ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${isSelected ? 'bg-white/20 border-white/20' : 'bg-white border-slate-100 shadow-sm'}`}>
                                 <opt.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : opt.color}`} />
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-tight">{opt.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SEARCH BAR */}
              <div className="relative group flex-1 sm:w-64">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all">
                  <Search className="h-4 w-4" />
                </div>
                <input 
                  placeholder="Search identity..." 
                  className="w-full h-14 pl-14 pr-4 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold placeholder:text-slate-400 shadow-inner" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              {canManage && (
                  <Button onClick={() => { 
                    setEditingId(null); 
                    setFormData({ 
                      name:'', 
                      role:'', 
                      email:'', 
                      phone:'', 
                      is_active:true, 
                      is_eligible_for_incentives: true, 
                      joining_date: format(new Date(), 'yyyy-MM-dd'),
                      outlet_assignments: [],
                      probation_start_date: '', 
                      probation_end_date: '', 
                      property_id: currentProperty?.id || '', 
                      outlet_ids:[],
                      can_login: false,
                      employee_number: '',
                      password: '',
                      staff_portal_settings: {
                        show_daily_schedule: true,
                        show_monthly_summary: true,
                        show_incentives: true,
                        show_session_notes: true
                      }
                    }); 
                    setShowForm(true); 
                  }} className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-100 bg-indigo-600 transition-transform active:scale-95">
                    <UserPlus className="w-4 h-4 mr-2" /> Enroll Staff
                  </Button>
              )}
            </div>
          </div>
          {rosterContent}
        </>
      )}
      <div className="z-[9999] relative">
        <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if (deleteId) { await db.deleteStaff(deleteId); loadStaff(); } }} title="Purge Staff Identity" description="Permanently remove this personnel record from the system?" confirmText="Confirm Purge" isDestructive={true} />
      </div>
    </div>
  );
};

export default StaffPage;