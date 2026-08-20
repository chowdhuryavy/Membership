import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Save, User, Calendar, AlertTriangle, FileCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from './ui';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { PTMember } from '../types';
import { SignatureModal } from './SignatureModal';
import { getBilingualPTConsentText } from '../lib/waiverHelper';

export const PTRegistrationModal = ({
    isOpen,
    onClose,
    onSuccess,
    initialData,
    staff
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (ptMember: PTMember) => void;
    initialData: { guestName: string; saleId?: string; qty: number; itemName?: string; trainerId?: string; price?: number };
    staff: any[];
}) => {
    const { currentOutlet, currentProperty, settings, currency, currencies } = useSettings();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<any | null>(null);
    const [showHealthForm, setShowHealthForm] = useState(false);

    const clubDisplayName = currentOutlet?.name || currentProperty?.name || 'The Torch Club';
    const consent = getBilingualPTConsentText(clubDisplayName);

    const [formData, setFormData] = useState({
        guest_name: initialData?.guestName || '',
        membership_number: '',
        phone: '',
        email: '',
        dob: '',
        total_sessions: initialData?.qty || 10,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        trainer_id: initialData?.trainerId || '',
        notes: initialData?.itemName ? `Purchased item: ${initialData.itemName}` : '',
        parq_answers: {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false
        } as { [key: number]: boolean },
        parq_details: '',
        is_under_18: false,
        guardian_name: '',
        guardian_relationship: '',
        guardian_contact: '',
        agreed_to_health_declaration: true
    });

    const initiateSignature = (data: any) => {
        setPendingSubmitData(data);
        setShowSignatureModal(true);
    };

    const handleSignatureSave = (dataUrl: string) => {
        setShowSignatureModal(false);
        if (pendingSubmitData) {
            onFinalSubmit(pendingSubmitData, dataUrl);
        }
    };
    
    const closeSignatureModal = () => {
        setShowSignatureModal(false); 
        setPendingSubmitData(null); 
        setLoading(false);
    };
    
    const handleSkipSignature = async () => {
        setShowSignatureModal(false);
        if (pendingSubmitData) {
            await onFinalSubmit(pendingSubmitData, 'BYPASSED'); 
        }
    };

    React.useEffect(() => {
        if (isOpen && initialData) {
            setFormData(prev => ({
                ...prev,
                guest_name: initialData.guestName || '',
                total_sessions: initialData.qty || 10,
                trainer_id: initialData.trainerId || prev.trainer_id,
                notes: initialData?.itemName ? `Purchased item: ${initialData.itemName}` : prev.notes
            }));
            setError('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const allActiveStaff = staff.filter(s => s.is_active !== false);
    const activeCurrency = currency || 
                           (currentProperty && currencies.find(c => c.property_id === currentProperty.id)) || 
                           { code: 'AED', symbol: 'AED' };

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
        if (!formData.guest_name || !formData.total_sessions || !currentOutlet) {
            setError('Please fill all required fields.');
            return;
        }

        const memberData = {
            outlet_id: currentOutlet.id,
            property_id: currentProperty?.id,
            guest_name: formData.guest_name,
            membership_number: formData.membership_number,
            phone: formData.phone,
            email: formData.email,
            dob: formData.dob,
            total_sessions: Number(formData.total_sessions),
            used_sessions: 0,
            sale_id: initialData.saleId,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: 'Active',
            trainer_id: formData.trainer_id,
            notes: formData.notes,
            parq_answers: formData.parq_answers,
            parq_details: formData.parq_details,
            is_under_18: formData.is_under_18,
            guardian_name: formData.is_under_18 ? formData.guardian_name : undefined,
            guardian_relationship: formData.is_under_18 ? formData.guardian_relationship : undefined,
            guardian_contact: formData.is_under_18 ? formData.guardian_contact : undefined,
        };

        initiateSignature(memberData);
    };

    const onFinalSubmit = async (data: any, signatureOverride?: string) => {
        setLoading(true);
        try {
            await db.addPTMember({
                ...data,
                member_signature: signatureOverride
            });
            onSuccess(data as any);
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('schema cache') || msg.includes('42P01') || msg.includes('relation "public.pt_members" does not exist') || msg.includes('row-level security policy') || msg.includes('violates row-level security')) {
                setError('Database schema/RLS security policy needs updating. Please run the SQL setup script from the Booking page.');
            } else {
                setError(msg || 'Failed to register PT Member');
            }
        } finally {
            setLoading(false);
        }
    };

    const anyParqYes = Object.values(formData.parq_answers).some(val => val === true);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95 duration-300">
                <Card className="rounded-[2rem] shadow-2xl border-slate-200/60 overflow-hidden bg-white flex flex-col max-h-[90vh]">
                    <CardHeader className="bg-indigo-600 text-white p-6 relative shrink-0">
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Register Personal Training Member</CardTitle>
                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">Health Declaration & Participation Consent Form ({clubDisplayName})</p>
                        <button onClick={onClose} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
                    </CardHeader>
                    
                    <CardContent className="p-6 overflow-y-auto flex-1">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Personal & Package Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Guest Full Name *" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="Membership / Ref #" value={formData.membership_number} onChange={e => setFormData({...formData, membership_number: e.target.value})} placeholder="Optional / Auto" className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Input label="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-11 rounded-xl text-xs" />
                                <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-11 rounded-xl text-xs" />
                                <Input label="Date of Birth" type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Trainer</label>
                                    <select 
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all"
                                        value={formData.trainer_id}
                                        onChange={e => setFormData({...formData, trainer_id: e.target.value})}
                                    >
                                        <option value="">Any / Unassigned</option>
                                        {allActiveStaff.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role || 'Staff'})</option>)}
                                    </select>
                                </div>
                                <Input label="Total Sessions *" type="number" min="1" value={formData.total_sessions} onChange={e => setFormData({...formData, total_sessions: parseInt(e.target.value) || 1})} className="h-11 rounded-xl text-xs font-bold" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Start Date *" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="Expiry Date *" type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                            </div>

                            {/* Collapsible PAR-Q Health Questionnaire */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                                <button
                                    type="button"
                                    onClick={() => setShowHealthForm(!showHealthForm)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-100/60 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <FileCheck className="w-5 h-5 text-indigo-600" />
                                        <div>
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                                                PAR-Q Health Declaration Questionnaire
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-semibold" dir="rtl">
                                                استبيان الجاهزية البدنية والإقرار الصحي (6 أسئلة)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {anyParqYes && (
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-full">
                                                Medical Disclosure
                                            </span>
                                        )}
                                        {showHealthForm ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </div>
                                </button>

                                {showHealthForm && (
                                    <div className="p-4 pt-0 border-t border-slate-200 space-y-4 bg-white">
                                        <div className="text-[10px] text-slate-500 font-semibold p-2 bg-indigo-50/50 rounded-xl">
                                            {consent.parqInstructionEn} <span dir="rtl" className="font-arabic">({consent.parqInstructionAr})</span>
                                        </div>

                                        <div className="space-y-3">
                                            {consent.parqQuestions.map((q) => (
                                                <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="text-xs flex-1">
                                                        <span className="font-bold text-slate-800 mr-1.5">{q.id}.</span>
                                                        <span className="text-slate-700">{q.en}</span>
                                                        <p dir="rtl" className="text-[10px] text-slate-500 font-arabic mt-0.5">{q.ar}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleParqChange(q.id, true)}
                                                            className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${
                                                                formData.parq_answers[q.id] === true
                                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            Yes / نعم
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleParqChange(q.id, false)}
                                                            className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${
                                                                formData.parq_answers[q.id] === false
                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            No / لا
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {anyParqYes && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">
                                                    {consent.parqDetailsPromptEn} / {consent.parqDetailsPromptAr}
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={formData.parq_details}
                                                    onChange={e => setFormData({...formData, parq_details: e.target.value})}
                                                    placeholder="Please specify medical condition or clearance details..."
                                                    className="w-full p-3 rounded-xl border border-rose-200 bg-rose-50/30 text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                                                />
                                            </div>
                                        )}

                                        {/* Under 18 Section */}
                                        <div className="pt-3 border-t border-slate-200">
                                            <div className="flex items-center gap-2 mb-3">
                                                <input
                                                    type="checkbox"
                                                    id="under18"
                                                    checked={formData.is_under_18}
                                                    onChange={e => setFormData({...formData, is_under_18: e.target.checked})}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                                                />
                                                <label htmlFor="under18" className="text-xs font-bold text-slate-700 cursor-pointer">
                                                    Participant is under 18 years old (Requires Parent/Guardian Consent)
                                                </label>
                                            </div>

                                            {formData.is_under_18 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                                                    <Input
                                                        label="Parent / Guardian Name"
                                                        value={formData.guardian_name}
                                                        onChange={e => setFormData({...formData, guardian_name: e.target.value})}
                                                        className="h-9 rounded-lg text-xs"
                                                    />
                                                    <Input
                                                        label="Relationship to Minor"
                                                        value={formData.guardian_relationship}
                                                        onChange={e => setFormData({...formData, guardian_relationship: e.target.value})}
                                                        className="h-9 rounded-lg text-xs"
                                                    />
                                                    <Input
                                                        label="Guardian Contact #"
                                                        value={formData.guardian_contact}
                                                        onChange={e => setFormData({...formData, guardian_contact: e.target.value})}
                                                        className="h-9 rounded-lg text-xs"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Input label="Internal Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Fitness goals, medical clearance remarks..." className="h-11 rounded-xl text-xs" />

                            {error && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-4 rounded-xl space-y-2 animate-in shake duration-300">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                                        <span>{error}</span>
                                    </div>
                                    {(error.includes('Database schema') || error.includes('RLS') || error.includes('row-level security')) && (
                                        <div className="pt-2 border-t border-rose-200/60">
                                            <p className="text-[10px] font-medium text-rose-600 mb-2">Execute this SQL in your Supabase SQL Editor to grant permissions and fix table schemas:</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sql = `CREATE TABLE IF NOT EXISTS public.pt_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id TEXT NOT NULL,
    property_id TEXT,
    guest_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    dob DATE,
    membership_number TEXT,
    total_sessions INTEGER NOT NULL,
    used_sessions INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    sale_id TEXT,
    trainer_id TEXT,
    notes TEXT,
    parq_answers JSONB,
    parq_details TEXT,
    is_under_18 BOOLEAN DEFAULT FALSE,
    guardian_name TEXT,
    guardian_relationship TEXT,
    guardian_contact TEXT,
    status TEXT DEFAULT 'Active',
    member_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pt_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on pt_members" ON public.pt_members;
CREATE POLICY "Allow all on pt_members" ON public.pt_members FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.pt_members TO anon, authenticated, postgres;
NOTIFY pgrst, 'reload schema';`;
                                                    navigator.clipboard.writeText(sql);
                                                    toast.success("SQL Fix copied to clipboard!");
                                                }}
                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
                                            >
                                                Copy SQL Fix Script
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                                <Button type="submit" disabled={loading} className="flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">
                                    {loading ? 'Registering...' : 'Proceed to Signature (Pad / QR)'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
            {showSignatureModal && (
                <SignatureModal
                    isOpen={showSignatureModal}
                    onClose={closeSignatureModal}
                    onSave={handleSignatureSave}
                    onSkip={handleSkipSignature}
                    guestName={formData.guest_name}
                    propertyName={currentProperty?.name || ''}
                    outletName={currentOutlet?.name || ''}
                    outletId={currentOutlet?.id || ''}
                    tier={`${formData.total_sessions} PT Sessions (Health Consent)`}
                    price={initialData?.price || '0'}
                    currency={activeCurrency?.code || 'AED'}
                    currencySymbol={activeCurrency?.symbol || ''}
                    logoUrl={currentOutlet?.logo_url || currentProperty?.logo_url || settings?.logo_url || ''}
                    agreementType="pt"
                />
            )}
        </div>
    );
};
