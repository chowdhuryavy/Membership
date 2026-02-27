import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from './ui';
import { db } from '../services/mockSupabase';
import { Outlet } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { Calendar, Clock, Save, AlertCircle, CheckCircle2, Terminal, RefreshCcw } from 'lucide-react';

export const BookingSettings = () => {
    const { currentProperty, refreshSettings } = useSettings();
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isTableMissing, setIsTableMissing] = useState(false);

    useEffect(() => {
        if (currentProperty) {
            loadOutlets();
        }
    }, [currentProperty]);

    const loadOutlets = async () => {
        setLoading(true);
        try {
            const allOutlets = await db.getOutlets();
            setOutlets(allOutlets.filter(o => o.property_id === currentProperty?.id));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOutletChange = (id: string, field: keyof Outlet, value: any) => {
        setOutlets(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            for (const outlet of outlets) {
                await db.updateOutlet(outlet.id, {
                    booking_enabled: outlet.booking_enabled,
                    booking_start_time: outlet.booking_start_time,
                    booking_end_time: outlet.booking_end_time
                });
            }
            await refreshSettings();
            setMessage({ type: 'success', text: 'Booking configuration saved successfully.' });
            setTimeout(() => setMessage(null), 3000);
            setIsTableMissing(false);
        } catch (error: any) {
            if (error.message?.includes('schema cache') || error.code === '42P01' || error.code === '42703' || error.message?.toLowerCase().includes('column')) {
                setIsTableMissing(true);
            } else {
                setMessage({ type: 'error', text: error.message || 'Failed to save configuration.' });
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Configuration...</div>;
    }

    if (isTableMissing) {
        return (
            <Card className="rounded-[2.5rem] border-amber-200/60 shadow-2xl overflow-hidden bg-amber-50/30 animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="p-8 border-b border-amber-100 bg-amber-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                            <Terminal className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Safe Repair Protocol</h3>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">Please execute this script in your <span className="font-bold text-indigo-600">Supabase SQL Editor</span> to add the missing columns to the outlets table.</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="relative group">
                        <pre className="bg-slate-950 text-indigo-300 p-8 rounded-3xl overflow-x-auto text-[11px] font-mono leading-relaxed shadow-inner border border-white/10">
{`ALTER TABLE IF EXISTS public.outlets
ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS booking_start_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS booking_end_time TEXT DEFAULT '22:00';`}
                        </pre>
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700">
                            <RefreshCcw className="w-4 h-4 mr-2" /> Verify Schema Sync
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Booking Engine Configuration</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manage schedule parameters per outlet</p>
                </div>
                <Button onClick={handleSave} isLoading={saving} className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6 shadow-lg shadow-indigo-100">
                    <Save className="w-4 h-4 mr-2" /> Commit Changes
                </Button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {outlets.map(outlet => (
                    <Card key={outlet.id} className="rounded-[2rem] border-slate-200/60 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-tight">{outlet.name}</CardTitle>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Outlet Configuration</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enable Booking</span>
                                <button 
                                    onClick={() => handleOutletChange(outlet.id, 'booking_enabled', !(outlet.booking_enabled ?? true))}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${outlet.booking_enabled !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${outlet.booking_enabled !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </CardHeader>
                        
                        <div className={`transition-all duration-300 ${outlet.booking_enabled !== false ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Operational Start
                                        </label>
                                        <input 
                                            type="time" 
                                            value={outlet.booking_start_time || '08:00'} 
                                            onChange={e => handleOutletChange(outlet.id, 'booking_start_time', e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-200 text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Operational End
                                        </label>
                                        <input 
                                            type="time" 
                                            value={outlet.booking_end_time || '22:00'} 
                                            onChange={e => handleOutletChange(outlet.id, 'booking_end_time', e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-200 text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
