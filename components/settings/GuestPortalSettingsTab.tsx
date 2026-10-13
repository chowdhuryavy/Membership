import React, { useState, useEffect, useMemo } from 'react';
import { guestAuth, DEFAULT_GUEST_PORTAL_SETTINGS, DEFAULT_NAV_BUTTON_ORDER } from '../../services/guestAuthService';
import { db } from '../../services/mockSupabase';
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
  Users,
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
  UserPlus,
  Copy,
  ShoppingBag,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowLeftRight,
  RotateCcw,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { Button, Input, Card } from '../ui';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const NAV_BUTTONS_METADATA: Record<string, {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  settingKey: keyof GuestPortalSettings;
}> = {
  pt: {
    id: 'pt',
    name: 'Personal Training Tracker',
    shortLabel: 'PT',
    description: 'Track assigned PT sessions, coach notes & workout attendance',
    icon: Dumbbell,
    badgeBg: 'bg-blue-50 border-blue-200/60',
    badgeText: 'text-blue-700',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    settingKey: 'allow_pt_tracking'
  },
  spa: {
    id: 'spa',
    name: 'Spa & Massage Reservations',
    shortLabel: 'Spa',
    description: 'Confirmed spa appointments, therapist info & service requests',
    icon: Sparkles,
    badgeBg: 'bg-purple-50 border-purple-200/60',
    badgeText: 'text-purple-700',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    settingKey: 'allow_massage_bookings'
  },
  passes: {
    id: 'passes',
    name: 'Day Passes & Pool Entries',
    shortLabel: 'Passes',
    description: 'Daily pool access passes, facility entries & liability waivers',
    icon: Ticket,
    badgeBg: 'bg-emerald-50 border-emerald-200/60',
    badgeText: 'text-emerald-700',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    settingKey: 'allow_entrance_passes'
  },
  retail: {
    id: 'retail',
    name: 'Pro Shop & Retail Catalog',
    shortLabel: 'Shop',
    description: 'Browse venue merchandise, supplements & pre-order gear',
    icon: ShoppingBag,
    badgeBg: 'bg-amber-50 border-amber-200/60',
    badgeText: 'text-amber-700',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    settingKey: 'allow_shop'
  },
  finances: {
    id: 'finances',
    name: 'History & Billing Receipts',
    shortLabel: 'History',
    description: 'Past payment invoices, transaction records & digital receipts',
    icon: Clock,
    badgeBg: 'bg-indigo-50 border-indigo-200/60',
    badgeText: 'text-indigo-700',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    settingKey: 'allow_financial_history'
  },
  profile: {
    id: 'profile',
    name: 'Guest Profile & Credentials',
    shortLabel: 'Profile',
    description: 'Mobile guest account details, phone contact & password security',
    icon: User,
    badgeBg: 'bg-teal-50 border-teal-200/60',
    badgeText: 'text-teal-700',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-600',
    settingKey: 'allow_profile_editing'
  }
};

export const GuestPortalSettingsTab: React.FC = () => {
  const { currentOutlet, currentProperty, settings, refreshSettings, outlets, properties } = useSettings();
  const { isSuperAdmin } = useAuth();

  const activeScopeId = currentOutlet?.id || currentProperty?.id;
  const activeScopeName = currentOutlet?.name || currentProperty?.name || settings?.name || 'All Facilities';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalSettings, setPortalSettings] = useState<GuestPortalSettings>(DEFAULT_GUEST_PORTAL_SETTINGS);
  const [accounts, setAccounts] = useState<GuestAccount[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ps, accs, mems] = await Promise.all([
        guestAuth.getPortalSettings(activeScopeId),
        guestAuth.getAccounts(),
        db.getMembers('').catch(() => [])
      ]);

      if (!ps.support_phone) {
        ps.support_phone = currentOutlet?.phone || currentProperty?.phone || settings?.phone || '+60 3-1234 5678';
      }
      if (!ps.support_email) {
        ps.support_email = currentOutlet?.backup_email || (currentProperty as any)?.email || (settings as any)?.email || 'support@perfection.my';
      }

      setPortalSettings(ps);
      setAccounts(accs);
      setMembers(mems || []);
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

  const currentNavOrder = useMemo(() => {
    const raw = portalSettings.nav_button_order && Array.isArray(portalSettings.nav_button_order) && portalSettings.nav_button_order.length > 0
      ? portalSettings.nav_button_order
      : DEFAULT_NAV_BUTTON_ORDER;
    return [
      ...raw.filter(id => DEFAULT_NAV_BUTTON_ORDER.includes(id)),
      ...DEFAULT_NAV_BUTTON_ORDER.filter(id => !raw.includes(id))
    ];
  }, [portalSettings.nav_button_order]);

  const handleMoveNavButton = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentNavOrder.length) return;

    const newOrder = [...currentNavOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved);

    const updated = { ...portalSettings, nav_button_order: newOrder };
    setPortalSettings(updated);
    setSaving(true);
    try {
      await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      const movedItem = NAV_BUTTONS_METADATA[moved]?.shortLabel || moved;
      toast.success(`Moved "${movedItem}" ${direction === 'up' ? 'earlier / left' : 'later / right'}.`);
    } catch (e) {
      toast.error('Failed to save navigation button order');
    } finally {
      setSaving(false);
    }
  };

  const handleResetNavButtonOrder = async () => {
    const updated = { ...portalSettings, nav_button_order: DEFAULT_NAV_BUTTON_ORDER };
    setPortalSettings(updated);
    setSaving(true);
    try {
      await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      toast.success('Navigation button order reset to default.');
    } catch (e) {
      toast.error('Failed to reset order');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNavBarPosition = async () => {
    const newPosition: 'left' | 'right' = portalSettings.nav_bar_position === 'right' ? 'left' : 'right';
    const updated = { ...portalSettings, nav_bar_position: newPosition };
    setPortalSettings(updated);
    setSaving(true);
    try {
      await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      toast.success(`Navigation direction set to ${newPosition === 'right' ? 'Right to Left' : 'Left to Right'}.`);
    } catch (e) {
      toast.error('Failed to update navigation direction');
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
      // Find all matching members for this guest account
      const guestMembers = members.filter(m => 
        (a.member_id && m.id === a.member_id) ||
        (m.email && m.email.toLowerCase() === (a.email || '').toLowerCase())
      );

      // 1. If an outlet is selected on top
      if (currentOutlet?.id) {
        const directMatch = a.outlet_id === currentOutlet.id;
        const memberMatch = guestMembers.some(m => m.outlet_id === currentOutlet.id);
        if (!directMatch && !memberMatch) return false;
      }
      // 2. If a property is selected on top (without a specific outlet)
      else if (currentProperty?.id) {
        const directMatch = a.property_id === currentProperty.id;
        const directOutletMatch = a.outlet_id && outlets?.some(o => o.id === a.outlet_id && o.property_id === currentProperty.id);
        const memberMatch = guestMembers.some(m => {
          if (m.property_id === currentProperty.id) return true;
          const o = outlets?.find(out => out.id === m.outlet_id);
          return o?.property_id === currentProperty.id;
        });
        if (!directMatch && !directOutletMatch && !memberMatch) return false;
      }

      // 3. Search query filter
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone && a.phone.includes(q))
      );
    });
  }, [accounts, members, currentOutlet?.id, currentProperty?.id, outlets, searchTerm]);

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

          {/* 3B. THERAPIST NAME PRIVACY */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <Users className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('show_therapist_name_to_guests')}
                  className="text-2xl"
                  title="Toggle therapist name visibility"
                >
                  {portalSettings.show_therapist_name_to_guests ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Show Therapist Names to Guests
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                When disabled (default), guests only see the specialist's nationality (e.g. Thai Specialist, Balinese Specialist) to safeguard staff privacy. When enabled, therapist names are shown.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.show_therapist_name_to_guests ? 'text-indigo-600' : 'text-amber-600'}`}>
                {portalSettings.show_therapist_name_to_guests ? '● Names Revealed to Guests' : '🛡 Nationality Only (Staff Names Hidden)'}
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

          {/* 7. PRO SHOP & RETAIL CATALOG */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <button
                  onClick={() => handleToggleSetting('allow_shop')}
                  className="text-2xl"
                >
                  {portalSettings.allow_shop !== false ? (
                    <ToggleRight className="w-8 h-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Pro Shop &amp; Retail Catalog
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Enables guests to browse venue retail items, fitness gear, supplements, and equipment with pricing and submit pre-orders.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${portalSettings.allow_shop !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                {portalSettings.allow_shop !== false ? '● Enabled for Guests' : '○ Hidden from Guests'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION BUTTON ORDER CONFIGURATION */}
      <Card className="rounded-[2.5rem] p-6 sm:p-8 border-slate-200/80 shadow-sm bg-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">
                  Navigation Button Order
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Use arrows to reorder navigation buttons
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleNavBarPosition}
              className="px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
              title="Toggle sequence orientation between Left-to-Right and Right-to-Left"
            >
              <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
              <span>Direction: <strong className="text-slate-900">{portalSettings.nav_bar_position === 'right' ? 'Right to Left' : 'Left to Right'}</strong></span>
            </button>
            <button
              type="button"
              onClick={handleResetNavButtonOrder}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Reset order to default sequence"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        {/* Golden P Medallion Center Anchor Callout */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 p-0.5 shadow-md flex-shrink-0">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="font-serif font-black text-amber-300 text-sm">P</span>
            </div>
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-wider text-amber-900">
                Always Centered Anchor: Perfection VIP "P" Pass
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                Pinned Center
              </span>
            </div>
            <p className="text-amber-800/80 font-medium leading-relaxed">
              The elevated golden <strong>"P"</strong> digital pass medallion is permanently anchored in the middle of the bottom navigation bar. The items below are distributed evenly on the left and right wings around the central "P" button.
            </p>
          </div>
        </div>

        {/* Live Visual Preview Simulation Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Live Guest Portal Mobile Bar Preview</span>
            <span className="text-indigo-600 font-black">{portalSettings.nav_bar_position === 'right' ? 'Reversed (Right to Left)' : 'Standard (Left to Right)'}</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl max-w-xl mx-auto">
            {(() => {
              const orderedList = portalSettings.nav_bar_position === 'right'
                ? [...currentNavOrder].reverse()
                : currentNavOrder;
              const half = Math.ceil(orderedList.length / 2);
              const leftItems = orderedList.slice(0, half);
              const rightItems = orderedList.slice(half);

              const renderPreviewBtn = (id: string) => {
                const meta = NAV_BUTTONS_METADATA[id];
                if (!meta) return null;
                const IconComponent = meta.icon;
                const isEnabled = portalSettings[meta.settingKey] !== false;
                return (
                  <div
                    key={id}
                    className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                      isEnabled ? 'text-amber-400 font-bold opacity-100' : 'text-slate-600 opacity-40 line-through'
                    }`}
                    title={`${meta.name} (${isEnabled ? 'Enabled' : 'Disabled'})`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-[8px] tracking-tight truncate max-w-[45px]">{meta.shortLabel}</span>
                  </div>
                );
              };

              return (
                <div className="flex items-center justify-between relative px-2">
                  <div className="flex-1 flex items-center justify-around">
                    {leftItems.map(renderPreviewBtn)}
                  </div>

                  {/* Centered Golden P Medallion Mock */}
                  <div className="mx-2 flex-shrink-0 flex flex-col items-center justify-center -translate-y-1">
                    <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 shadow-[0_0_12px_rgba(245,158,11,0.6)] flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                        <span className="font-serif font-black text-xs text-amber-300">P</span>
                      </div>
                    </div>
                    <span className="text-[7px] text-amber-300/80 font-black uppercase tracking-widest mt-0.5">VIP Pass</span>
                  </div>

                  <div className="flex-1 flex items-center justify-around">
                    {rightItems.map(renderPreviewBtn)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Interactive List with Arrow Reordering Controls */}
        <div className="space-y-3 pt-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
            Reorder Sequence ({currentNavOrder.length} Navigation Buttons)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentNavOrder.map((btnId, index) => {
              const meta = NAV_BUTTONS_METADATA[btnId];
              if (!meta) return null;
              const IconComponent = meta.icon;
              const isEnabled = portalSettings[meta.settingKey] !== false;
              const halfCount = Math.ceil(currentNavOrder.length / 2);
              const isLeftWing = index < halfCount;

              return (
                <div
                  key={btnId}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-slate-50/70 border-slate-200/90 hover:border-indigo-300 hover:bg-white shadow-sm'
                      : 'bg-slate-100/50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Position Index Badge */}
                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white font-mono font-black text-xs shadow-sm flex-shrink-0">
                      <span>#{index + 1}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl ${meta.iconBg} ${meta.iconColor} flex-shrink-0`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-black uppercase text-slate-900 truncate">
                          {meta.name}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-500">
                          ({meta.shortLabel})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${meta.badgeBg} ${meta.badgeText} border`}>
                          {isLeftWing ? `Position ${index + 1} • Left Wing` : `Position ${index + 1} • Right Wing`}
                        </span>
                        <span className={`text-[9px] font-bold ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {isEnabled ? '● Active' : '○ Hidden'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveNavButton(index, 'up')}
                      disabled={index === 0 || saving}
                      title={`Move ${meta.shortLabel} earlier / left`}
                      className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                        index === 0 || saving
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border-slate-200 shadow-sm active:scale-95'
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveNavButton(index, 'down')}
                      disabled={index === currentNavOrder.length - 1 || saving}
                      title={`Move ${meta.shortLabel} later / right`}
                      className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                        index === currentNavOrder.length - 1 || saving
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border-slate-200 shadow-sm active:scale-95'
                      }`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

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
                Support Email
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
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">
                Authenticated Guest Accounts ({filteredAccounts.length})
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {currentOutlet ? currentOutlet.name : currentProperty ? currentProperty.name : 'All Facilities'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Manage member credentials, resend temporary passwords, or suspend access
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 sm:w-72">
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
                      <div className="space-y-2">
                        <p className="text-slate-600 font-bold">
                          No guest accounts found for {currentOutlet ? currentOutlet.name : currentProperty ? currentProperty.name : 'this view'}.
                        </p>
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-all"
                          >
                            Clear Search Filter
                          </button>
                        )}
                      </div>
                    ) : (
                      "No guest accounts found. New accounts are automatically provisioned when members or guests are created with an email address."
                    )}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const guestMember = members.find(m => 
                    (currentOutlet && m.outlet_id === currentOutlet.id && (m.id === acc.member_id || m.email?.toLowerCase() === acc.email.toLowerCase())) ||
                    (m.id === acc.member_id || m.email?.toLowerCase() === acc.email.toLowerCase())
                  );
                  const effectiveOutletId = (currentOutlet?.id) || acc.outlet_id || guestMember?.outlet_id;
                  const matchedOutlet = outlets?.find(o => o.id === effectiveOutletId);
                  const matchedProp = properties?.find(p => p.id === matchedOutlet?.property_id || p.id === acc.property_id || p.id === guestMember?.property_id);
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
                      <div className="flex items-center gap-1.5">
                        <span>{acc.email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(acc.email);
                            toast.success(`Copied email: ${acc.email}`);
                          }}
                          className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                          title="Copy Email"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg select-all" title="Temporary Passcode">
                                {acc.temp_password}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(acc.temp_password || '');
                                  toast.success(`Copied temporary passcode: ${acc.temp_password}`);
                                }}
                                className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors shrink-0 flex items-center gap-1 font-bold text-[10px]"
                                title="Copy Temporary Password"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </button>
                            </div>
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
