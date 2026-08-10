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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print-audit-footer {
            display: flex !important;
            position: relative;
            margin-top: 3rem;
            page-break-inside: avoid;
          }
          .print-page-number-only {
            display: block !important;
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 8px;
            font-weight: 900;
            color: #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .print-page-number-only:after {
            content: "Page " counter(page);
          }
        }
      `}} />
      
      {/* Full Audit Trail - Appears only at the end of the content */}
      <div className={`print-audit-footer mt-12 pt-6 border-t border-slate-100 flex justify-between items-center ${isEmbedded ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-300 uppercase tracking-widest print:flex hidden`}>
        <span>
          System ID: {currentOutlet?.id?.substring(0, 8) || 'N/A'}
        </span>
        <span className="text-slate-400">
          Exported on: {format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} by {userName}
        </span>
        <span>
          &copy; {new Date().getFullYear()} {currentProperty?.name || 'System'}. All rights reserved.
        </span>
      </div>

      {/* Floating Page Number - Appears on every page */}
      <div className="print-page-number-only hidden"></div>
    </>
  );
};
