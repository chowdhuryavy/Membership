import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { X, Save, AlertTriangle, Eraser, CheckCircle2, QrCode, FileSignature, Sparkles, ArrowRight, Search, User, Phone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from './ui';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceFeeConsent, Guest } from '../types';
import { getBilingualWaiverText } from '../lib/waiverHelper';
import { SignatureModal } from './SignatureModal';

const getCurrentFormattedTime = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

const DEFAULT_CURRENCY = { code: 'AED', symbol: 'AED' };

export const EntranceFeeConsentModal = ({
    isOpen,
    onClose,
    onSuccess,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (consent: EntranceFeeConsent) => void;
    initialData?: (Partial<EntranceFeeConsent> & { guestName?: string; saleId?: string; itemName?: string; price?: number; created_at?: string; id?: string; outlet_id?: string; guest_signature?: string; phone?: string; email?: string; qid_passport?: string; date?: string; time?: string; room_number?: string; is_hotel_guest?: boolean; notes?: string; guest_name?: string; item_name?: string; sale_id?: string }) | null;
}) => {
    const { currentOutlet, currentProperty, settings, currency, currencies } = useSettings();
    
    // 1. All hooks at the top level
    const waiver = useMemo(() => getBilingualWaiverText(currentOutlet?.name, currentProperty?.name), [currentOutlet?.name, currentProperty?.name]);
    const activeCurrency = useMemo(() => {
        return currency || 
               (currentProperty && currencies.find(c => c.property_id === currentProperty.id)) || 
               DEFAULT_CURRENCY;
    }, [currency, currentProperty, currencies]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [acceptedWaiver, setAcceptedWaiver] = useState(true);
    const [guestSignature, setGuestSignature] = useState<string | null>(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<any | null>(null);
    const [guestSearchResults, setGuestSearchResults] = useState<Guest[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showGuestSuggestions, setShowGuestSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

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
        notes: initialData?.notes || (initialData?.item_name || (initialData as any)?.itemName ? `Purchased item: ${initialData?.item_name || (initialData as any)?.itemName}` : '')
    });

    useEffect(() => {
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
                notes: initialData?.notes || (initialData?.item_name || (initialData as any)?.itemName ? `Purchased item: ${initialData?.item_name || (initialData as any)?.itemName}` : '')
            });
            setGuestSignature(initialData?.guest_signature || null);
            setError('');
            setGuestSearchResults([]);
            setShowGuestSuggestions(false);
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowGuestSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onFinalSubmit = useCallback(async (data: any, signatureOverride?: string) => {
        setLoading(true);
        try {
            const consentData: Omit<EntranceFeeConsent, 'id' | 'created_at'> = {
                ...data,
                guest_signature: signatureOverride !== undefined ? signatureOverride : guestSignature || undefined
            };

            if (isEditMode && initialData?.id) {
                await db.updateEntranceFeeConsent(initialData.id, consentData);
                toast.success('Entrance Fee Consent record updated successfully!');
                const updatedObj: EntranceFeeConsent = {
                    ...consentData,
                    id: initialData.id,
                    created_at: initialData.created_at || new Date().toISOString()
                } as EntranceFeeConsent;
                onSuccess(updatedObj);
            } else {
                const saved = await db.addEntranceFeeConsent(consentData);
                toast.success('Entrance Fee Consent logged successfully!');
                onSuccess(saved as any);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to register Entrance Fee Consent');
        } finally {
            setLoading(false);
        }
    }, [isEditMode, initialData, guestSignature, onSuccess]);

    const handleSignatureSave = useCallback(async (dataUrl: string) => {
        setGuestSignature(dataUrl);
        setShowSignatureModal(false);
        if (pendingSubmitData) {
            await onFinalSubmit(pendingSubmitData, dataUrl);
        }
    }, [pendingSubmitData, onFinalSubmit]);

    const handleSkipSignature = useCallback(async () => {
        setGuestSignature('BYPASSED');
        setShowSignatureModal(false);
        if (pendingSubmitData) {
            await onFinalSubmit(pendingSubmitData, 'BYPASSED');
        }
    }, [pendingSubmitData, onFinalSubmit]);

    const closeSignatureModal = useCallback(() => {
        setShowSignatureModal(false);
        setPendingSubmitData(null);
        setLoading(false);
    }, []);

    const searchGuests = async (value: string, type: 'name' | 'phone') => {
        if (value.length < 3 || !currentProperty) {
            setGuestSearchResults([]);
            setShowGuestSuggestions(false);
            return;
        }

        setIsSearching(true);
        try {
            const results = await db.getGuests(currentProperty.id, {
                [type]: value,
                limit: 5
            });
            setGuestSearchResults(results);
            setShowGuestSuggestions(results.length > 0);
        } catch (err) {
            console.error('Guest search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectGuest = (guest: Guest) => {
        setFormData({
            ...formData,
            guest_name: guest.name,
            phone: guest.phone || '',
            email: guest.email || '',
        });
        setShowGuestSuggestions(false);
    };

    const prepareConsentData = () => {
        const targetOutletId = initialData?.outlet_id || currentOutlet?.id;
        if (!formData.guest_name || !targetOutletId) {
            setError('Please fill all required fields (Guest Name & Facility Outlet).');
            return null;
        }

        if (!acceptedWaiver) {
            setError('Please accept the Waiver and Release terms to proceed.');
            return null;
        }

        return {
            outlet_id: targetOutletId,
            guest_name: formData.guest_name,
            phone: formData.phone,
            email: formData.email,
            qid_passport: formData.qid_passport,
            date: formData.date,
            time: formData.time,
            room_number: formData.room_number,
            is_hotel_guest: formData.is_hotel_guest || !!formData.room_number,
            sale_id: initialData?.sale_id || (initialData as any)?.saleId,
            item_name: initialData?.item_name || (initialData as any)?.itemName,
            notes: formData.notes
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const data = prepareConsentData();
        if (!data) return;

        if (guestSignature) {
            await onFinalSubmit(data, guestSignature);
        } else {
            setPendingSubmitData(data);
            setShowSignatureModal(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pt-16 pb-16">
            <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300 my-auto">
                <Card className="rounded-[2.5rem] shadow-2xl border-slate-200/60 overflow-hidden bg-white">
                    <CardHeader className="bg-emerald-600 text-white p-6 relative">
                        <div className="flex justify-between items-center pr-10">
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tight">
                                    {isEditMode ? 'Edit Entrance Fee Consent' : 'Entrance Fee Consent'}
                                </CardTitle>
                                <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mt-1">
                                    Guest Facility Waiver & Liability Release
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </CardHeader>
                    
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <Input 
                                        label="Guest Name *" 
                                        value={formData.guest_name} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({...formData, guest_name: val});
                                            searchGuests(val, 'name');
                                        }} 
                                        placeholder="Search or enter name..."
                                        className="h-11 rounded-xl text-xs font-bold pr-10" 
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-8">
                                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {showGuestSuggestions && (
                                        <div ref={suggestionRef} className="absolute z-[210] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {guestSearchResults.map(guest => (
                                                <button
                                                    key={guest.id}
                                                    type="button"
                                                    onClick={() => handleSelectGuest(guest)}
                                                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-900">{guest.name}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{guest.phone || 'No phone'}</span>
                                                    </div>
                                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Input label="QID / Passport No." value={formData.qid_passport} onChange={e => setFormData({...formData, qid_passport: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <Input 
                                        label="Phone Number" 
                                        value={formData.phone} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({...formData, phone: val});
                                            searchGuests(val, 'phone');
                                        }} 
                                        placeholder="Search by phone..."
                                        className="h-11 rounded-xl text-xs font-bold pr-10" 
                                    />
                                </div>
                                <Input label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Date *" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="h-11 rounded-xl text-xs" />
                                <Input label="Time *" type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="h-11 rounded-xl text-xs" />
                            </div>

                            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_hotel_guest} 
                                        onChange={e => setFormData({...formData, is_hotel_guest: e.target.checked})} 
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover:text-emerald-600 transition-colors">Hotel Guest?</span>
                                </label>
                                {formData.is_hotel_guest && (
                                    <Input 
                                        placeholder="Room Number" 
                                        value={formData.room_number} 
                                        onChange={e => setFormData({...formData, room_number: e.target.value})} 
                                        className="h-9 rounded-xl text-xs font-bold w-32 border-emerald-200" 
                                    />
                                )}
                            </div>

                            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 rounded-lg"><Sparkles className="w-3.5 h-3.5 text-emerald-600" /></div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Waiver & Liability Release</h4>
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="max-h-48 overflow-y-auto pr-2 space-y-3">
                                    <p className="text-[10px] text-slate-700 leading-relaxed text-justify font-medium">{waiver.importantDisclaimerEn}</p>
                                    <p dir="rtl" className="text-[10px] text-slate-600 leading-relaxed text-justify font-arabic">{waiver.importantDisclaimerAr}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={acceptedWaiver} 
                                            onChange={e => setAcceptedWaiver(e.target.checked)} 
                                            className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                                        />
                                        <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                                            I have read and agree to the waiver and liability release terms.
                                            <br/>
                                            <span className="font-arabic text-[11px]" dir="rtl">لقد قرأت وأوافق على شروط التنازل وإخلاء المسؤولية.</span>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold animate-in slide-in-from-top-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={onClose} 
                                    className="flex-1 h-12 rounded-2xl border-slate-200 text-slate-600 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={loading || !acceptedWaiver}
                                    className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {loading ? 'Processing...' : guestSignature ? 'Update Consent' : 'Provide Signature'}
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
                    propertyName={currentProperty?.name}
                    outletName={currentOutlet?.name}
                    outletId={currentOutlet?.id}
                    tier="Facility Guest Waiver"
                    price="0"
                    currency={activeCurrency?.code}
                    currencySymbol={activeCurrency?.symbol}
                    logoUrl={currentProperty?.logo_url || settings?.logo_url}
                    agreementType="entrance"
                />
            )}
        </div>
    );
};
