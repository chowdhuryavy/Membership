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
import { detectDeviceOS } from '../services/pkpassService';
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
  Copy,
  Wallet,
  Building2
} from 'lucide-react';
import { Button } from '../components/ui';
import { format, parseISO } from 'date-fns';

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBookingRequestModal, setShowBookingRequestModal] = useState(false);

  // Specialist, Room, and Treatments cache for booking details
  const [therapistsList, setTherapistsList] = useState<any[]>([]);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [massageTypesList, setMassageTypesList] = useState<any[]>([]);

  // Multi-membership & Multi-facility support for the same guest
  const [userMemberships, setUserMemberships] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

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

  const deviceOS = detectDeviceOS();

  const handleDownloadAppleWallet = async () => {
    const toastId = toast.loading('Connecting to Apple Wallet API...');
    setTimeout(() => {
      toast.dismiss(toastId);
      alert(
        "Apple Wallet Integration Requires Backend\n\n" +
        "Native Apple Wallet (.pkpass) files MUST be cryptographically signed using an Apple Developer Certificate and Private Key.\n\n" +
        "Because this application runs entirely in the browser, it cannot safely hold or sign with your private certificates. To enable this in production, you must set up a backend (e.g., Node.js) that generates and signs the .pkpass file, then returns it to the app."
      );
    }, 800);
  };

  const handleDownloadGoogleWallet = async () => {
    const toastId = toast.loading('Connecting to Google Wallet API...');
    try {
      const fullLogoUrl = logoUrl ? (logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`) : '';
      const response = await fetch('/api/google-wallet/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member?.id || account?.member_id || account?.id,
          guestName: account?.name || member?.guest_name || 'Guest',
          membershipNumber: memberNumber,
          propertyName: propertyName,
          outletName: matchedOutlet?.name || 'HEALTH CLUB',
          logoUrl: fullLogoUrl,
          packageTier: member?.package_type || 'VIP Member',
          accessType: member?.access_type || 'Pool, Gym & Spa',
          validUntil: expiryDate,
          status: memberStatus
        })
      });

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        console.error('Non-JSON response from API:', textResponse);
        throw new Error(
          response.status === 404 
            ? 'API endpoint not found. If you are in the Shared App, please click the Share button again to redeploy the server backend.' 
            : `Server returned an invalid response (Status ${response.status}).`
        );
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate pass');
      }

      toast.success('Opening Google Wallet...', { id: toastId });
      window.open(data.url, '_blank');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to connect to Google Wallet.', { id: toastId, duration: 5000 });
    }
  };

  const handleAddToWallet = () => {
    if (deviceOS === 'ios') {
      handleDownloadAppleWallet();
    } else {
      handleDownloadGoogleWallet();
    }
  };

  const effectiveMember: Member = useMemo(() => {
    const activeM = userMemberships.find(m => m.id === selectedMemberId) || userMemberships[0] || member;
    if (activeM) return activeM;
    return ({
      id: account?.member_id || account?.id || 'guest-1',
      guest_name: account?.name || 'Valued Guest',
      membership_number: memberNumber,
      status: 'Active',
      access_type: 'Pool, Gym & Spa',
      package_type: 'VIP Member',
      outlet_id: account?.outlet_id || currentOutlet?.id,
      email: account?.email,
      phone: account?.phone,
      current_end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    } as unknown) as Member;
  }, [userMemberships, selectedMemberId, member, account, memberNumber, currentOutlet]);

  const matchedOutlet = useMemo(() => {
    const targetOutletId = effectiveMember?.outlet_id || member?.outlet_id || account?.outlet_id;
    return outletsList.find(o => o.id === targetOutletId) || outletsList[0];
  }, [outletsList, effectiveMember, member, account]);

  const matchedProperty = useMemo(() => {
    if (matchedOutlet?.property_id) {
      const p = propertiesList.find(prop => prop.id === matchedOutlet.property_id);
      if (p) return p;
    }
    if (effectiveMember?.property_id) {
      const p = propertiesList.find(prop => prop.id === effectiveMember.property_id);
      if (p) return p;
    }
    // Prefer genuine property over 'test' placeholder
    const realProp = propertiesList.find(p => p.name && !p.name.toLowerCase().includes('test'));
    return realProp || propertiesList[0];
  }, [propertiesList, matchedOutlet, effectiveMember]);

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
      const activeScopeId = session.outlet_id || session.property_id;
      const [ps, props, outlets, allMembers, allPtMembers, allPtSessions, allBookings, allConsents, allSales, therapistsData, roomsData, typesData] =
        await Promise.all([
          guestAuth.getPortalSettings(activeScopeId),
          db.getProperties().catch(() => []),
          db.getOutlets().catch(() => []),
          db.getMembers('').catch(() => []),
          db.getPTMembers('').catch(() => []),
          db.getPTSessions('').catch(() => []),
          db.getMassageBookings('').catch(() => []),
          db.getEntranceFeeConsents().catch(() => []),
          db.getSales('').catch(() => []),
          db.getTherapists().catch(() => []),
          db.getMassageRooms().catch(() => []),
          db.getMassageTypes().catch(() => [])
        ]);

      setPortalSettings(ps);
      setPropertiesList(props);
      setOutletsList(outlets);
      setTherapistsList(therapistsData || []);
      setRoomsList(roomsData || []);
      setMassageTypesList(typesData || []);

      const emailLower = session.email.toLowerCase();
      const phoneClean = (session.phone || '').replace(/\D/g, '');

      // Match all member records for this guest across all properties and facilities
      const matchedMembers = allMembers.filter((m: any) => {
        if (m.status === 'Cancelled' || m.status === 'Deleted') return false;
        if (m.email && m.email.toLowerCase() === emailLower) return true;
        if (phoneClean && m.phone && m.phone.replace(/\D/g, '') === phoneClean) return true;
        if (m.guest_name && m.guest_name.toLowerCase() === session.name.toLowerCase()) return true;
        return false;
      });

      // Sort newest created memberships first
      matchedMembers.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setUserMemberships(matchedMembers);

      const activeM = matchedMembers[0] || null;
      setMember(activeM);
      setSelectedMemberId((prev) => {
        if (prev && matchedMembers.some(m => m.id === prev)) return prev;
        return activeM ? activeM.id : '';
      });

      // Resolve true property and outlet names dynamically
      const primaryOutlet = outlets.find((o: any) => o.id === activeM?.outlet_id);
      const primaryProp = props.find((p: any) => p.id === primaryOutlet?.property_id) || props.find((p: any) => p.id === session.property_id);
      if (primaryProp) {
        if (primaryProp.name) setDynamicPropertyName(primaryProp.name);
        if (primaryProp.logo_url) setDynamicLogoUrl(primaryProp.logo_url);
      } else {
        const genuineProp = props.find((p: any) => p.name && !p.name.toLowerCase().includes('test'));
        if (genuineProp) {
          if (genuineProp.name) setDynamicPropertyName(genuineProp.name);
          if (genuineProp.logo_url) setDynamicLogoUrl(genuineProp.logo_url);
        }
      }

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

    // Listen for real-time booking confirmation and database updates
    const handleSync = () => {
      loadPortalData();
    };

    window.addEventListener('booking_updated', handleSync);
    return () => {
      window.removeEventListener('booking_updated', handleSync);
    };
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

      const [hours, minutes] = (requestTime || '14:00').split(':').map(Number);
      const endHour = (hours + 1) % 24;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;

      await db.addMassageBooking({
        outlet_id: mOutlet?.id || account.outlet_id || 'default',
        property_id: mProp?.id || account.property_id || '',
        guest_name: account.name || member?.guest_name || 'Guest',
        guest_email: account.email || member?.email || '',
        phone: account.phone || member?.phone || '',
        type_name: requestService,
        date: requestDate,
        start_time: requestTime,
        end_time: endTime,
        status: 'pending',
        notes: requestNotes,
        price: 0
      } as any);

      toast.success('Spa appointment request submitted! Awaiting front desk confirmation.');
      setShowBookingRequestModal(false);
      setRequestNotes('');

      await loadPortalData();
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

            {/* MULTI-FACILITY MEMBERSHIP SWITCHER (When guest has passes at multiple hotels/clubs) */}
            {userMemberships.length > 1 && (
              <div className="w-full max-w-[360px] mx-auto space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    Available Facilities ({userMemberships.length})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {userMemberships.map((m) => {
                    const o = outletsList.find(out => out.id === m.outlet_id);
                    const p = propertiesList.find(pr => pr.id === o?.property_id);
                    const isSelected = m.id === (selectedMemberId || userMemberships[0]?.id);
                    const hotelName = p?.name || 'Hotel';
                    const clubName = o?.name || 'Club';

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setMember(m);
                          if (p?.name) setDynamicPropertyName(p.name);
                          if (p?.logo_url) setDynamicLogoUrl(p.logo_url);
                          toast.success(`Active Pass: ${hotelName} (${clubName})`);
                        }}
                        className={`p-2.5 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/40 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span className={`text-[8px] font-black uppercase tracking-wider truncate block pr-2.5 ${
                          isSelected ? 'text-amber-300' : 'text-slate-400'
                        }`}>
                          {hotelName}
                        </span>
                        <span className={`text-xs font-black truncate block mt-0.5 ${
                          isSelected ? 'text-white' : 'text-slate-300'
                        }`}>
                          {clubName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 mt-1 block">
                          #{m.membership_number}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* QUICK ACTIONS BAR - ANIMATED PERFECTION - P PASS BUTTON */}
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2 pt-1">
              <button
                onClick={handleAddToWallet}
                className="group relative overflow-hidden flex-1 py-3 px-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 hover:from-slate-900 hover:to-indigo-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between gap-3 border border-amber-400/40 hover:border-amber-400 shadow-xl shadow-amber-500/10 hover:shadow-amber-500/25 transition-all duration-300 active:scale-[0.98]"
              >
                {/* Animated shimmer sweep overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity">
                  <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 animate-perfection-shimmer" />
                </div>

                <div className="flex items-center gap-3 relative z-10">
                  {/* Perfection (P) Animated Emblem */}
                  <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-amber-400/40 blur-[3px] animate-perfection-glow" />
                    <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 animate-perfection-ring" />
                    <div className="relative z-10 w-full h-full rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-yellow-100 p-[1.5px] shadow-md shadow-amber-500/30 flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                        <span className="text-amber-400 font-serif font-black text-xs tracking-tight select-none">
                          P
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-xs tracking-wider">
                        {deviceOS === 'ios' ? 'Add to Apple Wallet' : deviceOS === 'android' ? 'Add to Google Wallet' : 'Add to Perfection Pass'}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <span className="text-[9px] text-amber-300/80 font-bold tracking-normal block normal-case">
                      Perfection Official Digital Pass
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10 group-hover:border-amber-400/40 text-[10px] text-amber-300 font-black transition-all">
                  <span>ADD</span>
                  <ExternalLink className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <button
                onClick={handleCopyLink}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 shadow-md active:scale-95 shrink-0"
                title="Copy Pass Link to Clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Copy Link</span>
                <span className="sm:hidden">Copy Pass Link</span>
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
              bookings.map((b) => {
                const bStatus = (b.status || 'pending').toLowerCase();
                const matchedTherapist = therapistsList.find(t => t.id === b.therapist_id);
                const matchedRoom = roomsList.find(r => r.id === b.room_id);
                const matchedType = massageTypesList.find(t => t.id === b.massage_type_id);
                const specialistName = matchedTherapist?.name || (b as any).therapist_name;
                const roomName = matchedRoom?.name || (b as any).room_name;
                const serviceName = (b as any).type_name || matchedType?.name || (b.notes?.match(/\[Service: ([^\]]+)\]/i)?.[1]) || 'Wellness Therapy';

                return (
                  <div
                    key={b.id}
                    className={`bg-slate-900/90 border rounded-3xl p-5 space-y-3 transition-all ${
                      bStatus === 'pending'
                        ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : bStatus === 'confirmed'
                        ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                          {serviceName}
                        </span>
                        <h4 className="text-sm font-black text-white uppercase mt-0.5">
                          {b.date ? format(parseISO(b.date), 'EEEE, dd MMMM yyyy') : 'Scheduled Date'}
                        </h4>
                      </div>

                      {/* Dynamic Status Badge */}
                      {bStatus === 'pending' && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-400 animate-spin" /> Pending Confirmation
                        </span>
                      )}
                      {bStatus === 'confirmed' && (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Confirmed
                        </span>
                      )}
                      {bStatus === 'completed' && (
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-400" /> Completed
                        </span>
                      )}
                      {bStatus === 'cancelled' && (
                        <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase">
                          Cancelled
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>{b.start_time || '14:00'} - {b.end_time || '15:00'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <span>{specialistName || (bStatus === 'pending' ? 'To be assigned' : 'Specialist')}</span>
                      </div>
                      {roomName && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>{roomName}</span>
                        </div>
                      )}
                    </div>

                    {bStatus === 'pending' && (
                      <p className="text-[10px] text-amber-400/80 font-medium italic">
                        Front desk concierge will confirm your specialist &amp; room shortly.
                      </p>
                    )}
                  </div>
                );
              })
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

        {/* TAB 5: PROFILE, RECEIPTS & SECURITY */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Account &amp; Security
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Manage your profile, credentials, and billing records
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

            {/* BILLING & RECEIPTS SECTION (Inside Profile) */}
            {portalSettings?.allow_financial_history && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      Billing &amp; Receipts ({sales.length})
                    </h4>
                  </div>
                </div>

                {sales.length === 0 ? (
                  <div className="p-6 text-center bg-slate-900/50 rounded-2xl border border-white/5 space-y-1.5">
                    <Receipt className="w-6 h-6 text-slate-600 mx-auto" />
                    <h5 className="text-xs font-bold text-slate-400 uppercase">No Transactions</h5>
                    <p className="text-[10px] text-slate-500">Your purchases and payment receipts will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {sale.category || 'Service'}
                          </span>
                          <h5 className="text-xs font-black text-white uppercase">
                            {sale.item_name || 'Transaction'}
                          </h5>
                          <p className="text-[10px] text-slate-400">
                            {sale.created_at ? format(parseISO(sale.created_at), 'dd MMM yyyy') : ''} &bull; {sale.payment_method || 'Paid'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-emerald-400">
                            {formatMoney(sale.net_amount || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUPPORT CONTACT */}
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 text-center space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Front Desk Concierge &bull; {matchedOutlet?.name || matchedProperty?.name || propertyName}
              </p>
              <p className="text-xs font-bold text-indigo-400">
                {portalSettings?.support_phone || matchedOutlet?.phone || matchedProperty?.phone || settings?.phone || '+60 3-1234 5678'} &bull; {portalSettings?.support_email || matchedOutlet?.email || matchedProperty?.email || settings?.email || 'support@perfection.my'}
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

      {/* BOTTOM MOBILE NAVIGATION BAR WITH ANIMATED CENTER 'P' BUTTON */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 z-40 flex items-center justify-around shadow-2xl">
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

        {/* CENTER ELEVATED "P" PERFECTION DIGITAL PASS BUTTON */}
        <button
          onClick={() => setActiveTab('card')}
          className="relative -top-4 flex flex-col items-center group focus:outline-none transition-transform active:scale-95 z-20"
        >
          {/* Glowing Ambient Halo */}
          <div className={`absolute -inset-1.5 rounded-full blur-md transition-all duration-500 ${
            activeTab === 'card' 
              ? 'bg-amber-400/70 animate-pulse' 
              : 'bg-amber-500/30 group-hover:bg-amber-400/50'
          }`} />

          {/* Golden Pulse Ping Ring */}
          <div className="absolute inset-0 rounded-full border border-amber-400/60 animate-ping opacity-40 pointer-events-none" />

          {/* Golden Circle Emblem */}
          <div className={`relative w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 shadow-[0_0_20px_rgba(245,158,11,0.7)] transition-all duration-300 ${
            activeTab === 'card' 
              ? 'scale-110 shadow-[0_0_30px_rgba(245,158,11,1)] ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-900' 
              : 'group-hover:scale-105'
          }`}>
            <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-900 via-amber-950/80 to-black flex items-center justify-center border border-amber-400/50 relative overflow-hidden">
              {/* Shimmer light effect */}
              <div className="absolute -top-3 -left-3 w-7 h-7 bg-white/20 rounded-full blur-sm pointer-events-none animate-pulse" />
              
              {/* Iconic Golden 'P' with Animation */}
              <span className="font-serif font-black text-2xl text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-yellow-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none transform transition-transform group-hover:scale-110">
                P
              </span>
            </div>
          </div>

          <span className={`text-[10px] font-serif font-black uppercase tracking-widest mt-0.5 transition-colors ${
            activeTab === 'card' ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]' : 'text-slate-400 group-hover:text-amber-300'
          }`}>
            P
          </span>
        </button>

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
    </div>
  );
}
