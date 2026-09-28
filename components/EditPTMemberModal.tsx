import React, { useState, useEffect } from 'react';
import { PTMember, Staff } from '../types';
import { db } from '../services/mockSupabase';
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from './ui';
import { X, User, Phone, Mail, Calendar, Dumbbell, ShieldCheck, AlertCircle, FileText, CheckCircle2, Save } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface EditPTMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedMember: PTMember) => void;
    member: PTMember | null;
    staff: Staff[];
}

export const EditPTMemberModal: React.FC<EditPTMemberModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    member,
    staff
}) => {
    const { currentOutlet, currentProperty, outlets = [] } = useSettings();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        guest_name: '',
        membership_number: '',
        phone: '',
        email: '',
        dob: '',
        total_sessions: 10,
        used_sessions: 0,
        start_date: '',
        end_date: '',
        status: 'Active',
        trainer_id: '',
        outlet_id: '',
        notes: '',
        parq_details: '',
        is_under_18: false,
        guardian_name: '',
        guardian_relationship: '',
        guardian_contact: '',
        parq_answers: {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false
        } as Record<number, boolean>
    });

    useEffect(() => {
        if (isOpen && member) {
            setFormData({
                guest_name: member.guest_name || '',
                membership_number: member.membership_number || '',
                phone: member.phone || '',
                email: member.email || '',
                dob: member.dob || '',
                total_sessions: member.total_sessions || 10,
                used_sessions: member.used_sessions || 0,
                start_date: member.start_date || '',
                end_date: member.end_date || '',
                status: member.status || 'Active',
                trainer_id: member.trainer_id || '',
                outlet_id: member.outlet_id || currentOutlet?.id || '',
                notes: (member.notes || '').replace(/\n*___PT_META___:[\s\S]*$/, '').trim(),
                parq_details: member.parq_details || '',
                is_under_18: !!member.is_under_18,
                guardian_name: member.guardian_name || '',
                guardian_relationship: member.guardian_relationship || '',
                guardian_contact: member.guardian_contact || '',
                parq_answers: member.parq_answers || {
                    1: false,
                    2: false,
                    3: false,
                    4: false,
                    5: false,
                    6: false
                }
            });
            setError('');
        }
    }, [isOpen, member, currentOutlet]);

    if (!isOpen || !member) return null;

    const allActiveStaff = staff.filter(s => s.is_active !== false);

    const handleParqChange = (questionId: number, value: boolean) => {
        setFormData(prev => ({
            ...prev,
            parq_answers: {
                ...prev.parq_answers,
                [questionId]: value
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.guest_name.trim()) {
            setError('Please provide the guest full name.');
            return;
        }
        if (formData.total_sessions < 1) {
            setError('Total sessions must be at least 1.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const updates: Partial<PTMember> = {
                guest_name: formData.guest_name.trim(),
                membership_number: formData.membership_number.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                email: formData.email.trim() || undefined,
                dob: formData.dob || undefined,
                total_sessions: Number(formData.total_sessions),
                used_sessions: Number(formData.used_sessions),
                start_date: formData.start_date || undefined,
                end_date: formData.end_date || undefined,
                status: formData.status as any,
                trainer_id: formData.trainer_id || undefined,
                outlet_id: formData.outlet_id || member.outlet_id,
                notes: formData.notes,
                parq_answers: formData.parq_answers,
                parq_details: formData.parq_details || undefined,
                is_under_18: formData.is_under_18,
                guardian_name: formData.is_under_18 ? formData.guardian_name : undefined,
                guardian_relationship: formData.is_under_18 ? formData.guardian_relationship : undefined,
                guardian_contact: formData.is_under_18 ? formData.guardian_contact : undefined
            };

            await db.updatePTMember(member.id, updates);
            const merged: PTMember = {
                ...member,
                ...updates
            };
            onSuccess(merged);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update PT Member profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="w-full max-w-3xl max-h-[92vh] flex flex-col my-auto">
                <Card className="rounded-[2.5rem] shadow-2xl border-slate-200/80 overflow-hidden bg-white flex flex-col max-h-[92vh]">
                    {/* MODAL HEADER */}
                    <CardHeader className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 relative shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-indigo-300">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-white">Edit Personal Training Profile</CardTitle>
                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">
                                    Modify Guest Details, Sessions, Dates & Trainer Assignment
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            disabled={loading}
                            className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </CardHeader>
                    
                    {/* MODAL BODY */}
                    <CardContent className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
                        {error && (
                            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-xs font-bold animate-in fade-in">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Section 1: Guest Personal Information */}
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-950 flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <User className="w-3.5 h-3.5 text-indigo-600" /> Personal & Contact Details
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input 
                                        label="Guest Full Name *" 
                                        value={formData.guest_name} 
                                        onChange={e => setFormData({...formData, guest_name: e.target.value})} 
                                        className="h-11 rounded-xl text-xs font-bold" 
                                        required
                                    />
                                    <Input 
                                        label="Membership / Ref #" 
                                        value={formData.membership_number} 
                                        onChange={e => setFormData({...formData, membership_number: e.target.value})} 
                                        placeholder="e.g. TCP0086" 
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Input 
                                        label="Phone Number" 
                                        value={formData.phone} 
                                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                                        placeholder="+974 ..."
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                    <Input 
                                        label="Email Address" 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        placeholder="guest@example.com"
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                    <Input 
                                        label="Date of Birth" 
                                        type="date" 
                                        value={formData.dob} 
                                        onChange={e => setFormData({...formData, dob: e.target.value})} 
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                </div>
                            </div>

                            {/* Section 2: Package & Session Allocation */}
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-950 flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <Dumbbell className="w-3.5 h-3.5 text-indigo-600" /> Package & Session Configuration
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Input 
                                        label="Total Sessions *" 
                                        type="number" 
                                        min="1"
                                        max="500"
                                        value={formData.total_sessions} 
                                        onChange={e => setFormData({...formData, total_sessions: parseInt(e.target.value) || 0})} 
                                        className="h-11 rounded-xl text-xs font-bold" 
                                        required
                                    />
                                    <Input 
                                        label="Completed / Used Sessions" 
                                        type="number" 
                                        min="0"
                                        max={formData.total_sessions}
                                        value={formData.used_sessions} 
                                        onChange={e => setFormData({...formData, used_sessions: parseInt(e.target.value) || 0})} 
                                        className="h-11 rounded-xl text-xs font-bold" 
                                    />
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({...formData, status: e.target.value})}
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Expired">Expired</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assigned Trainer</label>
                                        <select
                                            value={formData.trainer_id}
                                            onChange={e => setFormData({...formData, trainer_id: e.target.value})}
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Unassigned</option>
                                            {allActiveStaff.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <Input 
                                        label="Start Date" 
                                        type="date" 
                                        value={formData.start_date} 
                                        onChange={e => setFormData({...formData, start_date: e.target.value})} 
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                    <Input 
                                        label="Expiry Date" 
                                        type="date" 
                                        value={formData.end_date} 
                                        onChange={e => setFormData({...formData, end_date: e.target.value})} 
                                        className="h-11 rounded-xl text-xs" 
                                    />
                                </div>

                                {outlets.length > 1 && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Associated Outlet</label>
                                        <select
                                            value={formData.outlet_id}
                                            onChange={e => setFormData({...formData, outlet_id: e.target.value})}
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {outlets.map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Notes & Health Declaration */}
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-950 flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Notes & Health Declaration
                                </h4>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Profile / Special Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({...formData, notes: e.target.value})}
                                        rows={3}
                                        placeholder="Add goals, medical history, package details or special requirements..."
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Section 4: Minor / Under 18 Details */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_under_18} 
                                        onChange={e => setFormData({...formData, is_under_18: e.target.checked})} 
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">Guest is Under 18 (Minor Registration)</span>
                                </label>

                                {formData.is_under_18 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 animate-in fade-in">
                                        <Input 
                                            label="Guardian Full Name" 
                                            value={formData.guardian_name} 
                                            onChange={e => setFormData({...formData, guardian_name: e.target.value})} 
                                            className="h-10 rounded-xl text-xs" 
                                        />
                                        <Input 
                                            label="Relationship to Minor" 
                                            value={formData.guardian_relationship} 
                                            onChange={e => setFormData({...formData, guardian_relationship: e.target.value})} 
                                            placeholder="e.g. Mother, Father"
                                            className="h-10 rounded-xl text-xs" 
                                        />
                                        <Input 
                                            label="Guardian Contact #" 
                                            value={formData.guardian_contact} 
                                            onChange={e => setFormData({...formData, guardian_contact: e.target.value})} 
                                            className="h-10 rounded-xl text-xs" 
                                        />
                                    </div>
                                )}
                            </div>

                            {/* MODAL ACTION BUTTONS */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={onClose}
                                    disabled={loading}
                                    className="h-11 px-6 rounded-2xl font-black text-xs uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={loading}
                                    className="h-11 px-8 rounded-2xl font-black text-xs uppercase tracking-wider bg-indigo-900 hover:bg-indigo-950 text-white shadow-lg shadow-indigo-950/30 flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> {loading ? 'Saving Changes...' : 'Save Profile Changes'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
export default EditPTMemberModal;
