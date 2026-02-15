
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
  Coins
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
  is_married: z.boolean(),
  package_type: z.enum(['Single', 'Couple', 'Family']),
  access_type: z.enum(['Pool', 'Spa', 'Both']),
  membership_type: z.enum(['New', 'Renew']),
  spouse_name: z.string().optional(),
  spouse_dob: z.string().optional(),
  remarks: z.string().optional(),
  kids: z.array(z.object({
    name: z.string(),
    dob: z.string()
  }))
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
  const [step, setStep] = useState(1);
  const { register, handleSubmit, watch, control, setValue, reset, trigger, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: existingMember ? {
      membership_number: existingMember.membership_number,
      guest_name: existingMember.guest_name,
      category_id: existingMember.category_id,
      start_date: isRenewal ? format(new Date(), 'yyyy-MM-dd') : existingMember.start_date,
      discount: isRenewal ? 0 : (existingMember.discount || 0),
      check_no: isRenewal ? '' : (existingMember.check_no || ''),
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
      nationality: '',
      dob: '',
      email: '',
      phone: '',
      is_married: false,
      package_type: 'Single',
      access_type: 'Both',
      membership_type: 'New',
      spouse_name: '',
      spouse_dob: '',
      remarks: '',
      kids: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "kids" });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Member | null>(null);

  const watchCategory = watch('category_id');
  const watchDiscount = watch('discount') || 0;
  const watchStartDate = watch('start_date');
  const watchedMembershipNumber = watch('membership_number');
  const watchIsMarried = watch('is_married');
  const watchPackage = watch('package_type');
  const selectedCategory = categories.find(c => c.id === watchCategory);

  const handleReset = () => {
    setMatchedProfile(null);
    reset({
        membership_number: '', guest_name: '', category_id: '', start_date: format(new Date(), 'yyyy-MM-dd'),
        discount: 0, check_no: '', is_married: false, package_type: 'Single', access_type: 'Both',
        membership_type: 'New', kids: [], nationality: '', dob: '', email: '', phone: '', spouse_name: '', spouse_dob: '', remarks: ''
    });
    setStep(1);
  };

  useEffect(() => {
    if (existingMember && !isRenewal) return;
    if (!watchedMembershipNumber || watchedMembershipNumber.trim() === '') { if (matchedProfile) handleReset(); return; }

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
      setValue('access_type', found.access_type || 'Both');
      setValue('membership_type', 'Renew');
      setValue('kids', found.kids || []);
      if (categories.some(c => c.id === found.category_id)) setValue('category_id', found.category_id);
      
      const prevEnd = parseISO(found.current_end_date);
      const today = new Date();
      if (isAfter(prevEnd, today)) setValue('start_date', format(addDays(prevEnd, 1), 'yyyy-MM-dd'));
      else setValue('start_date', format(today, 'yyyy-MM-dd'));
    } else {
      setMatchedProfile(null);
      setValue('membership_type', 'New');
    }
  }, [watchedMembershipNumber, members, existingMember, isRenewal, setValue, categories]);

  const handleNext = async () => {
      const isStep1Valid = await trigger(['membership_number', 'guest_name', 'category_id', 'start_date']);
      if (isStep1Valid) setStep(2);
  };

  const onSubmit = async (values: MemberFormValues) => {
    if (!selectedCategory || !currentOutletId) return;
    if ((isRenewal || !existingMember) && !canCreate) return;
    if (existingMember && !isRenewal && !canEdit) return;

    setIsSubmitting(true);
    try {
      const startDate = parseISO(values.start_date);
      const originalEndDate = RevenueEngine.calculateOriginalEndDate(startDate, selectedCategory.duration_months);
      const netAmount = Math.max(0, selectedCategory.base_rate - values.discount);
      const dailyRate = RevenueEngine.calculateDailyRate(netAmount, startDate, originalEndDate);

      const memberData: Member = {
        ...values, id: crypto.randomUUID(), outlet_id: currentOutletId,
        original_end_date: format(originalEndDate, 'yyyy-MM-dd'),
        current_end_date: format(originalEndDate, 'yyyy-MM-dd'),
        actual_rate: selectedCategory.base_rate, net_amount: netAmount, daily_rate: dailyRate,
        status: MemberStatus.ACTIVE, created_at: existingMember && !isRenewal ? existingMember.created_at : new Date().toISOString()
      };

      if (existingMember && !isRenewal) {
        memberData.id = existingMember.id;
        await db.updateMember(existingMember.id, memberData);
      } else {
        await db.addMember(memberData);
      }
      onSuccess(memberData);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const financials = useMemo(() => {
    if (!selectedCategory || !watchStartDate) return null;
    const startDate = parseISO(watchStartDate);
    const originalEndDate = RevenueEngine.calculateOriginalEndDate(startDate, selectedCategory.duration_months);
    const netAmount = Math.max(0, selectedCategory.base_rate - watchDiscount);
    return { base: selectedCategory.base_rate, net: netAmount, expiry: format(originalEndDate, 'dd-MM-yyyy') };
  }, [selectedCategory, watchDiscount, watchStartDate]);

  return (
    <Card className="max-w-4xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden border-slate-200/60 bg-white flex flex-col max-h-[92vh]">
      <CardHeader className="bg-[#1e1b4b] p-5 sticky top-0 z-[160] shadow-xl shrink-0">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50/20 flex items-center justify-center border border-indigo-400/30">
                {step === 1 ? <RefreshCcw className="w-5 h-5 text-indigo-400" /> : <User className="w-5 h-5 text-indigo-400" />}
              </div>
              <div>
                 <CardTitle className="text-xl font-black tracking-tight leading-tight text-white opacity-100">
                    {step === 1 ? 'Step 1: Enrollment Core' : 'Step 2: Guest Specifics'}
                 </CardTitle>
                 <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-200 mt-0.5 opacity-70">
                    {matchedProfile || isRenewal ? 'Re-Enrollment Protocol' : 'Authorized Access Creation'}
                 </p>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 mr-6">
                 <div className={`w-2.5 h-2.5 rounded-full ${step === 1 ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-indigo-900'}`}></div>
                 <div className={`w-8 h-0.5 rounded-full bg-indigo-900`}></div>
                 <div className={`w-2.5 h-2.5 rounded-full ${step === 2 ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-indigo-900'}`}></div>
              </div>
              <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
           </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
        {matchedProfile && step === 1 && (
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[2rem] p-5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 mb-2 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-[#bbf7d0] flex items-center justify-center text-[#15803d] shadow-sm"><History className="w-5 h-5" /></div>
                    <div>
                        <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-[#15803d]" fill="currentColor" /><h4 className="text-[11px] font-black text-[#15803d] uppercase tracking-widest leading-none">Record Located</h4></div>
                        <p className="text-[10px] font-black text-[#166534] uppercase tracking-tight mt-1.5 opacity-90 leading-none">Security context valid until <span className="underline decoration-2 underline-offset-4">{format(parseISO(matchedProfile.current_end_date), 'dd-MM-yyyy')}</span></p>
                    </div>
                </div>
            </div>
        )}

        {step === 1 ? (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership ID #</label>
                  <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600"><UserSearch className="w-3.5 h-3.5" /></div>
                      <input {...register('membership_number')} className={`w-full h-11 pl-10 pr-10 rounded-xl border-2 text-sm font-black focus:outline-none transition-all ${errors.membership_number ? 'border-red-200 bg-red-50' : 'bg-indigo-50/30 border-indigo-50 group-focus-within:border-indigo-600'}`} placeholder="ID Number" />
                  </div>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Membership Protocol Tier</label>
                  <select {...register('category_id')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[10px] font-black uppercase shadow-sm">
                      <option value="">SELECT PROTOCOL...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Guest Identification Name</label>
                  <input {...register('guest_name')} className="w-full h-11 px-4 rounded-xl bg-[#eff6ff]/50 border-2 border-[#dbeafe] text-sm font-black tracking-tight text-slate-700 shadow-sm" placeholder="Full Identity" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Authorized Start Date</label>
                  <input type="date" {...register('start_date')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[10px] font-black tracking-tight" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Discount Amount</label>
                  <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600"><Coins className="w-3.5 h-3.5" /></div>
                      <input type="number" step="0.01" {...register('discount', { valueAsNumber: true })} className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-50 text-sm font-black focus:outline-none focus:border-indigo-600 transition-all bg-white" placeholder="0.00" />
                  </div>
              </div>
              <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Check / Ref Number</label>
                  <input {...register('check_no')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[10px] font-black tracking-tight" placeholder="N/A" />
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Base Valuation</span>
                    <p className="text-sm font-black text-slate-900 truncate">{financials ? formatMoney(financials.base) : '--'}</p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Net Recognition</span>
                    <p className="text-sm font-black text-indigo-600 truncate">{financials ? formatMoney(financials.net) : '--'}</p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 min-w-0 shadow-sm">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Planned Expiry</span>
                    <p className="text-sm font-black text-slate-900 truncate">{financials ? financials.expiry : '--'}</p>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Audit Trail Remarks</label>
                <textarea {...register('remarks')} className="w-full h-24 p-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all resize-none" placeholder="Administrative notes..."></textarea>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Nationality</label>
                  <input {...register('nationality')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-xs font-black shadow-sm" placeholder="Country" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Date of Birth</label>
                  <input type="date" {...register('dob')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-xs font-black shadow-sm" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Primary Contact Phone</label>
                  <input {...register('phone')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-xs font-black shadow-sm" placeholder="Mobile #" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Digital Correspondence (Email)</label>
                  <input {...register('email')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-xs font-black shadow-sm" placeholder="guest@example.com" />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-6">
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Relationship Status</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl h-11 border border-slate-200">
                    <button type="button" onClick={() => setValue('is_married', false)} className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${!watchIsMarried ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Single</button>
                    <button type="button" onClick={() => setValue('is_married', true)} className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${watchIsMarried ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Married</button>
                  </div>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Package Context</label>
                  <select {...register('package_type')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[9px] font-black uppercase shadow-sm">
                    <option value="Single">Single</option>
                    <option value="Couple">Couple</option>
                    <option value="Family">Family</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-900 uppercase tracking-widest ml-1">Authorized Access Zone</label>
                  <select {...register('access_type')} className="w-full h-11 px-4 rounded-xl bg-white border-2 border-slate-50 text-[9px] font-black uppercase shadow-sm">
                    <option value="Both">Both (Pool & Spa)</option>
                    <option value="Pool">Pool Only</option>
                    <option value="Spa">Spa Only</option>
                  </select>
               </div>
            </div>

            {(watchIsMarried || watchPackage !== 'Single') && (
              <div className="p-6 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 space-y-5 animate-in fade-in duration-500 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Heart className="w-3 h-3 text-red-500" /> Spouse Identity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input {...register('spouse_name')} label="Spouse Full Name" className="h-11 rounded-xl text-xs font-bold" />
                  <Input type="date" {...register('spouse_dob')} label="Spouse DOB" className="h-11 rounded-xl text-xs font-bold" />
                </div>
              </div>
            )}

            {watchPackage === 'Family' && (
              <div className="p-6 bg-indigo-50/30 rounded-[2rem] border-2 border-indigo-100/50 space-y-5 shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2"><Baby className="w-4 h-4 text-indigo-600" /> Dependent Records</h4>
                  <Button type="button" onClick={() => append({ name: '', dob: '' })} variant="outline" size="sm" className="rounded-xl border-indigo-200 text-indigo-600 h-8 px-4 font-black text-[9px] uppercase"><Plus className="w-3 h-3 mr-1" /> Add Child</Button>
                </div>
                <div className="space-y-3">
                  {fields.length === 0 ? (
                      <div className="py-8 text-center bg-white/50 rounded-xl border border-dashed border-indigo-200">
                          <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">No dependent data provided.</p>
                      </div>
                  ) : fields.map((item, index) => (
                    <div key={item.id} className="flex gap-3 items-end animate-in slide-in-from-left-2 duration-300 bg-white p-3 rounded-xl border border-indigo-100">
                      <div className="flex-1">
                        <label className="text-[7px] font-black uppercase text-indigo-300 ml-1 mb-1 block">Full Name</label>
                        <input {...register(`kids.${index}.name`)} placeholder="Child Name" className="w-full h-10 px-3 rounded-lg border border-slate-100 bg-slate-50 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <div className="w-40">
                        <label className="text-[7px] font-black uppercase text-indigo-300 ml-1 mb-1 block">DOB</label>
                        <input type="date" {...register(`kids.${index}.dob`)} className="w-full h-10 px-3 rounded-lg border border-slate-100 bg-slate-50 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <button type="button" onClick={() => remove(index)} className="p-3 text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <div className="bg-white border-t border-slate-100 p-5 sticky bottom-0 z-[160] shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.05)] shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            {step === 1 ? (
              <>
                <button type="button" onClick={onCancel} className="flex-1 h-12 rounded-xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Discard Changes</button>
                <button type="button" onClick={handleNext} disabled={!selectedCategory} className={`flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-2 ${!selectedCategory ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}>Next Architecture <ChevronRight className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl text-indigo-600 border-2 border-indigo-100 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4" /> Previous Context</button>
                <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="flex-[2] h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-indigo-200 transition-all">
                  {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : (matchedProfile || isRenewal ? 'Commit Re-Enrollment' : existingMember ? 'Sync Identity Protocol' : 'Authorize Provisioning')}
                </button>
              </>
            )}
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
  onRenew,
  onPrint,
  allMembers
}: { 
  member: Member, 
  categories: MembershipCategory[], 
  initialFreeze: boolean,
  getEffectiveStatus: (m: Member) => MemberStatus,
  onBack: () => void,
  onUpdate: () => void,
  onRenew: (m: Member) => void,
  onPrint: (m: Member) => void,
  allMembers: Member[]
}) => {
  const { user } = useAuth();
  const { formatMoney, hasPermission } = useSettings();
  const [activeViewMember, setActiveViewMember] = useState<Member>(member);
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [showFreezeForm, setShowFreezeForm] = useState(initialFreeze);
  const [editingFreeze, setEditingFreeze] = useState<Freeze | null>(null);
  const [newFreeze, setNewFreeze] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd') });
  const [isFreezing, setIsFreezing] = useState(false);
  const [deleteFreezeId, setDeleteFreezeId] = useState<string | null>(null);

  useEffect(() => { setActiveViewMember(member); }, [member]);
  useEffect(() => { db.getFreezes(activeViewMember.id).then(setFreezes); }, [activeViewMember.id]);

  const lifecycle = useMemo(() => {
    return allMembers
        .filter(m => m.membership_number === member.membership_number)
        .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [allMembers, member.membership_number]);

  const canRenew = user && hasPermission(user.role_id, 'members:renew');
  const canFreeze = user && hasPermission(user.role_id, 'members:freeze');
  const canPrint = user && hasPermission(user.role_id, 'members:print_contract');
  const canViewContact = user && hasPermission(user.role_id, 'members:view_contact_info');

  const maskInfo = (info?: string) => {
    if (canViewContact) return info || '--';
    if (!info) return '--';
    return info.substring(0, 3) + '****' + (info.length > 7 ? info.substring(info.length - 2) : '');
  };

  const quota = useMemo(() => {
      const totalUsed = freezes.reduce((sum, f) => sum + f.total_days, 0);
      const category = categories.find(c => c.id === activeViewMember.category_id);
      const allowance = category?.max_freeze_days || 0;
      const percentage = allowance > 0 ? Math.min(100, (totalUsed / allowance) * 100) : 0;
      return { used: totalUsed, total: allowance, percentage };
  }, [freezes, categories, activeViewMember.category_id]);

  const requestedFreezeDays = useMemo(() => {
    const start = parseISO(newFreeze.start_date);
    const end = parseISO(newFreeze.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    return Math.max(0, differenceInCalendarDays(end, start) + 1);
  }, [newFreeze.start_date, newFreeze.end_date]);

  const remainingAllowance = useMemo(() => {
      const baseUsed = editingFreeze ? quota.used - editingFreeze.total_days : quota.used;
      return Math.max(0, quota.total - baseUsed);
  }, [quota.used, quota.total, editingFreeze]);

  const isOverQuota = requestedFreezeDays > remainingAllowance;

  const handleSaveFreeze = async () => {
    if (!canFreeze || isOverQuota) return;
    setIsFreezing(true);
    try {
      if (editingFreeze) {
          await db.updateFreeze(editingFreeze.id, { start_date: newFreeze.start_date, end_date: newFreeze.end_date, total_days: requestedFreezeDays });
      } else {
          await db.addFreeze({ id: crypto.randomUUID(), member_id: activeViewMember.id, start_date: newFreeze.start_date, end_date: newFreeze.end_date, total_days: requestedFreezeDays });
      }
      const updatedFreezes = await db.getFreezes(activeViewMember.id);
      setFreezes(updatedFreezes);
      setShowFreezeForm(false);
      setEditingFreeze(null);
      onUpdate();
    } catch (err) { console.error(err); } finally { setIsFreezing(false); }
  };

  const handleDeleteFreeze = async () => {
    if (!deleteFreezeId || !canFreeze) return;
    try {
        await db.deleteFreeze(deleteFreezeId);
        const updatedFreezes = await db.getFreezes(activeViewMember.id);
        setFreezes(updatedFreezes);
        setDeleteFreezeId(null);
        onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Directory</button>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Lifecycle Sidebar */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden h-fit">
                <CardHeader className="p-6 bg-slate-900 text-white">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Lifecycle Timeline</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                    {lifecycle.map((cycle, idx) => {
                        const isCurrent = activeViewMember.id === cycle.id;
                        const status = getEffectiveStatus(cycle);
                        return (
                            <button 
                                key={cycle.id}
                                onClick={() => setActiveViewMember(cycle)}
                                className={`w-full text-left p-4 rounded-2xl transition-all border flex items-center justify-between group ${isCurrent ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                            >
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCurrent ? 'text-indigo-200' : 'text-slate-400'}`}>Cycle {lifecycle.length - idx}</p>
                                    <p className={`text-xs font-black ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{format(parseISO(cycle.start_date), 'MMM yyyy')}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${isCurrent ? 'bg-white/10 text-white border-white/20' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{status}</span>
                                    {!isCurrent && <ArrowRightCircle className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 mt-1 ml-auto" />}
                                </div>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg p-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Security Context</h4>
                <div className="space-y-6">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Phone</span><span className="text-[11px] font-black text-slate-900 flex items-center gap-2">{maskInfo(activeViewMember.phone)}{!canViewContact && <EyeOff className="w-3 h-3 text-slate-300" />}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Email</span><span className="text-[11px] font-black text-indigo-600 flex items-center justify-end gap-2">{maskInfo(activeViewMember.email)}{!canViewContact && <EyeOff className="w-3 h-3 text-slate-300" />}</span></div>
                </div>
            </Card>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#1e1b4b] text-white p-8">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-3xl font-black text-indigo-400">{activeViewMember.guest_name.charAt(0)}</div>
                  <div><h2 className="text-3xl font-black tracking-tighter">{activeViewMember.guest_name}</h2><p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mt-1">ID: {activeViewMember.membership_number}</p></div>
                </div>
                <div className="flex gap-2">
                  {canPrint && <Button onClick={() => onPrint(activeViewMember)} variant="outline" className="rounded-xl font-black text-[10px] uppercase h-10 px-6 border-white/20 text-white hover:bg-white/10 hover:border-white/40 shadow-xl"><Printer className="w-4 h-4 mr-2" /> Agreement</Button>}
                  {canRenew && activeViewMember.id === lifecycle[0].id && <Button onClick={() => onRenew(activeViewMember)} variant="secondary" className="rounded-xl font-black text-[10px] uppercase h-10 px-6 shadow-xl">Renew Now</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Term Start</p><p className="font-black text-slate-900">{format(parseISO(activeViewMember.start_date), 'dd-MM-yyyy')}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Deferred Expiry</p><p className="font-black text-indigo-600">{format(parseISO(activeViewMember.current_end_date), 'dd-MM-yyyy')}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Recognition</p><p className="font-black text-emerald-600">{formatMoney(activeViewMember.net_amount)}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p><span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${getEffectiveStatus(activeViewMember) === MemberStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{getEffectiveStatus(activeViewMember)}</span></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="md:col-span-2 rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden h-fit">
                <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3"><History className="w-5 h-5 text-indigo-600" /> Suspension Ledger</h3>
                  {canFreeze && activeViewMember.id === lifecycle[0].id && <Button onClick={() => { setEditingFreeze(null); setNewFreeze({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd') }); setShowFreezeForm(true); }} size="sm" className="rounded-xl font-black text-[10px] uppercase"><Plus className="w-4 h-4 mr-1" /> Add Freeze</Button>}
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50"><tr><th className="px-8 py-4">From</th><th className="px-8 py-4">To</th><th className="px-8 py-4">Total Days</th>{canFreeze && <th className="px-8 py-4 text-right">Actions</th>}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {freezes.length === 0 ? (
                            <tr><td colSpan={canFreeze ? 4 : 3} className="px-8 py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No active suspensions in this cycle.</td></tr>
                        ) : freezes.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-4 font-bold text-slate-700">{format(parseISO(f.start_date), 'dd-MM-yyyy')}</td>
                            <td className="px-8 py-4 font-bold text-slate-700">{format(parseISO(f.end_date), 'dd-MM-yyyy')}</td>
                            <td className="px-8 py-4 font-black text-indigo-600">{f.total_days} Days</td>
                            {canFreeze && activeViewMember.id === lifecycle[0].id && <td className="px-8 py-4 text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingFreeze(f); setNewFreeze({ start_date: f.start_date, end_date: f.end_date }); setShowFreezeForm(true); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit3 className="w-4 h-4"/></button>
                                    <button onClick={() => setDeleteFreezeId(f.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg p-8 bg-[#f8faff] h-fit">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Cycle Suspension Cap</h4>
                <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black ${quota.used > quota.total ? 'text-red-600' : 'text-indigo-600'}`}>{quota.used}</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">/ {quota.total} Days</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)] ${quota.used > quota.total ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${quota.percentage}%` }}
                        />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-6 leading-relaxed">
                        Deferral allowance recognized for this specific billing cycle.
                    </p>
                </div>
              </Card>
          </div>
        </div>
      </div>

      {showFreezeForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <Card className="w-full max-w-md rounded-[2.5rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <CardHeader className={`${isOverQuota ? 'bg-red-600' : editingFreeze ? 'bg-slate-900' : 'bg-indigo-600'} text-white p-6 relative transition-colors duration-300`}>
                  <CardTitle className="text-xl font-black tracking-tight">{editingFreeze ? 'Adjust Suspension' : 'Add Suspension'}</CardTitle>
                  <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-1">Lifecycle Deferral Logic</p>
                  <button onClick={() => { setShowFreezeForm(false); setEditingFreeze(null); }} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Start Date" type="date" value={newFreeze.start_date} onChange={e => setNewFreeze({...newFreeze, start_date: e.target.value})} className="h-12 rounded-xl" />
                    <Input label="End Date" type="date" value={newFreeze.end_date} onChange={e => setNewFreeze({...newFreeze, end_date: e.target.value})} className="h-12 rounded-xl" />
                  </div>
                  
                  <div className={`p-4 rounded-2xl border transition-all ${isOverQuota ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration Recognition</span>
                        <span className={`text-sm font-black ${isOverQuota ? 'text-red-600' : 'text-indigo-600'}`}>{requestedFreezeDays} Days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining Allowance</span>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{remainingAllowance} Days Available</span>
                      </div>
                  </div>

                  {isOverQuota && (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 animate-in shake duration-300">
                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                              <h4 className="text-[10px] font-black text-red-800 uppercase tracking-widest">Quota Violation Detected</h4>
                              <p className="text-[10px] text-red-700/70 font-medium leading-relaxed">The requested suspension duration exceeds the member's current tier limit. Adjust dates to proceed.</p>
                          </div>
                      </div>
                  )}

                  <Button 
                    onClick={handleSaveFreeze} 
                    isLoading={isFreezing} 
                    disabled={isOverQuota || requestedFreezeDays === 0}
                    className={`w-full h-14 rounded-2xl font-black uppercase text-[11px] transition-all shadow-xl ${isOverQuota ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'shadow-indigo-200'}`}
                  >
                      {editingFreeze ? 'Commit Adjustments' : 'Authorize Suspension'}
                  </Button>
              </CardContent>
           </Card>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteFreezeId} 
        onClose={() => setDeleteFreezeId(null)} 
        onConfirm={handleDeleteFreeze} 
        title="Revoke Suspension Record" 
        description="Are you sure you want to delete this suspension entry? The member's expiry date will be recalculated to reflect the returned quota." 
        confirmText="Authorize Deletion" 
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
  const [statusFilter, setStatusFilter] = useState<'All' | MemberStatus>(MemberStatus.ACTIVE);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupingKey, setGroupingKey] = useState<'category' | 'none'>('category');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [instantContractMember, setInstantContractMember] = useState<Member | null>(null);

  useEffect(() => { if (currentOutlet) loadData(); }, [currentOutlet]);
  
  useEffect(() => {
    const memberIdFromState = location.state?.selectedMemberId;
    if (memberIdFromState && members.length > 0) {
      const memberToView = members.find(m => m.id === memberIdFromState);
      if (memberToView) { setSelectedMember(memberToView); setView('detail'); navigate('.', { replace: true, state: {} }); }
    }
  }, [members, location.state, navigate]);

  const loadData = async () => {
    if (!currentOutlet) return;
    const [m, c] = await Promise.all([db.getMembers(currentOutlet.id), db.getCategories(currentOutlet.id)]);
    
    // Sort categories by duration_months numerically (1, 3, 6, 12), then name for logical sequencing in dropdowns
    const sortedCats = [...c].sort((a, b) => {
        const durA = Number(a.duration_months) || 0;
        const durB = Number(b.duration_months) || 0;
        if (durA !== durB) return durA - durB;
        return a.name.localeCompare(b.name);
    });

    setMembers(m); 
    setCategories(sortedCats);
    if (selectedMember) { const updated = m.find(mem => mem.id === selectedMember.id); if (updated) setSelectedMember(updated); }
  };

  const handleFormSuccess = () => { loadData(); setView('list'); };

  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');
  const canPrint = user && hasPermission(user.role_id, 'members:print_contract');
  const canRenew = user && hasPermission(user.role_id, 'members:renew');
  const canViewContact = user && hasPermission(user.role_id, 'members:view_contact_info');

  const getEffectiveStatus = (member: Member) => {
      if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING) return member.status;
      const end = parseISO(member.current_end_date);
      const today = startOfDay(new Date());
      return isBefore(end, today) ? MemberStatus.EXPIRED : MemberStatus.ACTIVE;
  };

  const filteredMembers = useMemo(() => {
    // We only show the latest record for each membership_number in the directory list
    const latestByNumber: Record<string, Member> = {};
    members.forEach(m => {
        if (!latestByNumber[m.membership_number] || isAfter(parseISO(m.start_date), parseISO(latestByNumber[m.membership_number].start_date))) {
            latestByNumber[m.membership_number] = m;
        }
    });

    return Object.values(latestByNumber).filter(m => {
        const status = getEffectiveStatus(m);
        const matchesSearch = m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             m.membership_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || status === statusFilter;
        const matchesCat = categoryFilter === 'All' || m.category_id === categoryFilter;
        return matchesSearch && matchesStatus && matchesCat;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    if (groupingKey === 'none') return { 'Directory Records': filteredMembers };
    const groups: Record<string, Member[]> = {};
    // Ensure group keys are based on sorted categories
    categories.forEach(cat => {
        groups[cat.name] = [];
    });
    
    filteredMembers.forEach(m => {
        const catName = categories.find(c => c.id === m.category_id)?.name || 'Uncategorized';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(m);
    });

    // Remove empty groups to clean up view
    Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) delete groups[key];
    });

    return groups;
  }, [filteredMembers, groupingKey, categories]);

  const handlePrint = (member: Member) => {
      setInstantContractMember(member);
  };

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10"><div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100"><Users className="w-6 h-6" /></div><div><h1 className="text-2xl font-black text-slate-900 tracking-tighter">Guest Directory</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Authorized Portfolio Control</p></div></div>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto relative z-10"><div className="relative group flex-1 md:min-w-[320px] w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" /><input placeholder="Search ID or Name..." className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><div className="flex gap-2 w-full md:w-auto"><Select options={[{ value: 'All', label: 'All Statuses' }, ...Object.values(MemberStatus).map(s => ({ value: s, label: s }))]} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="h-12 w-full md:w-40 rounded-xl font-bold text-[11px] uppercase" /><Select options={[{ value: 'All', label: 'All Tiers' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-12 w-full md:w-40 rounded-xl font-bold text-[11px] uppercase" /></div>{canCreate && <Button onClick={() => { setSelectedMember(null); setIsEditing(false); setIsRenewal(false); setView('form'); }} className="h-12 px-8 rounded-2xl font-black whitespace-nowrap shadow-xl shadow-indigo-100"><Plus className="w-5 h-5 mr-2" /> New Member</Button>}</div>
          </div>
          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/50 mb-2"><button onClick={() => setGroupingKey('category')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${groupingKey === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid className="w-3.5 h-3.5" /> Group by Tier</button><button onClick={() => setGroupingKey('none')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${groupingKey === 'none' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><ListFilter className="w-3.5 h-3.5" /> Flat List</button></div>
          <Card className="overflow-hidden border-slate-200/60 shadow-xl rounded-[2.5rem] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50 border-b">
                  <tr>
                    <th className="px-8 py-5">Membership #</th>
                    <th className="px-8 py-5">Guest Profile</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Contact Scope</th>
                    <th className="px-8 py-5">Deferred Expiry</th>
                    <th className="px-8 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.keys(groupedMembers).length === 0 ? (
                    <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold">Zero records detected in current scope.</td></tr>
                  ) : Object.keys(groupedMembers).map(groupName => (
                    <React.Fragment key={groupName}>
                      {groupingKey !== 'none' && (
                        <tr className="bg-indigo-50/50 border-y border-slate-100 border-l-4 border-l-indigo-600">
                          <td colSpan={6} className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <Tag className="w-4 h-4 text-indigo-700" />
                              <span className="text-[12px] font-black uppercase tracking-widest text-indigo-950">{groupName}</span>
                              <span className="text-[9px] font-black text-indigo-400 uppercase bg-white px-2.5 py-1 rounded-lg border border-indigo-100 shadow-sm">{groupedMembers[groupName].length} Records</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {groupedMembers[groupName].map((member) => { 
                        const status = getEffectiveStatus(member); 
                        return (
                          <tr key={member.id} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer" onClick={() => { setSelectedMember(member); setView('detail'); }}>
                            <td className="px-8 py-6">
                              <span className="font-black text-slate-900 tracking-tight text-base">{member.membership_number}</span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">{member.guest_name.charAt(0)}</div>
                                <span className="font-black text-slate-700 tracking-tight uppercase text-xs">{member.guest_name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${status === MemberStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === MemberStatus.FROZEN ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{status}</span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                {canViewContact ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span>{member.phone}</span>
                                    <span className="text-[9px] lowercase opacity-60">{member.email || 'no email'}</span>
                                  </div>
                                ) : (
                                  <span className="flex items-center gap-1.5 opacity-50 bg-slate-100 px-2 py-1 rounded-md text-[9px] uppercase tracking-widest">
                                    <EyeOff className="w-3 h-3" /> Encrypted Access
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-indigo-600 font-black text-sm">{format(parseISO(member.current_end_date), 'dd-MM-yyyy')}</span>
                                {member.current_end_date !== member.original_end_date && (
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest line-through">Org: {format(parseISO(member.original_end_date), 'dd-MM-yyyy')}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {canPrint && <button onClick={() => handlePrint(member)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Print Contract"><FileText className="w-4 h-4" /></button>}
                                {canRenew && <button onClick={() => { setSelectedMember(member); setIsEditing(false); setIsRenewal(true); setView('form'); }} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Process Renewal"><RefreshCcw className="w-4 h-4" /></button>}
                                {canEdit && <button onClick={() => { setSelectedMember(member); setIsEditing(true); setIsRenewal(false); setView('form'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Modify Identity"><Edit2 className="w-4 h-4" /></button>}
                                {canDelete && <button onClick={() => setDeleteId(member.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Purge Record"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <ConfirmationModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if (deleteId && canDelete) { await db.deleteMember(deleteId); loadData(); } }} title="Delete Member Record" description="Irreversible removal of guest profile." confirmText="Execute Purge" isDestructive={true} />
        </div>
      )}

      {view === 'form' && (<div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto py-12"><div className="w-full max-w-4xl animate-in zoom-in-95 duration-300"><MemberForm categories={categories} members={members} existingMember={isEditing || isRenewal ? selectedMember : null} isRenewal={isRenewal} currentOutletId={currentOutlet?.id || ''} onCancel={() => setView('list')} onSuccess={handleFormSuccess} canCreate={canCreate} canEdit={canEdit} /></div></div>)}
      {view === 'detail' && selectedMember && <MemberDetail member={selectedMember} allMembers={members} categories={categories} initialFreeze={false} getEffectiveStatus={getEffectiveStatus} onBack={() => setView('list')} onUpdate={() => { loadData(); }} onRenew={() => { setIsRenewal(true); setView('form'); }} onPrint={(m) => handlePrint(m)} />}
      
      {/* Agreement modal rendering at top level ensures visibility regardless of active view */}
      {instantContractMember && (
          <MembershipContract 
              member={instantContractMember} 
              category={categories.find(c => c.id === instantContractMember.category_id)} 
              outlet={currentOutlet} 
              property={currentProperty} 
              settings={settings} 
              formatMoney={formatMoney} 
              onClose={() => setInstantContractMember(null)} 
          />
      )}
    </div>
  );
};

export default Members;
