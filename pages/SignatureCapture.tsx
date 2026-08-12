import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui';
import { CheckCircle2, RotateCcw } from 'lucide-react';

export const SignatureCapturePage = () => {
    const { signatureId } = useParams<{ signatureId: string }>();
    const searchParams = new URLSearchParams(window.location.search);
    const guestName = searchParams.get('name') || 'Guest';
    const { currentOutlet, properties } = useSettings();
    const signatureRef = useRef<SignatureCanvas>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (signatureId) {
            localStorage.removeItem(`sig_${signatureId}`);
        }
    }, [signatureId]);

    const property = properties.find(p => p.id === currentOutlet?.property_id);

    const handleSave = () => {
        if (signatureRef.current && signatureId) {
            const dataUrl = signatureRef.current.toDataURL();
            localStorage.setItem(`sig_${signatureId}`, dataUrl);
            setSaved(true);
        }
    };

    const handleClear = () => {
        signatureRef.current?.clear();
    };

    if (saved) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Signature Captured</h1>
                <p className="text-slate-500 font-bold mb-8">Your signature has been saved successfully.</p>
                <Button onClick={() => window.close()} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl">
                    Close Tab
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    {property?.logo_url && <img src={property.logo_url} alt="Logo" className="w-12 h-12 object-contain" />}
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{property?.name}</h2>
                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentOutlet?.name}</p>
                    </div>
                </div>
                
                <h1 className="text-xl font-black text-slate-900 mb-2">Welcome, {guestName}!</h1>
                <p className="text-sm font-bold text-slate-500 mb-6">Please sign below to complete your enrollment.</p>

                <div className="border-2 border-slate-200 rounded-2xl mb-6 bg-slate-50">
                    <SignatureCanvas 
                        ref={signatureRef}
                        canvasProps={{ width: 450, height: 200, className: 'w-full h-48' }} 
                    />
                </div>

                <div className="flex gap-4">
                    <Button onClick={handleClear} variant="outline" className="flex-1 rounded-xl">
                        <RotateCcw className="w-4 h-4 mr-2" /> Clear
                    </Button>
                    <Button onClick={handleSave} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                        Confirm Signature
                    </Button>
                </div>
            </div>
        </div>
    );
};
