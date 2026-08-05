import React, { useState, useEffect } from 'react';
import { 
  X, Wallet, Download, Share2, Printer, CheckCircle2, AlertTriangle, 
  Smartphone, Shield, Calendar, QrCode, Sparkles, RefreshCw, Layers, Copy, Clock, ExternalLink,
  Building2, Store, MapPin, Phone, Mail, Award
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Member } from '../types';
import { checkInService } from '../services/checkInService';
import { generatePassToken, getPublicPassUrl } from '../utils/passToken';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';

interface DigitalMembershipCardModalProps {
  member: Member;
  outletName?: string;
  onClose: () => void;
}

export const DigitalMembershipCardModal: React.FC<DigitalMembershipCardModalProps> = ({
  member,
  outletName: propOutletName,
  onClose
}) => {
  const { currentProperty, currentOutlet, properties, outlets, settings } = useSettings();

  const matchedOutlet = outlets?.find(o => o.id === member.outlet_id) || currentOutlet || outlets?.[0];
  const matchedProperty = properties?.find(p => p.id === matchedOutlet?.property_id) || currentProperty || properties?.[0];

  const propertyName = matchedProperty?.name || currentProperty?.name || settings?.name || 'NOVA LUXURY RESORT & SPA';
  const displayOutletName = propOutletName || matchedOutlet?.name || currentOutlet?.name || 'MAIN HEALTH CLUB';
  const logoUrl = matchedOutlet?.logo_url || matchedProperty?.logo_url || currentProperty?.logo_url || settings?.logo_url || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=150&q=80';
  const propertyAddress = matchedProperty?.address || currentProperty?.address || '123 Health & Wellness Avenue';

  const [logoError, setLogoError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'scan_qr' | 'view_card'>('scan_qr');
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Token & 5-minute expiration countdown
  const [token, setToken] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300); // 5 minutes

  const generateNewToken = () => {
    const newToken = generatePassToken(member.id, member.membership_number);
    setToken(newToken);
    setRemainingSeconds(300); // 5 minutes
    toast.success('Generated fresh 5-minute camera QR access link!');
  };

  useEffect(() => {
    generateNewToken();
  }, [member.id]);

  // Timer countdown tick
  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Construct the camera-scannable mobile web URL
  const mobilePassUrl = getPublicPassUrl(token);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rSecs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobilePassUrl);
    toast.success('Mobile web pass link copied to clipboard!');
  };

  const handleOpenDirectly = () => {
    window.open(mobilePassUrl, '_blank');
  };

  const isExpired = member.status === 'Expired';
  const isFrozen = member.status === 'Frozen';
  const isActive = member.status === 'Active';

  const handleDownloadAppleWallet = () => {
    try {
      const passData = checkInService.generateAppleWalletPayload(member, displayOutletName);
      const jsonString = JSON.stringify(passData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AppleWalletPass_${member.membership_number || member.guest_name}.pkpass.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Apple Wallet Pass downloaded! Open in Apple Wallet or Passbook app.');
    } catch (e) {
      toast.error('Failed to generate Apple Wallet pass.');
    }
  };

  const handleDownloadGoogleWallet = () => {
    try {
      const passData = checkInService.generateGoogleWalletPayload(member, displayOutletName);
      const jsonString = JSON.stringify(passData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GoogleWalletPass_${member.membership_number || member.guest_name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Google Wallet Pass structure downloaded!');
    } catch (e) {
      toast.error('Failed to generate Google Wallet pass.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white leading-none">
                Digital Membership Pass
              </h3>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Mobile QR Access & Wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Main Tab Bar: Mobile Scan QR vs Pass Preview */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setActiveTab('scan_qr')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'scan_qr'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" /> Phone Access QR
              </button>
              <button
                onClick={() => setActiveTab('view_card')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'view_card'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Digital Card View
              </button>
            </div>
          </div>

          {activeTab === 'scan_qr' ? (
            /* PHONE CAMERA SCAN ACCESS VIEW */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Security Countdown Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
                remainingSeconds > 60 
                  ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200' 
                  : remainingSeconds > 0
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    remainingSeconds > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      SECURITY TIMED QR CODE
                    </span>
                    <span className="text-xs font-bold text-white">
                      {remainingSeconds > 0 ? 'Camera link valid for 5 minutes' : 'Link Expired! Please reset timer.'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    REMAINING
                  </span>
                  <span className="text-sm font-mono font-black text-amber-300">
                    {formatTime(remainingSeconds)}
                  </span>
                </div>
              </div>

              {/* REAL SCANNABLE QR CODE CONTAINER */}
              <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden text-white text-center">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-indigo-500 to-emerald-400"></div>

                {/* Property Branding Header */}
                <div className="flex items-center gap-3 mb-4">
                  {logoUrl && !logoError ? (
                    <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-slate-700 shadow-sm shrink-0">
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
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      {propertyName}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                      {displayOutletName}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 font-medium max-w-xs leading-relaxed mb-4">
                  Scan this QR code with your iPhone or Android camera to open your digital wallet pass on web!
                </p>

                {remainingSeconds > 0 ? (
                  <div className="p-4 bg-white rounded-3xl border-4 border-indigo-500/40 shadow-2xl flex items-center justify-center">
                    <QRCodeSVG
                      value={mobilePassUrl}
                      size={220}
                      level="M"
                      includeMargin={true}
                      fgColor="#000000"
                      bgColor="#FFFFFF"
                    />
                  </div>
                ) : (
                  <div className="w-[220px] h-[220px] bg-slate-800 rounded-3xl border border-rose-500/40 flex flex-col items-center justify-center p-4 text-center space-y-3">
                    <AlertTriangle className="w-10 h-10 text-rose-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      5-Min Security Token Expired
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 mt-5 pt-4 border-t border-slate-800 w-full">
                  <button
                    onClick={generateNewToken}
                    className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset 5-Min Timer
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-slate-700 active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Pass Link
                  </button>

                  <button
                    onClick={handleOpenDirectly}
                    className="px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Web Pass
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* DIGITAL CARD PREVIEW (Apple/Google Wallet Style) */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Card Toggle Front / Back */}
              <div className="flex justify-center">
                <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setActiveSide('front')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      activeSide === 'front'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Front Pass
                  </button>
                  <button
                    onClick={() => setActiveSide('back')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      activeSide === 'back'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" /> Terms & Info
                  </button>
                </div>
              </div>

              {/* CARD CONTAINER */}
              <div className="relative mx-auto w-full max-w-[360px] min-h-[480px] rounded-[2.2rem] bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 shadow-2xl border border-amber-500/30 flex flex-col justify-between overflow-hidden group">
                {/* Metallic Gold Accent Foil */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-400/20 via-indigo-500/10 to-transparent pointer-events-none"></div>

                {activeSide === 'front' ? (
                  <>
                    {/* Card Top Branding & Status */}
                    <div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                        <div className="flex items-center gap-2.5">
                          {logoUrl && !logoError ? (
                            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-white/20 shadow-sm shrink-0">
                              <img 
                                src={logoUrl} 
                                alt="Property Logo" 
                                onError={() => setLogoError(true)}
                                className="w-full h-full object-contain" 
                              />
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
                              {displayOutletName}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                              : isFrozen
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                              : 'bg-red-500/20 text-red-300 border-red-400/30'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      {/* Member Name & Details */}
                      <div className="mt-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-md border border-white/20 shrink-0">
                          {member.guest_name ? member.guest_name.slice(0, 2).toUpperCase() : 'ME'}
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                            MEMBER NAME
                          </span>
                          <h2 className="text-lg font-black uppercase tracking-tight text-white leading-none">
                            {member.guest_name}
                          </h2>
                          <span className="text-[10px] font-mono font-bold text-amber-300 block mt-1">
                            #{member.membership_number}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                            ACCESS PERMIT
                          </span>
                          <span className="text-xs font-black text-white truncate block">
                            {member.access_type || 'Pool, Gym & Spa'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                            PACKAGE TIER
                          </span>
                          <span className="text-xs font-black text-amber-300 truncate block">
                            {member.package_type || 'VIP Individual'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* REAL ENTRANCE SCANNER QR CODE */}
                    <div className="my-3 flex flex-col items-center justify-center">
                      <div className="p-3 bg-white rounded-2xl border-2 border-indigo-500/30 shadow-2xl flex items-center justify-center">
                        <QRCodeSVG
                          value={mobilePassUrl}
                          size={200}
                          level="M"
                          includeMargin={true}
                          fgColor="#000000"
                          bgColor="#FFFFFF"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-slate-300 uppercase tracking-widest">
                          Scan for Entrance Check-In
                        </span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                          VALID UNTIL
                        </span>
                        <span className="text-xs font-black text-slate-200">
                          {member.current_end_date || 'N/A'}
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
                        <li>This card is personal and strictly non-transferable.</li>
                        <li>Must be scanned at facility self-kiosk or turnstiles upon every entry.</li>
                        <li>Grants access to authorized facility zones according to membership package.</li>
                        <li>Report lost or damaged membership passes to reception immediately.</li>
                      </ul>
                    </div>

                    <div className="space-y-2 border-t border-white/10 pt-4">
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-amber-400" /> LOCATION & CONTACT
                      </h5>
                      <p className="text-[11px] text-slate-300 font-medium">
                        {propertyAddress}
                        <br />
                        Tel: +1 (800) 555-CLUB
                      </p>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                        PASS ID: {member.id}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WALLET INTEGRATION BUTTONS */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
              Add Digital Pass to Mobile Phone Wallet
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Apple Wallet Button */}
              <button
                onClick={handleDownloadAppleWallet}
                className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all border border-slate-800 shadow-md active:scale-[0.98]"
              >
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                  <AppleWalletIcon />
                </div>
                <span>Add to Apple Wallet</span>
              </button>

              {/* Google Wallet Button */}
              <button
                onClick={handleDownloadGoogleWallet}
                className="flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-300 shadow-md active:scale-[0.98]"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                  <GooglePayIcon />
                </div>
                <span>Add to Google Wallet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Pass
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md"
          >
            Done
          </button>
        </div>
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
