import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui';
import { 
  ArrowLeft, Edit2, RotateCcw, Baby, Clock, ShieldCheck, Mail, Phone,
  Globe, Snowflake, Plus, Trash2, CheckCircle2, Heart, FileText,
  Zap, CalendarClock, Activity, AlertTriangle, X, Coins, ExternalLink,
  Shield, UserCheck, CalendarDays, ClipboardList, TrendingUp, History,
  LayoutDashboard, Calendar, Pencil, ArrowRight, AlertCircle, List,
  Milestone, MousePointer, PenTool, Wallet
} from 'lucide-react';
import { Member, MembershipCategory, Freeze, MemberStatus, MassageBooking, MassageType } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/mockSupabase';
import { format, differenceInCalendarDays, parse, isAfter, addDays, isBefore, startOfDay } from 'date-fns';
import { MembersAgreement } from '../../components/MembersAgreement';
import { SignatureModal } from '../../components/SignatureModal';

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

interface MemberProfileViewProps {
  member: Member;
  categories: MembershipCategory[];
  onBack: () => void;
  onEdit: (m: Member) => void;
  onRenew: (m: Member) => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

const MemberProfileView: React.FC<MemberProfileViewProps> = ({
  member: initialMember, categories, onBack, onEdit, onRenew, onUpdate, onDelete
}) => {
  const { user } = useAuth();
  const { formatMoney, currentOutlet, currentProperty, settings, hasPermission } = useSettings();
  
  const [viewingMember, setViewingMember] = useState<Member>(initialMember);
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [memberBookings, setMemberBookings] = useState<MassageBooking[]>([]);
  const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
  const [lifecycleHistory, setLifecycleHistory] = useState<Member[]>([]);
  
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [editingFreezeId, setEditingFreezeId] = useState<string | null>(null);
  const [freezeForm, setFreezeForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' });
  const [freezeError, setFreezeError] = useState<string | null>(null);

  const [showAgreement, setShowAgreement] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const category = useMemo(() => categories.find(c => c.id === viewingMember.category_id), [categories, viewingMember.category_id]);
  const getEffectiveStatus = (member: Member) => {
    if (!member) return MemberStatus.ACTIVE;
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

  const effectiveStatus = getEffectiveStatus(viewingMember);
  const isActive = effectiveStatus === MemberStatus.ACTIVE;

  const handleSaveSignatures = async (memberSig: string, staffSig: string) => {
    try {
      await db.updateMember(viewingMember.id, {
        member_signature: memberSig,
        staff_signature: staffSig
      });
      setViewingMember({
        ...viewingMember,
        member_signature: memberSig,
        staff_signature: staffSig
      });
      setShowSignatureModal(false);
    } catch (err) {
      console.error("Failed to save signatures:", err);
      alert("Failed to save signatures. Please try again.");
    }
  };

  const loadForensics = async (targetMember: Member) => {
    const [f, b, mt, history, guests] = await Promise.all([
      db.getFreezes(targetMember.id),
      db.getMassageBookings(currentProperty?.id || '', true),
      db.getMassageTypes(currentOutlet?.id || ''),
      db.getMemberHistory(targetMember.membership_number, currentOutlet?.id),
      db.getGuests(currentProperty?.id || '')
    ]);
    setFreezes(f);
    
    // Find the guest record that matches this member's phone, email, or name
    const matchedGuest = guests.find(g => 
      (targetMember.phone && g.phone === targetMember.phone) || 
      (targetMember.email && g.email === targetMember.email) ||
      (g.name.toLowerCase() === targetMember.guest_name.toLowerCase())
    );
    const linked = matchedGuest ? b.filter(booking => booking.guest_id === matchedGuest.id) : [];
    
    setMemberBookings(linked);
    setMassageTypes(mt);
    setLifecycleHistory(history);
  };

  useEffect(() => { 
    loadForensics(viewingMember);
  }, [viewingMember.id, viewingMember.membership_number, currentProperty, currentOutlet]);

  const usedFreezeDays = useMemo(() => {
    return freezes.reduce((sum, f) => sum + (f.total_days || 0), 0);
  }, [freezes]);

  const totalRevenue = useMemo(() => {
    return lifecycleHistory.reduce((sum, hist) => sum + (hist.net_amount || 0), 0);
  }, [lifecycleHistory]);

  const totalServiceRevenue = useMemo(() => {
    return memberBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  }, [memberBookings]);

  const grandTotal = totalRevenue + totalServiceRevenue;

  const maxAllowed = category?.max_freeze_days || 0;
  
  useEffect(() => {
    if (showFreezeModal && !editingFreezeId && freezeForm.start_date) {
      const start = parseISO(freezeForm.start_date);
      const safeStart = isNaN(start.getTime()) ? new Date() : start;
      const remainingFreezeDays = Math.max(0, maxAllowed - usedFreezeDays);
      
      if (remainingFreezeDays > 0) {
        const end = addDays(safeStart, remainingFreezeDays - 1);
        setFreezeForm(prev => ({ ...prev, end_date: format(end, 'yyyy-MM-dd') }));
      }
    }
  }, [freezeForm.start_date, usedFreezeDays, maxAllowed, showFreezeModal, editingFreezeId]);

  const validation = useMemo(() => {
    if (!freezeForm.start_date || !freezeForm.end_date) return { error: null, impact: null };
    
    const start = parseISO(freezeForm.start_date);
    const end = parseISO(freezeForm.end_date);
    const days = differenceInCalendarDays(end, start) + 1;

    if (days <= 0) {
        return { error: 'INVALID_RANGE', impact: null, msg: 'Termination must be after commencement.' };
    }

    const currentFreezeBeingEdited = freezes.find(f => f.id === editingFreezeId);
    const existingTotalMinusCurrent = usedFreezeDays - (currentFreezeBeingEdited?.total_days || 0);
    const newTotalDeferred = existingTotalMinusCurrent + days;
    
    const isOverLimit = newTotalDeferred > maxAllowed;
    const baseline = parseISO(viewingMember.original_end_date);
    const newExpiry = addDays(baseline, newTotalDeferred);

    return {
        error: isOverLimit ? 'LIMIT_BREACH' : null,
        msg: isOverLimit ? `Duration exceeds tier limit. Allowed: ${maxAllowed} Days.` : null,
        impact: {
            days,
            newExpiry: format(newExpiry, 'dd MMM yyyy'),
            totalDeferred: newTotalDeferred
        }
    };
  }, [freezeForm, viewingMember.original_end_date, freezes, editingFreezeId, usedFreezeDays, maxAllowed]);

  const handleSaveFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validation.error || !validation.impact) return;
    
    setLoading(true);
    try {
        if (editingFreezeId) {
            await db.updateFreeze(editingFreezeId, { 
                start_date: freezeForm.start_date, 
                end_date: freezeForm.end_date, 
                total_days: validation.impact.days 
            });
        } else {
            await db.addFreeze({ 
                id: crypto.randomUUID(), 
                member_id: viewingMember.id, 
                start_date: freezeForm.start_date, 
                end_date: freezeForm.end_date, 
                total_days: validation.impact.days 
            });
        }
        setShowFreezeModal(false);
        setEditingFreezeId(null);
        onUpdate();
        loadForensics(viewingMember);
    } finally {
        setLoading(false);
    }
  };

  const [isLoading, setLoading] = useState(false);

  const handleEditFreeze = (f: Freeze) => {
      setEditingFreezeId(f.id);
      setFreezeForm({ start_date: f.start_date, end_date: f.end_date });
      setFreezeError(null);
      setShowFreezeModal(true);
  };

  const handleDeleteFreeze = async (fId: string) => {
      await db.deleteFreeze(fId, viewingMember.id);
      onUpdate();
      loadForensics(viewingMember);
  };

  const canEdit = hasPermission(user?.role_id || '', 'members:edit');
  const canDelete = hasPermission(user?.role_id || '', 'members:delete');
  const canFreeze = hasPermission(user?.role_id || '', 'members:freeze');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <button onClick={onBack} className="relative z-10 flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
            <ArrowLeft className="w-4 h-4" /> Back to Ledger
        </button>
        <div className="relative z-10 flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={() => setShowSignatureModal(true)} variant="outline" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
              <PenTool className="w-4 h-4 mr-2" /> Signatures
          </Button>
          <Button onClick={() => setShowAgreement(true)} variant="outline" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all">
              <FileText className="w-4 h-4 mr-2" /> Print Agreement
          </Button>
          
          {canFreeze && effectiveStatus !== MemberStatus.EXPIRED && (
            <Button 
                onClick={() => { setEditingFreezeId(null); setFreezeForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' }); setFreezeError(null); setShowFreezeModal(true); }} 
                variant="secondary" 
                className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-amber-100 text-amber-600 hover:bg-amber-50 shadow-sm transition-all"
            >
                <Snowflake className="w-4 h-4 mr-2" /> Apply Freeze
            </Button>
          )}

          {canEdit && (
              <Button onClick={() => onEdit(viewingMember)} variant="secondary" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-slate-100 hover:border-indigo-200 shadow-sm transition-all">
                  <Edit2 className="w-4 h-4 mr-2" /> Modify Profile
              </Button>
          )}

          <Button onClick={() => onRenew(viewingMember)} className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-slate-900 text-white hover:bg-slate-800 shadow-xl transition-all active:scale-95">
              <RotateCcw className="w-4 h-4 mr-2" /> Renew Logic
          </Button>

          {canDelete && (
              <button onClick={() => onDelete(viewingMember.id)} className="p-3 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all shadow-sm border border-red-100/50">
                  <Trash2 className="w-4 h-4" />
              </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden">
          
          <div className="lg:col-span-4 space-y-8">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white group/card">
                  <div className="h-28 bg-slate-900 w-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 p-2 bg-white rounded-[2.5rem] shadow-2xl">
                        <div className="w-28 h-28 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.2rem] flex items-center justify-center text-white text-5xl font-black shadow-inner ring-8 ring-indigo-50/50 group-hover/card:scale-105 transition-transform duration-500">
                            {(viewingMember.guest_name || '?').charAt(0)}
                        </div>
                      </div>
                  </div>
                  <CardContent className="pt-20 pb-8 text-center px-10">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1">{viewingMember.guest_name || 'Unknown Guest'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> {viewingMember.membership_number}
                      </p>
                      
                      <div className={`mt-6 inline-flex px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : effectiveStatus === MemberStatus.FROZEN ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-emerald-500 animate-pulse' : effectiveStatus === MemberStatus.FROZEN ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
                        {effectiveStatus}
                      </div>
                      
                      <div className="mt-10 space-y-3">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all cursor-default">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Phone className="w-4 h-4" /></div>
                           <span className="flex-1 text-left">{viewingMember.phone || 'No terminal record'}</span>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all cursor-default overflow-hidden">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Mail className="w-4 h-4 shrink-0" /></div>
                           <span className="truncate flex-1 text-left lowercase">{viewingMember.email || 'No digital ID'}</span>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all cursor-default">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Globe className="w-4 h-4" /></div>
                           <span className="flex-1 text-left uppercase">{viewingMember.nationality || 'Unspecified Origin'}</span>
                        </div>
                      </div>
                  </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-indigo-200 shadow-2xl p-8 bg-indigo-600 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700"><Coins className="w-32 h-32" /></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg"><TrendingUp className="w-6 h-6 text-indigo-100" /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]">Financial Audit HUD</h4>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                           <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Net Contribution</span>
                           <span className="text-3xl font-black tracking-tighter">{formatMoney(viewingMember.net_amount)}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                           <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Total Revenue</span>
                           <span className="text-3xl font-black tracking-tighter">{formatMoney(totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                           <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Daily Yield</span>
                           <span className="text-3xl font-black text-emerald-300 tracking-tighter">{formatMoney(viewingMember.daily_rate)}</span>
                        </div>
                    </div>
                 </div>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl p-8 bg-slate-900 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700"><Wallet className="w-32 h-32 text-emerald-500" /></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg"><Wallet className="w-6 h-6 text-emerald-400" /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em]">Consolidated Portfolio</h4>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Membership Revenue</span>
                           <span className="text-xl font-black tracking-tighter">{formatMoney(totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Service Revenue</span>
                           <span className="text-xl font-black tracking-tighter">{formatMoney(totalServiceRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-end pt-2">
                           <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Grand Total</span>
                           <span className="text-3xl font-black text-emerald-400 tracking-tighter">{formatMoney(grandTotal)}</span>
                        </div>
                    </div>
                 </div>
              </Card>
          </div>

          <div className="lg:col-span-8 space-y-8">
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl p-10 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <div className="space-y-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shield className="w-3 h-3"/> Enrollment Tier</p><p className="text-sm font-black uppercase text-slate-900">{category?.name}</p></div>
                      <div className="space-y-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays className="w-3 h-3"/> Commencement</p><p className="text-sm font-black text-slate-900">{format(parseISO(viewingMember.start_date), 'dd MMM yyyy')}</p></div>
                      
                      <div className="space-y-2 col-span-1 md:col-span-1 border-l md:border-l-0 md:pl-0 pl-6 border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3 text-indigo-500"/> Expiry Sentinel</p>
                        
                        <div className="flex flex-col gap-1.5">
                            {viewingMember.current_end_date !== viewingMember.original_end_date ? (
                                <>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Baseline Expiry</p>
                                        <p className="text-[11px] font-black text-slate-500">{format(parseISO(viewingMember.original_end_date), 'dd MMM yyyy')}</p>
                                    </div>
                                    <div className="space-y-0.5 pt-1 border-t border-indigo-50">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Deferred Expiry</p>
                                        <p className="text-[13px] font-black text-indigo-700 tracking-tight">{format(parseISO(viewingMember.current_end_date), 'dd MMM yyyy')}</p>
                                    </div>
                                    <span className="inline-flex w-fit text-[7px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg uppercase tracking-widest shadow-sm">Adjusted via Freeze</span>
                                </>
                            ) : (
                                <p className="text-sm font-black text-indigo-600">{format(parseISO(viewingMember.current_end_date), 'dd MMM yyyy')}</p>
                            )}
                        </div>
                      </div>

                      <div className="space-y-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><LayoutDashboard className="w-3 h-3"/> Package Spec</p><p className="text-sm font-black uppercase text-slate-900">{viewingMember.package_type}</p></div>
                  </div>
              </Card>

              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white flex flex-col">
                  <CardHeader className="bg-[#0f172a] text-white p-8 flex justify-between items-center border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 shadow-lg"><List className="w-5 h-5 text-indigo-400" /></div>
                        <div>
                            <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none">Membership Lifecycle History</CardTitle>
                            <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mt-1">Portfolio Traceability Ledger (Click to View Record)</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{lifecycleHistory.length} Enrollments Found</span>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] border-b sticky top-0 z-10">
                              <tr>
                                  <th className="px-6 py-4">Commence</th>
                                  <th className="px-6 py-4">Status</th>
                                  <th className="px-6 py-4">Tier / Package</th>
                                  <th className="px-6 py-4 text-right">Investment</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {Array.isArray(lifecycleHistory) && lifecycleHistory.map(hist => (
                                  <tr 
                                    key={hist.id} 
                                    onClick={() => setViewingMember(hist)}
                                    className={`hover:bg-indigo-50/40 transition-all cursor-pointer group/row ${hist.id === viewingMember.id ? 'bg-indigo-50/60 border-l-4 border-indigo-600' : 'bg-white'}`}
                                  >
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-1.5 h-1.5 rounded-full ${hist.id === viewingMember.id ? 'bg-indigo-600 animate-pulse' : 'bg-transparent'}`} />
                                              <div>
                                                  <div className="text-[11px] font-black text-slate-700">{format(parseISO(hist.start_date), 'dd MMM yyyy')}</div>
                                                  <div className="text-[8px] font-bold text-slate-300 uppercase">To {format(parseISO(hist.current_end_date), 'dd MMM yyyy')}</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${getEffectiveStatus(hist) === MemberStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : getEffectiveStatus(hist) === MemberStatus.EXPIRED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                              {getEffectiveStatus(hist)}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{categories.find(c => c.id === hist.category_id)?.name || 'Standard'}</div>
                                          <div className="text-[8px] font-bold text-slate-400 uppercase">{hist.package_type} Manifesto</div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex flex-col items-end gap-1">
                                              <span className="font-black text-slate-900 text-xs">{formatMoney(hist.net_amount)}</span>
                                              <div className={`flex items-center gap-1 text-[7px] font-black uppercase transition-all ${hist.id === viewingMember.id ? 'text-indigo-600 opacity-100' : 'text-slate-300 opacity-0 group-hover/row:opacity-100'}`}>
                                                  <MousePointer className="w-2.5 h-2.5" /> {hist.id === viewingMember.id ? 'Viewing' : 'Inspect'}
                                              </div>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white flex flex-col min-h-[460px]">
                      <CardHeader className="bg-slate-50 p-8 flex justify-between items-center border-b shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm"><Snowflake className="w-5 h-5 text-indigo-600" /></div>
                            <div>
                                <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900">Account Suspensions</CardTitle>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Utilized: {usedFreezeDays} / {maxAllowed} Days</p>
                            </div>
                          </div>
                          {canFreeze && effectiveStatus !== MemberStatus.EXPIRED && (
                            <Button onClick={() => { setEditingFreezeId(null); setFreezeForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' }); setFreezeError(null); setShowFreezeModal(true); }} size="sm" variant="secondary" className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white border-none transition-all active:scale-95 shadow-lg shadow-indigo-900/40">
                                <Plus className="w-3.5 h-3.5 mr-1.5" /> Apply Freeze
                            </Button>
                          )}
                      </CardHeader>
                      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left table-fixed">
                              <thead className="bg-slate-50/30 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] border-b sticky top-0 z-10">
                                  <tr>
                                      <th className="px-6 py-4 w-[30%]">Commence</th>
                                      <th className="px-6 py-4 w-[30%]">Terminate</th>
                                      <th className="px-6 py-4 w-[20%] text-center">Span</th>
                                      <th className="px-6 py-4 w-[20%] text-right">Ops</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {(!Array.isArray(freezes) || freezes.length === 0) ? (
                                      <tr><td colSpan={4} className="px-8 py-28 text-center">
                                          <div className="flex flex-col items-center gap-4 opacity-30">
                                              <Milestone className="w-12 h-12 text-slate-300" />
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No historical suspensions</p>
                                          </div>
                                      </td></tr>
                                  ) : (
                                      Array.isArray(freezes) && freezes.map(f => (
                                          <tr key={f.id} className="hover:bg-indigo-50/20 transition-colors group">
                                              <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">{format(parseISO(f.start_date), 'dd MMM yyyy')}</td>
                                              <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">{format(parseISO(f.end_date), 'dd MMM yyyy')}</td>
                                              <td className="px-6 py-5 text-center">
                                                  <div className="inline-flex flex-col items-center justify-center">
                                                      <div className="w-12 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-200/50">
                                                          {f.total_days}
                                                      </div>
                                                      <span className="text-[7px] font-black text-indigo-600 uppercase mt-1 tracking-tighter">Days</span>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      {canFreeze && effectiveStatus !== MemberStatus.EXPIRED && (
                                                        <>
                                                          <button onClick={() => handleEditFreeze(f)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Modify"><Pencil className="w-3.5 h-3.5"/></button>
                                                          <button onClick={() => handleDeleteFreeze(f.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                                                        </>
                                                      )}
                                                  </div>
                                              </td>
                                          </tr>
                                      ))
                                  )}
                              </tbody>
                          </table>
                      </CardContent>
                  </Card>

                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white flex flex-col min-h-[460px]">
                      <CardHeader className="bg-slate-50/80 p-8 flex justify-between items-center border-b shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100 shadow-sm"><CalendarClock className="w-5 h-5 text-purple-600" /></div>
                            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-900">Service Forensic Ledger</CardTitle>
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lifetime History</span>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50/30 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] border-b sticky top-0 z-10">
                                  <tr>
                                      <th className="px-8 py-4">Service Event</th>
                                      <th className="px-8 py-4 text-center">Audit</th>
                                      <th className="px-8 py-4 text-right">Yield</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {(!Array.isArray(memberBookings) || memberBookings.length === 0) ? (
                                      <tr><td colSpan={3} className="px-8 py-28 text-center">
                                          <div className="flex flex-col items-center gap-4 opacity-30">
                                              <History className="w-12 h-12 text-slate-300" />
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No service engagements</p>
                                          </div>
                                      </td></tr>
                                  ) : (
                                      Array.isArray(memberBookings) && memberBookings.map(b => {
                                          const type = massageTypes.find(mt => mt.id === (b.massage_type_id || b.inventory_item_id));
                                          return (
                                          <tr key={b.id} className="hover:bg-purple-50/20 transition-colors">
                                              <td className="px-8 py-5">
                                                  <div className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[140px] tracking-tight">{type?.name || 'Standard Service'}</div>
                                                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5" /> {format(parseISO(b.date), 'dd MMM yy')}</div>
                                              </td>
                                              <td className="px-8 py-5 text-center">
                                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                      {b.status}
                                                  </span>
                                              </td>
                                              <td className="px-8 py-5 text-right font-black text-slate-900 text-xs tabular-nums">{formatMoney(Number(b.price))}</td>
                                          </tr>
                                      )})
                                  )}
                              </tbody>
                          </table>
                      </CardContent>
                  </Card>
              </div>

              {(viewingMember.package_type === 'Couple' || viewingMember.package_type === 'Family') && (
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl p-10 bg-white overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000"><Heart className="w-48 h-48 text-red-600" /></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-8 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm border border-red-100"><Heart className="w-5 h-5" /></div>
                        Family Manifest / Dependents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                        {viewingMember.spouse_name && (
                            <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group/item hover:bg-white hover:shadow-lg transition-all duration-300">
                                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover/item:scale-110 transition-transform border border-slate-50"><ShieldCheck className="w-7 h-7"/></div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Legal Spouse</p>
                                    <p className="text-base font-black uppercase text-slate-800">{viewingMember.spouse_name}</p>
                                    {viewingMember.spouse_dob && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">DOB: {format(parseISO(viewingMember.spouse_dob), 'dd MMM yyyy')}</p>}
                                </div>
                            </div>
                        )}
                        {viewingMember.kids?.map((kid, i) => (
                            <div key={i} className="flex items-center gap-5 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group/item hover:bg-white hover:shadow-lg transition-all duration-300">
                                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover/item:scale-110 transition-transform border border-slate-50"><Baby className="w-7 h-7"/></div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Dependent {i+1}</p>
                                    <p className="text-base font-black uppercase text-slate-800">{kid.name}</p>
                                    {kid.dob && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">DOB: {format(parseISO(kid.dob), 'dd MMM yyyy')}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
              )}

              {/* Identity Documents Section */}
              <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl p-10 bg-white overflow-hidden relative group">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100"><FileText className="w-5 h-5" /></div>
                    Identity Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {viewingMember.id_card_url && (
                        <div className="p-4 border rounded-2xl bg-slate-50">
                            <p className="text-[9px] font-black uppercase text-slate-400">Main Member ID</p>
                            <Button onClick={() => window.open(viewingMember.id_card_url!, '_blank')} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    )}
                    {viewingMember.spouse_id_card_url && (
                        <div className="p-4 border rounded-2xl bg-slate-50">
                            <p className="text-[9px] font-black uppercase text-slate-400">Spouse ID</p>
                            <Button onClick={() => window.open(viewingMember.spouse_id_card_url!, '_blank')} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    )}
                    {viewingMember.kids?.map((kid, i) => kid.id_card_url && (
                        <div key={i} className="p-4 border rounded-2xl bg-slate-50">
                            <p className="text-[9px] font-black uppercase text-slate-400">{kid.name} ID</p>
                            <Button onClick={() => window.open(kid.id_card_url!, '_blank')} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    ))}
                </div>
              </Card>

              {viewingMember.remarks && (
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl p-10 bg-slate-50 border-dashed border-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><ClipboardList className="w-32 h-32 text-slate-900" /></div>
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5 flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5" /> Operational Intelligence Notes
                    </h3>
                    <p className="text-base font-medium text-slate-600 leading-relaxed italic pr-12">"{viewingMember.remarks}"</p>
                </Card>
              )}
          </div>
      </div>

      {showFreezeModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[400px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-10 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
                        <Snowflake className="w-7 h-7 text-indigo-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Authorize Suspension</CardTitle>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Temporary Portfolio Hold</p>
                    <button onClick={() => setShowFreezeModal(false)} className="absolute top-8 right-8 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-5 h-5 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                    <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Freeze Capacity</span>
                            <span className="text-[11px] font-black text-slate-900">{usedFreezeDays} / {maxAllowed} Days</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${usedFreezeDays >= maxAllowed || maxAllowed === 0 ? 'bg-red-500' : 'bg-indigo-600'}`} 
                                style={{ width: `${maxAllowed === 0 ? 100 : Math.min(100, (usedFreezeDays / maxAllowed) * 100)}%` }}
                            />
                        </div>
                    </div>

                    {(validation.error || maxAllowed === 0) && (
                        <div className="p-5 bg-red-50 border-2 border-red-500/20 rounded-2xl flex items-start gap-4 animate-in shake duration-500 shadow-lg shadow-red-100/50">
                            <div className="p-2 bg-red-100 rounded-xl shrink-0">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] font-black text-red-700 uppercase tracking-tight">Suspension Protocol Breach</p>
                                <p className="text-[10px] font-bold text-red-500 uppercase leading-relaxed">
                                    {maxAllowed === 0 ? "This tier does not support portfolio suspensions." : validation.msg}
                                </p>
                                <p className="text-[8px] font-black text-red-400 uppercase mt-1">Tier capacity: {maxAllowed} Days Max</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSaveFreeze} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Commencement Date</label>
                            <div className="relative group">
                                <input 
                                    type="date" 
                                    value={freezeForm.start_date} 
                                    onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} 
                                    disabled={maxAllowed === 0}
                                    className={`w-full h-16 pl-6 pr-14 rounded-2xl border-2 focus:ring-0 font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer ${validation.error || maxAllowed === 0 ? 'border-red-500 bg-red-50/10 text-red-900 opacity-50' : 'border-slate-100 focus:border-indigo-600 bg-white'}`}
                                />
                                <Calendar className={`absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${validation.error || maxAllowed === 0 ? 'text-red-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Termination Date</label>
                            <div className="relative group">
                                <input 
                                    type="date" 
                                    value={freezeForm.end_date} 
                                    onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} 
                                    disabled={maxAllowed === 0}
                                    className={`w-full h-16 pl-6 pr-14 rounded-2xl border-2 focus:ring-0 font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer ${validation.error || maxAllowed === 0 ? 'border-red-500 bg-red-50/10 text-red-900 focus:border-red-600 opacity-50' : 'border-slate-100 focus:border-indigo-600 bg-white'}`}
                                />
                                <Calendar className={`absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${validation.error || maxAllowed === 0 ? 'text-red-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                            </div>
                        </div>

                        {!validation.error && validation.impact && maxAllowed > 0 && (
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex items-center justify-between animate-in fade-in duration-500">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-indigo-400 tracking-widest leading-none mb-1">New Expiry</p>
                                        <p className="text-xs font-black text-indigo-900 tracking-tight">{validation.impact.newExpiry}</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black bg-indigo-600 text-white px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">+{validation.impact.days} Days</span>
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            disabled={!!validation.error || !validation.impact || isLoading || maxAllowed === 0}
                            isLoading={isLoading}
                            className={`w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all ${validation.error || maxAllowed === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#a5b4fc] hover:bg-[#93a5f7] text-white'}`}
                        >
                            {editingFreezeId ? 'Commit Modification' : 'Commit Protocol'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
      )}

      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSaveSignatures}
          initialMemberSignature={viewingMember.member_signature}
          initialStaffSignature={viewingMember.staff_signature}
        />
      )}

      {showAgreement && (
        <MembersAgreement 
            member={viewingMember} 
            category={category} 
            outlet={currentOutlet} 
            property={currentProperty} 
            settings={settings} 
            formatMoney={(val) => formatMoney(val)} 
            onClose={() => setShowAgreement(false)} 
        />
      )}
    </div>
  );
};

export default MemberProfileView;