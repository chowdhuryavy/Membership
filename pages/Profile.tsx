
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { Lock, User, CheckCircle, AlertCircle, Mail, UserCircle2 } from 'lucide-react';

const Profile = () => {
    const { user, changePassword, updateProfile } = useAuth();
    const [profileData, setProfileData] = useState({ name: '', email: '' });
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({ name: user.name, email: user.email });
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);
        try {
            await updateProfile(profileData);
            setMessage({ type: 'success', text: "Profile identity synchronized successfully." });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Failed to sync profile." });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (passwords.new !== passwords.confirm) {
            setMessage({ type: 'error', text: "New passwords do not match." });
            return;
        }
        if (passwords.new.length < 6) {
             setMessage({ type: 'error', text: "Security key must be at least 6 characters." });
             return;
        }
        
        setLoading(true);
        try {
            await changePassword(passwords.current, passwords.new);
            setMessage({ type: 'success', text: "Security key updated successfully." });
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (err: any) {
             setMessage({ type: 'error', text: err.message || "Credential update failed." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4">
                <UserCircle2 className="w-10 h-10 text-indigo-600" />
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Profile Management</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                        <div className="h-24 bg-indigo-600 w-full"></div>
                        <CardContent className="px-8 pb-8 -mt-12 text-center">
                            <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                                <div className="w-24 h-24 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                                    {user?.name.charAt(0)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{user?.name}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.email}</p>
                            <div className="mt-6 inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100">
                                {user?.role_id} Clearance
                            </div>
                        </CardContent>
                    </Card>

                    {message && (
                        <div className={`p-5 rounded-3xl text-xs font-black uppercase tracking-widest flex items-center gap-3 border animate-in zoom-in-95 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {message.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                            {message.text}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                        <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <User className="w-5 h-5 text-indigo-600" /> Identity Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Name</label>
                                    <Input 
                                        value={profileData.name} 
                                        onChange={e => setProfileData({...profileData, name: e.target.value})}
                                        className="h-12 rounded-xl"
                                        placeholder="Display Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                                    <Input 
                                        type="email"
                                        value={profileData.email} 
                                        onChange={e => setProfileData({...profileData, email: e.target.value})}
                                        className="h-12 rounded-xl"
                                        placeholder="Email Address"
                                    />
                                </div>
                                <Button type="submit" disabled={loading} className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-indigo-100 mt-2">
                                    Save Profile Changes
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                        <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <Lock className="w-5 h-5 text-indigo-600" /> Security Protocol
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <form onSubmit={handlePasswordSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Security Key</label>
                                    <Input 
                                        type="password" 
                                        value={passwords.current} 
                                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                                        className="h-12 rounded-xl"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Security Key</label>
                                        <Input 
                                            type="password" 
                                            value={passwords.new} 
                                            onChange={e => setPasswords({...passwords, new: e.target.value})}
                                            className="h-12 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Key</label>
                                        <Input 
                                            type="password" 
                                            value={passwords.confirm} 
                                            onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                            className="h-12 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <Button type="submit" variant="secondary" disabled={loading} className="h-14 px-10 rounded-2xl font-black bg-slate-100 hover:bg-slate-200 mt-2">
                                    Deploy New Security Key
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Profile;
