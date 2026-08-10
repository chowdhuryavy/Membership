import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, Save, AlertTriangle, Eraser, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from './ui';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceFeeConsent } from '../types';
import { getBilingualWaiverText } from '../lib/waiverHelper';
import SignatureCanvas from 'react-signature-canvas';

const getCurrentFormattedTime = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

export const EntranceFeeConsentModal = ({
    isOpen,
    onClose,
    onSuccess,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (consent: EntranceFeeConsent) => void;
    initialData?: (Partial<EntranceFeeConsent> & { guestName?: string }) | null;
}) => {
    const { currentOutlet, currentProperty } = useSettings();
    const waiver = getBilingualWaiverText(currentOutlet?.name, currentProperty?.name);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [acceptedWaiver, setAcceptedWaiver] = useState(true);
    const signatureRef = useRef<SignatureCanvas>(null);

    const isEditMode = !!initialData?.id;

    const [formData, setFormData] = useState({
        guest_name: initialData?.guest_name || initialData?.guestName || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        qid_passport: initialData?.qid_passport || '',
        date: initialData?.date || new Date().toISOString().split('T')[0],
        time: initialData?.time || getCurrentFormattedTime(),
        room_number: initialData?.room_number || '',
        is_hotel_guest: initialData?.is_hotel_guest ?? (!!initialData?.room_number),
        notes: initialData?.notes || (initialData?.item_name ? `Purchased item: ${initialData.item_name}` : '')
    });

    React.useEffect(() => {
        if (isOpen) {
            setFormData({
                guest_name: initialData?.guest_name || initialData?.guestName || '',
                phone: initialData?.phone || '',
                email: initialData?.email || '',
                qid_passport: initialData?.qid_passport || '',
                date: initialData?.date || new Date().toISOString().split('T')[0],
                time: initialData?.time || getCurrentFormattedTime(),
                room_number: initialData?.room_number || '',
                is_hotel_guest: initialData?.is_hotel_guest ?? (!!initialData?.room_number),
                notes: initialData?.notes || (initialData?.item_name ? `Purchased item: ${initialData.item_name}` : '')
            });
            setError('');

            setTimeout(() => {
                if (initialData?.guest_signature && signatureRef.current) {
                    try {
                        signatureRef.current.fromDataURL(initialData.guest_signature);
                    } catch (e) {
                        signatureRef.current?.clear();
                    }
                } else {
                    signatureRef.current?.clear();
                }
            }, 100);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetOutletId = initialData?.outlet_id || currentOutlet?.id;
        if (!formData.guest_name || !targetOutletId) {
            setError('Please fill all required fields (Guest Name & Facility Outlet).');
            return;
        }

        if (!acceptedWaiver) {
            setError('Please accept the Waiver and Release terms to proceed.');
            return;
        }

        const isEmptySig = signatureRef.current?.isEmpty();
        let signatureDataUrl = isEmptySig ? '' : signatureRef.current?.getTrimmedCanvas().toDataURL('image/png');

        // Retain existing signature if editing and signature canvas was not altered
        if (isEmptySig && isEditMode && initialData?.guest_signature) {
            signatureDataUrl = initialData.guest_signature;
        } else if (isEmptySig && !isEditMode) {
            setError('Please provide a guest signature.');
            return;
        }

        setLoading(true);
        try {
            const consentData: Omit<EntranceFeeConsent, 'id' | 'created_at'> = {
                outlet_id: targetOutletId,
                guest_name: formData.guest_name,
                phone: formData.phone,
                email: formData.email,
                qid_passport: formData.qid_passport,
                date: formData.date,
                time: formData.time,
                room_number: formData.room_number,
                is_hotel_guest: formData.is_hotel_guest || !!formData.room_number,
                sale_id: initialData?.sale_id,
                item_name: initialData?.item_name,
                notes: formData.notes,
                guest_signature: signatureDataUrl
            };

            if (isEditMode && initialData?.id) {
                await db.updateEntranceFeeConsent(initialData.id, consentData);
                toast.success('Entrance Fee Consent record updated successfully!');
                const updatedObj: EntranceFeeConsent = {
                    ...consentData,
                    id: initialData.id,
                    created_at: initialData.created_at || new Date().toISOString()
                };
                onSuccess(updatedObj);
            } else {
                const saved = await db.addEntranceFeeConsent(consentData);
                toast.success('Entrance Fee Consent logged successfully!');
                onSuccess(saved as any); 
            }
        } catch (err: any) {
            const msg = err.message || '';
            setError(msg || 'Failed to register Entrance Fee Consent');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pt-16 pb-16">
            <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300 my-auto">
                <Card className="rounded-[2.5rem] shadow-2xl border-slate-200/60 overflow-hidden bg-white">
                    <CardHeader className="bg-emerald-600 text-white p-6 relative">
                        <div className="flex justify-between items-center pr-10">
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tight">{isEditMode ? 'Edit Entrance Fee Consent' : 'Entrance Fee Consent'}</CardTitle>
                                <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mt-1">Guest Facility Waiver & Liability Release</p>
                            </div>
                        </div>
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
                                <Input label="Check-In Time" type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="h-11 rounded-xl text-xs font-bold" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Input 
                                        label="Room Number (If Hotel Guest)" 
                                        value={formData.room_number} 
                                        onChange={e => setFormData({
                                            ...formData, 
                                            room_number: e.target.value,
                                            is_hotel_guest: !!e.target.value || formData.is_hotel_guest
                                        })} 
                                        placeholder="e.g. Room 402..." 
                                        className="h-11 rounded-xl text-xs font-bold" 
                                    />
                                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.is_hotel_guest} 
                                            onChange={e => setFormData({...formData, is_hotel_guest: e.target.checked})} 
                                            className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] font-bold text-slate-600">In-House Hotel Guest Resident</span>
                                    </label>
                                </div>
                                <Input label="Internal Audit Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Pass type or notes..." className="h-11 rounded-xl text-xs" />
                            </div>

                            {/* Detailed Bilingual Waiver and Release of Liability */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                                        Bilingual Waiver and Release of Liability Terms
                                    </label>
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase">
                                        Mandatory Guest Agreement / اتفاقية إلزامية
                                    </span>
                                </div>

                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed max-h-56 overflow-y-auto space-y-4 shadow-inner">
                                    {/* IMPORTANT DISCLAIMER BOX */}
                                    <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/80 space-y-2">
                                        <div>
                                            <p className="font-black text-amber-900 uppercase text-[10px] tracking-wider">
                                                IMPORTANT DISCLAIMER:
                                            </p>
                                            <p className="text-amber-900/90 text-[10.5px] mt-0.5">
                                                {waiver.importantDisclaimerEn}
                                            </p>
                                        </div>
                                        <div dir="rtl" className="pt-2 border-t border-amber-200/60 font-sans text-right">
                                            <p className="font-black text-amber-950 text-[11px]">
                                                إخلاء مسؤولية هام:
                                            </p>
                                            <p className="text-amber-950/90 text-[11px] leading-relaxed mt-0.5">
                                                {waiver.importantDisclaimerAr}
                                            </p>
                                        </div>
                                    </div>

                                    {/* FULL WAIVER TERMS - ENGLISH */}
                                    <div className="space-y-2 pt-1">
                                        <p className="font-black text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-200 pb-1">
                                            {waiver.waiverTitleEn} — <span className="text-emerald-700">{waiver.waiverSubEn}</span>
                                        </p>
                                        <p className="text-slate-600 text-[10.5px]">{waiver.p1En}</p>
                                        <p className="text-slate-600 text-[10.5px]">{waiver.p2En}</p>
                                        <p className="text-slate-600 text-[10.5px] font-medium">{waiver.p3En}</p>
                                    </div>

                                    {/* FULL WAIVER TERMS - ARABIC */}
                                    <div dir="rtl" className="space-y-2 pt-3 border-t border-slate-200 font-sans text-right">
                                        <p className="font-black text-slate-900 text-[12px] border-b border-slate-200 pb-1">
                                            {waiver.waiverTitleAr} — <span className="text-emerald-700">{waiver.waiverSubAr}</span>
                                        </p>
                                        <p className="text-slate-700 text-[11px] leading-relaxed">{waiver.p1Ar}</p>
                                        <p className="text-slate-700 text-[11px] leading-relaxed">{waiver.p2Ar}</p>
                                        <p className="text-slate-800 text-[11px] font-bold leading-relaxed">{waiver.p3Ar}</p>
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 cursor-pointer hover:bg-emerald-50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={acceptedWaiver} 
                                        onChange={e => setAcceptedWaiver(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-[11px] font-bold text-emerald-950">
                                        I have read, understood, and agree to the Bilingual Waiver & Release terms above. / قرأت وفهمت وأوافق على شروط وإخلاء المسؤولية أعلاه.
                                    </span>
                                </label>
                            </div>

                            {/* Guest Digital Signature */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Signature *</label>
                                    <button 
                                        type="button" 
                                        onClick={() => signatureRef.current?.clear()}
                                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                                    >
                                        <Eraser className="w-3 h-3" /> Clear Signature
                                    </button>
                                </div>
                                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-300 transition-colors">
                                    <SignatureCanvas 
                                        ref={signatureRef}
                                        penColor="#0f172a"
                                        canvasProps={{ className: 'w-full h-32 cursor-crosshair' }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-4 rounded-xl space-y-3 animate-in shake duration-300">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={onClose} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest bg-slate-100 hover:bg-slate-200 transition-colors">Skip Form</button>
                                <Button type="submit" disabled={loading} className="flex-[2] h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 text-white">
                                    {loading ? 'Saving...' : 'Save Consent & Store Record'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

