import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { SystemLog } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  History, Search, RefreshCcw, Shield, Clock, Terminal, Filter, X, 
  Calendar, User, CreditCard, Package, Settings, Activity, FileText, 
  Key, AlertCircle, ChevronDown, CheckCircle, MousePointer, Layers, Eraser 
} from 'lucide-react';

const Logs = () => {
    const { user } = useAuth();
    const { currentOutlet, hasPermission, setPageLoading } = useSettings();

    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [nameMap, setNameMap] = useState<Record<string, string>>({});

    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [actionFilter, setActionFilter] = useState('ALL');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    const categoryOptions = [
        { value: 'ALL', label: 'All Actions', icon: Layers, color: 'text-slate-400' },
        { value: 'AUTH', label: 'Security & Auth', icon: Shield, color: 'text-indigo-500' },
        { value: 'MEMBER', label: 'Membership', icon: User, color: 'text-emerald-500' },
        { value: 'POS', label: 'Sales & POS', icon: CreditCard, color: 'text-blue-500' },
        { value: 'SECURITY', label: 'Access Control', icon: Key, color: 'text-amber-500' },
        { value: 'INTERACTION', label: 'Interactions', icon: Activity, color: 'text-slate-400' },
    ];

    const currentOption = categoryOptions.find(o => o.value === actionFilter) || categoryOptions[0];

    const isMounted = useRef(true);

    // Close filter dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ===============================
    // Load Metadata (Tiers, Outlets)
    // ===============================
    const loadMetadata = useCallback(async () => {
        try {
            const [categories, outlets] = await Promise.all([
                db.getCategories(),
                db.getOutlets()
            ]);
            
            const map: Record<string, string> = {};
            categories.forEach(c => { map[c.id] = c.name; });
            outlets.forEach(o => { map[o.id] = o.name; });
            
            // Add some common system names
            map['system'] = 'Intelligence Core';
            map['admin'] = 'Administrator';
            
            setNameMap(map);
        } catch (err) {
            console.error('Failed to load metadata for log resolution:', err);
        }
    }, []);

    // ===============================
    // Load Logs (Safe + Stable)
    // ===============================
    const loadLogs = useCallback(async () => {
        if (!currentOutlet?.id) return;

        setLoading(true);
        setPageLoading(true);
        try {
            await loadMetadata();
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
                const details = (log.details || '').toUpperCase();

                const categoryMap: Record<string, string[]> = {
                    AUTH: ['AUTH', 'LOGIN', 'LOGOUT', 'PASSWORD', 'USER', 'IDENTITY', 'SESSION', 'SIGN'],
                    MEMBER: ['MEMBER', 'ENROLL', 'FREEZE', 'SUSPEND', 'CATEGORY', 'TIER', 'GUEST'],
                    POS: ['POS', 'SALE', 'VOID', 'TRANSACTION', 'BOOKING', 'INVENTORY', 'TREATMENT', 'INCENTIVE', 'REVENUE', 'PRICE'],
                    SECURITY: ['SECURITY', 'ROLE', 'PERMISSION', 'STAFF', 'OUTLET', 'PROPERTY', 'CURRENCY', 'SETTINGS', 'USER', 'OVERRIDE', 'AUTH', 'LOGIN', 'LOGOUT', 'PASSWORD'],
                    INTERACTION: ['INTERACTION', 'CLICK', 'NAVIGATED', 'SELECTED', 'TRIGGERED', 'INTERACTED', 'ACTION'],
                };

                const allowedKeywords = categoryMap[actionFilter] || [];

                const matchesCategory = allowedKeywords.some((keyword) =>
                    action.includes(keyword) || details.includes(keyword)
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
    const getLogLevel = (action: string) => {
        const act = (action || '').toUpperCase();
        if (act.includes('DELETE') || act.includes('VOID') || act.includes('FAIL') || act.includes('PURGE')) return 'error';
        if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('FREEZE') || act.includes('SUSPEND') || act.includes('SECURITY_OVERRIDE')) return 'warning';
        if (act.includes('CREATE') || act.includes('SUCCESS') || act.includes('RESTORED') || act.includes('LOGIN')) return 'success';
        return 'info';
    };

    const getActionIcon = (action: string, details?: string) => {
        const act = (action || '').toUpperCase();
        const det = (details || '').toUpperCase();

        if (act === 'INTERACTION') {
            if (det.includes('NAVIGATED')) return <MousePointer className="w-3.5 h-3.5" />;
            if (det.includes('TRIGGERED')) return <Activity className="w-3.5 h-3.5" />;
            if (det.includes('SELECTED')) return <Calendar className="w-3.5 h-3.5" />;
            return <Activity className="w-3.5 h-3.5" />;
        }

        if (act.includes('AUTH') || act.includes('PASSWORD') || act.includes('SECURITY')) return <Shield className="w-3.5 h-3.5" />;
        if (act.includes('MEMBER') || act.includes('GUEST')) return <User className="w-3.5 h-3.5" />;
        if (act.includes('POS') || act.includes('SALE') || act.includes('BOOKING')) return <CreditCard className="w-3.5 h-3.5" />;
        if (act.includes('INVENTORY') || act.includes('TREATMENT') || act.includes('CATEGORY')) return <Package className="w-3.5 h-3.5" />;
        if (act.includes('SETTING') || act.includes('ROLE') || act.includes('OUTLET') || act.includes('CURRENCY') || act.includes('PROPERTY')) return <Settings className="w-3.5 h-3.5" />;
        
        return <FileText className="w-3.5 h-3.5" />;
    };

    const getActionStyles = (action: string) => {
        const level = getLogLevel(action);

        switch (level) {
            case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60 shadow-[0_0_10px_rgba(16,185,129,0.05)]';
            case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200/60 shadow-[0_0_10px_rgba(245,158,11,0.05)]';
            case 'error': return 'bg-rose-50 text-rose-700 border-rose-200/60 shadow-[0_0_10px_rgba(244,63,94,0.05)]';
            default: return 'bg-slate-50 text-slate-600 border-slate-200 shadow-sm';
        }
    };

    // ===============================
    // Details Formatting
    // ===============================
    const formatDetails = (details: string) => {
        if (!details) return null;
        
        // Resolve common ID patterns
        let processedDetails = details;
        
        // Look for UUID-like patterns that might be IDs we have in nameMap
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        const matches = details.match(uuidPattern);
        
        if (matches) {
            matches.forEach(id => {
                const resolvedName = nameMap[id];
                if (resolvedName) {
                    // Simple replacement for direct matches
                    processedDetails = processedDetails.replace(id, String(resolvedName));
                }
            });
        }

        // Special handling for Tier: cat_... or similar prefixed IDs if any
        Object.entries(nameMap).forEach(([id, name]) => {
            const resolvedName = String(name);
            // Case-insensitive replacement for the ID
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedId, 'gi');
            if (regex.test(processedDetails)) {
                processedDetails = processedDetails.replace(regex, resolvedName);
            }
        });

        // Split by brackets to highlight modified fields
        const parts = processedDetails.split(/(\[.*?\])/g);
        
        return parts.map((part, i) => {
            if (part.startsWith('[') && part.endsWith(']')) {
                return (
                    <span key={i} className="font-mono text-[10px] bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100/30 mx-1 font-bold">
                        {part.slice(1, -1)}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    // ===============================
    // Group Logs by Date
    // ===============================
    const groupedLogs = useMemo(() => {
        const groups: Record<string, SystemLog[]> = {};
        
        filteredLogs.forEach(log => {
            const dateStr = format(parseISO(log.timestamp), 'yyyy-MM-dd');
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(log);
        });
        
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [filteredLogs]);

    // ===============================
    // Permission Gate
    // ===============================
    if (!user || !hasPermission(user.role_id, 'logs:view')) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md text-center p-6 border-red-100 bg-red-50/30 rounded-[2rem]">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-red-600 uppercase tracking-tight">
                        Access Denied
                    </h3>
                    <p className="text-slate-600 mt-2 text-sm font-medium">
                        Permission insufficient to view system audit logs.
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
            
            {/* Header Console */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 relative z-40">
                {/* Abstract Background Detail */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
                                Audit<span className="text-indigo-600">.</span>Log
                            </h1>
                            <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[8px] font-black uppercase tracking-[0.2em] mb-1">
                                Enterprise Secure
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                    {currentOutlet?.name || 'Central Command'} • Real-time Monitoring Active
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto relative z-10">
                    {/* Date Console */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center h-14 bg-slate-50 rounded-2xl border border-slate-200 px-4 pl-12 relative group focus-within:border-indigo-500/50 focus-within:bg-white transition-all shadow-inner">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <div className="flex items-center gap-3">
                                <input 
                                    type="date" 
                                    className="bg-transparent border-none text-[10px] font-black text-slate-900 focus:ring-0 p-0 uppercase tracking-tight w-24"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                                <div className="w-px h-4 bg-slate-200"></div>
                                <input 
                                    type="date" 
                                    className="bg-transparent border-none text-[10px] font-black text-slate-900 focus:ring-0 p-0 uppercase tracking-tight w-24"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filter Console */}
                    <div className="relative min-w-[200px] z-50" ref={filterRef}>
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`h-14 w-full px-5 rounded-2xl border transition-all flex items-center justify-between group/btn ${isFilterOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'}`}
                        >
                            <div className="flex items-center gap-3">
                                <currentOption.icon className={`w-4 h-4 ${isFilterOpen ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">{currentOption.label}</span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isFilterOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                        </button>
                        
                        {isFilterOpen && (
                            <div className="absolute top-full mt-3 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
                                <div className="p-2 relative z-[101]">
                                    {categoryOptions.map((opt) => {
                                        const isSelected = actionFilter === opt.value;
                                        return (
                                            <button 
                                                key={opt.value}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setActionFilter(opt.value);
                                                    setIsFilterOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer relative z-[102] ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-600'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <opt.icon className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">{opt.label}</span>
                                                </div>
                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search Console */}
                    <div className="relative group flex-1 xl:min-w-[280px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                            placeholder="SEARCH_PROTOCOL..." 
                            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all text-[11px] font-black text-slate-900 placeholder:text-slate-400 uppercase tracking-widest" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>

                    <Button
                        variant="outline"
                        className="h-14 px-5 rounded-2xl bg-white border-slate-200 hover:border-indigo-600 hover:text-indigo-600 transition-all group shadow-sm shadow-slate-200/50"
                        onClick={loadLogs}
                        isLoading={loading}
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                    </Button>

                    { (searchTerm || actionFilter !== 'ALL' || dateFrom !== format(new Date(), 'yyyy-MM-dd') || dateTo !== format(new Date(), 'yyyy-MM-dd')) && (
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                setActionFilter('ALL');
                                setDateFrom(format(new Date(), 'yyyy-MM-dd'));
                                setDateTo(format(new Date(), 'yyyy-MM-dd'));
                            }}
                            className="h-14 px-5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center animate-in fade-in zoom-in duration-500"
                            title="Purge Filters"
                        >
                            <Eraser className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Invalid Date Warning */}
            {isInvalidDateRange && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest">
                    Invalid date range: "From" date must be before "To" date.
                </div>
            )}

            {/* Logs Console */}
            <div className="relative">
                {/* Continuous Timeline Track */}
                <div className="absolute left-10 md:left-14 top-0 bottom-0 w-px bg-slate-200/60 hidden sm:block"></div>

                {groupedLogs.length === 0 ? (
                    <Card className="rounded-[2.5rem] p-24 text-center bg-white/50 backdrop-blur-xl border-dashed border-2 border-slate-200 shadow-sm">
                        <Terminal className="w-16 h-16 text-slate-200 mx-auto mb-8 animate-pulse" />
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Protocol Offline</h3>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-3">No verified audit patterns detected in the current range.</p>
                    </Card>
                ) : (
                    <div className="space-y-12">
                        {groupedLogs.map(([date, dayLogs]) => {
                            const parsedDay = parseISO(date);
                            return (
                                <div key={date} className="relative">
                                    {/* Glass Date Header */}
                                    <div className="sticky top-6 z-20 mb-8 sm:-ml-2">
                                        <div className="inline-flex items-center gap-4 pl-2 pr-6 py-2.5 bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-xl shadow-slate-200/20 rounded-2xl">
                                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">
                                                    {format(parsedDay, 'EEEE')}
                                                </span>
                                                <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter">
                                                    {format(parsedDay, 'MMMM dd, yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Log Entries */}
                                    <div className="grid grid-cols-1 gap-px bg-slate-100 rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-2xl shadow-slate-200/30">
                                        {dayLogs.map((log) => {
                                            const time = format(parseISO(log.timestamp), 'HH:mm:ss');
                                            const subTime = format(parseISO(log.timestamp), 'SSS');
                                            const userName = log.user_name || 'System Engine';
                                            const isSystem = userName === 'System Engine';
                                            const actionStyles = getActionStyles(log.action);
                                            const isExpanded = expandedLogId === log.id;
                                            const level = getLogLevel(log.action);
                                            
                                            return (
                                                <div 
                                                    key={log.id} 
                                                    className={`relative bg-white group hover:bg-slate-50/80 transition-all duration-500 cursor-pointer ${isExpanded ? 'bg-slate-50/50' : ''}`}
                                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                >
                                                    {/* Status Accent Line */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-2 ${
                                                        level === 'error' ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' :
                                                        level === 'success' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                                                        level === 'warning' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' :
                                                        log.action.includes('AUTH') ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-slate-200'
                                                    }`}></div>

                                                    <div className="flex flex-col md:flex-row items-start gap-8 px-6 pr-8 sm:px-12 py-8">
                                                        {/* High-Precision Clock */}
                                                        <div className="flex items-start gap-5">
                                                            {/* Connection Node */}
                                                            <div className="hidden sm:flex mt-1.5 relative z-10 w-4 h-4 rounded-full bg-white border border-slate-200 items-center justify-center shadow-sm">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isSystem ? 'bg-slate-900 animate-pulse' : 'bg-indigo-600'}`}></div>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                                                                        {time}
                                                                    </span>
                                                                    <span className="text-[10px] font-black text-slate-400 font-mono">
                                                                        {subTime}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                                    <Clock className="w-2.5 h-2.5 text-slate-500" />
                                                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                                                        Local Sync
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Identity Block */}
                                                        <div className="md:w-56 flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-inner border transition-transform group-hover:scale-105 duration-500 ${
                                                                isSystem 
                                                                    ? 'bg-slate-900 text-white border-slate-800' 
                                                                    : 'bg-white text-indigo-600 border-indigo-100 shadow-sm'
                                                            }`}>
                                                                {userName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1.5">
                                                                    {userName}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-1 h-1 rounded-full ${isSystem ? 'bg-slate-400' : 'bg-indigo-500 animate-pulse'}`}></div>
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                                        {isSystem ? 'CORE_ENGINE' : 'VERIFIED_AGENT'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Payload */}
                                                        <div className="flex-1 flex flex-col gap-4">
                                                            <div className="flex flex-wrap items-center gap-4">
                                                                <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.22em] border transition-all hover:translate-x-1 duration-500 ${actionStyles}`}>
                                                                    {getActionIcon(log.action, log.details)}
                                                                    {formatActionName(log.action)}
                                                                </div>
                                                                
                                                                {/* Protocol Tags */}
                                                                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-all duration-500">
                                                                    {log.action.includes('MEMBER') && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/30 text-emerald-600 border border-emerald-100/30 rounded-lg">
                                                                            <User className="w-2.5 h-2.5" />
                                                                            <span className="text-[8px] font-black uppercase tracking-[0.1em]">ENTITY:MEMB</span>
                                                                        </div>
                                                                    )}
                                                                    {(log.action.includes('SECURITY') || log.action.includes('AUTH') || log.action.includes('PASSWORD')) && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/30 text-indigo-600 border border-indigo-100/30 rounded-lg">
                                                                            <Shield className="w-2.5 h-2.5" />
                                                                            <span className="text-[8px] font-black uppercase tracking-[0.1em]">PROT:SEC</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className={`text-[13px] bg-slate-50/30 group-hover:bg-white p-5 rounded-2xl border border-transparent group-hover:border-slate-200 transition-all text-slate-700 font-medium leading-relaxed max-w-5xl shadow-sm ${isExpanded ? 'bg-white border-slate-200' : ''}`}>
                                                                {formatDetails(log.details)}
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="animate-in slide-in-from-top-2 duration-300">
                                                                    <div className="bg-slate-900 rounded-2xl p-6 font-mono text-[10px] text-indigo-300 overflow-x-auto shadow-2xl">
                                                                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                                                                            <span className="text-white font-black uppercase tracking-widest">Full Trace Data</span>
                                                                            <span className="text-indigo-500/50">LOG_ID: {log.id}</span>
                                                                        </div>
                                                                        <pre className="text-indigo-200/80 leading-relaxed whitespace-pre-wrap">
                                                                            {JSON.stringify({
                                                                                id: log.id,
                                                                                action: log.action,
                                                                                user: log.user_name,
                                                                                details: log.details,
                                                                                timestamp: log.timestamp,
                                                                                outlet: log.outlet_id
                                                                            }, null, 4)}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Trace Column */}
                                                        <div className="hidden lg:flex flex-col items-end gap-4 md:w-20">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${isExpanded ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-300 border-slate-100'}`}>
                                                                <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                                View JSON
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Logs;