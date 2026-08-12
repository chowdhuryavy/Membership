import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useForm, SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, Button, Input } from '../../components/ui';
import { 
  X, User, ShieldCheck, RotateCcw, Plus, Layers,
  Coins, Heart, AlertTriangle, RefreshCcw,
  Calendar, Zap, Mail, Phone, Globe,
  CheckCircle2, Command, ChevronDown, Receipt, List, UserPlus
} from 'lucide-react';
import { db } from '../../services/mockSupabase';
import { emailService } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';
import { Member, MembershipCategory, MemberStatus, Staff, MembershipType } from '../../types';
import { RevenueEngine } from '../../services/revenueEngine';
import { format, addDays, parse, isAfter, differenceInDays, startOfDay, parseISO } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

const memberSchema = z.object({
  membership_number: z.string().min(1, "ID required"),
  guest_name: z.string().min(2, "Name required"),
  membership_type_id: z.string().optional().nullable(),
  category_id: z.string().min(1, "Membership tier required"),
  start_date: z.string().min(1, "Start date required"),
  discount: z.union([z.string(), z.number()]).transform((v) => Number(v) || 0),
  check_no: z.string().optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  package_type: z.enum(['Single', 'Couple', 'Double', 'Family']),
  access_type: z.enum(['Pool', 'Spa', 'Both']),
  membership_type: z.enum(['New', 'Renew']),
  spouse_name: z.string().optional().nullable(),
  spouse_dob: z.string().optional().nullable(),
  spouse_id_card_url: z.string().optional().nullable(),
  referrer_name: z.string().optional().nullable(),
  calculate_referral_incentive: z.boolean().optional().default(false),
  kids: z.array(z.object({
    name: z.string().min(1, "Name required"),
    dob: z.string().min(1, "DOB required"),
    id_card_url: z.string().optional().nullable()
  })).optional().nullable(),
  remarks: z.string().optional().nullable(),
  id_card_url: z.string().optional().nullable(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface MemberEnrollmentFormProps {
  existingMember: Member | null;
  isEditing: boolean;
  isRenewal: boolean;
  categories: MembershipCategory[];
  membershipTypes: MembershipType[];
  selectedTypeId: string | 'all';
  onTypeChange: (id: string | 'all') => void;
  staff: Staff[];
  allMembers: Member[];
  onCancel: () => void;
  onSuccess: () => void;
}

const MemberEnrollmentForm: React.FC<MemberEnrollmentFormProps> = ({
  existingMember, isEditing, isRenewal, categories, membershipTypes, selectedTypeId, onTypeChange, staff, allMembers, onCancel, onSuccess
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { currentOutlet, formatMoney, setPageLoading, currency } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<Member[]>([]);
  const [showIncentivePrompt, setShowIncentivePrompt] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<MemberFormValues | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const signatureRef = useRef<SignatureCanvas>(null);
  const [signatureMethod, setSignatureMethod] = useState<'pad' | 'qr' | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const signatureIdRef = useRef<string | null>(null);
  const [isQrScanned, setIsQrScanned] = useState(false);
  const [isGuestSigning, setIsGuestSigning] = useState(false);

  useEffect(() => {
    if (showSignatureModal && signatureMethod === 'qr' && signatureIdRef.current) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/temp-signature/${signatureIdRef.current}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.signature) {
                        setSignature(data.signature);
                        setShowSignatureModal(false);
                        setSignatureMethod(null);
                        clearInterval(interval);
                        if (pendingSubmitData) processSubmit(pendingSubmitData);
                    }
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [showSignatureModal, signatureMethod, pendingSubmitData]);

  const initiateSignature = (data: MemberFormValues) => {
    setPendingSubmitData(data);
    setShowSignatureModal(true);
    setSignatureMethod(null);
  };

  const handleSignatureMethodSelect = (method: 'pad' | 'qr') => {
    setSignatureMethod(method);
    if (method === 'qr') {
        const id = crypto.randomUUID();
        signatureIdRef.current = id;
        const name = watch('guest_name');
        const categoryId = watch('category_id');
        const cat = sortedCategories.find(c => c.id === categoryId);
        const tier = cat?.name || 'Standard';
        const price = cat?.base_rate || 0;
        setQrUrl(`${window.location.origin}/#/signature/${id}?name=${encodeURIComponent(name || 'Guest')}&tier=${encodeURIComponent(tier)}&price=${encodeURIComponent(price)}`);
    }
  };

  const handleSignatureSave = () => {
    if (signatureRef.current) {
        setSignature(signatureRef.current.toDataURL());
        setShowSignatureModal(false);
    }
  };

  const handleSignatureClear = () => {
    signatureRef.current?.clear();
    setSignature(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Accept image/* and application/pdf
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only images and PDFs are allowed.');
      return;
    }
    // Simulate upload by converting to base64
    const reader = new FileReader();
    reader.onloadend = () => {
        setValue(fieldName as any, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
        membership_type_id: existingMember.membership_type_id || (selectedTypeId !== 'all' ? selectedTypeId : ''),
        phone: existingMember.phone ?? '',
        email: existingMember.email ?? '',
        nationality: existingMember.nationality ?? '',
        dob: existingMember.dob ?? '',
        calculate_referral_incentive: existingMember.referrer_name ? !existingMember.referrer_name.startsWith('[NO-INC]') : false,
        membership_type: isRenewal ? 'Renew' : (existingMember.membership_type || 'New'),
        start_date: isRenewal ? calculateDefaultStartDate(existingMember.current_end_date) : existingMember.start_date,
        check_no: isRenewal ? '' : (existingMember.check_no ?? ''), 
        discount: existingMember.discount ?? 0,
        spouse_name: existingMember.spouse_name ?? '',
        spouse_dob: existingMember.spouse_dob ?? '',
        kids: existingMember.kids ?? [],
        remarks: existingMember.remarks ?? '',
        package_type: existingMember.package_type || 'Single',
        access_type: existingMember.access_type || 'Both',
        referrer_name: isRenewal ? '' : (existingMember.referrer_name || '').replace(/^\[NO-INC\]\s*/i, ''),
    } : {
      membership_number: '',
      guest_name: '',
      membership_type_id: selectedTypeId !== 'all' ? selectedTypeId : '',
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
      nationality: '',
      calculate_referral_incentive: false,
      referrer_name: '',
    }
  });

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (a.duration_months || 0) - (b.duration_months || 0));
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === watch('category_id'));
  }, [categories, watch('category_id')]);

  const { fields: kidsFields, append: appendKid, remove: removeKid } = useFieldArray({
    control,
    name: "kids"
  });

  const membershipNo = watch('membership_number');
  const guestName = watch('guest_name');
  const membershipTypeId = watch('membership_type_id');
  const categoryId = watch('category_id');
  const startDateStr = watch('start_date');
  const discount = watch('discount');

  const clearFormExceptID = useCallback(() => {
    setValue('guest_name', '');
    setValue('phone', '');
    setValue('email', '');
    setValue('nationality', '');
    setValue('dob', '');
    setValue('membership_type_id', selectedTypeId !== 'all' ? selectedTypeId : '');
    setValue('category_id', '');
    console.log("clearFormExceptID called"); setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    setValue('package_type', 'Single');
    setValue('access_type', 'Both');
    setValue('spouse_name', '');
    setValue('spouse_dob', '');
    setValue('kids', []);
    setValue('remarks', '');
    setValue('check_no', '');
    setValue('discount', 0);
    setValue('calculate_referral_incentive', false);
    setValue('referrer_name', '');
  }, [setValue]);

  const setMemberDefaults = (found: Member) => {
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
    setValue('membership_type_id', found.membership_type_id || '');
    setValue('category_id', found.category_id);
    setValue('membership_number', found.membership_number);
    setValue('calculate_referral_incentive', false);
    setValue('referrer_name', '');
    setValue('check_no', '');
    
    const newStart = calculateDefaultStartDate(found.current_end_date);
    console.log("setMemberDefaults called"); setValue('start_date', newStart);
  };

  // Handle Identity Matching & Auto-Start Date Calculation
  useEffect(() => {
    if (!isEditing && !isRenewal) {
      if (membershipNo && membershipNo.length >= 2 && currentOutlet) {
        db.getMemberHistory(membershipNo, currentOutlet.id).then(foundMembers => {
          if (foundMembers.length > 0) {
              const sorted = [...foundMembers].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
              setMatchedMembers(sorted);
              setMemberDefaults(sorted[0]);
          } else {
              setMatchedMembers([]);
          }
        });
      } else if (!membershipNo || membershipNo.length === 0) {
          setMatchedMembers([]);
      }
    }
  }, [membershipNo, isEditing, isRenewal, setValue, clearFormExceptID, currentOutlet]);

  useEffect(() => {
    if (!isEditing && !isRenewal && guestName && guestName.length >= 3) {
      const found = (allMembers || []).filter(m => m.guest_name.toLowerCase().includes(guestName.toLowerCase()));
      if (found.length > 0) {
        const sorted = [...found].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        setMatchedMembers(sorted);
        setMemberDefaults(sorted[0]);
      } else {
        setMatchedMembers([]);
        // Don't clear form here to allow typing
      }
    }
  }, [guestName, isEditing, isRenewal, allMembers]);

  useEffect(() => {
      if (isRenewal && existingMember && matchedMembers.length === 0) {
          setMatchedMembers([existingMember]);
      }
  }, [isRenewal, existingMember, matchedMembers.length]);

  const baseRate = selectedCategory?.base_rate || 0;
  const netAmount = isSuperAdmin ? (baseRate - (Number(discount) || 0)) : Math.max(0, baseRate - (Number(discount) || 0));
  
  const recognition = useMemo(() => {
    if (!startDateStr) return { expiry: null, daily: 0 };
    if (!selectedCategory) {
        if (isSuperAdmin) {
            const start = parseISO(startDateStr);
            return { expiry: format(start, 'yyyy-MM-dd'), daily: netAmount };
        }
        return { expiry: null, daily: 0 };
    }
    const start = parseISO(startDateStr);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    const daily = RevenueEngine.calculateDailyRate(netAmount, start, end);
    return { expiry: format(end, 'yyyy-MM-dd'), daily };
  }, [startDateStr, selectedCategory, netAmount, isSuperAdmin]);

  const currentReferrerName = watch('referrer_name');

  useEffect(() => {
     if (!currentReferrerName?.trim()) {
         setValue('calculate_referral_incentive', false);
     }
  }, [currentReferrerName, setValue]);

  const handleIncentiveChoice = async (calculateIncentive: boolean) => {
    setShowIncentivePrompt(false);
    if (pendingSubmitData) {
        const newData = { ...pendingSubmitData, calculate_referral_incentive: calculateIncentive };
        setPendingSubmitData(null);
        await processSubmit(newData);
    }
  };

  const onFormError = (errors: any) => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
        setSubmitError(`Validation Error: ${errors[firstErrorKey].message} (${firstErrorKey})`);
    } else {
        setSubmitError("Please fill all required fields correctly.");
    }
  };

  const onFormSubmit = async (data: MemberFormValues) => {
    if (!signature) {
        initiateSignature(data);
        return;
    }

    if (data.referrer_name && data.referrer_name.trim().length > 0 && !data.calculate_referral_incentive) {
        setPendingSubmitData(data);
        setShowIncentivePrompt(true);
        return;
    }
    await processSubmit(data);
  };

  const processSubmit = async (data: MemberFormValues) => {
    if (data.referrer_name && data.referrer_name.trim().length > 0) {
      if (data.calculate_referral_incentive) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-in slide-in-from-top-2 fade-in duration-300' : 'animate-out fade-out slide-out-to-top-2 duration-200'} max-w-sm w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex overflow-hidden ring-1 ring-white/10`}>
            <div className="flex-none w-12 bg-indigo-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 w-0 p-3.5">
              <div className="flex items-start">
                <div className="ml-1 flex-1">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Incentives Active</p>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed">Referral incentives will be processed for this enrollment.</p>
                </div>
              </div>
            </div>
          </div>
        ), { duration: 4000 });
      } else {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-in slide-in-from-top-2 fade-in duration-300' : 'animate-out fade-out slide-out-to-top-2 duration-200'} max-w-sm w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex overflow-hidden ring-1 ring-white/10`}>
             <div className="flex-none w-12 bg-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-50" />
            </div>
            <div className="flex-1 w-0 p-3.5">
              <div className="flex items-start">
                <div className="ml-1 flex-1">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none mb-1">Incentives Bypassed</p>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed">Referral incentives will NOT be calculated.</p>
                </div>
              </div>
            </div>
          </div>
        ), { duration: 4000 });
      }
    }

    if (!currentOutlet) return;
    if (!recognition.expiry) {
        setSubmitError("Failed to calculate expiry date. Please check Start Date and Tier.");
        return;
    }
    setIsSubmitting(true);
    setPageLoading(true);
    setSubmitError(null);
    
    const sanitizedData = { ...data } as any;
    delete sanitizedData.calculate_referral_incentive;

    if (!data.calculate_referral_incentive && sanitizedData.referrer_name) {
       sanitizedData.referrer_name = '[NO-INC] ' + sanitizedData.referrer_name;
    }

    if (sanitizedData.dob === '') sanitizedData.dob = null;
    if (sanitizedData.spouse_dob === '') sanitizedData.spouse_dob = null;
    if (sanitizedData.membership_type_id === '') sanitizedData.membership_type_id = null;
    if (sanitizedData.category_id === '') sanitizedData.category_id = null;

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
      original_net_amount: netAmount,
      daily_rate: recognition.daily,
      status: MemberStatus.ACTIVE,
      member_signature: signature
    } as Member;

    try {
        if (isUpdate) await db.updateMember(existingMember!.id, payload);
        else await db.addMember(payload);

        toast.success('Member agreement saved and email notification dispatched.');

        setTimeout(() => {
            setPageLoading(false);
            onSuccess();
        }, 500);
    } catch (e: any) { 
        setSubmitError(e.message || "Sync failure.");
        setIsSubmitting(false);
        setPageLoading(false);
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
        nationality: '',
        calculate_referral_incentive: false,
        referrer_name: ''
    });
  };

  const getMatchBanner = () => {
    if (matchedMembers.length === 0) return null;
    const matchedMember = matchedMembers[0];
    const expiry = parseISO(matchedMember.current_end_date);
    const today = startOfDay(new Date());
    const daysDiff = differenceInDays(expiry, today);
    const isActive = daysDiff >= 0;
    
    const statusText = isActive 
        ? `ACTIVE (EXPIRES IN ${daysDiff} DAYS)`
        : `EXPIRED ${Math.abs(daysDiff)} DAYS AGO`;
        
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
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                            Records: {matchedMembers.length} Found &bull; Current Expiry: {format(parseISO(matchedMember.current_end_date), 'dd MMM yyyy')}
                        </p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest flex items-center gap-1.5 ${
                            isActive 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-red-50 text-red-600 border-red-100"
                        }`}>
                            <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                            {statusText}
                        </span>
                    </div>
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
    <Card className="max-w-[1200px] mx-auto rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] overflow-hidden bg-white border-none animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-[#1e2335] px-10 py-8 text-white flex items-center justify-between">
        <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                {isRenewal ? <RotateCcw className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
                    {isRenewal ? 'Renew Membership' : isEditing ? 'Edit Profile' : 'New Enrollment'}
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] opacity-80">Lifecycle Management Console</p>
                    {membershipTypeId && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-indigo-400 opacity-50"></span>
                            <div className="px-2 py-0.5 bg-emerald-500/20 rounded-md border border-emerald-500/30">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                                    {membershipTypes.find(t => t.id === membershipTypeId)?.name}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
        <button onClick={onCancel} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-90">
            <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {getMatchBanner()}

      <form onSubmit={handleSubmit(onFormSubmit as any, onFormError)} className="p-8 space-y-10">
        
        <section className="space-y-4">
            <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><User className="w-4 h-4" /></div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Member Core Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Membership No. / ID *</label>
                        {matchedMembers.length > 0 && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                differenceInDays(parseISO(matchedMembers[0].current_end_date), startOfDay(new Date())) >= 0
                                ? "text-emerald-600 bg-emerald-50 border border-emerald-100"
                                : "text-red-600 bg-red-50 border border-red-100"
                            }`}>
                                {differenceInDays(parseISO(matchedMembers[0].current_end_date), startOfDay(new Date())) >= 0 ? 'Currently Active' : 'Expired Record'}
                            </span>
                        )}
                    </div>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('membership_number')} disabled={isRenewal} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-black tracking-widest focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm uppercase shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="e.g. TCP0070" />
                    </div>
                    {errors.membership_number && <p className="text-[8px] font-bold text-red-500 ml-2 uppercase">{errors.membership_number.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Guest Profile Name *</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <User className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('guest_name')} disabled={isRenewal || matchedMembers.length > 0} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="Legal Full Name" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Contact Phone</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Phone className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('phone')} disabled={isRenewal || matchedMembers.length > 0} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="+974 ..." />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Mail className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('email')} disabled={isRenewal || matchedMembers.length > 0} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="guest@identity.com" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Nationality</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Globe className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('nationality')} disabled={isRenewal || matchedMembers.length > 0} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="Country" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">ID Card Upload</label>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'id_card_url')} className="w-full h-14 p-3 rounded-2xl bg-white border border-slate-200 text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Date of Birth</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input type="date" {...register('dob')} disabled={isRenewal || matchedMembers.length > 0} className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase disabled:opacity-50 disabled:bg-slate-50" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Referral Name</label>
                    <div className="relative group mb-1">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                            <User className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                        </div>
                        <input {...register('referrer_name')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm disabled:opacity-50 disabled:bg-slate-50" placeholder="Referral Name" />
                    </div>
                    {currentReferrerName?.trim() && (
                      <label className="flex items-center gap-2 cursor-pointer mt-2 pl-1 w-max">
                          <input 
                              type="checkbox" 
                              {...register('calculate_referral_incentive')}
                              onChange={(e) => {
                                  register('calculate_referral_incentive').onChange(e);
                                  if (e.target.checked) {
                                      toast.success("Referral incentive calculation enabled", { duration: 2000 });
                                  } else {
                                      toast("Referral incentive calculation disabled", { duration: 2000, icon: 'ℹ️' });
                                  }
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Process Incentive?</span>
                      </label>
                    )}
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><Layers className="w-4 h-4" /></div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Tier & Recognition Logic</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Membership Tier *</label>
                    <div className="relative">
                        <select 
                            {...register('category_id')} 
                            onChange={(e) => {
                                const catId = e.target.value;
                                register('category_id').onChange(e);
                                const cat = sortedCategories.find(c => c.id === catId);
                                if (cat) {
                                    setValue('membership_type_id', cat.membership_type_id || '');
                                }
                            }}
                            className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm cursor-pointer appearance-none"
                        >
                            <option value="">Select Category...</option>
                            {sortedCategories.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {formatMoney(c.base_rate)}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    {selectedCategory?.privileges && selectedCategory.privileges.length > 0 && (
                        <div className="mt-2 p-4 rounded-xl bg-indigo-50 border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h4 className="text-[9px] font-black text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Included Privileges
                            </h4>
                            <ul className="grid grid-cols-1 gap-2">
                                {selectedCategory.privileges.map((p, i) => {
                                    let pObj: any = p;
                                    if (typeof p === 'string') {
                                        try { pObj = JSON.parse(p); } catch {}
                                    }
                                    return (
                                    <li key={i} className="text-[10px] font-bold text-indigo-700 flex items-center gap-2">
                                        <span className="w-1 h-1 rounded-full bg-indigo-400"></span> {typeof pObj === 'string' ? pObj : `${pObj.name} (${pObj.quantity})`}
                                    </li>
                                )})}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Effective Start Date *</label>
                    <div className="relative group">
                        <input type="date" {...register('start_date')} className="w-full h-14 px-4 pr-12 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Package Context</label>
                    <div className="relative">
                        <select {...register('package_type')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm cursor-pointer appearance-none">
                            <option value="Single">Single Enrollment</option>
                            <option value="Couple">Couple Manifest</option>
                            <option value="Double">Double Manifest</option>
                            <option value="Family">Family Portfolio</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                
                {(watch('package_type') === 'Couple' || watch('package_type') === 'Double' || watch('package_type') === 'Family') && (
                    <>
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                                {watch('package_type') === 'Couple' ? 'Spouse Name' : 'Partner Name'}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                                    <User className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                                </div>
                                <input {...register('spouse_name')} className="w-full h-14 pl-14 pr-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm placeholder:text-slate-200" placeholder={watch('package_type') === 'Couple' ? "Spouse's Full Name" : "Partner's Full Name"} />
                            </div>
                        </div>
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                                {watch('package_type') === 'Couple' ? 'Spouse DOB' : 'Partner DOB'}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-50 group-focus-within:bg-indigo-50 transition-colors">
                                    <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                                </div>
                                <input type="date" {...register('spouse_dob')} className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                            </div>
                        </div>
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                                {watch('package_type') === 'Couple' ? 'Spouse ID Card' : 'Partner ID Card'}
                            </label>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'spouse_id_card_url')} className="w-full h-14 p-3 rounded-2xl bg-white border border-slate-200 text-sm" />
                        </div>
                    </>
                )}

                {watch('package_type') === 'Family' && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Family Members / Kids</label>
                            <Button type="button" onClick={() => appendKid({ name: '', dob: '' })} variant="outline" size="sm" className="h-8 text-[10px] rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                                <Plus className="w-3 h-3 mr-1" /> Add Member
                            </Button>
                        </div>
                        {kidsFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group">
                                <button type="button" onClick={() => removeKid(index)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-all opacity-0 group-hover:opacity-100">
                                    <X className="w-3 h-3" />
                                </button>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Name</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white group-focus-within/input:bg-indigo-50 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-300 group-focus-within/input:text-indigo-500" />
                                        </div>
                                        <input {...register(`kids.${index}.name` as const)} className="w-full h-12 pl-14 pr-4 rounded-xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm placeholder:text-slate-200" placeholder="Child's Name" />
                                    </div>
                                    {errors.kids?.[index]?.name && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.kids[index]?.name?.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Date of Birth</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white group-focus-within/input:bg-indigo-50 transition-colors">
                                            <Calendar className="w-3.5 h-3.5 text-slate-300 group-focus-within/input:text-indigo-500" />
                                        </div>
                                        <input type="date" {...register(`kids.${index}.dob` as const)} className="w-full h-12 pl-14 pr-12 rounded-xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase" />
                                    </div>
                                    {errors.kids?.[index]?.dob && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.kids[index]?.dob?.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">ID Card Upload</label>
                                    <input type="file" onChange={(e) => handleFileUpload(e, `kids.${index}.id_card_url` as const)} className="w-full h-12 p-3 rounded-xl bg-white border border-slate-200 text-sm" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Access Type</label>
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
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Audit Reference / Check No.</label>
                    <input {...register('check_no')} className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm uppercase placeholder:text-slate-200" placeholder="----" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Discount Allocation ({currency?.symbol || '$'})</label>
                    <div className="relative">
                        <input type="number" step="0.01" {...register('discount')} className="w-full h-14 px-4 pr-12 rounded-2xl bg-white border border-slate-200 font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm" />
                        <Receipt className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200" />
                    </div>
                </div>
            </div>
        </section>

        <div className="bg-[#f8fafc] rounded-[2.5rem] p-8 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-inner border border-slate-100/50">
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">Base Rate</p>
                <p className="text-base font-black text-slate-900 tracking-tight leading-none">{formatMoney(baseRate)}</p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Net Revenue</p>
                <p className="text-base font-black text-indigo-600 tracking-tight leading-none">{formatMoney(netAmount)}</p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">Expected Expiry</p>
                <p className="text-base font-black text-slate-900 tracking-tight leading-none">
                    {recognition.expiry ? format(parseISO(recognition.expiry), 'dd MMM yyyy') : '---'}
                </p>
            </div>
            <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">Daily Accrual</p>
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
            <button type="button" onClick={onCancel} className="flex-1 h-14 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 transition-all hover:bg-slate-100 flex items-center justify-center gap-3 active:scale-95">
                <Command className="w-4 h-4 opacity-30" /> Cancel
            </button>
            <Button type="submit" className="flex-[2] h-14 rounded-[1.8rem] font-black text-[13px] uppercase tracking-[0.1em] bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3">
                {isRenewal ? 'Commit Renewal' : isEditing ? 'Save Profile Changes' : 'Confirm Enrollment'} <Command className="w-4 h-4 opacity-50" />
            </Button>
        </div>
        </form>

        {showSignatureModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden p-8 flex flex-col items-center">
                    {!signatureMethod ? (
                        <>
                            <h3 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-widest">Select Method</h3>
                            <div className="flex flex-col gap-4 w-full">
                                <Button onClick={() => handleSignatureMethodSelect('pad')} className="h-14 rounded-xl">Signature Pad</Button>
                                <Button onClick={() => handleSignatureMethodSelect('qr')} className="h-14 rounded-xl">QR Code</Button>
                                <Button variant="outline" onClick={() => {setShowSignatureModal(false); setPendingSubmitData(null);}} className="h-14 rounded-xl">Cancel</Button>
                            </div>
                        </>
                    ) : signatureMethod === 'pad' ? (
                        <>
                            <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-widest">Sign Below</h3>
                            <div className="border-2 border-slate-200 rounded-2xl mb-6 bg-slate-50 w-full">
                                <SignatureCanvas 
                                    ref={signatureRef}
                                    canvasProps={{ width: 300, height: 150, className: 'w-full h-36' }} 
                                />
                            </div>
                            <div className="flex gap-2 w-full">
                                <Button onClick={handleSignatureClear} variant="outline" className="flex-1 rounded-xl">Clear</Button>
                                <Button onClick={handleSignatureSave} className="flex-1 rounded-xl bg-indigo-600">Confirm</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-widest">Guest Signature</h3>
                            <p className="text-xs text-slate-500 font-bold mb-6 text-center">Scan QR with tablet to sign</p>
                            <div className="bg-white p-4 border border-slate-100 rounded-2xl shadow-sm mb-6">
                                <QRCodeCanvas value={qrUrl} size={250} />
                            </div>
                            <button 
                                onClick={() => { setShowSignatureModal(false); setPendingSubmitData(null); setSignatureMethod(null); }}
                                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}

        {showIncentivePrompt && pendingSubmitData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-black/5">
                  <div className="p-8">
                      <div className="w-14 h-14 bg-indigo-50 rounded-[1.2rem] flex items-center justify-center mb-5 text-indigo-600">
                          <UserPlus className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Process Incentive?</h3>
                      <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-8">
                        You entered <strong className="text-slate-900">"{pendingSubmitData.referrer_name}"</strong> as a referral, but did not enable the incentive calculation flag. Would you like to process incentives for this referral?
                      </p>
                      <div className="flex flex-col gap-3">
                          <button 
                            type="button"
                            onClick={() => handleIncentiveChoice(true)}
                            className="w-full h-14 rounded-[1.2rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] hover:bg-indigo-700 transition-all shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)] hover:scale-[1.02] active:scale-95"
                          >
                            Yes, Process Incentive
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleIncentiveChoice(false)}
                            className="w-full h-14 rounded-[1.2rem] bg-slate-50 border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[11px] hover:bg-slate-100 transition-all active:scale-95"
                          >
                            No, Skip Incentive
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        )}
    </Card>
  );
};
export default MemberEnrollmentForm;