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
    const { currentOutlet } = useSettings();
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
        const dataUrl = signatureRef.current.toDataURL();
        
        try {
            const syncData = {
                signature: dataUrl,
                confirmed,
                guestName,
                timestamp: new Date().toISOString()
            };

            // Use upsert to Supabase notifications as our "live bridge"
            const { error } = await supabase
                .from('notifications')
                .upsert({
                    id: signatureId, // Use signatureId as UUID if it is one, or it will auto-generate
                    title: `SIG_SYNC:${signatureId}`,
                    message: JSON.stringify(syncData),
                    type: 'info',
                    outlet_id: currentOutlet?.id,
                    user_id: '00000000-0000-0000-0000-000000000000' // System ID
                });

            if (error) throw error;
            if (confirmed) setSaved(true);
        } catch (err) {
            console.error('Error syncing signature:', err);
            toast.error('Sync failed. Please try again.');
        }
    };

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
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            <header className="p-6 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Guest Enrollment</h1>
                    <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1">Live Signature Bridge</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Staff Reference</p>
                    <p className="text-xs font-black text-slate-600 truncate max-w-[120px]">{signatureId?.slice(0, 8)}...</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 flex flex-col gap-6 overflow-y-auto">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Guest Name', value: guestName },
                        { label: 'Membership Tier', value: tier },
                        { label: 'Base Rate', value: price }
                    ].map((info, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{info.label}</p>
                            <p className="text-sm font-black text-slate-900 truncate">{info.value}</p>
                        </div>
                    ))}
                </section>

                <section className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Sign Below</h2>
                        <button onClick={handleClear} className="text-[10px] font-black text-indigo-600 uppercase hover:text-indigo-700">Clear Canvas</button>
                    </div>
                    
                    <div className="flex-1 bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden relative min-h-[300px]">
                        <SignatureCanvas
                            ref={signatureRef}
                            canvasProps={{
                                className: 'w-full h-full cursor-crosshair',
                                style: { width: '100%', height: '100%' }
                            }}
                            onEnd={() => handleSave(false)}
                            backgroundColor="rgba(255,255,255,0)"
                        />
                    </div>
                </section>
            </main>

            <footer className="p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                <Button 
                    onClick={() => handleSave(true)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl text-base shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
                >
                    Confirm Signature
                </Button>
                <p className="text-[10px] text-slate-400 font-bold text-center mt-4 uppercase tracking-tighter">
                    By clicking confirm, you agree to the membership terms shown on the staff monitor
                </p>
            </footer>
        </div>
    );
};
