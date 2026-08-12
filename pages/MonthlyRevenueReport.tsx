import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { getMonthlyRevenueData, MonthlyRevenueData } from '../src/shared/monthlyRevenueReportLogic';
import { Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { ReportAuditFooter } from '../components/ReportAuditFooter';
import { supabase } from '../services/supabase';
import TabLoader from '../components/TabLoader';

import { format, parseISO } from 'date-fns';

interface MonthlyRevenueReportProps {
  isEmbedded?: boolean;
  embeddedMonth?: string;
  revenueMode: 'cash' | 'accrual';
  data?: MonthlyRevenueData | null;
}

const MonthlyRevenueReport = ({ isEmbedded, embeddedMonth, revenueMode, data: externalData }: MonthlyRevenueReportProps) => {
  const { currentOutlet, currentProperty, settings, formatMoney } = useSettings();
  const [data, setData] = useState<MonthlyRevenueData | null>(externalData || null);
  const [reportMonth, setReportMonth] = useState(embeddedMonth || format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(!externalData);

  useEffect(() => {
    if (externalData) {
      setData(externalData);
      setLoading(false);
    }
  }, [externalData]);

  useEffect(() => {
    if (embeddedMonth) {
      setReportMonth(embeddedMonth);
    }
  }, [embeddedMonth]);

  const [cachedData, setCachedData] = useState<Record<string, MonthlyRevenueData>>({});

  useEffect(() => {
    if (externalData) return;
    if (!currentOutlet || !currentProperty) return;
    
    const cacheKey = `${currentProperty.id}-${currentOutlet.id}-${reportMonth}-${revenueMode}`;
    if (cachedData[cacheKey]) {
      setData(cachedData[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reportYear = parseInt(reportMonth.split('-')[0]);
    const endMonthIndex = parseInt(reportMonth.split('-')[1]) - 1;
    getMonthlyRevenueData(supabase, currentProperty.id, currentOutlet.id, reportYear, revenueMode, endMonthIndex)
      .then(res => {
        setCachedData(prev => ({ ...prev, [cacheKey]: res }));
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching monthly revenue data:', err);
        setLoading(false);
      });
  }, [currentOutlet, currentProperty, reportMonth, revenueMode, externalData]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (!data) return null;

  const content = (
    <div className="overflow-x-auto print:overflow-visible print:w-full">
      <table className={`w-full text-left border-collapse border-2 border-black ${isEmbedded ? 'text-[8px] print:text-[7px]' : 'text-sm'}`}>
        <thead>
          <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-widest">
            <th className="px-2 py-3 border border-black text-center">
              MONTH
              <div className="text-[8px] font-black text-indigo-600 mt-1">
                {revenueMode === 'cash' ? 'CASH BASIS' : 'AMORTIZATION'}
              </div>
            </th>
            {monthNames.map(m => (
              <th key={m} className="px-2 py-3 border border-black text-center">{m}</th>
            ))}
            <th className="px-2 py-3 border border-black text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.rows?.map(row => (
            <tr key={row.category} className="hover:bg-slate-50 transition-colors">
              <td className="px-2 py-2 border border-black font-black text-slate-900 text-center">{row.category}</td>
              {row.values?.map((val, i) => (
                <td key={i} className="px-2 py-2 border border-black text-right font-bold text-slate-700">
                  {val > 0 ? formatMoney(val) : ''}
                </td>
              ))}
              <td className="px-2 py-2 border border-black text-right font-black text-slate-900 bg-slate-100/50">
                {formatMoney(row.total)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-200 font-black">
            <td className="px-2 py-3 border border-black text-center text-slate-900">Monthly Revenue</td>
            {data.monthlyTotals?.map((val, i) => (
              <td key={i} className="px-2 py-3 border border-black text-right text-slate-900">
                {val > 0 ? formatMoney(val) : '-'}
              </td>
            ))}
            <td className="px-2 py-3 border border-black text-right text-slate-900">
              {formatMoney(data.yearlyTotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={14} className="h-8 border-x-2 border-black bg-white"></td>
          </tr>
          <tr className="bg-slate-100 font-black">
            <td className="px-2 py-3 border border-black text-center text-slate-900">Monthly Revenue {parseInt(reportMonth.split('-')[0]) - 1}</td>
            {data.previousYearTotals?.map((val, i) => (
              <td key={i} className="px-2 py-3 border border-black text-right text-slate-900">
                {val > 0 ? formatMoney(val) : '-'}
              </td>
            ))}
            <td className="px-2 py-3 border border-black text-right text-slate-900">
              {formatMoney(data.previousYearlyTotal)}
            </td>
          </tr>
          <tr className="bg-white font-black">
            <td className="px-2 py-3 border border-black text-center text-slate-900">Amount (+ / -)</td>
            {data.monthlyTotals?.map((val, i) => {
              const diff = val - (data.previousYearTotals?.[i] || 0);
              const isNegative = diff < 0;
              const formattedDiff = formatMoney(Math.abs(diff));
              return (
                <td key={i} className={`px-2 py-3 border border-black text-right ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
                  {diff !== 0 ? (isNegative ? `(${formattedDiff})` : formattedDiff) : '-'}
                </td>
              );
            })}
            <td className={`px-2 py-3 border border-black text-right ${data.yearlyTotal - data.previousYearlyTotal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {(() => {
                const diff = data.yearlyTotal - data.previousYearlyTotal;
                const isNegative = diff < 0;
                const formattedDiff = formatMoney(Math.abs(diff));
                return diff !== 0 ? (isNegative ? `(${formattedDiff})` : formattedDiff) : '-';
              })()}
            </td>
          </tr>
          <tr className="bg-white font-black">
            <td className="px-2 py-3 border border-black text-center text-slate-900">Percentage % (+ / -)</td>
            {data.monthlyTotals?.map((val, i) => {
              const prev = data.previousYearTotals?.[i] || 0;
              const diff = val - prev;
              let pct = 0;
              if (prev > 0) {
                pct = (diff / prev) * 100;
              } else if (val > 0) {
                pct = 100;
              } else if (val === 0 && prev === 0) {
                return <td key={i} className="px-2 py-3 border border-black text-right text-slate-900">-</td>;
              } else {
                pct = -100;
              }
              const isNegative = pct < 0;
              return (
                <td key={i} className={`px-2 py-3 border border-black text-right ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
                  {isNegative ? `(${Math.abs(pct).toFixed(2)}%)` : `${pct.toFixed(2)}%`}
                </td>
              );
            })}
            <td className={`px-2 py-3 border border-black text-right ${data.yearlyTotal - data.previousYearlyTotal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {(() => {
                const prev = data.previousYearlyTotal;
                const diff = data.yearlyTotal - prev;
                let pct = 0;
                if (prev > 0) {
                  pct = (diff / prev) * 100;
                } else if (data.yearlyTotal > 0) {
                  pct = 100;
                } else if (data.yearlyTotal === 0 && prev === 0) {
                  return '-';
                } else {
                  pct = -100;
                }
                const isNegative = pct < 0;
                return isNegative ? `(${Math.abs(pct).toFixed(2)}%)` : `${pct.toFixed(2)}%`;
              })()}
            </td>
          </tr>
        </tbody>
      </table>
      <ReportAuditFooter isEmbedded={isEmbedded} />
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <Card className="rounded-none border-slate-200 shadow-2xl overflow-hidden bg-white print:shadow-none print:rounded-none">
      <div className="print-container p-8 md:p-10 flex flex-col bg-white w-full overflow-visible">
        <div className="flex flex-row justify-between items-start gap-4 mb-8 print:mb-4 pb-4 border-b-2 border-slate-900/10 w-full">
          <div className="flex items-center gap-4 min-w-0 max-w-[60%] print:max-w-[55%]">
            {currentProperty?.logo_url && (
              <img 
                src={currentProperty.logo_url} 
                crossOrigin="anonymous" 
                alt="Property Logo"
                className="h-12 w-auto max-w-[150px] md:max-w-[180px] print:h-10 print:max-w-[120px] object-contain shrink-0" 
              />
            )}
            <div className="h-10 w-px bg-slate-300 shrink-0"></div>
            <div className="min-w-0 overflow-hidden">
              <h2 className="text-lg md:text-xl print:text-sm font-black text-slate-900 tracking-tight uppercase leading-tight truncate mb-0.5">{currentProperty?.name || settings?.name}</h2>
              <p className="text-[9px] md:text-[10px] print:text-[8px] font-black text-slate-500 uppercase tracking-wider leading-none truncate">{currentOutlet?.name} &bull; ISO-9001 CERTIFIED</p>
              <div className="flex items-center gap-1.5 mt-1 text-indigo-600 print:text-indigo-800">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[8px] md:text-[9px] print:text-[7.5px] font-black uppercase tracking-widest">Internal Verification</span>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2 shrink-0 max-w-[40%] print:max-w-[45%]">
            <h3 className="text-lg md:text-xl print:text-sm font-black text-slate-900 tracking-tight uppercase leading-snug text-right break-words max-w-full">
              MONTHLY REVENUE REPORT
            </h3>
            <div className="flex items-center gap-2">
              <div className="bg-slate-950 text-white px-4 py-1.5 rounded-xl print:rounded-lg shadow-sm print:shadow-none inline-block text-right">
                <span className="text-[8px] print:text-[7px] font-black uppercase opacity-70 block tracking-widest leading-none mb-0.5">Month</span>
                <span className="text-xs md:text-sm print:text-[10px] font-black uppercase leading-none block">
                  {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 min-h-[400px] relative">
          {loading ? (
            <div className="absolute inset-0 z-[10] flex items-center justify-center bg-white/60 backdrop-blur-[2px] no-print">
              <TabLoader message="Compiling Annual Revenue Matrix..." />
            </div>
          ) : (
            content
          )}
        </div>
      </div>
    </Card>
  );
};

export default MonthlyRevenueReport;
