import React, { useEffect, useState } from 'react';
import Reports, { AutoDispatchConfig } from '../pages/Reports';

export const HeadlessReportDispatcher = () => {
  const [activeTask, setActiveTask] = useState<AutoDispatchConfig | null>(null);

  useEffect(() => {
    const handleTrigger = (e: CustomEvent) => {
      console.log('[HeadlessReportDispatcher] Received dispatch task', e.detail);
      setActiveTask(e.detail);
    };
    
    const handleComplete = () => {
      setActiveTask(null);
    };
    
    window.addEventListener('TRIGGER_REPORT_DISPATCH', handleTrigger as any);
    window.addEventListener('REPORT_DISPATCH_COMPLETE', handleComplete as any);
    return () => {
      window.removeEventListener('TRIGGER_REPORT_DISPATCH', handleTrigger as any);
      window.removeEventListener('REPORT_DISPATCH_COMPLETE', handleComplete as any);
    };
  }, []);

  if (!activeTask) return null;

  return (
    <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1400px', overflow: 'visible', opacity: 0.01, pointerEvents: 'none', zIndex: -9999 }}>
      {/* We pass the autoDispatchConfig directly to Reports, which will handle overriding context and rendering, then sending the email! */}
      <Reports autoDispatchConfig={activeTask} />
    </div>
  );
};
