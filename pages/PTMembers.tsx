import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { PTMember, PTSession, Staff, Sale } from '../types';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { 
    User, Dumbbell, Calendar, Search, Plus, Play, CheckCircle, AlertTriangle, 
    History, DollarSign, Clock, FileText, Check, TrendingUp, Mail, Phone, 
    Award, Sparkles, Filter, Edit3, ShieldCheck, ArrowLeft, ArrowRight, Eye, ChevronRight, Trash2, Printer, X,
    Store, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { SignaturePad } from '../components/SignatureModal';

export default function PTMembers() {
    const { user, isSuperAdmin } = useAuth();
    const { currentOutlet, currentProperty, settings, setPageLoading, formatMoney, outlets = [] } = useSettings();
    const logoUrl = currentOutlet?.logo_url || currentProperty?.logo_url || settings?.logo_url || '';
    
    const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');

    const allowedOutletsInProperty = useMemo(() => {
        if (!currentProperty || !user || !outlets) return [];
        if (isSuperAdmin || user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin') {
            return outlets.filter(o => o.property_id === currentProperty.id);
        }
        return outlets.filter(o => 
            o.property_id === currentProperty.id && 
            user.allowed_outlets?.includes(o.id)
        );
    }, [currentProperty, user, outlets, isSuperAdmin]);

    const canSwitchScope = Boolean(user && allowedOutletsInProperty.length > 1);
    
    const handleTriggerPrint = () => {
        setTimeout(() => {
            try {
                window.print();
            } catch (err) {
                console.warn('[Print] Window print execution caught:', err);
            }
        }, 50);
    };
    const [ptMembers, setPtMembers] = useState<PTMember[]>([]);
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed'>('All');
    const [activeTab, setActiveTab] = useState<'history' | 'profile'>('history');
    
    const [selectedMember, setSelectedMember] = useState<PTMember | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<PTMember | null>(null);
    const [selectedMemberSale, setSelectedMemberSale] = useState<Sale | null>(null);
    const [sessions, setSessions] = useState<PTSession[]>([]);
    
    // Log Session form states
    const [showLogSession, setShowLogSession] = useState(false);
    const [sessionNotes, setSessionNotes] = useState('');
    const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [sessionTrainerId, setSessionTrainerId] = useState('');
    const [guestSignature, setGuestSignature] = useState('');

    // Edit Session form states
    const [editingSession, setEditingSession] = useState<PTSession | null>(null);
    const [editSessionDate, setEditSessionDate] = useState('');
    const [editSessionTrainerId, setEditSessionTrainerId] = useState('');
    const [editSessionNotes, setEditSessionNotes] = useState('');
    const [editGuestSignature, setEditGuestSignature] = useState('');

    // Printable Session Slip & Package Form state
    const [printingSession, setPrintingSession] = useState<PTSession | null>(null);
    const [printingPackageForm, setPrintingPackageForm] = useState<boolean>(false);
    const [deletingSession, setDeletingSession] = useState<PTSession | null>(null);
    const [deletingMember, setDeletingMember] = useState<PTMember | null>(null);

    const executeDeleteMember = async () => {
        if (!deletingMember) return;
        const targetId = deletingMember.id;
        setPageLoading(true);
        try {
            await db.deletePTMember(targetId);
            toast.success("PT Member deleted successfully!");
            setDeletingMember(null);
            if (selectedMember?.id === targetId) {
                setSelectedMember(null);
            }
            if (currentOutlet && currentProperty) {
                const isProp = viewScope === 'property';
                const allowedIds = allowedOutletsInProperty.map(o => o.id);
                const updatedMembers = isProp 
                    ? await db.getPTMembers(currentProperty.id, true, undefined, undefined, allowedIds) 
                    : await db.getPTMembers(currentOutlet.id, false);
                setPtMembers(updatedMembers);
            }
        } catch (err: any) {
            toast.error("Failed to delete PT member: " + (err.message || ''));
        } finally {
            setPageLoading(false);
        }
    };

    const startEditSession = (s: PTSession) => {
        setEditingSession(s);
        let dateVal = s.date;
        try {
            dateVal = new Date(s.date).toISOString().slice(0, 16);
        } catch (e) {
            dateVal = new Date().toISOString().slice(0, 16);
        }
        setEditSessionDate(dateVal);
        setEditSessionTrainerId(s.staff_id || '');
        setEditSessionNotes(s.notes || '');
        setEditGuestSignature(s.guest_signature || '');
    };

    const handleSaveEditSession = async () => {
        if (!editingSession || !selectedMember) return;
        setPageLoading(true);
        try {
            const updatedDate = editSessionDate ? new Date(editSessionDate).toISOString() : editingSession.date;
            await db.updatePTSession(editingSession.id, {
                date: updatedDate,
                staff_id: editSessionTrainerId,
                notes: editSessionNotes,
                guest_signature: editGuestSignature
            });

            toast.success("Session details updated successfully!");
            setEditingSession(null);

            // Notification
            await db.addNotification({
                title: `PT Session Updated: ${selectedMember.guest_name}`,
                message: `Session details updated for ${selectedMember.guest_name}.`,
                type: 'info',
                outlet_id: currentOutlet?.id,
                user_id: undefined
            });

            // Reload sessions
            const activeTargetPkg = selectedPackage || selectedMember;
            const updatedSessions = await db.getPTSessions(activeTargetPkg.id);
            setSessions(updatedSessions);

            window.dispatchEvent(new Event('booking_updated'));
        } catch (err: any) {
            toast.error("Failed to update session: " + (err.message || ''));
        } finally {
            setPageLoading(false);
        }
    };

    const handleDeleteSession = (s: PTSession) => {
        setDeletingSession(s);
    };

    const executeDeleteSession = async () => {
        if (!deletingSession || !selectedMember) return;
        const activeTargetPkg = selectedPackage || selectedMember;
        const targetId = deletingSession.id;
        setPageLoading(true);
        try {
            await db.deletePTSession(targetId, activeTargetPkg.id);
            toast.success("Session deleted successfully!");

            // Notification
            await db.addNotification({
                title: `PT Session Deleted: ${activeTargetPkg.guest_name}`,
                message: `A training session for ${activeTargetPkg.guest_name} was removed.`,
                type: 'warning',
                outlet_id: currentOutlet?.id,
                user_id: undefined
            });

            setDeletingSession(null);

            // Reload data
            const isProp = viewScope === 'property';
            const allowedIds = allowedOutletsInProperty.map(o => o.id);
            const updatedMembers = isProp 
                ? await db.getPTMembers(currentProperty!.id, true, undefined, undefined, allowedIds) 
                : await db.getPTMembers(currentOutlet!.id, false);
            setPtMembers(updatedMembers);

            const updatedSessions = await db.getPTSessions(activeTargetPkg.id);
            setSessions(updatedSessions);

            const updatedSelected = updatedMembers.find(m => m.id === selectedMember.id);
            if (updatedSelected) {
                setSelectedMember(updatedSelected);
            } else {
                setSelectedMember(prev => prev ? { ...prev, used_sessions: Math.max(0, (prev.used_sessions || 1) - 1) } : null);
            }
            
            if (selectedPackage) {
                // If it's a sub-package, it's not going to be in updatedMembers. Wait, we need to fetch the sub-package?
                // For now, let's just decrement the local state so the UI updates immediately.
                setSelectedPackage(prev => prev ? { ...prev, used_sessions: Math.max(0, (prev.used_sessions || 1) - 1) } : null);
            }
            window.dispatchEvent(new Event('booking_updated'));
        } catch (err: any) {
            toast.error("Failed to delete session: " + (err.message || ''));
        } finally {
            setPageLoading(false);
        }
    };

    const loadData = async () => {
        if (!currentOutlet || !currentProperty) return;
        setLoading(true);
        try {
            const isProperty = viewScope === 'property';
            const allowedIds = allowedOutletsInProperty.map(o => o.id);

            let membersData: PTMember[] = [];
            if (isProperty) {
                membersData = await db.getPTMembers(currentProperty.id, true, undefined, undefined, allowedIds);
            } else {
                membersData = await db.getPTMembers(currentOutlet.id, false);
            }
            setPtMembers(membersData);
            
            let staffData: Staff[] = [];
            if (isProperty || currentOutlet.id === 'all') {
                staffData = await db.getStaff(currentProperty.id, true, allowedIds);
            } else {
                staffData = await db.getStaff(currentOutlet.id);
            }
            console.log('DEBUG: staffData loaded:', staffData);
            setStaff(staffData);

            let salesData: Sale[] = [];
            if (isProperty) {
                salesData = await db.getSales(currentProperty.id, true);
            } else {
                salesData = await db.getSales(currentOutlet.id, false);
            }
            setAllSales(salesData || []);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to load PT members data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const handleBookingUpdate = () => {
            loadData();
        };
        window.addEventListener('booking_updated', handleBookingUpdate);
        return () => {
            window.removeEventListener('booking_updated', handleBookingUpdate);
        };
    }, [currentOutlet?.id, currentProperty?.id, viewScope]);

    const handleUpdateTrainer = async (trainerId: string) => {
        const activeTarget = selectedPackage || selectedMember;
        if (!activeTarget) return;
        setPageLoading(true);
        try {
            await db.updatePTMember(activeTarget.id, { trainer_id: trainerId });
            const updated = { ...activeTarget, trainer_id: trainerId };
            if (selectedPackage) setSelectedPackage(updated);
            if (selectedMember && selectedMember.id === activeTarget.id) setSelectedMember(updated);
            setPtMembers(prev => prev.map(m => m.id === activeTarget.id ? updated : m));
            
            const trainerName = staff.find(s => s.id === trainerId)?.name || 'a new trainer';
            toast.success(`Assigned ${trainerName} to ${activeTarget.guest_name}`);
            
            // Trigger Notification
            await db.addNotification({
                title: `PT Trainer Assigned: ${activeTarget.guest_name}`,
                message: `${activeTarget.guest_name} was assigned to trainer ${trainerName}.`,
                type: 'info',
                outlet_id: currentOutlet?.id,
                user_id: undefined
            });
        } catch (err: any) {
            toast.error("Failed to update trainer");
        } finally {
            setPageLoading(false);
        }
    };

    const handleSelectMember = async (member: PTMember) => {
        setSelectedMember(member);
        setSelectedPackage(null);
        setSessionTrainerId(member.trainer_id || user?.id || '');
        setShowLogSession(false);
        setPageLoading(true);
        try {
            const sessionsData = await db.getPTSessions(member.id);
            setSessions(sessionsData);
            
            if (member.sale_id) {
                const saleData = await db.getSaleById(member.sale_id);
                setSelectedMemberSale(saleData);
            } else {
                setSelectedMemberSale(null);
            }
        } catch (err) {
            toast.error("Failed to load member profile details");
        } finally {
            setPageLoading(false);
        }
    };

    const handleSelectPackage = async (pkg: PTMember) => {
        setSelectedPackage(pkg);
        setSessionTrainerId(pkg.trainer_id || selectedMember?.trainer_id || user?.id || '');
        setShowLogSession(false);
        setPageLoading(true);
        try {
            const sessionsData = await db.getPTSessions(pkg.id);
            setSessions(sessionsData);
            
            if (pkg.sale_id) {
                const saleData = await db.getSaleById(pkg.sale_id);
                setSelectedMemberSale(saleData);
            } else {
                setSelectedMemberSale(null);
            }
        } catch (err) {
            toast.error("Failed to load package session records");
        } finally {
            setPageLoading(false);
        }
    };

    const handleLogSession = async () => {
        const activeTargetPkg = selectedPackage || selectedMember;
        if (!activeTargetPkg || !user) return;
        if (!guestSignature) {
            toast.error("Guest signature is required to verify session attendance.");
            return;
        }

        if (sessions.length >= activeTargetPkg.total_sessions) {
            toast.error("All package sessions have already been completed!");
            return;
        }
        
        setPageLoading(true);
        try {
            const dateToLog = sessionDate ? new Date(sessionDate).toISOString() : new Date().toISOString();
            await db.addPTSession({
                pt_member_id: activeTargetPkg.id,
                date: dateToLog,
                staff_id: sessionTrainerId || user.id,
                notes: sessionNotes,
                guest_signature: guestSignature
            });

            const newUsedCount = activeTargetPkg.used_sessions + 1;
            toast.success(`Session #${newUsedCount} logged successfully!`);
            setShowLogSession(false);
            setSessionNotes('');
            setGuestSignature('');
            setSessionDate(new Date().toISOString().slice(0, 16));

            // Trigger Real-time Notification for Sales Bell
            const trainerObj = staff.find(s => s.id === (sessionTrainerId || user.id));
            await db.addNotification({
                title: `PT Session Logged: ${activeTargetPkg.guest_name}`,
                message: `Session #${newUsedCount} of ${activeTargetPkg.total_sessions} completed for ${activeTargetPkg.guest_name} by ${trainerObj?.name || 'Trainer'}. Verified with digital signature.`,
                type: 'success',
                outlet_id: currentOutlet?.id,
                user_id: undefined
            });

            // Reload data and update selected member counts
            const updatedMembers = await db.getPTMembers(currentOutlet!.id);
            setPtMembers(updatedMembers);
            
            const updatedTarget = updatedMembers.find(m => m.id === activeTargetPkg.id);
            if (updatedTarget) {
                if (selectedPackage) {
                    setSelectedPackage(updatedTarget);
                }
                const updatedSelectedMember = updatedMembers.find(m => m.id === selectedMember?.id);
                if (updatedSelectedMember) {
                    setSelectedMember(updatedSelectedMember);
                }
                const sessionsData = await db.getPTSessions(updatedTarget.id);
                setSessions(sessionsData);
                window.dispatchEvent(new Event('booking_updated'));
            }
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('schema cache') || msg.includes('42P01') || msg.includes('relation "public.pt_sessions" does not exist') || msg.includes('row-level security policy') || msg.includes('violates row-level security')) {
                toast.error("Database schema or RLS policies need updating. Run the SQL setup script.");
            } else {
                toast.error("Failed to log session: " + msg);
            }
        } finally {
            setPageLoading(false);
        }
    };

    // Calculate Member Revenue (combining PT package revenue and membership revenue for the same guest)
    const getMemberRevenue = (member: PTMember) => {
        const matchingSales = allSales.filter(s => 
            (member.sale_id && s.id === member.sale_id) || 
            (s.guest_name && s.guest_name.toLowerCase() === member.guest_name.toLowerCase()) ||
            (member.phone && (s as any).phone && (s as any).phone === member.phone) ||
            (member.email && (s as any).email && (s as any).email.toLowerCase() === member.email.toLowerCase())
        );
        let revenue = matchingSales.reduce((sum, s) => sum + (s.net_amount || (s as any).total_amount || 0), 0);
        if (revenue === 0 && selectedMember?.id === member.id && selectedMemberSale?.net_amount) {
            revenue = selectedMemberSale.net_amount;
        }
        return revenue;
    };

    const getMembershipRevenueForMember = (member: PTMember) => {
        const matchingSales = allSales.filter(s => 
            ((s.guest_name && s.guest_name.toLowerCase() === member.guest_name.toLowerCase()) ||
             (member.phone && (s as any).phone && (s as any).phone === member.phone) ||
             (member.email && (s as any).email && (s as any).email.toLowerCase() === member.email.toLowerCase())) &&
            s.category !== 'Personal Training' && (!member.sale_id || s.id !== member.sale_id)
        );
        return matchingSales.reduce((sum, s) => sum + (s.net_amount || (s as any).total_amount || 0), 0);
    };

    // Filtered PT Members directory
    const filteredMembers = ptMembers.filter(m => {
        const matchesSearch = m.guest_name.toLowerCase().includes(search.toLowerCase()) || 
                              (m.phone && m.phone.includes(search)) || 
                              (m.email && m.email.toLowerCase().includes(search.toLowerCase()));
        
        const isCompleted = m.used_sessions >= m.total_sessions;
        if (statusFilter === 'Active' && isCompleted) return false;
        if (statusFilter === 'Completed' && !isCompleted) return false;
        
        return matchesSearch;
    });

    // Overall Summary Metrics
    const totalClientsCount = ptMembers.length;
    const activeClientsCount = ptMembers.filter(m => m.used_sessions < m.total_sessions).length;
    const completedClientsCount = ptMembers.filter(m => m.used_sessions >= m.total_sessions).length;
    const totalPtRevenue = ptMembers.reduce((sum, m) => sum + getMemberRevenue(m), 0);

    if (loading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center space-y-4">
                <Dumbbell className="w-12 h-12 text-indigo-500 animate-bounce" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading PT Client Directory...</p>
            </div>
        );
    }

    const currentRevenue = selectedMember ? getMemberRevenue(selectedMember) : 0;
    const currentUsed = selectedMember?.used_sessions || 0;
    const currentTotal = selectedMember?.total_sessions || 10;
    const currentRemaining = Math.max(0, currentTotal - currentUsed);
    const renderSessionSlip = () => {
        if (!printingSession || !selectedMember) return null;
        return (
            <div id="printable-session-slip" className="p-6 bg-white border-2 border-slate-900 rounded-2xl space-y-5 print:p-4 print:space-y-4 print:border-none print:shadow-none">
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                    <div className="flex items-center gap-4">
                        {logoUrl ? (
                            <img 
                                src={logoUrl} 
                                alt="Property Logo" 
                                referrerPolicy="no-referrer"
                                className="h-14 w-auto max-w-[120px] max-h-14 object-contain rounded-lg shrink-0"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (!target.src.includes('corsproxy') && logoUrl.startsWith('http')) {
                                        target.src = `https://corsproxy.io/?${encodeURIComponent(logoUrl)}`;
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <Dumbbell className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                                {currentProperty?.name || 'HEALTH & FITNESS CLUB'}
                            </h2>
                            <p className="text-xs font-bold text-slate-600">
                                {currentOutlet?.name || 'Personal Training Department'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-1">
                                Official Member Session Attendance Voucher
                            </p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="inline-block bg-slate-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded-md tracking-widest">
                            SESSION SLIP
                        </div>
                        <p className="text-xs font-mono font-bold text-slate-700 mt-2">
                            Ref: PTS-{(printingSession.id || '').slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500">
                            Issued: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
                        </p>
                    </div>
                </div>

                {/* Client & Package Info Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Member / Client</p>
                        <p className="font-black text-slate-900 text-sm">{selectedMember.guest_name}</p>
                        {selectedMember.phone && <p className="font-semibold text-slate-600 mt-0.5">Phone: {selectedMember.phone}</p>}
                        {selectedMember.email && <p className="font-semibold text-slate-600">Email: {selectedMember.email}</p>}
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PT Package Details</p>
                        <p className="font-bold text-slate-800">
                            Total Package: <span className="font-black text-indigo-700">{selectedMember.total_sessions} Sessions</span>
                        </p>
                        <p className="font-bold text-slate-800">
                            Sessions Used: <span className="font-black text-amber-700">{selectedMember.used_sessions}</span> / Remaining: <span className="font-black text-emerald-700">{Math.max(0, selectedMember.total_sessions - selectedMember.used_sessions)}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                            Validity: {selectedMember.start_date} to {selectedMember.end_date}
                        </p>
                    </div>
                </div>

                {/* Session Specific Details */}
                <div className="border-2 border-indigo-100 rounded-xl p-4 bg-indigo-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                        <div>
                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Session Date & Time</p>
                            <p className="font-black text-slate-900 text-sm">
                                {(() => {
                                    try { return format(new Date(printingSession.date), 'EEEE, MMMM dd, yyyy • hh:mm a'); }
                                    catch (e) { return printingSession.date; }
                                })()}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Conducting Trainer</p>
                            <p className="font-black text-indigo-900 text-sm">
                                {staff.find(st => st.id === printingSession.staff_id)?.name || 'Health Club Trainer'}
                            </p>
                        </div>
                    </div>

                    {printingSession.notes ? (
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Session Workout Notes / Focus</p>
                            <p className="text-xs font-medium text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                                {printingSession.notes}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs italic text-slate-500">No workout notes recorded for this session.</p>
                    )}
                </div>

                {/* Verification Signatures & Stamp */}
                <div className="pt-4 grid grid-cols-2 gap-6 items-end">
                    <div className="border border-slate-200 rounded-xl p-3 text-center bg-slate-50">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Guest Digital Signature</p>
                        {printingSession.guest_signature ? (
                            <img src={printingSession.guest_signature} alt="Guest Signature" className="h-12 object-contain mx-auto my-1" />
                        ) : (
                            <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 italic">Signature Verified</div>
                        )}
                        <p className="text-[10px] font-bold text-slate-700 border-t border-slate-200 pt-1 mt-1">{selectedMember.guest_name}</p>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 text-center bg-slate-50">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Authorized Staff / Trainer</p>
                        <div className="h-12 border-b border-dashed border-slate-300 mx-4 flex items-end justify-center pb-1 text-xs font-bold text-slate-600">
                            {staff.find(st => st.id === printingSession.staff_id)?.name || 'Trainer Signature'}
                        </div>
                        <p className="text-[10px] font-bold text-slate-700 pt-1">Official Gym Stamp & Approval</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-2 border-t border-slate-200">
                    <p className="text-[10px] font-semibold text-slate-400">
                        Thank you for training with us at {currentProperty?.name || 'our Health Club'}. Please keep this voucher for your personal records.
                    </p>
                </div>
            </div>
        );
    };

    const renderPackageCard = () => {
        const activeTargetPkg = selectedPackage || selectedMember;
        if (!printingPackageForm || !activeTargetPkg) return null;

        return (
            <div id="printable-package-card" className="p-6 bg-white border-2 border-slate-900 rounded-2xl flex flex-col space-y-4 print:p-4 print:space-y-3 print:border-none print:shadow-none print:break-inside-avoid print:max-h-none">
                {/* Gym & Document Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                    <div className="flex items-center gap-4">
                        {logoUrl ? (
                            <img 
                                src={logoUrl} 
                                alt="Property Logo" 
                                referrerPolicy="no-referrer"
                                className="h-16 w-auto max-w-[140px] max-h-16 object-contain rounded-lg shrink-0"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (!target.src.includes('corsproxy') && logoUrl.startsWith('http')) {
                                        target.src = `https://corsproxy.io/?${encodeURIComponent(logoUrl)}`;
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <Dumbbell className="w-7 h-7" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wider">
                                {currentProperty?.name || 'HEALTH & FITNESS CLUB'}
                            </h2>
                            <p className="text-xs font-bold text-slate-700">
                                {currentOutlet?.name || 'Personal Training Department'}
                            </p>
                            <p className="text-[11px] font-bold text-indigo-900 mt-1 uppercase">
                                Official PT Member Session Attendance & Voucher Sheet
                            </p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="inline-block bg-indigo-950 text-white text-[11px] font-black uppercase px-4 py-1.5 rounded-md tracking-widest">
                            {activeTargetPkg.total_sessions}-SESSION PACKAGE CARD
                        </div>
                        <p className="text-xs font-mono font-bold text-slate-700 mt-2">
                            Sale Ref: #{(activeTargetPkg.sale_id || activeTargetPkg.id).slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500">
                            Issued: {format(new Date(), 'dd MMM yyyy')}
                        </p>
                    </div>
                </div>

                {/* Member & Package Info Summary */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Member Details</p>
                        <p className="font-black text-slate-900 text-sm">{activeTargetPkg.guest_name}</p>
                        {activeTargetPkg.phone && <p className="font-semibold text-slate-600 mt-0.5">Phone: {activeTargetPkg.phone}</p>}
                        {activeTargetPkg.email && <p className="font-semibold text-slate-600">Email: {activeTargetPkg.email}</p>}
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Package & Validity</p>
                        <p className="font-bold text-slate-900">{activeTargetPkg.notes || `${activeTargetPkg.total_sessions} Sessions PT Package`}</p>
                        <p className="font-bold text-slate-800 mt-1">
                            Sessions Completed: <span className="font-black text-indigo-700">{activeTargetPkg.used_sessions} / {activeTargetPkg.total_sessions}</span> • Balance Left: <span className="font-black text-emerald-700">{Math.max(0, activeTargetPkg.total_sessions - activeTargetPkg.used_sessions)}</span>
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">
                            Valid From: {activeTargetPkg.start_date} To {activeTargetPkg.end_date}
                        </p>
                    </div>
                </div>

                {/* All Sessions Grid Table */}
                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session Attendance Logbook</p>
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider">
                                <th className="p-2 border border-slate-900 text-center w-12">#</th>
                                <th className="p-2 border border-slate-900 w-28">Status</th>
                                <th className="p-2 border border-slate-900">Date & Time</th>
                                <th className="p-2 border border-slate-900">Conducting Trainer</th>
                                <th className="p-2 border border-slate-900">Workout Notes</th>
                                <th className="p-2 border border-slate-900 text-center w-28">Member Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: activeTargetPkg.total_sessions || 10 }, (_, idx) => {
                                const slotNum = idx + 1;
                                const sortedSess = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                const s = sortedSess[idx];
                                const trainerObj = s ? staff.find(st => st.id === s.staff_id) : null;

                                let formattedDate = '-';
                                if (s) {
                                    try { formattedDate = format(new Date(s.date), 'dd MMM yyyy, hh:mm a'); }
                                    catch (e) { formattedDate = s.date; }
                                }

                                return (
                                    <tr key={slotNum} className={slotNum % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                        <td className="p-2 border border-slate-300 font-black text-center text-slate-900">{slotNum}</td>
                                        <td className="p-2 border border-slate-300 font-bold">
                                            {s ? (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded">
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded">
                                                    Available
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2 border border-slate-300 font-semibold text-slate-800">{s ? formattedDate : 'Unbooked'}</td>
                                        <td className="p-2 border border-slate-300 font-bold text-slate-800">{s ? (trainerObj?.name || 'Trainer') : '-'}</td>
                                        <td className="p-2 border border-slate-300 text-slate-700">{s ? (s.notes || 'Workout completed') : '-'}</td>
                                        <td className="p-2 border border-slate-300 text-center">
                                            {s && s.guest_signature ? (
                                                <img src={s.guest_signature} alt="Sig" className="h-6 object-contain mx-auto" />
                                            ) : s ? (
                                                <span className="text-[9px] italic text-slate-400">Verified</span>
                                            ) : (
                                                <span className="text-[9px] text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Signatures */}
                <div className="pt-4 grid grid-cols-2 gap-8 items-end mt-8 print:mt-12">
                    <div className="border-t border-slate-300 pt-2 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-6">Member Acknowledgement</p>
                        <p className="text-xs font-bold text-slate-800">{activeTargetPkg.guest_name}</p>
                    </div>
                    <div className="border-t border-slate-300 pt-2 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-6">Authorized PT Manager</p>
                        <p className="text-xs font-bold text-slate-800">{currentProperty?.name || 'Health Club Management'}</p>
                    </div>
                </div>
            </div>
        );
    };

    const progressPct = Math.min(100, Math.round((currentUsed / Math.max(1, currentTotal)) * 100));

    return (
        <>
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 no-print">
            
            {/* VIEW MODE 1: GUEST DIRECTORY GRID (WHEN NO SPECIFIC MEMBER IS SELECTED) */}
            {!selectedMember ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Header Title & Top KPI Summary Banner */}
                    <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl border border-indigo-900/40 relative overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                            <Dumbbell className="w-80 h-80 text-white" />
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl shrink-0">
                                        <User className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white">Personal Training Profiles</h1>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                            <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-1.5">
                                                <Store className="w-3.5 h-3.5 text-indigo-300" /> {viewScope === 'property' ? currentProperty?.name : currentOutlet?.name}
                                            </p>
                                            {canSwitchScope && (
                                                <>
                                                    <div className="h-3 w-px bg-white/20 hidden sm:block"></div>
                                                    <div className="flex bg-white/10 p-1 rounded-xl border border-white/20 backdrop-blur-md">
                                                        <button 
                                                            onClick={() => setViewScope('outlet')} 
                                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-950 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                                                        >
                                                            <Filter className="w-2.5 h-2.5" /> Outlet
                                                        </button>
                                                        <button 
                                                            onClick={() => setViewScope('property')} 
                                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-950 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                                                        >
                                                            <Building2 className="w-2.5 h-2.5" /> Property
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Metrics Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Total PT Clients</div>
                                    <div className="text-2xl font-black text-white mt-1">{totalClientsCount}</div>
                                    <div className="text-[9px] font-bold text-indigo-200 uppercase">Registered Members</div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Active Packages</div>
                                    <div className="text-2xl font-black text-emerald-300 mt-1">{activeClientsCount}</div>
                                    <div className="text-[9px] font-bold text-indigo-200 uppercase">Ongoing Sessions</div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Completed Packages</div>
                                    <div className="text-2xl font-black text-amber-300 mt-1">{completedClientsCount}</div>
                                    <div className="text-[9px] font-bold text-indigo-200 uppercase">Finished Clients</div>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Total PT Revenue</div>
                                    <div className="text-xl sm:text-2xl font-black text-white mt-1">{formatMoney(totalPtRevenue)}</div>
                                    <div className="text-[9px] font-bold text-indigo-200 uppercase">Package Sales Value</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search & Status Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search client name, phone, or email..."
                                className="pl-10 h-12 rounded-2xl text-xs font-bold bg-slate-50 border-slate-200 focus:bg-white shadow-sm"
                            />
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs font-black uppercase tracking-wider w-full md:w-auto">
                            {(['All', 'Active', 'Completed'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-5 py-2 rounded-xl transition-all ${statusFilter === st ? 'bg-indigo-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    {st === 'All' ? 'All Profiles' : st === 'Active' ? 'Active Packages' : 'Completed Packages'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* GUEST PROFILES GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMembers.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest flex flex-col items-center bg-white rounded-3xl border border-dashed border-slate-200">
                                <User className="w-12 h-12 mb-3 text-slate-300" />
                                No PT Client Profiles Found Matching Your Search Criteria.
                            </div>
                        ) : filteredMembers.map(member => {
                            const rev = getMemberRevenue(member);
                            const isDone = member.used_sessions >= member.total_sessions;
                            const memberPct = Math.min(100, Math.round((member.used_sessions / Math.max(1, member.total_sessions)) * 100));
                            const trainerObj = staff.find(s => s.id === member.trainer_id);

                            return (
                                <Card 
                                    key={member.id}
                                    onClick={() => handleSelectMember(member)}
                                    className="rounded-[2.5rem] border-slate-200/80 shadow-lg hover:shadow-2xl transition-all cursor-pointer bg-white overflow-hidden group hover:-translate-y-1 duration-200 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Profile Card Header */}
                                        <div className="p-6 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white relative">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0">
                                                        {member.guest_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-black uppercase tracking-tight text-white group-hover:text-indigo-200 transition-colors">{member.guest_name}</h3>
                                                        <div className="text-[11px] font-bold text-indigo-200 flex items-center gap-1.5 mt-0.5">
                                                            {member.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-indigo-300" />{member.phone}</span> : (member.email || 'No contact provided')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {viewScope === 'property' && (
                                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-white/10 border border-white/20 text-indigo-200 flex items-center gap-1 shrink-0">
                                                            <Store className="w-2.5 h-2.5 text-indigo-300" />
                                                            {outlets.find(o => o.id === member.outlet_id)?.name || 'Outlet'}
                                                        </span>
                                                    )}
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${isDone ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'}`}>
                                                        {isDone ? 'Completed' : 'Active'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mt-5 space-y-1">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200">
                                                    <span>Session Completion</span>
                                                    <span>{member.used_sessions} / {member.total_sessions} ({memberPct}%)</span>
                                                </div>
                                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full" 
                                                        style={{ width: `${memberPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Details Body */}
                                        <div className="p-6 space-y-4 text-xs font-medium text-slate-600 bg-white">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned Trainer</div>
                                                    <div className="font-bold text-slate-900 text-xs mt-0.5 truncate">
                                                        {trainerObj?.name || 'Unassigned'}
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Revenue Value</div>
                                                    <div className="font-black text-emerald-600 text-xs mt-0.5">
                                                        {formatMoney(rev)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100">
                                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> Start: {member.start_date}</span>
                                                <span>Exp: {member.end_date}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Footer Button */}
                                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-indigo-900 font-black text-xs uppercase tracking-widest group-hover:bg-indigo-900 group-hover:text-white transition-colors">
                                        <span>View Profile & Sessions</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* VIEW MODE 2: SPECIFIC GUEST PROFILE DETAILS VIEW */
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Top Navigation Back Bar */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                        <Button 
                            onClick={() => setSelectedMember(null)}
                            variant="secondary"
                            className="h-11 px-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-100 hover:bg-indigo-900 hover:text-white text-slate-800 transition-all flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Guest Directory
                        </Button>

                        <div className="text-right hidden sm:block">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Profile Selected</div>
                            <div className="text-sm font-black text-indigo-950 uppercase">{selectedMember.guest_name}</div>
                        </div>
                    </div>

                    {/* MAIN GUEST PROFILE BANNER */}
                    <Card className="rounded-[2.5rem] shadow-2xl border-slate-200/80 overflow-hidden bg-white">
                        <CardHeader className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
                            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                                <Dumbbell className="w-72 h-72 text-white" />
                            </div>

                            <div className="relative z-10 space-y-6">
                                {/* Top Banner Row */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0">
                                            {selectedMember.guest_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <CardTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white">{selectedMember.guest_name}</CardTitle>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentUsed >= currentTotal ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'}`}>
                                                    {currentUsed >= currentTotal ? 'Completed' : 'Active Package'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-indigo-200 mt-1">
                                                {selectedMember.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-indigo-300" />{selectedMember.phone}</span>}
                                                {selectedMember.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-indigo-300" />{selectedMember.email}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Log Session Action Button */}
                                    <Button 
                                        onClick={() => setShowLogSession(true)}
                                        disabled={currentUsed >= currentTotal}
                                        className="h-12 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-950/40 border border-emerald-400/30 shrink-0"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Log Session
                                    </Button>
                                </div>

                                {/* 4 KPI METRICS CARDS GRID */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                    {/* Metric 1: Revenue Generated */}
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                                            <DollarSign className="w-3 h-3 text-emerald-400" /> Revenue
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-emerald-300">
                                            {formatMoney(currentRevenue)}
                                        </div>
                                        <div className="text-[9px] font-bold text-indigo-200 uppercase">Package Value</div>
                                    </div>

                                    {/* Metric 2: Sessions Used */}
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3 text-indigo-300" /> Used Sessions
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-white">
                                            {currentUsed} <span className="text-xs text-indigo-300 font-bold">/ {currentTotal}</span>
                                        </div>
                                        <div className="text-[9px] font-bold text-indigo-200 uppercase">{progressPct}% Completed</div>
                                    </div>

                                    {/* Metric 3: Remaining Sessions */}
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-amber-400" /> Remaining
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-amber-300">
                                            {currentRemaining}
                                        </div>
                                        <div className="text-[9px] font-bold text-indigo-200 uppercase">Sessions Left</div>
                                    </div>

                                    {/* Metric 4: Validity Dates */}
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-indigo-300" /> Validity
                                        </div>
                                        <div className="text-xs font-black text-white truncate">
                                            {selectedMember.start_date}
                                        </div>
                                        <div className="text-[9px] font-bold text-indigo-200 uppercase truncate">
                                            Exp: {selectedMember.end_date}
                                        </div>
                                    </div>
                                </div>

                                {/* Visual Session Progress Bar */}
                                <div className="space-y-1.5 pt-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200">
                                        <span>Session Completion Progress</span>
                                        <span>{currentUsed} Completed • {currentRemaining} Left ({progressPct}%)</span>
                                    </div>
                                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 rounded-full transition-all duration-500" 
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Assigned Trainer & Profile Controls Bar */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Assigned Trainer</div>
                                            <div className="text-white font-bold text-xs mt-0.5">
                                                {staff.find(s => s.id === selectedMember.trainer_id)?.name || 'Unassigned'}
                                            </div>
                                        </div>
                                        <select
                                            value={selectedMember.trainer_id || ''}
                                            onChange={e => handleUpdateTrainer(e.target.value)}
                                            className="bg-indigo-900 border border-indigo-700 text-white text-xs font-bold rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                                        >
                                            <option value="">Assign Staff / Trainer</option>
                                            {(() => {
                                                const activeStaff = staff.filter(s => s.is_active !== false);
                                                const trainers = activeStaff.filter(s => s.role?.toLowerCase().includes('trainer'));
                                                const displayStaff = trainers.length > 0 ? trainers : activeStaff;
                                                return displayStaff.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.role || 'Staff'})</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>

                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Package Details</div>
                                            <div className="text-indigo-100 font-bold text-xs truncate max-w-[200px]">
                                                {selectedMember.notes || 'Personal Training Package'}
                                            </div>
                                        </div>
                                        {selectedMemberSale && (
                                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-lg border border-emerald-500/30">
                                                Sale #{selectedMemberSale.id.slice(0, 6)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        {/* PROFILE TABS & CONTENT */}
                        <CardContent className="p-6 sm:p-8">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 mb-6 gap-6">
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`pb-3 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                                >
                                    <History className="w-4 h-4" />
                                    Session History ({sessions.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className={`pb-3 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-b-2 ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                                >
                                    <User className="w-4 h-4" />
                                    Client Overview
                                </button>
                            </div>

                            {/* TAB 1: PURCHASES & SESSION TRACKER */}
                            {activeTab === 'history' && (
                                <div className="space-y-6">
                                    {/* LEVEL 2: IF NO SPECIFIC PACKAGE IS SELECTED, SHOW ALL PURCHASES FOR THIS MEMBER */}
                                    {!selectedPackage ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div>
                                                    <h3 className="text-sm font-black text-indigo-950 uppercase tracking-wide flex items-center gap-2">
                                                        <Dumbbell className="w-4 h-4 text-indigo-600" />
                                                        Purchased PT Packages ({ptMembers.filter(m => m.guest_name.toLowerCase() === selectedMember.guest_name.toLowerCase() || m.id === selectedMember.id).length})
                                                    </h3>
                                                    <p className="text-xs text-slate-500 font-medium">Select any purchased package below to view its session attendance tracker or book a session.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                {ptMembers.filter(m => m.guest_name.toLowerCase() === selectedMember.guest_name.toLowerCase() || m.id === selectedMember.id).map((pkg, idx) => {
                                                    const pkgRev = getMemberRevenue(pkg);
                                                    const isComp = pkg.used_sessions >= pkg.total_sessions;
                                                    const rem = Math.max(0, pkg.total_sessions - pkg.used_sessions);

                                                    return (
                                                        <Card key={pkg.id} className="rounded-3xl border-slate-200 shadow-md hover:shadow-lg transition-all overflow-hidden bg-white">
                                                            <div className="p-6 bg-slate-900 text-white space-y-4">
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                                                    <div>
                                                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                                                            <span>Purchase #{idx + 1}</span>
                                                                            <span>• Ref: #SALE-{(pkg.sale_id || pkg.id).slice(0, 8).toUpperCase()}</span>
                                                                        </div>
                                                                        <h4 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                                                                            {pkg.notes || `${pkg.total_sessions} Sessions Personal Training`}
                                                                        </h4>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isComp ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'}`}>
                                                                            {isComp ? 'Completed' : 'Active Package'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Metrics Grid */}
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Package Size</span>
                                                                        <span className="text-base font-black text-white">{pkg.total_sessions} Sessions</span>
                                                                    </div>
                                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Completed</span>
                                                                        <span className="text-base font-black text-amber-400">{pkg.used_sessions} Sessions</span>
                                                                    </div>
                                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Remaining</span>
                                                                        <span className="text-base font-black text-emerald-400">{rem} Sessions</span>
                                                                    </div>
                                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Validity</span>
                                                                        <span className="text-xs font-bold text-slate-200">{pkg.start_date} to {pkg.end_date}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                                                                    <div className="text-xs font-bold text-indigo-300">
                                                                        Total Value: <span className="font-black text-emerald-400">{formatMoney(pkgRev)}</span>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Button
                                                                            onClick={() => {
                                                                                setSelectedPackage(pkg);
                                                                                setPrintingPackageForm(true);
                                                                            }}
                                                                            variant="secondary"
                                                                            className="h-9 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-white/10 text-white hover:bg-white/20 border border-white/20"
                                                                        >
                                                                            <Printer className="w-3.5 h-3.5 mr-1" /> Print Form
                                                                        </Button>

                                                                        <Button
                                                                            onClick={() => {
                                                                                setSelectedPackage(pkg);
                                                                                setSessionNotes(`Session #${pkg.used_sessions + 1} Workout`);
                                                                                setShowLogSession(true);
                                                                            }}
                                                                            disabled={isComp}
                                                                            className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-md flex items-center gap-1"
                                                                        >
                                                                            <Plus className="w-3.5 h-3.5" /> Book Session
                                                                        </Button>

                                                                        <Button
                                                                            onClick={() => handleSelectPackage(pkg)}
                                                                            className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-1"
                                                                        >
                                                                            <span>View Attendance Log</span>
                                                                            <ChevronRight className="w-4 h-4 ml-1" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        /* LEVEL 3: SELECTED PACKAGE ATTENDANCE TRACKER */
                                        <div className="space-y-6">
                                            {/* Package Navigation Bar */}
                                            <div className="flex items-center justify-between bg-slate-100 p-3.5 rounded-2xl border border-slate-200">
                                                <Button
                                                    onClick={() => setSelectedPackage(null)}
                                                    variant="secondary"
                                                    className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-white hover:bg-indigo-900 hover:text-white text-slate-800 transition-all flex items-center gap-2 shadow-sm"
                                                >
                                                    <ArrowLeft className="w-4 h-4" /> Back to All Member Purchases
                                                </Button>

                                                <div className="text-right">
                                                    <span className="text-[10px] font-black uppercase text-slate-400">Selected Purchase Package</span>
                                                    <div className="text-xs font-black text-indigo-950 uppercase">{selectedPackage.notes || `${selectedPackage.total_sessions} Sessions PT`}</div>
                                                </div>
                                            </div>

                                            {/* PURCHASED PACKAGE BANNER CARD */}
                                            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 border border-indigo-900/50 shadow-xl space-y-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/50 pb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                                            <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                                                            Purchased PT Package Record
                                                        </div>
                                                        <h3 className="text-xl font-black text-white uppercase tracking-tight mt-1">
                                                            {selectedPackage.notes || `${selectedPackage.total_sessions} Sessions Personal Training`}
                                                        </h3>
                                                        <p className="text-xs font-semibold text-indigo-200 mt-0.5">
                                                            Ref: #SALE-{(selectedPackage.sale_id || selectedPackage.id).slice(0, 8).toUpperCase()} • Purchased {selectedPackage.start_date}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                        <Button
                                                            onClick={() => setPrintingPackageForm(true)}
                                                            className="h-10 px-4 rounded-xl font-black text-xs uppercase bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-2 shadow-sm"
                                                        >
                                                            <Printer className="w-4 h-4 text-indigo-300" />
                                                            Print {selectedPackage.total_sessions}-Session Form
                                                        </Button>
                                                        <Button
                                                            onClick={() => {
                                                                setSessionNotes(`Session #${(sessions.length || 0) + 1} Workout`);
                                                                setShowLogSession(true);
                                                            }}
                                                            disabled={sessions.length >= selectedPackage.total_sessions}
                                                            className="h-10 px-5 rounded-xl font-black text-xs uppercase bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 flex items-center gap-2"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Book Session #{(sessions.length || 0) + 1}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Total Package</span>
                                                        <span className="text-lg font-black text-white">{selectedPackage.total_sessions} Sessions</span>
                                                    </div>
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Used Sessions</span>
                                                        <span className="text-lg font-black text-amber-400">{sessions.length} Completed</span>
                                                    </div>
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Available Balance</span>
                                                        <span className="text-lg font-black text-emerald-400">{Math.max(0, selectedPackage.total_sessions - sessions.length)} Remaining</span>
                                                    </div>
                                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-indigo-300 block">Validity Expiry</span>
                                                        <span className="text-sm font-bold text-slate-200">{selectedPackage.end_date}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SESSION SLOTS MATRIX (1 to N) */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between pt-2">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                                        <History className="w-4 h-4 text-indigo-600" />
                                                        Session Attendance Tracker ({sessions.length} of {selectedPackage.total_sessions} Used)
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                        Click any available slot to book
                                                    </span>
                                                </div>

                                                {(() => {
                                                    const totalSlots = selectedPackage.total_sessions || 10;
                                                    const chronologicalSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                                    const slotArray = Array.from({ length: totalSlots }, (_, i) => i + 1);

                                                    return slotArray.map(slotNum => {
                                                        const s = chronologicalSessions[slotNum - 1];
                                                        const trainer = s ? staff.find(st => st.id === s.staff_id) : null;
                                                        const leftAfter = Math.max(0, totalSlots - slotNum);

                                                        let formattedDateStr = s ? s.date : '';
                                                        if (s) {
                                                            try {
                                                                formattedDateStr = format(new Date(s.date), 'EEEE, MMMM dd, yyyy • hh:mm a');
                                                            } catch (e) {
                                                                formattedDateStr = s.date;
                                                            }
                                                        }

                                                        const isEditing = s && editingSession?.id === s.id;

                                                        if (!s) {
                                                            /* AVAILABLE UNBOOKED SLOT */
                                                            return (
                                                                <div key={`slot-${slotNum}`} className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 opacity-80 hover:opacity-100 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-slate-200/80 group-hover:bg-indigo-100 group-hover:text-indigo-700 flex items-center justify-center text-slate-500 font-black shrink-0 text-xs transition-colors">
                                                                            #{slotNum}
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-black text-slate-800 uppercase">Session #{slotNum} Slot</span>
                                                                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                                    Available to Book
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Ready for scheduling in guest package.</p>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => {
                                                                            setSessionNotes(`Session #${slotNum} Workout`);
                                                                            setShowLogSession(true);
                                                                        }}
                                                                        className="h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider bg-indigo-900 hover:bg-indigo-950 text-white shadow-sm flex items-center gap-1 shrink-0"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" /> Book Session #{slotNum}
                                                                    </Button>
                                                                </div>
                                                            );
                                                        }

                                                        /* COMPLETED SLOT */
                                                        return (
                                                            <div key={s.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                                                                {isEditing ? (
                                                                    /* INLINE EDIT SESSION FORM */
                                                                    <div className="space-y-4 bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 animate-in fade-in duration-200">
                                                                        <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                                                                            <span className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                                                                                Edit Session #{slotNum} Details
                                                                            </span>
                                                                            <Button onClick={() => setEditingSession(null)} variant="secondary" className="h-7 px-3 text-[10px] font-black uppercase">
                                                                                Cancel
                                                                            </Button>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                                    Session Date & Time
                                                                                </label>
                                                                                <input 
                                                                                    type="datetime-local"
                                                                                    value={editSessionDate}
                                                                                    onChange={e => setEditSessionDate(e.target.value)}
                                                                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                                    Trainer / Staff
                                                                                </label>
                                                                                <select
                                                                                    value={editSessionTrainerId}
                                                                                    onChange={e => setEditSessionTrainerId(e.target.value)}
                                                                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                                                                                >
                                                                                    <option value="">Select Trainer</option>
                                                                                    {(() => {
                                                                                        const activeStaff = staff.filter(s => s.is_active !== false);
                                                                                        const trainers = activeStaff.filter(s => s.role?.toLowerCase().includes('trainer'));
                                                                                        const displayStaff = trainers.length > 0 ? trainers : activeStaff;
                                                                                        return displayStaff.map(st => (
                                                                                            <option key={st.id} value={st.id}>{st.name} ({st.role || 'Staff'})</option>
                                                                                        ));
                                                                                    })()}
                                                                                </select>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                                                                    Workout Notes
                                                                                </label>
                                                                                <textarea
                                                                                    value={editSessionNotes}
                                                                                    onChange={e => setEditSessionNotes(e.target.value)}
                                                                                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                                                                                    rows={4}
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <SignaturePad 
                                                                                    title="Guest Digital Signature" 
                                                                                    onSave={(sig) => setEditGuestSignature(sig)} 
                                                                                    onClear={() => setEditGuestSignature('')} 
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex justify-end gap-2 pt-2 border-t border-indigo-200/60">
                                                                            <Button onClick={() => setEditingSession(null)} variant="secondary" className="h-9 text-[10px] uppercase font-black px-4 rounded-xl">
                                                                                Cancel
                                                                            </Button>
                                                                            <Button onClick={handleSaveEditSession} className="h-9 text-[10px] uppercase font-black bg-indigo-900 hover:bg-indigo-950 text-white px-5 rounded-xl shadow-md">
                                                                                Save Changes
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* REGULAR DISPLAY MODE */
                                                                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                                                                        <div className="flex gap-4 items-start flex-1">
                                                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black shrink-0">
                                                                                <CheckCircle className="w-5 h-5" />
                                                                            </div>
                                                                            <div className="space-y-2 flex-1">
                                                                                <div className="flex flex-wrap items-center gap-3">
                                                                                    <span className="text-sm font-black text-slate-900">
                                                                                        Session #{slotNum}
                                                                                    </span>
                                                                                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                                                                        Trainer: {trainer?.name || 'Staff Member'}
                                                                                    </span>
                                                                                </div>

                                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                                                                    <span>{formattedDateStr}</span>
                                                                                </div>

                                                                                {s.notes && (
                                                                                    <div className="p-3 bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 border border-slate-100 leading-relaxed">
                                                                                        {s.notes}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Right Side: Usage Snapshot, Signature & Edit/Delete Action Buttons */}
                                                                        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-3 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4 w-full sm:w-auto shrink-0">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <Button
                                                                                    onClick={() => setPrintingSession(s)}
                                                                                    variant="secondary"
                                                                                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white transition-all flex items-center gap-1 shadow-sm"
                                                                                >
                                                                                    <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print Slip
                                                                                </Button>
                                                                                <Button
                                                                                    onClick={() => startEditSession(s)}
                                                                                    variant="secondary"
                                                                                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 hover:bg-indigo-900 hover:text-white transition-all flex items-center gap-1"
                                                                                >
                                                                                    <Edit3 className="w-3.5 h-3.5" /> Edit
                                                                                </Button>
                                                                                <Button
                                                                                    onClick={() => handleDeleteSession(s)}
                                                                                    variant="secondary"
                                                                                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                                                </Button>
                                                                            </div>

                                                                            <div className="text-right">
                                                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sessions Left</div>
                                                                                <div className="text-xs font-black text-emerald-600">{leftAfter} Remaining</div>
                                                                            </div>

                                                                            {s.guest_signature && (
                                                                                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 max-w-[140px] text-center">
                                                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Verified Signature</div>
                                                                                    <img src={s.guest_signature} alt="Signature" className="h-8 object-contain mx-auto" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: CLIENT OVERVIEW & PACKAGE DETAILS */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Client Profile Summary Card */}
                                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900 flex items-center gap-2">
                                                <User className="w-4 h-4 text-indigo-600" />
                                                Client Personal Information
                                            </h4>

                                            <div className="space-y-3 text-xs font-medium text-slate-700">
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Full Name</span>
                                                    <span className="font-black text-slate-900">{selectedMember.guest_name}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Phone Number</span>
                                                    <span className="font-bold text-slate-900">{selectedMember.phone || 'Not provided'}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Email Address</span>
                                                    <span className="font-bold text-slate-900">{selectedMember.email || 'Not provided'}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Assigned Trainer</span>
                                                    <span className="font-black text-indigo-700">
                                                        {staff.find(s => s.id === (selectedPackage || selectedMember)?.trainer_id)?.name || 'Unassigned'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-2">
                                                    <span className="font-bold text-slate-500">Registration Date</span>
                                                    <span className="font-bold text-slate-900">
                                                        {selectedMember.created_at ? format(new Date(selectedMember.created_at), 'MMMM dd, yyyy') : selectedMember.start_date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Package & Financial Info */}
                                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900 flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                                Package & Revenue Overview
                                            </h4>

                                            <div className="space-y-3 text-xs font-medium text-slate-700">
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Total Package Value</span>
                                                    <span className="font-black text-emerald-600 text-sm">{formatMoney(currentRevenue)}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Total Sessions Purchased</span>
                                                    <span className="font-bold text-slate-900">{selectedMember.total_sessions} Sessions</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Sessions Used</span>
                                                    <span className="font-bold text-slate-900">{selectedMember.used_sessions} Sessions</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Sessions Remaining</span>
                                                    <span className="font-black text-amber-600">{currentRemaining} Sessions</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-slate-200/60">
                                                    <span className="font-bold text-slate-500">Package Validity</span>
                                                    <span className="font-bold text-slate-900">{selectedMember.start_date} to {selectedMember.end_date}</span>
                                                </div>
                                                {selectedMemberSale && (
                                                    <div className="flex justify-between py-2">
                                                        <span className="font-bold text-slate-500">Sale Transaction ID</span>
                                                        <span className="font-mono text-indigo-600 font-bold">{selectedMemberSale.id}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* BOOK SESSION MODAL OVERLAY */}
            {showLogSession && (selectedPackage || selectedMember) && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <Play className="w-5 h-5 text-indigo-600" />
                                    Book PT Session for {(selectedPackage || selectedMember)!.guest_name}
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                    Package: {(selectedPackage || selectedMember)!.notes || `${(selectedPackage || selectedMember)!.total_sessions} Sessions Personal Training`}
                                </p>
                            </div>
                            <Button onClick={() => setShowLogSession(false)} variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                        Session Date & Time
                                    </label>
                                    <input 
                                        type="datetime-local" 
                                        value={sessionDate}
                                        onChange={e => setSessionDate(e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                        Conducting Trainer / Staff
                                    </label>
                                    <select
                                        value={sessionTrainerId}
                                        onChange={e => setSessionTrainerId(e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Trainer</option>
                                        {(() => {
                                            const activeStaff = staff.filter(s => s.is_active !== false);
                                            const trainers = activeStaff.filter(s => s.role?.toLowerCase().includes('trainer'));
                                            const displayStaff = trainers.length > 0 ? trainers : activeStaff;
                                            return displayStaff.map(st => (
                                                <option key={st.id} value={st.id}>{st.name} ({st.role || 'Staff'})</option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Workout Notes & Focus Area
                                </label>
                                <textarea
                                    value={sessionNotes}
                                    onChange={e => setSessionNotes(e.target.value)}
                                    placeholder="Exercises completed, sets, weights, cardio duration..."
                                    className="w-full p-4 rounded-2xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                    rows={4}
                                />
                            </div>

                            <div>
                                <SignaturePad 
                                    title="Guest Digital Signature (Required)" 
                                    onSave={(sig) => setGuestSignature(sig)} 
                                    onClear={() => setGuestSignature('')} 
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button onClick={() => setShowLogSession(false)} variant="secondary" className="h-11 px-5 rounded-2xl text-xs font-black uppercase">
                                Cancel
                            </Button>
                            <Button onClick={handleLogSession} className="h-11 px-6 rounded-2xl text-xs font-black uppercase bg-indigo-900 hover:bg-indigo-950 text-white shadow-xl">
                                Confirm & Book Session
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINTABLE SESSION VOUCHER MODAL */}
            {printingSession && selectedMember && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:bg-transparent print:overflow-visible">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 relative animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:bg-transparent">
                        {/* Action Bar (Hidden during print) */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 print:hidden">
                            <div className="flex items-center gap-2">
                                <Printer className="w-5 h-5 text-indigo-600" />
                                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                    Personal Training Session Slip
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    onClick={handleTriggerPrint} 
                                    className="bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs uppercase px-4 h-9 rounded-xl flex items-center gap-2 shadow-md"
                                >
                                    <Printer className="w-4 h-4" /> Print Voucher
                                </Button>
                                <Button 
                                    onClick={() => setPrintingSession(null)} 
                                    variant="secondary" 
                                    className="h-9 px-3 rounded-xl text-xs font-black uppercase"
                                >
                                    <X className="w-4 h-4 mr-1" /> Close
                                </Button>
                            </div>
                        </div>

                        {/* Printable Content Container Preview */}
                        {renderSessionSlip()}
                    </div>
                </div>
            )}

            {/* DELETE SESSION CONFIRMATION MODAL */}
            {deletingSession && selectedMember && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600 font-black text-base uppercase tracking-wide">
                            <AlertTriangle className="w-6 h-6" />
                            Delete PT Session?
                        </div>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                            Are you sure you want to delete this session? This will remove the logged workout record and restore 1 session back to <strong className="text-slate-900">{selectedMember.guest_name}</strong>'s available package balance.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button onClick={() => setDeletingSession(null)} variant="secondary" className="h-9 px-4 rounded-xl text-xs font-black uppercase">
                                Cancel
                            </Button>
                            <Button onClick={executeDeleteSession} className="h-9 px-5 rounded-xl text-xs font-black uppercase bg-rose-600 hover:bg-rose-700 text-white shadow-md">
                                Yes, Delete Session
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE PT MEMBER CONFIRMATION MODAL */}
            {deletingMember && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600 font-black text-base uppercase tracking-wide">
                            <AlertTriangle className="w-6 h-6" />
                            Delete PT Member?
                        </div>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                            Are you sure you want to delete <strong className="text-slate-900">{deletingMember.guest_name}</strong>? This will permanently remove this PT profile and all logged training sessions.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button onClick={() => setDeletingMember(null)} variant="secondary" className="h-9 px-4 rounded-xl text-xs font-black uppercase">
                                Cancel
                            </Button>
                            <Button onClick={executeDeleteMember} className="h-9 px-5 rounded-xl text-xs font-black uppercase bg-rose-600 hover:bg-rose-700 text-white shadow-md">
                                Yes, Delete Member
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINTABLE FULL PACKAGE ATTENDANCE SHEET MODAL */}
            {printingPackageForm && (selectedPackage || selectedMember) && (() => {
                const activeTargetPkg = selectedPackage || selectedMember;
                if (!activeTargetPkg) return null;
                return (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:bg-transparent print:overflow-visible">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-slate-200 relative animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:p-0 print:max-h-none print:max-w-none print:w-full print:bg-transparent">
                        {/* Header Action Bar */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 print:hidden sticky top-0 bg-white z-10 py-2">
                            <div className="flex items-center gap-2">
                                <Printer className="w-5 h-5 text-indigo-600" />
                                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                    PT Package Attendance Sheet Voucher ({activeTargetPkg.total_sessions} Sessions)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    onClick={handleTriggerPrint} 
                                    className="bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs uppercase px-4 h-9 rounded-xl flex items-center gap-2 shadow-md"
                                >
                                    <Printer className="w-4 h-4" /> Print Full Package Card
                                </Button>
                                <Button 
                                    onClick={() => setPrintingPackageForm(false)} 
                                    variant="secondary" 
                                    className="h-9 px-3 rounded-xl text-xs font-black uppercase"
                                >
                                    <X className="w-4 h-4 mr-1" /> Close
                                </Button>
                            </div>
                        </div>

                        {/* Printable Package Container Preview */}
                        {renderPackageCard()}
                    </div>
                </div>
                );
            })()}

        </div>

        {/* Dedicated Print Section */}
        {printingSession && selectedMember && createPortal(
            <div className="hidden print:block print:bg-white print:z-[99999] print-container-pt">
                {renderSessionSlip()}
            </div>,
            document.body
        )}
        {printingPackageForm && (selectedPackage || selectedMember) && createPortal(
            <div className="hidden print:block print:bg-white print:z-[99999] print-container-pt">
                {renderPackageCard()}
            </div>,
            document.body
        )}

        <style>{`
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                html, body {
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    overflow: visible !important;
                }
                #root, .no-print {
                    display: none !important;
                }
                .print-container-pt {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    width: 100% !important;
                    padding: 15mm !important;
                    box-sizing: border-box !important;
                    visibility: visible !important;
                    margin: 0 !important;
                    overflow: visible !important;
                    page-break-after: avoid !important;
                    page-break-inside: avoid !important;
                }
                .print-container-pt * {
                    visibility: visible !important;
                }
            }
        `}</style>
        </>
    );
}
