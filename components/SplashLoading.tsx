import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Sparkles } from 'lucide-react';

const SplashLoading = () => {
  const { settings } = useSettings();
  
  return (
    <div className="fixed inset-0 z-[100000] bg-white flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.03)_0%,_transparent_50%)] animate-[pulse_6s_ease-in-out_infinite]"></div>
        <div className="absolute inset-0 opacity-[0.01]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1.5px, transparent 1.5px)', backgroundSize: '50px 50px' }}></div>
      </div>

      <div className="relative flex flex-col items-center justify-center">
        <div className="relative w-80 h-80 flex items-center justify-center">
          <div className="absolute inset-0 border-[0.5px] border-indigo-500/10 rounded-full animate-[radiate_4s_linear_infinite]"></div>
          <div className="absolute inset-10 border-[0.5px] border-indigo-400/20 rounded-full animate-[radiate_4s_linear_infinite_1.3s]"></div>
          <div className="absolute inset-20 border-[0.5px] border-indigo-300/30 rounded-full animate-[radiate_4s_linear_infinite_2.6s]"></div>
          
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite]">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full blur-[2px]"></div>
          </div>
          <div className="absolute inset-4 animate-[spin_8s_linear_infinite_reverse]">
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full opacity-50"></div>
          </div>

          <div className="relative z-10 w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-600/5 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-full h-full flex items-center justify-center">
              {settings?.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(79,70,229,0.2)] animate-[spin_8s_linear_infinite]" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
              ) : null}
              
              <div 
                className={`logo-fallback bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100 ${settings?.logo_url ? 'hidden' : 'flex'}`}
              >
                <Sparkles className="w-12 h-12 animate-[spin_8s_linear_infinite]" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 opacity-0 animate-[fade-in_1.5s_ease-out_forwards_0.5s]">
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-[pulse_1s_infinite]"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-[pulse_1s_infinite_0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-[pulse_1s_infinite_0.4s]"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SplashLoading;