import React, { useState } from 'react';
import { Fingerprint, Scan, ShieldCheck, X, Check } from 'lucide-react';
import { biometricAuth } from '../services/biometricAuth';
import toast from 'react-hot-toast';

interface BiometricEnableModalProps {
  type: 'guest' | 'staff';
  identifier: string; // Email or Employee Number
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}

export const BiometricEnableModal: React.FC<BiometricEnableModalProps> = ({
  type,
  identifier,
  name,
  isOpen,
  onClose,
  onEnabled,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !biometricAuth.isMobileDevice()) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await biometricAuth.registerBiometric(type, identifier, name);
      if (res.success) {
        toast.success(`Face ID / Fingerprint enabled for ${name}!`, {
          icon: '👤',
          duration: 4000,
        });
        if (onEnabled) onEnabled();
        onClose();
      } else {
        toast.error(res.error || 'Failed to enable biometric sign-in');
      }
    } catch (e: any) {
      toast.error('Could not activate biometric sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header Strip */}
        <div className="p-6 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-4 text-indigo-300 shadow-inner">
            {isIOS ? (
              <Scan className="w-9 h-9 text-amber-300 animate-pulse" />
            ) : (
              <Fingerprint className="w-9 h-9 text-amber-300 animate-pulse" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[9px] font-black uppercase tracking-widest mb-2">
            <ShieldCheck className="w-3 h-3 text-amber-300" />
            <span>Mobile Biometric Security</span>
          </div>

          <h3 className="text-xl font-black text-white tracking-tight leading-tight">
            Enable {isIOS ? 'Face ID / Touch ID' : 'Fingerprint Lock'}
          </h3>
          <p className="text-indigo-200/80 text-xs font-medium mt-1 leading-relaxed">
            Sign into your {type === 'guest' ? 'Guest Mobile Portal' : 'Staff Schedule'} instantly next time with 1 tap.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 bg-white">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Account Holder</span>
              <span className="font-black text-slate-800">{name}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-2">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">{type === 'guest' ? 'Registered Email' : 'Employee ID'}</span>
              <span className="font-mono font-bold text-indigo-600">{identifier}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 font-medium">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <p>Instant 1-second sign-in without re-typing passwords on your phone.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <p>Biometric data remains encrypted inside your phone's Secure Enclave.</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isIOS ? <Scan className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
                  <span>Enable {isIOS ? 'Face ID / Touch ID' : 'Fingerprint'}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
