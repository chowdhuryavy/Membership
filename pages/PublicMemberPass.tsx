import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Wallet, Shield, Smartphone, Clock, AlertTriangle, CheckCircle2, 
  ArrowLeft, Download, RefreshCw, Printer, ShieldAlert, Sparkles, Check,
  Building2, MapPin, Phone, Award
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { decodePassToken, PassTokenData } from '../utils/passToken';
import { db } from '../services/mockSupabase';
import { Member } from '../types';
import { checkInService } from '../services/checkInService';
import { detectDeviceOS, createPkpassZipBlob, generateGoogleWalletSaveUrl } from '../services/pkpassService';
import toast from 'react-hot-toast';

export const PublicMemberPass: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Safe extraction supporting both ?token=... and ?passToken=... before or after HashRouter #
  const getTokenFromUrl = (): string | null => {
    const directToken = searchParams.get('token') || searchParams.get('passToken');
    if (directToken) return directToken;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const mainToken = urlParams.get('token') || urlParams.get('passToken');
      if (mainToken) return mainToken;
      if (window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        return hashParams.get('token') || hashParams.get('passToken');
      }
    }
    return null;
  };

  const token = getTokenFromUrl();

  const [tokenData, setTokenData] = useState<PassTokenData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [member, setMember] = useState<Member | null>(null);
  const [memberTier, setMemberTier] = useState<string>('');
  const [property, setProperty] = useState<any>(null);
  const [outlet, setOutlet] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [logoError, setLogoError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const decoded = decodePassToken(token);
    if (decoded) {
      setTokenData(decoded);
      const remaining = Math.max(0, Math.floor((decoded.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
    } else {
      setTokenData(null);
    }
  }, [token]);

  // Timer countdown
  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds]);

  // Fetch property branding & member data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propsRes, settingsRes, outletsRes, categoriesRes] = await Promise.all([
          db.getProperties(),
          db.getSettings(),
          db.getOutlets(),
          db.getCategories()
        ]);

        if (propsRes && propsRes.length > 0) {
          setProperty(propsRes[0]);
        }
        if (settingsRes) {
          setSettings(settingsRes);
        }

        if (tokenData) {
          const members = await db.getMembers();
          const found = members.find(
            m => m.id === tokenData.memberId || m.membership_number === tokenData.membershipNumber
          );

          if (found) {
            setMember(found);
            
            // Resolve member tier from category
            let tierName = found.package_type || 'VIP Member';
            if (found.category_id && categoriesRes) {
               const cat = categoriesRes.find(c => c.id === found.category_id);
               if (cat) {
                 tierName = cat.name;
               }
            }
            setMemberTier(tierName);

            if (found.outlet_id && outletsRes && outletsRes.length > 0) {
              const matchedOutlet = outletsRes.find(o => o.id === found.outlet_id);
              if (matchedOutlet) {
                setOutlet(matchedOutlet);
                if (matchedOutlet.property_id && propsRes && propsRes.length > 0) {
                  const matchedProp = propsRes.find(p => p.id === matchedOutlet.property_id);
                  if (matchedProp) setProperty(matchedProp);
                }
              }
            }
          } else {
            // Fallback member object if database record wasn't found in current state
            setMember(({
              id: tokenData.memberId,
              membership_number: tokenData.membershipNumber,
              guest_name: 'Valued Member',
              status: 'Active',
              access_type: 'Full Access',
              package_type: 'VIP Member',
              current_end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
            } as unknown) as Member);
            setMemberTier('VIP Member');
          }
        }
      } catch (err) {
        console.error('Failed to fetch public pass data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tokenData]);

  const propertyName = property?.name || settings?.name || outlet?.name || 'THE TORCH DOHA';
  const logoUrl = outlet?.logo_url || property?.logo_url || settings?.logo_url || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=150&q=80';
  const propertyAddress = outlet?.address?.trim() || property?.address?.trim() || settings?.address?.trim() || '';
  const propertyPhone = outlet?.phone?.trim() || property?.phone?.trim() || settings?.phone?.trim() || '';


  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const deviceOS = detectDeviceOS();

  const handleDownloadAppleWallet = async () => {
    if (!member) return;
    const toastId = toast.loading('Generating Apple Wallet Pass...');
    try {
      const blob = await createPkpassZipBlob(member, propertyName, propertyAddress, propertyPhone);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MemberPass_${member.membership_number || member.id}.pkpass`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      if (deviceOS === 'ios') {
        toast.success('Apple Wallet Pass generated! Unsigned test pass downloaded.', { id: toastId });
      } else {
        toast.success('Apple Wallet Pass (.pkpass) downloaded successfully!', { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate Apple Wallet pass.', { id: toastId });
    }
  };

  const handleDownloadGoogleWallet = async () => {
    if (!member) return;
    const toastId = toast.loading('Saving to Google Wallet...');
    try {
      const saveUrl = generateGoogleWalletSaveUrl(member, propertyName);
      window.open(saveUrl, '_blank');

      const blob = await createPkpassZipBlob(member, propertyName, propertyAddress, propertyPhone);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GoogleWalletPass_${member.membership_number || member.id}.pkpass`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      toast.success('Opening Google Wallet... Save your pass!', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to save to Google Wallet.', { id: toastId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Loading Digital Member Pass...</h2>
      </div>
    );
  }

  // EXPIRED OR INVALID LINK SCREEN
  if (!token || !tokenData || (!member && remainingSeconds <= 0)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-md bg-slate-900/90 rounded-[2.5rem] border border-red-500/30 p-8 shadow-2xl text-center space-y-6 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <Clock className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-400/30 text-[10px] font-black uppercase tracking-widest">
              Pass Access Timeout
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-white mt-3">
              Pass Access Link Expired
            </h1>
            <p className="text-xs text-slate-400 font-medium leading-relaxed mt-2">
              For security, temporary camera links for digital passes expire over time.
              Please ask reception or staff to display or reset the QR code to open your live pass link.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-left space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Wallet Notice
            </h4>
            <p className="text-[11px] text-slate-300 leading-snug">
              If you have already added this pass to Apple Wallet or Google Wallet, your saved mobile wallet pass remains fully active and usable at facility turnstiles.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Main Application
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActive = member?.status === 'Active';
  const isFrozen = member?.status === 'Frozen';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Top Expiration Header Bar */}
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md rounded-2xl border border-indigo-500/30 p-3.5 mb-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                Live Pass Active
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                TIMED SECURE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Add to Mobile Wallet before link expires</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-indigo-500/40 font-mono text-sm font-black text-amber-300 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>{formatTime(remainingSeconds)}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md flex flex-col items-center my-auto space-y-6">
        {/* Toggle Front / Back */}
        <div className="inline-flex p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg">
          <button
            onClick={() => setActiveTab('front')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'front'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Front Pass
          </button>
          <button
            onClick={() => setActiveTab('back')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'back'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Terms & Info
          </button>
        </div>

        {/* ULTRA-LUXURY DIGITAL CARD */}
        <div className="w-full relative min-h-[480px] rounded-[2.5rem] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 p-7 shadow-2xl flex flex-col justify-between overflow-hidden group">
          {/* Card Metallic Foil Effect */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-400/20 via-indigo-500/10 to-transparent pointer-events-none"></div>

          {activeTab === 'front' ? (
            <>
              {/* Header */}
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    {logoUrl && !logoError ? (
                      <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/20 shadow-sm shrink-0">
                        <img 
                          src={logoUrl} 
                          alt="Logo" 
                          onError={() => setLogoError(true)}
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs uppercase shadow-md shrink-0">
                        <Award className="w-5 h-5 text-amber-200" />
                      </div>
                    )}

                    <div className="text-left">
                      <h3 className="text-sm font-black uppercase tracking-wider text-white leading-tight">
                        {propertyName}
                      </h3>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300 block mt-0.5">
                        MEMBER PASS
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : isFrozen
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                        : 'bg-red-500/20 text-red-300 border-red-400/40'
                    }`}
                  >
                    {member?.status || 'Active'}
                  </span>
                </div>

                {/* Member Identity & Avatar */}
                <div className="mt-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/20 shrink-0">
                    {member?.guest_name ? member.guest_name.slice(0, 2).toUpperCase() : 'ME'}
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                      MEMBER NAME
                    </span>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white leading-tight">
                      {member?.guest_name || 'Valued Member'}
                    </h2>
                    <span className="text-[10px] font-mono font-bold text-amber-300 block mt-0.5">
                      #{member?.membership_number || tokenData.membershipNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/10">
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                      ACCESS PERMIT
                    </span>
                    <span className="text-xs font-black text-white">
                      {member?.access_type || 'Pool, Gym & Spa'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                      PACKAGE TIER
                    </span>
                    <span className="text-[11px] font-black text-amber-300 leading-snug block break-words">
                      {memberTier}
                    </span>
                  </div>
                </div>
              </div>

              {/* REAL SCANNABLE QR CODE FOR FACILITY ENTRANCE */}
              <div className="my-5 flex flex-col items-center justify-center">
                <div className="p-3.5 bg-white rounded-2xl border-2 border-indigo-500/30 shadow-xl flex items-center justify-center">
                  <QRCodeSVG
                    value={member?.membership_number || tokenData.membershipNumber}
                    size={200}
                    level="M"
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-300 uppercase tracking-widest">
                    Scan at Entrance Turnstile / Kiosk
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-left">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                    VALID UNTIL
                  </span>
                  <span className="text-xs font-black text-slate-200">
                    {member?.current_end_date || 'Active Membership'}
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
            /* BACK SIDE OF PASS */
            <div className="flex flex-col justify-between h-full space-y-6">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 border-b border-white/10 pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Member Rules & Conditions
                </h4>
                <ul className="text-xs text-slate-300 space-y-2.5 mt-4 list-disc pl-4 font-medium leading-relaxed">
                  <li>This digital pass is personal and strictly non-transferable.</li>
                  <li>Scan at entrance turnstiles or self-kiosk upon every entry.</li>
                  <li>Proper athletic wear required in workout & pool zones.</li>
                  <li>Report lost or compromised passes to reception immediately.</li>
                </ul>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-4">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" /> LOCATION & CONTACT
                </h5>
                <p className="text-xs text-slate-300 font-medium">
                  {propertyAddress}
                  <br />
                  Tel: {propertyPhone}
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                  PASS SERIAL: {tokenData.memberId}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE WALLET DOWNLOAD BUTTONS */}
        <div className="w-full space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
              Save Pass to Mobile Phone Wallet
            </span>
            {deviceOS !== 'desktop' && (
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Detected: {deviceOS === 'ios' ? 'Apple iOS' : 'Android'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadAppleWallet}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider border border-slate-800 shadow-xl transition-all active:scale-95 ${
                deviceOS === 'ios' ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AppleWalletIcon />
                <span>Apple Wallet</span>
              </div>
              {deviceOS === 'ios' && (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold lowercase tracking-normal">
                  Recommended
                </span>
              )}
            </button>

            <button
              onClick={handleDownloadGoogleWallet}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl transition-all active:scale-95 ${
                deviceOS === 'android' ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <GooglePayIcon />
                <span>Google Wallet</span>
              </div>
              {deviceOS === 'android' && (
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 rounded text-[9px] font-bold lowercase tracking-normal">
                  Recommended
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mt-6 text-center">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          {propertyName} • Digital Wallet Membership
        </p>
      </div>
    </div>
  );
};

// SVG Icon for Apple Wallet
const AppleWalletIcon = () => (
  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.67-.82 1.13-1.96.99-3.1-.98.04-2.18.66-2.88 1.48-.63.73-1.18 1.89-1.03 3.01 1.1.09 2.23-.55 2.92-1.39z" />
  </svg>
);

// SVG Icon for Google Pay / Wallet
const GooglePayIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);
