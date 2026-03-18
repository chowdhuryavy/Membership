import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { History, Search, RefreshCcw, Shield, Clock, Terminal, Filter, X, Calendar, User, CreditCard, Package, Settings, Activity, FileText, Key, AlertCircle } from 'lucide-react';

const Logs = () => {
    const { user } = useAuth();
    const { currentOutlet, hasPermission, setPageLoading } = useSettings();

    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [actionFilter, setActionFilter] = useState('ALL');

    const isMounted = useRef(true);

    // ===============================
    // Load Logs (Safe + Stable)
    // ===============================
    const loadLogs = useCallback(async () => {
        if (!currentOutlet?.id) return;

        setLoading(true);
        setPageLoading(true);
        try {
            const data = await db.getLogs(currentOutlet.id);

            if (!isMounted.current) return;

            // Always sort newest first
            const sorted = (data || []).sort(
                (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime()
            );

            setLogs(sorted);
        } catch (err) {
            console.error('Failed to load logs:', err);
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setPageLoading(false);
            }
        }
    }, [currentOutlet?.id]);

    // ===============================
    // Lifecycle
    // ===============================
    useEffect(() => {
        isMounted.current = true;

        if (!currentOutlet?.id) return;

        loadLogs();

        const interval = setInterval(loadLogs, 30000);
        return () => {
            isMounted.current = false;
            clearInterval(interval);
        };
    }, [loadLogs, currentOutlet?.id]);

    // ===============================
    // Date Validation
    // ===============================
    const isInvalidDateRange =
        new Date(dateFrom) > new Date(dateTo);

    // ===============================
    // Professional Filtering Logic
    // ===============================
    const filteredLogs = useMemo(() => {
        if (isInvalidDateRange) return [];

        return logs.filter((log) => {
            const parsedDate = parseISO(log.timestamp);

            const inRange = isWithinInterval(parsedDate, {
                start: startOfDay(new Date(dateFrom)),
                end: endOfDay(new Date(dateTo)),
            });

            if (!inRange) return false;

            // Structured action category filtering
            if (actionFilter !== 'ALL') {
                const action = (log.action || '').toUpperCase();

                const categoryMap: Record<string, string[]> = {
                    AUTH: ['AUTH', 'LOGIN', 'LOGOUT', 'PASSWORD'],
                    MEMBER: ['MEMBER', 'ENROLL', 'FREEZE', 'SUSPEND'],
                    POS: ['POS', 'SALE', 'VOID', 'TRANSACTION'],
                    SECURITY: ['SECURITY', 'ROLE', 'PERMISSION'],
                    INTERACTION: ['INTERACTION', 'CLICK'],
                };

                const allowedKeywords = categoryMap[actionFilter] || [];

                const matchesCategory = allowedKeywords.some((keyword) =>
                    action.includes(keyword)
                );

                if (!matchesCategory) return false;
            }

            const query = searchTerm.trim().toLowerCase();
            if (!query) return true;

            return (
                (log.user_name || '').toLowerCase().includes(query) ||
                (log.action || '').toLowerCase().includes(query) ||
                (log.details || '').toLowerCase().includes(query)
            );
        });
    }, [logs, searchTerm, dateFrom, dateTo, actionFilter, isInvalidDateRange]);

    // ===============================
    // Action Formatting
    // ===============================
    const formatActionName = (action: string) => {
        const map: Record<string, string> = {
            'AUTH_LOGIN': 'User Logged In',
            'AUTH_LOGOUT': 'User Logged Out',
            'AUTH_SUCCESS': 'Auth Success',
            'AUTH_SIGNUP': 'User Registered',
            'CREATE_MEMBER': 'Member Added',
            'UPDATE_MEMBER': 'Member Updated',
            'DELETE_MEMBER': 'Member Deleted',
            'FREEZE_MEMBER': 'Member Frozen',
            'CREATE_FREEZE': 'Member Frozen',
            'UPDATE_FREEZE': 'Freeze Updated',
            'DELETE_FREEZE': 'Freeze Revoked',
            'CREATE_STAFF': 'Staff Added',
            'UPDATE_STAFF': 'Staff Updated',
            'DELETE_STAFF': 'Staff Deleted',
            'CREATE_CATEGORY': 'Tier Added',
            'UPDATE_CATEGORY': 'Tier Updated',
            'DELETE_CATEGORY': 'Tier Deleted',
            'CREATE_INVENTORY': 'Inventory Added',
            'UPDATE_INVENTORY': 'Inventory Updated',
            'DELETE_INVENTORY': 'Inventory Deleted',
            'POS_SALE': 'Sale Processed',
            'POS_SALE_UPDATE': 'Sale Updated',
            'POS_VOID': 'Sale Voided',
            'CREATE_BOOKING': 'Booking Created',
            'UPDATE_BOOKING': 'Booking Updated',
            'DELETE_BOOKING': 'Booking Deleted',
            'INTERACTION': 'User Interaction',
            'UPDATE_SETTINGS': 'Settings Updated',
            'CREATE_USER': 'User Added',
            'UPDATE_USER': 'User Updated',
            'DELETE_USER': 'User Deleted',
            'CHANGE_PASSWORD': 'Password Changed',
            'CREATE_ROLE': 'Role Added',
            'UPDATE_ROLE': 'Role Updated',
            'DELETE_ROLE': 'Role Deleted',
            'CREATE_OUTLET': 'Outlet Added',
            'UPDATE_OUTLET': 'Outlet Updated',
            'DELETE_OUTLET': 'Outlet Deleted',
            'CREATE_PROPERTY': 'Property Added',
            'UPDATE_PROPERTY': 'Property Updated',
            'DELETE_PROPERTY': 'Property Deleted',
            'CREATE_CURRENCY': 'Currency Added',
            'UPDATE_CURRENCY': 'Currency Updated',
            'DELETE_CURRENCY': 'Currency Deleted',
            'CREATE_THERAPIST': 'Therapist Added',
            'UPDATE_THERAPIST': 'Therapist Updated',
            'DELETE_THERAPIST': 'Therapist Deleted',
            'CREATE_TREATMENT': 'Treatment Added',
            'UPDATE_TREATMENT': 'Treatment Updated',
            'DELETE_TREATMENT': 'Treatment Deleted',
            'CREATE_INCENTIVE': 'Incentive Added',
            'UPDATE_INCENTIVE': 'Incentive Updated',
            'DELETE_INCENTIVE': 'Incentive Deleted',
            'DELETE_GUEST': 'Guest Deleted',
            'BOOKING_RESTORED': 'Booking Restored',
            'BOOKING_UNSERVED': 'Booking Unserved',
            'SECURITY_OVERRIDE': 'Security Override',
            'SECURITY_OVERRIDE_PURGE': 'Override Purged'
        };
        
        if (map[action]) return map[action];
        
        return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };

    // ===============================
    // Action Styling & Icons
    // ===============================
    const getActionIcon = (action: string) => {
        const act = (action || '').toUpperCase();
        if (act.includes('AUTH') || act.includes('PASSWORD') || act.includes('SECURITY')) return <Shield className="w-3.5 h-3.5" />;
        if (act.includes('MEMBER') || act.includes('GUEST')) return <User className="w-3.5 h-3.5" />;
        if (act.includes('POS') || act.includes('SALE') || act.includes('BOOKING')) return <CreditCard className="w-3.5 h-3.5" />;
        if (act.includes('INVENTORY') || act.includes('TREATMENT')) return <Package className="w-3.5 h-3.5" />;
        if (act.includes('SETTING') || act.includes('ROLE') || act.includes('OUTLET') || act.includes('CURRENCY') || act.includes('PROPERTY')) return <Settings className="w-3.5 h-3.5" />;
        if (act.includes('INTERACTION')) return <Activity className="w-3.5 h-3.5" />;
        return <FileText className="w-3.5 h-3.5" />;
    };

    const getActionStyles = (action: string) => {
        const act = (action || '').toUpperCase();

        if (act.includes('CREATE') || act.includes('ENROLL') || act.includes('SUCCESS') || act.includes('RESTORED'))
            return 'bg-emerald-50/50 text-emerald-700 border-emerald-200/50';

        if (act.includes('DELETE') || act.includes('VOID') || act.includes('FAIL') || act.includes('PURGE'))
            return 'bg-red-50/50 text-red-700 border-red-200/50';

        if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('EDIT'))
            return 'bg-blue-50/50 text-blue-700 border-blue-200/50';

        if (act.includes('FREEZE') || act.includes('SUSPEND'))
            return 'bg-amber-50/50 text-amber-700 border-amber-200/50';
            
        if (act.includes('AUTH') || act.includes('LOGIN') || act.includes('LOGOUT'))
            return 'bg-indigo-50/50 text-indigo-700 border-indigo-200/50';

        if (act.includes('INTERACTION'))
            return 'bg-slate-50 text-slate-500 border-slate-200/50';

        return 'bg-slate-50 text-slate-700 border-slate-200';
    };

    // ===============================
    // Details Formatting
    // ===============================
    const formatDetails = (details: string) => {
        if (!details) return null;
        
        // Split by brackets to highlight modified fields
        const parts = details.split(/(\[.*?\])/g);
        
        return parts.map((part, i) => {
            if (part.startsWith('[') && part.endsWith(']')) {
                return (
                    <span key={i} className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 mx-1">
                        {part.slice(1, -1)}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    // ===============================
    // Permission Gate
    // ===============================
    if (!user || !hasPermission(user.role_id, 'logs:view')) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md text-center p-6 border-red-100 bg-red-50/30 rounded-[2rem]">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-red-600 uppercase tracking-tight">
                        Access Protocol Rejected
                    </h3>
                    <p className="text-slate-600 mt-2 text-sm font-medium">
                        Security clearance insufficient to view system audit logs.
                    </p>
                </Card>
            </div>
        );
    }

    // ===============================
    // Render
    // ===============================
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                            System Audit Trail
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                            Scope: {currentOutlet?.name || 'Global'} • {filteredLogs.length} Records
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <div className="relative group flex-1 sm:flex-none">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            placeholder="Search logs..." 
                            className="w-full sm:w-48 h-11 pl-11 pr-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-xs font-bold" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 h-11 px-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 w-24 p-0 uppercase tracking-widest"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="text-slate-300">→</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 w-24 p-0 uppercase tracking-widest"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative">
                        <select 
                            className="h-11 pl-4 pr-8 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 text-[10px] font-black uppercase tracking-widest text-slate-600 cursor-pointer appearance-none outline-none min-w-[140px]"
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                        >
                            <option value="ALL">All Actions</option>
                            <option value="AUTH">Authentication</option>
                            <option value="MEMBER">Members</option>
                            <option value="POS">Sales & POS</option>
                            <option value="SECURITY">Security</option>
                            <option value="INTERACTION">Interactions</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Clear Filters */}
                    {(searchTerm || actionFilter !== 'ALL' || dateFrom !== format(new Date(), 'yyyy-MM-dd') || dateTo !== format(new Date(), 'yyyy-MM-dd')) && (
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                setSearchTerm('');
                                setActionFilter('ALL');
                                setDateFrom(format(new Date(), 'yyyy-MM-dd'));
                                setDateTo(format(new Date(), 'yyyy-MM-dd'));
                            }}
                            className="h-11 w-11 p-0 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Clear Filters"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        className="h-11 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all"
                        onClick={loadLogs}
                        isLoading={loading}
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Invalid Date Warning */}
            {isInvalidDateRange && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest">
                    Invalid date range: "From" date must be before "To" date.
                </div>
            )}

            {/* Logs Table */}
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50/50 border-b">
                            <tr>
                                <th className="px-6 py-4 w-48">Timestamp</th>
                                <th className="px-6 py-4 w-48">Operator</th>
                                <th className="px-6 py-4 w-56">Event Type</th>
                                <th className="px-6 py-4">Audit Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <History className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-black uppercase tracking-widest text-[11px]">
                                            No logs found for selected filters.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    const parsedDate = parseISO(log.timestamp);
                                    const userName = log.user_name || 'System Engine';
                                    const initial = userName.charAt(0).toUpperCase();

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-900">{format(parsedDate, 'MMM dd, yyyy')}</span>
                                                    <span className="text-[10px] font-mono text-slate-500">{format(parsedDate, 'HH:mm:ss.SSS')}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 border border-slate-200 shadow-sm">
                                                        {initial}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {userName}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getActionStyles(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                    {formatActionName(log.action)}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <p className="text-xs text-slate-600 leading-relaxed">
                                                    {formatDetails(log.details)}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Logs;