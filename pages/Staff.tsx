
import React, { useEffect, useState, useMemo } from 'react';
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

const MissingTablePanel = () => (
    <Card className="max-w-4xl mx-auto rounded-[3rem] border-amber-200 bg-amber-50/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-amber-600 p-8 text-white flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Database className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Database Setup Required</h2>
                <p className="text-amber-100 font-bold text-sm">The 'staff' table was not detected in your Supabase schema.</p>
            </div>
        </div>
        <CardContent className="p-10 space-y-8">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                    <Terminal className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Administrative Instruction</h3>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">Please open your <span className="font-bold text-indigo-600">Supabase SQL Editor</span> and execute the following script to provision the personnel ledger system:</p>
                </div>
            </div>

            <div className="relative group">
                <pre className="bg-slate-950 text-indigo-300 p-8 rounded-3xl overflow-x-auto text-[11px] font-mono leading-relaxed shadow-inner border border-white/10">
{`CREATE TABLE public.staff (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_eligible_for_incentives BOOLEAN DEFAULT TRUE,
    leave_start_date TEXT,
    leave_end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.staff TO anon, authenticated, postgres;`}
                </pre>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => {
                            const code = `CREATE TABLE public.staff (id TEXT PRIMARY KEY, outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE, name TEXT NOT NULL, role TEXT NOT NULL, email TEXT, phone TEXT, is_active BOOLEAN DEFAULT TRUE, is_eligible_for_incentives BOOLEAN DEFAULT TRUE, leave_start_date TEXT, leave_end_date TEXT, created_at TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY; GRANT ALL ON TABLE public.staff TO anon, authenticated, postgres;`;
                            navigator.clipboard.writeText(code);
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 transition-all"
                    >
                        <ClipboardCheck className="w-3.5 h-3.5" /> Copy Code
                    </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-amber-100">
                <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700">
                    <RefreshCcw className="w-4 h-4 mr-2" /> Verify Schema Now
                </Button>
            </div>
        </CardContent>
    </Card>
);

const StaffPage = () => {
  const { user } = useAuth();
  const { currentOutlet, hasPermission } = useSettings();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Staff, 'id' | 'created_at'>>({ 
    name: '', 
    role: '', 
    email: '', 
    phone: '', 
    is_active: true,
    is_eligible_for_incentives: true,
    leave_start_date: '',
    leave_end_date: '',
    outlet_id: '' 
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Check
  const canView = user && hasPermission(user.role_id, 'staff:view');
  const canManage = user && hasPermission(user.role_id, 'staff:manage');

  useEffect(() => {
    if (currentOutlet && canView) loadStaff();
  }, [currentOutlet, canView]);

  const loadStaff = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    setErrorMessage(null);
    setIsTableMissing(false);
    try {
      const data = await db.getStaff(currentOutlet.id);
      setStaff(data);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('schema cache') || err.code === '42P01') {
          setIsTableMissing(true);
      } else {
          setErrorMessage(err.message || "Failed to load staff roster.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Access Restricted</h3>
                <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Clearance insufficient to view facility personnel rosters.</p>
            </Card>
        </div>
    );
  }

  const filteredStaff = useMemo(() => {
    return staff.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet || !canManage) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (editingId) {
        await db.updateStaff(editingId, formData);
      } else {
        await db.addStaff({ ...formData, outlet_id: currentOutlet.id });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', role: '', email: '', phone: '', is_active: true, is_eligible_for_incentives: true, leave_start_date: '', leave_end_date: '', outlet_id: '' });
      loadStaff();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to save staff record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (s: Staff) => {
    setEditingId(s.id);
    setFormData({ 
      name: s.name, 
      role: s.role, 
      email: s.email || '', 
      phone: s.phone || '', 
      is_active: s.is_active,
      is_eligible_for_incentives: s.is_eligible_for_incentives ?? true,
      leave_start_date: s.leave_start_date || '',
      leave_end_date: s.leave_end_date || '',
      outlet_id: s.outlet_id 
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        await db.deleteStaff(deleteId);
        setDeleteId(null);
        loadStaff();
      } catch (err: any) {
        setErrorMessage(err.message || "Removal failed.");
      }
    }
  };

  const isStaffCurrentlyOnLeave = (s: Staff) => {
      if (!s.leave_start_date || !s.leave_end_date) return false;
      const today = startOfDay(new Date());
      const start = startOfDay(new Date(s.leave_start_date));
      const end = startOfDay(new Date(s.leave_end_date));
      return isWithinInterval(today, { start, end });
  };

  if (isTableMissing) {
      return (
          <div className="py-12 px-6">
              <MissingTablePanel />
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Contact2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Staff Roster</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <Store className="w-3 h-3 text-indigo-400" /> Authorized for {currentOutlet?.name}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              placeholder="Search by name or role..." 
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadStaff} className="h-12 w-12 p-0 rounded-xl border-slate-200">
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {canManage && (
                <Button onClick={() => { setEditingId(null); setFormData({ name:'', role:'', email:'', phone:'', is_active:true, is_eligible_for_incentives: true, leave_start_date: '', leave_end_date: '', outlet_id:'' }); setShowForm(true); }} className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
                <Plus className="w-4 h-4 mr-2" /> Enroll Staff
                </Button>
            )}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold text-xs animate-in shake duration-300">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <RefreshCcw className="w-8 h-8 animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Accessing Roster Stream...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStaff.length === 0 ? (
            <div className="col-span-full py-20 text-center">
                <div className="inline-flex p-6 bg-slate-100 rounded-full mb-4">
                    <LayoutGrid className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No personnel matched current filters.</p>
                {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-4 text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-200">Clear Search</button>}
            </div>
            ) : filteredStaff.map(s => {
            const onLeave = isStaffCurrentlyOnLeave(s);
            return (
            <Card key={s.id} className={`rounded-[2rem] border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden bg-white ${onLeave ? 'grayscale-[0.5]' : ''}`}>
                <div className={`h-1.5 w-full ${s.is_active ? (onLeave ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-300'}`}></div>
                <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black uppercase shadow-lg ${s.is_active ? (onLeave ? 'bg-amber-100 text-amber-700 shadow-amber-50' : 'bg-indigo-600 text-white shadow-indigo-100') : 'bg-slate-100 text-slate-400'}`}>
                    {s.name.charAt(0)}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canManage && (
                        <>
                        <button onClick={() => handleEdit(s)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </>
                    )}
                    </div>
                </div>

                <div className="space-y-1 mb-6">
                    <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 tracking-tight uppercase truncate">{s.name}</h3>
                        {onLeave && <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded">Leave</span>}
                    </div>
                    <div className="inline-flex items-center px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                    {s.role || 'Personnel'}
                    </div>
                </div>

                <div className="space-y-2 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-3 text-slate-500">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold truncate">{s.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">{s.phone || 'No phone'}</span>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${s.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        {s.is_active ? <UserCheck className="w-3 h-3"/> : <UserX className="w-3 h-3"/>}
                        {s.is_active ? 'Active' : 'Archived'}
                    </span>
                    {s.is_eligible_for_incentives !== false && s.is_active && (
                         <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${onLeave ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                            <Coins className="w-3 h-3" /> {onLeave ? 'Pool Deferred' : 'Pool Eligible'}
                         </span>
                    )}
                </div>
                </CardContent>
            </Card>
            )})}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-2xl relative my-8">
            <Card className="rounded-[2.5rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 bg-white">
              <CardHeader className="bg-indigo-600 text-white p-8 relative">
                <CardTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                  {editingId ? <Edit2 className="w-6 h-6"/> : <UserPlus className="w-6 h-6" />}
                  {editingId ? 'Modify Staff Record' : 'Enroll Personnel'}
                </CardTitle>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Availability & Yield Strategy</p>
                <button onClick={() => setShowForm(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Legal Full Name *</label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" className="h-12 rounded-xl font-bold" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Staff Role / Focus *</label>
                        <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. Sales Executive" className="h-12 rounded-xl font-bold" required />
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Work Email</label>
                        <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="staff@facility.com" className="h-12 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Contact Phone</label>
                        <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+974 55xx xxxx" className="h-12 rounded-xl" />
                      </div>
                   </div>
                   
                   <div className="space-y-4 pt-4 border-t border-slate-100">
                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-indigo-50 text-indigo-600`}>
                                  <CalendarX className="w-5 h-5"/>
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Leave Schedule (Pool Exclusion)</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Incentives will be automatically skipped for sales during this window.</p>
                                </div>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">From</label>
                                  <Input type="date" value={formData.leave_start_date} onChange={e => setFormData({...formData, leave_start_date: e.target.value})} className="h-10 rounded-lg text-xs" />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">To</label>
                                  <Input type="date" value={formData.leave_end_date} onChange={e => setFormData({...formData, leave_end_date: e.target.value})} className="h-10 rounded-lg text-xs" />
                              </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${formData.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {formData.is_active ? <UserCheck className="w-5 h-5"/> : <UserX className="w-5 h-5" />}
                                    </div>
                                    <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Active Duty</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setFormData({...formData, is_active: !formData.is_active})} className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${formData.is_active ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${formData.is_active ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${formData.is_eligible_for_incentives ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <Coins className="w-5 h-5" />
                                    </div>
                                    <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Pool Active</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setFormData({...formData, is_eligible_for_incentives: !formData.is_eligible_for_incentives})} className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${formData.is_eligible_for_incentives ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${formData.is_eligible_for_incentives ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>
                       </div>
                   </div>

                   <div className="flex gap-4 pt-4">
                      <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1 h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
                      <Button type="submit" isLoading={isSubmitting} className="flex-[2] h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100">
                        {editingId ? 'Update Roster' : 'Enroll into Facility'}
                      </Button>
                   </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete} 
        title="Purge Staff Identity" 
        description="Are you sure you want to permanently remove this staff member? Historical data will remain, but the name will be unlinked from active rosters." 
        confirmText="Confirm Purge" 
        isDestructive={true} 
      />
    </div>
  );
};

export default StaffPage;
