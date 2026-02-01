
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { Lock, User, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
    const { user, changePassword } = useAuth();
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (passwords.new !== passwords.confirm) {
            setMessage({ type: 'error', text: "New passwords do not match." });
            return;
        }
        if (passwords.new.length < 6) {
             setMessage({ type: 'error', text: "Password must be at least 6 characters." });
             return;
        }
        
        setLoading(true);
        try {
            await changePassword(passwords.current, passwords.new);
            setMessage({ type: 'success', text: "Password updated successfully." });
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (err: any) {
             setMessage({ type: 'error', text: err.message || "Failed to update password." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Account Profile</h1>
            <Card>
                <CardHeader><CardTitle>My Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                         <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-2xl font-bold">
                             {user?.name.charAt(0)}
                         </div>
                         <div>
                             <h3 className="font-bold text-lg">{user?.name}</h3>
                             <p className="text-slate-500">{user?.email}</p>
                             <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 mt-1 inline-block">
                                 {user?.role_id}
                             </span>
                         </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            type="password" 
                            label="Current Password" 
                            value={passwords.current} 
                            onChange={e => setPasswords({...passwords, current: e.target.value})}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                type="password" 
                                label="New Password" 
                                value={passwords.new} 
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                            />
                            <Input 
                                type="password" 
                                label="Confirm New Password" 
                                value={passwords.confirm} 
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                            />
                        </div>
                        
                        {message && (
                            <div className={`p-3 rounded text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {message.type === 'success' ? <CheckCircle className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                                {message.text}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} isLoading={loading}>Update Password</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Profile;
