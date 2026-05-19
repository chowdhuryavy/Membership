import React, { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const TopLoader = () => {
  const { pageLoading } = useSettings();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (pageLoading) {
      setProgress(10);
      // Simulate progress
      timeout = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.max(1, (90 - prev) / 10);
        });
      }, 300);
    } else {
      setProgress(100);
      timeout = setTimeout(() => {
        setProgress(0);
      }, 400); // Wait for transition before resetting
    }

    return () => {
      clearInterval(timeout);
      clearTimeout(timeout);
    };
  }, [pageLoading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[999999] h-1 bg-transparent overflow-hidden pointer-events-none">
      <div 
        className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      ></div>
    </div>
  );
};

export default TopLoader;
