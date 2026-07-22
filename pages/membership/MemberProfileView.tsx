import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../../components/ui';
import { 
  ArrowLeft, Edit2, RotateCcw, Baby, Clock, ShieldCheck, Mail, Phone,
  Globe, Snowflake, Plus, Trash2, CheckCircle2, Heart, FileText,
  Zap, CalendarClock, Activity, AlertTriangle, X, Coins, ExternalLink,
  Shield, UserCheck, CalendarDays, ClipboardList, TrendingUp, History,
  LayoutDashboard, Calendar, Pencil, ArrowRight, AlertCircle, List,
  Milestone, MousePointer, PenTool, Wallet, Tag, FileUp, Download, Printer,
  ShieldAlert, Sparkles, Minus
} from 'lucide-react';
import { Member, MembershipCategory, Freeze, MemberStatus, MassageBooking, MassageType } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/mockSupabase';
import { format, differenceInCalendarDays, parse, isAfter, addDays, isBefore, startOfDay, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { MembersAgreement } from '../../components/MembersAgreement';
import { SignatureModal } from '../../components/SignatureModal';

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
  const { user, isSuperAdmin } = useAuth();
  const { formatMoney, currentOutlet, currentProperty, settings, hasPermission, setPageLoading } = useSettings();
  
  const [viewingMember, setViewingMember] = useState<Member>(initialMember);
  const [freezes, setFreezes] = useState<Freeze[]>([]);

  useEffect(() => {
    if (initialMember) {
      setViewingMember(initialMember);
      setMemberNotes(initialMember.notes || '');
    }
  }, [initialMember.id, initialMember.status, initialMember.privilege_usage]);
  const [memberBookings, setMemberBookings] = useState<MassageBooking[]>([]);
  const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
  const [lifecycleHistory, setLifecycleHistory] = useState<Member[]>([]);
  
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [editingFreezeId, setEditingFreezeId] = useState<string | null>(null);
  const [freezeForm, setFreezeForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', reason: '' });
  const [freezeError, setFreezeError] = useState<string | null>(null);

  const [showAgreement, setShowAgreement] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRevertCancelModal, setShowRevertCancelModal] = useState(false);
  const [bulkFreezeToDelete, setBulkFreezeToDelete] = useState<any>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPrivilegeHistoryModal, setShowPrivilegeHistoryModal] = useState(false);
  const [memberNotes, setMemberNotes] = useState(initialMember.notes || '');
  const [cancelDate, setCancelDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewingIdUrl, setViewingIdUrl] = useState<string | null>(null);

  const category = useMemo(() => categories.find(c => c.id === viewingMember.category_id), [categories, viewingMember.category_id]);
  const getEffectiveStatus = (member: Member) => {
    if (!member) return MemberStatus.ACTIVE;
    if (member.status === MemberStatus.CANCELLED) return MemberStatus.CANCELLED;
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

  const cancellationDetails = useMemo(() => {
    if (viewingMember.status !== MemberStatus.CANCELLED || !viewingMember.cancellation_date) return null;
    const start = parseISO(viewingMember.start_date);
    const cancel = parseISO(viewingMember.cancellation_date);
    const daysUsed = Math.max(1, differenceInCalendarDays(cancel, start));
    return {
        date: viewingMember.cancellation_date,
        daysUsed,
        proratedAmount: viewingMember.net_amount
    };
  }, [viewingMember]);

  const handleSaveNotes = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      await db.updateMemberNotes(viewingMember.id, memberNotes);
      setViewingMember({ ...viewingMember, notes: memberNotes });
      toast.success("Member notes updated successfully.");
      setShowNotesModal(false);
    } catch (err) {
      console.error("Failed to update notes:", err);
      toast.error("Failed to update notes.");
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

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
      toast.error("Failed to save signatures. Please try again.");
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [activeLogUsage, setActiveLogUsage] = useState<{ privilege: string, increment: number } | null>(null);
  const [privilegeServiceDate, setPrivilegeServiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [privilegeServiceNote, setPrivilegeServiceNote] = useState('');

  const handleUpdatePrivilege = async (privilege: string, increment: number, serviceDate?: string, note?: string) => {
    try {
      setPageLoading(true);
      const currentUsages = viewingMember.privilege_usage || [];
      const existing = currentUsages.find(u => u.privilege === privilege);
      
      let newUsages;
      const historyEntry = {
        date: new Date().toISOString(), // Log date
        service_date: serviceDate || format(new Date(), 'yyyy-MM-dd'), // Usage date
        note: note || '',
        by: user?.name || user?.email || 'System',
        change: increment,
      };

      if (existing) {
        const newCount = Math.max(0, existing.used_count + increment);
        newUsages = currentUsages.map(u => 
          u.privilege === privilege 
            ? { 
                ...u, 
                used_count: newCount, 
                updated_date: historyEntry.date, 
                updated_by: historyEntry.by,
                history: [...(u.history || []), { ...historyEntry, new_total: newCount }]
              }
            : u
        );
      } else {
        const newCount = Math.max(0, increment);
        newUsages = [...currentUsages, { 
          privilege, 
          used_count: newCount, 
          updated_date: historyEntry.date, 
          updated_by: historyEntry.by,
          history: [{ ...historyEntry, new_total: newCount }]
        }];
      }
      
      console.log(`[DEBUG] Updating privilege usage for member ${viewingMember.id}:`, newUsages);
      await db.updateMember(viewingMember.id, { privilege_usage: newUsages });
      setViewingMember(prev => ({ ...prev, privilege_usage: newUsages }));
      
      setPrivilegeServiceNote('');
      setActiveLogUsage(null);
      toast.success('Privilege usage updated');
      onUpdate();
    } catch (err) {
      console.error("[DEBUG] Failed to update privilege:", err);
      toast.error('Failed to update privilege');
    } finally {
      setPageLoading(false);
    }
  };

  const handleClearPrivilegeHistory = async () => {
    try {
      setPageLoading(true);
      console.log(`[DEBUG] Clearing privilege usage for member ${viewingMember.id}`);
      const clearedUsages: any[] = [];
      await db.updateMember(viewingMember.id, { privilege_usage: clearedUsages });
      setViewingMember(prev => ({ ...prev, privilege_usage: clearedUsages }));
      toast.success('Privilege usage history cleared');
      setShowClearConfirm(false);
      onUpdate();
    } catch (err) {
      console.error("[DEBUG] Failed to clear privilege history:", err);
      toast.error('Failed to clear privilege history');
    } finally {
      setPageLoading(false);
    }
  };


  const loadForensics = async (targetMember: Member) => {
    if (!targetMember.member_signature && !targetMember.id_card_url) {
      db.getMemberById(targetMember.id).then(full => {
        if (full) setViewingMember(prev => ({ ...prev, ...full }));
      }).catch(err => console.error("Error loading full member details:", err));
    }

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
    return freezes.filter(f => !f.is_maintenance).reduce((sum, f) => sum + (f.total_days || 0), 0);
  }, [freezes]);

  const tierFreezes = useMemo(() => freezes.filter(f => !f.is_maintenance), [freezes]);
  const maintenanceFreezes = useMemo(() => freezes.filter(f => !!f.is_maintenance), [freezes]);

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
    
    const start = startOfDay(parseISO(freezeForm.start_date));
    const end = startOfDay(parseISO(freezeForm.end_date));
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
    setPageLoading(true);
    try {
        if (editingFreezeId) {
            await db.updateFreeze(editingFreezeId, { 
                start_date: freezeForm.start_date, 
                end_date: freezeForm.end_date, 
                total_days: validation.impact.days,
                reason: freezeForm.reason,
                outlet_id: viewingMember.outlet_id
            });
        } else {
            await db.addFreeze({ 
                id: crypto.randomUUID(), 
                member_id: viewingMember.id, 
                start_date: freezeForm.start_date, 
                end_date: freezeForm.end_date, 
                total_days: validation.impact.days,
                reason: freezeForm.reason,
                outlet_id: viewingMember.outlet_id
            });
        }
        setShowFreezeModal(false);
        setEditingFreezeId(null);
        onUpdate();
        loadForensics(viewingMember);
    } finally {
        setLoading(false);
        setPageLoading(false);
    }
  };

  const [isLoading, setLoading] = useState(false);

  const handleEditFreeze = (f: any) => {
      const isBulk = f.batch_id || f.maintenance_batch_id;
      if (isBulk) {
          toast.error("This is a bulk suspension. Please edit it from the Bulk History modal to ensure consistency across all members.");
          return;
      }
      setEditingFreezeId(f.id);
      setFreezeForm({ start_date: f.start_date, end_date: f.end_date, reason: f.reason || '' });
      setFreezeError(null);
      setShowFreezeModal(true);
  };

  const handleDeleteFreeze = async (f: any) => {
      const isBulk = f.batch_id || f.maintenance_batch_id;
      if (isBulk) {
          setBulkFreezeToDelete(f);
      } else {
          setLoading(true);
          setPageLoading(true);
          try {
              await db.deleteFreeze(f.id, viewingMember.id);
              toast.success("Suspension deleted.");
              onUpdate();
              loadForensics(viewingMember);
          } catch (err) {
              console.error(err);
              toast.error("Failed to delete suspension.");
          } finally {
              setLoading(false);
              setPageLoading(false);
          }
      }
  };

  const confirmDeleteBulkFreeze = async () => {
      if (!bulkFreezeToDelete) return;
      const isBulk = bulkFreezeToDelete.batch_id || bulkFreezeToDelete.maintenance_batch_id;
      setLoading(true);
      setPageLoading(true);
      try {
          await db.deleteBulkFreeze(isBulk);
          toast.success("Bulk suspension deleted successfully.");
          setBulkFreezeToDelete(null);
          onUpdate();
          loadForensics(viewingMember);
      } catch (err) {
          console.error(err);
          toast.error("Failed to delete bulk suspension.");
      } finally {
          setLoading(false);
          setPageLoading(false);
      }
  };

  const handleDeleteCancellation = () => {
      setShowRevertCancelModal(true);
  };

  const confirmRevertCancellation = async () => {
    setLoading(true);
    setPageLoading(true);
    try {
        const restoredAmount = (viewingMember.original_net_amount && viewingMember.original_net_amount > 0) ? viewingMember.original_net_amount : (viewingMember.actual_rate - viewingMember.discount);

        await db.updateMember(viewingMember.id, {
            status: MemberStatus.ACTIVE,
            cancellation_date: null,
            current_end_date: viewingMember.original_end_date,
            net_amount: restoredAmount,
            original_net_amount: null
        });
        
        // Recalculate current_end_date based on freezes
        const newEndDate = await db.syncMemberEndDate(viewingMember.id);
        
        setViewingMember({
            ...viewingMember,
            status: MemberStatus.ACTIVE,
            cancellation_date: null,
            current_end_date: newEndDate || viewingMember.original_end_date,
            net_amount: restoredAmount,
            original_net_amount: null
        });
        toast.success("Cancellation reverted successfully.");
        setShowRevertCancelModal(false);
        onUpdate();
    } catch (err) {
        console.error("Failed to delete cancellation:", err);
        toast.error("Failed to revert cancellation.");
    } finally {
        setLoading(false);
        setPageLoading(false);
    }
  };

  const handleCancelMembership = async () => {
    setLoading(true);
    setPageLoading(true);
    try {
        const start = parseISO(viewingMember.start_date);
        const cancel = parseISO(cancelDate);
        const daysUsed = Math.max(1, differenceInCalendarDays(cancel, start));
        const proratedAmount = daysUsed * viewingMember.daily_rate;
        const originalAmount = (viewingMember.original_net_amount && viewingMember.original_net_amount > 0) ? viewingMember.original_net_amount : viewingMember.net_amount;
        
        console.log("Updating member with ID:", viewingMember.id);
        console.log("Updating member with data:", {
            status: MemberStatus.CANCELLED,
            cancellation_date: cancelDate,
            current_end_date: cancelDate,
            net_amount: proratedAmount,
            original_net_amount: originalAmount
        });
        await db.updateMember(viewingMember.id, {
            status: MemberStatus.CANCELLED,
            cancellation_date: cancelDate,
            current_end_date: cancelDate,
            net_amount: proratedAmount,
            original_net_amount: originalAmount
        });
        console.log("Member updated successfully");

        toast.success("Membership cancelled successfully.");
        
        setViewingMember({
            ...viewingMember,
            status: MemberStatus.CANCELLED,
            cancellation_date: cancelDate,
            current_end_date: cancelDate,
            net_amount: proratedAmount,
            original_net_amount: originalAmount
        });
        setShowCancelModal(false);
        onUpdate();
    } catch (err) {
        console.error("Failed to cancel membership:", err);
        toast.error("Failed to cancel membership.");
    } finally {
        setLoading(false);
        setPageLoading(false);
    }
  };

  const canEdit = hasPermission(user?.role_id || '', 'members:edit');
  const canDelete = hasPermission(user?.role_id || '', 'members:delete');
  const canFreeze = hasPermission(user?.role_id || '', 'members:freeze');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <motion.button 
          whileHover={{ scale: 1.02, x: -4 }} 
          whileTap={{ scale: 0.98 }}
          onClick={onBack} 
          className="relative z-10 flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-all bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-100 group"
        >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Ledger
        </motion.button>
        <div className="relative z-10 flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={() => setShowSignatureModal(true)} variant="outline" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
              <PenTool className="w-4 h-4 mr-2" /> Signatures
          </Button>
          <Button onClick={() => setShowAgreement(true)} variant="outline" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all">
              <FileText className="w-4 h-4 mr-2" /> Print Agreement
          </Button>
          
          {isActive && (
            <Button onClick={() => setShowCancelModal(true)} variant="secondary" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-red-50 border-2 border-red-100 text-red-600 hover:bg-red-100 shadow-sm transition-all">
                <X className="w-4 h-4 mr-2" /> Cancel Membership
            </Button>
          )}

          {viewingMember.status === MemberStatus.CANCELLED && (
            <Button onClick={handleDeleteCancellation} variant="secondary" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-amber-50 border-2 border-amber-100 text-amber-600 hover:bg-amber-100 shadow-sm transition-all">
                <RotateCcw className="w-4 h-4 mr-2" /> Revert Cancellation
            </Button>
          )}
          
          {canFreeze && effectiveStatus !== MemberStatus.EXPIRED && (
            <Button 
                onClick={() => { setEditingFreezeId(null); setFreezeForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', reason: '' }); setFreezeError(null); setShowFreezeModal(true); }} 
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

          <Button onClick={() => setShowNotesModal(true)} variant="secondary" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all">
              <ClipboardList className="w-4 h-4 mr-2" /> Member Notes
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
                           <span className="flex-1 text-left">{viewingMember.phone || 'No Phone Number'}</span>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all cursor-default overflow-hidden">
                           <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Mail className="w-4 h-4 shrink-0" /></div>
                           <span className="truncate flex-1 text-left">{viewingMember.email || 'No Email ID'}</span>
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
                           <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">
                             {viewingMember.status === MemberStatus.CANCELLED ? 'Prorated Contribution' : 'Net Contribution'}
                           </span>
                           <span className="text-3xl font-black tracking-tighter">{formatMoney(viewingMember.net_amount)}</span>
                        </div>
                        {viewingMember.status === MemberStatus.CANCELLED && viewingMember.original_net_amount && viewingMember.original_net_amount > 0 && (
                           <div className="flex justify-between items-end border-b border-white/10 pb-4">
                              <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Original Amount</span>
                              <span className="text-xl font-black tracking-tighter text-indigo-200">{formatMoney(viewingMember.original_net_amount)}</span>
                           </div>
                        )}
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
                      <div className="space-y-1.5"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shield className="w-3 h-3"/> Enrollment Tier</p><p className="text-sm font-black uppercase text-slate-900">{category?.name} ({formatMoney(viewingMember.actual_rate - viewingMember.discount)})</p></div>
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

              {category?.privileges && category.privileges.length > 0 && (
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                       <CardHeader className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-8 border-b border-emerald-800/30">
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-400/30">
                                         <Sparkles className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                         <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none">Privilege Entitlements</CardTitle>
                                         <p className="text-[8px] font-black text-emerald-300/80 uppercase tracking-widest mt-1">Track & Manage Used Tier Benefits</p>
                                    </div>
                               </div>

                               <div className="flex items-center gap-2">
                                   <Button 
                                       type="button" 
                                       variant="outline" 
                                       onClick={() => setShowPrivilegeHistoryModal(true)}
                                       className="h-8 px-3 rounded-lg border-emerald-800/50 text-emerald-300 hover:text-white hover:bg-emerald-800 hover:border-emerald-700 text-[10px] font-black uppercase tracking-widest bg-emerald-900/50"
                                   >
                                       <History className="w-3 h-3 mr-1.5" />
                                       History
                                   </Button>
                                   {isSuperAdmin && (
                                       <Button 
                                           type="button" 
                                           variant="outline" 
                                           onClick={() => setShowClearConfirm(true)}
                                           className="h-8 px-3 rounded-lg border-red-800/50 text-red-300 hover:text-white hover:bg-red-800 hover:border-red-700 text-[10px] font-black uppercase tracking-widest bg-red-900/50"
                                       >
                                           <RotateCcw className="w-3 h-3 mr-1.5" />
                                           Purge History
                                       </Button>
                                   )}
                               </div>
                           </div>
                      </CardHeader>
                      <CardContent className="p-0">
                             <div className="divide-y divide-slate-100">
                                 {category.privileges.map((priv, i) => {
                                     let pObj: any = priv;
                                     if (typeof priv === 'string') {
                                         try { pObj = JSON.parse(priv); } catch {}
                                     }
                                     const pName = typeof pObj === 'string' ? pObj : pObj.name;
                                     const pQty = typeof pObj === 'string' ? null : pObj.quantity;
                                     const pId = typeof pObj === 'string' ? i : pObj.id || i;
                                     const usage = viewingMember.privilege_usage?.find(u => u.privilege === pName);
                                     const count = usage?.used_count || 0;
                                     return (
                                          <div key={pId} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                              <div>
                                                  <span className="font-bold text-sm text-slate-900">{pName}</span>
                                                  {pQty !== null && (
                                                      <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Total: {pQty}</span>
                                                  )}
                                                  {pQty !== null && (
                                                      <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded border ${pQty - count <= 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>Balance: {pQty - count}</span>
                                                  )}
                                                  {usage?.updated_date && (
                                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">
                                                          Last updated by {usage.updated_by} on {format(parseISO(usage.updated_date), 'dd MMM yyyy HH:mm')}
                                                      </p>
                                                  )}
                                              </div>
                                              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
                                                  <Button 
                                                      type="button" 
                                                      variant="outline" 
                                                      onClick={() => {
                                                         setPrivilegeServiceDate(format(new Date(), 'yyyy-MM-dd'));
                                                         setPrivilegeServiceNote('');
                                                         setActiveLogUsage({ privilege: pName, increment: -1 });
                                                      }}
                                                      disabled={count === 0}
                                                      className="h-10 w-10 p-0 rounded-xl border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                                                  >
                                                      <Minus className="w-4 h-4" />
                                                  </Button>
                                                  <div className="w-16 text-center space-y-0.5">
                                                      <div className="text-xl font-black text-emerald-600 leading-none">{count}</div>
                                                      <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Used</div>
                                                  </div>
                                                  <Button 
                                                      type="button" 
                                                      variant="outline" 
                                                      onClick={() => {
                                                           setPrivilegeServiceDate(format(new Date(), 'yyyy-MM-dd'));
                                                           setPrivilegeServiceNote('');
                                                           setActiveLogUsage({ privilege: pName, increment: 1 });
                                                      }}
                                                      disabled={pQty !== null && count >= pQty}
                                                      className="h-10 w-10 p-0 rounded-xl border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                                                  >
                                                      <Plus className="w-4 h-4" />
                                                  </Button>
                                              </div>
                                          </div>
                                     );
                                 })}
                            </div>
                      </CardContent>
                  </Card>
              )}

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
                                <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900">Tier-Based Suspensions</CardTitle>
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
                                  {tierFreezes.length === 0 ? (
                                      <tr><td colSpan={4} className="px-8 py-28 text-center">
                                          <div className="flex flex-col items-center gap-4 opacity-30">
                                              <Milestone className="w-12 h-12 text-slate-300" />
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No tier-based suspensions</p>
                                          </div>
                                      </td></tr>
                                  ) : (
                                      tierFreezes.map(f => (
                                          <tr key={f.id} className="hover:bg-indigo-50/20 transition-colors group">
                                              <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">
                                                  {format(parseISO(f.start_date), 'dd MMM yyyy')}
                                                  {f.reason && <div className="text-[8px] font-bold text-slate-400 mt-1 truncate max-w-[100px]">{f.reason}</div>}
                                              </td>
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
                                                          <button onClick={() => handleDeleteFreeze(f)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
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
                      <CardHeader className="bg-slate-50 p-8 flex justify-between items-center border-b shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 shadow-sm"><ShieldAlert className="w-5 h-5 text-amber-600" /></div>
                            <div>
                                <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900">Maintenance Suspensions</CardTitle>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Global & Operational Holds</p>
                            </div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left table-fixed">
                              <thead className="bg-slate-50/30 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] border-b sticky top-0 z-10">
                                  <tr>
                                      <th className="px-6 py-4 w-[40%]">Commence</th>
                                      <th className="px-6 py-4 w-[40%]">Terminate</th>
                                      <th className="px-6 py-4 w-[20%] text-center">Span</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {maintenanceFreezes.length === 0 ? (
                                      <tr><td colSpan={3} className="px-8 py-28 text-center">
                                          <div className="flex flex-col items-center gap-4 opacity-30">
                                              <AlertCircle className="w-12 h-12 text-slate-300" />
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No maintenance suspensions</p>
                                          </div>
                                      </td></tr>
                                  ) : (
                                      maintenanceFreezes.map(f => (
                                          <tr key={f.id} className="hover:bg-amber-50/20 transition-colors group">
                                              <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">
                                                  {format(parseISO(f.start_date), 'dd MMM yyyy')}
                                                  {(f.batch_id || f.maintenance_batch_id) && <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[7px] uppercase tracking-widest">Bulk</span>}
                                                  {f.reason && <div className="text-[8px] font-bold text-slate-400 mt-1 truncate max-w-[120px]">{f.reason}</div>}
                                              </td>
                                              <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">{format(parseISO(f.end_date), 'dd MMM yyyy')}</td>
                                              <td className="px-6 py-5 text-center">
                                                  <div className="inline-flex flex-col items-center justify-center">
                                                      <div className="w-12 h-6 bg-amber-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-amber-200/50">
                                                          {f.total_days}
                                                      </div>
                                                      <span className="text-[7px] font-black text-amber-600 uppercase mt-1 tracking-tighter">Days</span>
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
                                                   {(b.discount_reason || b.discount_id_url) && (
                                                       <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-indigo-500 italic uppercase tracking-tighter">
                                                           {b.discount_reason && <><Tag className="w-2 h-2" /> {b.discount_reason}</>}
                                                           {b.discount_id_url && (
                                                               <button 
                                                                   onClick={() => setViewingIdUrl(b.discount_id_url!)}
                                                                   className="ml-1 hover:text-indigo-700 flex items-center gap-0.5"
                                                                   title="View Supportive ID"
                                                               >
                                                                   <FileUp className="w-2 h-2" />
                                                                   <ExternalLink className="w-2 h-2" />
                                                               </button>
                                                           )}
                                                       </div>
                                                   )}
                                              </td>
                                              <td className="px-8 py-5 text-center">
                                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                      {b.status}
                                                  </span>
                                              </td>
                                              <td className="px-8 py-5 text-right font-black text-slate-900 text-xs tabular-nums">
                                                  {formatMoney(Number(b.price))}
                                                  {Number(b.discount) > 0 && (
                                                      <div className="text-[8px] font-bold text-red-500 mt-0.5">
                                                          -{formatMoney(Number(b.discount))} Discount
                                                      </div>
                                                  )}
                                              </td>
                                          </tr>
                                      )})
                                  )}
                              </tbody>
                          </table>
                      </CardContent>
                  </Card>
              </div>

              {(viewingMember.package_type === 'Couple' || viewingMember.package_type === 'Double' || viewingMember.package_type === 'Family') && (
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
                            <Button onClick={() => setViewingIdUrl(viewingMember.id_card_url!)} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    )}
                    {viewingMember.spouse_id_card_url && (
                        <div className="p-4 border rounded-2xl bg-slate-50">
                            <p className="text-[9px] font-black uppercase text-slate-400">Spouse ID</p>
                            <Button onClick={() => setViewingIdUrl(viewingMember.spouse_id_card_url!)} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    )}
                    {viewingMember.kids?.map((kid, i) => kid.id_card_url && (
                        <div key={i} className="p-4 border rounded-2xl bg-slate-50">
                            <p className="text-[9px] font-black uppercase text-slate-400">{kid.name} ID</p>
                            <Button onClick={() => setViewingIdUrl(kid.id_card_url!)} variant="outline" className="mt-2 w-full text-xs">View/Print</Button>
                        </div>
                    ))}
                </div>
              </Card>

              {cancellationDetails && (
                <Card className="rounded-[2.5rem] border-red-200/60 shadow-xl p-10 bg-red-50 overflow-hidden relative group">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-900 mb-8 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shadow-sm border border-red-200"><X className="w-5 h-5" /></div>
                        Cancellation Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="p-4 border rounded-2xl bg-white">
                            <p className="text-[9px] font-black uppercase text-slate-400">Cancelled On</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{format(parseISO(cancellationDetails.date), 'dd MMM yyyy')}</p>
                        </div>
                        <div className="p-4 border rounded-2xl bg-white">
                            <p className="text-[9px] font-black uppercase text-slate-400">Days Used</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{cancellationDetails.daysUsed} Days</p>
                        </div>
                        <div className="p-4 border rounded-2xl bg-white">
                            <p className="text-[9px] font-black uppercase text-slate-400">Original Amount</p>
                            <p className="text-sm font-black text-slate-900 mt-1">
                                {formatMoney((viewingMember.original_net_amount && viewingMember.original_net_amount > 0) ? viewingMember.original_net_amount : (viewingMember.actual_rate - viewingMember.discount))}
                            </p>
                        </div>
                        <div className="p-4 border rounded-2xl bg-white">
                            <p className="text-[9px] font-black uppercase text-slate-400">Prorated Amount</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{formatMoney(cancellationDetails.proratedAmount)}</p>
                        </div>
                        <div className="col-span-1 md:col-span-4 flex gap-2">
                            <Button onClick={() => { setCancelDate(cancellationDetails.date); setShowCancelModal(true); }} variant="outline" className="text-xs">Edit Cancellation</Button>
                            <Button onClick={handleDeleteCancellation} variant="secondary" className="text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200">Revert Cancellation</Button>
                        </div>
                    </div>
                </Card>
              )}

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

      {showCancelModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[360px] rounded-[2rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-6 relative flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4 border border-red-500/30">
                        <X className="w-6 h-6 text-red-400" />
                    </div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">Cancel Membership</CardTitle>
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Prorated Revenue Calculation</p>
                    <button onClick={() => setShowCancelModal(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-4 h-4 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Original Amount</p>
                        <p className="text-sm font-black text-slate-900">{formatMoney((viewingMember.original_net_amount && viewingMember.original_net_amount > 0) ? viewingMember.original_net_amount : viewingMember.net_amount)}</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600 ml-1">Cancellation Date</label>
                        <input 
                            type="date" 
                            value={cancelDate} 
                            onChange={e => setCancelDate(e.target.value)} 
                            className="w-full h-12 pl-4 pr-4 rounded-xl border-2 border-slate-100 focus:border-red-600 bg-white font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer"
                        />
                    </div>
                    
                    {(() => {
                        const start = parseISO(viewingMember.start_date);
                        const cancel = parseISO(cancelDate);
                        const daysUsed = Math.max(1, differenceInCalendarDays(cancel, start));
                        const proratedAmount = daysUsed * viewingMember.daily_rate;
                        const originalAmount = (viewingMember.original_net_amount && viewingMember.original_net_amount > 0) ? viewingMember.original_net_amount : viewingMember.net_amount;
                        const refundAmount = Math.max(0, originalAmount - proratedAmount);
                        
                        return (
                            <div className="space-y-2 pt-3 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days Used</span>
                                    <span className="text-sm font-black text-slate-900">{daysUsed} days</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prorated Charge</span>
                                    <span className="text-sm font-black text-slate-900">{formatMoney(proratedAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100 mt-3">
                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-wider">Refund Amount</span>
                                    <span className="text-base font-black text-green-700">{formatMoney(refundAmount)}</span>
                                </div>
                            </div>
                        );
                    })()}

                    <Button 
                        onClick={handleCancelMembership}
                        className="w-full h-12 rounded-[1.2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-lg mt-3 active:scale-95 transition-all bg-red-600 hover:bg-red-700 text-white"
                    >
                        Confirm Cancellation
                    </Button>
                </CardContent>
            </Card>
        </div>
      )}

      {showRevertCancelModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[400px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-10 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/30">
                        <RotateCcw className="w-7 h-7 text-amber-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Revert Cancellation</CardTitle>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Restore Membership</p>
                    <button onClick={() => setShowRevertCancelModal(false)} className="absolute top-8 right-8 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-5 h-5 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-6">
                    <p className="text-sm text-slate-600 text-center font-medium">
                        Are you sure you want to revert this cancellation? This will restore the membership to active status and reverse any recorded refunds.
                    </p>
                    <div className="flex gap-4 mt-6">
                        <Button 
                            onClick={() => setShowRevertCancelModal(false)}
                            variant="outline"
                            className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-wider"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={confirmRevertCancellation}
                            className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-wider bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            Confirm
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {bulkFreezeToDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[400px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-10 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
                        <Trash2 className="w-7 h-7 text-red-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Delete Bulk Suspension</CardTitle>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Warning</p>
                    <button onClick={() => setBulkFreezeToDelete(null)} className="absolute top-8 right-8 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-5 h-5 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-6">
                    <p className="text-sm text-slate-600 text-center font-medium">
                        This suspension was applied as part of a bulk operation. Deleting it here will revoke the suspension for <strong>ALL members</strong> in this batch. Are you sure you want to proceed?
                    </p>
                    <div className="flex gap-4 mt-6">
                        <Button 
                            onClick={() => setBulkFreezeToDelete(null)}
                            variant="outline"
                            className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-wider"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={confirmDeleteBulkFreeze}
                            className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-wider bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete All
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {showFreezeModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[600px] max-h-[85vh] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20 flex flex-col">
                <CardHeader className="bg-[#0f172a] text-white p-6 relative flex flex-col items-center text-center shrink-0">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/30">
                        <Snowflake className="w-6 h-6 text-indigo-400" />
                    </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">Authorize Suspension</CardTitle>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Temporary Portfolio Hold</p>
                            {editingFreezeId && freezes.find(f => f.id === editingFreezeId)?.is_maintenance && (
                                <div className="mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Maintenance Freeze</div>
                            )}
                    <button onClick={() => setShowFreezeModal(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-4 h-4 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-6 space-y-6 overflow-y-auto">
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
                                <p className="text-[11px] font-black text-red-700 uppercase tracking-tight">Suspension Breach</p>
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
                                    disabled={maxAllowed === 0 && !freezes.find(f => f.id === editingFreezeId)?.is_maintenance}
                                    className={`w-full h-16 pl-6 pr-14 rounded-2xl border-2 focus:ring-0 font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer ${validation.error || (maxAllowed === 0 && !freezes.find(f => f.id === editingFreezeId)?.is_maintenance) ? 'border-red-500 bg-red-50/10 text-red-900 focus:border-red-600 opacity-50' : 'border-slate-100 focus:border-indigo-600 bg-white'}`}
                                />
                                <Calendar className={`absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${validation.error || (maxAllowed === 0 && !freezes.find(f => f.id === editingFreezeId)?.is_maintenance) ? 'text-red-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Reason / Note</label>
                            <textarea 
                                value={freezeForm.reason} 
                                onChange={e => setFreezeForm({...freezeForm, reason: e.target.value})} 
                                placeholder="Enter reason for suspension..."
                                className="w-full h-24 p-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 bg-white font-bold text-xs transition-all resize-none"
                            />
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
                            className={`w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all ${validation.error || maxAllowed === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#a5b4fc] hover:bg-[#93a5f7] text-white'}`}
                        >
                            {editingFreezeId ? 'Save Changes' : 'Freeze Member'}
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

      {viewingIdUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Supportive ID Document</h3>
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = viewingIdUrl;
                                link.download = `ID_Document_${viewingMember.membership_number}_${new Date().getTime()}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                        </Button>
                        <Button 
                            onClick={() => {
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                    printWindow.document.write(`
                                        <html>
                                            <head>
                                                <title>Print ID Document</title>
                                                <style>
                                                    body { margin: 0; display: flex; justify-content: center; align-items: center; background: white; min-height: 100vh; }
                                                    img { max-width: 100%; height: auto; }
                                                    @media print {
                                                        body { margin: 0; }
                                                        img { max-width: 100%; }
                                                    }
                                                </style>
                                            </head>
                                            <body onload="window.print(); window.close();">
                                                ${viewingIdUrl.startsWith('data:application/pdf') 
                                                    ? `<embed src="${viewingIdUrl}" type="application/pdf" width="100%" height="100%">`
                                                    : `<img src="${viewingIdUrl}" />`
                                                }
                                            </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                }
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                        >
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print
                        </Button>
                        <button onClick={() => setViewingIdUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-2">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-auto flex items-center justify-center bg-slate-50">
                    {viewingIdUrl.startsWith('data:image') ? (
                        <img src={viewingIdUrl} alt="ID Document" className="max-w-full h-auto rounded-xl shadow-sm" />
                    ) : viewingIdUrl.startsWith('data:application/pdf') ? (
                        <iframe src={viewingIdUrl} className="w-full h-[60vh] rounded-xl shadow-sm border-0" title="ID Document PDF" />
                    ) : (
                        <div className="text-center p-8">
                            <p className="text-sm font-bold text-slate-600 mb-4">Document format not supported for direct preview.</p>
                            <a href={viewingIdUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                                <ExternalLink className="w-4 h-4" /> Open in New Tab
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      {showNotesModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[500px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-10 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
                        <ClipboardList className="w-7 h-7 text-indigo-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Member Intelligence Notes</CardTitle>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Confidential Operational Records</p>
                    <button onClick={() => setShowNotesModal(false)} className="absolute top-8 right-8 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-5 h-5 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-600 ml-1">Detailed Observations & History</label>
                        <textarea 
                            value={memberNotes} 
                            onChange={e => setMemberNotes(e.target.value)} 
                            className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 bg-white font-medium text-sm leading-relaxed transition-all min-h-[250px]"
                            placeholder="Enter detailed notes about this member's preferences, history, or special requirements..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button 
                            onClick={() => setShowNotesModal(false)}
                            variant="outline"
                            className="flex-1 h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em]"
                        >
                            Discard
                        </Button>
                        <Button 
                            onClick={handleSaveNotes}
                            className="flex-[2] h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Save Intelligence
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {activeLogUsage && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[400px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-emerald-900 text-white p-8 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-400/30">
                        <ClipboardList className="w-7 h-7 text-emerald-400" />
                    </div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">Log Benefit Usage</CardTitle>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{activeLogUsage.privilege}</p>
                    <button onClick={() => setActiveLogUsage(null)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90">
                        <X className="w-4 h-4 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg ${activeLogUsage.increment > 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
                            {activeLogUsage.increment > 0 ? '+' : ''}{activeLogUsage.increment}
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Adjustment Quantity</p>
                            <p className="text-xs font-bold text-slate-700">Updating usage balance</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Date (Actual)</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={privilegeServiceDate}
                                    onChange={(e) => setPrivilegeServiceDate(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-slate-100 focus:border-emerald-600 bg-white font-black text-sm transition-all appearance-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Note (Optional)</label>
                            <input 
                                type="text" 
                                placeholder="E.G. GUEST PASS USED FOR SPOUSE"
                                value={privilegeServiceNote}
                                onChange={(e) => setPrivilegeServiceNote(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 focus:border-emerald-600 bg-white font-black text-[10px] transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button 
                            onClick={() => setActiveLogUsage(null)}
                            variant="outline"
                            className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200 text-slate-500"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => handleUpdatePrivilege(activeLogUsage.privilege, activeLogUsage.increment, privilegeServiceDate, privilegeServiceNote)}
                            className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all"
                        >
                            {activeLogUsage.increment > 0 ? 'Log Usage' : 'Reverse Entry'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-[601] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
            <Card className="w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden bg-white border border-slate-200">
                <CardHeader className="bg-red-950 text-white p-10 text-center relative">
                    <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-400/30 shadow-2xl">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">Protocol Reset</CardTitle>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Authorize History Purge</p>
                </CardHeader>
                <CardContent className="p-10 text-center space-y-8">
                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                        You are about to irreversibly delete all benefit utilization records for <span className="text-red-600 font-black">Member #{viewingMember.membership_number}</span>. This action cannot be undone and will reset all running yields to zero.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button 
                            variant="outline" 
                            onClick={() => setShowClearConfirm(false)}
                            className="h-14 rounded-2xl border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px]"
                        >
                            Abort
                        </Button>
                        <Button 
                            onClick={() => handleClearPrivilegeHistory()}
                            className="h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20"
                        >
                            Purge Records
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {showPrivilegeHistoryModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-2xl max-h-[90vh] rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20 flex flex-col">
                <CardHeader className="bg-emerald-950 text-white p-10 relative flex flex-col items-center text-center shrink-0">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 border border-emerald-400/30 shadow-2xl">
                        <History className="w-8 h-8 text-emerald-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">Benefit Usage Audit Log</CardTitle>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Benefit Utilization Transparency Ledger</p>
                    <button onClick={() => setShowPrivilegeHistoryModal(false)} className="absolute top-10 right-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-6 h-6 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-10 overflow-y-auto custom-scrollbar bg-slate-50/30 text-slate-900">
                    {!viewingMember.privilege_usage || viewingMember.privilege_usage.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[2.5rem] border border-slate-200 border-dashed">
                            <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">No utilization history recorded</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {viewingMember.privilege_usage.map(usage => (
                                <div key={usage.privilege} className="space-y-4">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 px-6 py-2 bg-emerald-50 border border-emerald-100 rounded-full inline-block">
                                        {usage.privilege} Entitlements
                                    </h3>
                                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100">
                                        {!usage.history || usage.history.length === 0 ? (
                                            <div className="p-12 text-[10px] font-bold text-slate-400 uppercase text-center italic tracking-widest leading-relaxed">
                                                Legacy record detected. <br/> Comprehensive snapshots started after System Version 2.4.
                                            </div>
                                        ) : (
                                            [...usage.history].sort((a, b) => {
                                                const dateA = a.service_date || a.date.split('T')[0];
                                                const dateB = b.service_date || b.date.split('T')[0];
                                                if (dateA !== dateB) return dateB.localeCompare(dateA);
                                                return b.date.localeCompare(a.date);
                                            }).map((entry, idx) => (
                                                <div key={idx} className="p-10 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                                    <div className="flex items-center gap-8">
                                                        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 group-hover:rotate-12 ${entry.change > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-inner' : 'bg-red-50 border-red-200 text-red-600 shadow-inner'}`}>
                                                            {entry.change > 0 ? <Plus className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                                    {entry.change > 0 ? 'Credit Adjustment' : 'Benefit Redaction'}
                                                                </p>
                                                                <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${entry.change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {entry.change > 0 ? '+' : ''}{entry.change} Units
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-1 mt-2">
                                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <Calendar className="w-3.5 h-3.5" /> Usage Date: {format(parseISO(entry.service_date || entry.date), 'dd MMM yyyy')}
                                                                </p>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <UserCheck className="w-3.5 h-3.5 text-indigo-400/60" /> Authorized by: {entry.by}
                                                                </p>
                                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 italic">
                                                                    <Clock className="w-3.5 h-3.5 text-amber-400/60" /> Logged on {format(parseISO(entry.date), 'dd MMM yyyy @ HH:mm:ss')}
                                                                </p>
                                                                {entry.note && (
                                                                    <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 mt-1 inline-block self-start">
                                                                        Memo: {entry.note}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{entry.new_total}</div>
                                                        <div className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 mt-2 shadow-sm">Running Yield</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
};

export default MemberProfileView;