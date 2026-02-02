
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog } from '../types';
import { format, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { History, Search, RefreshCcw, Shield, Clock, User, Info, Terminal } from 'lucide-react';

const Logs = () => {
    const { user } = useAuth();
    const { currentOutlet, hasPermission } = useSettings();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 15000); // Polling faster for better live feel
        return () => clearInterval(interval);
    }, [currentOutlet]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await db.getLogs(currentOutlet?.id);
            setLogs(data || []);
        } catch (e) {
            console.error("Failed to load logs", e);
        } finally {
            setLoading(false);
        }
    };

    if (!user || !hasPermission(user.role_id, 'logs:view')) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md text-center p-6 border-red-100 bg-red-50/30">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-red-600">Access Protocol Rejected</h3>
                    <p className="text-slate-600 mt-2 text-sm">Security clearance insufficient to view system audit logs.</p>
                </Card>
            </div>
        );
    }

    const filteredLogs = logs.filter(log => {
        const query = searchTerm.toLowerCase();
        return (
            (log.user_name || '').toLowerCase().includes(query) ||
            (log.action || '').toLowerCase().includes(query) ||
            (log.details || '').toLowerCase().includes(query)
        );
    });

    const getActionStyles = (action: string) => {
        const act = (action || '').toUpperCase();
        if (act.includes('CREATE') || act.includes('ENROLL') || act.includes('ADD')) 
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (act.includes('DELETE') || act.includes('PURGE') || act.includes('FAILURE') || act.includes('TERMINATE')) 
            return 'bg-red-50 text-red-700 border-red-200';
        if (act.includes('UPDATE') || act.includes('SYNC') || act.includes('MODIFY')) 
            return 'bg-blue-50 text-blue-700 border-blue-200';
        if (act.includes('FREEZE') || act.includes('SUSPEND')) 
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        if (act.includes('AUTH')) 
            return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-slate-50 text-slate-700 border-slate-200';
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter">System Audit Trail</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                           Scope: {currentOutlet?.name || 'Global Events'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            placeholder="Universal Search..." 
                            className="h-11 pl-12 pr-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-xs font-bold w-full sm:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200" onClick={loadLogs} isLoading={loading}>
                        <RefreshCcw className="w-4 h-4 mr-2" /> Sync
                    </Button>
                </div>
            </div>

            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] bg-slate-50/50 border-b">
                            <tr>
                                <th className="px-8 py-5">Event Timestamp</th>
                                <th className="px-8 py-5">Accountable User</th>
                                <th className="px-8 py-5">System Action</th>
                                <th className="px-8 py-5">Activity Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acquiring Log Fragments...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="bg-slate-50 inline-flex p-4 rounded-full mb-4"><History className="w-8 h-8 text-slate-300" /></div>
                                        <p className="text-slate-400 font-bold italic">Zero event data matching search parameters.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-indigo-50/20 transition-all duration-300 group">
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                                <div>
                                                    <div className="text-slate-900 font-black tracking-tight text-xs">
                                                        {format(parseISO(log.timestamp), 'PP')}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {format(parseISO(log.timestamp), 'HH:mm:ss')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm group-hover:scale-110 transition-transform">
                                                    {(log.user_name || '?').charAt(0)}
                                                </div>
                                                <span className="font-black text-slate-700 tracking-tight text-xs">{log.user_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 whitespace-nowrap">
                                            <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${getActionStyles(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 bg-slate-200 rounded-full mt-1.5 shrink-0 group-hover:bg-indigo-400 transition-colors" />
                                                <p className="text-slate-600 font-medium text-xs leading-relaxed max-w-2xl">
                                                    {log.details}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="bg-indigo-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Shield className="w-32 h-32 text-white" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10">
                        <Shield className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="text-white font-black uppercase tracking-widest text-sm mb-1">Cryptographic Audit Integrity</h4>
                        <p className="text-indigo-200/60 text-xs font-medium max-w-2xl leading-relaxed">
                            This log documents every mutation in the system state. All session activities and identity shifts are tracked for compliance auditing. 
                            Global actions are recorded alongside facility operations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logs;
