import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { 
  Plus, 
  Search, 
  Filter, 
  Snowflake, 
  Trash2, 
  Edit2, 
  Layers, 
  AlertCircle, 
  CalendarDays, 
  CalendarClock,
  X,
  CheckCircle2,
  Activity,
  History,
  Check,
  Building2,
  RefreshCcw,
  Clock,
  ArrowRight,
  TrendingUp,
  SearchCode,
  Info,
  Calendar,
  ArrowLeft,
  UserCheck,
  UserPlus,
  Zap,
  RotateCcw,
  ShieldCheck,
  UserSearch,
  XCircle,
  Command,
  FileClock,
  Users,
  Database,
  Terminal,
  ShieldAlert,
  Fingerprint,
  Mail,
  Phone,
  Printer,
  ChevronRight,
  Globe,
  Heart,
  Baby,
  UserCircle2,
  CreditCard,
  FileText,
  Milestone
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze, UserProfile, Staff } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays, isAfter, isBefore, isEqual, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { MembersAgreement } from '../components/MembersAgreement';

const parseISO = (dateString: string) => new Date(dateString);
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const memberSchema = z.object({
  membership_number: z.string().min(1, "Required"),
  guest_name: z.string().min(2, "Name too short"),
  category_id: z.string().min(1, "Required"),
  start_date: z.string().min(1, "Required"),
  discount: z.number().min(0),
  check_no: z.string().optional(),
  sales_rep_id: z.string().optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, formatMoney, hasPermission, checkShortcut, settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All' | 'Renewed'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [autoFreeze, setAutoFreeze] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. PAGE-LEVEL SECURITY CHECK
  const canView = user && hasPermission(user.role_id, 'members:view');
  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');

  useEffect(() => {
    if (currentOutlet && canView) {
      loadData();
    }
  }, [currentOutlet, canView]);
  
  const loadData = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    setDbError(null);
    try {
        const membersData = await db.getMembers(currentOutlet.id).catch(err => {
            console.error("Members Fetch Error:", err);
            setDbError("Member table query failed. Check RLS or column names.");
            return [];
        });
        
        const categoriesData = await db.getCategories(currentOutlet.id).catch(err => {
            console.error("Categories Fetch Error:", err);
            return [];
        });
        
        const staffData = await db.getStaff(currentOutlet.id).catch(err => {
            console.warn("Staff Fetch Error:", err);
            return [];
        });

        setMembers(membersData);
        setCategories(categoriesData);
        setStaffList(staffData.filter(staff => staff.is_active));
    } catch (e) {
        console.error("Critical Load Failure:", e);
    } finally {
        setLoading(false);
    }
  };

  if (!canView) {
      return (
          <div className="flex items-center justify-center h-screen">
              <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                  <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Access Protocol Block</h3>
                  <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Your security tier is not authorized to access the Member Directory.</p>
              </Card>
          </div>
      );
  }

  const getEffectiveStatus = (member: Member) => {
      if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING || member.status === MemberStatus.TENTATIVE) {
          return member.status;
      }
      const endString = member.current_end_date || member.original_end_date;
      if (!endString) return MemberStatus.ACTIVE;

      const end = parseISO(endString);
      const today = startOfDay(new Date());
      if (isBefore(end, today)) return MemberStatus.EXPIRED;
      return MemberStatus.ACTIVE;
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = 
        m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.membership_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.check_no && m.check_no.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const effectiveStatus = getEffectiveStatus(m);
      let matchesStatus = (statusFilter === 'All') || (effectiveStatus === statusFilter);
      const matchesCategory = categoryFilter === 'All' || m.category_id === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    const groups: { categoryName: string, categoryId: string, members: Member[] }[] = [];
    categories.forEach(cat => {
        const matching = filteredMembers.filter(m => m.category_id === cat.id);
        if (matching.length > 0) {
            groups.push({ categoryName: cat.name, categoryId: cat.id, members: matching });
        }
    });
    const uncategorized = filteredMembers.filter(m => !categories.find(c => c.id === m.category_id));
    if (uncategorized.length > 0) {
        groups.push({ categoryName: 'Uncategorized / Legacy Records', categoryId: 'none', members: uncategorized });
    }
    return groups;
  }, [categories, filteredMembers]);

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100"><Building2 className="w-6 h-6 text-white" /></div>
            <div className="flex flex-col items-start overflow-hidden text-left">
                <span className="text-xs font-black tracking-widest w-full uppercase text-slate-400 leading-none mb-1">{currentProperty?.name || 'Facility Scope'}</span>
                <span className="text-base font-black text-slate-900 w-full leading-tight">{currentOutlet?.name || 'Select Outlet'}</span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="shrink-0"><h1 className="text-5xl font-black text-slate-900 tracking-tighter">Members</h1><p className="text-sm font-medium text-slate-500 mt-2 italic">Active portfolio for <span className="text-indigo-600 font-bold">{currentOutlet?.name}</span></p></div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:min-w-[320px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /><input ref={searchInputRef} placeholder="Search name, ID, or reference..." className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`h-12 px-5 rounded-2xl border-slate-200 ${showFilters ? 'bg-slate-100 text-indigo-600 border-indigo-200 shadow-inner' : ''}`}><Filter className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Advanced</span></Button>
              {canCreate && (<Button onClick={() => setView('form')} className="h-12 px-6 rounded-2xl shadow-xl shadow-indigo-100 font-black tracking-tight"><Plus className="w-5 h-5 mr-1" /> Add Member</Button>)}
            </div>
          </div>

          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Lifecycle Status</label>
                      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full h-11 px-4 rounded-xl border border-slate-200 font-bold text-xs">
                          <option value="All">All Statuses</option>
                          {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tier Filter</label>
                      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 font-bold text-xs">
                          <option value="All">All Tiers</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
              </div>
          )}

          <div className="space-y-8">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                    <RefreshCcw className="w-8 h-8 animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Accessing Supabase Data Stream...</p>
                </div>
            ) : groupedMembers.length === 0 ? (
                <div className="space-y-4">
                    <Card className="p-20 text-center rounded-[3rem] border-dashed bg-white">
                        <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-900 uppercase">No Data Records Found</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">The database returned 0 matching records for this outlet.</p>
                        <div className="flex justify-center gap-3 mt-6">
                            <Button onClick={() => { setSearchTerm(''); setStatusFilter('All'); setCategoryFilter('All'); loadData(); }} variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Clear & Reload</Button>
                            <Button onClick={() => setShowDebug(!showDebug)} variant="secondary" className="rounded-xl font-black text-[10px] uppercase tracking-widest"><Terminal className="w-4 h-4 mr-2"/> Run ID Diagnostics</Button>
                        </div>
                    </Card>
                </div>
            ) : groupedMembers.map((group) => (
                <Card key={group.categoryId} className="overflow-hidden border-slate-200/60 shadow-sm group bg-white">
                    <div className="bg-slate-50/80 px-4 md:px-8 py-4 border-b border-slate-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg border border-slate-200"><Layers className="w-4 h-4 text-indigo-600" /></div>
                            <div><h3 className="font-black text-slate-800 tracking-tight uppercase text-xs">{group.categoryName}</h3></div>
                        </div>
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-md shadow-indigo-100">{group.members.length} Members</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[700px]">
                            <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50/30"><tr><th className="px-8 py-4">Membership #</th><th className="px-8 py-4">Guest Profile</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Start Date</th><th className="px-8 py-4">Expiry Date</th><th className="px-8 py-4 text-right">Net Amount</th><th className="px-8 py-4 text-center">Operations</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((member) => {
                                const effectiveStatus = getEffectiveStatus(member);
                                return (
                                <tr key={member.id} className="hover:bg-indigo-50/30 cursor-pointer transition-colors" onClick={() => { setSelectedMember(member); setView('detail'); }}>
                                <td className="px-8 py-5 font-black text-slate-900 tracking-tighter">{member.membership_number}</td>
                                <td className="px-8 py-5"><div className="font-bold text-slate-700">{member.guest_name}</div><div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{member.check_no || 'Ref: N/A'}</div></td>
                                <td className="px-8 py-5"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : effectiveStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : effectiveStatus === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : effectiveStatus === 'Tentative' ? 'bg-amber-50 text-amber-700 border-amber-200 border-dashed' : effectiveStatus === 'Expired' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>{effectiveStatus}</span></td>
                                <td className="px-8 py-5 text-slate-500 font-medium">{format(parseISO(member.start_date), 'dd-MM-yyyy')}</td>
                                <td className="px-8 py-5 text-indigo-600 font-black tracking-tight">{member.current_end_date ? format(parseISO(member.current_end_date), 'dd-MM-yyyy') : '---'}</td>
                                <td className="px-8 py-5 text-right font-black tabular-nums">{formatMoney(member.net_amount)}</td>
                                <td className="px-8 py-5"><div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>{canCreate && <button type="button" onClick={(e) => { setSelectedMember(member); setIsRenewal(true); setView('form'); }} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"><RefreshCcw className="w-4 h-4" /></button>}{canEdit && <button type="button" onClick={(e) => { setSelectedMember(member); setIsEditing(true); setView('form'); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>}{canDelete && <button type="button" onClick={(e) => setDeleteId(member.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>}</div></td></tr>
                            )})}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ))}
          </div>
          <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if(deleteId) { await db.deleteMember(deleteId); setDeleteId(null); loadData(); } }} title="Delete Member" description="Are you sure you want to delete this member? This action cannot be undone." confirmText="Delete Member" isDestructive={true} />
        </div>
      )}

      {view === 'form' && (
        <MemberForm 
          categories={categories} 
          members={members}
          staff={staffList}
          existingMember={selectedMember}
          isRenewal={isRenewal}
          currentOutletId={currentOutlet?.id || ''}
          onCancel={() => { setView('list'); setSelectedMember(null); setIsEditing(false); setIsRenewal(false); }} 
          onSuccess={() => { loadData(); setView('list'); }} 
          canCreate={canCreate}
          canEdit={canEdit}
        />
      )}

      {view === 'detail' && selectedMember && (
        <MemberDetail 
          member={selectedMember} 
          categories={categories}
          initialFreeze={autoFreeze}
          getEffectiveStatus={getEffectiveStatus}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoFreeze(false); }}
          onUpdate={() => { loadData(); }} 
          onRenew={(m) => { setSelectedMember(m); setIsRenewal(true); setView('form'); }}
          onConfirmBooking={() => { setIsEditing(true); setView('form'); }}
        />
      )}
    </div>
  );
};

const MemberForm = ({ categories, members, staff, existingMember, isRenewal, currentOutletId, onCancel, onSuccess, canCreate, canEdit }: { categories: MembershipCategory[], members: Member[], staff: Staff[], existingMember: Member | null, isRenewal?: boolean, currentOutletId: string, onCancel: () => void, onSuccess: (m: Member) => void, canCreate: boolean | null, canEdit: boolean | null }) => {
  const { formatMoney, currency, checkShortcut } = useSettings();
  const [saveAsTentative, setSaveAsTentative] = useState(false);
  
  const calculateSmartStartDate = (expiryDateStr: string) => {
    const expiryDate = parseISO(expiryDateStr);
    const today = startOfDay(new Date());
    if (isBefore(expiryDate, today)) return format(today, 'yyyy-MM-dd');
    return format(addDays(expiryDate, 1), 'yyyy-MM-dd');
  };

  const initialStartDate = useMemo(() => (isRenewal && existingMember) ? calculateSmartStartDate(existingMember.current_end_date) : format(new Date(), 'yyyy-MM-dd'), [isRenewal, existingMember]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: (existingMember && !isRenewal) ? {
        membership_number: existingMember.membership_number,
        guest_name: existingMember.guest_name,
        category_id: existingMember.category_id,
        start_date: existingMember.start_date,
        discount: existingMember.discount,
        check_no: existingMember.check_no,
        sales_rep_id: existingMember.sales_rep_id
    } : {
      membership_number: existingMember?.membership_number || '',
      guest_name: existingMember?.guest_name || '',
      discount: 0,
      start_date: initialStartDate,
      sales_rep_id: existingMember?.sales_rep_id || ''
    }
  });

  const categoryId = watch('category_id');
  const startDate = watch('start_date');
  const discount = watch('discount');
  const membershipNumber = watch('membership_number');

  const matchedMember = useMemo(() => {
    if (existingMember && !isRenewal) return null; 
    if (!membershipNumber || membershipNumber.trim().length < 2) return null;
    return members.find(m => m.membership_number.trim().toLowerCase() === membershipNumber.trim().toLowerCase());
  }, [membershipNumber, members, existingMember, isRenewal]);

  useEffect(() => {
    if (existingMember && !isRenewal) return;
    if (matchedMember) {
        setValue('guest_name', matchedMember.guest_name);
        setValue('category_id', matchedMember.category_id);
        setValue('start_date', calculateSmartStartDate(matchedMember.current_end_date));
    }
  }, [matchedMember, setValue, existingMember, isRenewal]);

  const selectedCategory = categories.find((c: any) => c.id === categoryId);
  const baseRate = selectedCategory?.base_rate || 0;
  const netAmount = Math.max(0, baseRate - (Number(discount) || 0));
  
  let endDateStr = '';
  let dailyRate = 0;

  if (startDate && selectedCategory) {
    const start = parseISO(startDate);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    endDateStr = format(end, 'yyyy-MM-dd');
    dailyRate = RevenueEngine.calculateDailyRate(netAmount, start, end);
  }

  const onSubmit = async (data: MemberFormValues) => {
    const isEditMode = existingMember && !isRenewal;
    const payload: Member = {
      id: isEditMode ? existingMember.id : crypto.randomUUID(),
      outlet_id: currentOutletId,
      membership_number: data.membership_number,
      guest_name: data.guest_name,
      category_id: data.category_id,
      start_date: data.start_date,
      original_end_date: endDateStr,
      current_end_date: endDateStr,
      actual_rate: baseRate,
      discount: data.discount,
      net_amount: netAmount,
      daily_rate: dailyRate,
      check_no: data.check_no,
      status: saveAsTentative ? MemberStatus.TENTATIVE : (isEditMode && existingMember.status === MemberStatus.TENTATIVE ? MemberStatus.ACTIVE : (isEditMode ? existingMember.status : MemberStatus.ACTIVE)),
      sales_rep_id: data.sales_rep_id
    };
    try { if (isEditMode) await db.updateMember(existingMember.id, payload); else await db.addMember(payload); onSuccess(payload); } catch (e) { console.error(e); }
  };

  return (
    <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 text-white p-8 relative"><CardTitle className="text-2xl font-black tracking-tight">{isRenewal ? 'Renew Membership' : matchedMember ? 'Process Re-Enrollment' : existingMember ? 'Edit Profile' : 'New Enrollment'}</CardTitle><button onClick={onCancel} className="absolute top-8 right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-6 h-6" /></button></CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership No. / ID</label><div className="relative"><UserSearch className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${matchedMember ? 'text-emerald-500' : 'text-slate-400'}`} /><Input {...register('membership_number')} readOnly={isRenewal} error={errors.membership_number?.message} className={`h-12 pl-11 rounded-xl font-bold transition-all ${matchedMember ? 'border-emerald-500 ring-2 ring-emerald-500/10' : ''}`} /></div></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Guest Profile Name</label><Input {...register('guest_name')} readOnly={isRenewal || !!matchedMember} error={errors.guest_name?.message} className={`h-12 rounded-xl font-bold transition-all ${matchedMember ? 'bg-slate-50' : ''}`} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Audit Ref / Check</label><Input {...register('check_no')} className="h-12 rounded-xl font-bold" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Recognition Staff (Incentive)</label><div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><select {...register('sales_rep_id')} className="h-12 w-full pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none"><option value="">Select Staff Member...</option>{staff.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}</select></div></div></div>
            </div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership Tier</label><select {...register('category_id')} className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10"><option value="">Select Category...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Effective Start Date</label><input type="date" {...register('start_date')} className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Discount Allocation ({currency?.symbol || '$'})</label><Input type="number" step="0.01" {...register('discount', { valueAsNumber: true })} className="h-12 rounded-xl font-bold" /></div>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-6"><div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate</p><p className="text-sm font-black text-slate-900">{formatMoney(baseRate)}</p></div><div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Revenue</p><p className="text-sm font-black text-indigo-600">{formatMoney(netAmount)}</p></div><div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Expiry</p><p className="text-sm font-black text-slate-900">{endDateStr ? format(parseISO(endDateStr), 'dd-MM-yyyy') : '---'}</p></div><div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Accrual</p><p className="text-sm font-black text-emerald-600">{formatMoney(dailyRate)}/Day</p></div></div>
          <div className="flex gap-4 pt-4"><Button type="button" variant="secondary" onClick={onCancel} className="flex-1 h-14 rounded-2xl font-bold">Cancel</Button>{(!existingMember || existingMember.status === MemberStatus.TENTATIVE) && (<Button type="submit" onClick={() => setSaveAsTentative(true)} className="flex-1 h-14 rounded-2xl font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">Save as Tentative</Button>)}<Button type="submit" onClick={() => setSaveAsTentative(false)} className="flex-1 h-14 rounded-2xl font-black text-base shadow-xl">Confirm Enrollment</Button></div>
        </form>
      </CardContent>
    </Card>
  );
};

const MemberDetail = ({ member, categories, initialFreeze, getEffectiveStatus, onBack, onUpdate, onRenew, onConfirmBooking }: { member: Member, categories: MembershipCategory[], initialFreeze: boolean, getEffectiveStatus: (m: Member) => string, onBack: () => void, onUpdate: () => void, onRenew: (m: Member) => void, onConfirmBooking: () => void }) => {
  const { formatMoney, hasPermission, currentProperty, currentOutlet, settings } = useSettings();
  const { user } = useAuth();
  const [displayedMember, setDisplayedMember] = useState<Member>(member);
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [history, setHistory] = useState<Member[]>([]);
  const [showFreezeModal, setShowFreezeModal] = useState(initialFreeze);
  const [showContract, setShowContract] = useState(false);
  const [isEditingFreeze, setIsEditingFreeze] = useState(false);
  const [freezeForm, setFreezeForm] = useState({ id: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' });

  useEffect(() => { setDisplayedMember(member); }, [member]);
  useEffect(() => { 
    loadFreezes(); 
    loadLifecycle();
  }, [displayedMember.id]);

  const loadFreezes = async () => { setFreezes(await db.getFreezes(displayedMember.id)); };
  const loadLifecycle = async () => { setHistory(await db.getMemberHistory(displayedMember.membership_number)); };

  const handleAddFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeForm.start_date || !freezeForm.end_date) return;
    const totalDays = differenceInCalendarDays(parseISO(freezeForm.end_date), parseISO(freezeForm.start_date)) + 1;
    try {
        await db.addFreeze({ id: crypto.randomUUID(), member_id: displayedMember.id, start_date: freezeForm.start_date, end_date: freezeForm.end_date, total_days: totalDays });
        setShowFreezeModal(false);
        await onUpdate();
        loadFreezes();
    } catch (err) { console.error(err); }
  };

  const effectiveStatus = getEffectiveStatus(displayedMember);
  const selectedCategory = categories.find(c => c.id === displayedMember.category_id);
  
  // Calculate Lifecycle Progress
  const lifecycleStats = useMemo(() => {
    const start = parseISO(displayedMember.start_date);
    const end = parseISO(displayedMember.current_end_date);
    const now = new Date();
    
    const total = differenceInCalendarDays(end, start) + 1;
    const used = Math.max(0, differenceInCalendarDays(now, start));
    const percent = Math.min(100, Math.max(0, (used / total) * 100));
    const remaining = Math.max(0, differenceInCalendarDays(end, now));
    
    return { percent, used, remaining, total };
  }, [displayedMember]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 no-print">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </button>
        <div className="flex gap-2">
          {user && hasPermission(user.role_id, 'members:print_contract') && (
            <Button onClick={() => setShowContract(true)} variant="outline" className="rounded-xl h-11 px-6 font-black text-xs uppercase border-slate-200 shadow-sm">
              <Printer className="w-4 h-4 mr-2" /> Print Agreement
            </Button>
          )}
          {effectiveStatus === 'Tentative' && user && hasPermission(user.role_id, 'members:create') && (
            <Button onClick={onConfirmBooking} className="rounded-xl h-11 px-6 font-black text-xs uppercase bg-indigo-600 hover:bg-indigo-700">
              Confirm Membership
            </Button>
          )}
          {user && hasPermission(user.role_id, 'members:create') && (
            <Button onClick={() => onRenew(displayedMember)} className="rounded-xl h-11 px-6 font-black text-xs uppercase bg-emerald-600 hover:bg-emerald-700">
              Renew / Re-Enroll
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Essential Profile */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden text-center bg-white">
            <div className="h-24 bg-slate-900 w-full"></div>
            <CardContent className="p-8 -mt-12">
              <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                <div className="w-24 h-24 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                  {displayedMember.guest_name.charAt(0)}
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{displayedMember.guest_name}</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{displayedMember.membership_number}</p>
              
              <div className={`mt-6 inline-block px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : effectiveStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : effectiveStatus === 'Expired' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                {effectiveStatus}
              </div>

              <div className="mt-10 space-y-3">
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700">{displayedMember.phone}</span>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700 truncate">{displayedMember.email}</span>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700 uppercase">{displayedMember.nationality || 'Nationality N/A'}</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden bg-white p-8">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Financial Snapshot</h4>
              <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Contribution</span>
                      <span className="text-lg font-black text-slate-900">{formatMoney(displayedMember.net_amount)}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Amortized Yield</span>
                      <span className="text-base font-black text-emerald-600">{formatMoney(displayedMember.daily_rate)}/Day</span>
                  </div>
                  <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Audit Reference</span>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{displayedMember.check_no || 'Ref: N/A'}</span>
                  </div>
              </div>
          </Card>
        </div>

        {/* Right Column: Dynamic Lifecycle & Details */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Progress / Lifecycle Tracker */}
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white p-10">
              <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><Activity className="w-5 h-5 text-indigo-600" /> Current Term Lifecycle</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Operational Progress for the selected period</p>
                  </div>
                  <div className="text-right">
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">{lifecycleStats.remaining}</span>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Days Remaining</p>
                  </div>
              </div>

              <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-4 shadow-inner">
                  <div 
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full shadow-lg transition-all duration-1000"
                    style={{ width: `${lifecycleStats.percent}%` }}
                  ></div>
              </div>
              
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="flex flex-col">
                      <span>Commencement</span>
                      <span className="text-slate-900 font-black">{format(parseISO(displayedMember.start_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="text-center">
                      <span className="bg-slate-900 text-white px-3 py-1 rounded-lg shadow-xl">{lifecycleStats.percent.toFixed(0)}% Elapsed</span>
                  </div>
                  <div className="flex flex-col items-end">
                      <span>Expiry Protocol</span>
                      <span className="text-indigo-600 font-black">{format(parseISO(displayedMember.current_end_date), 'dd MMM yyyy')}</span>
                  </div>
              </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Identity Grid */}
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <CardHeader className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-4 h-4 text-indigo-600" /> Profile Forensic</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Package Type</p>
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-black uppercase">{displayedMember.package_type || 'Single'}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Facility Access</p>
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-black uppercase">{displayedMember.access_type || 'Full Facility'}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Civil Status</p>
                            <div className="flex items-center gap-2">
                                <Heart className={`w-3.5 h-3.5 ${displayedMember.is_married ? 'text-red-500' : 'text-slate-300'}`} />
                                <span className="text-xs font-black uppercase">{displayedMember.is_married ? 'Married' : 'Single'}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Birth Matrix</p>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-black uppercase">{displayedMember.dob ? format(parseISO(displayedMember.dob), 'dd MMM yyyy') : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Suspension Ledger */}
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-3"><Snowflake className="w-4 h-4 text-indigo-600"/> Suspension Ledger</CardTitle>
                    {user && hasPermission(user.role_id, 'members:edit') && effectiveStatus !== 'Tentative' && (
                        <button onClick={() => setShowFreezeModal(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </CardHeader>
                <CardContent className="p-6 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {freezes.length > 0 ? (
                        <div className="space-y-2">
                            {freezes.map(f => (
                                <div key={f.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 font-black text-[10px] shadow-sm">{f.total_days}</div>
                                        <div>
                                            <h4 className="font-black text-slate-700 text-[10px] uppercase tracking-tight">{format(parseISO(f.start_date), 'dd MMM')} &rarr; {format(parseISO(f.end_date), 'dd MMM yyyy')}</h4>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 opacity-30">
                            <Snowflake className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No Suspensions Recorded</p>
                        </div>
                    )}
                </CardContent>
            </Card>
          </div>

          {/* Lifecycle Ledger: Chronological History of Renewals/Purchases */}
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 text-white p-8 flex items-center justify-between">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3"><Milestone className="w-5 h-5 text-indigo-400" /> Strategic Lifecycle Ledger</CardTitle>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Historical Matrix</span>
              </CardHeader>
              <CardContent className="p-8">
                  <div className="space-y-4">
                      {history.map((hist, idx) => {
                          const isCurrent = hist.id === displayedMember.id;
                          const histStatus = getEffectiveStatus(hist);
                          const cat = categories.find(c => c.id === hist.category_id);
                          return (
                              <button 
                                key={hist.id} 
                                onClick={() => setDisplayedMember(hist)}
                                className={`w-full flex items-center gap-6 p-6 rounded-3xl border-2 transition-all group text-left ${isCurrent ? 'bg-indigo-50 border-indigo-600 shadow-xl scale-[1.01]' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                              >
                                  <div className="flex flex-col items-center gap-2">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black shadow-lg transition-transform group-hover:scale-110 ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                          {history.length - idx}
                                      </div>
                                      <div className={`h-8 w-1 rounded-full ${idx === history.length - 1 ? 'bg-transparent' : 'bg-slate-100'}`}></div>
                                  </div>
                                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                                      <div className="space-y-1">
                                          <p className="text-[10px] font-black text-slate-900 uppercase truncate">{cat?.name || 'Tier Asset'}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Term Designation</p>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[10px] font-black text-slate-700 uppercase">{format(parseISO(hist.start_date), 'dd MMM yy')}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Commencement</p>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[10px] font-black text-slate-700 uppercase">{format(parseISO(hist.current_end_date), 'dd MMM yy')}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Expiry</p>
                                      </div>
                                      <div className="flex justify-end">
                                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${histStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                              {histStatus}
                                          </span>
                                      </div>
                                  </div>
                                  <div className="flex items-center">
                                      {isCurrent ? <CheckCircle2 className="w-5 h-5 text-indigo-600" /> : <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 transition-colors" />}
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              </CardContent>
          </Card>

          {/* Family Scope Visualization */}
          {(displayedMember.package_type === 'Couple' || displayedMember.package_type === 'Family') && (
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3"><Users className="w-4 h-4 text-indigo-600" /> Family Scope manifest</CardTitle>
                </CardHeader>
                <CardContent className="p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                                <Heart className="w-6 h-6" />
                            </div>
                            <h4 className="font-black text-slate-900 uppercase text-xs">Primary Spouse</h4>
                            <p className="text-base font-black uppercase text-indigo-600 mt-1">{displayedMember.spouse_name || 'N/A'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">DOB: {displayedMember.spouse_dob ? format(parseISO(displayedMember.spouse_dob), 'dd MMM yyyy') : '---'}</p>
                        </div>

                        {displayedMember.kids?.map((kid, i) => (
                           <div key={i} className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                              <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                                  <Baby className="w-6 h-6" />
                              </div>
                              <h4 className="font-black text-slate-900 uppercase text-xs">Dependent {i+1}</h4>
                              <p className="text-base font-black uppercase text-slate-700 mt-1">{kid.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">DOB: {format(parseISO(kid.dob), 'dd MMM yyyy')}</p>
                           </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
          )}

          {/* Audit History / Remarks */}
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
              <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-600" /> Operational Context & Remarks</CardTitle>
              </CardHeader>
              <CardContent className="p-10">
                  {displayedMember.remarks ? (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm font-medium text-slate-600 leading-relaxed italic">
                        "{displayedMember.remarks}"
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">No internal remarks provided.</div>
                  )}
              </CardContent>
          </Card>
        </div>
      </div>

      {showFreezeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-md rounded-[2.5rem] border-slate-200 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-indigo-600 text-white p-8">
                    <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><Snowflake className="w-6 h-6" /> Apply Suspension</CardTitle>
                    <button onClick={() => setShowFreezeModal(false)} className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                </CardHeader>
                <CardContent className="p-10">
                    <form onSubmit={handleAddFreeze} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Commencement Date</label>
                            <Input type="date" value={freezeForm.start_date} onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} className="h-14 rounded-2xl" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Resumption Date</label>
                            <Input type="date" value={freezeForm.end_date} onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} className="h-14 rounded-2xl" required />
                        </div>
                        <Button type="submit" className="w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100">Authorize Suspension</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
      )}

      {showContract && (
        <MembersAgreement 
          member={displayedMember} 
          category={categories.find(c => c.id === displayedMember.category_id)} 
          outlet={currentOutlet} 
          property={currentProperty} 
          settings={settings} 
          formatMoney={formatMoney} 
          onClose={() => setShowContract(false)} 
        />
      )}
    </div>
  );
}

export default Members;