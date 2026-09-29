import React, { useState, useEffect } from 'react';
import { guestAuth, DEFAULT_GUEST_PORTAL_SETTINGS } from '../../services/guestAuthService';
import { GuestAccount, GuestPortalSettings } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Dumbbell,
  Sparkles,
  Ticket,
  Receipt,
  FileText,
  User,
  Mail,
  KeyRound,
  RefreshCw,
  Search,
  ExternalLink,
  Power,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Send,
  Lock,
  Trash2,
  UserPlus
} from 'lucide-react';
import { Button, Input, Card } from '../ui';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const GuestPortalSettingsTab: React.FC = () => {
  const { currentOutlet, currentProperty, settings, refreshSettings, outlets, properties } = useSettings();
  const { isSuperAdmin } = useAuth();

  const activeScopeId = currentOutlet?.id || currentProperty?.id;
  const activeScopeName = currentOutlet?.name || currentProperty?.name || settings?.name || 'All Facilities';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalSettings, setPortalSettings] = useState<GuestPortalSettings>(DEFAULT_GUEST_PORTAL_SETTINGS);
  const [accounts, setAccounts] = useState<GuestAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ps, accs] = await Promise.all([
        guestAuth.getPortalSettings(activeScopeId),
        guestAuth.getAccounts()
      ]);

      if (!ps.support_phone) {
        ps.support_phone = currentOutlet?.phone || currentProperty?.phone || settings?.phone || '+60 3-1234 5678';
      }
      if (!ps.support_email) {
        ps.support_email = currentOutlet?.email || currentProperty?.email || settings?.email || 'support@perfection.my';
      }

      setPortalSettings(ps);
      setAccounts(accs);
    } catch (e) {
      console.error('Error loading guest portal settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOutlet?.id, currentProperty?.id]);

  const handleToggleSetting = async (key: keyof GuestPortalSettings) => {
    const updated = { ...portalSettings, [key]: !portalSettings[key] };
    setPortalSettings(updated);
    setSaving(true);
    try {
      await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      toast.success(`Guest portal settings updated for ${activeScopeName}.`);
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTextSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await guestAuth.savePortalSettings(portalSettings, activeScopeId);
      await refreshSettings();
      toast.success(`Concierge preferences saved for ${activeScopeName}.`);
    } catch (e) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccountActive = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await guestAuth.toggleAccountActive(id);
      if (updated) {
        setAccounts(prev => prev.map(a => a.id === id ? updated : a));
        toast.success(`Account ${updated.is_active ? 'Activated' : 'Suspended'}`);
      }
    } catch (e) {
      toast.error('Failed to update account status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendCredentials = async (account: GuestAccount) => {
    setActionLoadingId(account.id);
    try {
      const res = await guestAuth.provisionGuestAccount({
        email: account.email,
        name: account.name,
        phone: account.phone,
        property_id: account.property_id,
        outlet_id: account.outlet_id,
        forceResend: true
      });
      toast.success(
        `Credentials dispatched to ${account.email}. New Temporary Password: ${res.tempPassword || account.temp_password}`,
        { duration: 8000 }
      );
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to dispatch credentials');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete guest portal credentials for ${name}?`)) return;
    setActionLoadingId(id);
    try {
      await guestAuth.deleteGuestAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      toast.success(`Guest portal access deleted for ${name}.`);
    } catch (e) {
      toast.error('Failed to delete guest account');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      // Scope filter per selected outlet/property filter
      if (selectedOutletFilter !== 'all') {
        const matchOutlet = a.outlet_id && a.outlet_id === selectedOutletFilter;
        const matchProp = a.property_id && a.property_id === selectedOutletFilter;
        if (!matchOutlet && !matchProp) return false;
      }
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone && a.phone.includes(q))
      );
    });
  }, [accounts, selectedOutletFilter, searchTerm]);

  const portalDomainUrl = 'https://hcm-guest.perfection.my/#/guest-login';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER HERO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-400/20">
                <Smartphone className="w-3.5 h-3.5" /> Super Admin Control
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest border border-amber-400/30">
                <span>Facility Scope:</span>
                <span className="text-white font-bold">{activeScopeName}</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Guest Portal Settings — {activeScopeName}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
              Configure guest visibility, touchless QR check-in, PT session tracking, spa booking requests, and manage authenticated guest accounts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href={portalDomainUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Open Guest Portal
            </a>
            <button
              onClick={() => handleToggleSetting('is_enabled')}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                portalSettings.is_enabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
              }`}
            >
              <Power className="w-4 h-4" />
              {portalSettings.is_enabled ? 'Portal Online' : 'Portal Offline'}
            </button>
          </div>
        </div>
      </div>

      {/* FEATURE VISIBILITY MATRIX */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
              Guest Privilege &amp; Feature Visibility Matrix
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Control what guests can see and access from their mobile phones
            </p>
          </div>
          {saving && (
            <span className="text-[10px] font-black uppercase text-indigo-600 animate-pulse">
              Saving changes...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. DIGITAL CARD & QR */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <QrCode className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_digital_card')}
                  className="text-2xl"
                >
                  {portalSettings.allow_digital_card ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Digital Card &amp; QR Check-In
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Displays the holographic digital VIP membership card and dynamic barcode for touchless front desk/turnstile check-in.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_digital_card ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_digital_card ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>

          {/* 2. PT TRACKER */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_pt_tracking')}
                  className="text-2xl"
                >
                  {portalSettings.allow_pt_tracking ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Personal Training Tracker
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Enables guests to track remaining training sessions, assigned trainer details, and workout attendance history.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_pt_tracking ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_pt_tracking ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>

          {/* 3. SPA & WELLNESS BOOKINGS */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_massage_bookings')}
                  className="text-2xl"
                >
                  {portalSettings.allow_massage_bookings ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Spa &amp; Massage Reservations
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Allows guests to view confirmed massage treatments, assigned therapists, and submit appointment requests.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_massage_bookings ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_massage_bookings ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>

          {/* 4. ENTRANCE PASSES */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                  <Ticket className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_entrance_passes')}
                  className="text-2xl"
                >
                  {portalSettings.allow_entrance_passes ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Day Passes &amp; Pool Entries
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Displays active entrance fee passes (e.g. Ground Floor Pool vs. 1st Floor Pool) and signed digital waivers.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_entrance_passes ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_entrance_passes ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>

          {/* 5. FINANCIAL INVOICES */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_financial_history')}
                  className="text-2xl"
                >
                  {portalSettings.allow_financial_history ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Billing &amp; Receipts
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Allows guests to review past transaction amounts, payment methods, and download official payment slips.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_financial_history ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_financial_history ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>

          {/* 6. PROFILE EDITING */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
                  <User className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_profile_editing')}
                  className="text-2xl"
                >
                  {portalSettings.allow_profile_editing ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Guest Profile Modifications
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Allows guests to update contact information and emergency phone numbers from their mobile devices.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_profile_editing ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_profile_editing ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PORTAL SUPPORT & DIRECTIVE CONFIGURATION */}
      <Card className="rounded-[2rem] p-6 sm:p-8 border-slate-200/80 shadow-sm bg-white space-y-5">
        <div>
          <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">
            Guest Portal Concierge &amp; Support Info
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Contact information displayed at the bottom of the guest portal
          </p>
        </div>

        <form onSubmit={handleSaveTextSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                Support Phone Number
              </label>
              <input
                type="text"
                value={portalSettings.support_phone || ''}
                onChange={e => setPortalSettings({ ...portalSettings, support_phone: e.target.value })}
                placeholder="+60 3-1234 5678"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                Support Concierge Email
              </label>
              <input
                type="email"
                value={portalSettings.support_email || ''}
                onChange={e => setPortalSettings({ ...portalSettings, support_email: e.target.value })}
                placeholder="support@perfection.my"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              isLoading={saving}
              className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg"
            >
              Save Concierge Details
            </Button>
          </div>
        </form>
      </Card>

      {/* GUEST ACCOUNTS DIRECTORY */}
      <Card className="rounded-[2.5rem] border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">
              Authenticated Guest Accounts ({filteredAccounts.length}{filteredAccounts.length !== accounts.length ? ` of ${accounts.length}` : ''})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Manage member credentials, resend temporary passwords, or suspend access
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedOutletFilter}
              onChange={e => setSelectedOutletFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Outlets &amp; Facilities ({accounts.length})</option>
              {outlets?.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              {properties?.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Property)</option>
              ))}
            </select>

            <div className="relative w-56 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search guest or email..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={loadData}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Refresh List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Guest / Member</th>
                <th className="px-6 py-4">Login Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Security State</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {accounts.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-slate-600 font-bold">No accounts match the current filter ({accounts.length} total registered accounts).</p>
                        <button
                          type="button"
                          onClick={() => { setSelectedOutletFilter('all'); setSearchTerm(''); }}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-all"
                        >
                          View All Accounts ({accounts.length})
                        </button>
                      </div>
                    ) : (
                      "No guest accounts found. New accounts are automatically provisioned when members or guests are created with an email address."
                    )}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const matchedOutlet = outlets?.find(o => o.id === acc.outlet_id);
                  const matchedProp = properties?.find(p => p.id === acc.property_id);
                  const facilityName = matchedOutlet?.name || matchedProp?.name;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                            {acc.name ? acc.name.charAt(0).toUpperCase() : 'G'}
                          </div>
                          <div>
                            <p>{acc.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                              {acc.phone && <span>{acc.phone}</span>}
                              {facilityName && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                                  {facilityName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4 font-mono text-slate-600">
                      {acc.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        acc.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {acc.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {acc.must_change_password ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">
                            Temporary Pass
                          </span>
                          {acc.temp_password && (
                            <code className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded select-all" title="Click to copy temporary passcode">
                              {acc.temp_password}
                            </code>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                          Permanent Key
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {acc.last_login ? format(parseISO(acc.last_login), 'dd MMM yyyy, HH:mm') : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleResendCredentials(acc)}
                          disabled={actionLoadingId === acc.id}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                          title="Resend welcome credentials email"
                        >
                          <Send className="w-3 h-3" /> Resend Credentials
                        </button>
                        <button
                          onClick={() => handleToggleAccountActive(acc.id)}
                          disabled={actionLoadingId === acc.id}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                            acc.is_active
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {acc.is_active ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id, acc.name)}
                          disabled={actionLoadingId === acc.id}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                          title="Permanently delete guest account"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
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
