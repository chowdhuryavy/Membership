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
import { DigitalMembershipCardModal } from '../components/DigitalMembershipCardModal';
import {
  PasswordComplexityChecker,
  validatePasswordComplexity
} from '../components/PasswordComplexityChecker';
import { QRCodeSVG } from 'qrcode.react';
import { PERFECTION_QR_IMAGE_SETTINGS } from '../lib/perfectionLogo';
import { generatePassToken, getPublicPassUrl } from '../utils/passToken';
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
  FileText,
  Smartphone,
  Shield,
  Award,
  AlertTriangle,
  Copy
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

  // Pass & Wallet State
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [token, setToken] = useState<string>('');
  const [propertiesList, setPropertiesList] = useState<any[]>([]);
  const [outletsList, setOutletsList] = useState<any[]>([]);

  // Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDigitalCardModal, setShowDigitalCardModal] = useState(false);
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

  const memberNumber = member?.membership_number || account?.member_id || `G-${account?.id?.slice(-6).toUpperCase() || '000000'}`;
  const memberStatus = member?.status || 'Active';
  const expiryDate = member?.current_end_date ? format(parseISO(member.current_end_date), 'dd MMM yyyy') : 'No Expiry';

  const generateNewToken = () => {
    const mId = member?.id || account?.member_id || 'guest';
    const mNum = member?.membership_number || memberNumber;
    const gName = account?.name || member?.guest_name || 'Guest';
    const newToken = generatePassToken(mId, mNum, gName);
    setToken(newToken);
  };

  useEffect(() => {
    generateNewToken();
  }, [member?.id, account?.member_id]);

  const mobilePassUrl = getPublicPassUrl(token);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobilePassUrl);
    toast.success('Pass link copied to clipboard!');
  };

  const matchedOutlet = outletsList.find(o => o.id === (member?.outlet_id || account?.outlet_id)) || outletsList[0];
  const matchedProperty = propertiesList.find(p => p.id === matchedOutlet?.property_id) || propertiesList[0];

  const effectiveMember: Member = useMemo(() => {
    if (member) return member;
    return ({
      id: account?.member_id || account?.id || 'guest-1',
      guest_name: account?.name || 'Valued Guest',
      membership_number: memberNumber,
      status: 'Active',
      access_type: 'Pool, Gym & Spa',
      package_type: 'VIP Member',
      outlet_id: account?.outlet_id || currentOutlet?.id || matchedOutlet?.id,
      email: account?.email,
      phone: account?.phone,
      current_end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    } as unknown) as Member;
  }, [member, account, memberNumber, currentOutlet, matchedOutlet]);

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
      const [ps, props, outlets, allMembers, allPtMembers, allPtSessions, allBookings, allConsents, allSales] =
        await Promise.all([
          guestAuth.getPortalSettings(),
          db.getProperties().catch(() => []),
          db.getOutlets().catch(() => []),
          db.getMembers(session.outlet_id || 'all').catch(() => []),
          db.getPTMembers(session.outlet_id || 'all').catch(() => []),
          db.getPTSessions(session.outlet_id || 'all').catch(() => []),
          db.getMassageBookings(session.outlet_id || '').catch(() => []),
          db.getEntranceFeeConsents().catch(() => []),
          db.getSales(session.outlet_id || '').catch(() => [])
        ]);

      setPortalSettings(ps);
      setPropertiesList(props);
      setOutletsList(outlets);

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

      // Smooth loading transition so property logo and animation are clearly seen
      await new Promise(r => setTimeout(r, 1200));
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
      const mOutlet = outletsList.find(o => o.id === (account.outlet_id || member?.outlet_id)) || outletsList[0];
      const mProp = propertiesList.find(p => p.id === mOutlet?.property_id) || propertiesList[0];

      await db.addMassageBooking({
        outlet_id: mOutlet?.id || account.outlet_id || 'default',
        property_id: mProp?.id || account.property_id || '',
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
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Card Toggle Front / Back */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 bg-slate-900/80 rounded-2xl border border-white/10">
                <button
                  onClick={() => setActiveSide('front')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeSide === 'front'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Front Pass
                </button>
                <button
                  onClick={() => setActiveSide('back')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeSide === 'back'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" /> Terms & Info
                </button>
              </div>
            </div>

            {/* CARD CONTAINER (Apple/Google Wallet Style) */}
            <div className="relative mx-auto w-full max-w-[360px] min-h-[480px] rounded-[2.2rem] bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 shadow-2xl border border-amber-500/30 flex flex-col justify-between overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-400/20 via-indigo-500/10 to-transparent pointer-events-none"></div>

              {activeSide === 'front' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        {logoUrl ? (
                          <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/25 shadow-sm shrink-0">
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs uppercase shadow-md shrink-0">
                            <Award className="w-5 h-5 text-amber-200" />
                          </div>
                        )}
                        <div className="text-left">
                          <h4 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                            {propertyName}
                          </h4>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300 block">
                            {matchedOutlet?.name || 'HEALTH CLUB'}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                        {memberStatus}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-md border border-white/20 shrink-0">
                        {account?.name ? account.name.slice(0, 2).toUpperCase() : 'GE'}
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                          GUEST MEMBER NAME
                        </span>
                        <h2 className="text-lg font-black uppercase tracking-tight text-white leading-none">
                          {account?.name}
                        </h2>
                        <span className="text-[10px] font-mono font-bold text-amber-300 block mt-1">
                          #{memberNumber}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                          ACCESS PERMIT
                        </span>
                        <span className="text-xs font-black text-white truncate block">
                          {member?.access_type || 'Pool, Gym & Spa'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                          PACKAGE TIER
                        </span>
                        <span className="text-[11px] font-black text-amber-300 leading-snug block break-words">
                          {member?.package_type || 'VIP Member'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR CODE */}
                  <div className="my-4 flex flex-col items-center justify-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-indigo-500/30 shadow-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.02] active:scale-95" onClick={() => setShowQrModal(true)}>
                      <QRCodeSVG
                        value={mobilePassUrl}
                        size={190}
                        level="H"
                        includeMargin={true}
                        fgColor="#000000"
                        bgColor="#FFFFFF"
                        imageSettings={PERFECTION_QR_IMAGE_SETTINGS}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold">
                        Tap QR to Enlarge for Turnstile
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                        VALID UNTIL
                      </span>
                      <span className="text-xs font-black text-slate-200">
                        {expiryDate}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                        AUTHENTICITY
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        VERIFIED ✓
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* BACK OF PASS */
                <div className="flex flex-col justify-between h-full space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                      {logoUrl && <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" />}
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                        {propertyName} Rules & Info
                      </h4>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-2 list-disc pl-4 font-medium">
                      <li>This digital membership card is personal and non-transferable.</li>
                      <li>Must be scanned at facility self-kiosk or turnstiles upon every entry.</li>
                      <li>Grants access to authorized facility zones according to membership package.</li>
                      <li>Report lost or damaged accounts to reception immediately.</li>
                    </ul>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-amber-400" /> LOCATION & CONTACT
                    </h5>
                    <p className="text-[11px] text-slate-300 font-medium">
                      {matchedOutlet?.address || matchedProperty?.address || settings?.address || 'Main Club Headquarters'}
                      <br />
                      Tel: {matchedOutlet?.phone || matchedProperty?.phone || settings?.phone || '+60 3-0000 0000'}
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Authorized Guest Account</p>
                    <p className="text-xs font-mono font-black text-amber-300">{memberNumber}</p>
                  </div>
                </div>
              )}
            </div>

            {/* QUICK ACTIONS BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setShowDigitalCardModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Smartphone className="w-3.5 h-3.5" /> Launch Digital Card Modal
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 shadow-md active:scale-95"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" /> Copy Pass Link
              </button>
            </div>

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
                value={mobilePassUrl}
                size={220}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
                imageSettings={PERFECTION_QR_IMAGE_SETTINGS}
              />
            </div>

            <div className="text-center space-y-1 pt-1">
              <p className="font-mono font-black text-xl text-slate-900 tracking-wider leading-none">
                {memberNumber}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase">{account?.name}</p>
              <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200 mt-1">
                Verified Digital Pass
              </span>
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

      {/* OFFICIAL DIGITAL MEMBERSHIP CARD MODAL (SAME AS ADMIN PORTAL) */}
      {showDigitalCardModal && (
        <DigitalMembershipCardModal
          member={effectiveMember}
          outletName={matchedOutlet?.name}
          onClose={() => setShowDigitalCardModal(false)}
        />
      )}
    </div>
  );
}
