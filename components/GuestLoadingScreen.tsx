import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface GuestLoadingScreenProps {
  propertyName?: string;
  logoUrl?: string | null;
  message?: string;
}

export const GuestLoadingScreen: React.FC<GuestLoadingScreenProps> = ({
  propertyName = 'Health Club & Spa',
  logoUrl,
  message = 'Loading your member privileges...'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white p-6 overflow-hidden select-none"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-xs text-center space-y-6">
        {/* Logo Container with Orbiting Rings */}
        <div className="relative flex items-center justify-center">
          {/* Animated Glow Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-4 rounded-full border border-indigo-400/20 border-t-amber-400/60"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-2 rounded-full border border-amber-400/20 border-b-indigo-400/60"
          />

          {/* Property Logo */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl p-4 flex items-center justify-center backdrop-blur-xl relative overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={propertyName}
                className="w-full h-full object-contain filter drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl text-white">
                <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Property & Portal Title */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-amber-300 text-[10px] font-black uppercase tracking-[0.25em]">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Member Portal
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            {propertyName}
          </h2>
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            {message}
          </p>
        </div>

        {/* Minimalist Progress Loader */}
        <div className="w-44 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-amber-400 to-indigo-500 rounded-full"
            animate={{
              x: ['-100%', '100%']
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            style={{ width: '60%' }}
          />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
          Powered by Perfection
        </p>
      </div>
    </motion.div>
  );
};
