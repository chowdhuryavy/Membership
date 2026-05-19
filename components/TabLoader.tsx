import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface TabLoaderProps {
  message?: string;
}

const TabLoader: React.FC<TabLoaderProps> = ({ message = "Synchronizing Data..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-700">
      <div className="relative flex items-center justify-center">
        {/* Simplified professional spinner */}
        <motion.div 
          className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full shadow-sm"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Center dot */}
        <div className="absolute w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-indigo-600 rounded-full"
          />
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] leading-none">
            {message}
          </span>
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="w-1.5 h-1.5 bg-indigo-600 rounded-full"
          />
        </div>
        
        <div className="w-24 h-px bg-slate-100 relative overflow-hidden">
          <motion.div 
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-indigo-600/30"
          />
        </div>
      </div>
    </div>
  );
};

export default TabLoader;
