import React, { useState, useEffect, useRef } from 'react';
import { 
  X, QrCode, CheckCircle2, AlertTriangle, LogIn, LogOut, 
  Sparkles, Lock, ArrowLeft, ShieldAlert, UserCheck, Clock, Building2, Store, RefreshCw
} from 'lucide-react';
import { Member } from '../types';
import { db } from '../services/mockSupabase';
import { checkInService } from '../services/checkInService';
import { parseScannedMemberCode } from '../utils/passToken';
import toast from 'react-hot-toast';

interface SelfKioskModeProps {
  outletName: string;
  outletId: string;
  propertyId?: string;
  logoUrl?: string;
  onExitKiosk: () => void;
}

export const SelfKioskMode: React.FC<SelfKioskModeProps> = ({
  outletName,
  outletId,
  propertyId,
  logoUrl,
  onExitKiosk
}) => {
  const [mode, setMode] = useState<'check_in' | 'check_out'>('check_in');
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    description: string;
    member?: Member;
  } | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // USB Barcode Wedge listener
  useEffect(() => {
    let buffer = '';
    let lastKey = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if PIN modal open
      if (showPinModal) return;

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }

      const now = Date.now();
      if (now - lastKey > 100) buffer = '';
      lastKey = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length > 2) {
          handleProcessCode(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, showPinModal, outletId]);

  // Start Camera Feed
  useEffect(() => {
    let active = true;
    async function initCam() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } catch (e) {
        console.warn('Kiosk camera feed unavailable:', e);
      }
    }
    initCam();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Process membership code or phone scan
  const handleProcessCode = async (codeStr: string) => {
    if (!codeStr || isProcessing) return;
    setIsProcessing(true);
    setResultMessage(null);

    try {
      // Find member by membership_number or phone or email or token/URL
      const allMembers = await db.getMembers(outletId);
      const matched = parseScannedMemberCode(codeStr, allMembers);

      if (!matched) {
        setResultMessage({
          type: 'error',
          title: 'Membership Not Found',
          description: `No active membership record matches "${codeStr}". Please check with reception desk.`
        });
        setIsProcessing(false);
        autoResetAfterDelay();
        return;
      }

      // Check Status
      if (matched.status === 'Expired') {
        setResultMessage({
          type: 'error',
          title: 'Membership Expired',
          description: `Dear ${matched.guest_name}, your membership expired on ${matched.current_end_date}. Please visit reception to renew.`,
          member: matched
        });
        setIsProcessing(false);
        autoResetAfterDelay();
        return;
      }

      if (matched.status === 'Frozen') {
        setResultMessage({
          type: 'warning',
          title: 'Membership Currently Frozen',
          description: `Dear ${matched.guest_name}, your membership is frozen. Please contact reception to reactivate access.`,
          member: matched
        });
        setIsProcessing(false);
        autoResetAfterDelay();
        return;
      }

      // Execute Check In or Check Out
      if (mode === 'check_in') {
        const res = await checkInService.checkInMember(
          matched,
          'self_kiosk_qr',
          'Self-Service Kiosk',
          'Kiosk Entry',
          outletId,
          propertyId
        );

        if (res.success) {
          setResultMessage({
            type: 'success',
            title: `Welcome, ${matched.guest_name}!`,
            description: `Check-in recorded successfully at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Enjoy your session!`,
            member: matched
          });
        } else {
          setResultMessage({
            type: 'warning',
            title: 'Already Checked In',
            description: res.message,
            member: matched
          });
        }
      } else {
        // Check out
        const res = await checkInService.checkOutByMemberId(matched.id);
        if (res.success) {
          setResultMessage({
            type: 'success',
            title: `Goodbye, ${matched.guest_name}!`,
            description: `Check-out recorded successfully. Have a great rest of your day!`,
            member: matched
          });
        } else {
          setResultMessage({
            type: 'warning',
            title: 'Check-Out Notice',
            description: res.message,
            member: matched
          });
        }
      }
    } catch (e) {
      console.error('Kiosk error:', e);
      setResultMessage({
        type: 'error',
        title: 'System Processing Error',
        description: 'Unable to process check-in right now. Please try again or seek reception assistance.'
      });
    } finally {
      setIsProcessing(false);
      setInputVal('');
      autoResetAfterDelay();
    }
  };

  const autoResetAfterDelay = () => {
    setTimeout(() => {
      setResultMessage(null);
    }, 6000);
  };

  const handleKeypadPress = (char: string) => {
    if (char === 'DEL') {
      setInputVal(prev => prev.slice(0, -1));
    } else if (char === 'CLEAR') {
      setInputVal('');
    } else {
      if (inputVal.length < 16) {
        setInputVal(prev => prev + char);
      }
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN: 1234
    if (pinInput === '1234' || pinInput === '0000') {
      onExitKiosk();
    } else {
      setPinError(true);
      toast.error('Incorrect Staff PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="h-24 px-8 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg p-1.5 border border-indigo-400/30">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Sparkles className="w-7 h-7 text-white" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">
              FACILITY ACCESS KIOSK
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
              {outletName}
            </h1>
          </div>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-2">
            <button
              onClick={() => {
                setMode('check_in');
                setResultMessage(null);
              }}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'check_in'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" /> Facility Entry
            </button>
            <button
              onClick={() => {
                setMode('check_out');
                setResultMessage(null);
              }}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'check_out'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" /> Facility Exit
            </button>
          </div>

          <button
            onClick={() => setShowPinModal(true)}
            className="p-3 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl border border-slate-700 transition-all"
            title="Exit Kiosk Mode"
          >
            <Lock className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 overflow-y-auto">
        {/* Left Column: Camera Scanner & Instructions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between flex-1 relative overflow-hidden shadow-2xl">
            {/* HUD Status Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">
                  SCANNER ACTIVE & READY
                </span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                MODE: {mode === 'check_in' ? 'ENTRY CHECK-IN' : 'EXIT CHECK-OUT'}
              </span>
            </div>

            {/* Video Viewfinder */}
            <div className="relative aspect-video w-full bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-700/80 shadow-2xl flex items-center justify-center">
              {cameraActive ? (
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <QrCode className="w-16 h-16 text-slate-700 mx-auto animate-pulse" />
                  <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto">
                    Hold digital wallet pass QR code or physical barcode facing the scanner.
                  </p>
                </div>
              )}

              {/* HUD Frame Overlay */}
              <div className="absolute inset-0 border-2 border-indigo-500/30 pointer-events-none flex items-center justify-center p-8">
                <div className="w-64 h-64 border-2 border-dashed border-indigo-400/80 rounded-3xl relative flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500"></div>
                  <div className="w-full h-1 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,1)] animate-bounce"></div>
                </div>
              </div>
            </div>

            {/* Guidance Banner */}
            <div className="mt-6 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
              <p className="text-sm font-black text-slate-300 uppercase tracking-wide">
                Scan your Apple Wallet / Google Wallet pass or physical member card
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Keypad Entry & Live Feedback */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Result Alert overlay if present */}
          {resultMessage ? (
            <div
              className={`p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col justify-between flex-1 ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                  : resultMessage.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
                  : 'bg-red-950/90 border-red-500/50 text-red-100'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {resultMessage.type === 'success' ? (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">
                      {resultMessage.title}
                    </h3>
                    {resultMessage.member && (
                      <span className="text-xs font-mono font-bold opacity-80 uppercase tracking-widest">
                        MEMBERSHIP #: {resultMessage.member.membership_number}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-base font-bold leading-relaxed pt-2 border-t border-white/10">
                  {resultMessage.description}
                </p>

                {resultMessage.member && (
                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest opacity-60 block">ACCESS</span>
                      <span className="font-black text-white">{resultMessage.member.access_type || 'Pool & Spa'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-widest opacity-60 block">VALIDITY</span>
                      <span className="font-black text-white">{resultMessage.member.current_end_date}</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setResultMessage(null)}
                className="mt-6 w-full py-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Scan Next Member
              </button>
            </div>
          ) : (
            /* Keypad Form */
            <div className="bg-slate-900/80 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between flex-1 shadow-2xl">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">
                  Or Type Membership # / Phone
                </h3>

                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={inputVal}
                    readOnly
                    placeholder="Enter Membership #"
                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-xl font-mono font-black text-white text-center focus:outline-none tracking-widest"
                  />
                </div>

                {/* On-screen Touch Keypad */}
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'DEL'].map((char) => (
                    <button
                      key={char}
                      onClick={() => handleKeypadPress(char)}
                      className={`py-4 rounded-2xl font-mono font-black text-lg transition-all active:scale-95 border ${
                        char === 'CLEAR' || char === 'DEL'
                          ? 'bg-slate-800/60 text-amber-400 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-950 text-white border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleProcessCode(inputVal)}
                disabled={!inputVal || isProcessing}
                className="mt-6 w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-[0.98]"
              >
                {isProcessing ? 'Verifying Membership...' : 'Submit Entry'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exit PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[2rem] p-8 text-center space-y-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black uppercase text-white">Staff PIN Required</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Enter PIN to exit Self-Service Kiosk mode (Default: 1234)
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="••••"
                className="w-full py-4 bg-slate-950 border border-slate-800 rounded-2xl text-center font-mono font-black text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {pinError && (
                <p className="text-xs text-red-400 font-bold">Invalid Staff PIN</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                  }}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase"
                >
                  Exit Kiosk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
