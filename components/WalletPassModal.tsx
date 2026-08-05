import React, { useState } from 'react';
import { 
  X, Smartphone, Share2, Download, ExternalLink, Copy, Check, Info, ShieldAlert, Sparkles, HelpCircle 
} from 'lucide-react';
import { Member } from '../types';
import toast from 'react-hot-toast';

interface WalletPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletType: 'apple' | 'google';
  member: Member;
  propertyName: string;
  passUrl: string;
  onDownloadPkpass: () => void;
}

export const WalletPassModal: React.FC<WalletPassModalProps> = ({
  isOpen,
  onClose,
  walletType,
  member,
  propertyName,
  passUrl,
  onDownloadPkpass,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(passUrl);
    setCopied(true);
    toast.success('Pass URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isApple = walletType === 'apple';

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
              isApple ? 'bg-white text-slate-900' : 'bg-blue-500 text-white'
            }`}>
              {isApple ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.67-.82 1.13-1.96.99-3.1-.98.04-2.18.66-2.88 1.48-.63.73-1.18 1.89-1.03 3.01 1.1.09 2.23-.55 2.92-1.39z" />
                </svg>
              ) : (
                <Smartphone className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                {isApple ? 'Apple Wallet Setup Guide' : 'Google Wallet Setup Guide'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {propertyName} • Member #{member.membership_number || member.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* OPTION 1: HOME SCREEN APP PASS */}
          <div className="p-5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Recommended Method
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                Option 1: Add Live Digital Pass to Home Screen
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Save this digital membership card directly as an app icon on your phone’s home screen. Works 100% instantly on iOS & Android without requiring developer certificates!
              </p>
            </div>

            {/* Steps */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Open the <strong>Mobile Pass Page</strong> in Safari (iPhone) or Chrome (Android).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Tap the <strong>Share</strong> button <Share2 className="w-3 h-3 inline text-indigo-400" /> (bottom menu in Safari) or Menu (⋮ in Chrome).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Select <strong>"Add to Home Screen"</strong> and tap <strong>Add</strong>.</span>
              </div>
            </div>

            {/* Action Buttons for Option 1 */}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={passUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[140px] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Pass Page
              </a>
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* OPTION 2: DOWNLOAD .PKPASS */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              Option 2: Download `.pkpass` / `.json` File
            </h4>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Export the raw pass bundle file containing pass attributes, colors, and scanner barcodes.
            </p>

            {/* Important Explanation Notice regarding iOS Passbook Error */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-xs text-amber-200/90">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Why does Apple Wallet say "Cannot be installed"?</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-normal pl-5">
                Apple Wallet strictly requires `.pkpass` files to be cryptographically signed by an official Apple Developer Pass Type Certificate. Downloaded unsigned files cannot be added to native Wallet directly by iOS. You can import this file into apps like <strong>Pass2U Wallet</strong> on iOS, or use <strong>Option 1</strong> above for zero-setup access.
              </p>
            </div>

            <button
              onClick={() => {
                onDownloadPkpass();
                toast.success('Downloaded pass file! Use Option 1 or Pass2U Wallet app.');
              }}
              className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-700 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Download .pkpass File
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
};
