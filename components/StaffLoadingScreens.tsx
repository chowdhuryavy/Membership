import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Activity, ShieldCheck, Database } from 'lucide-react';

interface LoadingScreenProps {
  styleId?: string;
  propertyName?: string;
  logoUrl?: string;
}

export const StaffLoadingScreens: React.FC<LoadingScreenProps> = ({ 
  styleId = 'monogram', 
  propertyName = 'Health Club Management',
  logoUrl 
}) => {

  const HolographicStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000510] overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#000510] to-[#000510]"></div>
      
      <div className="relative flex flex-col items-center">
        {/* Holographic Scanners */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <motion.div 
            animate={{ rotateZ: 360, scale: [1, 1.05, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-[1px] border-cyan-500/30 rounded-full"
            style={{ borderLeftColor: 'transparent', borderRightColor: 'transparent' }}
          />
          <motion.div 
            animate={{ rotateZ: -360, scale: [1, 1.1, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-[1px] border-indigo-500/40 rounded-full"
            style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent' }}
          />
          <motion.div 
            animate={{ rotateZ: 180, opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-10 border border-dashed border-cyan-400/20 rounded-full"
          />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
           <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
           <span className="text-[9px] font-black tracking-[0.3em] text-cyan-400 uppercase">Syncing</span>
          </div>
        </div>

        {/* Text Label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-12 text-center relative z-10"
        >
          <h2 className="text-xs font-black text-white uppercase tracking-[0.5em] mb-3">{propertyName}</h2>
          <div className="flex items-center justify-center gap-4 text-[9px] font-black text-cyan-500/70 tracking-widest uppercase">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure Auth</span>
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Fetching</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  const MinimalPulseStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white"
    >
      <div className="relative flex items-center justify-center w-32 h-32 mb-8">
        <motion.div
          animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 bg-indigo-100 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 2], opacity: [0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          className="absolute inset-0 bg-indigo-200 rounded-full"
        />
        <div className="relative z-10 w-16 h-16 bg-indigo-600 rounded-full shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
            {logoUrl ? (
                <img src={logoUrl} className="w-8 h-8 object-contain filter brightness-0 invert" alt="Logo" />
            ) : (
                <Sparkles className="w-6 h-6 text-white" />
            )}
        </div>
      </div>
      <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">{propertyName}</h2>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{logoUrl ? 'Loading Area' : 'Setting up workspace'}</p>
    </motion.div>
  );

  const MonogramStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900"
    >
      <div className="relative flex flex-col items-center">
        {/* Logo Container */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative w-48 h-48 flex items-center justify-center"
        >
          {/* Outer Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-dashed border-indigo-500/20 rounded-full"
          />
          
          {/* Inner Glow */}
          <div className="absolute inset-4 bg-indigo-500/5 rounded-full blur-2xl animate-pulse"></div>

          {/* Monogram */}
          <motion.svg 
            width="200" height="100" viewBox="0 0 160 100" 
            className="stroke-[4] fill-none stroke-linecap-round stroke-linejoin-round"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.3 } }
            }}
          >
            {/* H */}
            <motion.path 
              d="M 20 20 L 20 80 M 50 20 L 50 80 M 20 50 L 50 50"
              stroke="white"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
              }}
            />
            {/* C */}
            <motion.path 
              d="M 90 30 A 25 25 0 1 0 90 70"
              stroke="#6366f1"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
              }}
            />
            {/* M */}
            <motion.path 
              d="M 105 80 L 105 20 L 120 50 L 135 20 L 135 80"
              stroke="white"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
              }}
            />
          </motion.svg>
        </motion.div>

        {/* Text Label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-8 text-center"
        >
          <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">{propertyName}</h2>
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  duration: 1, 
                  repeat: Infinity, 
                  delay: i * 0.2 
                }}
                className="w-1 h-1 bg-indigo-500 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  switch (styleId) {
    case 'holographic': return <HolographicStyle />;
    case 'minimal-pulse': return <MinimalPulseStyle />;
    case 'monogram':
    default:
      return <MonogramStyle />;
  }
};
