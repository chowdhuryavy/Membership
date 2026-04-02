import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { getMonthlyRevenueData, MonthlyRevenueData } from '../src/shared/monthlyRevenueReportLogic';
import { Building2, ShieldCheck } from 'lucide-react';

interface MonthlyRevenueReportProps {
  isEmbedded?: boolean;
  embeddedYear?: number;
}

const MonthlyRevenueReport = ({ isEmbedded, embeddedYear }: MonthlyRevenueReportProps) => {
  const { currentOutlet, currentProperty, settings, formatMoney } = useSettings();
  const [data, setData] = useState<MonthlyRevenueData | null>(null);
  const [reportYear, setReportYear] = useState(embeddedYear || new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (embeddedYear) {
      setReportYear(embeddedYear);
    }
  }, [embeddedYear]);

  useEffect(() => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    getMonthlyRevenueData(currentProperty.id, currentOutlet.id, reportYear)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching monthly revenue data:', err);
        setLoading(false);
      });
  }, [currentOutlet, currentProperty, reportYear]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (!data) return null;

  const content = (
    <div className="overflow-x-auto">
      <table className={`w-full text-left border-collapse border-2 border-black ${isEmbedded ? 'text-[9px]' : 'text-sm'}`}>
        <thead>
          <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-widest">
            <th className="px-4 py-3 border border-black text-center">MONTH</th>
            {monthNames.map(m => (
              <th key={m} className="px-4 py-3 border border-black text-center">{m}</th>
            ))}
            <th className="px-4 py-3 border border-black text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.category} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2 border border-black font-black text-slate-900 text-center">{row.category}</td>
              {row.values.map((val, i) => (
                <td key={i} className="px-4 py-2 border border-black text-right font-bold text-slate-700">
                  {val > 0 ? formatMoney(val) : ''}
                </td>
              ))}
              <td className="px-4 py-2 border border-black text-right font-black text-slate-900 bg-slate-100/50">
                {formatMoney(row.total)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-200 font-black">
            <td className="px-4 py-3 border border-black text-center text-slate-900">Monthly Revenue</td>
            {data.monthlyTotals.map((val, i) => (
              <td key={i} className="px-4 py-3 border border-black text-right text-slate-900">
                {val > 0 ? formatMoney(val) : '-'}
              </td>
            ))}
            <td className="px-4 py-3 border border-black text-right text-slate-900">
              {formatMoney(data.yearlyTotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={14} className="h-8 border-x-2 border-black bg-white"></td>
          </tr>
          <tr className="bg-slate-100 font-black">
            <td className="px-4 py-3 border border-black text-center text-slate-900">Monthly Revenue {reportYear - 1}</td>
            {data.previousYearTotals.map((val, i) => (
              <td key={i} className="px-4 py-3 border border-black text-right text-slate-900">
                {val > 0 ? formatMoney(val) : '-'}
              </td>
            ))}
            <td className="px-4 py-3 border border-black text-right text-slate-900">
              {formatMoney(data.previousYearlyTotal)}
            </td>
          </tr>
          <tr className="bg-white font-black">
            <td className="px-4 py-3 border border-black text-center text-slate-900">Amount (+ / -)</td>
            {data.monthlyTotals.map((val, i) => {
              const diff = val - data.previousYearTotals[i];
              const isNegative = diff < 0;
              const formattedDiff = formatMoney(Math.abs(diff));
              return (
                <td key={i} className={`px-4 py-3 border border-black text-right ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
                  {diff !== 0 ? (isNegative ? `(${formattedDiff})` : formattedDiff) : '-'}
                </td>
              );
            })}
            <td className={`px-4 py-3 border border-black text-right ${data.yearlyTotal - data.previousYearlyTotal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {(() => {
                const diff = data.yearlyTotal - data.previousYearlyTotal;
                const isNegative = diff < 0;
                const formattedDiff = formatMoney(Math.abs(diff));
                return diff !== 0 ? (isNegative ? `(${formattedDiff})` : formattedDiff) : '-';
              })()}
            </td>
          </tr>
          <tr className="bg-white font-black">
            <td className="px-4 py-3 border border-black text-center text-slate-900">Percentage % (+ / -)</td>
            {data.monthlyTotals.map((val, i) => {
              const prev = data.previousYearTotals[i];
              const diff = val - prev;
              let pct = 0;
              if (prev > 0) {
                pct = (diff / prev) * 100;
              } else if (val > 0) {
                pct = 100;
              } else if (val === 0 && prev === 0) {
                return <td key={i} className="px-4 py-3 border border-black text-right text-slate-900">-</td>;
              } else {
                pct = -100;
              }
              const isNegative = pct < 0;
              return (
                <td key={i} className={`px-4 py-3 border border-black text-right ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
                  {isNegative ? `(${Math.abs(pct).toFixed(2)}%)` : `${pct.toFixed(2)}%`}
                </td>
              );
            })}
            <td className={`px-4 py-3 border border-black text-right ${data.yearlyTotal - data.previousYearlyTotal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
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
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <Card className="rounded-none border-slate-200 shadow-2xl overflow-hidden bg-white min-h-[1200px] print:shadow-none print:rounded-none">
      <div className="print-container p-12 md:p-16 flex flex-col bg-white">
        <div className="flex justify-between items-start mb-16">
          <div className="flex items-center gap-6">
            {currentProperty?.logo_url && <img src={currentProperty.logo_url} crossOrigin="anonymous" className="h-20 w-auto object-contain" />}
            <div className="h-16 w-px bg-slate-200"></div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">{currentProperty?.name || settings?.name}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] leading-none">{currentOutlet?.name} &bull; ISO-9001 CERTIFIED</p>
              <div className="flex items-center gap-2 mt-4 text-indigo-600">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-widest">Internal Verification Protocol</span>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-3">
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
              MONTHLY REVENUE REPORT
            </h3>
            <div className="bg-slate-950 text-white px-6 py-3 rounded-2xl shadow-2xl">
              <span className="text-[9px] font-black uppercase opacity-60 block tracking-widest">Year</span>
              <span className="text-sm font-black uppercase">
                {reportYear}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
