import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, Button, Input } from '../../components/ui';
import { 
  X, User, ShieldCheck, RotateCcw, Plus, Layers,
  Coins, Heart, AlertTriangle, RefreshCcw,
  Calendar, Zap, Mail, Phone, Globe,
  CheckCircle2, Command, ChevronDown, Receipt, List
} from 'lucide-react';
import { db } from '../../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Staff } from '../../types';
import { RevenueEngine } from '../../services/revenueEngine';
import { format, addDays, parse, isAfter, differenceInDays, startOfDay } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  try {
    return parse(dateString, 'dd-MM-yyyy', new Date());
  } catch (e) {
    return new Date();
  }
};

const memberSchema = z.object({
  membership_number: z.string().min(1, "ID required"),
  guest_name: z.string().min(2, "Name required"),
  category_id: z.string().min(1, "Tier required"),
  start_date: z.string().min(1, "Start date required"),
  discount: z.coerce.number().min(0),
  check_no: z.string().optional().nullable(),
  sales_rep_id: z.string().optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  package_type: z.enum(['Single', 'Couple', 'Family']),
  access_type: z.enum(['Pool', 'Spa', 'Both']),
  membership_type: z.enum(['New', 'Renew']),
  spouse_name: z.string().optional().nullable(),
  spouse_dob: z.string().optional().nullable(),
  kids: z.array(z.object({
    name: z.string().min(1, "Name required"),
    dob: z.string().min(1, "DOB required")
  })).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface MemberEnrollmentFormProps {
  existingMember: Member | null;
  isEditing: boolean;
  isRenewal: boolean;
  categories: MembershipCategory[];
  staff: Staff[];
  onCancel: () => void;
  onSuccess: () => void;
}

const MemberEnrollmentForm: React.FC<MemberEnrollmentFormProps> = ({
  existingMember, isEditing, isRenewal, categories, staff, onCancel, onSuccess
}) => {
  const { currentOutlet, formatMoney } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<Member[]>([]);

  const calculateDefaultStartDate = (expiryDateStr: string) => {
    const expiry = parseISO(expiryDateStr);
    const today = startOfDay(new Date());
    if (isAfter(expiry, today)) {
        return format(addDays(expiry, 1), 'yyyy-MM-dd');
    }
    return format(today, 'yyyy-MM-dd');
  };

  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema as any),
    defaultValues: (existingMember) ? {
        ...existingMember,
        phone: existingMember.phone ?? '',
        email: existingMember.email ?? '',
        nationality: existingMember.nationality ?? '',
        dob: existingMember.dob ?? '',
        membership_type: isRenewal ? 'Renew' : (existingMember.membership_type || 'New'),
        start_date: isRenewal ? calculateDefaultStartDate(existingMember.current_end_date) : existingMember.start_date,
        check_no: existingMember.check_no ?? '', 
        discount: existingMember.discount ?? 0,
        spouse_name: existingMember.spouse_name ?? '',
        spouse_dob: existingMember.spouse_dob ?? '',
        kids: existingMember.kids ?? [],
        remarks: existingMember.remarks ?? '',
        package_type: existingMember.package_type || 'Single',
        access_type: existingMember.access_type || 'Both',
    } : {
      membership_number: '',
      guest_name: '',
      category_id: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      discount: 0,
      membership_type: 'New',
      package_type: 'Single',
      access_type: 'Both',
      spouse_name: '',
      spouse_dob: '',
      kids: [],
      remarks: '',
      check_no: '',
      dob: '',
      phone: '',
      email: '',
      nationality: ''
    }
  });

  const { fields: kidsFields, append: appendKid, remove: removeKid } = useFieldArray({
    control,
    name: "kids"
  });

  const membershipNo = watch('membership_number');
  const categoryId = watch('category_id');
  const startDateStr = watch('start_date');
  const discount = watch('discount');

  const clearFormExceptID = useCallback(() => {
    setValue('guest_name', '');
    setValue('phone', '');
    setValue('email', '');
    setValue('nationality', '');
    setValue('dob', '');
    setValue('category_id', '');
    setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    setValue('package_type', 'Single');
    setValue('access_type', 'Both');
    setValue('spouse_name', '');
    setValue('spouse_dob', '');
    setValue('kids', []);
    setValue('remarks', '');
    setValue('check_no', '');
    setValue('discount', 0);
  }, [setValue]);

  // Handle Identity Matching & Auto-Start Date Calculation
  useEffect(() => {
    if (!isEditing && !isRenewal) {
      if (membershipNo && membershipNo.length >= 2 && currentOutlet) {
        db.getMemberHistory(membershipNo, currentOutlet.id).then(foundMembers => {
          if (foundMembers.length > 0) {
              setMatchedMembers(foundMembers);
              // Use most recent for defaults
              const found = foundMembers[0];
              setValue('guest_name', found.guest_name);
              setValue('phone', found.phone || '');
              setValue('email', found.email || '');
              setValue('nationality', found.nationality || '');
              setValue('dob', found.dob || '');
              setValue('package_type', found.package_type || 'Single');
              setValue('access_type', found.access_type || 'Both');
              setValue('spouse_name', found.spouse_name || '');
              setValue('spouse_dob', found.spouse_dob || '');
              setValue('remarks', found.remarks || '');
              setValue('category_id', found.category_id);
              
              const newStart = calculateDefaultStartDate(found.current_end_date);
              setValue('start_date', newStart);
          } else {
              setMatchedMembers([]);
          }
        });
      } else if (!membershipNo || membershipNo.length === 0) {
          setMatchedMembers([]);
          clearFormExceptID();
      }
    }
  }, [membershipNo, isEditing, isRenewal, setValue, clearFormExceptID]);

  useEffect(() => {
      if (isRenewal && existingMember && matchedMembers.length === 0) {
          setMatchedMembers([existingMember]);
      }
  }, [isRenewal, existingMember, matchedMembers.length]);

  const selectedCategory = categories.find(c => c.id === categoryId);
  const baseRate = selectedCategory?.base_rate || 0;
  const netAmount = Math.max(0, baseRate - (Number(discount) || 0));
  
  const recognition = useMemo(() => {
    if (!startDateStr || !selectedCategory) return { expiry: null, daily: 0 };
    const start = parseISO(startDateStr);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    const daily = RevenueEngine.calculateDailyRate(netAmount, start, end);
    return { expiry: format(end, 'yyyy-MM-dd'), daily };
  }, [startDateStr, selectedCategory, netAmount]);

  const onFormSubmit = async (data: MemberFormValues) => {
    if (!currentOutlet) return;
    if (!recognition.expiry) {
        setSubmitError("Failed to calculate expiry date. Please check Start Date and Tier.");
        return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    
    const sanitizedData = { ...data };
    if (sanitizedData.dob === '') sanitizedData.dob = null;
    if (sanitizedData.spouse_dob === '') sanitizedData.spouse_dob = null;

    const isUpdate = !!(isEditing && !isRenewal && existingMember);
    const payload: Member = {
      ...(isUpdate ? existingMember : {}),
      ...sanitizedData,
      id: isUpdate ? existingMember!.id : crypto.randomUUID(),
      outlet_id: currentOutlet.id,
      original_end_date: recognition.expiry,
      current_end_date: recognition.expiry,
      actual_rate: baseRate,
      net_amount: netAmount,
      daily_rate: recognition.daily,
      status: MemberStatus.ACTIVE
    } as Member;

    try {
        if (isUpdate) await db.updateMember(existingMember!.id, payload);
        else await db.addMember(payload);
        setTimeout(() => onSuccess(), 500);
    } catch (e: any) { 
        setSubmitError(e.message || "Sync failure.");
        setIsSubmitting(false);
    }
  };

  const handleManualReset = () => {
    setMatchedMembers([]);
    reset({
        membership_number: '',
        guest_name: '',
        category_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0,
        membership_type: 'New',
        package_type: 'Single',
        access_type: 'Both',
        spouse_name: '',
        spouse_dob: '',
        remarks: '',
        check_no: '',
        dob: '',
        phone: '',
        email: '',
        nationality: ''
    });
  };

  const getMatchBanner = () => {
    if (matchedMembers.length === 0) return null;
    const matchedMember = matchedMembers[0];
    const expiry = parseISO(matchedMember.current_end_date);
    const today = startOfDay(new Date());
    const daysDiff = differenceInDays(expiry, today);
    const statusText = daysDiff < 0 
        ? `EXPIRED ${Math.abs(daysDiff)} DAYS AGO` 
        : `ACTIVE (EXPIRES IN ${daysDiff} DAYS)`;
    const cat = categories.find(c => c.id === matchedMember.category_id);

    const themeClass = isRenewal ? "bg-[#f0fdf4] border-emerald-100" : "bg-[#f0f7ff] border-indigo-100";
    const iconClass = isRenewal ? "text-emerald-600 fill-emerald-600" : "text-indigo-600 fill-indigo-600";
    const titleClass = isRenewal ? "text-emerald-900" : "text-indigo-900";
    const badgeClass = isRenewal ? "text-emerald-600 border-emerald-100" : "text-indigo-600 border-indigo-100";

    return (
        <div className={`mx-10 mt-6 p-5 rounded-[1.8rem] border flex items-center justify-between animate-in slide-in-from-top-2 duration-300 shadow-sm ${themeClass}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-white/50">
                    <List className={`w-5 h-5 ${iconClass}`} />
                </div>
                <div>
                    <h4 className={`text-[11px] font-black uppercase tracking-tight ${titleClass}`}>Lifecycle Identity Matched</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                        Records: {matchedMembers.length} Found &bull; Current Expiry: {format(parseISO(matchedMember.current_end_date), 'dd MMM yyyy')} ({statusText})
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className={`bg-white px-4 py-2 rounded-full text-[8px] font-black uppercase border shadow-sm flex items-center gap-3 ${badgeClass}`}>
                    <span>{cat?.name || 'Standard Membership'}</span>
                    {!isRenewal && (
                      <button type="button" onClick={handleManualReset} className="p-1 hover:bg-slate-50 rounded-full transition-colors">
                          <RotateCcw className="w-3 h-3 text-slate-300" />
                      </button>
                    )}
                </div>
            </div>
        </div>
    );
  };

  return (
    <Card className="max-w-[850px] mx-auto rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] overflow-hidden bg-white border-none animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-[#1e2335] px-10 py-8 text-white flex items-center justify-between">
        <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                {isRenewal ? <RotateCcw className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
                    {isRenewal ? 'Renew Membership' : isEditing ? 'Edit Profile' : 'New Enrollment'}
                </h1>
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mt-1.5 opacity-80">Lifecycle Management Console</p>
            </div>
        </div>
        <button onClick={onCancel} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-90">
            <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {getMatchBanner()}

      <form onSubmit={handleSubmit(onFormSubmit as any)} className="p-10 space-y-12">
        
        <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><User className="w-4 h-4" /></div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Member Core Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership No. / ID *</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('membership_number')} disabled={isRenewal} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-black tracking-widest focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm uppercase shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="e.g. TCP0070" />
                    </div>
                    {errors.membership_number && <p className="text-[8px] font-bold text-red-500 ml-2 uppercase">{errors.membership_number.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Profile Name *</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <User className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('guest_name')} disabled={isRenewal} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="Legal Full Name" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Phone className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('phone')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm" placeholder="+974 ..." />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Mail className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('email')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm" placeholder="guest@identity.com" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nationality</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Globe className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('nationality')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm" placeholder="Country" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input type="date" {...register('dob')} className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                    </div>
                </div>
            </div>
        </section>

        <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><Layers className="w-4 h-4" /></div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Tier & Recognition Logic</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership Tier *</label>
                    <div className="relative">
                        <select {...register('category_id')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm cursor-pointer appearance-none">
                            <option value="">Select Category...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective Start Date *</label>
                    <div className="relative group">
                        <input type="date" {...register('start_date')} className="w-full h-14 px-4 pr-12 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Package Context</label>
                    <div className="relative">
                        <select {...register('package_type')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm cursor-pointer appearance-none">
                            <option value="Single">Single Enrollment</option>
                            <option value="Couple">Couple Manifest</option>
                            <option value="Family">Family Portfolio</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                
                {(watch('package_type') === 'Couple' || watch('package_type') === 'Family') && (
                    <>
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Spouse/Partner Name</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                                    <User className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                                </div>
                                <input {...register('spouse_name')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm placeholder:text-slate-200" placeholder="Partner's Full Name" />
                            </div>
                        </div>
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Spouse/Partner DOB</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                                    <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                                </div>
                                <input type="date" {...register('spouse_dob')} className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                            </div>
                        </div>
                    </>
                )}

                {watch('package_type') === 'Family' && (
                    <div className="col-span-1 md:col-span-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Family Members / Kids</label>
                            <Button type="button" onClick={() => appendKid({ name: '', dob: '' })} variant="outline" size="sm" className="h-8 text-[10px] rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                                <Plus className="w-3 h-3 mr-1" /> Add Member
                            </Button>
                        </div>
                        {kidsFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group">
                                <button type="button" onClick={() => removeKid(index)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-all opacity-0 group-hover:opacity-100">
                                    <X className="w-3 h-3" />
                                </button>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white group-focus-within/input:bg-indigo-50 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-300 group-focus-within/input:text-indigo-500" />
                                        </div>
                                        <input {...register(`kids.${index}.name` as const)} className="w-full h-12 pl-14 pr-4 rounded-xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm placeholder:text-slate-200" placeholder="Child's Name" />
                                    </div>
                                    {errors.kids?.[index]?.name && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.kids[index]?.name?.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white group-focus-within/input:bg-indigo-50 transition-colors">
                                            <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within/input:text-indigo-500" />
                                        </div>
                                        <input type="date" {...register(`kids.${index}.dob` as const)} className="w-full h-12 pl-14 pr-12 rounded-xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                                    </div>
                                    {errors.kids?.[index]?.dob && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.kids[index]?.dob?.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Protocol</label>
                    <div className="relative">
                        <select {...register('access_type')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm cursor-pointer appearance-none">
                            <option value="Both">Both (Pool + Spa)</option>
                            <option value="Pool">Pool Restricted</option>
                            <option value="Spa">Spa Restricted</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference / Check No. (Audit)</label>
                    <input {...register('check_no')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase placeholder:text-slate-200" placeholder="----" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount Allocation ({formatMoney(0).split(' ')[0]})</label>
                    <div className="relative">
                        <input type="number" {...register('discount')} className="w-full h-14 px-4 pr-12 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm" />
                        <Receipt className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200" />
                    </div>
                </div>
            </div>
        </section>

        <div className="bg-[#f8fafc] rounded-[2.5rem] p-10 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-inner border border-slate-100/50">
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Base Rate</p>
                <p className="text-base font-black text-slate-900 tracking-tight leading-none">{formatMoney(baseRate)}</p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Revenue</p>
                <p className="text-base font-black text-indigo-600 tracking-tight leading-none">{formatMoney(netAmount)}</p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Expected Expiry</p>
                <p className="text-base font-black text-slate-900 tracking-tight leading-none">
                    {recognition.expiry ? format(parseISO(recognition.expiry), 'dd MMM yyyy') : '---'}
                </p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Daily Accrual</p>
                <div className="flex items-baseline gap-1">
                    <p className="text-base font-black text-emerald-600 tracking-tight leading-none">{formatMoney(recognition.daily)}</p>
                    <span className="text-[8px] font-black text-emerald-500/50 uppercase">/Day</span>
                </div>
            </div>
        </div>

        {submitError && (
            <div className="p-5 bg-red-50 border-2 border-red-500/20 rounded-2xl flex items-start gap-4 animate-in shake duration-500 shadow-lg shadow-red-100/50">
                <div className="p-2 bg-red-100 rounded-xl shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-[11px] font-black text-red-700 uppercase tracking-tight">Deployment Failure</p>
                    <p className="text-[10px] font-bold text-red-500 uppercase leading-relaxed">
                        {submitError}
                    </p>
                </div>
            </div>
        )}

        <div className="flex gap-5 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 h-16 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 transition-all hover:bg-slate-100 flex items-center justify-center gap-3 active:scale-95">
                <Command className="w-4 h-4 opacity-30" /> Cancel
            </button>
            <Button type="submit" isLoading={isSubmitting} className="flex-[2] h-16 rounded-[1.8rem] font-black text-[13px] uppercase tracking-[0.1em] bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3">
                {isRenewal ? 'Commit Renewal' : isEditing ? 'Save Profile Changes' : 'Confirm Enrollment'} <Command className="w-4 h-4 opacity-50" />
            </Button>
        </div>
      </form>
    </Card>
  );
};

export default MemberEnrollmentForm;