
import React, { useEffect, useState } from 'react';
import { Button, Input, Card, CardContent } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, MemberStatus } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, startOfMonth, endOfMonth, parseISO, subDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Printer, Download, Settings2, X, Check, Calendar, Layout, Save, AlertTriangle, HelpCircle } from 'lucide-react';

interface ReportRow {
  sl_no: number;
  guest_name: string;
  from: string;
  to: string;
  original_fees: number;
  actual_fees: number;
  carry_forward: number;
  daily: number;
  current_month_rev: number;
  controll: number;
  balance: number;
  remarks: string;
  membership_no: string;
  category_id: string;
  category_name: string;
}

interface ColumnDef {
    key: string;
    label: string;
    headerClassName?: string;
    cellClassName?: string;
    footerClassName?: string; 
}

const ALL_COLUMNS: ColumnDef[] = [
    { key: 'sl_no', label: 'Sl. No', headerClassName: 'text-center w-12', cellClassName: 'text-center w-12' },
    { key: 'guest_name', label: 'Name of the guest', headerClassName: 'text-left', cellClassName: 'text-left font-medium' },
    { key: 'from', label: 'From', headerClassName: 'text-center w-24', cellClassName: 'text-center w-24' },
    { key: 'to', label: 'To', headerClassName: 'text-center w-24', cellClassName: 'text-center w-24' },
    { key: 'original_fees', label: 'Original Fees', headerClassName: 'text-right', cellClassName: 'text-right' },
    { key: 'actual_fees', label: 'Actual Fees', headerClassName: 'text-right', cellClassName: 'text-right font-semibold' },
    { key: 'carry_forward', label: 'C/F Prev', headerClassName: 'text-right whitespace-nowrap px-4', cellClassName: 'text-right text-slate-600' },
    { key: 'daily', label: 'Daily', headerClassName: 'text-right', cellClassName: 'text-right text-slate-500 font-mono' },
    { key: 'current_month_rev', label: 'Current Month', headerClassName: 'text-right bg-blue-800', cellClassName: 'text-right font-bold bg-blue-50', footerClassName: 'text-right font-bold' }, 
    { key: 'controll', label: 'Controll', headerClassName: 'text-right', cellClassName: 'text-right font-medium' },
    { key: 'balance', label: 'Balance', headerClassName: 'text-right', cellClassName: 'text-right font-medium text-red-600' },
    { key: 'remarks', label: 'Remarks', headerClassName: 'text-left', cellClassName: 'text-xs truncate max-w-[120px]' },
    { key: 'membership_no', label: 'Membership No#', headerClassName: 'text-left', cellClassName: 'text-xs' }
];

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, hasPermission, refreshSettings, currency, formatMoney } = useSettings();
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  
  // Custom Header State
  const [isEditingBranding, setIsEditingBranding] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  
  // UI States
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMNS.map(c => c.key));
  const [showColMenu, setShowColMenu] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (currentOutlet) {
        loadData();
    }
  }, [reportMonth, currentOutlet]);

  useEffect(() => {
    if (settings) {
        setCustomTitle(settings.report_title || `${currentOutlet?.name || 'Facility'} Membership`);
        setCustomSubtitle(settings.report_subtitle || format(parseISO(reportMonth + '-01'), 'MMMM yyyy'));
    }
  }, [settings, currentOutlet, reportMonth]);

  const loadData = async () => {
    if (!currentOutlet) return;

    const [members, cats, freezes] = await Promise.all([
        db.getMembers(currentOutlet.id),
        db.getCategories(currentOutlet.id),
        db.getFreezes() 
    ]);
    setCategories(cats);

    const targetDate = parseISO(reportMonth + '-01'); 
    const startOfReport = startOfMonth(targetDate);
    const endOfReport = endOfMonth(targetDate);
    const prevMonthEnd = subDays(startOfReport, 1);

    let filteredMembers = members.filter(m => m.status !== MemberStatus.EXPIRED);
    filteredMembers.sort((a, b) => a.guest_name.localeCompare(b.guest_name));

    let sl = 1;
    const reportRows: ReportRow[] = filteredMembers.map(m => {
        const memFreezes = freezes.filter(f => f.member_id === m.id);
        const carryForward = RevenueEngine.calculateRevenuePeriod(m, memFreezes, parseISO(m.start_date), prevMonthEnd);
        const currentRev = RevenueEngine.calculateRevenuePeriod(m, memFreezes, startOfReport, endOfReport);
        const controll = carryForward + currentRev;
        const balance = Math.max(0, m.net_amount - controll);
        const catName = cats.find(c => c.id === m.category_id)?.name || 'Unknown Category';

        return {
            sl_no: sl++,
            guest_name: m.guest_name,
            from: format(parseISO(m.start_date), 'yy-MM-dd'),
            to: format(parseISO(m.current_end_date), 'yy-MM-dd'),
            original_fees: m.actual_rate, 
            actual_fees: m.net_amount,
            carry_forward: carryForward,
            daily: m.daily_rate,
            current_month_rev: currentRev,
            controll: controll,
            balance: balance,
            remarks: m.check_no || '',
            membership_no: m.membership_number,
            category_id: m.category_id,
            category_name: catName
        };
    });

    setRows(reportRows);
  };

  const handleSaveBranding = async () => {
      if (!user || !hasPermission(user.role_id, 'manage_settings')) return;
      await db.updateSettings({
          report_title: customTitle,
          report_subtitle: customSubtitle
      });
      await refreshSettings();
      setIsEditingBranding(false);
  };

  const toggleColumn = (key: string) => {
      setVisibleColumns(prev => 
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
  };

  const handleDownloadCSV = () => {
      const headers = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(c => c.key === 'current_month_rev' ? format(parseISO(reportMonth + '-01'), 'MMM-yy') : c.label);
      const csvContent = [
          headers.join(','),
          ...rows.map(row => 
              ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(c => {
                  const val = row[c.key as keyof ReportRow];
                  return typeof val === 'string' ? `"${val}"` : val;
              }).join(',')
          )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Report_${reportMonth}.csv`;
      link.click();
  };

  const fmt = (n: number) => n === 0 ? '-' : formatMoney(n);
  const fmtRate = (n: number) => n === 0 ? '-' : n.toFixed(2);
  const currentMonthLabel = format(parseISO(reportMonth + '-01'), 'MMM-yy');

  const getTotals = (subset: ReportRow[]) => {
      return {
          actual: subset.reduce((sum, r) => sum + r.actual_fees, 0),
          cf: subset.reduce((sum, r) => sum + r.carry_forward, 0),
          current: subset.reduce((sum, r) => sum + r.current_month_rev, 0),
          balance: subset.reduce((sum, r) => sum + r.balance, 0)
      };
  };

  const grandTotals = getTotals(rows);
  const groupedData = categories.map(cat => ({
      ...cat,
      rows: rows.filter(r => r.category_id === cat.id)
  })).filter(g => g.rows.length > 0);
  
  const uncategorized = rows.filter(r => !categories.find(c => c.id === r.category_id));
  if (uncategorized.length > 0) {
      groupedData.push({ id: 'unknown', name: 'Uncategorized', rows: uncategorized } as any);
  }

  const canEditHeaders = user && hasPermission(user.role_id, 'manage_settings');

  // Helper to remove bg classes for footer cells to ensure dark theme stays consistent
  const getFooterCellClass = (originalClass?: string) => {
      if (!originalClass) return '';
      // Remove any bg- class to allow the row's dark blue to show
      return originalClass.split(' ').filter(c => !c.startsWith('bg-')).join(' ');
  };

  // Inline style for footer cells to strictly enforce dark theme
  const footerCellStyle: React.CSSProperties = {
      backgroundColor: '#1e3a8a', // blue-900
      color: '#ffffff',
      printColorAdjust: 'exact',
      WebkitPrintColorAdjust: 'exact',
      borderColor: '#475569' // slate-600
  };

  return (
    <>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 0.5cm; }
          body { background-color: white !important; }
          /* Ensure we hide standard app shell elements if they leak through */
          nav, aside, header, .no-print { display: none !important; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; min-height: 100vh; padding: 0 !important; margin: 0 !important; border: none !important; overflow: visible !important; }
          /* Force background colors to print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        `}
      </style>

      <div className={`space-y-6 ${isPreviewMode ? 'fixed inset-0 z-50 bg-white p-8 overflow-auto' : ''}`}>
        <div className={`flex flex-col md:flex-row justify-between items-end gap-4 ${isPreviewMode ? 'hidden' : ''}`}>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
                <p className="text-slate-500">Monthly revenue recognition statement ({currency?.code})</p>
            </div>
            <div className="flex gap-2 items-end flex-wrap justify-end">
              <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3"/> Report Month
                  </label>
                  <Input 
                      type="month" 
                      value={reportMonth} 
                      onChange={e => setReportMonth(e.target.value)} 
                      className="w-40"
                  />
              </div>
              
              <div className="relative">
                  <Button variant="outline" onClick={() => setShowColMenu(!showColMenu)} className="w-10 px-0 flex items-center justify-center" title="Table Settings">
                      <Settings2 className="w-4 h-4" />
                  </Button>
                  {showColMenu && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-2 max-h-80 overflow-y-auto">
                          <div className="flex justify-between items-center mb-2 px-2 pb-2 border-b">
                              <span className="text-xs font-bold text-slate-500 uppercase">Visible Columns</span>
                              <button onClick={() => setShowColMenu(false)}><X className="w-3 h-3 text-slate-400"/></button>
                          </div>
                          {ALL_COLUMNS.map(col => (
                              <button 
                                  key={col.key}
                                  onClick={() => toggleColumn(col.key)}
                                  className="flex w-full items-center justify-between px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded text-left"
                              >
                                  <span className="whitespace-pre-line">{col.label.replace('\n', ' ')}</span>
                                  {visibleColumns.includes(col.key) && <Check className="w-3 h-3 text-indigo-600"/>}
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              {canEditHeaders && (
                  <Button variant="outline" onClick={() => setIsEditingBranding(!isEditingBranding)}>
                      <Layout className="w-4 h-4 mr-2"/> Edit Header
                  </Button>
              )}

              <Button variant="outline" onClick={handleDownloadCSV}>
                  <Download className="w-4 h-4 mr-2"/> Export CSV
              </Button>
              
              <Button onClick={() => setIsPreviewMode(true)}>
                  <Printer className="w-4 h-4 mr-2"/> Print Preview
              </Button>
            </div>
        </div>

        {isEditingBranding && !isPreviewMode && (
            <Card className="bg-indigo-50 border-indigo-200 border animate-in slide-in-from-top-2">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                            <Layout className="w-4 h-4"/> Customize Report Branding
                        </h3>
                        <button onClick={() => setIsEditingBranding(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Report Main Title" 
                            value={customTitle} 
                            onChange={e => setCustomTitle(e.target.value)} 
                            className="bg-white"
                        />
                        <Input 
                            label="Report Sub-Header" 
                            value={customSubtitle} 
                            onChange={e => setCustomSubtitle(e.target.value)}
                            className="bg-white"
                        />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                         <Button variant="secondary" size="sm" onClick={() => setIsEditingBranding(false)}>Discard</Button>
                         <Button size="sm" onClick={handleSaveBranding}>
                             <Save className="w-4 h-4 mr-2"/> Save Permanently
                         </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        {isPreviewMode && (
            <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden no-print bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-lg text-white animate-in fade-in slide-in-from-top-4">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-600 p-3 rounded-full text-white mt-1 shadow-lg shadow-blue-900/50">
                        <Printer className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">Preview Mode Active</h3>
                        <div className="text-slate-300 text-sm mt-1 max-w-xl space-y-2">
                            <p>
                                The report below is formatted for <strong>Landscape</strong> printing.
                            </p>
                            <div className="flex items-center gap-3 bg-white/10 border border-white/20 p-3 rounded-md w-fit mt-2">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                                <span>
                                    <strong>Browser Security Restriction:</strong><br/>
                                    Automatic printing is blocked. Please press 
                                    <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded mx-1 text-white font-bold border border-white/20">Ctrl + P</span> 
                                    (or <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded mx-1 text-white font-bold border border-white/20">Cmd + P</span> on Mac) 
                                    manually.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="secondary" onClick={() => setIsPreviewMode(false)} className="flex-1 md:flex-none justify-center h-12 px-6">
                        <X className="w-4 h-4 mr-2"/> Exit Preview
                    </Button>
                </div>
            </div>
        )}

        <div className={`print-container bg-white shadow-sm border border-slate-200 ${isPreviewMode ? 'shadow-none border-none' : 'p-4 md:p-8'}`}>
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-4">
                    {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-16 w-auto object-contain" />}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">{settings?.name || 'Company Name'}</h2>
                        <p className="text-sm text-slate-500">{settings?.address}</p>
                    </div>
                </div>
                
                <div className="bg-blue-900 text-white px-6 py-2 shadow-sm min-w-[300px] text-center md:text-right">
                    <h3 className="font-bold text-lg uppercase tracking-wide">
                        {customTitle}
                    </h3>
                    <div className="text-xl font-light text-blue-100">
                      {customSubtitle}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-300">
                    <thead>
                        <tr className="bg-blue-700 text-white">
                            {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                                <th key={col.key} className={`border border-slate-400 px-2 py-3 text-white font-bold whitespace-pre-line text-center ${col.headerClassName || ''}`}>
                                    {col.key === 'current_month_rev' ? currentMonthLabel : col.label}
                                    {col.key === 'carry_forward' && <span title="Accumulated revenue from start date up to the beginning of this month.">*</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {groupedData.length === 0 ? (
                            <tr><td colSpan={visibleColumns.length} className="text-center py-8 text-slate-500 italic">No records found matching your selection.</td></tr>
                        ) : (
                            groupedData.map((group) => {
                                const groupTotals = getTotals(group.rows);
                                return (
                                <React.Fragment key={group.id}>
                                    <tr className="bg-slate-200 font-bold text-slate-800">
                                        <td colSpan={visibleColumns.length} className="border border-slate-300 px-2 py-1.5 uppercase tracking-wider text-[10px]">
                                            {group.name}
                                        </td>
                                    </tr>
                                    {group.rows.map((row) => (
                                        <tr key={row.sl_no} className="even:bg-slate-50 hover:bg-yellow-50 transition-colors">
                                            {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                                                <td key={col.key} className={`border border-slate-300 px-2 py-1.5 ${col.cellClassName || ''}`}>
                                                    {['original_fees', 'actual_fees', 'carry_forward', 'current_month_rev', 'controll', 'balance'].includes(col.key) 
                                                        ? fmt(row[col.key as keyof ReportRow] as number)
                                                        : col.key === 'daily'
                                                        ? fmtRate(row[col.key as keyof ReportRow] as number)
                                                        : row[col.key as keyof ReportRow]
                                                    }
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 font-semibold text-slate-900 border-t border-slate-300">
                                        {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => {
                                            let val: React.ReactNode = '';
                                            if (col.key === 'guest_name') val = `${group.name} Total`;
                                            if (col.key === 'actual_fees') val = fmt(groupTotals.actual);
                                            if (col.key === 'carry_forward') val = fmt(groupTotals.cf);
                                            if (col.key === 'current_month_rev') val = fmt(groupTotals.current);
                                            if (col.key === 'balance') val = fmt(groupTotals.balance);
                                            
                                            return (
                                                <td key={col.key} className={`border border-slate-300 px-2 py-1.5 ${getFooterCellClass(col.cellClassName)}`}>
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr><td colSpan={visibleColumns.length} className="h-2 bg-white border-l border-r border-slate-300"></td></tr>
                                </React.Fragment>
                            )})
                        )}
                    </tbody>
                    {groupedData.length > 0 && (
                        <tfoot>
                            <tr style={footerCellStyle} className="font-bold border-t-2 border-slate-900">
                                {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => {
                                    let val: React.ReactNode = '';
                                    if (col.key === 'guest_name') val = 'GRAND TOTAL';
                                    if (col.key === 'actual_fees') val = fmt(grandTotals.actual);
                                    if (col.key === 'carry_forward') val = fmt(grandTotals.cf);
                                    if (col.key === 'current_month_rev') val = fmt(grandTotals.current);
                                    if (col.key === 'balance') val = fmt(grandTotals.balance);
                                    
                                    return (
                                        <td 
                                            key={col.key} 
                                            style={footerCellStyle}
                                            className={`border border-slate-600 px-2 py-3 ${col.footerClassName || getFooterCellClass(col.cellClassName)}`}
                                        >
                                            {val}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200 flex justify-between text-[10px] text-slate-500">
                <p>Printed on: {format(new Date(), 'PPpp')}</p>
                <p>Nexus Membership OS - Enterprise Financial Reporting ({currency?.code})</p>
            </div>
        </div>
      </div>
    </>
  );
};

export default Reports;
