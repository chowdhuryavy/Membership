
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
  Layers, 
  X,
  RefreshCcw,
  History,
  UserPlus,
  Zap,
  RotateCcw,
  ShieldCheck,
  UserSearch,
  FileText,
  XCircle,
  PlusCircle,
  MinusCircle,
  Heart,
  Activity,
  ArrowLeft,
  Users
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays, isAfter, isBefore } from 'date-fns';
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
  nationality: z.string().optional(),
  dob: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  phone: z.string().optional(),
  is_married: z.boolean().default(false),
  package_type: z.enum(['Single', 'Couple', 'Family']).default('Single'),
  access_type: z.enum(['Pool', 'Spa', 'Both']).default('Both'),
  membership_type: z.enum(['New', 'Renew']).default('New'),
  spouse_name: z.string().optional(),
  spouse_dob: z.string().optional(),
  remarks: z.string().optional(),
  kids: z.array(z.object({
    name: z.string(),
    dob: z.string()
  })).optional().default([])
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
  const { formatMoney } = useSettings();
  const { register, handleSubmit, watch, control, setValue, reset, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: existingMember ? {
      membership_number: existingMember.membership_number,
      guest_name: existingMember.guest_name,
      category_id: existingMember.category_id,
      start_date: isRenewal ? format(new Date(), 'yyyy-MM-dd') : existingMember.start_date,
      discount: isRenewal ? 0 : existingMember.discount,
      check_no: isRenewal ? '' : existingMember.check_no,
      nationality: existingMember.nationality || '',
      dob: existingMember.dob || '',
      email: existingMember.email || '',
      phone: existingMember.phone || '',
      is_married: existingMember.is_married || false,
      package_type: existingMember.package_type || 'Single',
      access_type: existingMember.access_type || 'Both',
      membership_type: isRenewal ? 'Renew' : (existingMember.membership_type || 'New'),
      spouse_name: existingMember.spouse_name || '',
      spouse_dob: existingMember.spouse_dob || '',
      remarks: existingMember.remarks || '',
      kids: existingMember.kids || []
    } : {
      membership_number: '',
      guest_name: '',
      category_id: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      discount: 0,
      check_no: '',
      is_married: false,
      package_type: 'Single',
      access_type: 'Both',
      membership_type: 'New',
      kids: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "kids"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Member | null>(null);

  const watchCategory = watch('category_id');
  const watchDiscount = watch('discount') || 0;
  const watchStartDate = watch('start_date');
  const watchPackageType = watch('package_type');
  const watchedMembershipNumber = watch('membership_number');
  const selectedCategory = categories.find(c => c.id === watchCategory);

  const handleReset = () => {
    setMatchedProfile(null);
    reset({
        membership_number: '',
        guest_name: '',
        category_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0,
        check_no: '',
        is_married: false,
        package_type: 'Single',
        access_type: 'Both',
        membership_type: 'New',
        kids: [],
        nationality: '',
        dob: '',
        email: '',
        phone: '',
        spouse_name: '',
        spouse_dob: '',
        remarks: ''
    });
  };

  useEffect(() => {
    if (existingMember && !isRenewal) return;

    if (!watchedMembershipNumber || watchedMembershipNumber.trim() === '') {
      if (matchedProfile) handleReset();
      return;
    }

    const found = members.find(m => m.membership_number === watchedMembershipNumber);
    if (found) {
      setMatchedProfile(found);
      setValue('guest_name', found.guest_name, { shouldValidate: true });
      setValue('nationality', found.nationality || '');
      setValue('dob', found.dob || '');
      setValue('email', found.email || '');
      setValue('phone', found.phone || '');
      setValue('is_married', found.is_married || false);
      setValue('spouse_name', found.spouse_name || '');
      setValue('spouse_dob', found.spouse_dob || '');
      setValue('package_type', found.package_type || 'Single');
      setValue('membership_type', 'Renew');
      setValue('kids', found.kids || []);
      
      if (categories.some(c => c.id === found.category_id)) {
        setValue('category_id', found.category_id);
      }
      
      const prevEnd = parseISO(found.current_end_date);
      const today = new Date();
      if (isAfter(prevEnd, today)) {
        setValue('start_date', format(addDays(prevEnd, 1), 'yyyy-MM-dd'));
      } else {
        setValue('start_date', format(today, 'yyyy-MM-dd'));
      }
    } else {
      setMatchedProfile(null);
      setValue('membership_type', 'New');
    }
  }, [watchedMembershipNumber, members, existingMember, isRenewal, setValue, reset, categories]);

  const onSubmit = async (values: MemberFormValues) => {
    if (!selectedCategory || !currentOutletId) return;
    setIsSubmitting(true);
    try {
      const startDate = parseISO(values.start_date);
      const originalEndDate = RevenueEngine.calculateOriginalEndDate(startDate, selectedCategory.duration_months);
      const netAmount = Math.max(0, selectedCategory.base_rate - values.discount);
      const dailyRate = RevenueEngine.calculateDailyRate(netAmount, startDate, originalEndDate);

      const memberData: Member = {
        ...values,
        id: crypto.randomUUID(),
        outlet_id: currentOutletId,
        original_end_date: format(originalEndDate, 'yyyy-MM-dd'),
        current_end_date: format(originalEndDate, 'yyyy-MM-dd'),
        actual_rate: selectedCategory.base_rate,
        net_amount: netAmount,
        daily_rate: dailyRate,
        status: MemberStatus.ACTIVE,
        created_at: new Date().toISOString()
      };

      if (existingMember && !isRenewal) {
        memberData.id = existingMember.id;
        memberData.created_at = existingMember.created_at;
        await db.updateMember(existingMember.id, memberData);
      } else {
        await db.addMember(memberData);
      }
      onSuccess(memberData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const financials = useMemo(() => {
    if (!selectedCategory || !watchStartDate) return null;
    const startDate = parseISO(watchStartDate);
    const originalEndDate = RevenueEngine.calculateOriginalEndDate(startDate, selectedCategory.duration_months);
    const netAmount = Math.max(0, selectedCategory.base_rate - watchDiscount);
    const dailyRate = RevenueEngine.calculateDailyRate(netAmount, startDate, originalEndDate);
    
    return {
      base: selectedCategory.base_rate,
      net: netAmount,
      expiry: format(originalEndDate, 'dd-MM-yyyy'),
      daily: dailyRate
    };
  }, [selectedCategory, watchDiscount, watchStartDate]);

  return (
    <Card className="max-w-4xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden border-slate-200/60 bg-white flex flex-col max-h-[92vh]">
      <CardHeader className="bg-[#1e1b4b] p-5 sticky top-0 z-[160] shadow-xl shrink-0">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                 <RefreshCcw className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                 <CardTitle className="text-xl font-black tracking-tight leading-tight text-white opacity-100">
                   {matchedProfile || isRenewal ? 'Process Re-Enrollment' : existingMember ? 'Modify Security Protocol' : 'Authorized Access Enrollment'}
                 </CardTitle>
                 <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-200 mt-0.5 opacity-70">Lifecycle Management Console</p>
              </div>
           </div>
           <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white">
             <X className="w-5 h-5" />
           </button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
        
        {matchedProfile && (
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[2rem] p-5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-[#bbf7d0] flex items-center justify-center text-[#15803d] shadow-sm">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-[#15803d]" fill="currentColor" />
                            <h4 className="text-[11px] font-black text-[#15803d] uppercase tracking-widest leading-none">Identity Matched</h4>
                        </div>
                        <p className="text-[10px] font-black text-[#166534] uppercase tracking-tight mt-1.5 opacity-90 leading-none">
                            Guest History: Active from <span className="underline decoration-2 underline-offset-4">{format(parseISO(matchedProfile.start_date), 'dd-MM-yyyy')}</span> to <span className="underline decoration-2 underline-offset-4">{format(parseISO(matchedProfile.current_end_date), 'dd-MM-yyyy')}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-full border border-[#bbf7d0] text-[9px] font-black text-[#15803d] uppercase tracking-widest shadow-sm">
                        {categories.find(c => c.id === matchedProfile.category_id)?.name || 'Standard Tier'}
                    </div>
                    <button 
                        type="button" 
                        onClick={handleReset} 
                        className="p-2 rounded-full bg-white border border-[#bbf7d0] text-[#15803d] hover:bg-[#bbf7d0] hover:text-white transition-all shadow-sm active:scale-90"
                        title="Reset Identification"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership No. / ID</label>
                <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600">
                        <UserSearch className="w-3.5 h-3.5" />
                    </div>
                    <input 
                        {...register('membership_number')}
                        className={`w-full h-11 pl-10 pr-10 rounded-xl border-2 text-sm font-black tracking-tight focus:outline-none transition-all shadow-sm ${errors.membership_number ? 'border-red-200 bg-red-50' : 'bg-indigo-50/30 border-indigo-50 group-focus-within:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5'}`}
                        placeholder="e.g. 127"
                    />
                    {watchedMembershipNumber && (
                        <button type="button" onClick={handleReset} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors">
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership Tier</label>
                <select 
                    {...register('category_id')}
                    className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[10px] font-black uppercase tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234f46e5%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:9px_9px] bg-[right_14px_center] bg-no-repeat"
                >
                    <option value="">SELECT PROTOCOL TIER...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Guest Profile Name</label>
                <input 
                    {...register('guest_name')}
                    className="w-full h-11 px-4 rounded-xl bg-[#eff6ff]/50 border-2 border-[#dbeafe] text-sm font-black tracking-tight text-slate-700 shadow-sm focus:outline-none"
                    placeholder="e.g. Mr. Amer Ahmad Mubarak"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Effective Start Date</label>
                <input type="date" {...register('start_date')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[10px] font-black tracking-tight" />
            </div>

            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Package Plan</label>
                <Select 
                    options={[{value: 'Single', label: 'Single'}, {value: 'Couple', label: 'Couple'}, {value: 'Family', label: 'Family'}]} 
                    {...register('package_type')} 
                    className="h-11 rounded-xl text-xs font-black uppercase"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Discount Allocation (ر.ق)</label>
                <input type="number" {...register('discount', { valueAsNumber: true })} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-sm font-black tracking-tight shadow-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Base Rate</span>
                  <p className="text-sm font-black text-slate-900 truncate">{financials ? formatMoney(financials.base) : '--'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Net Revenue</span>
                  <p className="text-sm font-black text-indigo-600 truncate">{financials ? formatMoney(financials.net) : '--'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Expected Expiry</span>
                  <p className="text-sm font-black text-slate-900 truncate">{financials ? financials.expiry : '--'}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Daily Accrual</span>
                  <p className="text-sm font-black text-emerald-600 truncate">{financials ? `${formatMoney(financials.daily)}/Day` : '--'}</p>
              </div>
          </div>

          {/* Dynamic Spouse Section */}
          {(watchPackageType === 'Couple' || watchPackageType === 'Family') && (
            <div className="bg-indigo-50/30 p-6 rounded-[2rem] border border-indigo-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-900">Spouse Particulars</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Spouse Full Name" {...register('spouse_name')} className="h-11 rounded-xl text-xs bg-white border-slate-100" placeholder="e.g. Ms. Sarah J." />
                    <Input label="Spouse Date of Birth" type="date" {...register('spouse_dob')} className="h-11 rounded-xl text-xs bg-white border-slate-100" />
                </div>
            </div>
          )}

          {/* Dynamic Kids Section */}
          {watchPackageType === 'Family' && (
            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-900">Child Dependents</h3>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => append({ name: '', dob: '' })}
                        className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-700 transition-colors"
                    >
                        <PlusCircle className="w-3.5 h-3.5" /> Add Child
                    </button>
                </div>
                
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end animate-in slide-in-from-left-2">
                            <div className="md:col-span-3">
                                <Input label={`Child ${index + 1} Name`} {...register(`kids.${index}.name` as const)} className="h-10 rounded-xl text-xs bg-white" placeholder="Full Name" />
                            </div>
                            <div className="md:col-span-3">
                                <Input label="Date of Birth" type="date" {...register(`kids.${index}.dob` as const)} className="h-10 rounded-xl text-xs bg-white" />
                            </div>
                            <div className="flex justify-center mb-1">
                                <button type="button" onClick={() => remove(index)} className="p-2.5 text-red-400 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl">
                                    <MinusCircle className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {fields.length === 0 && <p className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">No children registered. Use "Add Child" to expand.</p>}
                </div>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-500">
               <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Security & Demographics</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <Input label="Nationality" {...register('nationality')} className="h-10 rounded-xl text-xs" />
                  <Input label="Primary DOB" type="date" {...register('dob')} className="h-10 rounded-xl text-xs" />
                  <Select label="Access Context" options={[{value: 'Both', label: 'Pool & Spa'}, {value: 'Pool', label: 'Pool Only'}, {value: 'Spa', label: 'Spa Only'}]} {...register('access_type')} className="h-10 rounded-xl text-xs" />
               </div>
          </div>
        </form>
      </CardContent>

      <div className="bg-white border-t border-slate-100 p-5 sticky bottom-0 z-[160] shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.05)] shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <button type="button" onClick={onCancel} className="flex-1 h-12 rounded-xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95 border border-transparent hover:border-slate-100">
                Cancel
            </button>
            <button 
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || !selectedCategory}
                className={`flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-2 active:scale-95 ${!selectedCategory ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
            >
                {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : (matchedProfile || isRenewal ? 'Finalize Re-Enrollment' : existingMember ? 'Update Protocol' : 'Authorize Enrollment')}
            </button>
          </div>
      </div>
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
  onRenew 
}: { 
  member: Member, 
  categories: MembershipCategory[], 
  initialFreeze: boolean,
  getEffectiveStatus: (m: Member) => MemberStatus,
  onBack: () => void,
  onUpdate: () => void,
  onRenew: (m: Member) => void
}) => {
  const { formatMoney } = useSettings();
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [showFreezeForm, setShowFreezeForm] = useState(initialFreeze);
  const [newFreeze, setNewFreeze] = useState({ 
    start_date: format(new Date(), 'yyyy-MM-dd'), 
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd') 
  });
  const [isFreezing, setIsFreezing] = useState(false);
  const [deleteFreezeId, setDeleteFreezeId] = useState<string | null>(null);

  useEffect(() => {
    db.getFreezes(member.id).then(setFreezes);
  }, [member.id]);

  const handleAddFreeze = async () => {
    setIsFreezing(true);
    try {
      const start = parseISO(newFreeze.start_date);
      const end = parseISO(newFreeze.end_date);
      const days = differenceInCalendarDays(end, start) + 1;
      
      await db.addFreeze({
        id: crypto.randomUUID(),
        member_id: member.id,
        start_date: newFreeze.start_date,
        end_date: newFreeze.end_date,
        total_days: days
      });
      
      const updatedFreezes = await db.getFreezes(member.id);
      setFreezes(updatedFreezes);
      setShowFreezeForm(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsFreezing(false);
    }
  };

  const category = categories.find(c => c.id === member.category_id);
  const totalFrozenDays = freezes.reduce((sum, f) => sum + f.total_days, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#1e1b4b] text-white p-8">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-3xl font-black text-indigo-400">
                    {member.guest_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">{member.guest_name}</h2>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mt-1">ID: {member.membership_number}</p>
                    <div className="flex gap-2 mt-3">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/20 bg-white/10`}>
                        {getEffectiveStatus(member)}
                      </span>
                      <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/20 bg-white/10">
                        {category?.name}
                      </span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => onRenew(member)} variant="secondary" className="rounded-xl font-black text-[10px] uppercase h-10 px-6">Renew Now</Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Term Start</p>
                  <p className="font-black text-slate-900">{format(parseISO(member.start_date), 'dd-MM-yyyy')}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Contract End</p>
                  <p className="font-black text-slate-900">{format(parseISO(member.original_end_date), 'dd-MM-yyyy')}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active End (Deferred)</p>
                  <p className="font-black text-indigo-600">{format(parseISO(member.current_end_date), 'dd-MM-yyyy')}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue</p>
                  <p className="font-black text-emerald-600">{formatMoney(member.net_amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                <History className="w-5 h-5 text-indigo-600" /> Suspension History
              </h3>
              <Button onClick={() => setShowFreezeForm(true)} size="sm" className="rounded-xl font-black text-[10px] uppercase">
                <Plus className="w-4 h-4 mr-1" /> Add Freeze
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {freezes.length === 0 ? (
                <div className="py-20 text-center">
                  <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active suspensions found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                      <tr>
                        <th className="px-8 py-4">From</th>
                        <th className="px-8 py-4">To</th>
                        <th className="px-8 py-4">Total Days</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {freezes.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4 font-bold text-slate-700">{format(parseISO(f.start_date), 'dd-MM-yyyy')}</td>
                          <td className="px-8 py-4 font-bold text-slate-700">{format(parseISO(f.end_date), 'dd-MM-yyyy')}</td>
                          <td className="px-8 py-4 font-black text-indigo-600">{f.total_days} Days</td>
                          <td className="px-8 py-4 text-right">
                            <button onClick={() => setDeleteFreezeId(f.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg p-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Demographics & Detail</h4>
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Nationality</span>
                  <span className="text-[11px] font-black text-slate-900">{member.nationality || '--'}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Access Context</span>
                  <span className="text-[11px] font-black text-indigo-600">{member.access_type || 'Both'}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Phone</span>
                  <span className="text-[11px] font-black text-slate-900">{member.phone || '--'}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
                  <span className="text-[11px] font-black text-indigo-600 truncate max-w-[150px]">{member.email || '--'}</span>
               </div>
            </div>
          </Card>

          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg p-8 bg-indigo-50/50">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quota Utilization</h4>
            <div className="flex justify-between items-end mb-2">
               <span className="text-3xl font-black text-indigo-600 tracking-tighter">{totalFrozenDays}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ {category?.max_freeze_days || 0} Days</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
               <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${Math.min(100, (totalFrozenDays / (category?.max_freeze_days || 1)) * 100)}%` }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-500 mt-3 italic uppercase">Suspension allowance utilized from tier constraints.</p>
          </Card>
        </div>
      </div>

      {showFreezeForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <Card className="w-full max-w-sm rounded-[2rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <CardHeader className="bg-indigo-600 text-white p-6 relative">
                 <CardTitle className="text-xl font-black tracking-tight">Add Suspension</CardTitle>
                 <button onClick={() => setShowFreezeForm(false)} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <Input label="Start Date" type="date" value={newFreeze.start_date} onChange={e => setNewFreeze({...newFreeze, start_date: e.target.value})} className="h-12 rounded-xl" />
                 <Input label="End Date" type="date" value={newFreeze.end_date} onChange={e => setNewFreeze({...newFreeze, end_date: e.target.value})} className="h-12 rounded-xl" />
                 <Button onClick={handleAddFreeze} isLoading={isFreezing} className="w-full h-14 rounded-2xl font-black shadow-xl shadow-indigo-100 uppercase tracking-widest text-[11px]">Authorize Suspension</Button>
              </CardContent>
           </Card>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteFreezeId} 
        onClose={() => setDeleteFreezeId(null)} 
        onConfirm={async () => { 
          if (deleteFreezeId) { 
            await db.deleteFreeze(deleteFreezeId); 
            const f = await db.getFreezes(member.id); 
            setFreezes(f); 
            onUpdate(); 
            setDeleteFreezeId(null); 
          } 
        }} 
        title="Revoke Suspension" 
        description="Are you sure you want to delete this freeze record? This will adjust the member's end date immediately." 
        confirmText="Delete Freeze" 
        isDestructive={true} 
      />
    </div>
  );
};

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, formatMoney, hasPermission, settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All'>(MemberStatus.ACTIVE);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [instantContractMember, setInstantContractMember] = useState<Member | null>(null);

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

  const handleFormSuccess = () => {
    loadData();
    setView('list');
  };

  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');

  const getEffectiveStatus = (member: Member) => {
      if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING) {
          return member.status;
      }
      const end = parseISO(member.current_end_date);
      const today = startOfDay(new Date());
      if (isBefore(end, today)) {
          return MemberStatus.EXPIRED;
      }
      return MemberStatus.ACTIVE;
  };

  const handleAddNew = () => {
      if (!canCreate) return;
      setSelectedMember(null);
      setIsEditing(false);
      setIsRenewal(false);
      setView('form');
  };

  const handleRenew = (memberToRenew: Member) => {
    if (!canCreate) return;
    setSelectedMember(memberToRenew);
    setIsEditing(false);
    setIsRenewal(true);
    setView('form');
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = 
        m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.membership_number.toLowerCase().includes(searchTerm.toLowerCase());
      const effectiveStatus = getEffectiveStatus(m);
      let matchesStatus = statusFilter === 'All' ? true : effectiveStatus === statusFilter;
      const matchesCategory = categoryFilter === 'All' || m.category_id === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    return categories.map(cat => ({
        category: cat,
        members: filteredMembers.filter(m => m.category_id === cat.id)
    })).filter(g => g.members.length > 0 || (searchTerm === '' && statusFilter === 'All' && categoryFilter === 'All'));
  }, [categories, filteredMembers, searchTerm, statusFilter, categoryFilter]);

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Guest Directory</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Portfolio Management Console</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:min-w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors" />
                <input 
                    placeholder="Search name or ID..." 
                    className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:outline-none transition-all text-sm font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {canCreate && (
                <Button onClick={handleAddNew} className="h-12 px-6 rounded-2xl shadow-xl shadow-indigo-100 font-black tracking-tight">
                    <Plus className="w-5 h-5 mr-1" /> Add Members
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {groupedMembers.map((group) => (
                <Card key={group.category.id} className="overflow-hidden border-slate-200/60 shadow-sm">
                    <div className="bg-slate-50/80 px-4 md:px-8 py-4 border-b border-slate-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <div>
                              <h3 className="font-black text-slate-800 tracking-tight uppercase text-xs">{group.category.name}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base: {formatMoney(group.category.base_rate)}</p>
                            </div>
                        </div>
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                            {group.members.length} Records
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50/30">
                            <tr>
                                <th className="px-8 py-4">Membership #</th>
                                <th className="px-8 py-4">Guest Profile</th>
                                <th className="px-8 py-4">Status</th>
                                <th className="px-8 py-4">Package</th>
                                <th className="px-8 py-4">Expiry Date</th>
                                {(canEdit || canDelete || canCreate) && <th className="px-8 py-4 text-center">Operations</th>}
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((member) => (
                                <tr key={member.id} className="hover:bg-indigo-50/30 cursor-pointer transition-colors" onClick={() => { setSelectedMember(member); setView('detail'); }}>
                                <td className="px-8 py-5 font-black text-slate-900 tracking-tighter">{member.membership_number}</td>
                                <td className="px-8 py-5 font-bold text-slate-700">{member.guest_name}</td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border
                                    ${getEffectiveStatus(member) === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                      getEffectiveStatus(member) === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                      'bg-red-50 text-red-700 border-red-200'}`}>
                                    {getEffectiveStatus(member)}
                                    </span>
                                </td>
                                <td className="px-8 py-5"><span className="text-[10px] font-black uppercase tracking-tight text-indigo-600">{member.package_type || 'Single'}</span></td>
                                <td className="px-8 py-5 text-indigo-600 font-black tracking-tight">{format(parseISO(member.current_end_date), 'dd-MM-yyyy')}</td>
                                <td className="px-8 py-5">
                                    <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => setInstantContractMember(member)} className="p-2 text-slate-400 hover:text-indigo-600"><FileText className="w-4 h-4" /></button>
                                        <button onClick={() => handleRenew(member)} className="p-2 text-slate-400 hover:text-emerald-600"><RefreshCcw className="w-4 h-4" /></button>
                                        <button onClick={() => { setSelectedMember(member); setIsEditing(true); setIsRenewal(false); setView('form'); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => setDeleteId(member.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ))}
          </div>
          
          <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if (deleteId) { await db.deleteMember(deleteId); loadData(); setDeleteId(null); } }} title="Delete Member" description="Are you sure you want to delete this member? This action cannot be undone." confirmText="Delete Member" isDestructive={true} />
          {instantContractMember && <MembershipContract member={instantContractMember} category={categories.find(c => c.id === instantContractMember.category_id)} outlet={currentOutlet} property={currentProperty} settings={settings} formatMoney={formatMoney} onClose={() => setInstantContractMember(null)} />}
        </div>
      )}

      {view === 'form' && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto py-12">
            <div className="w-full max-w-4xl animate-in zoom-in-95 duration-300">
                <MemberForm categories={categories} members={members} existingMember={isEditing || isRenewal ? selectedMember : null} isRenewal={isRenewal} currentOutletId={currentOutlet?.id || ''} onCancel={() => setView('list')} onSuccess={handleFormSuccess} canCreate={canCreate} canEdit={canEdit} />
            </div>
        </div>
      )}

      {view === 'detail' && selectedMember && <MemberDetail member={selectedMember} categories={categories} initialFreeze={false} getEffectiveStatus={getEffectiveStatus} onBack={() => setView('list')} onUpdate={() => { loadData(); }} onRenew={handleRenew} />}
    </div>
  );
};

export default Members;
