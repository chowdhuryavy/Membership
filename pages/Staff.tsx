import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Staff, Outlet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { format, isWithinInterval, startOfDay } from 'date-fns';
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
  LayoutGrid,
  UserPlus,
  RefreshCcw,
  ShieldAlert,
  Info,
  Terminal,
  Database,
  ClipboardCheck,
  AlertCircle,
  Coins,
  CalendarX,
  Shield
} from 'lucide-react';

import StaffProfileView from './StaffProfileView';

const StaffPage = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, hasPermission, outlets = [], setPageLoading } = useSettings();
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
    probation_start_date: '',
    probation_end_date: '',
    outlet_id: '' 
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const canSwitchScope = user && hasPermission(user.role_id, 'settings:view_properties') && allowedOutletsInProperty.length > 1;

  useEffect(() => {
    if (currentOutlet && canView) {
      loadStaff();
    } else if (!currentOutlet) {
      setLoading(false);
    }
  }, [currentOutlet, canView, viewScope]);

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
  }, [currentOutlet, currentProperty, canView]);

  const loadStaff = async () => {
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
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet || !canManage) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const dataToSave = { ...formData };
      if (editingId && !dataToSave.password) {
        delete dataToSave.password;
      }
      
      if (editingId) {
        await db.updateStaff(editingId, dataToSave);
      } else {
        await db.addStaff({ ...dataToSave, outlet_id: currentOutlet.id });
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
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Safe Repair Protocol</h3>
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
ADD COLUMN IF NOT EXISTS password TEXT;

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
                            outlet_id: s.outlet_id
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
              {viewScope === 'property' && (
                <div className="inline-flex items-center px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <Store className="w-2.5 h-2.5 mr-1" />
                  {outlets.find(o => o.id === s.outlet_id)?.name || 'Unknown Outlet'}
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl rounded-[3rem] border-slate-200 shadow-2xl overflow-hidden bg-white animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-slate-900 text-white p-8 flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-widest">{editingId ? 'Modify Personnel' : 'Enroll New Staff'}</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Facility Human Resources Management</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </CardHeader>
            <CardContent className="p-10">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incentive Eligibility</label>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button type="button" onClick={() => setFormData({ ...formData, is_eligible_for_incentives: true })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${formData.is_eligible_for_incentives ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Eligible</button>
                        <button type="button" onClick={() => setFormData({ ...formData, is_eligible_for_incentives: false })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${!formData.is_eligible_for_incentives ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}>Exempt</button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button type="button" onClick={() => setFormData({ ...formData, is_active: true })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${formData.is_active ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>Active</button>
                        <button type="button" onClick={() => setFormData({ ...formData, is_active: false })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${!formData.is_active ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}>Inactive</button>
                      </div>
                    </div>
                  </div>
                </div>

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
              outlet_id: s.outlet_id
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

            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <div className="relative group flex-1 sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input placeholder="Search personnel..." className="w-full h-11 pl-11 pr-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              {canManage && (
                  <Button onClick={() => { setEditingId(null); setFormData({ name:'', role:'', email:'', phone:'', is_active:true, is_eligible_for_incentives: true, probation_start_date: '', probation_end_date: '', outlet_id:'' }); setShowForm(true); }} className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
                    <Plus className="w-4 h-4 mr-2" /> Enroll Staff
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