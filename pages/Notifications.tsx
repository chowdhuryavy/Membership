import React, { useState } from 'react';
import { Bell, Check, X, Trash2, Filter, Search, Calendar, Info, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotificationContext } from '../contexts/NotificationContext';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const NotificationsPage = () => {
    const { notifications, isLoading, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationContext();
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredNotifications = notifications.filter(n => {
        const matchesFilter = filter === 'all' || (filter === 'unread' ? !n.read : n.read);
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             n.message.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Center</h1>
                    <p className="text-slate-500 font-medium">Manage your system alerts and activity logs</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Check className="w-4 h-4" />
                        Mark All Read
                    </button>
                    <button 
                        onClick={clearAll}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition-all shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear All
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-xl w-fit">
                        {(['all', 'unread', 'read'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    filter === f 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64 transition-all"
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                        {filteredNotifications.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-20 text-center"
                            >
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Bell className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">No notifications found</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                                    {searchQuery ? "Try adjusting your search or filters." : "You're all caught up! Check back later for updates."}
                                </p>
                            </motion.div>
                        ) : (
                            filteredNotifications.map((n) => (
                                <motion.div 
                                    key={n.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className={`p-6 flex gap-4 hover:bg-slate-50/50 transition-colors group relative ${!n.read ? 'bg-indigo-50/10' : ''}`}
                                >
                                    <div className="mt-1 shrink-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            n.type === 'success' ? 'bg-emerald-50' : 
                                            n.type === 'warning' ? 'bg-amber-50' : 
                                            n.type === 'error' ? 'bg-red-50' : 'bg-blue-50'
                                        }`}>
                                            {getIcon(n.type)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-2">
                                            <h3 className={`text-sm font-bold ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {n.title}
                                                {!n.read && <span className="ml-2 inline-block w-2 h-2 bg-indigo-500 rounded-full"></span>}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(n.created_at), 'MMM d, yyyy • h:mm a')}
                                                <span className="text-slate-300">({formatDistanceToNow(new Date(n.created_at), { addSuffix: true })})</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
                                            {n.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!n.read && (
                                            <button 
                                                onClick={() => markAsRead(n.id)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                title="Mark as read"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => removeNotification(n.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {!n.read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;
