import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, Save, User, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from './ui';
import { db, supabase } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { PTMember } from '../types';
import { SignatureModal } from './SignatureModal';
import SignatureCanvas from 'react-signature-canvas';

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
    initialData: { guestName: string; saleId?: string; qty: number; itemName?: string; trainerId?: string };
    staff: any[];
}) => {
    const { currentOutlet, currentProperty, settings, currency, currencies } = useSettings();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const signatureRef = useRef<SignatureCanvas>(null);
    const [signatureMethod, setSignatureMethod] = useState<'pad' | 'qr' | null>(null);
    const [pendingSubmitData, setPendingSubmitData] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        guest_name: initialData?.guestName || '',
        phone: '',
        email: '',
        total_sessions: initialData?.qty || 10,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        trainer_id: initialData?.trainerId || '',
        notes: initialData?.itemName ? `Purchased item: ${initialData.itemName}` : ''
    });

    const initiateSignature = (data: any) => {
        setPendingSubmitData(data);
        setShowSignatureModal(true);
        setSignatureMethod(null);
    };

    const handleSignatureSave = () => {
        if (signatureRef.current) {
            const dataUrl = signatureRef.current.toDataURL();
            setSignature(dataUrl);
            setShowSignatureModal(false);
            setSignatureMethod(null);
            if (pendingSubmitData) {
                onFinalSubmit(pendingSubmitData, dataUrl);
            }
        }
    };
    
    const handleSkipSignature = async () => {
        if (pendingSubmitData) {
            await onFinalSubmit(pendingSubmitData, 'BYPASSED'); 
            setShowSignatureModal(false);
        }
    };

    React.useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                guest_name: initialData.guestName || '',
                phone: '',
                email: '',
                total_sessions: initialData.qty || 10,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                trainer_id: initialData.trainerId || '',
                notes: initialData.itemName ? `Purchased item: ${initialData.itemName}` : ''
            });
            setError('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const allActiveStaff = staff.filter(s => s.is_active !== false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.guest_name || !formData.total_sessions || !currentOutlet) {
            setError('Please fill all required fields.');
            return;
        }

        const memberData = {
            outlet_id: currentOutlet.id,
            guest_name: formData.guest_name,
            phone: formData.phone,
            email: formData.email,
            total_sessions: Number(formData.total_sessions),
            used_sessions: 0,
            sale_id: initialData.saleId,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: 'Active',
            trainer_id: formData.trainer_id,
            notes: formData.notes
        };

        initiateSignature(memberData);
    };

    const onFinalSubmit = async (data: any, signatureOverride?: string) => {
        setLoading(true);
        try {
            await db.addPTMember({
                ...data,
                member_signature: signatureOverride || signature
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

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xl animate-in zoom-in-95 duration-300">
                <Card className="rounded-[2rem] shadow-2xl border-slate-200/60 overflow-hidden bg-white">
                    <CardHeader className="bg-indigo-600 text-white p-6 relative">
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Register Personal Training Member</CardTitle>
                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">Client Profile Initialization</p>
                        <button onClick={onClose} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
                    </CardHeader>
                    
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Guest Name *" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
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
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-11 rounded-xl text-xs" />
                                <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="Total Sessions *" type="number" min="1" value={formData.total_sessions} onChange={e => setFormData({...formData, total_sessions: parseInt(e.target.value) || 1})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="Start Date *" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="Expiry Date *" type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                            </div>

                            <Input label="Internal Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Fitness goals, medical conditions..." className="h-11 rounded-xl text-xs" />

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
    guest_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    total_sessions INTEGER NOT NULL,
    used_sessions INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    sale_id TEXT,
    trainer_id TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Active',
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
                                <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-slate-100 hover:bg-slate-200 transition-colors">Skip</button>
                                <Button type="submit" disabled={loading} className="flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">
                                    {loading ? 'Registering...' : 'Register Profile'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
            {showSignatureModal && (
                <SignatureModal
                    isOpen={showSignatureModal}
                    onClose={() => setShowSignatureModal(false)}
                    onSave={handleSignatureSave}
                    onSkip={handleSkipSignature}
                    onMethodSelect={setSignatureMethod}
                    signatureMethod={signatureMethod}
                    signatureRef={signatureRef}
                    onClear={() => signatureRef.current?.clear()}
                />
            )}
        </div>
    );
};
