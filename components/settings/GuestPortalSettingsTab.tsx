import React, { useState, useEffect, useMemo } from 'react';
import { guestAuth, DEFAULT_GUEST_PORTAL_SETTINGS, DEFAULT_NAV_BUTTON_ORDER } from '../../services/guestAuthService';
import { db } from '../../services/mockSupabase';
import { GuestAccount, GuestPortalSettings, GuestPortalNavButtonId } from '../../types';
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
  Award,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  GripVertical,
  Database,
  Save,
  Code,
  FileCode
} from 'lucide-react';
import { Button, Input, Card } from '../ui';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const NAV_BUTTON_CONFIG_MAP: Record<GuestPortalNavButtonId, {
  id: GuestPortalNavButtonId;
  label: string;
  shortLabel: string;
  settingKey: keyof GuestPortalSettings;
  description: string;
  icon: (cls?: string) => React.ReactNode;
  tag: string;
  colorClasses: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
  isSignatureP?: boolean;
}> = {
  card: {
    id: 'card',
    label: "Digital Pass ('P' Emblem)",
    shortLabel: 'Pass (P)',
    settingKey: 'allow_digital_card',
    description: 'Elevated golden "P" emblem, holographic VIP membership pass, turnstile barcode & Apple/Google Wallet pass.',
    icon: (cls = 'w-5 h-5') => <Award className={cls} />,
    tag: 'Signature Pass',
    colorClasses: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-300'
    },
    isSignatureP: true
  },
  pt: {
    id: 'pt',
    label: 'Personal Training (PT)',
    shortLabel: 'PT',
    settingKey: 'allow_pt_tracking',
    description: 'Enables guests to track remaining personal training sessions, instructor assignments & workout history.',
    icon: (cls = 'w-5 h-5') => <Dumbbell className={cls} />,
    tag: 'Fitness',
    colorClasses: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800 border-blue-300'
    }
  },
  spa: {
    id: 'spa',
    label: 'Spa & Wellness (Spa)',
    shortLabel: 'Spa',
    settingKey: 'allow_massage_bookings',
    description: 'Displays spa treatments, therapy schedules, and lets guests book massage appointment slots.',
    icon: (cls = 'w-5 h-5') => <Sparkles className={cls} />,
    tag: 'Wellness',
    colorClasses: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800 border-purple-300'
    }
  },
  passes: {
    id: 'passes',
    label: 'Day Passes & Pool (Passes)',
    shortLabel: 'Passes',
    settingKey: 'allow_entrance_passes',
    description: 'Shows active entrance day fees (e.g. Ground Floor Pool, Gym entry) and signed digital liability waivers.',
    icon: (cls = 'w-5 h-5') => <Ticket className={cls} />,
    tag: 'Day Passes',
    colorClasses: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }
  },
  retail: {
    id: 'retail',
    label: 'Pro Shop & Retail (Shop)',
    shortLabel: 'Shop',
    settingKey: 'allow_shop',
    description: 'Displays venue retail items, sports merchandise, nutritional supplements & allows pre-orders for pickup.',
    icon: (cls = 'w-5 h-5') => <ShoppingBag className={cls} />,
    tag: 'Pro Shop',
    colorClasses: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-300'
    }
  },
  finances: {
    id: 'finances',
    label: 'Billing & Receipts (History)',
    shortLabel: 'History',
    settingKey: 'allow_financial_history',
    description: 'Enables guests to review itemized purchase transactions, payment methods & view printable receipts.',
    icon: (cls = 'w-5 h-5') => <Clock className={cls} />,
    tag: 'Finances',
    colorClasses: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    }
  },
  profile: {
    id: 'profile',
    label: 'Guest Profile & Security (Profile)',
    shortLabel: 'Profile',
    settingKey: 'allow_profile_editing',
    description: 'Allows guests to edit phone numbers, emergency contact details and update their portal password.',
    icon: (cls = 'w-5 h-5') => <User className={cls} />,
    tag: 'Security',
    colorClasses: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800 border-teal-300'
    }
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
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

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
      const saved = await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      setPortalSettings(saved);
      setLastSavedTime(format(new Date(), 'hh:mm:ss a'));
      toast.success(`Guest portal settings updated & saved to database.`);
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const navOrder: GuestPortalNavButtonId[] = useMemo(() => {
    const baseOrder = portalSettings.nav_button_order && Array.isArray(portalSettings.nav_button_order) && portalSettings.nav_button_order.length > 0
      ? portalSettings.nav_button_order
      : DEFAULT_NAV_BUTTON_ORDER;

    const allIds: GuestPortalNavButtonId[] = ['pt', 'spa', 'card', 'passes', 'retail', 'finances', 'profile'];
    const unique = Array.from(new Set(baseOrder.filter(id => allIds.includes(id))));
    allIds.forEach(id => {
      if (!unique.includes(id)) unique.push(id);
    });
    return unique;
  }, [portalSettings.nav_button_order]);

  const handleMoveNavButton = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= navOrder.length) return;

    const newOrder = [...navOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const updated = { ...portalSettings, nav_button_order: newOrder };
    setPortalSettings(updated);
    setSaving(true);
    try {
      const saved = await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      setPortalSettings(saved);
      setLastSavedTime(format(new Date(), 'hh:mm:ss a'));
      const meta = NAV_BUTTON_CONFIG_MAP[moved];
      toast.success(`Moved "${meta.shortLabel}" ${direction === 'up' ? 'left / up' : 'right / down'} & saved to database.`);
    } catch (e) {
      toast.error('Failed to update navigation order');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSaveNavOrder = async () => {
    setSaving(true);
    try {
      const saved = await guestAuth.savePortalSettings({ nav_button_order: navOrder }, activeScopeId);
      await refreshSettings();
      setPortalSettings(saved);
      setLastSavedTime(format(new Date(), 'hh:mm:ss a'));
      toast.success(`Navigation order successfully saved to database for ${activeScopeName}!`);
    } catch (e) {
      toast.error('Failed to save navigation order to database');
    } finally {
      setSaving(false);
    }
  };

  const handleResetNavOrder = async () => {
    const updated = { ...portalSettings, nav_button_order: [...DEFAULT_NAV_BUTTON_ORDER] };
    setPortalSettings(updated);
    setSaving(true);
    try {
      const saved = await guestAuth.savePortalSettings(updated, activeScopeId);
      await refreshSettings();
      setPortalSettings(saved);
      setLastSavedTime(format(new Date(), 'hh:mm:ss a'));
      toast.success(`Navigation order reset to default & saved to database.`);
    } catch (e) {
      toast.error('Failed to reset navigation order');
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

      {/* NAVIGATION BUTTON ORDER & REORDERING CONTROLS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                Navigation Button Order
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                Mobile Bottom Bar
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Use arrows to reorder navigation buttons
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleManualSaveNavOrder}
              isLoading={saving}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title="Commit and save navigation order to database"
            >
              <Save className="w-3.5 h-3.5" />
              Save Order to Database
            </Button>

            <button
              type="button"
              onClick={() => setShowSqlModal(!showSqlModal)}
              className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
              title="View SQL migration script"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              SQL Schema
            </button>

            <button
              type="button"
              onClick={handleResetNavOrder}
              disabled={saving}
              className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border border-slate-200 cursor-pointer"
              title="Reset buttons to default order"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Default
            </button>
          </div>
        </div>

        {/* OPTIONAL SQL MIGRATION CODE ACCORDION */}
        {showSqlModal && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black uppercase tracking-wider text-white">
                  Database Persistence &amp; Optional SQL Code
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sql = `ALTER TABLE company_settings\nADD COLUMN IF NOT EXISTS guest_portal_settings JSONB DEFAULT '{}'::jsonb,\nADD COLUMN IF NOT EXISTS guest_portal_settings_map JSONB DEFAULT '{}'::jsonb;\n\nUPDATE company_settings\nSET\n  guest_portal_settings = COALESCE(guest_portal_settings, staff_portal_settings->'guest_portal_settings', '{}'::jsonb),\n  guest_portal_settings_map = COALESCE(guest_portal_settings_map, staff_portal_settings->'guest_portal_settings_map', '{}'::jsonb)\nWHERE id = 'global';`;
                  navigator.clipboard.writeText(sql);
                  toast.success('SQL migration copied to clipboard!');
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Copy className="w-3.5 h-3.5" /> Copy SQL Script
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              The application already persists your guest portal navigation order directly to the <span className="text-amber-300 font-mono">company_settings</span> table in Supabase. If you wish to provision dedicated columns in Postgres for direct SQL querying, execute the statement below in your <span className="text-indigo-300 font-bold">Supabase SQL Editor</span>:
            </p>
            <pre className="p-4 rounded-2xl bg-black/60 border border-slate-800 text-indigo-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`-- Optional SQL Migration for Supabase
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS guest_portal_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS guest_portal_settings_map JSONB DEFAULT '{}'::jsonb;

UPDATE company_settings 
SET 
  guest_portal_settings = COALESCE(guest_portal_settings, staff_portal_settings->'guest_portal_settings', '{}'::jsonb),
  guest_portal_settings_map = COALESCE(guest_portal_settings_map, staff_portal_settings->'guest_portal_settings_map', '{}'::jsonb)
WHERE id = 'global';`}
            </pre>
          </div>
        )}

        <Card className="rounded-[2.5rem] border-slate-200/80 shadow-sm bg-white overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold">
                  Use arrows to reorder navigation buttons
                </p>
                <p className="text-indigo-700 text-[11px] mt-0.5">
                  Click the <span className="font-bold">▲ Up</span> and <span className="font-bold">▼ Down</span> arrows to move buttons left or right on the mobile guest bar. All buttons can be enabled or hidden directly from this list.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-200 shrink-0">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Scope: {activeScopeName}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lastSavedTime ? `Saved: ${lastSavedTime}` : 'Database Live'}</span>
              </div>
            </div>
          </div>

          {/* ORDERED BUTTONS LIST */}
          <div className="space-y-3">
            {navOrder.map((buttonId, index) => {
              const meta = NAV_BUTTON_CONFIG_MAP[buttonId];
              const isEnabled = portalSettings[meta.settingKey] !== false;
              const isFirst = index === 0;
              const isLast = index === navOrder.length - 1;

              return (
                <div
                  key={buttonId}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isEnabled
                      ? 'bg-slate-50/80 hover:bg-slate-50 border-slate-200/80 shadow-xs'
                      : 'bg-slate-100/50 border-slate-200/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* ORDER BADGE */}
                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-xl bg-white border border-slate-200 font-mono font-black text-xs text-slate-700 shadow-xs shrink-0">
                      #{index + 1}
                    </div>

                    {/* BUTTON ICON */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs shrink-0 ${meta.colorClasses.bg} ${meta.colorClasses.border}`}
                    >
                      {meta.icon('w-5 h-5')}
                    </div>

                    {/* DETAILS */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {meta.label}
                        </h4>
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.colorClasses.badge}`}
                        >
                          {meta.tag}
                        </span>
                        {meta.isSignatureP && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold shadow-xs">
                            Center 'P' Emblem
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5 max-w-xl">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {/* CONTROLS: TOGGLE & ARROWS */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    {/* VISIBILITY TOGGLE */}
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSetting(meta.settingKey)}
                        className="text-2xl transition-transform active:scale-95 cursor-pointer"
                        title={isEnabled ? 'Click to hide button from guest portal' : 'Click to show button in guest portal'}
                      >
                        {isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-indigo-600" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                      <span className={`text-[10px] font-black uppercase tracking-wider w-16 ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isEnabled ? 'Enabled' : 'Hidden'}
                      </span>
                    </div>

                    {/* ARROWS TO REORDER */}
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleMoveNavButton(index, 'up')}
                        disabled={isFirst || saving}
                        className={`p-2 rounded-lg transition-all flex items-center gap-1 font-bold text-xs ${
                          isFirst
                            ? 'text-slate-200 cursor-not-allowed'
                            : 'text-slate-700 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 cursor-pointer'
                        }`}
                        title={isFirst ? 'Already first in sequence' : 'Move button up / left'}
                      >
                        <ArrowUp className="w-4 h-4" />
                        <span className="text-[10px] uppercase font-black hidden md:inline">Up</span>
                      </button>

                      <div className="w-px h-5 bg-slate-200" />

                      <button
                        type="button"
                        onClick={() => handleMoveNavButton(index, 'down')}
                        disabled={isLast || saving}
                        className={`p-2 rounded-lg transition-all flex items-center gap-1 font-bold text-xs ${
                          isLast
                            ? 'text-slate-200 cursor-not-allowed'
                            : 'text-slate-700 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 cursor-pointer'
                        }`}
                        title={isLast ? 'Already last in sequence' : 'Move button down / right'}
                      >
                        <ArrowDown className="w-4 h-4" />
                        <span className="text-[10px] uppercase font-black hidden md:inline">Down</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE MOBILE PREVIEW STRIP */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Live Preview: Mobile Bottom Navigation Bar
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  Showing how enabled buttons will appear in order on guest phones
                </p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {navOrder.filter(id => portalSettings[NAV_BUTTON_CONFIG_MAP[id].settingKey] !== false).length} Active Buttons
              </span>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="bg-slate-950 p-3 sm:p-4 rounded-3xl border border-slate-800 shadow-xl max-w-xl mx-auto">
              <div className="flex items-center justify-around gap-1">
                {navOrder
                  .filter(id => portalSettings[NAV_BUTTON_CONFIG_MAP[id].settingKey] !== false)
                  .map(id => {
                    const meta = NAV_BUTTON_CONFIG_MAP[id];
                    if (id === 'card') {
                      return (
                        <div key={id} className="flex flex-col items-center justify-center px-2 py-1 relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 p-0.5 shadow-lg shadow-amber-500/20 -mt-1 ring-2 ring-amber-400/80">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-amber-300 font-serif font-black text-sm">
                              P
                            </div>
                          </div>
                          <span className="text-[8px] font-black text-amber-300 uppercase tracking-widest mt-1">
                            Pass
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={id} className="flex flex-col items-center justify-center px-2 py-1 text-slate-400 hover:text-slate-200">
                        {meta.icon('w-4 h-4')}
                        <span className="text-[8px] font-bold uppercase tracking-wider mt-1">
                          {meta.shortLabel}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </Card>
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
