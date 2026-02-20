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

const StaffPage = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, hasPermission, outlets } = useSettings();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user) return [];
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
  const canSwitchScope = user && (hasPermission(user.role_id, 'properties:view') || hasPermission(user.role_id, 'settings:view_properties')) && allowedOutletsInProperty.length > 1;

  useEffect(() => {
    if (currentOutlet && canView) loadStaff();
  }, [currentOutlet, canView, viewScope]);

  const loadStaff = async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      // If property scope is active, fetch for all outlets in property
      const targetOutletId = viewScope === 'outlet' ? currentOutlet.id : undefined;
      const data = await db.getStaff(targetOutletId);
      setStaff(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load staff roster.");
    } finally {
      setLoading(false);
    }
  };

  if (!canView) return null;

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
    try {
      if (editingId) await db.updateStaff(editingId, formData);
      else await db.addStaff({ ...formData, outlet_id: currentOutlet.id });
      setShowForm(false);
      setEditingId(null);
      loadStaff();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save staff record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
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
                            <Filter className="w-2.5 h-2.5" /> Outlet View
                        </button>
                        <button onClick={() => setViewScope('property')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Building2 className="w-2.5 h-2.5" /> Property View
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
              <Button onClick={() => { setEditingId(null); setFormData({ name:'', role:'', email:'', phone:'', is_active:true, is_eligible_for_incentives: true, leave_start_date: '', leave_end_date: '', outlet_id:'' }); setShowForm(true); }} className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
                <Plus className="w-4 h-4 mr-2" /> Enroll Staff
              </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400"><RefreshCcw className="w-8 h-8 animate-spin mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Accessing Roster...</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStaff.map(s => (
            <Card key={s.id} className="rounded-[2rem] border-slate-200/60 shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-white">
                <div className={`h-1.5 w-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black uppercase ${s.is_active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s.name.charAt(0)}</div>
                    {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingId(s.id); setFormData(s); setShowForm(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => setDeleteId(s.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    )}
                </div>
                <h3 className="font-black text-slate-900 tracking-tight uppercase truncate">{s.name}</h3>
                <div className="inline-flex items-center px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">{s.role}</div>
                <div className="mt-6 space-y-2 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-3 text-slate-500"><Mail className="w-3.5 h-3.5" /><span className="text-[10px] font-bold truncate">{s.email || 'No email'}</span></div>
                    <div className="flex items-center gap-3 text-slate-500"><Phone className="w-3.5 h-3.5" /><span className="text-[10px] font-bold">{s.phone || 'No phone'}</span></div>
                </div>
                </CardContent>
            </Card>
            ))}
        </div>
      )}
      <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if (deleteId) { await db.deleteStaff(deleteId); loadStaff(); } }} title="Purge Staff Identity" description="Permanently remove this personnel record from the system?" confirmText="Confirm Purge" isDestructive={true} />
    </div>
  );
};

export default StaffPage;