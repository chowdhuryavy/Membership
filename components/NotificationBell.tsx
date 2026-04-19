import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Loader2, Info, AlertTriangle, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useNotificationContext } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ConfirmationModal } from './ui';

export const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { currentOutlet, outlets } = useSettings();
    const { user } = useAuth();
    const { notifications, isLoading, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationContext();
    const navigate = useNavigate();

    const hasMultipleOutlets = (user?.allowed_outlets?.length || 0) > 1;

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const handleClearAll = async () => {
        await clearAll();
        setShowConfirmClear(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-xl transition-all relative ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'fill-indigo-500/10' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <ConfirmationModal 
                isOpen={showConfirmClear}
                onClose={() => setShowConfirmClear(false)}
                onConfirm={handleClearAll}
                title="Dismiss All Notifications"
                description="Are you sure you want to dismiss all notifications? They will be hidden from your view but remain in the system for archival purposes."
                confirmText="Dismiss All"
                isDestructive={true}
            />

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-full right-0 mt-3 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                                <p className="text-[10px] text-slate-500 font-medium">You have {unreadCount} unread messages</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={markAllAsRead} 
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button 
                                        onClick={() => setShowConfirmClear(true)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Dismiss all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {isLoading && notifications.length === 0 ? (
                                <div className="p-12 flex flex-col justify-center items-center text-slate-400 gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                    <span className="text-xs font-medium">Loading notifications...</span>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                                        <Bell className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">All caught up!</p>
                                        <p className="text-xs text-slate-500">No new notifications at the moment.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {notifications.map(notification => (
                                        <div 
                                            key={notification.id} 
                                            className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all relative group ${!notification.read ? 'bg-indigo-50/20' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="mt-0.5 shrink-0">
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <h4 className={`text-xs font-bold truncate pr-4 ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                            {notification.title}
                                                        </h4>
                                                        {hasMultipleOutlets && notification.outlet_id && (
                                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                                                {outlets.find(o => o.id === notification.outlet_id)?.name || 'Unknown Outlet'}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="absolute top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                {!notification.read && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }} 
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors bg-white shadow-sm border border-slate-100" 
                                                        title="Mark as read"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeNotification(notification.id); }} 
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors bg-white shadow-sm border border-slate-100" 
                                                    title="Dismiss"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                            
                                            {!notification.read && (
                                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500"></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                <button 
                                    onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                                >
                                    View All Activity
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
