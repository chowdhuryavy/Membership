
import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { CustomReportConfig, CustomReportColumn, Property, Outlet } from '../types';
import { db } from '../services/mockSupabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from './ui';
import { 
  FileText, 
  Download, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  RefreshCcw,
  ArrowUpDown
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { generateCustomReportPDF } from '../src/shared/reportLogic';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CustomReportViewerProps {
  config: CustomReportConfig;
  onBack: () => void;
}

export const CustomReportViewer: React.FC<CustomReportViewerProps> = ({
  config,
  onBack
}) => {
  const { currentProperty, currentOutlet, settings } = useSettings();
  const [data, setData] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const signatoryConfig = React.useMemo(() => {
    if (!currentOutlet || !currentProperty || !settings) return null;

    const resolveConfig = (cfg: any, type: string) => {
      if (!cfg) return null;
      const specific = cfg[type];
      if (!specific) return null;
      return {
        prepared: specific.prepared || 'Accountant',
        reviewed: specific.reviewed || '',
        approved: specific.approved || 'General Manager'
      };
    };

    const outletRes = resolveConfig(currentOutlet.signatory_config, 'custom_report');
    if (outletRes) return outletRes;

    const propertyRes = resolveConfig(currentProperty.signatory_config, 'custom_report');
    if (propertyRes) return propertyRes;

    return resolveConfig(settings.signatory_config, 'custom_report');
  }, [currentOutlet, currentProperty, settings]);

  const loadData = async () => {
    setLoading(true);
    try {
      let rawData: any[] = [];
      const pId = config.property_id || currentProperty?.id;
      const oId = config.outlet_id || currentOutlet?.id;
      const isAllOutlets = !oId || oId === 'all';

      if (!pId) return;

      if (config.data_source === 'members') {
        const cats = await db.getCategories(isAllOutlets ? undefined : oId);
        setCategories(cats);
      }

      switch (config.data_source) {
        case 'members':
          rawData = await db.getMembers(isAllOutlets ? pId : oId, isAllOutlets);
          break;
        case 'bookings':
          rawData = await db.getMassageBookings(isAllOutlets ? pId : oId, isAllOutlets);
          break;
        case 'sales':
          rawData = await db.getSales(isAllOutlets ? pId : oId, isAllOutlets);
          break;
        case 'inventory':
          rawData = await db.getInventory(isAllOutlets ? pId : oId, isAllOutlets);
          break;
        case 'staff':
          rawData = await db.getStaff(isAllOutlets ? pId : oId, isAllOutlets);
          break;
      }

      // Apply Date Filtering if applicable
      const filtered = rawData.filter(item => {
        const itemDate = item.date || item.created_at || item.start_date || item.joined_date;
        if (!itemDate) return true;
        
        const d = new Date(itemDate);
        return isWithinInterval(d, {
          start: startOfDay(new Date(dateRange.start)),
          end: endOfDay(new Date(dateRange.end))
        });
      });

      // Apply Sorting
      if (config.sort_by) {
        filtered.sort((a, b) => {
          const valA = a[config.sort_by!];
          const valB = b[config.sort_by!];
          if (valA < valB) return config.sort_order === 'asc' ? -1 : 1;
          if (valA > valB) return config.sort_order === 'asc' ? 1 : -1;
          return 0;
        });
      }

      setData(filtered);
    } catch (error) {
      console.error("Failed to load report data:", error);
      toast.error('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [config, dateRange, currentProperty, currentOutlet]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  const visibleColumns = config.columns.filter(c => c.visible);

  const handleExport = () => {
    const property = currentProperty;
    const outlet = currentOutlet;
    
    const headers = visibleColumns.map(c => c.label);
    const body = filteredData.map(item => 
      visibleColumns.map(c => {
        const val = item[c.key];
        if (c.key.includes('date') || c.key === 'created_at' || c.key === 'joined_date') {
          return val ? format(new Date(val), 'dd MMM yyyy') : '-';
        }
        if (c.key.includes('amount') || c.key.includes('price') || c.key === 'net_amount') {
          return val?.toLocaleString() || '0';
        }
        if (c.key === 'category_id') {
          return categories.find(cat => cat.id === val)?.name || val || '-';
        }
        return String(val || '-');
      })
    );

    generateCustomReportPDF({
      jsPDF,
      autoTable,
      title: config.name,
      subtitle: `${property?.name || ''} ${outlet ? `- ${outlet.name}` : ''} | ${format(new Date(dateRange.start), 'dd MMM')} to ${format(new Date(dateRange.end), 'dd MMM yyyy')}`,
      headers,
      body,
      propertyName: property?.name || 'Management System',
      logoUrl: property?.logo_url,
      userName: JSON.parse(localStorage.getItem('membership_session') || '{}')?.name || 'Admin',
      filename: `${config.name.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`,
      signatoryConfig: signatoryConfig
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{config.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              {config.data_source.replace('_', ' ')} Intelligence • {filteredData.length} Records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date" 
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest focus:outline-none"
              />
            </div>
            <span className="text-slate-300 font-black">/</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date" 
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest focus:outline-none"
              />
            </div>
          </div>
          <Button 
            onClick={handleExport}
            className="h-12 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
          >
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-indigo-400" />
              </div>
              <Input 
                placeholder="Search intelligence data..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 rounded-xl w-full md:w-64 text-xs font-bold"
              />
            </div>
            <button 
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {visibleColumns.map(col => (
                    <th key={col.key} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        {col.label}
                        {config.sort_by === col.key && <ArrowUpDown className="w-3 h-3 text-indigo-600" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Processing Intelligence...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center">
                            <FileText className="w-8 h-8 text-slate-200" />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No intelligence found for this criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item, idx) => (
                      <motion.tr 
                        key={item.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                      >
                        {visibleColumns.map(col => (
                          <td key={col.key} className="px-6 py-4">
                            <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                              {col.key.includes('date') || col.key === 'created_at' 
                                ? (item[col.key] && !isNaN(Date.parse(item[col.key])) ? format(new Date(item[col.key]), 'dd MMM yyyy') : '-')
                                : col.key.includes('amount') || col.key.includes('price') || col.key === 'net_amount'
                                ? item[col.key]?.toLocaleString()
                                : col.key === 'category_id'
                                ? categories.find(c => c.id === item[col.key])?.name || item[col.key]
                                : String(item[col.key] || '-')
                              }
                            </span>
                          </td>
                        ))}
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
