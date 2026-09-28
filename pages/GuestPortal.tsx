import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestAuth } from '../services/guestAuthService';
import { db } from '../services/mockSupabase';
import {
  GuestAccount,
  Member,
  PTMember,
  PTSession,
  MassageBooking,
  EntranceFeeConsent,
  Sale,
  GuestPortalSettings
} from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { GuestLoadingScreen } from '../components/GuestLoadingScreen';
import {
  PasswordComplexityChecker,
  validatePasswordComplexity
} from '../components/PasswordComplexityChecker';
import { QRCodeSVG } from 'qrcode.react';
import { PERFECTION_QR_IMAGE_SETTINGS } from '../lib/perfectionLogo';
import toast from 'react-hot-toast';
import {
  QrCode,
  Dumbbell,
  Sparkles,
  Ticket,
  Receipt,
  User,
  LogOut,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  Plus,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

type ActiveTab = 'card' | 'pt' | 'spa' | 'passes' | 'finances' | 'profile';

export default function GuestPortal() {
  const navigate = useNavigate();
  const { currentProperty, currentOutlet, settings, formatMoney } = useSettings();

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<GuestAccount | null>(null);
  const [portalSettings, setPortalSettings] = useState<GuestPortalSettings | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('card');

  // Associated Data
  const [member, setMember] = useState<Member | null>(null);
  const [ptMembers, setPtMembers] = useState<PTMember[]>([]);
  const [ptSessions, setPtSessions] = useState<PTSession[]>([]);
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [consents, setConsents] = useState<EntranceFeeConsent[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBookingRequestModal, setShowBookingRequestModal] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // Booking request form state
  const [requestService, setRequestService] = useState('Swedish Massage (60 min)');
  const [requestDate, setRequestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [requestTime, setRequestTime] = useState('14:00');
  const [requestNotes, setRequestNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Branding
  const [dynamicPropertyName, setDynamicPropertyName] = useState(currentProperty?.name || settings?.name || 'Luxury Health Club & Spa');
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState(currentProperty?.logo_url || settings?.logo_url || null);

  const propertyName = dynamicPropertyName;
  const logoUrl = dynamicLogoUrl;

  // Validation for changing password
  const passValidation = validatePasswordComplexity(newPassword, confirmPassword);

  // Initialize and load guest data
  const loadPortalData = async () => {
    const session = guestAuth.getActiveSession();
    if (!session || !session.email) {
      navigate('/guest-login');
      return;
    }
    setAccount(session);

    try {
      const [ps, props, allMembers, allPtMembers, allPtSessions, allBookings, allConsents, allSales] =
        await Promise.all([
          guestAuth.getPortalSettings(),
          db.getProperties().catch(() => []),
          db.getMembers(session.outlet_id || 'all').catch(() => []),
          db.getPTMembers(session.outlet_id || 'all').catch(() => []),
          db.getPTSessions(session.outlet_id || 'all').catch(() => []),
          db.getMassageBookings(session.outlet_id || '').catch(() => []),
          db.getEntranceFeeConsents().catch(() => []),
          db.getSales(session.outlet_id || '').catch(() => [])
        ]);

      setPortalSettings(ps);

      if (session.property_id) {
        const matchedProp = props.find((p: any) => p.id === session.property_id);
        if (matchedProp) {
          if (matchedProp.name) setDynamicPropertyName(matchedProp.name);
          if (matchedProp.logo_url) setDynamicLogoUrl(matchedProp.logo_url);
        }
      } else if (props[0]) {
        if (props[0].name) setDynamicPropertyName(props[0].name);
        if (props[0].logo_url) setDynamicLogoUrl(props[0].logo_url);
      }

      const emailLower = session.email.toLowerCase();
      const phoneClean = (session.phone || '').replace(/\D/g, '');

      // Match member record
      const matchedMember = allMembers.find((m: any) => {
        if (session.member_id && m.id === session.member_id) return true;
        if (m.email && m.email.toLowerCase() === emailLower) return true;
        if (phoneClean && m.phone && m.phone.replace(/\D/g, '') === phoneClean) return true;
        if (m.guest_name && m.guest_name.toLowerCase() === session.name.toLowerCase()) return true;
        return false;
      });
      setMember(matchedMember || null);

      // Match PT Members & Sessions
      const matchedPT = allPtMembers.filter((pt: any) => {
        if (pt.email && pt.email.toLowerCase() === emailLower) return true;
        if (phoneClean && pt.phone && pt.phone.replace(/\D/g, '') === phoneClean) return true;
        if (pt.guest_name && pt.guest_name.toLowerCase() === session.name.toLowerCase()) return true;
        return false;
      });
      setPtMembers(matchedPT);

      const matchedPtIds = new Set(matchedPT.map((p) => p.id));
      const ptSessionsList = allPtSessions.filter((s: any) => matchedPtIds.has(s.pt_member_id));
      setPtSessions(ptSessionsList);

      // Match Spa bookings
      const matchedBookings = allBookings.filter((b: any) => {
        if (b.guest_email && b.guest_email.toLowerCase() === emailLower) return true;
        if (b.guest_name && b.guest_name.toLowerCase() === session.name.toLowerCase()) return true;
        return false;
      });
      setBookings(matchedBookings);

      // Match Entrance Fee Consents
      const matchedConsents = allConsents.filter((c: any) => {
        if (c.email && c.email.toLowerCase() === emailLower) return true;
        if (phoneClean && c.phone && c.phone.replace(/\D/g, '') === phoneClean) return true;
        if (c.guest_name && c.guest_name.toLowerCase() === session.name.toLowerCase()) return true;
        return false;
      });
      setConsents(matchedConsents);

      // Match Sales transactions
      const matchedSales = allSales.filter((s: any) => {
        if (s.customer_name && s.customer_name.toLowerCase() === session.name.toLowerCase()) return true;
        if (matchedMember && s.member_id === matchedMember.id) return true;
        return false;
      });
      setSales(matchedSales);
    } catch (e) {
      console.error('[GuestPortal] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [navigate]);

  const handleLogout = () => {
    guestAuth.logout();
    toast.success('Logged out successfully.');
    navigate('/guest-login');
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    if (!passValidation.isValid) {
      toast.error('Please fulfill all password security rules.');
      return;
    }

    setPassLoading(true);
    try {
      const res = await guestAuth.changeGuestPassword(account.email, newPassword);
      if (!res.success) {
        toast.error(res.error || 'Failed to update password');
        return;
      }
      toast.success('Password updated successfully!');
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'Error changing password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleBookingRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setBookingSubmitting(true);
    try {
      await db.addMassageBooking({
        outlet_id: account.outlet_id || member?.outlet_id || 'default',
        guest_name: account.name || member?.guest_name || 'Guest',
        guest_email: account.email || member?.email || '',
        phone: account.phone || member?.phone || '',
        type_name: requestService,
        booking_date: requestDate,
        time: requestTime,
        status: 'Pending',
        notes: requestNotes
      });
      toast.success('Spa appointment request submitted successfully!');
      setShowBookingRequestModal(false);
      setRequestNotes('');

      // Reload bookings
      const allBookings = await db.getMassageBookings(account.outlet_id || '').catch(() => []);
      const matchedBookings = allBookings.filter((b: any) => {
        if (b.guest_email && b.guest_email.toLowerCase() === account.email.toLowerCase()) return true;
        if (b.guest_name && b.guest_name.toLowerCase() === account.name.toLowerCase()) return true;
        return false;
      });
      setBookings(matchedBookings);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit spa appointment request.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading) {
    return <GuestLoadingScreen propertyName={propertyName} logoUrl={logoUrl} message="Retrieving your private privileges..." />;
  }

  // Active privileges summary
  const memberNumber = member?.membership_number || account?.member_id || `G-${account?.id.slice(-6).toUpperCase()}`;
  const memberStatus = member?.status || 'Active';
  const expiryDate = member?.current_end_date ? format(parseISO(member.current_end_date), 'dd MMM yyyy') : 'No Expiry';

  // Total PT sessions remaining
  const totalPtPurchased = ptMembers.reduce((acc, p) => acc + (p.total_sessions || 0), 0);
  const totalPtRemaining = ptMembers.reduce((acc, p) => acc + Math.max(0, (p.total_sessions || 0) - (p.used_sessions || 0)), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-lg mx-auto relative shadow-2xl pb-24 selection:bg-indigo-500">
      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={propertyName}
              className="h-10 w-auto object-contain max-w-[100px]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
          )}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">
              Member Portal
            </span>
            <h2 className="text-sm font-black text-white uppercase truncate max-w-[180px]">
              {account?.name || 'Valued Guest'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPortalData()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 space-y-5">
        {/* TAB 1: MEMBERSHIP CARD & QR */}
        {activeTab === 'card' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* VIP CARD */}
            <div className="relative rounded-[2rem] p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-white/15 shadow-2xl overflow-hidden group">
              {/* Card Holographic Orbs */}
              <div className="absolute -right-10 -top-10 w-44 h-44 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col justify-between h-48">
                {/* Card Top Row */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400">
                      {propertyName}
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase mt-0.5">
                      {account?.name}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {memberStatus}
                  </span>
                </div>

                {/* Card Bottom Row */}
                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Member ID
                    </p>
                    <p className="text-base font-mono font-black text-white tracking-wider">
                      {memberNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Valid Thru
                    </p>
                    <p className="text-xs font-mono font-black text-amber-300">
                      {expiryDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* TOUCHLESS QR CHECK-IN CARD */}
            {portalSettings?.allow_digital_card && (
              <div className="bg-slate-900/90 rounded-3xl border border-white/10 p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    Touchless Facility Access
                  </span>
                  <h4 className="text-base font-black text-white uppercase">
                    Scan At Turnstile / Front Desk
                  </h4>
                </div>

                {/* QR Display */}
                <div
                  onClick={() => setShowQrModal(true)}
                  className="p-4 bg-white rounded-3xl shadow-2xl cursor-pointer hover:scale-105 transition-transform duration-300 relative group"
                >
                  <QRCodeSVG
                    value={memberNumber}
                    size={160}
                    level="H"
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                    imageSettings={PERFECTION_QR_IMAGE_SETTINGS}
                  />
                  <div className="absolute inset-0 bg-slate-950/20 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="bg-slate-900/90 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                      Enlarge QR
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 font-medium max-w-xs">
                  Tap barcode to expand for high-brightness turnstile reading.
                </p>
              </div>
            )}

            {/* QUICK STATS SUMMARY */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                  <Dumbbell className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">PT Sessions</span>
                </div>
                <p className="text-xl font-black text-white">{totalPtRemaining} <span className="text-xs text-slate-500 font-bold">/ {totalPtPurchased}</span></p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Sessions Available</p>
              </div>

              <div className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Spa Treatments</span>
                </div>
                <p className="text-xl font-black text-white">{bookings.length}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Appointments Logged</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL TRAINING */}
        {activeTab === 'pt' && portalSettings?.allow_pt_tracking && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Personal Training
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Active packages &amp; workout session history
                </p>
              </div>
            </div>

            {ptMembers.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-3xl border border-white/5 space-y-2">
                <Dumbbell className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-400 uppercase">No Active PT Package</h4>
                <p className="text-xs text-slate-500">Contact front desk to enroll in personal training sessions.</p>
              </div>
            ) : (
              ptMembers.map((pkg) => {
                const remaining = Math.max(0, (pkg.total_sessions || 0) - (pkg.used_sessions || 0));
                return (
                  <div
                    key={pkg.id}
                    className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                          {(pkg as any).package_type || 'Personal Training'}
                        </span>
                        <h4 className="text-base font-black text-white uppercase mt-0.5">
                          {(pkg as any).assigned_trainer || pkg.trainer_id || 'Assigned Coach'}
                        </h4>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase">
                        {pkg.status || 'Active'}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-black uppercase">
                        <span className="text-slate-400">Remaining</span>
                        <span className="text-amber-400">
                          {remaining} of {pkg.total_sessions || 0} Sessions
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-amber-400 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (((pkg.total_sessions || 0) - remaining) /
                                (pkg.total_sessions || 1)) *
                                100
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* SESSION HISTORY */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                Completed Sessions ({ptSessions.length})
              </h4>
              {ptSessions.length === 0 ? (
                <p className="text-xs text-slate-500 px-1">No completed sessions logged yet.</p>
              ) : (
                ptSessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-slate-900/70 border border-white/5 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-white uppercase">{(s as any).trainer_name || 'Coach'}</p>
                      <p className="text-slate-400 text-[10px]">
                        {s.date ? format(parseISO(s.date), 'dd MMM yyyy, HH:mm') : 'Session'}
                      </p>
                    </div>
                    <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      Completed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SPA & WELLNESS */}
        {activeTab === 'spa' && portalSettings?.allow_massage_bookings && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Spa &amp; Treatments
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Your therapy reservations
                </p>
              </div>
              <Button
                onClick={() => setShowBookingRequestModal(true)}
                className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Request Slot
              </Button>
            </div>

            {bookings.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-3xl border border-white/5 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-400 uppercase">No Spa Bookings</h4>
                <p className="text-xs text-slate-500">Tap "Request Slot" to reserve a massage or wellness therapy.</p>
              </div>
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                        {(b as any).type_name || 'Wellness Therapy'}
                      </span>
                      <h4 className="text-sm font-black text-white uppercase mt-0.5">
                        {b.date ? format(parseISO(b.date), 'EEEE, dd MMMM yyyy') : 'Scheduled'}
                      </h4>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase">
                      {b.status || 'Confirmed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{b.start_time} - {b.end_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span>{(b as any).therapist_name || 'Therapist'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: ENTRANCE PASSES & WAIVERS */}
        {activeTab === 'passes' && portalSettings?.allow_entrance_passes && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Passes &amp; Waivers
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Day pass entries, pool access, and signed liability consents
              </p>
            </div>

            {consents.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-3xl border border-white/5 space-y-2">
                <Ticket className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-400 uppercase">No Entrance Passes Found</h4>
                <p className="text-xs text-slate-500">Day passes and signed waivers will appear here.</p>
              </div>
            ) : (
              consents.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                        {c.item_name || 'Facility Day Pass'}
                      </span>
                      <h4 className="text-sm font-black text-white uppercase mt-0.5">
                        {c.room_number ? `Room ${c.room_number}` : 'Guest Day Pass'}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Signed
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Logged on {c.created_at ? format(parseISO(c.created_at), 'dd MMM yyyy, HH:mm') : 'Recently'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 5: FINANCES & RECEIPTS */}
        {activeTab === 'finances' && portalSettings?.allow_financial_history && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Billing &amp; Receipts
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Historical invoices and transaction records
              </p>
            </div>

            {sales.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-3xl border border-white/5 space-y-2">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-400 uppercase">No Transactions</h4>
                <p className="text-xs text-slate-500">Your purchases and payments will be listed here.</p>
              </div>
            ) : (
              sales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-slate-900/90 border border-white/10 rounded-3xl p-4 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {sale.category || 'Service'}
                    </span>
                    <h4 className="text-xs font-black text-white uppercase">
                      {sale.item_name || 'Transaction'}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {sale.created_at ? format(parseISO(sale.created_at), 'dd MMM yyyy') : ''} &bull; {sale.payment_method || 'Paid'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">
                      {formatMoney(sale.net_amount || 0)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 6: PROFILE & SECURITY */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Account &amp; Security
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Manage your profile and credentials
              </p>
            </div>

            <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Member Name
                </span>
                <p className="text-sm font-bold text-white">{account?.name}</p>
              </div>

              <div className="space-y-1 pt-2 border-t border-white/5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Registered Email
                </span>
                <p className="text-sm font-bold text-white">{account?.email}</p>
              </div>

              {account?.phone && (
                <div className="space-y-1 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Contact Phone
                  </span>
                  <p className="text-sm font-bold text-white">{account.phone}</p>
                </div>
              )}
            </div>

            {/* SECURITY BUTTON */}
            <Button
              onClick={() => setShowPasswordModal(true)}
              className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-wider border border-white/10 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-amber-400" /> Change Private Password
            </Button>

            {/* SUPPORT CONTACT */}
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 text-center space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Front Desk Concierge
              </p>
              <p className="text-xs font-bold text-indigo-400">
                {portalSettings?.support_phone || '+60 3-1234 5678'} &bull; {portalSettings?.support_email || 'support@perfection.my'}
              </p>
            </div>

            <Button
              onClick={handleLogout}
              className="w-full h-12 rounded-2xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all"
            >
              Sign Out
            </Button>
          </div>
        )}
      </main>

      {/* BOTTOM MOBILE NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-2 z-40 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('card')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
            activeTab === 'card' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-wider">Pass</span>
        </button>

        {portalSettings?.allow_pt_tracking && (
          <button
            onClick={() => setActiveTab('pt')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
              activeTab === 'pt' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider">PT</span>
          </button>
        )}

        {portalSettings?.allow_massage_bookings && (
          <button
            onClick={() => setActiveTab('spa')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
              activeTab === 'spa' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider">Spa</span>
          </button>
        )}

        {portalSettings?.allow_entrance_passes && (
          <button
            onClick={() => setActiveTab('passes')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
              activeTab === 'passes' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ticket className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider">Passes</span>
          </button>
        )}

        {portalSettings?.allow_financial_history && (
          <button
            onClick={() => setActiveTab('finances')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
              activeTab === 'finances' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider">Receipts</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
            activeTab === 'profile' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-wider">Profile</span>
        </button>
      </nav>

      {/* FULLSCREEN QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 text-center space-y-4 text-slate-900 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                {propertyName}
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-center">
              <QRCodeSVG
                value={memberNumber}
                size={220}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
                imageSettings={PERFECTION_QR_IMAGE_SETTINGS}
              />
            </div>

            <div className="space-y-0.5">
              <p className="font-mono font-black text-xl text-slate-900 tracking-wider">
                {memberNumber}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase">{account?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL WITH LIVE COMPLEXITY */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-slate-900 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase text-slate-900">Change Private Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Confirm Password
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* LIVE COMPLEXITY CHECKER */}
              <PasswordComplexityChecker password={newPassword} confirmPassword={confirmPassword} />

              <Button
                type="submit"
                disabled={!passValidation.isValid || passLoading}
                isLoading={passLoading}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider"
              >
                Update Password
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* SPA BOOKING REQUEST MODAL */}
      {showBookingRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-slate-900 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase text-slate-900">Request Spa Appointment</h3>
              <button
                onClick={() => setShowBookingRequestModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookingRequestSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Treatment / Service
                </label>
                <select
                  value={requestService}
                  onChange={(e) => setRequestService(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                >
                  <option>Swedish Massage (60 min)</option>
                  <option>Deep Tissue Massage (90 min)</option>
                  <option>Aromatherapy Spa (60 min)</option>
                  <option>Hot Stone Therapy (90 min)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={requestTime}
                    onChange={(e) => setRequestTime(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Special Notes / Therapist Preference
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Focus on shoulders..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                />
              </div>

              <Button
                type="submit"
                disabled={bookingSubmitting}
                isLoading={bookingSubmitting}
                className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider"
              >
                Submit Request
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
