
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, Button, ConfirmationModal } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { 
  Package, 
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
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isSameMonth, addMonths, subMonths } from 'date-fns';
import { Sale, InventoryItem, InventoryLog } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import RetailStockReportPrint from '../components/RetailStockReportPrint';

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

interface RetailStockReportProps {
  embeddedViewScope?: 'outlet' | 'property';
  isEmbedded?: boolean;
}

const RetailStockReport = ({ embeddedViewScope, isEmbedded }: RetailStockReportProps = {}) => {
  const { currentOutlet, currentProperty, formatMoney, setPageLoading, currency } = useSettings();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [internalViewScope, setInternalViewScope] = useState<'outlet' | 'property'>('outlet');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [outletsMap, setOutletsMap] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const viewScope = embeddedViewScope || internalViewScope;
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentOutlet && currentProperty) {
      loadData();
    } else if (!currentOutlet || !currentProperty) {
      setLoading(false);
    }
  }, [currentOutlet, currentProperty, viewScope]);

  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    setPageLoading(true);
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
      setPageLoading(false);
    }
  };

  const reportData = useMemo(() => {
    if (!inventory.length) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // Pre-group sales and logs by item_id for O(N) lookup
    const salesByItem: Record<string, Sale[]> = {};
    sales.forEach(s => {
      if (s.item_id) {
        if (!salesByItem[s.item_id]) salesByItem[s.item_id] = [];
        salesByItem[s.item_id].push(s);
      }
    });

    const logsByItem: Record<string, InventoryLog[]> = {};
    inventoryLogs.forEach(l => {
      if (!logsByItem[l.item_id]) logsByItem[l.item_id] = [];
      logsByItem[l.item_id].push(l);
    });

    const relevantItems = inventory.filter(item => {
        if (!item.created_at) return true;
        const createdDate = parseISO(item.created_at);
        return isBefore(createdDate, monthEnd); 
    });

    const itemStats: ItemStockSummary[] = relevantItems.map(item => {
        const currentStock = item.stock_quantity || 0;
        const itemSales = salesByItem[item.id] || [];
        const itemLogs = logsByItem[item.id] || [];

        // Sort logs by date ascending 
        const sortedLogs = [...itemLogs].sort((a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());

        // Find the state at month end
        const logsBeforeOrDuringEnd = sortedLogs.filter(l => !isAfter(parseISO(l.created_at), monthEnd));
        const lastLogBeforeEnd = logsBeforeOrDuringEnd[logsBeforeOrDuringEnd.length - 1];

        // Find the state at month start
        const logsBeforeStart = sortedLogs.filter(l => isBefore(parseISO(l.created_at), monthStart));
        const lastLogBeforeStart = logsBeforeStart[logsBeforeStart.length - 1];

        let closingStockCalc: number;
        if (lastLogBeforeEnd) {
            closingStockCalc = lastLogBeforeEnd.new_stock;
        } else {
            // Reverse engineer from current stock using logs and sales
            const logsAfter = itemLogs.filter(l => isAfter(parseISO(l.created_at), monthEnd));
            const salesAfter = itemSales.filter(s => {
                const saleDate = parseISO(s.created_at);
                const hasLog = logsAfter.some(l => l.notes && l.notes.includes(s.id));
                return isAfter(saleDate, monthEnd) && !hasLog;
            });

            const netLogChangeAfter = logsAfter.reduce((sum, l) => sum + l.change_amount, 0);
            const salesAfterQty = salesAfter.reduce((sum, s) => sum + s.quantity, 0);
            
            closingStockCalc = currentStock + salesAfterQty - netLogChangeAfter;
        }

        let openingStockCalc: number;
        if (lastLogBeforeStart) {
            openingStockCalc = lastLogBeforeStart.new_stock;
        } else {
            // Reverse engineer from closing stock 
            const logsDuring = itemLogs.filter(l => isSameMonth(parseISO(l.created_at), selectedMonth));
            
            const salesDuring = itemSales.filter(s => {
                const saleDate = parseISO(s.created_at);
                const hasLog = logsDuring.some(l => l.notes && l.notes.includes(s.id));
                return isSameMonth(saleDate, selectedMonth) && !hasLog;
            });

            const netLogChangeDuring = logsDuring.reduce((sum, l) => sum + l.change_amount, 0);
            const salesDuringQty = salesDuring.reduce((sum, s) => sum + s.quantity, 0);

            openingStockCalc = closingStockCalc + salesDuringQty - netLogChangeDuring;
        }

        // Calculate metrics DURING the target month
        const salesEventsMonth = itemSales.filter(s => isSameMonth(parseISO(s.created_at), selectedMonth));
        const soldQty = salesEventsMonth.reduce((sum, s) => sum + s.quantity, 0);
        const revenue = salesEventsMonth.reduce((sum, s) => sum + s.net_amount, 0);

        const logsDuringMonth = itemLogs.filter(l => isSameMonth(parseISO(l.created_at), selectedMonth));
        
        let restocked = 0;
        let adjustments = 0;
        let adjustedOpeningStock = openingStockCalc;

        logsDuringMonth.forEach(l => {
            const reason = (l.reason || '').toLowerCase();
            const isInitial = reason === 'initial';
            const isRestock = reason === 'restock' || reason === 'initial'; // Count initial as restock by default
            
            if (l.change_amount > 0) {
                // If it's the first month and we have an initial log, 
                // treat it as opening stock if openingStock is otherwise 0
                if (isInitial && !lastLogBeforeStart && adjustedOpeningStock === 0) {
                    adjustedOpeningStock = l.change_amount;
                } else if (isRestock) {
                    restocked += l.change_amount;
                }
            } else if (l.change_amount < 0 && reason !== 'sale') {
                adjustments += l.change_amount;
            } else if (reason === 'adjustment') {
                adjustments += l.change_amount;
            }
        });

        // Final verification: Closing = Opening + Restocked + Adjustments - Sold
        // If we moved things into Opening, we must ensure consistency
        const finalOpening = Math.max(0, adjustedOpeningStock);
        const finalClosing = Math.max(0, closingStockCalc);

        let status: 'Low' | 'Good' | 'Overstock' = 'Good';
        if (finalClosing <= 5) status = 'Low';
        else if (finalClosing > 50) status = 'Overstock';

        return {
            itemId: item.id,
            itemName: item.name,
            outletName: outletsMap[item.outlet_id] || 'Unknown',
            category: item.category,
            unitPrice: item.price,
            openingStock: finalOpening,
            sold: soldQty,
            salesRevenue: revenue,
            restocked: restocked,
            adjustments: adjustments,
            closingStock: finalClosing,
            closingValue: Math.max(0, finalClosing * item.price),
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

  const handlePrint = () => {
    window.print();
  };

  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Add a timeout to prevent hanging
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image load timeout'));
      }, 5000);

      img.src = url;
      img.onload = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          }
        } else {
          reject('Canvas context not found');
        }
      };
      img.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  };

  const formatMoneyForPDF = (amount: number) => {
    const formatted = formatMoney(amount);
    // jsPDF default fonts only support WinAnsiEncoding (mostly Latin-1).
    // Symbols like 'ر.ق' (Qatari Riyal) will render as garbled text (e.g. þÕ.þ-).
    // We check if the formatted string contains characters outside the safe range.
    // If it does, we fallback to the currency code (e.g. QAR) to ensure the PDF is readable.
    if (/[^\x00-\xFF\u20AC]/.test(formatted)) {
      const matches = formatted.match(/[\d,.]+/g);
      const numericPart = matches ? matches.join('') : '0.00';
      const cleanNumeric = numericPart.replace(/^\.+|\.+$/g, '');
      return `${currency?.code || ''} ${cleanNumeric}`.trim();
    }
    return formatted;
  };

  const getSafeLogoUrl = (url: string) => {
    if (!url) return '';
    if (!url.startsWith('http')) return url;
    // We'll try to use the proxy but also allow direct loading as a fallback
    // In the <img> tag we can't easily fallback, so we'll just provide the direct URL
    // and let the browser handle it if CORS is allowed, otherwise we use proxy.
    return url;
  };

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let logoAdded = false;
      
      // 0. Add Logo if available
      if (currentProperty?.logo_url) {
        try {
          const logoUrl = currentProperty.logo_url;
          let base64Logo = '';
          
          try {
            // Try direct load first (best for CORS-enabled hosts)
            base64Logo = await loadImageAsBase64(logoUrl);
          } catch (e) {
            console.warn("Direct logo load failed, trying proxies", e);
            // Fallback to proxy 1: allorigins
            try {
              const proxyUrl1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(logoUrl)}`;
              base64Logo = await loadImageAsBase64(proxyUrl1);
            } catch (proxyErr1) {
              console.warn("Proxy 1 failed, trying Proxy 2", proxyErr1);
              // Fallback to proxy 2: corsproxy.io
              try {
                const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(logoUrl)}`;
                base64Logo = await loadImageAsBase64(proxyUrl2);
              } catch (proxyErr2) {
                console.warn("All logo load attempts failed", proxyErr2);
              }
            }
          }
          
          if (base64Logo) {
            doc.addImage(base64Logo, 'PNG', 14, 10, 20, 20);
            logoAdded = true;
          }
        } catch (logoErr) {
          console.warn("Could not load logo for PDF", logoErr);
        }
      }

      // 1. Add Header Info
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // slate-900
      const headerX = logoAdded ? 40 : 14;
      doc.text(currentProperty?.name?.toUpperCase() || 'PROPERTY NAME', headerX, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('RETAIL STOCK LEDGER', headerX, 28);
      
      // 2. Add Meta Info Box
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Period: ${format(selectedMonth, 'MMMM yyyy')}`, 14, 38);
      doc.text(`Scope: ${viewScope === 'property' ? 'ALL OUTLETS' : (currentOutlet?.name || 'N/A')}`, 14, 43);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 48);

      // 3. Add Summary Stats
      const statsX = pageWidth - 80;
      doc.setFontSize(10);
      doc.text(`Total Revenue: ${formatMoneyForPDF(summary.totalRevenue)}`, statsX, 38);
      doc.text(`Asset Value: ${formatMoneyForPDF(summary.totalStockValue)}`, statsX, 43);
      doc.text(`Units Sold: ${summary.totalItemsSold}`, statsX, 48);

      // 4. Generate Table Data
      const tableRows: any[] = [];
      
      // Determine grouping for PDF
      const pdfGrouping = viewScope === 'property' 
        ? reportData.reduce((acc, item) => {
            const key = item.outletName || 'Unknown Outlet';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
          }, {} as Record<string, ItemStockSummary[]>)
        : groupedData;

      Object.entries(pdfGrouping).forEach(([groupName, items]) => {
        // Group Header Row
        tableRows.push([
          { content: groupName.toUpperCase(), colSpan: 10, styles: { fillColor: [248, 250, 252], textColor: [79, 70, 229], fontStyle: 'bold' } }
        ]);
        
        (items as ItemStockSummary[]).forEach(item => {
          tableRows.push([
            item.itemName,
            formatMoneyForPDF(item.unitPrice),
            item.openingStock,
            item.restocked || '-',
            item.sold || '-',
            formatMoneyForPDF(item.salesRevenue),
            item.adjustments || '-',
            item.closingStock,
            formatMoneyForPDF(item.closingValue),
            item.status
          ]);
        });
      });

      // Grand Total Row
      tableRows.push([
        { content: 'GRAND TOTAL', colSpan: 2, styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' } },
        { content: reportData.reduce((sum, i) => sum + i.openingStock, 0).toString(), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: summary.totalRestocked.toString(), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: summary.totalItemsSold.toString(), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: formatMoneyForPDF(summary.totalRevenue), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: '', styles: { fillColor: [15, 23, 42] } },
        { content: reportData.reduce((sum, i) => sum + i.closingStock, 0).toString(), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: formatMoneyForPDF(summary.totalStockValue), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: '', styles: { fillColor: [15, 23, 42] } }
      ]);

      // 5. Render Table
      const tableConfig: any = {
        startY: 55,
        head: [['Item Description', 'Price', 'Open', 'Restock', 'Sold', 'Revenue', 'Adj', 'Close', 'Value', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'center' },
          7: { halign: 'center' },
          8: { halign: 'right' },
          9: { halign: 'center' }
        },
        styles: { fontSize: 8, cellPadding: 3 },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 9) {
            const status = data.cell.raw;
            if (status === 'Low') data.cell.styles.textColor = [220, 38, 38];
            if (status === 'Good') data.cell.styles.textColor = [5, 150, 105];
          }
        }
      };

      try {
        const actualAutoTable = typeof autoTable === 'function' ? autoTable : ((autoTable as any).default || autoTable);
        
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(tableConfig);
        } else if (typeof actualAutoTable === 'function') {
          actualAutoTable(doc, tableConfig);
        } else {
          throw new Error("autoTable not found on doc or as standalone function");
        }
      } catch (tableErr) {
        console.error("autoTable call failed", tableErr);
        throw tableErr;
      }

      // 6. Save PDF
      doc.save(`Retail_Stock_Ledger_${format(selectedMonth, 'yyyy-MM')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
      setErrorMsg("Failed to generate PDF automatically. Please try using the Print option directly from your browser.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`space-y-8 animate-in fade-in duration-500 ${isEmbedded ? '' : 'pb-12'}`}>
      {/* App Header Section */}
      {!isEmbedded && (
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
             <Button variant="outline" onClick={handlePrint} className="h-12 px-6 rounded-2xl border-slate-200 hover:bg-slate-50 transition-all gap-2 font-black uppercase text-[10px] tracking-widest text-slate-900">
               <Printer className="w-4 h-4" /> Print
             </Button>
             <Button variant="ghost" onClick={() => window.history.back()} className="h-12 px-6 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-900 transition-colors shadow-sm font-black uppercase text-[10px] tracking-widest">
               Back
             </Button>
          </div>
        </div>
      )}

      {/* Report Card */}
      <div className="print:m-0 print:p-0">
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl shadow-slate-200/50 overflow-hidden bg-white print:shadow-none print:border-none print:bg-transparent print:overflow-visible">
          <div className="absolute -left-[9999px] top-0 print:static print:block print-only print:left-0">
            <RetailStockReportPrint
              ref={printRef}
              reportData={reportData}
              summary={summary}
              groupedData={groupedData}
              currentProperty={currentProperty}
              currentOutlet={currentOutlet}
              selectedMonth={selectedMonth}
              viewScope={viewScope}
              formatMoney={formatMoney}
            />
          </div>
          
          {/* Controls (Web Only) */}
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 no-print">
             <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex items-center gap-4">
                  {!isEmbedded && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button onClick={() => setInternalViewScope('outlet')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Filter className="w-3.5 h-3.5" /> Outlet
                        </button>
                        <button onClick={() => setInternalViewScope('property')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Building2 className="w-3.5 h-3.5" /> Property
                        </button>
                    </div>
                  )}
                  {isEmbedded && (
                    <div className="flex gap-3">
                       <Button variant="outline" onClick={handlePrint} className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 transition-all gap-2 font-black uppercase text-[10px] tracking-widest text-slate-900">
                         <Printer className="w-3.5 h-3.5" /> Print
                       </Button>
                       <Button 
                         onClick={handleDownloadPDF} 
                         disabled={isExporting}
                         className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 gap-2 font-black uppercase text-[10px] tracking-widest"
                       >
                         {isExporting ? (
                           <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                         ) : (
                           <FileText className="w-3.5 h-3.5" />
                         )}
                         {isExporting ? 'Exporting...' : 'Export'}
                       </Button>
                    </div>
                  )}
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
          <div className="p-8 bg-slate-50/50 border-b border-slate-100 no-print">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                             <TrendingUp className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Recognition</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(summary.totalRevenue)}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Sales Revenue</p>
                 </div>

                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                             <Package className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Valuation</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(summary.totalStockValue)}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Closing Asset Value</p>
                 </div>

                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                             <ArrowDownRight className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Throughput</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalItemsSold}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Units Sold Volume</p>
                 </div>

                 <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
                     <div className="flex justify-between items-start mb-4">
                         <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                             <ArrowUpRight className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Replenish</span>
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{summary.totalRestocked}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Units Restocked Count</p>
                 </div>
             </div>
          </div>

          {/* Data Table */}
          <div className="p-0 no-print">
             {loading ? null : (
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
                                                 {categoryItems.map((row) => (
                                                     <tr key={row.itemId} className="hover:bg-slate-50 transition-colors group bg-white border-b border-slate-50 last:border-0">
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

        </Card>
      </div>

      <ConfirmationModal 
        isOpen={!!errorMsg} 
        onClose={() => setErrorMsg(null)} 
        onConfirm={() => setErrorMsg(null)} 
        title="Export Issue" 
        description={errorMsg || ""} 
        confirmText="Acknowledged"
        showCancel={false}
      />
    </div>
  );
};

export default RetailStockReport;
