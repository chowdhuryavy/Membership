
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog } from '../types';
import { format, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { History, Search, RefreshCcw, Shield, Clock, User, Info } from 'lucide-react';

const Logs = () => {
    const { user } = useAuth();
    const { currentOutlet, hasPermission } = useSettings();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, [currentOutlet]);

    const loadLogs = async () => {
        setLoading(true);
        const data = await db.getLogs(currentOutlet?.id);
        setLogs(data);
        setLoading(false);
    };

    if (!user || !hasPermission(user.role_id, 'view_logs')) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md text-center p-6">
                    <h3 className="text-lg font-bold text-red-600">Access Denied</h3>
                    <p className="text-slate-600 mt-2">You do not have permission to view system audit logs.</p>
                </Card>
            </div>
        );
    }

    const filteredLogs = logs.filter(log => 
        log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-700 border-green-200';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (action.includes('FAILURE')) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (action.includes('FREEZE')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <History className="w-6 h-6 text-indigo-600" />
                        Audit Logs
                    </h1>
                    <p className="text-sm text-slate-500">System activity trail for {currentOutlet?.name || 'all facilities'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadLogs} isLoading={loading}>
                    <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center pb-0 border-b-0">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search by user, action or details..." 
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-semibold"><div className="flex items-center gap-1"><Clock className="w-3 h-3"/> Time</div></th>
                                    <th className="px-6 py-4 font-semibold"><div className="flex items-center gap-1"><User className="w-3 h-3"/> User</div></th>
                                    <th className="px-6 py-4 font-semibold"><div className="flex items-center gap-1"><Shield className="w-3 h-3"/> Action</div></th>
                                    <th className="px-6 py-4 font-semibold"><div className="flex items-center gap-1"><Info className="w-3 h-3"/> Event Details</div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <RefreshCcw className="w-8 h-8 text-indigo-400 animate-spin" />
                                                <p className="text-slate-500">Retrieving audit history...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">
                                            No logs found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-slate-900 font-medium">
                                                    {format(parseISO(log.timestamp), 'PP')}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {format(parseISO(log.timestamp), 'p')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                                                        {log.user_name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-slate-700">{log.user_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-600 leading-relaxed max-w-xl">
                                                    {log.details}
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="text-xs text-blue-700 leading-relaxed">
                    <strong>Audit Integrity:</strong> These logs are generated automatically by the Nexus OS core engine and represent a verified history of all administrative actions. Logs are kept locally and are scoped to individual facilities where applicable.
                </div>
            </div>
        </div>
    );
};

export default Logs;
