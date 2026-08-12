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
        <div className="flex flex-col h-screen bg-white overflow-hidden font-sans">
            <header className="p-6 bg-slate-900 text-white flex items-center justify-between shadow-xl z-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/20">
                        {guestName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-tight leading-none">Agreement Signing</h1>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Digital Identity Verification</p>
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Session Token</p>
                    <p className="text-xs font-mono text-slate-400">{signatureId?.slice(0, 8)}</p>
                </div>
            </header>

            <main className="flex-1 flex flex-col bg-slate-50 relative">
                {/* Status Bar */}
                <div className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center shadow-md z-10">
                    Live connection active • Encrypted
                </div>

                <div className="flex-1 flex flex-col p-4 sm:p-8 gap-6 overflow-y-auto">
                    {/* Guest Context Card */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/60 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex-1 w-full">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Member Name</p>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{guestName}</h2>
                        </div>
                        <div className="h-px sm:h-12 w-full sm:w-px bg-slate-100" />
                        <div className="flex-1 w-full">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Selected Tier</p>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{tier}</h3>
                            </div>
                        </div>
                        <div className="h-px sm:h-12 w-full sm:w-px bg-slate-100" />
                        <div className="flex-1 w-full">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Monthly Rate</p>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">{price}</h3>
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="flex-1 flex flex-col gap-4 min-h-[400px]">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center">
                                    <span className="text-[10px] font-black text-white italic">S</span>
                                </div>
                                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Legal Signature Pad</h2>
                            </div>
                            <button 
                                onClick={handleClear} 
                                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors border-b border-transparent hover:border-indigo-600"
                            >
                                Reset Canvas
                            </button>
                        </div>
                        
                        <div className="flex-1 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden relative cursor-crosshair group">
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />
                            <div className="absolute bottom-12 left-8 right-8 h-px bg-slate-200 pointer-events-none" />
                            <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                                <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Sign on the line above</span>
                            </div>
                            <SignatureCanvas
                                ref={signatureRef}
                                canvasProps={{
                                    className: 'w-full h-full relative z-10',
                                    style: { width: '100%', height: '100%' }
                                }}
                                onEnd={() => handleSave(false)}
                                backgroundColor="rgba(0,0,0,0)"
                                penColor="#0f172a"
                            />
                        </div>
                    </div>
                </div>
            </main>

            <footer className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                    <Button 
                        onClick={() => handleSave(true)}
                        className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-black py-8 rounded-[1.5rem] text-lg shadow-2xl shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                        <span>Confirm & Submit Signature</span>
                        <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </Button>
                    <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed max-w-sm mx-auto">
                        I hereby certify that I am the individual named above and that the signature applied represents my legal acceptance of the membership terms.
                    </p>
                </div>
            </footer>
        </div>
    );
};
