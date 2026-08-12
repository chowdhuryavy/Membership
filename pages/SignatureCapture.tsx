import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export const SignatureCapturePage: React.FC = () => {
    const { signatureId } = useParams<{ signatureId: string }>();
    const { currentOutlet, settings, currentProperty } = useSettings();
    const signatureRef = useRef<SignatureCanvas>(null);
    const [saved, setSaved] = useState(false);
    const [expired, setExpired] = useState(false);
    const [loading, setLoading] = useState(true);

    // Parse query parameters
    const getParams = () => {
        const fullUrl = window.location.href;
        const searchPart = window.location.search;
        const hashPart = window.location.hash;
        let params = new URLSearchParams();
        if (searchPart) params = new URLSearchParams(searchPart);
        if (hashPart.includes('?')) {
            const hashQuery = hashPart.split('?')[1];
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.forEach((value, key) => params.set(key, value));
        }
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

    useEffect(() => {
        const checkStatus = async () => {
            if (!signatureId) return;
            try {
                // If the notification doesn't exist at all on mount, it might have been cleaned up/expired
                // but we wait for the first save to create it
                setLoading(false);
            } catch (err) {
                console.error('Error checking status:', err);
                setLoading(false);
            }
        };
        checkStatus();
        signatureRef.current?.clear();
    }, [signatureId]);

    const handleSave = async (confirmed: boolean = false) => {
        if (!signatureId || !signatureRef.current) return;
        
        // Don't send empty signatures if not confirmed
        if (signatureRef.current.isEmpty() && !confirmed) return;
        
        const dataUrl = signatureRef.current.toDataURL();
        
        try {
            const syncData = {
                signature: dataUrl,
                confirmed,
                guestName,
                timestamp: new Date().toISOString()
            };

            // Use upsert to Supabase notifications as our "live bridge"
            // We use the same ID to keep the record unique for this session
            const { error } = await supabase
                .from('notifications')
                .upsert({
                    id: signatureId, 
                    title: `SIG_SYNC:${signatureId}`,
                    message: JSON.stringify(syncData),
                    type: 'info',
                    outlet_id: currentOutlet?.id,
                    user_id: '00000000-0000-0000-0000-000000000000'
                });

            if (error) throw error;
            if (confirmed) setSaved(true);
        } catch (err) {
            console.error('Error syncing signature:', err);
            // Only show toast on confirmed save failure
            if (confirmed) toast.error('Sync failed. Please try again.');
        }
    };

    // Real-time Stroke Sync: Listen to drawing events
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        let lastDataUrl = '';

        const startSync = () => {
            if (interval) clearInterval(interval);
            interval = setInterval(() => {
                if (signatureRef.current) {
                    const current = signatureRef.current.toDataURL();
                    if (current !== lastDataUrl) {
                        lastDataUrl = current;
                        handleSave(false);
                    }
                }
            }, 200);
        };

        const stopSync = () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
            // Send one last update on lift
            handleSave(false);
        };

        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('pointerdown', startSync);
            canvas.addEventListener('pointerup', stopSync);
            canvas.addEventListener('pointerleave', stopSync);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (canvas) {
                canvas.removeEventListener('pointerdown', startSync);
                canvas.removeEventListener('pointerup', stopSync);
                canvas.removeEventListener('pointerleave', stopSync);
            }
        };
    }, [signatureId, guestName, currentOutlet]);

    const handleClear = () => {
        signatureRef.current?.clear();
        handleSave(false);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-slate-50">Loading...</div>;
    }

    if (expired || saved) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">
                    {saved ? 'Signature Captured' : 'Session Expired'}
                </h1>
                <p className="text-slate-500 font-bold mb-8 text-center max-w-xs">
                    {saved ? 'Your signature has been saved successfully.' : 'This signature link has already been used or has expired.'}
                </p>
                <Button onClick={() => window.close()} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl">
                    Close Tab
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {settings?.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
                        ) : (
                            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">
                                {settings?.company_name?.[0] || 'H'}
                            </div>
                        )}
                        <div>
                            <h1 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">
                                {currentProperty?.name || settings?.company_name || 'Health Club'}
                            </h1>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                {currentOutlet?.name || 'Main Outlet'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Guest</p>
                        <p className="text-xs font-black text-slate-900 truncate max-w-[120px]">{guestName}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col gap-6 overflow-y-auto">
                {/* Enrollment Summary */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Enrollment Details</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">Selected Tier</span>
                            <span className="text-sm font-black text-slate-900">{tier}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">Membership Rate</span>
                            <span className="text-sm font-black text-indigo-600">{price}</span>
                        </div>
                    </div>
                </div>

                {/* Signature Pad */}
                <div className="flex-1 flex flex-col gap-3 min-h-[350px]">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Sign Below</h2>
                        <button 
                            onClick={handleClear}
                            className="text-[10px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors"
                        >
                            Clear Pad
                        </button>
                    </div>
                    
                    <div className="flex-1 bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden relative shadow-inner">
                        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-20 pointer-events-none" />
                        <div className="absolute bottom-16 left-8 right-8 h-px bg-slate-300 pointer-events-none" />
                        
                        <SignatureCanvas
                            ref={signatureRef}
                            canvasProps={{
                                className: 'w-full h-full relative z-10 cursor-crosshair',
                                style: { width: '100%', height: '100%' }
                            }}
                            onEnd={() => handleSave(false)}
                            backgroundColor="rgba(0,0,0,0)"
                            penColor="#000000"
                        />
                    </div>
                </div>
            </main>

            <footer className="p-6 bg-white border-t border-slate-100 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.05)] sticky bottom-0">
                <div className="max-w-md mx-auto">
                    <Button 
                        onClick={() => handleSave(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-7 rounded-2xl text-base shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        Confirm & Submit Signature
                    </Button>
                    <p className="text-[10px] text-slate-400 font-bold text-center mt-4 leading-relaxed uppercase tracking-tight">
                        By signing, you agree to the membership terms and conditions
                    </p>
                </div>
            </footer>
        </div>
    );
};
