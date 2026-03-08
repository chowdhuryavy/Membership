
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, Button } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { 
  Package, 
  ArrowLeft, 
  Calendar, 
  Building2, 
  Store, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowDownRight, 
  ArrowUpRight 
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isSameMonth, addMonths, subMonths } from 'date-fns';
import { Sale, InventoryItem, InventoryLog } from '../types';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const RetailStockReport = () => {
  const { currentOutlet, currentProperty, formatMoney } = useSettings();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
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

      const [allItems, allSales, allOutlets, allLogs] = await Promise.all([
        db.getInventory(scopeId, isProperty),
        db.getSales(scopeId, isProperty),
        db.getOutlets(),
        db.getInventoryLogs(scopeId, isProperty)
      ]);

      const oMap: Record<string, string> = {};
      allOutlets.forEach(o => oMap[o.id] = o.name);
      setOutletsMap(oMap);

      const retailItems = allItems.filter(item => item.category === 'Retail');
      setInventory(retailItems);
      setSales(allSales);
      setInventoryLogs(allLogs);

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

    const relevantItems = inventory.filter(item => {
        if (!item.created_at) return true;
        const createdDate = parseISO(item.created_at);
        return isBefore(createdDate, monthEnd); 
    });

    const itemStats: ItemStockSummary[] = relevantItems.map(item => {
        const currentStock = item.stock_quantity || 0;
        const itemSales = sales.filter(s => s.item_id === item.id);
        const itemLogs = inventoryLogs.filter(l => l.item_id === item.id);

        // Calculate changes AFTER the target month to reverse-engineer closing stock
        const salesAfter = itemSales
            .filter(s => isAfter(parseISO(s.created_at), monthEnd))
            .reduce((sum, s) => sum + s.quantity, 0);

        const logsAfter = itemLogs
            .filter(l => isAfter(parseISO(l.created_at), monthEnd))
            .reduce((sum, l) => sum + l.change_amount, 0);

        // Calculate changes DURING the target month
        const salesDuringEvents = itemSales.filter(s => isSameMonth(parseISO(s.created_at), selectedMonth));
        const salesDuringQty = salesDuringEvents.reduce((sum, s) => sum + s.quantity, 0);
        const salesDuringRevenue = salesDuringEvents.reduce((sum, s) => sum + s.net_amount, 0);

        const logsDuring = itemLogs.filter(l => isSameMonth(parseISO(l.created_at), selectedMonth));
        
        const restockedDuring = logsDuring
            .filter(l => l.change_amount > 0 && l.reason === 'Restock')
            .reduce((sum, l) => sum + l.change_amount, 0);
            
        const adjustmentsDuring = logsDuring
            .filter(l => l.reason === 'Adjustment' || (l.change_amount < 0 && l.reason !== 'Sale'))
            .reduce((sum, l) => sum + l.change_amount, 0);

        const netLogChangeDuring = logsDuring.reduce((sum, l) => sum + l.change_amount, 0);

        // Closing Stock = Current + Sales After - Net Log Changes After
        const closingStock = currentStock + salesAfter - logsAfter;
        
        // Opening Stock = Closing + Sales During - Net Log Changes During
        const openingStock = closingStock + salesDuringQty - netLogChangeDuring;

        let status: 'Low' | 'Good' | 'Overstock' = 'Good';
        if (closingStock <= 5) status = 'Low';
        if (closingStock > 50) status = 'Overstock';

        return {
            itemId: item.id,
            itemName: item.name,
            outletName: outletsMap[item.outlet_id] || 'Unknown',
            category: item.category,
            unitPrice: item.price,
            openingStock,
            sold: salesDuringQty,
            salesRevenue: salesDuringRevenue,
            restocked: restockedDuring,
            adjustments: adjustmentsDuring,
            closingStock,
            closingValue: closingStock * item.price,
            status
        };
    });

    return itemStats.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [inventory, sales, inventoryLogs, selectedMonth, outletsMap]);

  const summary = useMemo(() => {
      return {
          totalRevenue: reportData.reduce((sum, item) => sum + item.salesRevenue, 0),
          totalStockValue: reportData.reduce((sum, item) => sum + item.closingValue, 0),
          totalItemsSold: reportData.reduce((sum, item) => sum + item.sold, 0),
          totalRestocked: reportData.reduce((sum, item) => sum + item.restocked, 0)
      };
  }, [reportData]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Retail_Stock_Ledger_${format(selectedMonth, 'MMM_yyyy')}`,
    pageStyle: `
      @page { size: landscape; margin: 15mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      }
    `
  });

  const getDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        } else {
            reject('Canvas context not found');
        }
      };
      img.onerror = (error) => reject(error);
    });
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF('landscape');
    
    let startY = 40;
    
    if (currentProperty?.logo_url) {
        try {
            const logoData = await getDataUrl(currentProperty.logo_url);
            doc.addImage(logoData, 'PNG', 14, 10, 25, 25);
            startY = 50;
        } catch (e) {
            console.error("Failed to load logo for PDF", e);
        }
    }

    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39); // Slate 900
    doc.text(currentProperty?.name || 'Property Name', 14, startY - 20);
    
    doc.setFontSize(14);
    doc.setTextColor(75, 85, 99); // Slate 600
    doc.text('Retail Stock Ledger', 14, startY - 12);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Slate 500
    doc.text(`Period: ${format(selectedMonth, 'MMMM yyyy')}`, 14, startY - 5);
    doc.text(`Scope: ${viewScope === 'property' ? 'All Outlets' : currentOutlet?.name}`, 14, startY);

    // Summary Box in PDF
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, startY + 5, 269, 20, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Total Revenue', 20, startY + 12);
    doc.text('Stock Value', 90, startY + 12);
    doc.text('Items Sold', 160, startY + 12);
    doc.text('Restocked', 230, startY + 12);

    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.font = "helvetica";
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(summary.totalRevenue), 20, startY + 19);
    doc.text(formatMoney(summary.totalStockValue), 90, startY + 19);
    doc.text(summary.totalItemsSold.toString(), 160, startY + 19);
    doc.text(summary.totalRestocked.toString(), 230, startY + 19);

    const tableColumn = [
        "Item Name", 
        "Price", 
        "Opening", 
        "Restocked", 
        "Sold", 
        "Adj.", 
        "Closing", 
        "Value", 
        "Status"
    ];

    const tableRows = reportData.map(item => [
      item.itemName,
      formatMoney(item.unitPrice),
      item.openingStock,
      item.restocked > 0 ? `+${item.restocked}` : '-',
      item.sold > 0 ? `-${item.sold}` : '-',
      item.adjustments !== 0 ? (item.adjustments > 0 ? `+${item.adjustments}` : item.adjustments) : '-',
      item.closingStock,
      formatMoney(item.closingValue),
      item.status
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startY + 35,
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' }, // Item
          1: { halign: 'right' }, // Price
          2: { halign: 'center' }, // Opening
          3: { halign: 'center', textColor: [79, 70, 229] }, // Restocked
          4: { halign: 'center', textColor: [5, 150, 105] }, // Sold
          5: { halign: 'center', textColor: [220, 38, 38] }, // Adj
          6: { halign: 'center', fontStyle: 'bold' }, // Closing
          7: { halign: 'right', fontStyle: 'bold' }, // Value
          8: { halign: 'center' } // Status
      },
      didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 8) {
              if (data.cell.raw === 'Low') {
                  data.cell.styles.textColor = [220, 38, 38];
              } else if (data.cell.raw === 'Overstock') {
                  data.cell.styles.textColor = [217, 119, 6];
              } else {
                  data.cell.styles.textColor = [5, 150, 105];
              }
          }
      }
    });

    doc.save(`Retail_Stock_Ledger_${format(selectedMonth, 'yyyy-MM')}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Stock Ledger</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Retail Inventory</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Monthly Audit Report</span>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={handlePrint} className="h-12 px-6 rounded-xl border-slate-200 hover:border-indigo-600 hover:text-indigo-600 transition-all gap-2 font-bold uppercase text-[10px] tracking-widest">
             <Printer className="w-4 h-4" /> Print Report
           </Button>
           <Button onClick={handleDownloadPDF} className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 gap-2 font-bold uppercase text-[10px] tracking-widest">
             <FileText className="w-4 h-4" /> Export PDF
           </Button>
           <Button variant="ghost" onClick={() => window.history.back()} className="h-12 w-12 rounded-xl border border-transparent hover:bg-slate-100 flex items-center justify-center">
             <ArrowLeft className="w-5 h-5 text-slate-400" />
           </Button>
        </div>
      </div>

      {/* Report Container */}
      <div ref={printRef} className="print:p-8 bg-white print:bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
        
        {/* Print Header */}
        <div className="hidden print:flex flex-col items-center mb-10 border-b border-slate-100 pb-8">
            {currentProperty?.logo_url && (
                <img src={currentProperty.logo_url} alt="Property Logo" className="h-20 mb-6 object-contain" />
            )}
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">{currentProperty?.name}</h1>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Retail Stock Ledger</h2>
            <div className="flex gap-12 mt-6 text-xs font-bold text-slate-600 bg-slate-50 px-8 py-3 rounded-full">
                <span>PERIOD: <span className="text-slate-900">{format(selectedMonth, 'MMMM yyyy')}</span></span>
                <span>SCOPE: <span className="text-slate-900">{viewScope === 'property' ? 'All Outlets' : currentOutlet?.name}</span></span>
                <span>GENERATED: <span className="text-slate-900">{format(new Date(), 'dd MMM yyyy HH:mm')}</span></span>
            </div>
        </div>

        {/* Controls & Summary */}
        <div className="p-8 bg-slate-50/50 border-b border-slate-100">
           <div className="flex flex-col xl:flex-row gap-8 justify-between items-start xl:items-center mb-8 no-print">
              
              {/* Scope & Date Controls */}
              <div className="flex flex-wrap gap-4">
                  <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                      <button onClick={() => setViewScope('outlet')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'outlet' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                          <Store className="w-3.5 h-3.5" /> Outlet
                      </button>
                      <button onClick={() => setViewScope('property')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'property' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                          <Building2 className="w-3.5 h-3.5" /> Property
                      </button>
                  </div>

                  <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                      <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                      <div className="flex items-center gap-3 px-4 min-w-[160px] justify-center border-x border-slate-100 h-6">
                           <Calendar className="w-4 h-4 text-indigo-600" />
                           <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{format(selectedMonth, 'MMMM yyyy')}</span>
                      </div>
                      <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight className="w-5 h-5"/></button>
                  </div>
              </div>
           </div>

           {/* KPI Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Revenue</p>
                   <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(summary.totalRevenue)}</h3>
                       <TrendingUp className="w-4 h-4 text-emerald-500" />
                   </div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Stock Asset Value</p>
                   <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-black text-indigo-600 tracking-tighter">{formatMoney(summary.totalStockValue)}</h3>
                   </div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Volume Sold</p>
                   <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalItemsSold} <span className="text-sm font-bold text-slate-400">Units</span></h3>
                       <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                   </div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Restocked Volume</p>
                   <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalRestocked} <span className="text-sm font-bold text-slate-400">Units</span></h3>
                       <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                   </div>
               </div>
           </div>
        </div>

        {/* Data Table */}
        <div className="p-0">
           {loading ? (
               <div className="flex flex-col items-center justify-center h-96 gap-4">
                   <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compiling Ledger Data...</p>
               </div>
           ) : (
               <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-[0.2em]">
                           <tr>
                               <th className="px-8 py-6 rounded-tl-xl">Item Description</th>
                               {viewScope === 'property' && <th className="px-6 py-6">Outlet</th>}
                               <th className="px-6 py-6 text-right">Unit Price</th>
                               <th className="px-6 py-6 text-center bg-slate-800/50">Opening</th>
                               <th className="px-6 py-6 text-center text-indigo-300">Restocked</th>
                               <th className="px-6 py-6 text-center text-emerald-300">Sold</th>
                               <th className="px-6 py-6 text-center text-amber-300">Adj.</th>
                               <th className="px-6 py-6 text-center bg-slate-800/50">Closing</th>
                               <th className="px-8 py-6 text-right">Asset Value</th>
                               <th className="px-8 py-6 text-center rounded-tr-xl">Status</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {reportData.length === 0 ? (
                               <tr>
                                   <td colSpan={viewScope === 'property' ? 10 : 9} className="px-8 py-24 text-center">
                                       <div className="flex flex-col items-center gap-4 opacity-50">
                                           <Package className="w-12 h-12 text-slate-300" />
                                           <p className="text-slate-400 font-bold uppercase tracking-widest">No retail inventory records found for this period.</p>
                                       </div>
                                   </td>
                               </tr>
                           ) : (
                               reportData.map((row, idx) => (
                                   <tr key={row.itemId} className={`hover:bg-indigo-50/30 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                       <td className="px-8 py-5">
                                           <div className="flex items-center gap-4">
                                               <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm no-print">
                                                   <Package className="w-5 h-5" />
                                               </div>
                                               <div>
                                                   <div className="font-black text-slate-900 uppercase text-xs tracking-tight">{row.itemName}</div>
                                                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{row.category}</div>
                                               </div>
                                           </div>
                                       </td>
                                       {viewScope === 'property' && (
                                           <td className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                               {row.outletName}
                                           </td>
                                       )}
                                       <td className="px-6 py-5 text-right font-mono text-slate-600 font-bold text-xs">{formatMoney(row.unitPrice)}</td>
                                       
                                       <td className="px-6 py-5 text-center font-mono text-slate-400 font-bold bg-slate-50/50 border-x border-slate-100/50">{row.openingStock}</td>
                                       
                                       <td className="px-6 py-5 text-center">
                                           {row.restocked > 0 ? (
                                               <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-xs">+{row.restocked}</span>
                                           ) : <span className="text-slate-200 font-mono">-</span>}
                                       </td>
                                       
                                       <td className="px-6 py-5 text-center">
                                           {row.sold > 0 ? (
                                               <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs">-{row.sold}</span>
                                           ) : <span className="text-slate-200 font-mono">-</span>}
                                       </td>

                                       <td className="px-6 py-5 text-center">
                                           {row.adjustments !== 0 ? (
                                               <span className={`inline-flex items-center px-2 py-1 rounded-md font-mono font-bold text-xs ${row.adjustments > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                                                   {row.adjustments > 0 ? '+' : ''}{row.adjustments}
                                               </span>
                                           ) : <span className="text-slate-200 font-mono">-</span>}
                                       </td>
                                       
                                       <td className="px-6 py-5 text-center font-mono text-slate-900 font-black text-sm bg-slate-50/50 border-x border-slate-100/50">{row.closingStock}</td>
                                       
                                       <td className="px-8 py-5 text-right font-mono text-slate-900 font-black text-xs">{formatMoney(row.closingValue)}</td>
                                       
                                       <td className="px-8 py-5 text-center">
                                           {row.status === 'Low' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-100"><AlertCircle className="w-3 h-3" /> Low</span>}
                                           {row.status === 'Overstock' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100"><Package className="w-3 h-3" /> High</span>}
                                           {row.status === 'Good' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                                       </td>
                                   </tr>
                               ))
                           )}
                       </tbody>
                   </table>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default RetailStockReport;
