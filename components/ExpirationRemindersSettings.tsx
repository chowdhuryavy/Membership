import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Modal } from './ui';
import { db } from '../services/mockSupabase';
import { emailService } from '../services/emailService';
import { 
  Outlet, 
  Property, 
  CompanySettings, 
  ExpirationReminderConfig, 
  ExpirationReminderOutletConfig, 
  ExpirationReminderLog, 
  Member, 
  MemberStatus 
} from '../types';
import { 
  BellRing, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Play, 
  Send, 
  Building2, 
  Store, 
  Clock, 
  Calendar, 
  Settings2, 
  RefreshCw, 
  Mail, 
  Phone, 
  Sparkles, 
  ShieldCheck,
  Check,
  Zap,
  Info,
  History,
  Search,
  Filter
} from 'lucide-react';

interface ExpirationRemindersSettingsProps {
  outlets: Outlet[];
  properties: Property[];
  settings: CompanySettings | null;
  user: any;
  isSuperAdmin: boolean;
  showStatus: (text: string, type?: 'success' | 'error') => void;
}

export const ExpirationRemindersSettings: React.FC<ExpirationRemindersSettingsProps> = ({
  outlets,
  properties,
  settings,
  user,
  isSuperAdmin,
  showStatus
}) => {
  const [config, setConfig] = useState<ExpirationReminderConfig>({
    global_enabled: true,
    outlets: {}
  });
  const [logs, setLogs] = useState<ExpirationReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'history'>('matrix');

  // History Filter State
  const [selectedHistoryOutletId, setSelectedHistoryOutletId] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');

  // Outlet Config Modal state
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [outletForm, setOutletForm] = useState<ExpirationReminderOutletConfig>({
    enabled: true,
    days_before: [30, 14, 7, 1],
    custom_message: '',
    renewal_contact_phone: '',
    renewal_contact_email: ''
  });
  const [customDayInput, setCustomDayInput] = useState<string>('');

  // Test Modal & State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState<string>('');
  const [testOutletId, setTestOutletId] = useState<string>('');
  const [testDaysRemaining, setTestDaysRemaining] = useState<number>(7);
  const [testGuestName, setTestGuestName] = useState<string>('Alexander Wright');
  const [testMemberNumber, setTestMemberNumber] = useState<string>('MEM-88019');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<{
    scanned: number;
    eligible: number;
    sent: number;
    failed: number;
    skipped: number;
    details: string[];
    propertyName?: string;
  } | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // Load initial configuration and logs
  const loadConfigAndLogs = async () => {
    setLoading(true);
    try {
      const conf = await db.getExpirationReminderConfig();
      setConfig(conf);
      const reminderLogs = await db.getExpirationReminderLogs();
      setLogs(reminderLogs);
    } catch (e) {
      console.error('Error loading expiration reminder config:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigAndLogs();
  }, []);

  const filteredProperties = useMemo(() => {
    if (isSuperAdmin) return properties;
    return properties.filter(p => 
      outlets.some(o => o.property_id === p.id && user?.allowed_outlets?.includes(o.id))
    );
  }, [properties, outlets, user, isSuperAdmin]);

  useEffect(() => {
    if (filteredProperties.length > 0 && (!activePropertyId || !filteredProperties.some(p => p.id === activePropertyId))) {
      setActivePropertyId(filteredProperties[0].id);
    }
  }, [filteredProperties, activePropertyId]);

  const activeProperty = useMemo(() => {
    return properties.find(p => p.id === activePropertyId);
  }, [properties, activePropertyId]);

  const activePropertyOutlets = useMemo(() => {
    if (!activePropertyId) return [];
    const propOutlets = outlets.filter(o => o.property_id === activePropertyId);
    if (isSuperAdmin) return propOutlets;
    return propOutlets.filter(o => user?.allowed_outlets?.includes(o.id));
  }, [outlets, activePropertyId, user, isSuperAdmin]);

  // Scoped Logs for selected property
  const propertyLogs = useMemo(() => {
    if (!activePropertyId) return [];
    const propOutletIds = outlets.filter(o => o.property_id === activePropertyId).map(o => o.id);
    const propName = activeProperty?.name?.toLowerCase().trim() || '';

    return logs.filter(log => {
      const matchesOutletId = log.outlet_id && propOutletIds.includes(log.outlet_id);
      const matchesPropName = log.property_name && propName && log.property_name.toLowerCase().trim() === propName;
      return matchesOutletId || matchesPropName;
    });
  }, [logs, activePropertyId, outlets, activeProperty]);

  // Further filtered logs based on outlet filter, status filter, and search
  const displayedHistoryLogs = useMemo(() => {
    return propertyLogs.filter(log => {
      if (selectedHistoryOutletId !== 'all' && log.outlet_id !== selectedHistoryOutletId) {
        return false;
      }
      if (historyStatusFilter !== 'all' && log.status !== historyStatusFilter) {
        return false;
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const matchName = log.member_name?.toLowerCase().includes(q);
        const matchNum = log.member_number?.toLowerCase().includes(q);
        const matchEmail = log.recipient_email?.toLowerCase().includes(q);
        const matchOutlet = log.outlet_name?.toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchEmail && !matchOutlet) return false;
      }
      return true;
    });
  }, [propertyLogs, selectedHistoryOutletId, historyStatusFilter, historySearchQuery]);

  // Global Toggle
  const handleToggleGlobal = async () => {
    const updated: ExpirationReminderConfig = {
      ...config,
      global_enabled: !config.global_enabled
    };
    setConfig(updated);
    await db.updateExpirationReminderConfig(updated);
    showStatus(`Automated Expiration Reminders globally ${updated.global_enabled ? 'enabled' : 'disabled'}.`);
  };

  // Toggle single outlet
  const handleToggleOutlet = async (outletId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const existing = config.outlets?.[outletId] || {
      enabled: false,
      days_before: [30, 14, 7, 1]
    };
    const updatedOutlet: ExpirationReminderOutletConfig = {
      ...existing,
      enabled: !existing.enabled
    };
    const updatedConfig: ExpirationReminderConfig = {
      ...config,
      outlets: {
        ...(config.outlets || {}),
        [outletId]: updatedOutlet
      }
    };
    setConfig(updatedConfig);
    await db.updateExpirationReminderConfig(updatedConfig);
    const outlet = outlets.find(o => o.id === outletId);
    showStatus(`Reminders for "${outlet?.name || 'Outlet'}" ${updatedOutlet.enabled ? 'activated' : 'paused'}.`);
  };

  // Open Configure Modal
  const handleOpenConfigureOutlet = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    const existing = config.outlets?.[outlet.id] || {
      enabled: true,
      days_before: [30, 14, 7, 1],
      custom_message: '',
      renewal_contact_phone: outlet.phone || '',
      renewal_contact_email: ''
    };
    setOutletForm({
      enabled: existing.enabled ?? true,
      days_before: existing.days_before?.length ? [...existing.days_before] : [30, 14, 7, 1],
      custom_message: existing.custom_message || '',
      renewal_contact_phone: existing.renewal_contact_phone || outlet.phone || '',
      renewal_contact_email: existing.renewal_contact_email || ''
    });
  };

  // Save Configure Modal
  const handleSaveOutletForm = async () => {
    if (!editingOutlet) return;
    const updatedConfig: ExpirationReminderConfig = {
      ...config,
      outlets: {
        ...(config.outlets || {}),
        [editingOutlet.id]: { ...outletForm }
      }
    };
    setConfig(updatedConfig);
    await db.updateExpirationReminderConfig(updatedConfig);
    setEditingOutlet(null);
    showStatus(`Settings updated for ${editingOutlet.name}.`);
  };

  // Toggle Day in Form
  const toggleDayMilestone = (day: number) => {
    const current = outletForm.days_before || [];
    let updated: number[];
    if (current.includes(day)) {
      updated = current.filter(d => d !== day);
    } else {
      updated = [...current, day].sort((a, b) => b - a);
    }
    setOutletForm({ ...outletForm, days_before: updated });
  };

  const handleAddCustomDay = () => {
    const num = parseInt(customDayInput.trim(), 10);
    if (!isNaN(num) && num >= 0 && !outletForm.days_before?.includes(num)) {
      const updated = [...(outletForm.days_before || []), num].sort((a, b) => b - a);
      setOutletForm({ ...outletForm, days_before: updated });
      setCustomDayInput('');
    }
  };

  // Open Test Modal
  const handleOpenTestModal = (targetOutlet?: Outlet) => {
    const outletToUse = targetOutlet || activePropertyOutlets[0] || outlets[0];
    setTestOutletId(outletToUse?.id || '');
    setTestEmail(user?.email || '');
    setTestDaysRemaining(7);
    setTestResult(null);
    setShowTestModal(true);
  };

  // Execute Test Send
  const handleSendTest = async () => {
    const targetEmail = testEmail.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid recipient email address.' });
      return;
    }

    const selectedOutlet = outlets.find(o => o.id === testOutletId) || outlets[0];
    const selectedProp = properties.find(p => p.id === selectedOutlet?.property_id);

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const mockMember: Member = {
        id: 'test-guest-' + Date.now(),
        outlet_id: selectedOutlet?.id,
        property_id: selectedProp?.id,
        guest_name: testGuestName.trim() || 'Alexander Wright',
        membership_number: testMemberNumber.trim() || 'MEM-88019',
        email: targetEmail,
        status: MemberStatus.ACTIVE,
        category_id: 'cat-vip',
        actual_rate: 3500,
        discount: 0,
        net_amount: 3500,
        daily_rate: 9.58,
        membership_type: 'Renew',
        package_type: 'Single',
        access_type: 'Both',
        start_date: format(new Date(Date.now() - 335 * 86400000), 'yyyy-MM-dd'),
        current_end_date: format(new Date(Date.now() + testDaysRemaining * 86400000), 'yyyy-MM-dd'),
        original_end_date: format(new Date(Date.now() + testDaysRemaining * 86400000), 'yyyy-MM-dd'),
        created_at: new Date().toISOString()
      };

      const result = await emailService.sendMemberExpirationReminderEmail(
        mockMember,
        testDaysRemaining,
        {
          testRecipientEmail: targetEmail,
          isTest: true,
          overrideOutletConfig: config.outlets?.[selectedOutlet?.id || '']
        }
      );

      if (result.success) {
        setTestResult({
          success: true,
          message: `Branded test reminder successfully delivered to ${targetEmail} for ${selectedOutlet?.name || 'Selected Outlet'}. Please check your inbox!`
        });
        const updatedLogs = await db.getExpirationReminderLogs();
        setLogs(updatedLogs);
      } else {
        setTestResult({
          success: false,
          message: `Failed to dispatch email: ${result.error || 'Server error'}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Execution error: ${err?.message || String(err)}`
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Run Manual Expiration Scan - strictly scoped to active property
  const handleRunManualScan = async () => {
    setIsScanning(true);
    try {
      const summary = await emailService.processAutomatedExpirationReminders({ 
        isManualTrigger: true,
        forcePropertyId: activePropertyId 
      });
      setScanSummary({
        ...summary,
        propertyName: activeProperty?.name || 'Selected Property'
      });
      setShowScanModal(true);
      const updatedLogs = await db.getExpirationReminderLogs();
      setLogs(updatedLogs);
      showStatus(`Scan complete for ${activeProperty?.name || 'property'}: ${summary.sent} reminders dispatched.`);
    } catch (e: any) {
      showStatus(`Scan encountered an error: ${e?.message || String(e)}`, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. MASTER HEADER CARD */}
      <Card className="rounded-[3rem] border-slate-200/70 shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-indigo-600/30 border border-indigo-400/30 rounded-3xl flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <BellRing className="w-8 h-8 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  Automated Expiration Reminders
                </CardTitle>
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${config.global_enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                  {config.global_enabled ? 'System Active' : 'System Paused'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Automatically notify valued guests before their memberships expire. Configure reminder timelines, direct contact details, and custom renewal incentives per outlet.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
            {/* History Toggle Button */}
            <Button
              onClick={() => setActiveSubTab(activeSubTab === 'history' ? 'matrix' : 'history')}
              className={`h-12 px-5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border ${
                activeSubTab === 'history'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/20'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
            >
              <History className="w-4 h-4 text-amber-300" />
              <span>Audit History</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900/30 text-white">
                {propertyLogs.length}
              </span>
            </Button>

            <Button
              onClick={() => handleOpenTestModal()}
              className="h-12 px-5 rounded-2xl font-black text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4 text-indigo-300" /> Test Dispatcher
            </Button>
            <Button
              onClick={handleRunManualScan}
              isLoading={isScanning}
              title={`Run scan strictly for ${activeProperty?.name || 'selected property'}`}
              className="h-12 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Run Scan Now
            </Button>
            <button
              onClick={handleToggleGlobal}
              className={`h-12 px-5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all border flex items-center gap-2 ${
                config.global_enabled
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                  : 'bg-rose-600 text-white border-rose-500 hover:bg-rose-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              {config.global_enabled ? 'Master: ON' : 'Master: OFF'}
            </button>
          </div>
        </CardHeader>

        {/* PROPERTY FILTER TABS */}
        <CardContent className="p-0">
          {filteredProperties.length > 0 && (
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 px-6 pt-4 gap-2">
              {filteredProperties.map(prop => {
                const propOutlets = outlets.filter(o => o.property_id === prop.id);
                const enabledCount = propOutlets.filter(o => config.outlets?.[o.id]?.enabled ?? false).length;
                const isActive = activePropertyId === prop.id;
                const propLogCount = logs.filter(l => {
                  const oIds = propOutlets.map(o => o.id);
                  return (l.outlet_id && oIds.includes(l.outlet_id)) || (l.property_name && l.property_name.toLowerCase().trim() === prop.name.toLowerCase().trim());
                }).length;

                return (
                  <button
                    key={prop.id}
                    onClick={() => {
                      setActivePropertyId(prop.id);
                      setSelectedHistoryOutletId('all');
                    }}
                    className={`px-6 py-3.5 rounded-t-2xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-2.5 whitespace-nowrap border-t border-x ${
                      isActive
                        ? 'bg-white text-indigo-600 border-slate-200 border-b-transparent shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 border-transparent bg-transparent'
                    }`}
                  >
                    <Building2 className="w-4 h-4 opacity-70" />
                    {prop.name}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                      {enabledCount}/{propOutlets.length} Active
                    </span>
                    {propLogCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {propLogCount} Sent
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* SUB-VIEW NAVIGATION (MATRIX vs HISTORY) */}
          <div className="bg-slate-100/60 border-b border-slate-200 px-8 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-2xl">
              <button
                onClick={() => setActiveSubTab('matrix')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeSubTab === 'matrix'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" /> Facility Matrix & Config
              </button>
              <button
                onClick={() => setActiveSubTab('history')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeSubTab === 'history'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Dispatch Audit History
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeSubTab === 'history' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300 text-slate-700'
                }`}>
                  {propertyLogs.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Active Property Scope:
              </span>
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-black">
                {activeProperty?.name || 'Property'}
              </span>
              <Button
                variant="outline"
                onClick={loadConfigAndLogs}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 border-slate-200 flex items-center gap-1.5 ml-2"
              >
                <RefreshCw className="w-3 h-3" /> Sync
              </Button>
            </div>
          </div>

          {/* TAB 1: FACILITY NOTIFICATION MATRIX */}
          {activeSubTab === 'matrix' && (
            <div className="p-8 space-y-6 animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Facility Automated Notification Matrix
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Only members registered under active facilities with valid email addresses will receive automated expiration notices.
                  </p>
                </div>
              </div>

              {activePropertyOutlets.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Store className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">No Facilities Configured for this Property</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activePropertyOutlets.map(outlet => {
                    const outletConfig = config.outlets?.[outlet.id];
                    const isEnabled = outletConfig?.enabled ?? false;
                    const days = outletConfig?.days_before || [30, 14, 7, 1];
                    const prop = properties.find(p => p.id === outlet.property_id);
                    const outletLogCount = propertyLogs.filter(l => l.outlet_id === outlet.id).length;

                    return (
                      <div
                        key={outlet.id}
                        className={`relative rounded-3xl border p-6 transition-all duration-300 flex flex-col justify-between ${
                          isEnabled
                            ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-50/50 hover:border-indigo-300'
                            : 'bg-slate-50/70 border-slate-200 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div>
                          {/* Top Strip */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                isEnabled ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-200 text-slate-400'
                              }`}>
                                <Store className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                                  {outlet.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {prop?.name || 'Property'}
                                  </span>
                                  {outletLogCount > 0 && (
                                    <button 
                                      onClick={() => {
                                        setSelectedHistoryOutletId(outlet.id);
                                        setActiveSubTab('history');
                                      }}
                                      className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                      title="View dispatch history for this outlet"
                                    >
                                      {outletLogCount} logs
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleToggleOutlet(outlet.id, e)}
                              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                                isEnabled
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                              {isEnabled ? 'ENABLED' : 'PAUSED'}
                            </button>
                          </div>

                          {/* Milestones & Rules */}
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                Reminder Intervals (Days Prior):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {days.map(d => (
                                  <span
                                    key={d}
                                    className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold"
                                  >
                                    {d === 0 ? 'Expiry Day' : `${d}d prior`}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {outletConfig?.custom_message && (
                              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5 text-[10px] text-indigo-900 font-medium">
                                <span className="font-bold text-indigo-700 block uppercase text-[8px] tracking-widest">Custom Note Included:</span>
                                "{outletConfig.custom_message}"
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 space-y-1">
                              {(outletConfig?.renewal_contact_phone || outlet.phone) && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-slate-700">
                                    {outletConfig?.renewal_contact_phone || outlet.phone}
                                  </span>
                                </div>
                              )}
                              {outletConfig?.renewal_contact_email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-slate-700 truncate">
                                    {outletConfig.renewal_contact_email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
                          <Button
                            variant="outline"
                            onClick={() => handleOpenConfigureOutlet(outlet)}
                            className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-wider border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            <Settings2 className="w-3.5 h-3.5 mr-1 text-slate-500" /> Configure
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleOpenTestModal(outlet)}
                            title={`Send test reminder using ${outlet.name} template`}
                            className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DISPATCH AUDIT HISTORY (FILTERED BY PROPERTY & OUTLET) */}
          {activeSubTab === 'history' && (
            <div className="p-8 space-y-6 animate-in fade-in-50 duration-300">
              
              {/* Toolbar & Filter Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                        {activeProperty?.name || 'Property'} Dispatch Audit Log
                      </h4>
                      <p className="text-xs text-slate-500">
                        Historical record of all expiration notices sent to members of this property
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Outlet Filter Dropdown */}
                  <div className="relative min-w-[200px]">
                    <select
                      value={selectedHistoryOutletId}
                      onChange={e => setSelectedHistoryOutletId(e.target.value)}
                      className="w-full h-11 px-4 text-xs font-bold text-slate-800 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 appearance-none pr-8 cursor-pointer"
                    >
                      <option value="all">All Outlets in {activeProperty?.name || 'Property'}</option>
                      {activePropertyOutlets.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={historyStatusFilter}
                    onChange={e => setHistoryStatusFilter(e.target.value as any)}
                    className="h-11 px-4 text-xs font-bold text-slate-800 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="sent">Sent Only</option>
                    <option value="failed">Failed Only</option>
                  </select>

                  {/* Search Input */}
                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search member, email, #..."
                      value={historySearchQuery}
                      onChange={e => setHistorySearchQuery(e.target.value)}
                      className="w-full h-11 pl-9 pr-4 text-xs font-medium text-slate-800 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Clear / Reset Filters */}
                  {(selectedHistoryOutletId !== 'all' || historyStatusFilter !== 'all' || historySearchQuery) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedHistoryOutletId('all');
                        setHistoryStatusFilter('all');
                        setHistorySearchQuery('');
                      }}
                      className="h-11 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Outlet Quick Pills */}
              {activePropertyOutlets.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedHistoryOutletId('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                      selectedHistoryOutletId === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Facilities ({propertyLogs.length})
                  </button>
                  {activePropertyOutlets.map(outlet => {
                    const count = propertyLogs.filter(l => l.outlet_id === outlet.id).length;
                    const isSelected = selectedHistoryOutletId === outlet.id;
                    return (
                      <button
                        key={outlet.id}
                        onClick={() => setSelectedHistoryOutletId(outlet.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{outlet.name}</span>
                        <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* History Table */}
              <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                {displayedHistoryLogs.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      No matching expiration reminder records found
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {propertyLogs.length === 0 
                        ? `No reminder notices have been sent for ${activeProperty?.name || 'this property'} yet. Run an automated scan or trigger a test email.`
                        : 'Try adjusting your outlet, status, or search filters above to find records.'}
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <Button
                        onClick={() => handleOpenTestModal()}
                        className="h-10 px-5 rounded-xl text-xs font-black uppercase bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Send Test Email
                      </Button>
                      <Button
                        onClick={handleRunManualScan}
                        className="h-10 px-5 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Scan {activeProperty?.name || 'Property'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <th className="py-4 px-6">Timestamp</th>
                          <th className="py-4 px-6">Member Details</th>
                          <th className="py-4 px-6">Outlet & Facility</th>
                          <th className="py-4 px-6">Notice Stage</th>
                          <th className="py-4 px-6">Recipient Email</th>
                          <th className="py-4 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {displayedHistoryLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6 text-slate-500 font-medium whitespace-nowrap">
                              {format(new Date(log.sent_at), 'dd MMM yyyy, HH:mm')}
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-black text-slate-900">{log.member_name}</div>
                              <div className="text-[10px] font-bold text-indigo-600 uppercase font-mono">{log.member_number}</div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-800">{log.outlet_name}</div>
                              <div className="text-[10px] text-slate-400">{log.property_name || activeProperty?.name}</div>
                            </td>
                            <td className="py-4 px-6 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                log.days_remaining <= 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : log.days_remaining <= 7
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                                {log.days_remaining <= 0 ? 'Expired Today' : `${log.days_remaining} Days Remaining`}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-600 text-xs truncate max-w-[220px]">
                              {log.recipient_email}
                            </td>
                            <td className="py-4 px-6 text-right whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                log.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {log.status === 'sent' ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                )}
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Table Footer Summary */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing <strong className="text-slate-800 font-bold">{displayedHistoryLogs.length}</strong> of <strong className="text-slate-800 font-bold">{propertyLogs.length}</strong> records for {activeProperty?.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Synced with database
                  </span>
                </div>
              </div>

            </div>
          )}

        </CardContent>
      </Card>

      {/* 3. CONFIGURE OUTLET MODAL */}
      {editingOutlet && (
        <Modal isOpen={!!editingOutlet} onClose={() => setEditingOutlet(null)} title="Configure Expiration Reminders">
          <div className="p-8 space-y-6 max-w-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {editingOutlet.name}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Expiration Reminder Settings
                  </p>
                </div>
              </div>
            </div>

            {/* Enable switch */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Enable Reminders for this Outlet
                </label>
                <p className="text-[11px] text-slate-500">
                  Allow automated emails to be sent to guests registered at this facility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOutletForm({ ...outletForm, enabled: !outletForm.enabled })}
                className={`w-14 h-8 rounded-full transition-colors relative flex items-center p-1 ${
                  outletForm.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
                  outletForm.enabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Interval Milestones */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                Dispatch Milestones (Days Before Expiry)
              </label>
              <div className="flex flex-wrap gap-2">
                {[60, 30, 14, 7, 3, 1, 0].map(day => {
                  const isChecked = outletForm.days_before?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDayMilestone(day)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                      {day === 0 ? 'Day of Expiry (0d)' : `${day} Days Prior`}
                    </button>
                  );
                })}
              </div>

              {/* Custom day adder */}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Custom days..."
                  value={customDayInput}
                  onChange={e => setCustomDayInput(e.target.value)}
                  className="h-10 text-xs w-36"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddCustomDay}
                  className="h-10 text-xs px-3 font-bold"
                >
                  Add Interval
                </Button>
              </div>
            </div>

            {/* Custom Renewal Message */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                Exclusive Renewal Incentive or Custom Note (Optional)
              </label>
              <textarea
                value={outletForm.custom_message || ''}
                onChange={e => setOutletForm({ ...outletForm, custom_message: e.target.value })}
                placeholder="e.g. Renew this month to receive 1 complimentary personal training session and 15% discount on spa treatments!"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Direct Renewal Phone"
                value={outletForm.renewal_contact_phone || ''}
                onChange={e => setOutletForm({ ...outletForm, renewal_contact_phone: e.target.value })}
                placeholder="+974 4446 5600"
                className="h-11 text-xs"
              />
              <Input
                label="Direct Renewal Email"
                value={outletForm.renewal_contact_email || ''}
                onChange={e => setOutletForm({ ...outletForm, renewal_contact_email: e.target.value })}
                placeholder="membership@perfectionhealthclub.com"
                className="h-11 text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setEditingOutlet(null)}
                className="h-11 px-5 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveOutletForm}
                className="h-11 px-7 rounded-xl font-black text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. LIVE TEST EMAIL MODAL */}
      {showTestModal && (
        <Modal isOpen={showTestModal} onClose={() => setShowTestModal(false)} title="Send Test Expiration Reminder">
          <div className="p-8 space-y-6 max-w-xl">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Send Test Expiration Reminder
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Live verification of branded email template & delivery
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Target Test Email Address *"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="admin@property.com or your email"
                className="h-12 text-sm font-semibold"
              />

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Select Facility Branding *
                </label>
                <select
                  value={testOutletId}
                  onChange={e => setTestOutletId(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {outlets.map(o => {
                    const p = properties.find(prop => prop.id === o.property_id);
                    return (
                      <option key={o.id} value={o.id}>
                        {o.name} ({p?.name || 'Property'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notice Stage selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Test Expiration Notice Stage
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '30 Days', days: 30 },
                    { label: '14 Days', days: 14 },
                    { label: '7 Days', days: 7 },
                    { label: 'Expires Today', days: 0 }
                  ].map(stage => (
                    <button
                      key={stage.days}
                      type="button"
                      onClick={() => setTestDaysRemaining(stage.days)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        testDaysRemaining === stage.days
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Sample Guest Name"
                  value={testGuestName}
                  onChange={e => setTestGuestName(e.target.value)}
                  className="h-11 text-xs"
                />
                <Input
                  label="Sample Membership #"
                  value={testMemberNumber}
                  onChange={e => setTestMemberNumber(e.target.value)}
                  className="h-11 text-xs"
                />
              </div>

              {/* Feedback box */}
              {testResult && (
                <div className={`p-4 rounded-2xl text-xs font-bold border flex items-start gap-3 animate-in zoom-in-95 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{testResult.message}</div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setShowTestModal(false)}
                className="h-12 px-6 rounded-xl font-bold text-xs"
              >
                Close
              </Button>
              <Button
                onClick={handleSendTest}
                isLoading={isSendingTest}
                className="h-12 px-8 rounded-xl font-black text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Test Email
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. SCAN SUMMARY MODAL */}
      {showScanModal && scanSummary && (
        <Modal isOpen={showScanModal} onClose={() => setShowScanModal(false)} title="Expiration Scan Summary">
          <div className="p-8 space-y-6 max-w-xl">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Expiration Scan Summary
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Automated membership sweep for: <strong className="text-indigo-600">{scanSummary.propertyName}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-2xl font-black text-slate-800">{scanSummary.scanned}</div>
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1">Scanned</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <div className="text-2xl font-black text-indigo-600">{scanSummary.eligible}</div>
                <div className="text-[9px] font-black uppercase text-indigo-400 tracking-wider mt-1">Eligible</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="text-2xl font-black text-emerald-600">{scanSummary.sent}</div>
                <div className="text-[9px] font-black uppercase text-emerald-400 tracking-wider mt-1">Dispatched</div>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <div className="text-2xl font-black text-rose-600">{scanSummary.failed}</div>
                <div className="text-[9px] font-black uppercase text-rose-400 tracking-wider mt-1">Failed</div>
              </div>
            </div>

            {scanSummary.details.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Activity Details:
                </span>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs max-h-48 overflow-y-auto space-y-1">
                  {scanSummary.details.map((d, i) => (
                    <div key={i} className="text-[11px] leading-relaxed">
                      &bull; {d}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => setShowScanModal(false)}
                className="h-11 px-8 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-900 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

