import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { History, Search, RefreshCcw, Shield, Clock, Terminal, Filter } from 'lucide-react';

const Logs = () => {
    const { user } = useAuth();
    const { currentOutlet, hasPermission } = useSettings();

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
            if (isMounted.current) setLoading(false);
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
    // Action Styling
    // ===============================
    const getActionStyles = (action: string) => {
        const act = (action || '').toUpperCase();

        if (act.includes('CREATE') || act.includes('ENROLL') || act.includes('SUCCESS'))
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';

        if (act.includes('DELETE') || act.includes('VOID') || act.includes('FAIL'))
            return 'bg-red-50 text-red-700 border-red-200';

        if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('EDIT'))
            return 'bg-blue-50 text-blue-700 border-blue-200';

        if (act.includes('FREEZE') || act.includes('SUSPEND'))
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';

        return 'bg-slate-50 text-slate-700 border-slate-200';
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
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

                <Button
                    variant="outline"
                    className="h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200"
                    onClick={loadLogs}
                    isLoading={loading}
                >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
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
                                <th className="px-8 py-5">Event Timestamp</th>
                                <th className="px-8 py-5">User</th>
                                <th className="px-8 py-5">Action</th>
                                <th className="px-8 py-5">Details</th>
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

                                    return (
                                        <tr key={log.id} className="hover:bg-indigo-50/20 transition-all duration-300">
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="text-xs font-black">
                                                    {format(parsedDate, 'PP')}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold">
                                                    {format(parsedDate, 'HH:mm:ss')}
                                                </div>
                                            </td>

                                            <td className="px-8 py-6 text-xs font-black text-slate-700">
                                                {log.user_name || 'System'}
                                            </td>

                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getActionStyles(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>

                                            <td className="px-8 py-6 text-xs text-slate-600 font-medium max-w-2xl">
                                                {log.details}
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