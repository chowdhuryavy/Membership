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
}

const RetailStockReportPrint = React.forwardRef<HTMLDivElement, Props>(({
  reportData, summary, groupedData, currentProperty, currentOutlet, selectedMonth, viewScope, formatMoney
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
          margin: 10mm;
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
      <div className="flex items-start justify-between border-b border-slate-300 pb-6 mb-8 print:pb-2 print:mb-4">
        <div className="flex items-center gap-6">
          {currentProperty?.logo_url ? (
            <img 
              src={currentProperty.logo_url} 
              alt="Logo" 
              className="w-24 h-24 object-contain" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // If direct load fails, try proxying
                if (!target.src.includes('allorigins') && !target.src.includes('corsproxy')) {
                  target.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(currentProperty.logo_url)}`;
                } else if (target.src.includes('allorigins')) {
                  target.src = `https://corsproxy.io/?${encodeURIComponent(currentProperty.logo_url)}`;
                }
              }}
            />
          ) : (
            <div className="w-24 h-24 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
              <Building2 className="w-8 h-8" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{currentProperty?.name || 'Property Name'}</h1>
            <h2 className="text-lg font-bold text-slate-500 mt-1 tracking-widest uppercase">Retail Stock Ledger</h2>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block text-left bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[200px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="font-bold text-slate-400 uppercase tracking-widest">Period</div>
              <div className="font-bold text-slate-900 text-right">{format(selectedMonth, 'MMMM yyyy')}</div>
              <div className="font-bold text-slate-400 uppercase tracking-widest">Scope</div>
              <div className="font-bold text-slate-900 text-right">{viewScope === 'property' ? 'ALL OUTLETS' : (currentOutlet?.name || 'N/A')}</div>
              <div className="font-bold text-slate-400 uppercase tracking-widest">Generated</div>
              <div className="font-bold text-slate-900 text-right">{format(new Date(), 'dd MMM yyyy')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: formatMoney(summary.totalRevenue) },
          { label: 'Asset Value', value: formatMoney(summary.totalStockValue) },
          { label: 'Units Sold', value: summary.totalItemsSold },
          { label: 'Units Restocked', value: summary.totalRestocked }
        ].map((card, i) => (
          <div key={i} className="p-5 print:p-2 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</span>
            <span className="text-2xl font-black text-slate-900">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden print-compact">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-900 text-white font-bold text-lg uppercase tracking-widest border-b-2 border-slate-900">
            <tr>
              <th className="p-6 whitespace-nowrap">Item Description</th>
              {viewScope === 'property' && <th className="p-6 text-left">Outlet</th>}
              <th className="p-6 text-right">Price</th>
              <th className="p-6 text-center">Opening</th>
              <th className="p-6 text-center">Restocked</th>
              <th className="p-6 text-center">Sold Qty</th>
              <th className="p-6 text-right whitespace-nowrap">Sold Value</th>
              <th className="p-6 text-center">Adj.</th>
              <th className="p-6 text-center">Closing</th>
              <th className="p-6 text-right whitespace-nowrap">Asset Value</th>
              <th className="p-6 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(displayGrouping).map(([groupName, items]: [string, ItemStockSummary[]]) => (
              <React.Fragment key={groupName}>
                <tr className="bg-slate-50/50 break-inside-avoid border-y border-slate-200">
                  <td colSpan={viewScope === 'property' ? 11 : 10} className="p-3 font-black text-slate-900 uppercase tracking-widest text-[11px]">{groupName}</td>
                </tr>
                {items.map((row) => (
                  <tr key={row.itemId} className="hover:bg-slate-50 break-inside-avoid">
                    <td className="p-4 font-bold text-slate-900 text-xs">{row.itemName}</td>
                    {viewScope === 'property' && <td className="p-4 text-left text-[10px] font-bold text-slate-500 uppercase">{row.outletName}</td>}
                    <td className="p-4 text-right font-mono text-xs text-slate-600 whitespace-nowrap">{formatMoney(row.unitPrice)}</td>
                    <td className="p-4 text-center font-mono text-xs text-slate-600">{row.openingStock}</td>
                    <td className="p-4 text-center font-mono text-indigo-600 font-bold text-xs">{row.restocked || '-'}</td>
                    <td className="p-4 text-center font-mono text-emerald-600 font-bold text-xs">{row.sold || '-'}</td>
                    <td className="p-4 text-right font-mono text-emerald-600 font-bold text-xs whitespace-nowrap">{row.salesRevenue ? formatMoney(row.salesRevenue) : '-'}</td>
                    <td className="p-4 text-center font-mono text-amber-600 font-bold text-xs">{row.adjustments || '-'}</td>
                    <td className="p-4 text-center font-mono font-black text-sm text-slate-900">{row.closingStock}</td>
                    <td className="p-4 text-right font-mono font-black text-sm text-slate-900 whitespace-nowrap">{formatMoney(row.closingValue)}</td>
                    <td className="p-4 text-center font-bold text-[10px] uppercase tracking-widest">
                      <span className={`px-2.5 py-1 rounded-md border ${
                        row.status === 'Low' ? 'bg-red-50 text-red-600 border-red-100' :
                        row.status === 'Overstock' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white font-bold text-lg uppercase tracking-widest border-t-2 border-slate-900">
            <tr>
              <td colSpan={viewScope === 'property' ? 3 : 2} className="p-6 text-right">Grand Total</td>
              <td className="p-6 text-center font-mono">{reportData.reduce((sum, item) => sum + item.openingStock, 0)}</td>
              <td className="p-6 text-center font-mono">{summary.totalRestocked}</td>
              <td className="p-6 text-center font-mono">{summary.totalItemsSold}</td>
              <td className="p-6 text-right font-mono whitespace-nowrap">{formatMoney(summary.totalRevenue)}</td>
              <td className="p-6 text-center font-mono">{reportData.reduce((sum, item) => sum + item.adjustments, 0)}</td>
              <td className="p-6 text-center font-mono">{reportData.reduce((sum, item) => sum + item.closingStock, 0)}</td>
              <td className="p-6 text-right font-mono whitespace-nowrap">{formatMoney(summary.totalStockValue)}</td>
              <td className="p-6"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatories */}
      <div className="mt-32 print:mt-24 grid grid-cols-2 gap-24">
        <div className="flex flex-col gap-4">
          <div className="h-px w-full bg-slate-400"></div>
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Prepared By / Store Manager</span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-px w-full bg-slate-400"></div>
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Authorized Signature / General Manager</span>
        </div>
      </div>
    </div>
  );
});

export default RetailStockReportPrint;
