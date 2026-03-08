
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { Package, Download, Filter, ArrowLeft, Calendar, Building2, Store, ChevronLeft, ChevronRight, Printer, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isSameMonth, addMonths, subMonths } from 'date-fns';
import { Sale, InventoryItem } from '../types';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  closingStock: number;
  currentStock: number; // For reference
}

const RetailStockReport = () => {
  const { currentOutlet, currentProperty, formatMoney } = useSettings();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [loading, setLoading] = useState(true);
  const [outletsMap, setOutletsMap] = useState<Record<string, string>>({});
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [currentOutlet, currentProperty, viewScope]);

  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    try {
      const isProperty = viewScope === 'property';
      const scopeId = isProperty ? currentProperty.id : currentOutlet.id;

      // 1. Fetch Inventory & Sales
      const [allItems, allSales, allOutlets] = await Promise.all([
        db.getInventory(scopeId, isProperty),
        db.getSales(scopeId, isProperty),
        db.getOutlets()
      ]);

      // Create Outlet Map for Property View
      const oMap: Record<string, string> = {};
      allOutlets.forEach(o => oMap[o.id] = o.name);
      setOutletsMap(oMap);

      // Filter for Retail only
      const retailItems = allItems.filter(item => item.category === 'Retail');
      setInventory(retailItems);
      setSales(allSales);

    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  };

  const reportData = useMemo(() => {
    if (!inventory.length) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // Filter items: 
    // 1. Must be Retail (already filtered in loadData)
    // 2. Must be created BEFORE or DURING the selected month.
    //    If created AFTER selected month, it shouldn't exist in this report.
    const relevantItems = inventory.filter(item => {
        if (!item.created_at) return true; // Fallback if no date
        const createdDate = parseISO(item.created_at);
        return isBefore(createdDate, monthEnd); 
    });

    // We need to calculate stats PER ITEM
    const itemStats: ItemStockSummary[] = relevantItems.map(item => {
        // 1. Current Stock (Today)
        const currentStock = item.stock_quantity || 0;

        // 2. Filter sales for this item
        const itemSales = sales.filter(s => s.item_id === item.id);

        // 3. Calculate Sales AFTER this month (to add back to get Closing Stock of target month)
        const salesAfter = itemSales
            .filter(s => isAfter(parseISO(s.created_at), monthEnd))
            .reduce((sum, s) => sum + s.quantity, 0);

        // 4. Calculate Sales DURING this month
        const salesDuringEvents = itemSales.filter(s => isSameMonth(parseISO(s.created_at), selectedMonth));
        const salesDuringQty = salesDuringEvents.reduce((sum, s) => sum + s.quantity, 0);
        const salesDuringRevenue = salesDuringEvents.reduce((sum, s) => sum + s.net_amount, 0);

        // 5. Calculate Snapshots
        // Closing Stock of Target Month = Current Stock + Sales After
        // (Assuming no restocks. If restocks happened, we should subtract them, but we don't track them)
        const closingStock = currentStock + salesAfter;
        
        // Opening Stock of Target Month = Closing Stock + Sales During
        // If the item was created THIS month, Opening Stock should theoretically be 0 + Restock (Initial Stock).
        // But since we don't track Initial Stock separately from Current Stock (except via the form field which overwrites it),
        // and we don't have a "Restock Log", this backward calculation is the best approximation.
        // However, if the item was created THIS month, the "Opening Stock" calculated this way 
        // effectively represents the "Initial Stock" it started with.
        const openingStock = closingStock + salesDuringQty;

        return {
            itemId: item.id,
            itemName: item.name,
            outletName: outletsMap[item.outlet_id] || 'Unknown',
            category: item.category,
            unitPrice: item.price,
            openingStock,
            sold: salesDuringQty,
            salesRevenue: salesDuringRevenue,
            restocked: 0, // Placeholder
            closingStock,
            currentStock
        };
    });

    return itemStats.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [inventory, sales, selectedMonth, outletsMap]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Retail_Stock_Report_${format(selectedMonth, 'MMM_yyyy')}`,
    pageStyle: `
      @page { size: landscape; margin: 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      }
    `
  });

  const handleDownloadPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Header
    doc.setFontSize(18);
    doc.text('Retail Stock Ledger', 14, 22);
    doc.setFontSize(10);
    doc.text(`Period: ${format(selectedMonth, 'MMMM yyyy')}`, 14, 28);
    doc.text(`Scope: ${viewScope === 'property' ? currentProperty?.name : currentOutlet?.name}`, 14, 33);

    const tableColumn = ["Item Name", "Unit Price", "Opening", "Sold Qty", "Revenue", "Closing"];
    const tableRows = reportData.map(item => [
      item.itemName,
      formatMoney(item.unitPrice),
      item.openingStock,
      item.sold,
      formatMoney(item.salesRevenue),
      item.closingStock
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] } // Indigo 600
    });

    doc.save(`Retail_Stock_Report_${format(selectedMonth, 'yyyy-MM')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Retail Stock Ledger</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly Inventory Snapshot</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={handlePrint} className="gap-2">
             <Printer className="w-4 h-4" /> Print
           </Button>
           <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
             <FileText className="w-4 h-4" /> PDF
           </Button>
           <Button variant="ghost" onClick={() => window.history.back()} className="gap-2">
             <ArrowLeft className="w-4 h-4" /> Back
           </Button>
        </div>
      </div>

      <div ref={printRef} className="print:p-8 bg-white print:bg-white rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
        
        {/* Print Header */}
        <div className="hidden print:flex flex-col items-center mb-8 border-b pb-6">
            {currentProperty?.logo_url && (
                <img src={currentProperty.logo_url} alt="Property Logo" className="h-16 mb-4 object-contain" />
            )}
            <h1 className="text-2xl font-black uppercase tracking-tight">{currentProperty?.name}</h1>
            <h2 className="text-lg font-bold text-slate-500 uppercase tracking-widest mt-1">Retail Stock Ledger</h2>
            <div className="flex gap-8 mt-4 text-sm font-bold">
                <span>Period: {format(selectedMonth, 'MMMM yyyy')}</span>
                <span>Scope: {viewScope === 'property' ? 'All Outlets' : currentOutlet?.name}</span>
            </div>
        </div>

        <CardHeader className="border-b border-slate-100 p-6 bg-slate-50/50 no-print">
           <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              
              {/* Scope Toggle */}
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button onClick={() => setViewScope('outlet')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'outlet' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Store className="w-3 h-3" /> Outlet
                  </button>
                  <button onClick={() => setViewScope('property')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'property' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Building2 className="w-3 h-3" /> Property
                  </button>
              </div>

              {/* Month Picker */}
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                  <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                  <div className="flex items-center gap-3 px-2 min-w-[140px] justify-center">
                       <Calendar className="w-4 h-4 text-indigo-600" />
                       <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{format(selectedMonth, 'MMMM yyyy')}</span>
                  </div>
                  <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight className="w-4 h-4"/></button>
              </div>

           </div>
        </CardHeader>
        <CardContent className="p-0">
           {loading ? (
               <div className="flex items-center justify-center h-64">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
               </div>
           ) : (
               <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                           <tr>
                               <th className="px-8 py-5">Item Name</th>
                               {viewScope === 'property' && <th className="px-8 py-5">Outlet</th>}
                               <th className="px-8 py-5 text-right">Unit Price</th>
                               <th className="px-8 py-5 text-right">Opening Stock</th>
                               <th className="px-8 py-5 text-right text-emerald-600">Sold</th>
                               <th className="px-8 py-5 text-right text-indigo-600">Restocked</th>
                               <th className="px-8 py-5 text-right">Closing Stock</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {reportData.length === 0 ? (
                               <tr>
                                   <td colSpan={viewScope === 'property' ? 7 : 6} className="px-8 py-12 text-center text-slate-400 font-bold">No retail items found for this period.</td>
                               </tr>
                           ) : (
                               reportData.map((row) => (
                                   <tr key={row.itemId} className="hover:bg-slate-50/50 transition-colors group">
                                       <td className="px-8 py-4 font-bold text-slate-900 flex items-center gap-3">
                                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors no-print">
                                               <Package className="w-4 h-4" />
                                           </div>
                                           {row.itemName}
                                       </td>
                                       {viewScope === 'property' && (
                                           <td className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                               {row.outletName}
                                           </td>
                                       )}
                                       <td className="px-8 py-4 text-right font-mono text-slate-600 font-bold">{formatMoney(row.unitPrice)}</td>
                                       <td className="px-8 py-4 text-right font-mono text-slate-500">{row.openingStock}</td>
                                       <td className="px-8 py-4 text-right">
                                           {row.sold > 0 ? (
                                               <div className="flex flex-col items-end">
                                                   <span className="font-mono font-bold text-emerald-600">-{row.sold}</span>
                                                   <span className="text-[9px] font-bold text-emerald-400">{formatMoney(row.salesRevenue)}</span>
                                               </div>
                                           ) : (
                                               <span className="text-slate-300">-</span>
                                           )}
                                       </td>
                                       <td className="px-8 py-4 text-right font-mono text-indigo-600">
                                           {row.restocked > 0 ? `+${row.restocked}` : '-'}
                                       </td>
                                       <td className="px-8 py-4 text-right font-mono text-slate-900 font-bold bg-slate-50/30">
                                           {row.closingStock}
                                       </td>
                                   </tr>
                               ))
                           )}
                       </tbody>
                   </table>
               </div>
           )}
        </CardContent>
      </div>
    </div>
  );
};

export default RetailStockReport;
