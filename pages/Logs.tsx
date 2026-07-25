import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Button, Input } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog, LogModule, LogSeverity } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, formatDistanceToNow } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  History, Search, RefreshCcw, Shield, Clock, Terminal, Filter, X, 
  Calendar, User, CreditCard, Package, Settings, Activity, FileText, 
  Key, AlertCircle, ChevronDown, CheckCircle, MousePointer, Layers, Eraser,
  Download, FileJson, Info, AlertTriangle, Check, ExternalLink, ArrowUpDown,
  MoreVertical, Copy, Share2, Eye, Printer, FilterX, Building, LayoutDashboard,
  CheckSquare, LogOut, LogIn, Receipt, Thermometer, UserCheck, UserMinus,
  Mail, MessageSquare, Upload, Lock, ShieldCheck, Database, Zap, Cpu,
  Monitor, Smartphone, Laptop, Globe, InfoIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ===============================
// Sub-components
// ===============================

const SeverityBadge = ({ severity, status }: { severity: LogSeverity, status: string }) => {
  const config = {
    success: { icon: Check, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    error: { icon: X, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    info: { icon: Info, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
  };

  const current = config[severity] || config.info;
  const Icon = current.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${current.bg} ${current.text} ${current.border} shadow-sm`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{status || severity}</span>
    </div>
  );
};

const ModuleIcon = ({ module }: { module: LogModule }) => {
  const icons: Record<string, any> = {
    'Authentication': Shield,
    'Dashboard': LayoutDashboard,
    'Members': User,
    'Memberships': CreditCard,
    'Check-In / Check-Out': CheckSquare,
    'POS': Receipt,
    'Massage & Spa': Thermometer,
    'Facility Booking': Calendar,
    'Staff Management': UsersIcon,
    'Inventory': Package,
    'Reports': FileText,
    'Settings': Settings,
    'User Management': UserCheck,
    'Roles & Permissions': ShieldCheck,
    'System': Cpu,
    'Actions': Zap
  };

  const Icon = icons[module] || Activity;
  return <Icon className="w-4 h-4" />;
};

const UsersIcon = ({ className }: { className?: string }) => <User className={className} />;

const JsonViewer = ({ data, title }: { data: any, title?: string }) => {
  if (!data) return null;
  return (
    <div className="space-y-2">
      {title && <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>}
      <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-indigo-200 overflow-x-auto shadow-inner border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
        <pre className="whitespace-pre-wrap leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const Logs = () => {
    const { user } = useAuth();
    const { outlets, properties, roles, currentOutlet, hasPermission, setPageLoading, formatMoney } = useSettings();

    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState(format(addDays(new Date(), -7), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [moduleFilter, setModuleFilter] = useState<string>('all');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [propertyFilter, setPropertyFilter] = useState<string>('all');

    // UI State
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof SystemLog, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 20;

    const isMounted = useRef(true);

    const modules: LogModule[] = [
        'Authentication', 'Dashboard', 'Members', 'Memberships', 
        'Check-In / Check-Out', 'POS', 'Massage & Spa', 
        'Facility Booking', 'Staff Management', 'Inventory', 
        'Reports', 'Settings', 'User Management', 'Roles & Permissions', 
        'System', 'Actions'
    ];

    const actions = [
        'Login', 'Logout', 'Create', 'Update', 'Delete', 'View', 'Approve', 'Reject', 
        'Renew Membership', 'Freeze Membership', 'Unfreeze Membership', 'Cancel Membership',
        'Check-In', 'Check-Out', 'Payment Received', 'Refund', 'Print', 'Export',
        'Email Sent', 'SMS Sent', 'Upload', 'Download', 'Password Changed',
        'Profile Updated', 'Permission Changed', 'Settings Updated', 'Backup Created',
        'Restore Completed', 'API Request', 'System Event'
    ];

    // ===============================
    // Load Logs
    // ===============================
    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await db.getLogs();
            if (isMounted.current) {
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to load audit logs:', err);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        isMounted.current = true;
        loadLogs();
        
        let interval: any;
        if (isAutoRefresh) {
            interval = setInterval(loadLogs, 30000);
        }
        
        return () => {
            isMounted.current = false;
            if (interval) clearInterval(interval);
        };
    }, [loadLogs, isAutoRefresh]);

    // ===============================
    // Filtering Logic
    // ===============================
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Date Range
            const logDate = parseISO(log.timestamp);
            const inRange = isWithinInterval(logDate, {
                start: startOfDay(new Date(dateFrom)),
                end: endOfDay(new Date(dateTo))
            });
            if (!inRange) return false;

            // Simple Dropdown Filters
            if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
            if (statusFilter !== 'all' && log.status !== statusFilter) return false;
            if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
            if (userFilter !== 'all' && log.user_id !== userFilter) return false;
            if (roleFilter !== 'all' && log.role_name !== roleFilter) return false;
            if (propertyFilter !== 'all' && log.property_id !== propertyFilter) return false;
            
            // Action Filter (Partial Match)
            if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;

            // Global Search
            const query = searchTerm.toLowerCase().trim();
            if (query) {
                const searchFields = [
                    log.user_name,
                    log.action,
                    log.description,
                    log.details,
                    log.record_id,
                    log.affected_entity,
                    log.id
                ].filter(Boolean).map(f => f!.toLowerCase());
                
                if (!searchFields.some(f => f.includes(query))) return false;
            }

            return true;
        }).sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (!valA || !valB) return 0;
            
            if (sortConfig.direction === 'asc') {
                return String(valA).localeCompare(String(valB));
            } else {
                return String(valB).localeCompare(String(valA));
            }
        });
    }, [logs, dateFrom, dateTo, moduleFilter, actionFilter, statusFilter, severityFilter, userFilter, roleFilter, propertyFilter, searchTerm, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

    const handleSort = (key: keyof SystemLog) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleExport = (type: 'csv' | 'pdf' | 'json') => {
        const dataToExport = filteredLogs.map(l => ({
            ID: l.id,
            Timestamp: l.timestamp,
            User: l.user_name,
            Role: l.role_name,
            Module: l.module,
            Action: l.action,
            Description: l.description,
            Status: l.status,
            Severity: l.severity
        }));

        if (type === 'csv') {
            const headers = Object.keys(dataToExport[0]).join(',');
            const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
            const csv = [headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
        } else {
            alert(`Exporting to ${type.toUpperCase()}... (Mock implementation)`);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Toast logic could go here
    };

    // ===============================
    // Permission Gate
    // ===============================
    if (!user || !hasPermission(user.role_id, 'logs:view')) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md text-center p-12 border-red-100 bg-white rounded-[3rem] shadow-2xl shadow-red-100/20">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Access Restricted</h3>
                    <p className="text-slate-500 text-sm font-medium mb-8">You do not have the verified credentials required to access the system audit trails.</p>
                    <Button variant="outline" className="rounded-2xl" onClick={() => window.history.back()}>Go Back</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            
            {/* Header & Main Actions */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-slate-300 transform -rotate-3">
                        <History className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-slate-900">
                                Audit<span className="text-indigo-600">.</span>Center
                            </h1>
                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-1">
                                Secure Protocol
                            </div>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                            <Activity className="w-3 h-3 text-emerald-500" />
                            Live monitoring active across {properties.length} properties
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 sm:flex-none sm:min-w-[320px] group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <Input 
                            placeholder="SEARCH_LOGS (User, Member, ID...)" 
                            className="h-14 pl-12 rounded-2xl bg-slate-50 border-slate-200 focus:bg-white transition-all text-xs font-bold uppercase tracking-wider"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <Button
                        variant={isFilterExpanded ? 'default' : 'outline'}
                        className={`h-14 px-6 rounded-2xl gap-3 transition-all ${isFilterExpanded ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white border-slate-200 text-slate-600'}`}
                        onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    >
                        <Filter className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
                        {(moduleFilter !== 'all' || actionFilter !== 'all' || statusFilter !== 'all' || severityFilter !== 'all') && (
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        )}
                    </Button>

                    <div className="flex items-center bg-slate-50 border border-slate-200 p-1.5 rounded-2xl h-14">
                        <button 
                            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                            className={`flex items-center gap-2 px-4 h-full rounded-xl transition-all ${isAutoRefresh ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <RefreshCcw className={`w-3.5 h-3.5 ${isAutoRefresh && loading ? 'animate-spin' : ''}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{isAutoRefresh ? 'Live' : 'Paused'}</span>
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-full w-10 text-slate-400 hover:text-indigo-600 transition-all"
                            onClick={loadLogs}
                            isLoading={loading}
                        >
                            <RefreshCcw className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="h-14 px-4 rounded-2xl bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600" onClick={() => handleExport('csv')}>
                            <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" className="h-14 px-4 rounded-2xl bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600" onClick={() => handleExport('pdf')}>
                            <Printer className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
                {isFilterExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="bg-white border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Row 1 */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Time Range</label>
                                    <div className="flex items-center gap-2 h-12 bg-slate-50 border border-slate-200 rounded-xl px-3 group focus-within:border-indigo-500 focus-within:bg-white transition-all">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-900 focus:ring-0 p-0 w-full" />
                                        <div className="w-px h-4 bg-slate-200"></div>
                                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-900 focus:ring-0 p-0 w-full" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Module</label>
                                    <select 
                                        value={moduleFilter} 
                                        onChange={e => setModuleFilter(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase tracking-wider"
                                    >
                                        <option value="all">ALL MODULES</option>
                                        {modules.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Action Type</label>
                                    <select 
                                        value={actionFilter} 
                                        onChange={e => setActionFilter(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase tracking-wider"
                                    >
                                        <option value="all">ALL ACTIONS</option>
                                        {actions.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Severity</label>
                                    <div className="flex gap-2">
                                        {['all', 'info', 'success', 'warning', 'error'].map(sev => (
                                            <button 
                                                key={sev}
                                                onClick={() => setSeverityFilter(sev)}
                                                className={`flex-1 h-12 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${severityFilter === sev ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-white hover:border-slate-300'}`}
                                            >
                                                {sev}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Property</label>
                                    <select 
                                        value={propertyFilter} 
                                        onChange={e => setPropertyFilter(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase tracking-wider"
                                    >
                                        <option value="all">ALL PROPERTIES</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Role</label>
                                    <select 
                                        value={roleFilter} 
                                        onChange={e => setRoleFilter(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase tracking-wider"
                                    >
                                        <option value="all">ALL ROLES</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-end pb-1 lg:col-span-2">
                                    <Button 
                                        variant="outline" 
                                        className="h-12 w-full rounded-xl border-dashed border-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all gap-2"
                                        onClick={() => {
                                            setModuleFilter('all');
                                            setActionFilter('all');
                                            setStatusFilter('all');
                                            setSeverityFilter('all');
                                            setUserFilter('all');
                                            setRoleFilter('all');
                                            setPropertyFilter('all');
                                            setSearchTerm('');
                                            setDateFrom(format(addDays(new Date(), -7), 'yyyy-MM-dd'));
                                        }}
                                    >
                                        <FilterX className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Clear All Filters</span>
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Logs Table Area */}
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <button onClick={() => handleSort('timestamp')} className="flex items-center gap-2 hover:text-indigo-600 transition-colors uppercase">
                                        Timestamp <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User / Identity</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Module</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action Protocol</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Summary Description</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="p-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedLogs.map((log) => (
                                <tr 
                                    key={log.id} 
                                    className="group hover:bg-slate-50/80 transition-all duration-300 cursor-pointer"
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <td className="p-6 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-900 tracking-tighter">
                                                {format(parseISO(log.timestamp), 'HH:mm:ss')}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {format(parseISO(log.timestamp), 'MMM dd, yyyy')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-black text-slate-600 border border-slate-200/50 shadow-sm group-hover:bg-white transition-colors">
                                                {(log.user_name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900 tracking-tight">{log.user_name || 'System'}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{log.role_name || 'VERIFIED_AGENT'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg group-hover:bg-white transition-all">
                                            <ModuleIcon module={log.module} />
                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{log.module}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{log.action}</span>
                                            {log.affected_entity && (
                                                <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Affected: {log.affected_entity}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-xs font-medium text-slate-600 line-clamp-1 max-w-xs">{log.description || log.details || log.action}</p>
                                    </td>
                                    <td className="p-6">
                                        <SeverityBadge severity={log.severity} status={log.status} />
                                    </td>
                                    <td className="p-6 text-right">
                                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100 opacity-0 group-hover:opacity-100">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Console */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Showing {Math.min(filteredLogs.length, logsPerPage)} of {filteredLogs.length} audit patterns identified
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                const page = i + 1;
                                return (
                                    <button 
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === page ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-600 hover:text-indigo-600'}`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            {totalPages > 5 && <span className="mx-2 text-slate-300 font-black">...</span>}
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            {/* Log Detail Drawer */}
            <AnimatePresence>
                {selectedLog && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
                            onClick={() => setSelectedLog(null)}
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white z-[101] shadow-[-20px_0_60px_rgba(0,0,0,0.1)] flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl ${
                                        selectedLog.severity === 'error' ? 'bg-rose-500 shadow-rose-200' :
                                        selectedLog.severity === 'success' ? 'bg-emerald-500 shadow-emerald-200' :
                                        selectedLog.severity === 'warning' ? 'bg-amber-500 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'
                                    }`}>
                                        <ModuleIcon module={selectedLog.module} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedLog.action}</h2>
                                            <SeverityBadge severity={selectedLog.severity} status={selectedLog.status} />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                            <Database className="w-3 h-3" />
                                            PROTOCOL_ID: {selectedLog.id}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedLog(null)}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                                {/* Basic Info Grid */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporal Signature</span>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-sm font-black text-slate-900">{format(parseISO(selectedLog.timestamp), 'MMMM dd, yyyy • HH:mm:ss')}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 ml-5">({formatDistanceToNow(parseISO(selectedLog.timestamp), { addSuffix: true })})</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initiator</span>
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-sm font-black text-slate-900">{selectedLog.user_name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 ml-5">{selectedLog.role_name}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Module / Scope</span>
                                            <div className="flex items-center gap-2">
                                                <Building className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-sm font-black text-slate-900">{selectedLog.module}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 ml-5">{selectedLog.outlet_name || 'GLOBAL_COMMAND'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity Linkage</span>
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-sm font-black text-slate-900">{selectedLog.affected_entity || 'N/A'}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 ml-5">ID: {selectedLog.record_id || 'UNKNOWN'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Description */}
                                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Activity Intelligence</span>
                                    <p className="text-base font-medium text-slate-700 leading-relaxed italic border-l-4 border-indigo-500 pl-6">
                                        "{selectedLog.description || selectedLog.details || selectedLog.action || 'System Interaction Protocol Activated'}"
                                    </p>
                                </div>

                                {/* Data Changes */}
                                {(selectedLog.old_values || selectedLog.new_values) && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">State Mutations</h3>
                                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Diff View</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <JsonViewer title="Previous State" data={selectedLog.old_values} />
                                            <JsonViewer title="New State" data={selectedLog.new_values} />
                                        </div>
                                    </div>
                                )}

                                {/* System Environment */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">System Environment</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-200 transition-all">
                                            <Monitor className="w-5 h-5 text-slate-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                                            <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Platform</span>
                                            <span className="text-[10px] font-bold text-slate-900">{(selectedLog.os || 'Unknown OS')} / {(selectedLog.device_type || 'Unknown Device')}</span>
                                        </div>
                                        <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-200 transition-all">
                                            <Globe className="w-5 h-5 text-slate-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                                            <span className="text-[8px] font-black text-slate-400 uppercase mb-1">IP Address</span>
                                            <span className="text-[10px] font-bold text-slate-900 font-mono">{selectedLog.ip_address || '0.0.0.0'}</span>
                                        </div>
                                        <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-200 transition-all">
                                            <Zap className="w-5 h-5 text-slate-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                                            <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Performance</span>
                                            <span className="text-[10px] font-bold text-slate-900">{selectedLog.execution_time_ms || 0}ms Exec</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">HTTP Method</span>
                                            <span className="text-[10px] font-bold text-slate-900 font-mono">{selectedLog.http_method || 'RPC'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Status Code</span>
                                            <span className="text-[10px] font-bold text-emerald-600 font-mono">{selectedLog.response_status || 200} OK</span>
                                        </div>
                                        <div className="flex justify-between items-center col-span-1 md:col-span-2">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Request URL</span>
                                            <span className="text-[10px] font-bold text-slate-900 font-mono truncate max-w-xs">{selectedLog.request_url || '/'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stack Trace / Error Details */}
                                {selectedLog.error_message && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-rose-600">
                                            <AlertCircle className="w-4 h-4" />
                                            <h3 className="text-sm font-black uppercase tracking-tighter">Terminal Error Trace</h3>
                                        </div>
                                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                                            <p className="text-xs font-bold text-rose-700 mb-4">{selectedLog.error_message}</p>
                                            {selectedLog.stack_trace && (
                                                <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-rose-300 overflow-x-auto shadow-inner border border-rose-900/20 max-h-40 overflow-y-auto">
                                                    <pre>{selectedLog.stack_trace}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-14 rounded-2xl border-slate-200 gap-3"
                                    onClick={() => copyToClipboard(selectedLog.id)}
                                >
                                    <Copy className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Copy Log ID</span>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-14 rounded-2xl border-slate-200 gap-3"
                                    onClick={() => handleExport('json')}
                                >
                                    <FileJson className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Export JSON</span>
                                </Button>
                                <Button 
                                    variant="default" 
                                    className="flex-1 h-14 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 gap-3"
                                    onClick={() => setSelectedLog(null)}
                                >
                                    <X className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Close Trace</span>
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Logs;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

