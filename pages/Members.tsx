
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { MembershipContract } from '../components/MembershipContract';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X,
  RefreshCcw,
  History,
  Zap,
  UserSearch,
  FileText,
  PlusCircle,
  MinusCircle,
  ArrowLeft,
  Users,
  EyeOff,
  Filter,
  LayoutGrid,
  ListFilter,
  Tag,
  Edit3,
  AlertTriangle,
  Printer,
  ChevronRight,
  ChevronLeft,
  User,
  Heart,
  Baby,
  Clock,
  ArrowRightCircle,
  Coins,
  TrendingUp,
  Info,
  Snowflake,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Command,
  AlertCircle
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays, isAfter, isBefore, isEqual } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate, useLocation } from 'react-router-dom';

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
});

type MemberFormValues = z.infer<typeof memberSchema>;

const MemberForm = ({ 
  categories, 
  members, 
  existingMember, 
  isRenewal, 
  currentOutletId, 
  onCancel, 
  onSuccess,
  canCreate,
  canEdit
}: { 
  categories: MembershipCategory[], 
  members: Member[], 
  existingMember: Member | null, 
  isRenewal: boolean, 
  currentOutletId: string, 
  onCancel: () => void, 
  onSuccess: (m: Member) => void,
  canCreate: boolean,
  canEdit: boolean
}) => {
  const { formatMoney, currency } = useSettings();
  const { register, handleSubmit, watch, setValue, reset, resetField, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: existingMember ? {
      membership_number: existingMember.membership_number,
      guest_name: existingMember.guest_name,
      category_id: existingMember.category_id,
      start_date: isRenewal ? format(new Date(), 'yyyy-MM-dd') : existingMember.start_date,
      discount: isRenewal ? 0 : (existingMember.discount || 0),
      check_no: isRenewal ? '' : (existingMember.check_no || ''),
    } : {
      membership_number: '',
      guest_name: '',
      category_id: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      discount: 0,
      check_no: '',
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const watchedMembershipNumber = watch('membership_number');
  const watchCategory = watch('category_id');
  const watchDiscount = watch('discount') || 0;
  const watchStartDate = watch('start_date');

  // Intelligent lookup for existing profile
  const matchedProfile = useMemo(() => {
    if (existingMember && !isRenewal) return null;
    if (!watchedMembershipNumber || watchedMembershipNumber.trim().length < 2) return null;
    return members
        .filter(m => m.membership_number === watchedMembershipNumber.trim())
        .sort((a, b) => b.current_end_date.localeCompare(a.current_end_date))[0] || null;
  }, [watchedMembershipNumber, members, existingMember, isRenewal]);

  // Handle auto-fill logic
  useEffect(() => {
    if (existingMember && !isRenewal) return;
    
    if (matchedProfile) {
        setValue('guest_name', matchedProfile.guest_name);
        setValue('category_id', matchedProfile.category_id);
        const prevEnd = parseISO(matchedProfile.current_end_date);
        const today = startOfDay(new Date());
        // Continuity logic: If expired, start today. If active, start tomorrow.
        const smartStart = isBefore(prevEnd, today) ? today : addDays(prevEnd, 1);
        setValue('start_date', format(smartStart, 'yyyy-MM-dd'));
    } else if (!watchedMembershipNumber || watchedMembershipNumber.trim() === '') {
        // Clear logic when ID is manually erased
        resetField('guest_name');
        resetField('category_id');
        setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    }
  }, [matchedProfile, watchedMembershipNumber, setValue, resetField, isRenewal, existingMember]);

  const handleClearIdentity = () => {
    reset({
        membership_number: '',
        guest_name: '',
        category_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0,
        check_no: ''
    });
  };

  const selectedCategory = categories.find(c => c.id === watchCategory);
  
  const financials = useMemo(() => {
    if (!selectedCategory || !watchStartDate) return null;
    const start = parseISO(watchStartDate);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    const netAmount = Math.max(0, selectedCategory.base_rate - watchDiscount);
    const dailyRate = RevenueEngine.calculateDailyRate(netAmount, start, end);
    return { base: selectedCategory.base_rate, net: netAmount, expiry: format(end, 'dd-MM-yyyy'), daily: dailyRate };
  }, [selectedCategory, watchDiscount, watchStartDate]);

  const continuityStatus = useMemo(() => {
      if (!matchedProfile || !watchStartDate) return null;
      const prevEnd = startOfDay(parseISO(matchedProfile.current_end_date));
      const newStart = startOfDay(parseISO(watchStartDate));
      const dayAfterPrev = addDays(prevEnd, 1);

      return {
          isContinuous: isEqual(newStart, dayAfterPrev) || (isBefore(prevEnd, new Date()) && isEqual(newStart, startOfDay(new Date()))),
          isOverlap: isBefore(newStart, dayAfterPrev),
          isGap: isAfter(newStart, dayAfterPrev) && !(isBefore(prevEnd, new Date()) && isEqual(newStart, startOfDay(new Date()))),
          gapDays: differenceInCalendarDays(newStart, dayAfterPrev)
      };
  }, [matchedProfile, watchStartDate]);

  const onSubmit = async (values: MemberFormValues) => {
    if (!selectedCategory || !currentOutletId || !financials) return;
    setIsSubmitting(true);
    try {
      const start = parseISO(values.start_date);
      const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
      
      const memberData: Member = {
        ...values,
        id: (existingMember && !isRenewal) ? existingMember.id : crypto.randomUUID(),
        outlet_id: currentOutletId,
        original_end_date: format(end, 'yyyy-MM-dd'),
        current_end_date: format(end, 'yyyy-MM-dd'),
        actual_rate: selectedCategory.base_rate,
        net_amount: financials.net,
        daily_rate: financials.daily,
        status: MemberStatus.ACTIVE,
        created_at: new Date().toISOString()
      };

      if (existingMember && !isRenewal) { await db.updateMember(existingMember.id, memberData); } 
      else { await db.addMember(memberData); }
      onSuccess(memberData);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  return (
    <Card className="max-w-2xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden border-slate-200/60 bg-white animate-in zoom-in-95 duration-300">
      <CardHeader className="bg-[#1e1b4b] text-white p-8 relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            {isRenewal || matchedProfile ? <RefreshCcw className="w-6 h-6 text-indigo-400" /> : <UserSearch className="w-6 h-6 text-indigo-400" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-white uppercase">
              {isRenewal || matchedProfile ? 'Renew Membership' : existingMember ? 'Edit Profile' : 'New Enrollment'}
            </CardTitle>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Lifecycle Management Console</p>
          </div>
        </div>
        <button onClick={onCancel} className="absolute top-8 right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-6 h-6" /></button>
      </CardHeader>
      
      <CardContent className="p-8 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {matchedProfile && (
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[2rem] p-6 flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[#bbf7d0] flex items-center justify-center text-[#15803d] shadow-sm"><History className="w-6 h-6" /></div>
                    <div>
                        <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-[#15803d]" fill="currentColor" /><h4 className="text-[11px] font-black text-[#15803d] uppercase tracking-widest leading-none">Identity Matched</h4></div>
                        <p className="text-[10px] font-bold text-[#166534] uppercase mt-1.5">Guest History: Active from <span className="underline">{format(parseISO(matchedProfile.start_date), 'dd-MM-yyyy')}</span> to <span className="underline">{format(parseISO(matchedProfile.current_end_date), 'dd-MM-yyyy')}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white border border-[#bbf7d0] rounded-xl text-[10px] font-black uppercase text-[#15803d] whitespace-nowrap">
                        {categories.find(c => c.id === matchedProfile.category_id)?.name || 'Prev. Tier'}
                    </span>
                    <button type="button" onClick={handleClearIdentity} title="Clear Profile" className="p-2 text-emerald-400 hover:text-red-500 transition-colors border border-[#bbf7d0] bg-white rounded-lg shadow-sm"><RotateCcw className="w-4 h-4" /></button>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership No. / ID</label>
                      <div className="relative">
                          <UserSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <Input {...register('membership_number')} readOnly={isRenewal} className="h-12 pl-11 rounded-xl font-bold tracking-tight" placeholder="ID Number" />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Guest Profile Name</label>
                      <Input {...register('guest_name')} readOnly={!!matchedProfile} className="h-12 rounded-xl font-bold tracking-tight" placeholder="Full Identity" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Reference / Check No. (Audit)</label>
                      <Input {...register('check_no')} className="h-12 rounded-xl font-bold" placeholder="Reference #" />
                  </div>
              </div>

              <div className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership Tier</label>
                      <select {...register('category_id')} className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all">
                          <option value="">Select Category...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Effective Start Date</label>
                        {matchedProfile && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Optimized Sequence</span>}
                      </div>
                      <input type="date" {...register('start_date')} className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Discount Allocation ({currency?.symbol || 'ر.ق'})</label>
                      <Input type="number" step="0.01" {...register('discount', { valueAsNumber: true })} className="h-12 rounded-xl font-bold" />
                  </div>
              </div>
          </div>

          {continuityStatus && (
              <div className={`p-5 rounded-[2rem] flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 border shadow-sm ${
                continuityStatus.isOverlap ? 'bg-red-50 border-red-100 text-red-700' :
                continuityStatus.isGap ? 'bg-amber-50 border-amber-100 text-amber-700' :
                'bg-indigo-50 border-indigo-100 text-indigo-700'
              }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                    continuityStatus.isOverlap ? 'bg-red-100' :
                    continuityStatus.isGap ? 'bg-amber-100' :
                    'bg-indigo-100'
                  }`}>
                    {continuityStatus.isOverlap ? <AlertCircle className="w-5 h-5"/> : <ShieldCheck className="w-5 h-5"/>}
                  </div>
                  <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest mb-0.5">Timeline Integrity Audit</h5>
                      <p className="text-xs font-bold leading-none">
                          {continuityStatus.isOverlap ? `Overlap Error: New term starts before previous cycle ends (${format(parseISO(matchedProfile!.current_end_date), 'dd-MM-yyyy')})` :
                           continuityStatus.isGap ? `Timeline Warning: There is a gap of ${continuityStatus.gapDays} days between terms.` :
                           'Secured: Continuity verified with previous profile.'}
                      </p>
                  </div>
              </div>
          )}

          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate</p><p className="text-sm font-black text-slate-900">{financials ? formatMoney(financials.base) : '0.00 ر.ق'}</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Revenue</p><p className="text-sm font-black text-indigo-600">{financials ? formatMoney(financials.net) : '0.00 ر.ق'}</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Expiry</p><p className="text-sm font-black text-slate-900">{financials?.expiry || '---'}</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Accrual</p><p className="text-sm font-black text-emerald-600">{financials ? `${formatMoney(financials.daily)}/Day` : '0.00 ر.ق/Day'}</p></div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200 flex items-center justify-center gap-2"><Command className="w-3 h-3 text-slate-400"/> Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} className={`flex-1 h-14 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 ${continuityStatus?.isOverlap ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'shadow-indigo-100'}`}>
              {isRenewal || matchedProfile ? 'Commit Renewal' : existingMember ? 'Sync Profile' : 'Confirm Enrollment'} <Command className="w-3 h-3 opacity-50"/>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const MemberDetail = ({ 
  member, 
  categories, 
  initialFreeze, 
  getEffectiveStatus, 
  onBack, 
  onUpdate,
  onRenew,
  allMembers
}: { 
  member: Member, 
  categories: MembershipCategory[], 
  initialFreeze: boolean,
  getEffectiveStatus: (m: Member) => string,
  onBack: () => void,
  onUpdate: () => void,
  onRenew: (m: Member) => void,
  allMembers: Member[]
}) => {
  const { user } = useAuth();
  const { formatMoney, hasPermission } = useSettings();
  const [activeViewMember, setActiveViewMember] = useState<Member>(member);
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [showFreezeModal, setShowFreezeModal] = useState(initialFreeze);
  const [isEditingFreeze, setIsEditingFreeze] = useState(false);
  const [freezeToDeleteId, setFreezeToDeleteId] = useState<string | null>(null);
  const [freezeForm, setFreezeForm] = useState({ id: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' });
  const [history, setHistory] = useState<Member[]>([]);

  useEffect(() => { setActiveViewMember(member); }, [member]);

  useEffect(() => {
    db.getMemberHistory(member.membership_number).then(setHistory);
  }, [member.membership_number]);

  useEffect(() => {
    db.getFreezes(activeViewMember.id).then(setFreezes);
  }, [activeViewMember.id]);

  const handleAddFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeForm.start_date || !freezeForm.end_date) return;
    const start = parseISO(freezeForm.start_date);
    const end = parseISO(freezeForm.end_date);
    if (end < start) { alert("End date cannot be before start date"); return; }
    const totalDays = differenceInCalendarDays(end, start) + 1;
    const memberCategory = categories.find(c => c.id === activeViewMember.category_id);
    const maxFreezeDays = memberCategory?.max_freeze_days || 0;
    const otherFreezes = isEditingFreeze ? freezes.filter(f => f.id !== freezeForm.id) : freezes;
    const usedFreezeDays = otherFreezes.reduce((sum, f) => sum + f.total_days, 0);
    
    if (usedFreezeDays + totalDays > maxFreezeDays) {
        alert(`Freeze limit exceeded. Maximum: ${maxFreezeDays} days.`);
        return;
    }
    
    try {
        if (isEditingFreeze && freezeForm.id) {
            await db.updateFreeze(freezeForm.id, { start_date: freezeForm.start_date, end_date: freezeForm.end_date, total_days: totalDays });
        } else {
            await db.addFreeze({ id: crypto.randomUUID(), member_id: activeViewMember.id, start_date: freezeForm.start_date, end_date: freezeForm.end_date, total_days: totalDays });
        }
        setShowFreezeModal(false);
        setIsEditingFreeze(false);
        onUpdate();
        const updatedFreezes = await db.getFreezes(activeViewMember.id);
        setFreezes(updatedFreezes);
    } catch (err) { console.error(err); }
  };

  const daysLeft = differenceInCalendarDays(parseISO(activeViewMember.current_end_date), new Date());
  const effectiveStatus = getEffectiveStatus(activeViewMember);
  const totalFreezeDays = freezes.reduce((sum, f) => sum + f.total_days, 0);
  const memberCategory = categories.find(c => c.id === activeViewMember.category_id);
  const freezeAllowance = memberCategory?.max_freeze_days || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Directory</button>
        {user && hasPermission(user.role_id, 'members:renew') && (
            <Button onClick={() => onRenew(activeViewMember)} className="rounded-xl h-11 px-6 font-black text-xs uppercase shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700">
                <RefreshCcw className="w-4 h-4 mr-2" /> Renew / Re-Enroll
            </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden text-center">
                 <CardContent className="p-8">
                    <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                        <div className="w-24 h-24 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                            {activeViewMember.guest_name.charAt(0)}
                        </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{activeViewMember.guest_name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {activeViewMember.membership_number}</p>
                    <div className={`mt-6 inline-block px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${
                        effectiveStatus === MemberStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        effectiveStatus === MemberStatus.FROZEN ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                        {effectiveStatus}
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                 <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-600"/> Financial Summary
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-500 uppercase">Net Value</span><span className="font-black text-slate-900">{formatMoney(activeViewMember.net_amount)}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-500 uppercase">Daily Accrual</span><span className="font-black text-emerald-600">{formatMoney(activeViewMember.daily_rate)}</span></div>
                 </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                 <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2 uppercase">
                        <History className="w-4 h-4 text-indigo-600"/> Member Life Cycle
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-2 space-y-1">
                    {history.map((h, idx) => (
                        <button 
                            key={h.id} 
                            onClick={() => setActiveViewMember(h)}
                            className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all border ${h.id === activeViewMember.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'bg-white hover:bg-indigo-50 border-transparent hover:border-indigo-100 text-slate-600'}`}
                        >
                            <div className="flex flex-col gap-1 text-left">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${h.id === activeViewMember.id ? 'text-indigo-200' : 'text-slate-400'}`}>Cycle {history.length - idx}</p>
                                <p className="text-xs font-black">
                                    {format(parseISO(h.start_date), 'dd MMM yy')} &rarr; {format(parseISO(h.current_end_date), 'dd MMM yy')}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase whitespace-nowrap ${h.id === activeViewMember.id ? 'bg-white/10 text-white border-white/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {categories.find(c => c.id === h.category_id)?.name.split(' ')[0] || 'Term'}
                                </span>
                                {h.id !== activeViewMember.id && <ArrowRightCircle className="w-3.5 h-3.5 opacity-30" />}
                            </div>
                        </button>
                    ))}
                 </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                 <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                        <Info className="w-5 h-5 text-indigo-600"/> Lifecycle Details
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Membership Tier</p><p className="font-bold text-slate-900 uppercase">{memberCategory?.name}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Ref / Check</p><p className="font-bold text-slate-900">{activeViewMember.check_no || 'N/A'}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Term Start</p><p className="font-bold text-slate-900">{format(parseISO(activeViewMember.start_date), 'MMMM do, yyyy')}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Expiry</p><p className="font-bold text-slate-900">{format(parseISO(activeViewMember.original_end_date), 'MMMM do, yyyy')}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Expiry</p><p className="font-bold text-indigo-600">{format(parseISO(activeViewMember.current_end_date), 'MMMM do, yyyy')}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Days Remaining</p><p className={`font-black ${daysLeft < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{daysLeft < 0 ? `Expired ${-daysLeft} days ago` : `${daysLeft} days`}</p></div>
                 </CardContent>
            </Card>
            
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                 <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3 uppercase">
                        <Snowflake className="w-5 h-5 text-indigo-600"/> Suspension Ledger
                    </CardTitle>
                    {user && hasPermission(user.role_id, 'members:freeze') && activeViewMember.id === history[0]?.id && (
                        <Button onClick={() => { setIsEditingFreeze(false); setFreezeForm({ id: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' }); setShowFreezeModal(true); }} size="sm" className="rounded-xl font-black text-[10px] uppercase h-9 px-4">
                           <Plus className="w-3.5 h-3.5 mr-2"/> Add Freeze
                        </Button>
                    )}
                 </CardHeader>
                 <CardContent className="p-8 space-y-4">
                     <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex justify-between items-center text-indigo-700 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest">Freeze Allowance</span>
                        <span className="text-xl font-black">{freezeAllowance} Days</span>
                     </div>
                     <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Days Used</span>
                        <span className={`text-xl font-black ${totalFreezeDays > freezeAllowance ? 'text-red-500' : 'text-slate-900'}`}>{totalFreezeDays} Days</span>
                     </div>
                    {freezes.length > 0 ? (
                        <div className="space-y-2 pt-6">
                        {freezes.map(f => (
                            <div key={f.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:shadow-lg hover:border-indigo-100 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        {f.total_days}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-700 text-xs">
                                            {format(parseISO(f.start_date), 'dd MMM')} to {format(parseISO(f.end_date), 'dd MMM yyyy')}
                                        </h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Reference ID: {f.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setFreezeForm({ id: f.id, start_date: f.start_date, end_date: f.end_date }); setIsEditingFreeze(true); setShowFreezeModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                    <button onClick={() => setFreezeToDeleteId(f.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-slate-50/50 border border-dashed border-slate-200 rounded-[2rem] mt-4">
                             <Snowflake className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No Suspensions on Record for this Cycle</p>
                        </div>
                    )}
                 </CardContent>
            </Card>
        </div>
      </div>

      {showFreezeModal && (
        <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <Card className="max-w-md w-full rounded-[2.5rem] shadow-2xl border-slate-200/60 animate-in zoom-in-95 duration-300 overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-lg font-black tracking-tight uppercase">{isEditingFreeze ? 'Modify Suspension' : 'Apply Suspension'}</CardTitle>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lifecycle Deferral Logic</p>
                </CardHeader>
                <form onSubmit={handleAddFreeze}>
                    <CardContent className="p-8 space-y-6">
                        <Input label="Start Date" type="date" value={freezeForm.start_date} onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} className="h-12 rounded-xl" />
                        <Input label="End Date" type="date" value={freezeForm.end_date} onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} className="h-12 rounded-xl" />
                        
                        <div className="bg-indigo-50 p-4 rounded-2xl flex items-start gap-3">
                            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-indigo-900/60 font-medium leading-relaxed">Applying a suspension will automatically extend the current membership recognition period by the total amount of frozen days.</p>
                        </div>
                    </CardContent>
                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => { setShowFreezeModal(false); setIsEditingFreeze(false); }} className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest">Discard</Button>
                        <Button type="submit" className="flex-[2] h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">{isEditingFreeze ? 'Commit Update' : 'Authorize Freeze'}</Button>
                    </div>
                </form>
            </Card>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!freezeToDeleteId}
        onClose={() => setFreezeToDeleteId(null)}
        onConfirm={async () => {
            if (!freezeToDeleteId) return;
            await db.deleteFreeze(freezeToDeleteId);
            setFreezeToDeleteId(null);
            onUpdate();
            const updatedFreezes = await db.getFreezes(activeViewMember.id);
            setFreezes(updatedFreezes);
        }}
        title="Revoke Suspension Record"
        description="Are you sure you want to delete this suspension entry? The member's recognition period will be recalculated to reflect the returned quota."
        confirmText="Execute Revocation"
        isDestructive
      />
    </div>
  );
}

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, formatMoney, hasPermission, checkShortcut } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All' | 'Renewed'>(MemberStatus.ACTIVE);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [autoFreeze, setAutoFreeze] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentOutlet) loadData();
  }, [currentOutlet]);
  
  useEffect(() => {
    const memberIdFromState = location.state?.selectedMemberId;
    if (memberIdFromState && members.length > 0) {
      const memberToView = members.find(m => m.id === memberIdFromState);
      if (memberToView) {
        setSelectedMember(memberToView);
        setView('detail');
        navigate('.', { replace: true, state: {} });
      }
    }
  }, [members, location.state, navigate]);

  const loadData = async () => {
    if (!currentOutlet) return;
    const [m, c] = await Promise.all([
        db.getMembers(currentOutlet.id), 
        db.getCategories(currentOutlet.id)
    ]);
    setMembers(m);
    setCategories(c);
    if (selectedMember) {
        const updated = m.find(mem => mem.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
    }
  };

  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');

  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
        if (view === 'list') {
            if (checkShortcut(e, 'action_create')) { e.preventDefault(); handleAddNew(); }
            if (checkShortcut(e, 'global_search')) { e.preventDefault(); searchInputRef.current?.focus(); }
        }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [view, canCreate]);

  const getEffectiveStatus = (member: Member) => {
      if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING) return member.status;
      const end = parseISO(member.current_end_date);
      const today = startOfDay(new Date());
      return isBefore(end, today) ? MemberStatus.EXPIRED : MemberStatus.ACTIVE;
  };

  const handleRenew = (memberToRenew: Member) => {
    if (!canCreate) return;
    setSelectedMember(memberToRenew);
    setIsEditing(false);
    setIsRenewal(true);
    setView('form');
  };

  const handleAddNew = () => {
      if (!canCreate) return;
      setSelectedMember(null);
      setIsEditing(false);
      setIsRenewal(false);
      setView('form');
  };

  const filteredMembers = useMemo(() => {
    // Show only the latest cycle for each ID in the directory
    const latestMap: Record<string, Member> = {};
    members.forEach(m => {
        if (!latestMap[m.membership_number] || isAfter(parseISO(m.start_date), parseISO(latestMap[m.membership_number].start_date))) {
            latestMap[m.membership_number] = m;
        }
    });

    return Object.values(latestMap).filter(m => {
      const matchesSearch = 
        m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.membership_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.check_no && m.check_no.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const effectiveStatus = getEffectiveStatus(m);
      let matchesStatus = false;
      if (statusFilter === 'All') matchesStatus = true;
      else if (statusFilter === 'Renewed') {
          const counts = members.reduce((acc, mem) => { acc[mem.membership_number] = (acc[mem.membership_number] || 0) + 1; return acc; }, {} as Record<string, number>);
          matchesStatus = counts[m.membership_number] > 1;
      } else matchesStatus = effectiveStatus === statusFilter;
      
      const matchesCategory = categoryFilter === 'All' || m.category_id === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    return categories.map(cat => ({
        category: cat,
        members: filteredMembers.filter(m => m.category_id === cat.id)
    })).filter(g => g.members.length > 0);
  }, [categories, filteredMembers]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter(MemberStatus.ACTIVE);
    setCategoryFilter('All');
  };

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
                 <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Members</h1>
                 <p className="text-sm font-medium text-slate-500 mt-2 italic">Active portfolio for <span className="text-indigo-600 font-bold">{currentOutlet?.name}</span></p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:min-w-[400px]">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                    ref={searchInputRef}
                    placeholder="Search name, ID, or reference..." 
                    className="w-full h-14 pl-14 pr-6 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`h-14 px-6 rounded-2xl border-slate-200 ${showFilters ? 'bg-slate-100 text-indigo-600' : ''}`}>
                <Filter className="w-4 h-4 mr-2" /> <span>Advanced</span>
              </Button>
              
              {canCreate && (
                <Button onClick={handleAddNew} className="h-14 px-8 rounded-2xl shadow-xl shadow-indigo-100 font-black tracking-tight whitespace-nowrap bg-indigo-600">
                    <Plus className="w-5 h-5 mr-1" /> Add Members
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <Card className="border-slate-200/60 shadow-xl rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300">
                <CardContent className="p-8 space-y-8 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tier Filter</label>
                            <select 
                                className="w-full h-14 px-5 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All Tiers</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lifecycle Status Filter</label>
                            <div className="flex flex-wrap gap-2">
                                {['All', MemberStatus.ACTIVE, MemberStatus.FROZEN, MemberStatus.EXPIRED, 'Renewed'].map(status => (
                                    <button 
                                        key={status}
                                        onClick={() => setStatusFilter(status as any)}
                                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${statusFilter === status ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-6 border-t border-slate-200/60">
                        <p className="text-xs text-slate-400 font-medium italic">Applying lifecycle filters to current repository view</p>
                        <button onClick={resetFilters} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity">
                            <X className="w-4 h-4" /> Clear Filters
                        </button>
                    </div>
                </CardContent>
            </Card>
          )}

          <div className="space-y-8">
            {groupedMembers.map((group) => (
                <div key={group.category.id} className="space-y-4">
                    <div className="flex items-center gap-4 px-2">
                        <Tag className="w-4 h-4 text-indigo-600" />
                        <span className="text-[12px] font-black uppercase tracking-[0.2em] text-indigo-950">{group.category.name}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase ml-2">BASE: {formatMoney(group.category.base_rate)}</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">{group.members.length} RECORD</span>
                    </div>

                    <Card className="overflow-hidden border-slate-200/60 shadow-xl rounded-[2.5rem] bg-white">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50 border-b">
                            <tr>
                                <th className="px-8 py-5">Membership #</th>
                                <th className="px-8 py-5">Guest Profile</th>
                                <th className="px-8 py-5 text-center">Status</th>
                                <th className="px-8 py-5">Start Date</th>
                                <th className="px-8 py-5">Expiry Date</th>
                                <th className="px-8 py-5 text-right">Net Amount</th>
                                <th className="px-8 py-5 text-center">Operations</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((member) => {
                                const effectiveStatus = getEffectiveStatus(member);
                                return (
                                <tr 
                                    key={member.id} 
                                    className="hover:bg-indigo-50/30 cursor-pointer transition-all duration-300 group"
                                    onClick={() => { setSelectedMember(member); setView('detail'); }}
                                >
                                <td className="px-8 py-6">
                                    <span className="font-black text-slate-900 tracking-tight text-base">{member.membership_number}</span>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="font-black text-slate-700 uppercase text-xs">{member.guest_name}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{member.check_no || 'Ref: N/A'}</div>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border
                                    ${effectiveStatus === MemberStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        effectiveStatus === MemberStatus.FROZEN ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                        'bg-red-50 text-red-700 border-red-200'}`}>
                                    {effectiveStatus}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-slate-500 font-bold text-xs">{format(parseISO(member.start_date), 'dd-MM-yyyy')}</td>
                                <td className="px-8 py-6 text-indigo-600 font-black tracking-tight text-sm">{format(parseISO(member.current_end_date), 'dd-MM-yyyy')}</td>
                                <td className="px-8 py-6 text-right font-black tabular-nums text-slate-900">{formatMoney(member.net_amount)}</td>
                                <td className="px-8 py-6">
                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        {canCreate && <button title="Renew" onClick={() => handleRenew(member)} className="p-2 text-slate-400 hover:text-emerald-600"><RefreshCcw className="w-4 h-4" /></button>}
                                        {canEdit && <button title="Freeze" onClick={(e) => { setSelectedMember(member); setAutoFreeze(true); setView('detail'); }} className="p-2 text-slate-400 hover:text-indigo-600"><Snowflake className="w-4 h-4" /></button>}
                                        {canEdit && <button title="Edit" onClick={(e) => { setSelectedMember(member); setIsEditing(true); setIsRenewal(false); setView('form'); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>}
                                        {canDelete && <button title="Purge" onClick={() => setDeleteId(member.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                                    </div>
                                </td>
                                </tr>
                            )})}
                            </tbody>
                        </table>
                        </div>
                    </Card>
                </div>
            ))}
          </div>
          <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if (deleteId && canDelete) { await db.deleteMember(deleteId); loadData(); } }} title="Purge Record" description="Irreversible removal of guest profile." confirmText="Execute Purge" isDestructive={true} />
        </div>
      )}

      {view === 'form' && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-2xl py-12">
                <MemberForm 
                    categories={categories} 
                    members={members}
                    existingMember={isEditing || isRenewal ? selectedMember : null}
                    isRenewal={isRenewal}
                    currentOutletId={currentOutlet?.id || ''}
                    onCancel={() => { setView('list'); setAutoFreeze(false); }} 
                    onSuccess={() => { loadData(); setView('list'); setAutoFreeze(false); }} 
                    canCreate={canCreate}
                    canEdit={canEdit}
                />
            </div>
        </div>
      )}

      {view === 'detail' && selectedMember && (
        <MemberDetail 
          member={selectedMember} 
          categories={categories}
          initialFreeze={autoFreeze}
          getEffectiveStatus={getEffectiveStatus}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoFreeze(false); }}
          onUpdate={() => { loadData(); setAutoFreeze(false); }} 
          onRenew={handleRenew}
          allMembers={members}
        />
      )}
    </div>
  );
};

export default Members;
