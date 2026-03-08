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
  return (
    <div ref={ref} className="p-12 bg-white text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-8 mb-8">
        <div className="flex items-center gap-6">
          {currentProperty?.logo_url ? (
            <img src={currentProperty.logo_url} alt="Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
              <Building2 className="w-10 h-10" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">{currentProperty?.name || 'Property Name'}</h1>
            <h2 className="text-2xl font-bold text-slate-600 mt-1">RETAIL STOCK LEDGER</h2>
          </div>
        </div>
        <div className="text-right text-sm font-bold text-slate-600 uppercase tracking-widest bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-[10px] text-slate-400">Period</p>
          <p className="mb-2">{format(selectedMonth, 'MMMM yyyy')}</p>
          <p className="text-[10px] text-slate-400">Scope</p>
          <p>{viewScope === 'property' ? 'ALL OUTLETS' : currentOutlet?.name}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Revenue', value: formatMoney(summary.totalRevenue) },
          { label: 'Asset Value', value: formatMoney(summary.totalStockValue) },
          { label: 'Units Sold', value: summary.totalItemsSold },
          { label: 'Units Restocked', value: summary.totalRestocked }
        ].map((card, i) => (
          <div key={i} className="p-6 border-2 border-slate-900 rounded-2xl flex flex-col items-center text-center bg-slate-900 text-white">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{card.label}</span>
            <span className="text-3xl font-black">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-widest">
          <tr>
            <th className="p-4 rounded-tl-lg">Item Description</th>
            <th className="p-4 text-right">Price</th>
            <th className="p-4 text-center">Opening</th>
            <th className="p-4 text-center">Restocked</th>
            <th className="p-4 text-center">Sold Qty</th>
            <th className="p-4 text-right">Sold Value</th>
            <th className="p-4 text-center">Adj.</th>
            <th className="p-4 text-center">Closing</th>
            <th className="p-4 text-right">Asset Value</th>
            <th className="p-4 text-center rounded-tr-lg">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {Object.entries(groupedData).map(([category, items]: [string, ItemStockSummary[]]) => (
            <React.Fragment key={category}>
              <tr className="bg-slate-100">
                <td colSpan={10} className="p-3 font-black text-slate-800 uppercase tracking-widest text-[11px]">{category}</td>
              </tr>
              {items.map((row) => (
                <tr key={row.itemId} className="hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-900">{row.itemName}</td>
                  <td className="p-4 text-right font-mono">{formatMoney(row.unitPrice)}</td>
                  <td className="p-4 text-center font-mono">{row.openingStock}</td>
                  <td className="p-4 text-center font-mono text-indigo-600 font-bold">{row.restocked || '-'}</td>
                  <td className="p-4 text-center font-mono text-emerald-600 font-bold">{row.sold || '-'}</td>
                  <td className="p-4 text-right font-mono text-emerald-600 font-bold">{row.salesRevenue ? formatMoney(row.salesRevenue) : '-'}</td>
                  <td className="p-4 text-center font-mono text-amber-600 font-bold">{row.adjustments || '-'}</td>
                  <td className="p-4 text-center font-mono font-black text-lg">{row.closingStock}</td>
                  <td className="p-4 text-right font-mono font-black text-lg">{formatMoney(row.closingValue)}</td>
                  <td className="p-4 text-center font-bold text-[10px] uppercase tracking-widest">{row.status}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default RetailStockReportPrint;
