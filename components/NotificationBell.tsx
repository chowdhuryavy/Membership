import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';

export const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { currentOutlet } = useSettings();
    const { notifications, isLoading, markAsRead, markAllAsRead, removeNotification } = useNotifications(currentOutlet?.id);

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

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl transition-all relative ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse text-indigo-500' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {isLoading && notifications.length === 0 ? (
                            <div className="p-8 flex justify-center items-center text-slate-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-medium">
                                No notifications
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {notifications.map(notification => (
                                    <div 
                                        key={notification.id} 
                                        className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors relative group ${!notification.read ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className={`text-xs font-bold ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {notification.title}
                                            </h4>
                                            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed pr-6">
                                            {notification.message}
                                        </p>
                                        <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                            {!notification.read && (
                                                <button onClick={() => markAsRead(notification.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="Mark as read">
                                                    <Check className="w-3 h-3" />
                                                </button>
                                            )}
                                            <button onClick={() => removeNotification(notification.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Remove">
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
                </div>
            )}
        </div>
    );
};
