import React, { useState, useMemo } from 'react';
import { EntranceFeeConsent } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { 
  Calendar as CalendarIcon, 
  BarChart3, 
  Download, 
  Printer, 
  Users, 
  FileCheck, 
  CreditCard, 
  TrendingUp, 
  Search, 
  FileSignature, 
  Building2, 
  Store,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getHours } from 'date-fns';

interface EntranceFeeReportsProps {
  consents: EntranceFeeConsent[];
  propertyId?: string;
  outletId?: string;
  onPrintWaiver?: (consent: EntranceFeeConsent) => void;
}

export const EntranceFeeReports: React.FC<EntranceFeeReportsProps> = ({
  consents,
  propertyId,
  outletId,
  onPrintWaiver
}) => {
  const { currentProperty, currentOutlet, outlets, properties } = useSettings();
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // 'yyyy-MM'
  const [dailySearchTerm, setDailySearchTerm] = useState('');

  // Filtering consents for current scope
  const scopedConsents = useMemo(() => {
    return consents.filter(c => {
      if (outletId && outletId !== 'all') {
        return c.outlet_id === outletId;
      }
      if (propertyId) {
        const outletObj = outlets?.find(o => o.id === c.outlet_id);
        return outletObj?.property_id === propertyId;
      }
      return true;
    });
  }, [consents, outletId, propertyId, outlets]);

  // Daily Report calculations
  const dailyConsents = useMemo(() => {
    return scopedConsents.filter(c => c.date === selectedDate);
  }, [scopedConsents, selectedDate]);

  const dailyStats = useMemo(() => {
    const total = dailyConsents.length;
    const signed = dailyConsents.filter(c => !!c.guest_signature).length;
    const unsigned = total - signed;
    const signedPercent = total > 0 ? Math.round((signed / total) * 100) : 0;

    // Unique guests by name or QID
    const uniqueGuestNames = new Set(dailyConsents.map(c => c.guest_name.trim().toLowerCase()));

    // Package breakdown
    const packages: Record<string, number> = {};
    dailyConsents.forEach(c => {
      const pkg = c.item_name || 'Standard Entrance Fee';
      packages[pkg] = (packages[pkg] || 0) + 1;
    });

    let topPackage = 'N/A';
    let topPackageCount = 0;
    Object.entries(packages).forEach(([pkg, count]) => {
      if (count > topPackageCount) {
        topPackageCount = count;
        topPackage = pkg;
      }
    });

    return {
      total,
      signed,
      unsigned,
      signedPercent,
      uniqueGuests: uniqueGuestNames.size,
      packages,
      topPackage,
      topPackageCount
    };
  }, [dailyConsents]);

  // Monthly Report calculations
  const monthlyConsents = useMemo(() => {
    return scopedConsents.filter(c => c.date.startsWith(selectedMonth));
  }, [scopedConsents, selectedMonth]);

  const monthlyStats = useMemo(() => {
    const total = monthlyConsents.length;
    const signed = monthlyConsents.filter(c => !!c.guest_signature).length;

    // Days in month
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Group by day
    const dayCounts: Record<string, number> = {};
    daysInMonth.forEach(d => {
      dayCounts[format(d, 'yyyy-MM-dd')] = 0;
    });

    monthlyConsents.forEach(c => {
      if (dayCounts[c.date] !== undefined) {
        dayCounts[c.date] += 1;
      }
    });

    // Peak day
    let peakDay = 'N/A';
    let peakCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
      }
    });

    const activeDaysCount = Object.values(dayCounts).filter(c => c > 0).length || 1;
    const avgDaily = (total / activeDaysCount).toFixed(1);

    // Package breakdown
    const packages: Record<string, number> = {};
    monthlyConsents.forEach(c => {
      const pkg = c.item_name || 'Standard Entrance Fee';
      packages[pkg] = (packages[pkg] || 0) + 1;
    });

    return {
      total,
      signed,
      avgDaily,
      peakDay,
      peakCount,
      dayCounts,
      daysInMonth,
      packages
    };
  }, [monthlyConsents, selectedMonth]);

  // Export Daily / Monthly CSV
  const exportCSV = () => {
    const isDaily = reportType === 'daily';
    const dataToExport = isDaily ? dailyConsents : monthlyConsents;
    if (dataToExport.length === 0) {
      alert('No records to export for selected timeframe.');
      return;
    }

    const headers = ['ID', 'Date', 'Guest Name', 'QID / Passport', 'Phone', 'Email', 'Package / Item', 'Waiver Signed', 'Outlet ID'];
    const rows = dataToExport.map(c => [
      c.id,
      c.date,
      `"${c.guest_name.replace(/"/g, '""')}"`,
      `"${(c.qid_passport || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.item_name || '').replace(/"/g, '""')}"`,
      c.guest_signature ? 'Yes' : 'No',
      c.outlet_id
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Entrance_Fee_${reportType.toUpperCase()}_Report_${isDaily ? selectedDate : selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Summary Report
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isDaily = reportType === 'daily';
    const title = isDaily 
      ? `Daily Entrance Fee Report - ${format(parseISO(selectedDate), 'dd MMMM yyyy')}`
      : `Monthly Entrance Fee Summary - ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}`;

    const totalCount = isDaily ? dailyStats.total : monthlyStats.total;
    const signedCount = isDaily ? dailyStats.signed : monthlyStats.signed;
    const list = isDaily ? dailyConsents : monthlyConsents;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; max-width: 900px; margin: 0 auto; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
            .meta { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
            .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px; }
            .stat-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .stat-val { font-size: 18px; font-weight: 900; color: #059669; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
            th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; tracking: 0.1em; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${title}</div>
              <div class="meta">${currentProperty?.name || ''} ${currentOutlet?.name ? ' - ' + currentOutlet.name : ''}</div>
            </div>
            <div class="meta" style="text-align: right;">
              <div>Exported on: ${format(new Date(), 'dd-MMM-yyyy HH:mm:ss')}</div>
              <div>By: ${JSON.parse(localStorage.getItem('membership_session') || '{}')?.name || 'Admin'}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Entrances</div>
              <div class="stat-val">${totalCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Signed Waivers</div>
              <div class="stat-val">${signedCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${isDaily ? 'Unique Guests' : 'Daily Average'}</div>
              <div class="stat-val">${isDaily ? dailyStats.uniqueGuests : monthlyStats.avgDaily}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${isDaily ? 'Top Package' : 'Peak Day'}</div>
              <div class="stat-val" style="font-size:12px;">${isDaily ? dailyStats.topPackage : (monthlyStats.peakDay !== 'N/A' ? format(parseISO(monthlyStats.peakDay), 'dd MMM') : 'N/A')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Guest Name</th>
                <th>QID / Passport</th>
                <th>Access / Package</th>
                <th>Waiver Signed</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${c.date}</td>
                  <td>${c.guest_name}</td>
                  <td>${c.qid_passport || 'N/A'}</td>
                  <td>${c.item_name || 'Standard Entrance'}</td>
                  <td>${c.guest_signature ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Page 1 of 1 &bull; System ID: ${currentOutlet?.id?.substring(0,8) || 'N/A'}</span>
            <span>&copy; ${new Date().getFullYear()} ${currentProperty?.name}. All rights reserved.</span>
          </div>

          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
              // Fallback for browsers that don't support onafterprint or if it fires too early
              setTimeout(() => {
                if (!window.closed) window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      
      {/* Report Switcher & Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        
        {/* Toggle Daily / Monthly */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setReportType('daily')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              reportType === 'daily'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Daily Report
          </button>
          <button
            onClick={() => setReportType('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              reportType === 'monthly'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Monthly Summary
          </button>
        </div>

        {/* Date Controls & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {reportType === 'daily' ? (
            <div className="flex items-center gap-2">
              <input 
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input 
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          <button
            onClick={printReport}
            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>

          <button
            onClick={exportCSV}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> CSV Export
          </button>
        </div>
      </div>

      {/* Daily Report Layout */}
      {reportType === 'daily' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Total Entrances</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{dailyStats.total}</div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {dailyStats.uniqueGuests} Unique Guests
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Signed Waivers</span>
                <FileCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{dailyStats.signed}</div>
              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                {dailyStats.signedPercent}% Compliance Rate
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Unsigned Waivers</span>
                <FileSignature className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-800">{dailyStats.unsigned}</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pending digital signatures
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Top Access Package</span>
                <CreditCard className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{dailyStats.topPackage}</div>
              <p className="text-[10px] font-bold text-indigo-600">
                {dailyStats.topPackageCount} Passes Issued Today
              </p>
            </div>

          </div>

          {/* Package Breakdown Cards */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Today's Access Breakdown by Package
            </h3>

            {Object.keys(dailyStats.packages).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(dailyStats.packages).map(([pkg, count]) => {
                  const pct = Math.round((count / (dailyStats.total || 1)) * 100);
                  return (
                    <div key={pkg} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-900">{pkg}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black text-[10px]">
                          {count}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                        {pct}% of daily traffic
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No access packages logged for this date.</p>
            )}
          </div>

          {/* Detailed Daily Log Table */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-emerald-600" /> Daily Guest Entrance Logs ({dailyConsents.length})
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter by guest name..."
                  value={dailySearchTerm}
                  onChange={e => setDailySearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 text-xs font-semibold text-slate-900 border-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">#</th>
                    <th className="pb-3">Guest Name</th>
                    <th className="pb-3">QID / Passport</th>
                    <th className="pb-3">Package / Access</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Signed</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dailyConsents
                    .filter(c => c.guest_name.toLowerCase().includes(dailySearchTerm.toLowerCase()))
                    .map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 pl-2 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 font-bold text-slate-900">{c.guest_name}</td>
                        <td className="py-3 font-medium text-slate-600">{c.qid_passport || 'N/A'}</td>
                        <td className="py-3 font-semibold text-indigo-600">{c.item_name || 'Standard Access'}</td>
                        <td className="py-3 font-medium text-slate-500">{c.phone || c.email || 'N/A'}</td>
                        <td className="py-3">
                          {c.guest_signature ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Signed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px]">
                              Unsigned
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          {onPrintWaiver && (
                            <button
                              onClick={() => onPrintWaiver(c)}
                              className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-wider"
                            >
                              Print
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {dailyConsents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs font-semibold text-slate-400 italic">
                        No entrance fee consents logged for {format(parseISO(selectedDate), 'dd MMMM yyyy')}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Monthly Report Layout */}
      {reportType === 'monthly' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Monthly Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Monthly Entrances</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{monthlyStats.total}</div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Average Daily</span>
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-600">{monthlyStats.avgDaily}</div>
              <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                Entrances / active day
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Peak Traffic Day</span>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-base font-black text-slate-900">
                {monthlyStats.peakDay !== 'N/A' ? format(parseISO(monthlyStats.peakDay), 'dd MMM yyyy') : 'N/A'}
              </div>
              <p className="text-[10px] font-bold text-amber-600">
                {monthlyStats.peakCount} Guests on peak day
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Total Signed Waivers</span>
                <FileCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{monthlyStats.signed}</div>
              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                {monthlyStats.total > 0 ? Math.round((monthlyStats.signed / monthlyStats.total) * 100) : 0}% Monthly Compliance
              </p>
            </div>

          </div>

          {/* Daily Breakdown Timeline Bar Chart Table */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" /> Daily Entrance Distribution - {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </h3>

            <div className="space-y-2">
              {monthlyStats.daysInMonth.map(dayObj => {
                const dateKey = format(dayObj, 'yyyy-MM-dd');
                const count = monthlyStats.dayCounts[dateKey] || 0;
                const maxVal = Math.max(...Object.values(monthlyStats.dayCounts), 1);
                const pct = Math.round((count / maxVal) * 100);

                return (
                  <div key={dateKey} className="flex items-center gap-3 text-xs">
                    <span className="w-24 font-bold text-slate-600 shrink-0 text-[11px]">
                      {format(dayObj, 'dd MMM (EEE)')}
                    </span>
                    <div className="flex-1 bg-slate-100 h-4 rounded-lg overflow-hidden flex items-center px-2">
                      <div 
                        className={`h-2.5 rounded-md transition-all ${
                          count > 0 ? 'bg-emerald-600' : 'bg-transparent'
                        }`} 
                        style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }} 
                      />
                    </div>
                    <span className={`w-12 text-right font-black text-xs ${count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Package Breakdown */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Monthly Package Distribution
            </h3>

            {Object.keys(monthlyStats.packages).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(monthlyStats.packages).map(([pkg, count]) => {
                  const pct = Math.round((count / (monthlyStats.total || 1)) * 100);
                  return (
                    <div key={pkg} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-900">{pkg}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-black text-[10px]">
                          {count} Passes
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                        {pct}% of monthly traffic
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No access package data recorded for this month.</p>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
