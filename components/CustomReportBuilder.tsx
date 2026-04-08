
import React, { useState, useEffect, useMemo } from 'react';
import { CustomReportConfig, CustomReportColumn, Property, Outlet } from '../types';
import { db } from '../services/mockSupabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from './ui';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Check, 
  X, 
  Settings, 
  FileText, 
  Layout, 
  Database,
  Users,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';

interface CustomReportBuilderProps {
  config?: CustomReportConfig;
  properties: Property[];
  outlets: Outlet[];
  onSave: (config: Omit<CustomReportConfig, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}

const DATA_SOURCES = [
  { id: 'members', label: 'Membership Ledger', columns: [
    { key: 'membership_number', label: 'Member ID' },
    { key: 'guest_name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'category_id', label: 'Tier' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'current_end_date', label: 'Expiry Date' },
    { key: 'net_amount', label: 'Net Amount' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'sales_rep_id', label: 'Sales Rep' },
  ]},
  { id: 'bookings', label: 'Booking Registry', columns: [
    { key: 'date', label: 'Date' },
    { key: 'start_time', label: 'Time' },
    { key: 'guest_id', label: 'Guest' },
    { key: 'therapist_id', label: 'Therapist' },
    { key: 'massage_type_id', label: 'Service' },
    { key: 'price', label: 'Price' },
    { key: 'status', label: 'Status' },
    { key: 'payment_method', label: 'Payment' },
    { key: 'room_id', label: 'Room' },
  ]},
  { id: 'sales', label: 'POS Transactions', columns: [
    { key: 'created_at', label: 'Date/Time' },
    { key: 'guest_name', label: 'Guest' },
    { key: 'item_name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty' },
    { key: 'net_amount', label: 'Amount' },
    { key: 'payment_method', label: 'Payment' },
    { key: 'sold_by_id', label: 'Staff' },
    { key: 'status', label: 'Status' },
  ]},
  { id: 'inventory', label: 'Inventory Master', columns: [
    { key: 'name', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'stock_quantity', label: 'Stock' },
    { key: 'track_inventory', label: 'Tracking' },
  ]},
  { id: 'staff', label: 'Staff Roster', columns: [
    { key: 'full_name', label: 'Full Name' },
    { key: 'role_name', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'joined_date', label: 'Joined Date' },
    { key: 'salary', label: 'Salary' },
  ]}
];

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  config,
  properties,
  outlets,
  onSave,
  onCancel
}) => {
  const { currentProperty } = useSettings();
  const [name, setName] = useState(config?.name || '');
  const [dataSource, setDataSource] = useState<CustomReportConfig['data_source']>(config?.data_source || 'members');
  const [propertyId, setPropertyId] = useState(config?.property_id || currentProperty?.id || '');
  const [outletId, setOutletId] = useState(config?.outlet_id || '');
  const [columns, setColumns] = useState<CustomReportColumn[]>(config?.columns || []);
  const [groupBy, setGroupBy] = useState(config?.group_by || '');
  const [sortBy, setSortBy] = useState(config?.sort_by || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(config?.sort_order || 'asc');
  const [dateRange, setDateRange] = useState<CustomReportConfig['date_range']>(config?.date_range || 'today');
  const [visualizationType, setVisualizationType] = useState<CustomReportConfig['visualization_type']>(config?.visualization_type || 'table');
  const [filters, setFilters] = useState<CustomReportFilter[]>(config?.filters || []);
  const [aggregations, setAggregations] = useState<CustomReportAggregation[]>(config?.aggregations || []);

  const availableOutlets = useMemo(() => {
    return outlets.filter(o => o.property_id === propertyId);
  }, [outlets, propertyId]);

  // Initialize columns when data source changes
  useEffect(() => {
    if (!config || dataSource !== config.data_source) {
      const source = DATA_SOURCES.find(s => s.id === dataSource);
      if (source) {
        setColumns(source.columns.map(c => ({ ...c, visible: true })));
        setFilters([]);
        setAggregations([]);
      }
    }
  }, [dataSource, config]);

  const availableColumns = useMemo(() => {
    return DATA_SOURCES.find(s => s.id === dataSource)?.columns || [];
  }, [dataSource]);

  const handleToggleColumn = (key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newColumns.length) {
      [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
      setColumns(newColumns);
    }
  };

  const handleSave = () => {
    if (!name) {
      toast.error('Please provide a report name');
      return;
    }
    if (columns.filter(c => c.visible).length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    onSave({
      name,
      data_source: dataSource,
      columns,
      group_by: groupBy,
      sort_by: sortBy,
      sort_order: sortOrder,
      filters,
      aggregations,
      date_range: dateRange,
      visualization_type: visualizationType,
      property_id: propertyId || undefined,
      outlet_id: outletId || undefined,
      created_by: 'admin' // Should be dynamic in real app
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-600" /> General Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Report Name</label>
              <Input 
                placeholder="e.g. Monthly VIP Sales Audit" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="h-12 rounded-2xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Outlet</label>
                <Select 
                  value={outletId} 
                  onChange={e => setOutletId(e.target.value)}
                  className="h-12 rounded-2xl text-xs font-bold"
                >
                  <option value="">All Outlets</option>
                  {availableOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</label>
                <Select 
                  value={dateRange} 
                  onChange={e => setDateRange(e.target.value as any)}
                  className="h-12 rounded-2xl text-xs font-bold"
                >
                  <option value="today">Today</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visualization</label>
                <Select 
                  value={visualizationType} 
                  onChange={e => setVisualizationType(e.target.value as any)}
                  className="h-12 rounded-2xl text-xs font-bold"
                >
                  <option value="table">Table</option>
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Intelligence Source</label>
              <div className="grid grid-cols-2 gap-2">
                {DATA_SOURCES.map(source => (
                  <button
                    key={source.id}
                    onClick={() => setDataSource(source.id as any)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                      dataSource === source.id 
                        ? 'bg-indigo-50 border-indigo-600 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      dataSource === source.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {source.id === 'members' && <Users className="w-4 h-4" />}
                      {source.id === 'bookings' && <FileText className="w-4 h-4" />}
                      {source.id === 'sales' && <Plus className="w-4 h-4" />}
                      {source.id === 'inventory' && <Database className="w-4 h-4" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tight ${
                      dataSource === source.id ? 'text-indigo-900' : 'text-slate-500'
                    }`}>{source.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column Design */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Layout className="w-4 h-4 text-indigo-600" /> Architectural Design (Columns)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {columns.map((col, idx) => (
                <div 
                  key={col.key}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    col.visible ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button 
                        onClick={() => handleMoveColumn(idx, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleMoveColumn(idx, 'down')}
                        disabled={idx === columns.length - 1}
                        className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tight text-slate-700">{col.label}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{col.key}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleColumn(col.key)}
                    className={`p-2 rounded-xl transition-all ${
                      col.visible ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sorting & Grouping */}
      <Card className="rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" /> Sorting & Grouping Logic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group By</label>
              <Select 
                value={groupBy} 
                onChange={e => setGroupBy(e.target.value)}
                className="h-12 rounded-2xl text-xs font-bold"
              >
                <option value="">No Grouping</option>
                {columns.filter(c => c.visible).map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sort By</label>
              <Select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                className="h-12 rounded-2xl text-xs font-bold"
              >
                <option value="">Default Sorting</option>
                {columns.filter(c => c.visible).map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sort Order</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortOrder('asc')}
                  className={`flex-1 h-12 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                    sortOrder === 'asc' ? 'bg-indigo-50 border-indigo-600 text-indigo-900' : 'bg-white border-slate-100 text-slate-400'
                  }`}
                >
                  Ascending
                </button>
                <button
                  onClick={() => setSortOrder('desc')}
                  className={`flex-1 h-12 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                    sortOrder === 'desc' ? 'bg-indigo-50 border-indigo-600 text-indigo-900' : 'bg-white border-slate-100 text-slate-400'
                  }`}
                >
                  Descending
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filtering & Aggregation */}
      <Card className="rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" /> Advanced Filtering & Aggregation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters UI */}
          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filters</label>
             {filters.map((filter, idx) => (
                <div key={idx} className="flex gap-2">
                    <Select value={filter.column} onChange={e => {
                        const newFilters = [...filters];
                        newFilters[idx].column = e.target.value;
                        setFilters(newFilters);
                    }} className="h-10 rounded-xl text-xs">
                        {columns.filter(c => c.visible).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Select>
                    <Select value={filter.operator} onChange={e => {
                        const newFilters = [...filters];
                        newFilters[idx].operator = e.target.value as any;
                        setFilters(newFilters);
                    }} className="h-10 rounded-xl text-xs">
                        <option value="eq">=</option>
                        <option value="neq">!=</option>
                        <option value="gt">&gt;</option>
                        <option value="lt">&lt;</option>
                        <option value="contains">contains</option>
                    </Select>
                    <Input value={filter.value} onChange={e => {
                        const newFilters = [...filters];
                        newFilters[idx].value = e.target.value;
                        setFilters(newFilters);
                    }} className="h-10 rounded-xl text-xs" />
                    <Button onClick={() => setFilters(filters.filter((_, i) => i !== idx))} className="bg-red-50 text-red-600 h-10 w-10 p-0 rounded-xl"><Trash2 className="w-4 h-4"/></Button>
                </div>
             ))}
             <Button onClick={() => setFilters([...filters, { column: columns.filter(c => c.visible)[0]?.key || '', operator: 'eq', value: '' }])} className="text-xs h-10 rounded-xl">Add Filter</Button>
          </div>
          
          {/* Aggregations UI */}
          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Aggregations</label>
             {aggregations.map((agg, idx) => (
                <div key={idx} className="flex gap-2">
                    <Select value={agg.column} onChange={e => {
                        const newAggs = [...aggregations];
                        newAggs[idx].column = e.target.value;
                        setAggregations(newAggs);
                    }} className="h-10 rounded-xl text-xs">
                        {columns.filter(c => c.visible).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Select>
                    <Select value={agg.function} onChange={e => {
                        const newAggs = [...aggregations];
                        newAggs[idx].function = e.target.value as any;
                        setAggregations(newAggs);
                    }} className="h-10 rounded-xl text-xs">
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="count">Count</option>
                    </Select>
                    <Button onClick={() => setAggregations(aggregations.filter((_, i) => i !== idx))} className="bg-red-50 text-red-600 h-10 w-10 p-0 rounded-xl"><Trash2 className="w-4 h-4"/></Button>
                </div>
             ))}
             <Button onClick={() => setAggregations([...aggregations, { column: columns.filter(c => c.visible)[0]?.key || '', function: 'sum' }])} className="text-xs h-10 rounded-xl">Add Aggregation</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="h-12 px-8 rounded-2xl font-black text-xs uppercase tracking-widest"
        >
          Discard Changes
        </Button>
        <Button 
          onClick={handleSave}
          className="h-12 px-8 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
        >
          Authorize Report Design
        </Button>
      </div>
    </div>
  );
};
