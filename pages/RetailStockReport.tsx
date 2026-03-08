
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

  const groupedData = useMemo(() => {
    const groups: Record<string, ItemStockSummary[]> = {};
    reportData.forEach(item => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });
    return groups;
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
        .print-only.grid { display: grid !important; }
        .print-only.flex { display: flex !important; }
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    
    let startY = 15;
    
    // Professional Header Background (Subtle)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 65, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 65, pageWidth, 65);

    // Logo
    if (currentProperty?.logo_url) {
        try {
            const logoData = await getDataUrl(currentProperty.logo_url);
            const logoWidth = 25;
            const logoHeight = 25;
            const logoX = centerX - (logoWidth / 2);
            doc.addImage(logoData, 'PNG', logoX, startY, logoWidth, logoHeight);
            startY += 32;
        } catch (e) {
            console.error("Failed to load logo for PDF", e);
            startY += 5;
        }
    } else {
        // Fallback Icon/Placeholder if logo fails
        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.5);
        doc.circle(centerX, startY + 10, 8, 'S');
        doc.setFontSize(12);
        doc.text("H", centerX, startY + 11.5, { align: 'center' });
        startY += 25;
    }

    // Header Text
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); 
    doc.setFont("helvetica", "bold");
    doc.text((currentProperty?.name || 'Property Name').toUpperCase(), centerX, startY, { align: 'center' });
    
    startY += 8;
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105); 
    doc.setFont("helvetica", "bold");
    doc.text('RETAIL STOCK LEDGER', centerX, startY, { align: 'center', charSpace: 2 });
    
    startY += 8;
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    const metadata = `PERIOD: ${format(selectedMonth, 'MMMM yyyy').toUpperCase()}   |   SCOPE: ${(viewScope === 'property' ? 'ALL OUTLETS' : currentOutlet?.name || '').toUpperCase()}   |   GENERATED: ${format(new Date(), 'dd MMM yyyy HH:mm').toUpperCase()}`;
    doc.text(metadata, centerX, startY, { align: 'center' });

    // Summary Section (Advanced Cards)
    startY = 75;
    const cardWidth = 62;
    const cardHeight = 22;
    const gap = 8;
    const totalWidth = (cardWidth * 4) + (gap * 3);
    let startX = (pageWidth - totalWidth) / 2;

    const drawAdvancedCard = (label: string, value: string, x: number, accentColor: [number, number, number]) => {
        // Shadow effect
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x + 1, startY + 1, cardWidth, cardHeight, 4, 4, 'F');
        
        // Card Body
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 4, 4, 'FD');
        
        // Accent Line
        doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.setLineWidth(1.5);
        doc.line(x + 5, startY + 4, x + 15, startY + 4);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(label, x + (cardWidth/2), startY + 9, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(value, x + (cardWidth/2), startY + 17, { align: 'center' });
    };

    drawAdvancedCard('TOTAL REVENUE', formatMoney(summary.totalRevenue), startX, [16, 185, 129]);
    drawAdvancedCard('STOCK VALUE', formatMoney(summary.totalStockValue), startX + cardWidth + gap, [79, 70, 229]);
    drawAdvancedCard('ITEMS SOLD', summary.totalItemsSold.toString(), startX + (cardWidth + gap) * 2, [245, 158, 11]);
    drawAdvancedCard('RESTOCKED', summary.totalRestocked.toString(), startX + (cardWidth + gap) * 3, [59, 130, 246]);

    const tableColumn = [
        "Item Name", 
        "Price", 
        "Opening", 
        "Restocked", 
        "Sold Qty", 
        "Sold Value",
        "Adj.", 
        "Closing", 
        "Value", 
        "Status"
    ];

    const tableRows: any[] = [];

    Object.entries(groupedData).forEach(([category, items]) => {
        const categoryItems = items as ItemStockSummary[];
        // Add Category Header Row
        tableRows.push([{ 
            content: category.toUpperCase(), 
            colSpan: 10, 
            styles: { 
                fillColor: [241, 245, 249], 
                textColor: [30, 41, 59], 
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 4
            } 
        }]);
        
        categoryItems.forEach(item => {
            tableRows.push([
                item.itemName,
                formatMoney(item.unitPrice),
                item.openingStock,
                item.restocked > 0 ? `+${item.restocked}` : '-',
                item.sold > 0 ? `-${item.sold}` : '-',
                item.salesRevenue > 0 ? formatMoney(item.salesRevenue) : '-',
                item.adjustments !== 0 ? (item.adjustments > 0 ? `+${item.adjustments}` : item.adjustments) : '-',
                item.closingStock,
                formatMoney(item.closingValue),
                item.status
            ]);
        });
    });

    // Add Grand Total Row
    tableRows.push([
        { content: 'GRAND TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, fontSize: 10 } },
        { content: reportData.reduce((sum, i) => sum + i.openingStock, 0).toString(), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 10 } },
        { content: summary.totalRestocked.toString(), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 10 } },
        { content: summary.totalItemsSold.toString(), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 10 } },
        { content: formatMoney(summary.totalRevenue), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'right', fontSize: 10 } },
        { content: '-', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 10 } },
        { content: reportData.reduce((sum, i) => sum + i.closingStock, 0).toString(), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'center', fontSize: 10 } },
        { content: formatMoney(summary.totalStockValue), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255, halign: 'right', fontSize: 10 } },
        { content: '', styles: { fillColor: [15, 23, 42] } }
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startY + 32,
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle', font: 'helvetica' },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
      columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 }, // Item
          1: { halign: 'right' }, // Price
          2: { halign: 'center' }, // Opening
          3: { halign: 'center', textColor: [79, 70, 229] }, // Restocked
          4: { halign: 'center', textColor: [16, 185, 129] }, // Sold Qty
          5: { halign: 'right', textColor: [16, 185, 129] }, // Sold Value
          6: { halign: 'center', textColor: [239, 68, 68] }, // Adj
          7: { halign: 'center', fontStyle: 'bold' }, // Closing
          8: { halign: 'right', fontStyle: 'bold' }, // Value
          9: { halign: 'center' } // Status
      },
      didDrawPage: (data) => {
          // Footer
          const footerY = doc.internal.pageSize.getHeight() - 15;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${data.pageNumber}`, pageWidth - 20, footerY);
          doc.text(`Retail Stock Ledger - Confidential Document`, 14, footerY);
          
          // Signature Lines (Only on last page)
          if (data.pageNumber === doc.getNumberOfPages()) {
              const sigY = footerY - 20;
              doc.setDrawColor(203, 213, 225);
              doc.line(14, sigY, 70, sigY);
              doc.text("PREPARED BY", 14, sigY + 5);
              
              doc.line(pageWidth - 70, sigY, pageWidth - 14, sigY);
              doc.text("AUTHORIZED SIGNATURE", pageWidth - 70, sigY + 5);
          }
      }
    });

    doc.save(`Retail_Stock_Ledger_${format(selectedMonth, 'yyyy-MM')}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* App Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Stock Ledger</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">Retail Inventory</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Monthly Audit Report</span>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={handlePrint} className="h-12 px-6 rounded-xl border-slate-200 hover:border-indigo-600 hover:text-indigo-600 transition-all gap-2 font-bold uppercase text-[10px] tracking-widest shadow-sm">
             <Printer className="w-4 h-4" /> Print Report
           </Button>
           <Button onClick={handleDownloadPDF} className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 gap-2 font-bold uppercase text-[10px] tracking-widest">
             <FileText className="w-4 h-4" /> Export PDF
           </Button>
           <Button variant="ghost" onClick={() => window.history.back()} className="h-12 w-12 rounded-xl border border-slate-100 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
             <ArrowLeft className="w-5 h-5" />
           </Button>
        </div>
      </div>

      {/* Report Card */}
      <div ref={printRef}>
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
          
          {/* Advanced Report Header (Visible in Print Only) */}
          <div className="hidden print:flex print-only flex-col items-center pt-12 pb-8 border-b-2 border-slate-900 bg-white">
              <div className="mb-6">
                  {currentProperty?.logo_url ? (
                      <img src={currentProperty.logo_url} alt="Property Logo" className="h-24 object-contain" />
                  ) : (
                      <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <Building2 className="w-10 h-10" />
                      </div>
                  )}
              </div>
              
              <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1">{currentProperty?.name || 'Property Name'}</h1>
              <h2 className="text-xl font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Retail Stock Ledger</h2>
              
              <div className="flex gap-12 border-t border-b border-slate-200 py-4 w-full justify-center">
                  <div className="text-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Period</span>
                      <span className="text-sm font-bold text-slate-900 uppercase">{format(selectedMonth, 'MMMM yyyy')}</span>
                  </div>
                  <div className="text-center border-l border-slate-200 pl-12">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Scope</span>
                      <span className="text-sm font-bold text-slate-900 uppercase">{viewScope === 'property' ? 'All Outlets' : currentOutlet?.name}</span>
                  </div>
                  <div className="text-center border-l border-slate-200 pl-12">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Generated</span>
                      <span className="text-sm font-bold text-slate-900 uppercase">{format(new Date(), 'dd MMM yyyy')}</span>
                  </div>
              </div>
          </div>

          {/* Advanced Summary Section (Visible in Print Only) */}
          <div className="hidden print:grid print-only grid-cols-4 gap-4 p-8 bg-white border-b border-slate-200">
              {[
                  { label: 'Total Revenue', value: formatMoney(summary.totalRevenue) },
                  { label: 'Asset Value', value: formatMoney(summary.totalStockValue) },
                  { label: 'Units Sold', value: summary.totalItemsSold },
                  { label: 'Units Restocked', value: summary.totalRestocked }
              ].map((card, i) => (
                  <div key={i} className="p-4 border border-slate-200 rounded-lg flex flex-col items-center text-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</span>
                      <span className="text-xl font-black text-slate-900">{card.value}</span>
                  </div>
              ))}
          </div>

          {/* Controls (Web Only) */}
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 no-print">
             <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
                <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <button onClick={() => setViewScope('outlet')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'outlet' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <Store className="w-3.5 h-3.5" /> Outlet
                    </button>
                    <button onClick={() => setViewScope('property')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'property' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <Building2 className="w-3.5 h-3.5" /> Property
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                    <div className="flex items-center gap-3 px-6 min-w-[180px] justify-center h-10 border-x border-slate-100">
                         <Calendar className="w-4 h-4 text-indigo-600" />
                         <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{format(selectedMonth, 'MMMM yyyy')}</span>
                    </div>
                    <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight className="w-5 h-5"/></button>
                </div>
             </div>
          </div>

          {/* KPI Cards (Web Only) */}
          <div className="p-8 bg-slate-50/30 border-b border-slate-100 no-print">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                             <TrendingUp className="w-6 h-6" />
                         </div>
                         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Revenue</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(summary.totalRevenue)}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Total Sales</p>
                 </div>

                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                             <Package className="w-6 h-6" />
                         </div>
                         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Asset Value</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(summary.totalStockValue)}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Current Inventory</p>
                 </div>

                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                             <ArrowDownRight className="w-6 h-6" />
                         </div>
                         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Outflow</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalItemsSold}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Units Sold</p>
                 </div>

                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                             <ArrowUpRight className="w-6 h-6" />
                         </div>
                         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Inflow</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalRestocked}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Units Restocked</p>
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
                                 <th className="px-8 py-6">Item Description</th>
                                 {viewScope === 'property' && <th className="px-6 py-6">Outlet</th>}
                                 <th className="px-6 py-6 text-right">Unit Price</th>
                                 <th className="px-6 py-6 text-center bg-slate-800/50">Opening</th>
                                 <th className="px-6 py-6 text-center text-indigo-300">Restocked</th>
                                 <th className="px-6 py-6 text-center text-emerald-300">Sold Qty</th>
                                 <th className="px-6 py-6 text-right text-emerald-300">Sold Value</th>
                                 <th className="px-6 py-6 text-center text-amber-300">Adj.</th>
                                 <th className="px-6 py-6 text-center bg-slate-800/50">Closing</th>
                                 <th className="px-8 py-6 text-right">Asset Value</th>
                                 <th className="px-8 py-6 text-center">Status</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {reportData.length === 0 ? (
                                 <tr>
                                     <td colSpan={viewScope === 'property' ? 11 : 10} className="px-8 py-24 text-center">
                                         <div className="flex flex-col items-center gap-4 opacity-50">
                                             <Package className="w-16 h-16 text-slate-200" />
                                             <p className="text-slate-400 font-bold uppercase tracking-widest">No retail inventory records found for this period.</p>
                                         </div>
                                     </td>
                                 </tr>
                             ) : (
                                 <>
                                     {Object.entries(groupedData).map(([category, items]) => {
                                         const categoryItems = items as ItemStockSummary[];
                                         return (
                                             <React.Fragment key={category}>
                                                 <tr className="bg-slate-50/80 border-y border-slate-100">
                                                     <td colSpan={viewScope === 'property' ? 11 : 10} className="px-8 py-3">
                                                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                             {category}
                                                         </span>
                                                     </td>
                                                 </tr>
                                                 {categoryItems.map((row, idx) => (
                                                     <tr key={row.itemId} className={`hover:bg-indigo-50/30 transition-colors group bg-white`}>
                                                         <td className="px-8 py-4">
                                                             <div className="flex items-center gap-4">
                                                                 <div className="font-bold text-slate-900 text-xs">{row.itemName}</div>
                                                             </div>
                                                         </td>
                                                         {viewScope === 'property' && (
                                                             <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                                 {row.outletName}
                                                             </td>
                                                         )}
                                                         <td className="px-6 py-4 text-right font-mono text-slate-600 font-bold text-xs">{formatMoney(row.unitPrice)}</td>
                                                         
                                                         <td className="px-6 py-4 text-center font-mono text-slate-400 font-bold bg-slate-50/50 border-x border-slate-100/50">{row.openingStock}</td>
                                                         
                                                         <td className="px-6 py-4 text-center">
                                                             {row.restocked > 0 ? (
                                                                 <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-xs">+{row.restocked}</span>
                                                             ) : <span className="text-slate-200 font-mono">-</span>}
                                                         </td>
                                                         
                                                         <td className="px-6 py-4 text-center">
                                                             {row.sold > 0 ? (
                                                                 <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs">-{row.sold}</span>
                                                             ) : <span className="text-slate-200 font-mono">-</span>}
                                                         </td>

                                                         <td className="px-6 py-4 text-right">
                                                             {row.sold > 0 ? (
                                                                 <span className="font-mono font-bold text-emerald-600 text-xs">{formatMoney(row.salesRevenue)}</span>
                                                             ) : <span className="text-slate-200 font-mono">-</span>}
                                                         </td>

                                                         <td className="px-6 py-4 text-center">
                                                             {row.adjustments !== 0 ? (
                                                                 <span className={`inline-flex items-center px-2 py-1 rounded-md font-mono font-bold text-xs ${row.adjustments > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                     {row.adjustments > 0 ? '+' : ''}{row.adjustments}
                                                                 </span>
                                                             ) : <span className="text-slate-200 font-mono">-</span>}
                                                         </td>
                                                         
                                                         <td className="px-6 py-4 text-center font-mono text-slate-900 font-black text-sm bg-slate-50/50 border-x border-slate-100/50">{row.closingStock}</td>
                                                         
                                                         <td className="px-8 py-4 text-right font-mono text-slate-900 font-black text-xs">{formatMoney(row.closingValue)}</td>
                                                         
                                                         <td className="px-8 py-4 text-center">
                                                             {row.status === 'Low' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-100"><AlertCircle className="w-3 h-3" /> Low</span>}
                                                             {row.status === 'Overstock' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100"><Package className="w-3 h-3" /> High</span>}
                                                             {row.status === 'Good' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </React.Fragment>
                                         );
                                     })}
                                     {/* Grand Total Row */}
                                     <tr className="bg-slate-900 text-white border-t-4 border-indigo-600">
                                         <td colSpan={viewScope === 'property' ? 3 : 2} className="px-8 py-6 font-black uppercase text-xs tracking-widest text-right">Grand Total</td>
                                         <td className="px-6 py-6 text-center font-mono font-bold text-slate-400">{reportData.reduce((sum, i) => sum + i.openingStock, 0)}</td>
                                         <td className="px-6 py-6 text-center font-mono font-bold text-indigo-300">{summary.totalRestocked}</td>
                                         <td className="px-6 py-6 text-center font-mono font-bold text-emerald-300">{summary.totalItemsSold}</td>
                                         <td className="px-6 py-6 text-right font-mono font-bold text-emerald-300">{formatMoney(summary.totalRevenue)}</td>
                                         <td className="px-6 py-6"></td>
                                         <td className="px-6 py-6 text-center font-mono font-black text-white text-lg">{reportData.reduce((sum, i) => sum + i.closingStock, 0)}</td>
                                         <td className="px-8 py-6 text-right font-mono font-black text-white text-lg">{formatMoney(summary.totalStockValue)}</td>
                                         <td></td>
                                     </tr>
                                 </>
                             )}
                         </tbody>
                     </table>
                 </div>
             )}
          </div>

          {/* Report Footer (Visible in Print Only) */}
          <div className="hidden print:block p-12 bg-white border-t border-slate-100">
              <div className="grid grid-cols-2 gap-24 mt-12">
                  <div className="flex flex-col gap-2">
                      <div className="h-px w-full bg-slate-300"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepared By / Store Manager</span>
                  </div>
                  <div className="flex flex-col gap-2">
                      <div className="h-px w-full bg-slate-300"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature / General Manager</span>
                  </div>
              </div>
              <div className="mt-16 text-center">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">Confidential Inventory Audit Document - {format(new Date(), 'yyyy')}</p>
              </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RetailStockReport;
