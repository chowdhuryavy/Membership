import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface TabLoaderProps {
  message?: string;
}

const TabLoader: React.FC<TabLoaderProps> = ({ message = "Synchronizing Data..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
      <div className="relative">
        {/* Animated outer ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-indigo-200/50"
        />
        
        {/* Inner glass icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 bg-white/40 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-center border border-white/50 relative overflow-hidden group"
          >
            {/* Shimmer effect inside the glass */}
            <motion.div 
              animate={{ x: ['100%', '-100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-20"
            />
            
            <Sparkles className="w-8 h-8 text-indigo-600 relative z-10 animate-pulse" />
          </motion.div>
        </div>
        
        {/* Floating particles */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              y: [-10, 10, -10],
              x: [-10, 10, -10],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 2 + i, 
              repeat: Infinity, 
              delay: i * 0.5,
              ease: "easeInOut" 
            }}
            className="absolute w-1 h-1 bg-indigo-400 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-2">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] animate-pulse">
          {message}
        </span>
        <div className="w-12 h-0.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-full h-full bg-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default TabLoader;
