import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui';
import { CheckCircle2, X, FileText } from 'lucide-react';
import { supabase } from '../services/mockSupabase';
import { GYM_RULES } from '../services/memberAgreementPdfService';
import { getBilingualPTConsentText, getBilingualWaiverText } from '../lib/waiverHelper';

export const SignatureCapturePage: React.FC = () => {
    const { signatureId } = useParams<{ signatureId: string }>();
    const signatureRef = useRef<SignatureCanvas>(null);
    const [saved, setSaved] = useState(false);
    const [expired, setExpired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // Parse query parameters
    const getParams = () => {
        const fullUrl = window.location.href;
        const searchPart = window.location.search;
        const hashPart = window.location.hash;
        let params = new URLSearchParams();
        
        // Handle standard search params
        if (searchPart) {
            const searchParams = new URLSearchParams(searchPart);
            searchParams.forEach((value, key) => params.set(key, value));
        }
        
        // Handle hash-based query params (for HashRouter)
        if (hashPart.includes('?')) {
            const hashQuery = hashPart.split('?')[1];
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.forEach((value, key) => params.set(key, value));
        }
        
        // Fallback for cases where params might be elsewhere in the URL
        if (!params.has('name') && fullUrl.includes('?')) {
            const fallbackQuery = fullUrl.substring(fullUrl.indexOf('?') + 1);
            const fallbackParams = new URLSearchParams(fallbackQuery);
            fallbackParams.forEach((value, key) => params.set(key, value));
        }
        return params;
    };

    const searchParams = getParams();
    const guestName = searchParams.get('name') || 'Guest';
    const tier = searchParams.get('tier') || 'Standard';
    const price = searchParams.get('price') || '0';
    const propertyName = searchParams.get('property') || 'Health Club';
    const outletName = searchParams.get('outlet') || 'Main Outlet';
    const outletId = searchParams.get('outlet_id') || '';
    const currency = searchParams.get('currency') || 'AED';
    const currencySymbol = searchParams.get('symbol') || currency;
    const logoUrl = searchParams.get('logo') || '';
    const agreementType = searchParams.get('type') || '';
    
    const isPTAgreement = agreementType === 'pt' || tier.toLowerCase().includes('pt') || tier.toLowerCase().includes('personal') || tier.toLowerCase().includes('training') || tier.toLowerCase().includes('consent');
    const isEntranceWaiver = agreementType === 'waiver' || agreementType === 'entrance' || tier.toLowerCase().includes('entrance') || tier.toLowerCase().includes('pass') || tier.toLowerCase().includes('waiver');

    const waiverContent = isEntranceWaiver ? getBilingualWaiverText(outletName, propertyName) : null;


    useEffect(() => {
        if (!signatureId) return;

        // Listen for staff confirmation or record changes
        const channel = supabase
            .channel(`guest_sync:${signatureId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events
                    schema: 'public',
                    table: 'notifications',
                    filter: `id=eq.${signatureId}`
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        setSaved(prevSaved => {
                            setExpired(prevExpired => {
                                if (!prevExpired) return prevExpired;
                                return prevExpired;
                            });
                            // If it was already expired (cancelled), don't show success
                            return true; 
                        });
                        toast.success('Agreement Finalized!');
                    } else if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                        try {
                            const syncData = JSON.parse(payload.new.message);
                            if (syncData.completed_by_staff) {
                                setSaved(true);
                            } else if (syncData.cancelled) {
                                setExpired(true);
                                toast.error('Session Cancelled by Staff');
                            }
                        } catch (e) {}
                    }
                }
            )
            .subscribe();

        // Check status on mount
        const initCheck = async () => {
            try {
                const { data } = await supabase
                    .from('notifications')
                    .select('id, message')
                    .eq('id', signatureId)
                    .maybeSingle();
                
                if (data?.message) {
                    try {
                        const syncData = JSON.parse(data.message);
                        if (syncData.completed_by_staff) setSaved(true);
                        if (syncData.cancelled) setExpired(true);
                    } catch (e) {}
                }
                // If record does not exist yet, do NOT mark as expired; let guest sign and upsert
            } catch (err) {
                console.warn("Signature session check fallback:", err);
            } finally {
                setLoading(false);
            }
        };
        initCheck();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [signatureId]);

    const handleSave = async (confirmed: boolean = false) => {
        if (!signatureId || !signatureRef.current) return;
        
        // Validation: Don't allow submission if terms not accepted
        if (confirmed && !acceptedTerms) {
            toast.error('Please accept the Terms and Conditions.');
            return;
        }

        // Validation: Don't allow submission if empty
        if (confirmed && signatureRef.current.isEmpty()) {
            toast.error('Please sign before submitting.');
            return;
        }

        // Don't sync empty signatures during live drawing
        if (signatureRef.current.isEmpty() && !confirmed) return;
        
        const dataUrl = signatureRef.current.toDataURL();
        
        try {
            const syncData = {
                signature: dataUrl,
                confirmed,
                guestName,
                timestamp: new Date().toISOString()
            };

            const payloadData = {
                id: signatureId, 
                title: `SIG_SYNC:${signatureId}`,
                message: JSON.stringify(syncData),
                type: 'info',
                outlet_id: outletId || null,
                user_id: '00000000-0000-0000-0000-000000000000'
            };

            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('id', signatureId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('notifications')
                    .update({ message: JSON.stringify(syncData) })
                    .eq('id', signatureId);
            } else {
                await supabase
                    .from('notifications')
                    .insert([payloadData]);
            }

            if (confirmed) setSaved(true);
        } catch (err) {
            console.error('Error syncing signature:', err);
            if (confirmed) toast.error('Submission failed. Please try again.');
        }
    };

    // Real-time Stroke Sync: Optimized interval management
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastSyncedUrlRef = useRef<string>('');

    const startLiveSync = () => {
        if (syncIntervalRef.current) return;
        syncIntervalRef.current = setInterval(() => {
            if (signatureRef.current) {
                const current = signatureRef.current.toDataURL();
                if (current !== lastSyncedUrlRef.current) {
                    lastSyncedUrlRef.current = current;
                    handleSave(false);
                }
            }
        }, 300);
    };

    const stopLiveSync = () => {
        if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = null;
        }
        // Final sync on lift
        handleSave(false);
    };

    useEffect(() => {
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, []);

    const handleClear = () => {
        signatureRef.current?.clear();
        handleSave(false);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-slate-50">Loading...</div>;
    }

    if (expired || saved) {
        const isActuallySaved = saved && !expired;
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
                <div className={`w-20 h-20 ${isActuallySaved ? 'bg-emerald-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mb-6`}>
                    {isActuallySaved ? (
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    ) : (
                        <X className="w-10 h-10 text-amber-600" />
                    )}
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">
                    {isActuallySaved ? 'Signature Captured' : 'Session Expired'}
                </h1>
                <p className="text-slate-500 font-bold mb-8 text-center max-w-xs">
                    {isActuallySaved ? 'Your signature has been saved successfully.' : 'This signature link has already been used or has expired.'}
                </p>
                <Button onClick={() => window.close()} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl">
                    Close Tab
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-200 p-6 sticky top-0 z-20">
                <div className="max-w-md mx-auto flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center text-center">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-2xl mb-4 shadow-sm" />
                        ) : (
                            <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4 shadow-lg shadow-indigo-100">
                                {propertyName[0] || 'H'}
                            </div>
                        )}
                        <h1 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                            {propertyName}
                        </h1>
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-[0.2em] mt-1">
                            {outletName}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full p-6 flex flex-col gap-6 overflow-y-auto">
                {/* Guest Profile Section */}
                <div className="text-center bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">Welcome Guest</p>
                    <h2 className="text-3xl font-black tracking-tight mb-1">{guestName}</h2>
                    <div className="h-px w-12 bg-white/30 mx-auto my-4" />
                    <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Tier</p>
                            <p className="text-sm font-black">{tier}</p>
                        </div>
                        <div className="w-px h-8 bg-white/20" />
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Rate</p>
                            <p className="text-sm font-black">{currencySymbol} {price}</p>
                        </div>
                    </div>
                </div>

                {/* Terms and Conditions Section - Shown prominently BEFORE the signature pad */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Health Declaration & Consent</h3>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">Bilingual / ثنائي اللغة</span>
                    </div>

                    {/* Prominent Bilingual Declaration Preview */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] leading-relaxed space-y-2 max-h-36 overflow-y-auto">
                        <p className="text-slate-700 font-medium text-justify">
                            {isPTAgreement 
                                ? "I declare that I am in good physical health to participate in Personal Training. I confirm that all PAR-Q answers provided are true and accurate." 
                                : "I agree to abide by all club guidelines, facility safety rules, and operational regulations."}
                        </p>
                        <p dir="rtl" className="text-slate-600 font-arabic text-justify">
                            {isPTAgreement 
                                ? "أقر بأنني بحالة صحية جيدة تؤهلني للمشاركة في التدريب الشخصي، وأؤكد أن جميع إجاباتي على استبيان الجاهزية البدنية صحيحة ودقيقة." 
                                : "أوافق على الالتزام بكافة لوائح وقوانين النادي وشروط السلامة المعتمدة."}
                        </p>
                    </div>

                    <div className="flex items-start gap-3 pt-1">
                        <div className="relative flex items-center pt-0.5">
                            <input
                                id="terms"
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="terms" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                                I accept the <span className="text-indigo-600 underline">Terms, Conditions & Waiver</span>.
                            </label>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-tight">
                                أوافق على شروط وأحكام الإقرار الصحي
                            </p>
                        </div>
                    </div>

                    <button 
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest transition-all cursor-pointer"
                    >
                        <FileText className="w-4 h-4" />
                        Read Full Policy & Questionnaire (EN/AR)
                    </button>
                </div>

                {/* Signature Pad */}
                <div className="flex-1 flex flex-col gap-4 min-h-[400px]">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Live Signature Area</h2>
                        </div>
                        <button 
                            onClick={handleClear}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                        >
                            Reset Canvas
                        </button>
                    </div>
                    
                    <div className="flex-1 bg-white border-2 border-slate-200 rounded-[3rem] overflow-hidden relative shadow-inner flex flex-col group transition-all focus-within:border-indigo-300">
                        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-20 pointer-events-none" />
                        <div className="absolute bottom-16 left-12 right-12 h-px bg-slate-300 pointer-events-none" />
                        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                            <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.4em]">Sign on the line above</span>
                        </div>
                        
                        <SignatureCanvas
                            ref={signatureRef}
                            canvasProps={{
                                className: 'flex-1 w-full h-full cursor-crosshair touch-none relative z-10',
                                style: { minHeight: '300px' }
                            }}
                            onBegin={startLiveSync}
                            onEnd={stopLiveSync}
                            backgroundColor="rgba(0,0,0,0)"
                            penColor="#000000"
                        />
                    </div>
                </div>
            </main>

            <footer className="p-8 bg-white border-t border-slate-100 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
                <div className="max-w-md mx-auto">
                    <Button 
                        onClick={() => handleSave(true)}
                        disabled={!acceptedTerms}
                        className={`w-full font-black py-8 rounded-[2rem] text-lg shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${
                            acceptedTerms 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                            : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed opacity-50'
                        }`}
                    >
                        Confirm Agreement
                        <CheckCircle2 className="w-6 h-6" />
                    </Button>
                    <p className="text-[10px] text-slate-400 font-bold text-center mt-6 leading-relaxed uppercase tracking-[0.1em]">
                        Digital agreement session • Encrypted & Secure
                    </p>
                </div>
            </footer>

            {/* Terms and Conditions Modal */}
            {showTermsModal && (() => {
                const ptConsent = isPTAgreement ? getBilingualPTConsentText(propertyName || outletName || 'The Torch Club') : null;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                                        {isPTAgreement && ptConsent ? ptConsent.titleEn : 'Rules & Regulations'}
                                    </h3>
                                    <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1" dir="rtl">
                                        {isPTAgreement && ptConsent ? ptConsent.titleAr : 'القواعد و اللوائح'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowTermsModal(false)}
                                    className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-900 shadow-sm"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                                {isPTAgreement && ptConsent ? (
                                    <div className="space-y-6">
                                        {/* Intro */}
                                        <div className="space-y-4">
                                            {ptConsent.introParagraphs.map((para, idx) => (
                                                <div key={idx} className="space-y-1.5 border-b border-slate-100 pb-3">
                                                    <p className="text-slate-700 leading-relaxed font-medium">{para.en}</p>
                                                    <p dir="rtl" className="text-slate-600 font-arabic leading-relaxed">{para.ar}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* PAR-Q */}
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                                            <div className="flex justify-between items-center font-black text-[11px] text-slate-900 border-b border-slate-200 pb-1.5">
                                                <span>{ptConsent.parqTitleEn}</span>
                                                <span dir="rtl" className="font-arabic">{ptConsent.parqTitleAr}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold">{ptConsent.parqInstructionEn}</p>
                                            <div className="space-y-2.5">
                                                {ptConsent.parqQuestions.map((q) => (
                                                    <div key={q.id} className="text-[10.5px] border-b border-slate-200/60 pb-2 last:border-0">
                                                        <p className="font-bold text-slate-800">{q.id}. {q.en}</p>
                                                        <p dir="rtl" className="font-arabic text-slate-600 mt-0.5">{q.ar}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Declarations */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center font-black text-[11px] text-slate-900 border-b border-slate-200 pb-1">
                                                <span>{ptConsent.declarationTitleEn}</span>
                                                <span dir="rtl" className="font-arabic">{ptConsent.declarationTitleAr}</span>
                                            </div>
                                            {ptConsent.declarationParagraphs.map((para, idx) => (
                                                <div key={idx} className="space-y-1 text-[10.5px] border-b border-slate-50 pb-2.5 last:border-0">
                                                    <p className="text-slate-700 leading-relaxed">• {para.en}</p>
                                                    <p dir="rtl" className="text-slate-600 font-arabic leading-relaxed">• {para.ar}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : isEntranceWaiver && waiverContent ? (
                                    <div className="space-y-8">
                                        <div className="space-y-4 border-b border-slate-100 pb-6">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{waiverContent.waiverTitleEn}</p>
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{waiverContent.waiverSubEn}</p>
                                            </div>
                                            <div className="space-y-3 text-slate-700 leading-relaxed text-[13px] text-justify font-medium">
                                                <p>{waiverContent.p1En}</p>
                                                <p>{waiverContent.p2En}</p>
                                                <p className="font-bold text-slate-900">{waiverContent.p3En}</p>
                                            </div>
                                        </div>
                                        <div dir="rtl" className="space-y-4 text-right">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-slate-900 tracking-tight">{waiverContent.waiverTitleAr}</p>
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{waiverContent.waiverSubAr}</p>
                                            </div>
                                            <div className="space-y-3 text-slate-600 leading-relaxed text-[13px] text-justify font-arabic">
                                                <p>{waiverContent.p1Ar}</p>
                                                <p>{waiverContent.p2Ar}</p>
                                                <p className="font-bold text-slate-900">{waiverContent.p3Ar}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    GYM_RULES.map((rule, idx) => (
                                        <div key={idx} className="flex gap-4 items-start border-b border-slate-50 pb-6 last:border-0">
                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 space-y-2">
                                                <p className="text-sm font-bold text-slate-700 leading-relaxed text-left">
                                                    {rule.en}
                                                </p>
                                                <p className="text-sm font-black text-slate-500 leading-relaxed text-right font-serif" dir="rtl">
                                                    {rule.ar}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="p-6 border-t border-slate-100 bg-white">
                                <Button 
                                    onClick={() => {
                                        setAcceptedTerms(true);
                                        setShowTermsModal(false);
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-100"
                                >
                                    I Understand & Accept
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
