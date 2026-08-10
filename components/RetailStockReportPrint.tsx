import React from 'react';
import { format } from 'date-fns';
import { Building2 } from 'lucide-react';

interface ItemStockSummary {
  itemId: string;
  itemName: string;
  outletName?: string;
  category: string;
  unitPrice: number;
  openingStock: number;
  sold: number;
  salesRevenue: number;
  restocked: number;
  adjustments: number;
  closingStock: number;
  closingValue: number;
  status: 'Low' | 'Good' | 'Overstock';
}

interface Props {
  reportData: ItemStockSummary[];
  summary: {
    totalRevenue: number;
    totalStockValue: number;
    totalItemsSold: number;
    totalRestocked: number;
  };
  groupedData: Record<string, ItemStockSummary[]>;
  currentProperty: any;
  currentOutlet: any;
  selectedMonth: Date;
  viewScope: 'outlet' | 'property';
  formatMoney: (amount: number) => string;
  signatoryConfig?: { prepared?: string, reviewed?: string, approved?: string } | null;
}

const RetailStockReportPrint = React.forwardRef<HTMLDivElement, Props>(({
  reportData, summary, groupedData, currentProperty, currentOutlet, selectedMonth, viewScope, formatMoney, signatoryConfig
}, ref) => {
  const displayGrouping = React.useMemo(() => {
    if (viewScope === 'property') {
      return reportData.reduce((acc, item) => {
        const key = item.outletName || 'Unknown Outlet';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, ItemStockSummary[]>);
    }
    return groupedData;
  }, [reportData, groupedData, viewScope]);

  return (
    <div
  ref={ref}
  className="p-8 bg-white text-slate-900 w-full max-w-[1200px] mx-auto print:w-full print:max-w-none print:p-4 no-oklch"
>
      <style>{`
        @page {
          size: landscape;
          margin: 0;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
          .print-compact td, .print-compact th {
            padding: 4px !important;
          }
        }
        .no-oklch, .no-oklch * {
          --color-slate-50: #f8fafc !important;
          --color-slate-100: #f1f5f9 !important;
          --color-slate-200: #e2e8f0 !important;
          --color-slate-300: #cbd5e1 !important;
          --color-slate-400: #94a3b8 !important;
          --color-slate-500: #64748b !important;
          --color-slate-600: #475569 !important;
          --color-slate-700: #334155 !important;
          --color-slate-800: #1e293b !important;
          --color-slate-900: #0f172a !important;
          --color-indigo-50: #eef2ff !important;
          --color-indigo-100: #e0e7ff !important;
          --color-indigo-600: #4f46e5 !important;
          --color-indigo-700: #4338ca !important;
          --color-emerald-50: #ecfdf5 !important;
          --color-emerald-100: #d1fae5 !important;
          --color-emerald-600: #059669 !important;
          --color-emerald-700: #047857 !important;
          --color-amber-50: #fffbeb !important;
          --color-amber-100: #fef3c7 !important;
          --color-amber-600: #d97706 !important;
          --color-amber-700: #b45309 !important;
          --color-red-50: #fef2f2 !important;
          --color-red-100: #fee2e2 !important;
          --color-red-600: #dc2626 !important;
          --color-red-700: #b91c1c !important;
          --color-purple-50: #faf5ff !important;
          --color-purple-100: #f3e8ff !important;
          --color-purple-600: #9333ea !important;
          --color-purple-700: #7e22ce !important;
          
          /* Also override the generic background/foreground if used */
          --background: #ffffff !important;
          --foreground: #0f172a !important;
        }
      `}</style>
       {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-8 mb-10 print:pb-4 print:mb-6">
        <div className="flex items-center gap-8">
          {currentProperty?.logo_url ? (
            <img 
              src={currentProperty.logo_url} 
              alt="Corporate Logo" 
              className="w-28 h-28 object-contain rounded-2xl" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('corsproxy')) {
                  target.src = `https://corsproxy.io/?${encodeURIComponent(currentProperty.logo_url)}`;
                }
              }}
            />
          ) : (
            <div className="w-24 h-24 bg-slate-100 rounded-2xl border-2 border-slate-200 flex items-center justify-center text-slate-400">
              <Building2 className="w-10 h-10" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{currentProperty?.name || 'ESTABLISHMENT NAME'}</h1>
            <div className="flex items-center gap-3">
               <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded">Official Ledger</span>
               <h2 className="text-xl font-bold text-slate-500 tracking-tight uppercase">Retail Inventory & Stock Report</h2>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block text-left bg-white p-6 rounded-2xl border-2 border-slate-100 min-w-[280px] shadow-sm">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporting Period</span>
                <span className="text-xs font-black text-slate-900 uppercase">{format(selectedMonth, 'MMMM yyyy')}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope Alignment</span>
                <span className="text-xs font-black text-slate-900 uppercase">{viewScope === 'property' ? 'Consolidated (All Outlets)' : (currentOutlet?.name || 'Localized Outlet')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generation Date</span>
                <span className="text-xs font-black text-slate-900 uppercase">{format(new Date(), 'dd MMM yyyy')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-12 print:mb-8">
        {[
          { label: 'Total Revenue', value: formatMoney(summary.totalRevenue), color: 'emerald' },
          { label: 'Asset Valuation', value: formatMoney(summary.totalStockValue), color: 'indigo' },
          { label: 'Units Outflow', value: summary.totalItemsSold, color: 'slate' },
          { label: 'Units Inflow', value: summary.totalRestocked, color: 'blue' }
        ].map((card, i) => (
          <div key={i} className="p-6 print:p-4 border-2 border-slate-100 rounded-3xl bg-white flex flex-col items-center text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{card.label}</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Ledger Table */}
      <div className="border-2 border-slate-950 rounded-2xl overflow-hidden print-compact shadow-xl mb-12">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-[#0f172a] text-white font-black text-[10px] uppercase tracking-[0.2em] border-b-2 border-slate-950">
            <tr>
              <th className="p-5 whitespace-nowrap">Inventory Description</th>
              {viewScope === 'property' && <th className="p-5 text-left">Internal Outlet</th>}
              <th className="p-5 text-right">Unit Rate</th>
              <th className="p-5 text-center bg-slate-800/40">Opening</th>
              <th className="p-5 text-center text-indigo-300">Inflow</th>
              <th className="p-5 text-center text-emerald-300">Outflow</th>
              <th className="p-5 text-right text-emerald-300 whitespace-nowrap">Revenue</th>
              <th className="p-5 text-center text-amber-300">Adj.</th>
              <th className="p-5 text-center bg-slate-800/40">Closing</th>
              <th className="p-5 text-right whitespace-nowrap">Asset Value</th>
              <th className="p-5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {Object.entries(displayGrouping).map(([groupName, items]: [string, ItemStockSummary[]]) => (
              <React.Fragment key={groupName}>
                <tr className="bg-slate-100/80 break-inside-avoid border-y border-slate-200">
                  <td colSpan={viewScope === 'property' ? 11 : 10} className="p-3.5 font-black text-slate-950 uppercase tracking-[0.25em] text-[10px]">{groupName}</td>
                </tr>
                {items.map((row) => (
                  <tr key={row.itemId} className="hover:bg-slate-50 break-inside-avoid odd:bg-white even:bg-slate-50/30">
                    <td className="p-5 font-black text-slate-900 text-[11px] uppercase tracking-tight">{row.itemName}</td>
                    {viewScope === 'property' && <td className="p-5 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">{row.outletName}</td>}
                    <td className="p-5 text-right font-mono text-[10px] text-slate-600 whitespace-nowrap font-bold">{formatMoney(row.unitPrice)}</td>
                    <td className="p-5 text-center font-mono text-[11px] text-slate-950 font-black bg-slate-50/50 border-x border-slate-100">{row.openingStock}</td>
                    <td className="p-5 text-center font-mono text-indigo-700 font-black text-[11px]">{row.restocked || '-'}</td>
                    <td className="p-5 text-center font-mono text-emerald-700 font-black text-[11px]">{row.sold || '-'}</td>
                    <td className="p-5 text-right font-mono text-emerald-700 font-black text-[11px] whitespace-nowrap">{row.salesRevenue ? formatMoney(row.salesRevenue) : '-'}</td>
                    <td className="p-5 text-center font-mono text-amber-700 font-black text-[11px]">{row.adjustments || '-'}</td>
                    <td className="p-5 text-center font-mono font-black text-xs text-slate-950 bg-slate-50/50 border-x border-slate-100">{row.closingStock}</td>
                    <td className="p-5 text-right font-mono font-black text-xs text-slate-950 whitespace-nowrap border-l border-slate-100">{formatMoney(row.closingValue)}</td>
                    <td className="p-5 text-center font-black text-[9px] uppercase tracking-widest">
                      <span className={`px-2 py-0.5 rounded-md border-2 border-slate-900 text-slate-900`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-[#0f172a] text-white font-black text-xs uppercase tracking-[0.2em] border-t-2 border-slate-950">
            <tr>
              <td colSpan={viewScope === 'property' ? 3 : 2} className="p-6 text-right text-slate-400">Total Aggregation</td>
              <td className="p-6 text-center font-mono text-indigo-300 border-x border-slate-800">{reportData.reduce((sum, item) => sum + item.openingStock, 0)}</td>
              <td className="p-6 text-center font-mono text-indigo-300">{summary.totalRestocked}</td>
              <td className="p-6 text-center font-mono text-emerald-300">{summary.totalItemsSold}</td>
              <td className="p-6 text-right font-mono text-emerald-300 whitespace-nowrap">{formatMoney(summary.totalRevenue)}</td>
              <td className="p-6 text-center font-mono text-amber-300">{reportData.reduce((sum, item) => sum + item.adjustments, 0)}</td>
              <td className="p-6 text-center font-mono text-white text-base border-x border-slate-800 tracking-tighter">{reportData.reduce((sum, item) => sum + item.closingStock, 0)}</td>
              <td className="p-6 text-right font-mono text-white text-base whitespace-nowrap tracking-tighter">{formatMoney(summary.totalStockValue)}</td>
              <td className="p-6"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatories */}
      {signatoryConfig && (
        <div className={`mt-32 print:mt-24 grid ${signatoryConfig.reviewed ? 'grid-cols-3' : 'grid-cols-2'} gap-10 items-end pb-4`}>
            <div className="space-y-12">
                <div className="h-px bg-black w-full"></div>
                <div className="text-center uppercase">
                    <p className="font-black text-xs text-slate-900">Prepared By:</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.prepared}</p>
                </div>
            </div>
            {signatoryConfig.reviewed && (
              <div className="space-y-12">
                  <div className="h-px bg-black w-full"></div>
                  <div className="text-center uppercase">
                      <p className="font-black text-xs text-slate-900">Reviewed By:</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.reviewed}</p>
                  </div>
              </div>
            )}
            <div className="space-y-12">
                <div className="h-px bg-black w-full"></div>
                <div className="text-center uppercase">
                    <p className="font-black text-xs text-slate-900">Approved By:</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.approved}</p>
                </div>
            </div>
        </div>
      )}

      {/* Footer Audit Trail */}
      <div className="mt-12 flex justify-between items-center border-t border-slate-100 pt-6">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              Page 1 of 1 &bull; System ID: {currentOutlet?.id?.substring(0,8) || 'N/A'}
          </span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Exported on: {format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} {JSON.parse(localStorage.getItem('membership_session') || '{}')?.name ? ` by ${JSON.parse(localStorage.getItem('membership_session') || '{}')?.name}` : ''}
          </span>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              &copy; {new Date().getFullYear()} {currentProperty?.name}. All rights reserved.
          </span>
      </div>
    </div>
  );
});

export default RetailStockReportPrint;
