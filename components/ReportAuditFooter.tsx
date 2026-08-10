import React from 'react';
import { format } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';

interface ReportAuditFooterProps {
  isEmbedded?: boolean;
}

export const ReportAuditFooter: React.FC<ReportAuditFooterProps> = ({ isEmbedded }) => {
  const { currentProperty, currentOutlet } = useSettings();
  const session = JSON.parse(localStorage.getItem('membership_session') || '{}');
  const userName = session?.name || 'Admin';

  return (
    <div className={`mt-8 pt-4 border-t border-slate-100 flex justify-between items-center ${isEmbedded ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-300 uppercase tracking-widest print:flex hidden`}>
      <span>
        Page 1 of 1 &bull; System ID: {currentOutlet?.id?.substring(0, 8) || 'N/A'}
      </span>
      <span className="text-slate-400">
        Exported on: {format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} by {userName}
      </span>
      <span>
        &copy; {new Date().getFullYear()} {currentProperty?.name || 'System'}. All rights reserved.
      </span>
    </div>
  );
};
