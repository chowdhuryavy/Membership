
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Shield, Smartphone } from 'lucide-react';
import { PushNotificationService } from '../services/pushNotificationService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface PushNotificationManagerProps {
    variant?: 'card' | 'modal';
}

const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ variant = 'card' }) => {
    const { user: authUser } = useAuth();
    
    // Fallback for staff portal users who authenticate via staff_session, not Firebase auth
    let user = authUser;
    if (!user) {
        try {
            const staffSessionStr = localStorage.getItem('staff_session');
            if (staffSessionStr) {
                user = JSON.parse(staffSessionStr);
            }
        } catch (e) {
            console.error('Error parsing staff session:', e);
        }
    }

    const [permission, setPermission] = useState<NotificationPermission | 'not-supported'>('default');
    const [isSubscribing, setIsSubscribing] = useState(false);

    useEffect(() => {
        const checkPermission = async () => {
            const p = await PushNotificationService.getPermission();
            setPermission(p as any);

            // Auto-subscribe/sync if permission is already granted
            // This ensures PWA/APK users don't have to manually click "Enable" every time they login
            if (p === 'granted' && user) {
                try {
                    await PushNotificationService.subscribeUser(user.id);
                } catch (error) {
                    console.error("Auto-sync failed:", error);
                }
            }
        };
        checkPermission();
    }, [user?.id]);

    const handleEnableNotifications = async () => {
        console.log('handleEnableNotifications clicked, user:', user);
        if (!user) {
            console.error('No user found');
            return;
        }
        setIsSubscribing(true);
        try {
            console.log('Requesting permission...');
            const granted = await PushNotificationService.requestPermission();
            if (granted) {
                const subscription = await PushNotificationService.subscribeUser(user.id);
                if (subscription) {
                    console.log('Subscribe successful. Setting permission to granted.');
                    setPermission('granted');
                    toast.success('Push notifications enabled successfully!');
                    console.log('Permission state updated and toast shown.');
                } else {
                    console.log('Subscribe failed.');
                    setPermission('denied');
                    toast.error('Failed to subscribe. Are you in a new tab? (Iframes block push)');
                }
            } else {
                console.log('Request permission returned false.');
                setPermission('denied');
                toast.error('Notification permission denied or blocked by browser.');
            }
        } catch (error: any) {
            console.error('Push error in handleEnableNotifications:', error);
            const errMsg = error?.message || String(error);
            toast.error('Error enabling: ' + errMsg.substring(0, 50));
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleDisableNotifications = async () => {
        if (!user) return;
        setIsSubscribing(true);
        try {
            const success = await PushNotificationService.unsubscribeUser(user.id);
            if (success) {
                setPermission('default'); // Reset so they can re-enable if they want (though browser might still say granted)
                toast.success('Push notifications disabled.');
            }
        } catch (error) {
            console.error('Push error:', error);
            toast.error('Failed to disable notifications.');
        } finally {
            setIsSubscribing(false);
        }
    };

    if (variant === 'modal') {
        // If not supported, or already granted/denied, don't show the modal
        if (permission !== 'default') return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 border border-indigo-100">
                    <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                            <Bell className="w-8 h-8 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Setup Required</h3>
                        <p className="text-sm font-medium text-slate-500">To use the Staff Portal, you must enable push notifications to receive real-time booking updates.</p>
                        
                        <div className="w-full mt-6 space-y-3">
                            <button
                                onClick={handleEnableNotifications}
                                disabled={isSubscribing}
                                className="w-full py-4 bg-slate-900 text-white font-black tracking-widest text-xs uppercase rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl flex justify-center items-center gap-2"
                            >
                                {isSubscribing ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Enabling...</>
                                ) : 'Enable Notifications'}
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 text-indigo-50 opacity-50 rotate-12 pointer-events-none">
                        <Bell className="w-48 h-48" />
                    </div>
                </div>
            </div>
        );
    }

    if (permission === 'not-supported') return null;

    return (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 mb-8 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                <Smartphone className="w-32 h-32 text-indigo-600" />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        permission === 'granted' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                        {permission === 'granted' ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Real-time Push Alerts
                            {permission === 'granted' && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Active</span>
                            )}
                        </h2>
                        <p className="text-sm text-slate-500 font-medium max-w-md mt-1">
                            {permission === 'granted' 
                                ? 'You are receiving real-time alerts on this device even when the browser is closed.' 
                                : 'Enable push notifications to receive critical system alerts and booking updates instantly.'
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {permission === 'granted' ? (
                        <>
                            <button
                                onClick={async () => {
                                    if (user) {
                                        toast.promise(
                                            PushNotificationService.subscribeUser(user.id).then(async () => {
                                                const m = await import('../services/mockSupabase');
                                                const testId = crypto.randomUUID();
                                                console.log('Push Test: Triggering for user', user.id, 'with tag', testId);
                                                return m.db.triggerPushNotification(
                                                    user!.id, 
                                                    'Cloud Server Test', 
                                                    'Notification from Supabase Edge Function: ' + new Date().toLocaleTimeString(),
                                                    '/notifications?test=' + testId
                                                );
                                            }),
                                            {
                                                loading: 'Triggering Cloud Push...',
                                                success: 'Signal sent to Supabase!',
                                                error: 'Server push failed. Check console.'
                                            }
                                        );
                                    }
                                }}
                                className="px-6 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-2"
                            >
                                <Smartphone className="w-4 h-4" />
                                Cloud Test
                            </button>
                            <button
                                onClick={() => {
                                    if ('serviceWorker' in navigator) {
                                        navigator.serviceWorker.ready.then(registration => {
                                            registration.showNotification('Test Notification', {
                                                body: 'This is a test push notification from Health Club.',
                                                icon: '/icon.png',
                                                badge: '/favicon-16x16.png',
                                                vibrate: [200, 100, 200]
                                            } as any);
                                        });
                                    }
                                }}
                                className="px-6 py-2.5 bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-200 transition-all shadow-sm flex items-center gap-2"
                            >
                                <Bell className="w-4 h-4" />
                                Test Alert
                            </button>
                            <button
                                onClick={handleDisableNotifications}
                                disabled={isSubscribing}
                                className="px-6 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                <BellOff className="w-4 h-4" />
                                Disable Push
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleEnableNotifications}
                            disabled={isSubscribing || permission === 'denied'}
                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 ${
                                permission === 'denied' 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300' 
                                : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                            {isSubscribing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Syncing...
                                </>
                            ) : permission === 'denied' ? (
                                <>
                                    <Shield className="w-4 h-4" />
                                    Access Blocked
                                </>
                            ) : (
                                <>
                                    <Bell className="w-4 h-4" />
                                    Enable Push
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            
            {permission === 'denied' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-[10px] font-bold text-red-600 animate-pulse">
                    <Smartphone className="w-4 h-4" />
                    <span>Permission was blocked by your browser. Please reset notifications in site settings to enable push alerts.</span>
                </div>
            )}
        </div>
    );
};

export default PushNotificationManager;
