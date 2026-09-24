import React, { useMemo } from 'react';
import { Company, Property, Outlet } from '../../types';
import { Building2, Store, ChevronRight, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth, isSuperAdminRole } from '../../contexts/AuthContext';

interface HierarchySelectorProps {
  companies: Company[];
  properties: Property[];
  outlets: Outlet[];
  selectedCompanyId: string;
  selectedPropertyId: string;
  selectedOutletId: string;
  onSelectCompany: (companyId: string) => void;
  onSelectProperty: (propertyId: string) => void;
  onSelectOutlet: (outletId: string) => void;
  isConnected?: boolean;
}

export const HierarchySelector: React.FC<HierarchySelectorProps> = ({
  companies,
  properties,
  outlets,
  selectedCompanyId,
  selectedPropertyId,
  selectedOutletId,
  onSelectCompany,
  onSelectProperty,
  onSelectOutlet,
  isConnected = false
}) => {
  const { user } = useAuth();
  const isAdmin = isSuperAdminRole(user?.role_id);

  // Filter properties based on selected company (or allow all properties for now)
  const availableProperties = properties;

  // Filter outlets based on selected property and user permissions
  const availableOutlets = useMemo(() => {
    if (!selectedPropertyId) return [];
    const propertyOutlets = outlets.filter(o => o.property_id === selectedPropertyId);
    if (isAdmin) return propertyOutlets;
    return propertyOutlets.filter(o => user?.allowed_outlets?.includes(o.id));
  }, [outlets, selectedPropertyId, isAdmin, user?.allowed_outlets]);

  const currentCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
  const currentProperty = properties.find(p => p.id === selectedPropertyId);
  const currentOutlet = outlets.find(o => o.id === selectedOutletId);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 md:p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                Enterprise Scope Selection
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Isolated Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Select Company → Property → Profile/Outlet to access dedicated WhatsApp data.
            </p>
          </div>
        </div>

        {/* Live Scope Indicator Badge */}
        {currentOutlet && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-semibold self-start lg:self-center">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <span className="text-slate-400">{currentCompany?.name.split(' ')[0]}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-slate-700">{currentProperty?.name || 'Property'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                {currentOutlet.name}
              </span>
            </div>
            <div className="h-3 w-px bg-slate-200 mx-0.5" />
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className={`text-[11px] font-bold ${isConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isConnected ? 'API Active' : 'Sandbox Ready'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3-Step Cascading Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Step 1: Company */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-black">
              1
            </span>
            Select Company
          </label>
          <div className="relative">
            <select
              value={selectedCompanyId}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  🏢 {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>

        {/* Step 2: Property */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-black">
              2
            </span>
            Select Property
          </label>
          <div className="relative">
            <select
              value={selectedPropertyId}
              onChange={(e) => onSelectProperty(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="" disabled>Choose Property...</option>
              {availableProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  🏨 {p.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>

        {/* Step 3: Profile / Outlet */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-black">
              3
            </span>
            Select Profile / Outlet
          </label>
          <div className="relative">
            <select
              value={selectedOutletId}
              onChange={(e) => onSelectOutlet(e.target.value)}
              disabled={!selectedPropertyId || availableOutlets.length === 0}
              className={`w-full border text-xs font-bold rounded-2xl px-4 py-3 appearance-none transition-all cursor-pointer ${
                !selectedPropertyId || availableOutlets.length === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
              }`}
            >
              <option value="" disabled>Choose Profile / Outlet...</option>
              {availableOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  📍 {o.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Permission Restriction Notice for Staff Users */}
      {!isAdmin && availableOutlets.length === 0 && selectedPropertyId && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-800 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            You do not have access rights assigned for outlets in this property. Please switch to an authorized property.
          </span>
        </div>
      )}
    </div>
  );
};
