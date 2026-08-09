import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, Save, AlertTriangle, Eraser } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from './ui';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceFeeConsent } from '../types';
import SignatureCanvas from 'react-signature-canvas';

export const EntranceFeeConsentModal = ({
    isOpen,
    onClose,
    onSuccess,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (consent: EntranceFeeConsent) => void;
    initialData: { guestName: string; saleId?: string; itemName?: string };
}) => {
    const { currentOutlet } = useSettings();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const signatureRef = useRef<SignatureCanvas>(null);

    const [formData, setFormData] = useState({
        guest_name: initialData?.guestName || '',
        phone: '',
        email: '',
        qid_passport: '',
        date: new Date().toISOString().split('T')[0],
        notes: initialData?.itemName ? `Purchased item: ${initialData.itemName}` : ''
    });

    React.useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                guest_name: initialData.guestName || '',
                phone: '',
                email: '',
                qid_passport: '',
                date: new Date().toISOString().split('T')[0],
                notes: initialData.itemName ? `Purchased item: ${initialData.itemName}` : ''
            });
            setError('');
            signatureRef.current?.clear();
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.guest_name || !currentOutlet) {
            setError('Please fill all required fields.');
            return;
        }

        const isEmptySig = signatureRef.current?.isEmpty();
        const signatureDataUrl = isEmptySig ? '' : signatureRef.current?.getTrimmedCanvas().toDataURL('image/png');

        if (isEmptySig) {
            setError('Please provide a signature.');
            return;
        }

        setLoading(true);
        try {
            const consentData: Omit<EntranceFeeConsent, 'id' | 'created_at'> = {
                outlet_id: currentOutlet.id,
                guest_name: formData.guest_name,
                phone: formData.phone,
                email: formData.email,
                qid_passport: formData.qid_passport,
                date: formData.date,
                sale_id: initialData.saleId,
                item_name: initialData.itemName,
                notes: formData.notes,
                guest_signature: signatureDataUrl
            };

            const saved = await db.addEntranceFeeConsent(consentData);
            onSuccess(saved as any); 
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('schema cache') || msg.includes('42P01') || msg.includes('relation "public.entrance_fee_consents" does not exist')) {
                setError('Database schema/RLS security policy needs updating. Please run the SQL setup script.');
            } else {
                setError(msg || 'Failed to register Entrance Fee Consent');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pt-20">
            <div className="w-full max-w-xl animate-in zoom-in-95 duration-300 my-auto">
                <Card className="rounded-[2rem] shadow-2xl border-slate-200/60 overflow-hidden bg-white">
                    <CardHeader className="bg-emerald-600 text-white p-6 relative">
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Entrance Fee Consent</CardTitle>
                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mt-1">Guest Waiver and Release</p>
                        <button onClick={onClose} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
                    </CardHeader>
                    
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Guest Name *" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="QID / Passport No." value={formData.qid_passport} onChange={e => setFormData({...formData, qid_passport: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-11 rounded-xl text-xs" />
                                <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Date *" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                                <Input label="Internal Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Any additional notes..." className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                                <p className="font-bold mb-2 uppercase text-slate-800">Waiver and Release of Liability</p>
                                <p>By signing this form, I acknowledge that the use of the health club facilities, including the pool and gym, involves inherent risks. I voluntarily assume all risks associated with participation in any physical activities or use of the facilities.</p>
                                <p className="mt-2">I hereby release, waive, and discharge the management, staff, and owners of the property from any and all liability, claims, demands, or causes of action arising out of any injury, loss, or damage that may occur to me or my property during my visit.</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Signature *</label>
                                    <button 
                                        type="button" 
                                        onClick={() => signatureRef.current?.clear()}
                                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                                    >
                                        <Eraser className="w-3 h-3" /> Clear
                                    </button>
                                </div>
                                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-200 transition-colors">
                                    <SignatureCanvas 
                                        ref={signatureRef}
                                        penColor="#0f172a"
                                        canvasProps={{ className: 'w-full h-32 cursor-crosshair' }}
                                    />
                                </div>
                            </div>

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
                                                    const sql = `CREATE TABLE IF NOT EXISTS public.entrance_fee_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    qid_passport TEXT,
    date DATE NOT NULL,
    sale_id TEXT,
    item_name TEXT,
    guest_signature TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.entrance_fee_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on entrance_fee_consents" ON public.entrance_fee_consents;
CREATE POLICY "Allow all on entrance_fee_consents" ON public.entrance_fee_consents FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.entrance_fee_consents TO anon, authenticated, postgres;
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
                                <Button type="submit" disabled={loading} className="flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100">
                                    {loading ? 'Saving...' : 'Save Consent Form'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
