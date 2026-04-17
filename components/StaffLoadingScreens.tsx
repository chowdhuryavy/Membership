import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Activity, ShieldCheck, Database, Layout, Loader2, Cpu, Globe } from 'lucide-react';

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617] overflow-hidden"
    >
      {/* Dynamic Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>
      
      <div className="relative flex flex-col items-center">
        {/* Holographic Scanners */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          <motion.div 
            animate={{ rotateZ: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-[2px] border-cyan-500/20 rounded-full border-t-cyan-400"
          />
          <motion.div 
            animate={{ rotateZ: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-6 border-[2px] border-indigo-500/20 rounded-full border-b-indigo-400"
          />
          
          {/* Floating Data Points */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5],
                x: Math.cos(i * 45 * Math.PI / 180) * 140,
                y: Math.sin(i * 45 * Math.PI / 180) * 140,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
           <Cpu className="w-10 h-10 text-cyan-400 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
           <motion.div
             animate={{ opacity: [0.3, 1, 0.3] }}
             transition={{ duration: 1.5, repeat: Infinity }}
             className="flex flex-col items-center"
           >
             <span className="text-[10px] font-black tracking-[0.4em] text-cyan-400 uppercase">Neural Link</span>
             <span className="text-[7px] font-medium text-cyan-500/50 uppercase tracking-[0.2em] mt-1">Status: Stable</span>
           </motion.div>
          </div>
        </div>

        {/* Text Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center z-10"
        >
          <div className="px-6 py-2 bg-cyan-500/5 border border-cyan-500/20 rounded-full inline-block backdrop-blur-md">
            <h2 className="text-sm font-black text-white uppercase tracking-[0.6em] whitespace-nowrap">{propertyName}</h2>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-cyan-500/40" />
              <div className="w-8 h-[1px] bg-cyan-500/20"></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Database className="w-4 h-4 text-cyan-500/40" />
              <div className="w-8 h-[1px] bg-cyan-500/20"></div>
            </div>
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50"
    >
      <div className="relative flex items-center justify-center w-40 h-40 mb-12">
        <motion.div
          animate={{ scale: [1, 2.8], opacity: [0.15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 bg-indigo-600 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 2], opacity: [0.25, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1 }}
          className="absolute inset-0 bg-indigo-500 rounded-full"
        />
        <div className="relative z-10 w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-slate-100">
            {logoUrl ? (
                <img src={logoUrl} className="w-14 h-14 object-contain" alt="Logo" />
            ) : (
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
            )}
        </div>
      </div>
      <div className="text-center px-6">
        <motion.h2 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-lg font-black text-slate-900 uppercase tracking-[0.2em]"
        >
          {propertyName}
        </motion.h2>
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="h-1 w-1 bg-slate-300 rounded-full animate-bounce"></div>
          <div className="h-1 w-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
          <div className="h-1 w-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
        </div>
      </div>
    </motion.div>
  );

  const CyberGradientStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07011a]"
    >
      {/* Animated Animated Gradient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 100, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-indigo-600/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -45, 0],
            x: [0, -80, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-fuchsia-600/20 rounded-full blur-[120px]" 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-20 h-20 mb-10 relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-[2rem] border-2 border-indigo-500/30"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-[2.5rem] border border-fuchsia-500/20"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Layout className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl text-center">
          <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] min-w-[300px] mb-6">
            {propertyName.split('').map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                {char}
              </motion.span>
            ))}
          </h2>
          
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/3 h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const SolarSystemStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900"
    >
      <div className="relative flex items-center justify-center w-[400px] h-[400px]">
        {/* Orbital Paths */}
        <div className="absolute w-[300px] h-[300px] border border-white/5 rounded-full"></div>
        <div className="absolute w-[200px] h-[200px] border border-white/5 rounded-full"></div>
        
        {/* Planets */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute w-full h-full"
        >
          <div className="absolute top-1/2 left-[50px] w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
        </motion.div>
        
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          className="absolute w-full h-full"
        >
          <div className="absolute top-1/2 left-[100px] w-6 h-6 bg-rose-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.8)]"></div>
        </motion.div>

        {/* Central Sun/Logo */}
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10 w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)]"
        >
          {logoUrl ? (
            <img src={logoUrl} className="w-16 h-16 object-contain" alt="Logo" />
          ) : (
            <Globe className="w-10 h-10 text-indigo-600" />
          )}
        </motion.div>

        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-center">
            <h2 className="text-xs font-black text-white uppercase tracking-[0.8em]">{propertyName}</h2>
            <div className="mt-4 flex gap-1 justify-center">
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{ height: [4, 12, 4], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                        className="w-[2px] bg-indigo-400 rounded-full"
                    />
                ))}
            </div>
        </div>
      </div>
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

  const QuantumCircuitStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden"
    >
      {/* Background Circuit Pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 0 50 L 30 50 L 40 40 L 60 40 L 70 50 L 100 50" stroke="#4f46e5" fill="none" strokeWidth="0.5" />
          <path d="M 50 0 L 50 30 L 40 40 L 40 60 L 50 70 L 50 100" stroke="#4f46e5" fill="none" strokeWidth="0.5" />
          <circle cx="30" cy="50" r="1.5" fill="#4f46e5" />
          <circle cx="70" cy="50" r="1.5" fill="#4f46e5" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#circuit)" />
      </svg>

      <div className="relative flex flex-col items-center">
        <div className="w-64 h-64 relative flex items-center justify-center">
          {/* Central Cube */}
          <motion.div
            animate={{ 
              rotateX: [0, 360],
              rotateY: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-indigo-500 rounded-lg relative preserve-3d"
          >
            <div className="absolute inset-0 border border-indigo-400 opacity-50 translate-z-4"></div>
            <div className="absolute inset-0 border border-indigo-400 opacity-50 -translate-z-4"></div>
          </motion.div>

          {/* Orbiting Quantum Bits */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-indigo-500/10"
              style={{ rotateX: i * 60, rotateY: i * 30 }}
              animate={{ rotateZ: 360 }}
              transition={{ duration: 5 + i * 2, repeat: Infinity, ease: "linear" }}
            >
              <motion.div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
             <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-indigo-500"></div>
             <h2 className="text-sm font-black text-white uppercase tracking-[0.6em]">{propertyName}</h2>
             <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-indigo-500"></div>
          </div>
          <p className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Fetching encrypted logs
          </p>
        </motion.div>
      </div>
    </motion.div>
  );

  const LiquidMetalStyle = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 overflow-hidden"
    >
      <div className="relative flex items-center justify-center">
        {/* Liquid Blobs */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              scale: [1, 1.2, 0.8, 1],
              x: [0, (i % 2 === 0 ? 50 : -50), 0],
              y: [0, (i < 2 ? 50 : -50), 0],
              rotate: [0, 360],
              borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 70%", "60% 40% 30% 70% / 50% 60% 40% 60%", "40% 60% 70% 30% / 40% 50% 60% 70%"]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              delay: i * 0.5,
              ease: "easeInOut" 
            }}
            className="absolute w-64 h-64 bg-slate-200/5 mix-blend-overlay blur-3xl"
          />
        ))}

        <div className="relative flex flex-col items-center">
           <motion.div 
             animate={{ 
               filter: ["drop-shadow(0 0 5px #fff)", "drop-shadow(0 0 20px #6366f1)", "drop-shadow(0 0 5px #fff)"],
               scale: [1, 1.05, 1]
             }}
             transition={{ duration: 3, repeat: Infinity }}
             className="w-24 h-24 mb-10 bg-gradient-to-br from-white via-slate-400 to-slate-600 rounded-full p-0.5"
           >
             <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-white" />
             </div>
           </motion.div>

           <div className="text-center">
              <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em] mb-2">{propertyName}</h2>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Constructing Workspace</span>
                <motion.span 
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-1 h-1 bg-indigo-500 rounded-full"
                />
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );

  switch (styleId) {
    case 'holographic': return <HolographicStyle />;
    case 'minimal-pulse': return <MinimalPulseStyle />;
    case 'cyber-gradient': return <CyberGradientStyle />;
    case 'solar-system': return <SolarSystemStyle />;
    case 'quantum-circuit': return <QuantumCircuitStyle />;
    case 'liquid-metal': return <LiquidMetalStyle />;
    case 'monogram':
    default:
      return <MonogramStyle />;
  }
};

