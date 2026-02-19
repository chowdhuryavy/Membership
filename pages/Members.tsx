import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  X,
  Building2,
  RefreshCcw,
  Clock,
  ArrowLeft,
  Printer,
  Milestone,
  Baby,
  Coins,
  History,
  CheckCircle2,
  Zap,
  ShieldCheck,
  RotateCcw,
  Command,
  User,
  UserCircle2,
  Phone,
  Mail,
  ShieldAlert,
  AlertTriangle,
  Globe,
  Calendar,
  Shield,
  Heart,
  Gamepad2,
  UserPlus,
  Activity
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze, Staff } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays, isBefore, isAfter } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { MembersAgreement } from '../components/MembersAgreement';

const parseISO = (dateString: string) => new Date(dateString);
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// RELAXED SCHEMA: All non-core fields are now optional and allow nulls
const memberSchema = z.object({
  membership_number: z.string().min(1, "Membership ID is required"),
  guest_name: z.string().min(2, "Name must be at least 2 chars"),
  category_id: z.string().min(1, "Tier selection is required"),
  start_date: z.string().min(1, "Effective date is required"),
  discount: z.number().min(0, "Discount cannot be negative"),
  check_no: z.string().optional().nullable(),
  sales_rep_id: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").or(z.literal("")).optional().nullable(),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  is_married: z.boolean().default(false),
  package_type: z.enum(['Single', 'Couple', 'Family']).default('Single'),
  access_type: z.enum(['Pool', 'Spa', 'Both']).default('Both'),
  membership_type: z.enum(['New', 'Renew']).default('New'),
  spouse_name: z.string().optional().nullable(),
  spouse_dob: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});

type MemberFormValues = z.infer<typeof memberSchema>;

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [autoOpenFreeze, setAutoOpenFreeze] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canView = user && hasPermission(user.role_id, 'members:view');
  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');

  useEffect(() => { if (currentOutlet && canView) loadData(); }, [currentOutlet, canView]);
  
  const loadData = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    try {
        const [membersData, categoriesData, staffData] = await Promise.all([
            db.getMembers(currentOutlet.id),
            db.getCategories(currentOutlet.id),
            db.getStaff(currentOutlet.id)
        ]);
        setMembers(membersData);
        setCategories(categoriesData);
        setStaffList(staffData.filter(staff => staff.is_active));
        if (selectedMember) {
          const updated = membersData.find(m => m.id === selectedMember.id);
          if (updated) setSelectedMember(updated);
        }
    } finally { setLoading(false); }
  };

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
      const matchesSearch = m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           m.membership_number.toLowerCase().includes(searchTerm.toLowerCase());
      const effectiveStatus = getEffectiveStatus(m);
      let matchesStatus = (statusFilter === 'All') || (effectiveStatus === statusFilter);
      const matchesCategory = categoryFilter === 'All' || m.category_id === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    const groups: { category: MembershipCategory | null, members: Member[] }[] = [];
    categories.forEach(cat => {
        const matching = filteredMembers.filter(m => m.category_id === cat.id);
        if (matching.length > 0) groups.push({ category: cat, members: matching });
    });
    const uncategorized = filteredMembers.filter(m => !categories.find(c => c.id === m.category_id));
    if (uncategorized.length > 0) groups.push({ category: null, members: uncategorized });
    return groups;
  }, [categories, filteredMembers]);

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><Building2 className="w-8 h-8" /></div>
               <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Members</h1>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">{currentOutlet?.name} Ledger</p>
               </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:min-w-[320px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><input ref={searchInputRef} placeholder="Search names or IDs..." className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              {canCreate && (<Button onClick={() => { setIsRenewal(false); setIsEditing(false); setSelectedMember(null); setView('form'); }} className="h-12 px-8 rounded-2xl shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest"><Plus className="w-5 h-5 mr-1" /> New Entry</Button>)}
            </div>
          </div>

          <div className="space-y-10">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400"><RefreshCcw className="w-8 h-8 animate-spin mb-4" /><p className="text-xs font-black uppercase tracking-widest">Accessing Ledger...</p></div>
            ) : groupedMembers.length === 0 ? (
                <Card className="p-20 text-center rounded-[3rem] border-dashed bg-white"><Milestone className="w-12 h-12 text-slate-200 mx-auto mb-4" /><h3 className="text-lg font-black text-slate-900 uppercase">No Records Found</h3></Card>
            ) : groupedMembers.map((group) => (
                <Card key={group.category?.id || 'none'} className="overflow-hidden border-slate-200/60 shadow-xl group bg-white rounded-[2.5rem]">
                    <div className="bg-slate-50/50 px-10 py-6 border-b flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm"><Layers className="w-5 h-5 text-indigo-600" /></div>
                            <div>
                                <h3 className="font-black text-slate-900 tracking-tight uppercase text-sm">{group.category?.name || 'Unassigned Records'}</h3>
                                {group.category && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">BASE: {formatMoney(group.category.base_rate)}</p>}
                            </div>
                        </div>
                        <span className="bg-[#5c56d6] text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-100">{group.members.length} RECORDS</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b bg-slate-50/20">
                              <tr>
                                <th className="px-10 py-6">Membership #</th>
                                <th className="px-10 py-6">Guest Profile</th>
                                <th className="px-10 py-6">Status</th>
                                <th className="px-10 py-6">Start Date</th>
                                <th className="px-10 py-6">Expiry Date</th>
                                <th className="px-10 py-6 text-right">Net Amount</th>
                                <th className="px-10 py-6 text-right">Operations</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((m) => {
                                const effectiveStatus = getEffectiveStatus(m);
                                return (
                                <tr key={m.id} className="hover:bg-indigo-50/20 cursor-pointer transition-colors" onClick={() => { setSelectedMember(m); setAutoOpenFreeze(false); setView('detail'); }}>
                                    <td className="px-10 py-6 font-black text-slate-900 text-base tracking-tighter">{m.membership_number}</td>
                                    <td className="px-10 py-6">
                                      <div className="font-black text-slate-800 text-sm uppercase">{m.guest_name}</div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">{m.id.substring(0,8)}</div>
                                    </td>
                                    <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50' : 'bg-red-50 text-red-700 border-red-100'}`}>{effectiveStatus}</span></td>
                                    <td className="px-10 py-6 font-bold text-slate-600">{format(parseISO(m.start_date), 'dd-MM-yyyy')}</td>
                                    <td className="px-10 py-6 text-[#5c56d6] font-black text-base tracking-tighter">{m.current_end_date ? format(parseISO(m.current_end_date), 'dd-MM-yyyy') : '---'}</td>
                                    <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums text-base">{formatMoney(m.net_amount)}</td>
                                    <td className="px-10 py-6 text-right"><div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                      {canCreate && <button onClick={() => { setSelectedMember(m); setIsRenewal(true); setIsEditing(false); setView('form'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm" title="Renew"><RefreshCcw className="w-4 h-4"/></button>}
                                      {hasPermission(user!.role_id, 'members:freeze') && <button onClick={() => { setSelectedMember(m); setAutoOpenFreeze(true); setView('detail'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm" title="Suspend/Freeze"><Snowflake className="w-4 h-4"/></button>}
                                      {canEdit && <button onClick={() => { setSelectedMember(m); setIsEditing(true); setIsRenewal(false); setView('form'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm" title="Edit Profile"><Edit2 className="w-4 h-4"/></button>}
                                      {canDelete && <button onClick={() => setDeleteId(m.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm" title="Delete"><Trash2 className="w-4 h-4"/></button>}
                                    </div></td>
                                </tr>
                            )})}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ))}
          </div>
        </div>
      )}

      {view === 'form' && (
        <MemberForm 
          categories={categories} 
          members={members}
          staff={staffList}
          existingMember={selectedMember}
          isRenewal={isRenewal}
          isEditing={isEditing}
          currentOutletId={currentOutlet?.id || ''}
          onCancel={() => { setView('list'); setSelectedMember(null); setIsEditing(false); setIsRenewal(false); }} 
          onSuccess={() => { loadData(); setView('list'); }} 
        />
      )}

      {view === 'detail' && selectedMember && (
        <MemberDetail 
          member={selectedMember} 
          categories={categories}
          getEffectiveStatus={getEffectiveStatus}
          initialTriggerFreeze={autoOpenFreeze}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoOpenFreeze(false); }}
          onUpdate={() => { loadData(); }} 
          onRenew={(m) => { setSelectedMember(m); setIsRenewal(true); setIsEditing(false); setView('form'); }}
          onEdit={(m) => { setSelectedMember(m); setIsEditing(true); setIsRenewal(false); setView('form'); }}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if(deleteId) { await db.deleteMember(deleteId); setDeleteId(null); loadData(); setView('list'); } }} title="Authorize Record Purge" description="This action irreversibly removes the member profile and historical ledger." confirmText="Confirm Purge" isDestructive={true} />
    </div>
  );
};

const MemberForm = ({ categories, members, staff, existingMember, isRenewal, isEditing, currentOutletId, onCancel, onSuccess }: { categories: MembershipCategory[], members: Member[], staff: Staff[], existingMember: Member | null, isRenewal?: boolean, isEditing?: boolean, currentOutletId: string, onCancel: () => void, onSuccess: (m: Member) => void }) => {
  const { formatMoney, currency } = useSettings();
  const [pulledGuest, setPulledGuest] = useState<Member | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: (existingMember && isEditing) ? {
        ...existingMember,
        phone: existingMember.phone ?? '',
        email: existingMember.email ?? '',
        nationality: existingMember.nationality ?? '',
        dob: existingMember.dob ?? '',
        spouse_name: existingMember.spouse_name ?? '',
        spouse_dob: existingMember.spouse_dob ?? '',
        remarks: existingMember.remarks ?? '',
        check_no: existingMember.check_no ?? '',
        membership_type: existingMember.membership_type || 'New'
    } : {
      membership_number: existingMember?.membership_number || '',
      guest_name: existingMember?.guest_name || '',
      category_id: existingMember?.category_id || '',
      start_date: isRenewal && existingMember ? format(addDays(parseISO(existingMember.current_end_date), 1), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      discount: existingMember?.discount || 0,
      phone: existingMember?.phone ?? '',
      email: existingMember?.email ?? '',
      nationality: existingMember?.nationality ?? '',
      dob: existingMember?.dob ?? '',
      package_type: existingMember?.package_type || 'Single',
      access_type: existingMember?.access_type || 'Both',
      membership_type: isRenewal ? 'Renew' : 'New',
      remarks: existingMember?.remarks ?? '',
      check_no: existingMember?.check_no ?? ''
    }
  });

  const membershipNumber = watch('membership_number');
  const categoryId = watch('category_id');
  const startDate = watch('start_date');
  const discount = watch('discount');

  // Pull Guest Data Logic for New Enrollments
  useEffect(() => {
      if (!isRenewal && !isEditing && membershipNumber && membershipNumber.length > 3) {
          const match = members.find(m => m.membership_number.toLowerCase() === membershipNumber.toLowerCase());
          if (match && pulledGuest?.id !== match.id) {
              setPulledGuest(match);
              setValue('guest_name', match.guest_name);
              setValue('phone', match.phone ?? '');
              setValue('email', match.email ?? '');
              setValue('nationality', match.nationality ?? '');
              setValue('dob', match.dob ?? '');
              setValue('package_type', match.package_type || 'Single');
              setValue('access_type', match.access_type || 'Both');
              setValue('membership_type', 'Renew');

              // CONTINUITY LOGIC: Auto-set start date to day after existing expiry
              if (match.current_end_date) {
                  const nextDate = addDays(parseISO(match.current_end_date), 1);
                  setValue('start_date', format(nextDate, 'yyyy-MM-dd'));
              }
          }
      }
  }, [membershipNumber, members, isRenewal, isEditing, setValue, pulledGuest]);

  const handleResetPull = () => {
      setPulledGuest(null);
      reset({
          membership_number: '',
          guest_name: '',
          category_id: '',
          start_date: format(new Date(), 'yyyy-MM-dd'),
          discount: 0,
          phone: '',
          email: '',
          membership_type: 'New'
      });
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
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

  const overlapError = useMemo(() => {
      if (!isRenewal || !existingMember || !startDate) return null;
      const start = startOfDay(parseISO(startDate));
      const prevEnd = startOfDay(parseISO(existingMember.current_end_date));
      if (isBefore(start, addDays(prevEnd, 1))) {
          return `Timeline Integrity Audit: Notice Overlapping previous term (Exp: ${format(prevEnd, 'dd-MM-yyyy')})`;
      }
      return null;
  }, [isRenewal, existingMember, startDate]);

  // Context Banner logic: Shows "X days left" or "Expired X days ago"
  const matchContextText = useMemo(() => {
    const target = pulledGuest || existingMember;
    if (!target) return "";
    const today = startOfDay(new Date());
    const end = startOfDay(parseISO(target.current_end_date));
    const diff = differenceInCalendarDays(end, today);
    const statusText = diff >= 0 ? `${diff} days remaining` : `Expired ${Math.abs(diff)} days ago`;
    return `Guest History: ${statusText} (Current Term: ${format(parseISO(target.start_date), 'dd-MM-yyyy')} to ${format(end, 'dd-MM-yyyy')})`;
  }, [pulledGuest, existingMember]);

  const onFormSubmit = async (data: MemberFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    const isUpdate = !!(isEditing && !isRenewal && existingMember);
    
    // Pruning: Clean up empty strings to nulls for database compatibility
    const cleanData = { ...data };
    Object.keys(cleanData).forEach(key => {
        const k = key as keyof MemberFormValues;
        if (cleanData[k] === "") {
            (cleanData as any)[k] = null;
        }
    });

    const payload: Member = {
      ...(isUpdate ? existingMember : {}),
      ...cleanData,
      id: isUpdate ? existingMember!.id : crypto.randomUUID(),
      outlet_id: currentOutletId,
      original_end_date: endDateStr,
      current_end_date: endDateStr,
      actual_rate: baseRate,
      net_amount: netAmount,
      daily_rate: dailyRate,
      status: isUpdate ? existingMember!.status : MemberStatus.ACTIVE
    } as Member;

    try {
        if (isUpdate) {
            await db.updateMember(existingMember!.id, payload);
        } else {
            await db.addMember(payload);
        }
        
        setSubmitSuccess(true);
        setTimeout(() => {
            setIsSubmitting(false);
            onSuccess(payload);
        }, 800);
    } catch (e: any) { 
        console.error("Submission Failure:", e);
        setSubmitError(e.message || "Database synchronization failed.");
        setIsSubmitting(false);
    }
  };

  const title = isRenewal ? 'Renew Membership' : isEditing ? 'Edit Profile' : 'New Enrollment';
  const buttonLabel = submitSuccess ? 'Handshake Success' : isSubmitting ? 'Syncing...' : isRenewal ? 'Commit Renewal' : isEditing ? 'Sync Profile' : 'Confirm Enrollment';
  
  // LOCK LOGIC: Name and ID are editable during Profile Edit, but locked during Renewals or Pulls
  const isNameIdLocked = (isRenewal || !!pulledGuest) && !isEditing;

  return (
    <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white animate-in zoom-in-95 duration-300">
      <CardHeader className="bg-[#1e2335] text-white p-10 relative">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
              {isRenewal ? <RotateCcw className="w-6 h-6" /> : isEditing ? <UserCircle2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none">{title}</CardTitle>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">Lifecycle Management Console</p>
            </div>
          </div>
          <button onClick={onCancel} className="absolute top-10 right-10 p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-7 h-7" /></button>
      </CardHeader>
      
      <CardContent className="p-12">
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-10">
          
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-center gap-4 animate-in shake duration-300">
               <AlertTriangle className="w-8 h-8 text-red-500" />
               <div className="flex-1">
                  <h4 className="text-[11px] font-black text-red-900 uppercase tracking-tight">Validation Error</h4>
                  <p className="text-[10px] font-bold text-red-600 mt-0.5">Please review all fields. Some entries do not meet system requirements.</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4">
                      {Object.entries(errors).map(([field, error]) => (
                          <p key={field} className="text-[9px] font-black text-red-500 uppercase tracking-tighter">• {field.replace('_', ' ')}: {(error as any)?.message}</p>
                      ))}
                  </div>
               </div>
            </div>
          )}

          {(isRenewal || pulledGuest) && (
            <div className={`p-6 rounded-[2rem] border flex items-center justify-between animate-in slide-in-from-top-4 duration-500 ${pulledGuest ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm"><Zap className={`w-5 h-5 ${pulledGuest ? 'text-indigo-500' : 'text-emerald-500'}`} /></div>
                <div>
                   <h4 className={`text-xs font-black uppercase tracking-tight flex items-center gap-2 ${pulledGuest ? 'text-indigo-900' : 'text-emerald-900'}`}>Identity Matched</h4>
                   <p className={`text-[10px] font-bold uppercase ${pulledGuest ? 'text-indigo-600' : 'text-emerald-600'}`}>
                    {matchContextText}
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <span className={`text-[9px] font-black uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border ${pulledGuest ? 'border-indigo-100 text-indigo-700' : 'border-emerald-100 text-emerald-700'}`}>
                    {categories.find(c => c.id === (pulledGuest || existingMember)!.category_id)?.name}
                 </span>
                 {pulledGuest && (
                   <button type="button" onClick={handleResetPull} className="p-2 hover:bg-white rounded-xl transition-all" title="Clear Pulled Data">
                      <RotateCcw className="w-4 h-4 text-indigo-400" />
                   </button>
                 )}
              </div>
            </div>
          )}

          {/* Section: Primary Identity */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <UserCircle2 className="w-5 h-5 text-indigo-600" />
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Member Core Identity</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership No. / ID *</label>
                  <div className="relative group">
                    <Shield className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isNameIdLocked ? 'text-slate-400' : 'text-emerald-500'}`} />
                    <Input {...register('membership_number')} readOnly={isNameIdLocked} className={`h-14 pl-12 rounded-2xl font-bold border-2 ${isNameIdLocked ? 'bg-slate-50 text-slate-500 border-slate-100 cursor-not-allowed' : 'border-slate-200 focus:border-indigo-600'}`} />
                  </div>
                  {errors.membership_number && <p className="text-[9px] text-red-500 font-bold uppercase ml-1">{errors.membership_number.message}</p>}
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Profile Name *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input {...register('guest_name')} readOnly={isNameIdLocked} className={`h-14 pl-12 rounded-2xl font-bold border-2 ${isNameIdLocked ? 'bg-slate-50 text-slate-500 border-slate-100 cursor-not-allowed' : 'border-indigo-100 focus:border-indigo-600'}`} />
                  </div>
                  {errors.guest_name && <p className="text-[9px] text-red-500 font-bold uppercase ml-1">{errors.guest_name.message}</p>}
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input {...register('phone')} className="h-14 pl-12 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
                  </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input {...register('email')} className="h-14 pl-12 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
                  </div>
                  {errors.email && <p className="text-[9px] text-red-500 font-bold uppercase ml-1">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nationality</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input {...register('nationality')} className="h-14 pl-12 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
                  </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input type="date" {...register('dob')} className="h-14 pl-12 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
                  </div>
              </div>
            </div>
          </div>

          {/* Section: Contract Details */}
          <div className="space-y-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Tier & Recognition Logic</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership Tier *</label>
                  <select {...register('category_id')} className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-5 font-black text-sm outline-none focus:border-indigo-600 appearance-none"><option value="">Select Category...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  {errors.category_id && <p className="text-[9px] text-red-500 font-bold uppercase ml-1">{errors.category_id.message}</p>}
              </div>
              <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective Start Date *</label>
                  </div>
                  <Input type="date" {...register('start_date')} className="h-14 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
                  {errors.start_date && <p className="text-[9px] text-red-500 font-bold uppercase ml-1">{errors.start_date.message}</p>}
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Package Context</label>
                  <select {...register('package_type')} className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-5 font-black text-sm outline-none focus:border-indigo-600 appearance-none">
                      <option value="Single">Single Enrollment</option>
                      <option value="Couple">Couple Portfolio</option>
                      <option value="Family">Family Manifest</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Protocol</label>
                  <select {...register('access_type')} className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-5 font-black text-sm outline-none focus:border-indigo-600 appearance-none">
                      <option value="Both">Both (Pool + Spa)</option>
                      <option value="Pool">Pool Facilities Only</option>
                      <option value="Spa">Spa & Gym Only</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference / Check No. (Audit)</label>
                  <Input {...register('check_no')} className="h-14 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount Allocation ({currency?.symbol || 'ر.ق'})</label>
                  <Input type="number" step="0.01" {...register('discount', { valueAsNumber: true })} className="h-14 rounded-2xl font-bold border-2 border-slate-200 focus:border-indigo-600" />
              </div>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-center gap-4 animate-in shake duration-300">
               <ShieldAlert className="w-8 h-8 text-red-500" />
               <div>
                  <h4 className="text-[11px] font-black text-red-900 uppercase tracking-tight">Database Rejection</h4>
                  <p className="text-[10px] font-bold text-red-600 mt-0.5">{submitError}</p>
               </div>
            </div>
          )}

          {overlapError && (
            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex items-center gap-4 animate-in slide-in-from-left-2 duration-300">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm"><AlertCircle className="w-6 h-6" /></div>
              <div>
                <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-tight">Timeline Integrity Warning</h4>
                <p className="text-[10px] font-bold text-amber-600 mt-0.5">{overlapError}</p>
              </div>
            </div>
          )}

          <div className="bg-slate-50/80 p-10 rounded-[2.5rem] border border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-12 relative overflow-hidden">
              <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate</p>
                  <p className="text-base font-black text-slate-900 tabular-nums">{formatMoney(baseRate)}</p>
              </div>
              <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Revenue</p>
                  <p className="text-base font-black text-[#5c56d6] tabular-nums">{formatMoney(netAmount)}</p>
              </div>
              <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Expiry</p>
                  <p className="text-base font-black text-slate-900">{endDateStr ? format(parseISO(endDateStr), 'dd-MM-yyyy') : '---'}</p>
              </div>
              <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Accrual</p>
                  <p className="text-base font-black text-emerald-600 tabular-nums">{formatMoney(dailyRate)}<span className="text-[10px] opacity-60">/Day</span></p>
              </div>
          </div>

          <div className="flex gap-4 pt-4">
              <button type="button" onClick={onCancel} className="flex-1 h-16 rounded-[1.8rem] font-black text-xs uppercase tracking-widest bg-[#f4f7fa] text-slate-700 hover:bg-slate-200 transition-all flex items-center justify-center gap-2"><Command className="w-3.5 h-3.5 opacity-40"/> Cancel</button>
              <button type="submit" disabled={isSubmitting || submitSuccess} className={`flex-[2] h-16 rounded-[1.8rem] font-black text-base uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${submitSuccess ? 'bg-emerald-600 text-white' : isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#5c56d6] text-white shadow-[0_20px_40px_-10px_rgba(92,86,214,0.4)] hover:bg-[#4d48c0]'}`}>
                {buttonLabel} {submitSuccess ? <CheckCircle2 className="w-5 h-5 animate-in zoom-in" /> : isSubmitting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Command className="w-4 h-4 opacity-40"/>}
              </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const MemberDetail = ({ member, categories, getEffectiveStatus, initialTriggerFreeze, onBack, onUpdate, onRenew, onEdit, onDelete }: { member: Member, categories: MembershipCategory[], getEffectiveStatus: (m: Member) => string, initialTriggerFreeze?: boolean, onBack: () => void, onUpdate: () => void, onRenew: (m: Member) => void, onEdit: (m: Member) => void, onDelete: (id: string) => void }) => {
  const { formatMoney, currentProperty, currentOutlet, settings, hasPermission } = useSettings();
  const { user } = useAuth();
  const [displayedMember, setDisplayedMember] = useState<Member>(member);
  const [history, setHistory] = useState<Member[]>([]);
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [showContract, setShowContract] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeForm, setFreezeForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' });

  useEffect(() => { setDisplayedMember(member); }, [member]);
  useEffect(() => { loadLifecycle(); loadFreezes(); }, [displayedMember.membership_number, displayedMember.id]);

  // Handle auto-triggering freeze modal if signaled from parent list
  useEffect(() => {
    if (initialTriggerFreeze) {
      setShowFreezeModal(true);
    }
  }, [initialTriggerFreeze]);

  const loadLifecycle = async () => { setHistory(await db.getMemberHistory(displayedMember.membership_number)); };
  const loadFreezes = async () => { setFreezes(await db.getFreezes(displayedMember.id)); };

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
  
  const lifecycleStats = useMemo(() => {
    const start = parseISO(displayedMember.start_date);
    const end = parseISO(displayedMember.current_end_date);
    const now = new Date();
    const total = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const used = Math.max(0, differenceInCalendarDays(now, start));
    const percent = Math.min(100, Math.max(0, (used / total) * 100));
    const remaining = Math.max(0, differenceInCalendarDays(end, now));
    return { percent, remaining };
  }, [displayedMember]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 no-print">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Ledger</button>
        <div className="flex flex-wrap gap-2">
          {user && hasPermission(user.role_id, 'members:print_contract') && (<Button onClick={() => setShowContract(true)} variant="outline" className="rounded-xl h-11 px-6 font-black text-xs uppercase border-slate-200"><Printer className="w-4 h-4 mr-2" /> Agreement</Button>)}
          {user && hasPermission(user.role_id, 'members:freeze') && (<Button onClick={() => setShowFreezeModal(true)} variant="secondary" className="rounded-xl h-11 px-6 font-black text-xs uppercase bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"><Snowflake className="w-4 h-4 mr-2" /> Suspend</Button>)}
          {user && hasPermission(user.role_id, 'members:edit') && (<Button onClick={() => onEdit(displayedMember)} variant="secondary" className="rounded-xl h-11 px-6 font-black text-xs uppercase"><Edit2 className="w-4 h-4 mr-2" /> Edit Profile</Button>)}
          {user && hasPermission(user.role_id, 'members:renew') && (<Button onClick={() => onRenew(displayedMember)} className="rounded-xl h-11 px-6 font-black text-xs uppercase bg-[#5c56d6] shadow-xl shadow-indigo-100">Renew / Re-Enroll</Button>)}
          {user && hasPermission(user.role_id, 'members:delete') && (<Button onClick={() => onDelete(displayedMember.id)} variant="danger" className="rounded-xl h-11 px-4"><Trash2 className="w-4 h-4" /></Button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden text-center bg-white">
            <div className="h-24 bg-slate-900 w-full relative">
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                    <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[8px] font-black uppercase text-indigo-600 shadow-sm">{displayedMember.access_type || 'Both'}</span>
                    <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[8px] font-black uppercase text-indigo-600 shadow-sm">{displayedMember.package_type || 'Single'}</span>
                </div>
            </div>
            <CardContent className="p-8 mt-2">
              <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4"><div className="w-24 h-24 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">{displayedMember.guest_name.charAt(0)}</div></div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight">{displayedMember.guest_name}</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{displayedMember.membership_number}</p>
              <div className={`mt-6 inline-block px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{effectiveStatus}</div>
              
              <div className="mt-10 space-y-3">
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border text-left">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[7px] font-black uppercase text-slate-400">Mobile Terminal</p>
                        <p className="text-xs font-black text-slate-700">{displayedMember.phone || 'Not Logged'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border text-left">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[7px] font-black uppercase text-slate-400">Primary Email</p>
                        <p className="text-xs font-black text-slate-700 truncate">{displayedMember.email || 'Not Logged'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border text-left">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[7px] font-black uppercase text-slate-400">Nationality</p>
                        <p className="text-xs font-black text-slate-700 uppercase">{displayedMember.nationality || 'Not Specified'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border text-left">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[7px] font-black uppercase text-slate-400">Birth Registry</p>
                        <p className="text-xs font-black text-slate-700 uppercase">{displayedMember.dob ? format(parseISO(displayedMember.dob), 'dd MMM yyyy') : 'Not Logged'}</p>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-3"><Snowflake className="w-4 h-4 text-indigo-600"/> Suspension Ledger</CardTitle>
                    {user && hasPermission(user.role_id, 'members:freeze') && (<button onClick={() => setShowFreezeModal(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Plus className="w-4 h-4" /></button>)}
                </CardHeader>
                <CardContent className="p-6 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {freezes.length > 0 ? (
                        <div className="space-y-2">
                            {freezes.map(f => (
                                <div key={f.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 font-black text-[10px] shadow-sm">{f.total_days}</div>
                                        <div><h4 className="font-black text-slate-700 text-[10px] uppercase tracking-tight">{format(parseISO(f.start_date), 'dd MMM')} &rarr; {format(parseISO(f.end_date), 'dd MMM yy')}</h4></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (<div className="text-center py-10 opacity-30"><Snowflake className="w-10 h-10 mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">No Suspensions Recorded</p></div>)}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white p-10">
                <div className="flex justify-between items-start mb-8">
                    <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><RefreshCcw className="w-5 h-5 text-indigo-600" /> Term Progress</h3></div>
                    <div className="text-right"><span className="text-3xl font-black text-slate-900 tracking-tighter">{lifecycleStats.remaining}</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Days Left</p></div>
                </div>
                <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-4 shadow-inner"><div className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${lifecycleStats.percent}%` }}></div></div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div><span>Commencement</span><p className="text-slate-900">{format(parseISO(displayedMember.start_date), 'dd MMM yyyy')}</p></div>
                    <div className="text-right"><span>Expiry</span><p className="text-indigo-600">{format(parseISO(displayedMember.current_end_date), 'dd MMM yyyy')}</p></div>
                </div>
            </Card>

            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white p-10 flex flex-col justify-center text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Financial Commitment</p>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(displayedMember.net_amount)}</h3>
                 <div className="mt-4 flex justify-center gap-4">
                     <div className="text-center">
                         <p className="text-[8px] font-black text-slate-400 uppercase">Base Rate</p>
                         <p className="text-xs font-bold">{formatMoney(displayedMember.actual_rate)}</p>
                     </div>
                     <div className="w-px h-6 bg-slate-100 mt-1"></div>
                     <div className="text-center">
                         <p className="text-[8px] font-black text-slate-400 uppercase">System Credit</p>
                         <p className="text-xs font-bold text-red-500">-{formatMoney(displayedMember.discount)}</p>
                     </div>
                 </div>
            </Card>
          </div>

          {(displayedMember.package_type === 'Couple' || displayedMember.package_type === 'Family') && (
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-8 flex items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                        <Heart className="w-5 h-5 text-red-400" /> Family Manifest
                    </CardTitle>
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">{displayedMember.package_type} Portfolio</span>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Spouse / Primary Companion</h4>
                            <p className="text-base font-black text-slate-900 uppercase">{displayedMember.spouse_name || 'Not Registered'}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{displayedMember.spouse_dob ? `DOB: ${format(parseISO(displayedMember.spouse_dob), 'dd MMM yyyy')}` : 'Birth Record Empty'}</p>
                        </div>
                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Baby className="w-3.5 h-3.5" /> Dependent Registry</h4>
                            {displayedMember.kids && displayedMember.kids.length > 0 ? (
                                <div className="space-y-3">
                                    {displayedMember.kids.map((kid, kIdx) => (
                                        <div key={kIdx} className="flex justify-between items-center border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{kid.name}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">DOB: {format(parseISO(kid.dob), 'dd MMM yyyy')}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] font-bold text-slate-400 uppercase">No dependents registered.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
          )}

          <div className="bg-[#1e2335] p-10 rounded-[2.5rem] border border-slate-800 text-white relative overflow-hidden group">
              <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <Zap className="w-40 h-40" />
              </div>
              <div className="relative z-10">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> Lifecycle Ledger Audit</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      <div><p className="text-[9px] font-black uppercase text-indigo-300/50 mb-1">Status Protocol</p><p className="text-sm font-black uppercase">{effectiveStatus}</p></div>
                      <div><p className="text-[9px] font-black uppercase text-indigo-300/50 mb-1">Daily Yield</p><p className="text-sm font-black uppercase text-emerald-400">{formatMoney(displayedMember.daily_rate)}</p></div>
                      <div><p className="text-[9px] font-black uppercase text-indigo-300/50 mb-1">Category Rank</p><p className="text-sm font-black uppercase">{categories.find(c => c.id === displayedMember.category_id)?.name}</p></div>
                      <div><p className="text-[9px] font-black uppercase text-indigo-300/50 mb-1">Registration</p><p className="text-sm font-black uppercase">{displayedMember.membership_type}</p></div>
                  </div>
              </div>
          </div>
        </div>
      </div>
      
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

      {showFreezeModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
              <Card className="w-full max-w-sm rounded-[2rem] border-slate-200 shadow-2xl overflow-hidden bg-white">
                  <CardHeader className="bg-indigo-600 text-white p-6 relative">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3"><Snowflake className="w-5 h-5"/> Account Suspension</CardTitle>
                      <button onClick={() => setShowFreezeModal(false)} className="absolute top-5 right-6 p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5"/></button>
                  </CardHeader>
                  <CardContent className="p-8">
                      <form onSubmit={handleAddFreeze} className="space-y-6">
                          <Input label="Effective Start Date" type="date" value={freezeForm.start_date} onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} className="h-12 rounded-xl" required />
                          <Input label="Resumption Date" type="date" value={freezeForm.end_date} onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} className="h-12 rounded-xl" required />
                          <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase shadow-xl shadow-indigo-100">Commit Suspension</Button>
                      </form>
                  </CardContent>
              </Card>
          </div>
      )}
    </div>
  );
};

export default Members;