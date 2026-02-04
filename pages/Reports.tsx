import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  Building2,
  ReceiptText,
  ShieldCheck,
  FileText,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/* ---------------- utils ---------------- */
const parseISO = (d: string) => new Date(d);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const subDays = (d: Date, n: number) => addDays(d, -n);

/* ---------------- types ---------------- */
interface ReportRow {
  sl_no: number;
  guest_name: string;
  from: string;
  to: string;
  total_days: number;
  actual_fees: number;
  carry_forward: number;
  current_month_rev: number;
  balance: number;
  membership_no: string;
  category_name: string;
}

/* ---------------- columns ---------------- */
const COLUMNS = [
  { key: 'sl_no', label: 'SL.' },
  { key: 'guest_name', label: 'GUEST NAME / PROFILE' },
  { key: 'from', label: 'START DATE' },
  { key: 'to', label: 'END DATE' },
  { key: 'total_days', label: 'DAYS' },
  { key: 'actual_fees', label: 'NET FEES' },
  { key: 'carry_forward', label: 'PREV. ACCRUAL' },
  { key: 'current_month_rev', label: 'PERIOD REVENUE' },
  { key: 'balance', label: 'DEFERRED' }
];

/* ================= COMPONENT ================= */
const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } =
    useSettings();

  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  /* ---------------- data load ---------------- */
  useEffect(() => {
    if (currentOutlet) loadData();
  }, [reportMonth, currentOutlet]);

  const loadData = async () => {
    const [members, cats, freezes] = await Promise.all([
      db.getMembers(currentOutlet!.id),
      db.getCategories(currentOutlet!.id),
      db.getFreezes()
    ]);

    setCategories(cats);

    const target = parseISO(reportMonth + '-01');
    const start = startOfMonth(target);
    const end = endOfMonth(target);
    const prevEnd = subDays(start, 1);

    const data: ReportRow[] = members
      .filter(m => {
        const s = parseISO(m.start_date);
        const e = parseISO(m.current_end_date);
        return e >= start && s <= end;
      })
      .map((m, i) => {
        const memberFreezes = freezes.filter(f => f.member_id === m.id);
        const prev = RevenueEngine.calculateRevenuePeriod(
          m,
          memberFreezes,
          parseISO(m.start_date),
          prevEnd
        );
        const current = RevenueEngine.calculateRevenuePeriod(
          m,
          memberFreezes,
          start,
          end
        );
        return {
          sl_no: i + 1,
          guest_name: m.guest_name,
          from: format(parseISO(m.start_date), 'dd-MM-yy'),
          to: format(parseISO(m.current_end_date), 'dd-MM-yy'),
          total_days:
            differenceInCalendarDays(
              parseISO(m.current_end_date),
              parseISO(m.start_date)
            ) + 1,
          actual_fees: m.net_amount,
          carry_forward: prev,
          current_month_rev: current,
          balance: Math.max(0, m.net_amount - (prev + current)),
          membership_no: m.membership_number,
          category_name:
            cats.find(c => c.id === m.category_id)?.name || 'Uncategorized'
        };
      });

    setRows(data);
  };

  /* ---------------- grouping ---------------- */
  const grouped = useMemo(() => {
    const g: Record<string, ReportRow[]> = {};
    rows.forEach(r => {
      if (!g[r.category_name]) g[r.category_name] = [];
      g[r.category_name].push(r);
    });
    return g;
  }, [rows]);

  /* ---------------- print & pdf ---------------- */
  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 150);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    setIsGeneratingPDF(true);
    setIsPrintMode(true);
    await new Promise(r => setTimeout(r, 200));

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: 'a4'
      });

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: doc => {
          doc.querySelectorAll('.pdf-force').forEach(el => {
            const e = el as HTMLElement;
            e.style.backgroundColor = '#4f46e5';
            e.style.color = '#ffffff';
            e.style.boxShadow = 'none';
            e.style.opacity = '1';
          });
          doc.querySelectorAll('img').forEach(img => {
            (img as HTMLImageElement).style.display = 'block';
          });
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Ledger_${currentOutlet?.name}_${reportMonth}.pdf`);
    } finally {
      setIsGeneratingPDF(false);
      setIsPrintMode(false);
    }
  };

  const canExport = hasPermission(user?.role_id || '', 'reports:export');

  /* ================= RENDER ================= */
  return (
    <div className="space-y-6">
      {/* ---------------- styles ---------------- */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 15mm; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
        .print-mode {
          width: 1600px !important;
          overflow: visible !important;
        }
        .print-mode * {
          box-shadow: none !important;
        }
      `}</style>

      {/* ---------------- controls ---------------- */}
      <div className="no-print flex justify-between items-center bg-white p-6 border rounded-xl">
        <div className="flex gap-4 items-center">
          <FileText />
          <input
            type="month"
            value={reportMonth}
            onChange={e => setReportMonth(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          {canExport && (
            <Button onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>
              Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* ---------------- report ---------------- */}
      <div
        ref={reportRef}
        className={`bg-white p-20 mx-auto ${isPrintMode ? 'print-mode' : ''}`}
      >
        {/* ---------- HEADER ---------- */}
        <div className="flex justify-between items-start border-b-4 pb-10 mb-12">
          <div className="flex items-center gap-10">
            {currentProperty?.logo_url ? (
              <img
                src={currentProperty.logo_url}
                alt="Logo"
                className="h-32 pdf-force"
              />
            ) : (
              <div className="h-32 w-32 bg-slate-900 flex items-center justify-center">
                <Building2 className="text-white w-12 h-12" />
              </div>
            )}

            <div>
              <h1 className="text-6xl font-black">
                {currentProperty?.name || 'THE TORCH DOHA'}
              </h1>
              <p className="uppercase text-xs tracking-widest text-slate-400">
                Corporate Headquarters
              </p>

              <div className="mt-6 inline-flex items-center gap-4 px-10 py-4 rounded-3xl bg-indigo-600 text-white pdf-force">
                <Activity />
                <span className="font-black uppercase tracking-widest">
                  {currentOutlet?.name || 'Health Club'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE – ADJUSTED */}
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400 mb-2">
              Audit Interval
            </p>
            <p className="text-5xl font-black mb-4">
              {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">
                Reconciled Audit
              </span>
            </div>
          </div>
        </div>

        {/* ---------- TABLE ---------- */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              {COLUMNS.map(c => (
                <th key={c.key} className="p-4 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Object.keys(grouped).map(cat => (
              <React.Fragment key={cat}>
                <tr className="bg-slate-100">
                  <td colSpan={COLUMNS.length} className="p-4 font-black">
                    {cat}
                  </td>
                </tr>

                {grouped[cat].map(r => (
                  <tr key={r.membership_no}>
                    {COLUMNS.map(c => (
                      <td key={c.key} className="p-3 text-center">
                        {['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)
                          ? formatMoney((r as any)[c.key])
                          : (r as any)[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
