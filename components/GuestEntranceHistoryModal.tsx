import React, { useMemo } from 'react';
import { EntranceFeeConsent } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { 
  X, 
  Calendar, 
  User, 
  FileSignature, 
  Printer, 
  Clock, 
  ShieldCheck, 
  Phone, 
  Mail, 
  CreditCard, 
  Store, 
  History,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

interface GuestEntranceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestConsent: EntranceFeeConsent;
  allConsents: EntranceFeeConsent[];
  onPrint: (consent: EntranceFeeConsent) => void;
  onNewConsentForGuest?: (guestConsent: EntranceFeeConsent) => void;
}

export const GuestEntranceHistoryModal: React.FC<GuestEntranceHistoryModalProps> = ({
  isOpen,
  onClose,
  guestConsent,
  allConsents,
  onPrint,
  onNewConsentForGuest
}) => {
  const { outlets, properties } = useSettings();

  // Find all history records matching this guest by name, QID, phone, or email
  const guestHistory = useMemo(() => {
    if (!guestConsent) return [];
    
    const targetName = guestConsent.guest_name.trim().toLowerCase();
    const targetQid = guestConsent.qid_passport?.trim().toLowerCase();
    const targetPhone = guestConsent.phone?.trim().toLowerCase();
    const targetEmail = guestConsent.email?.trim().toLowerCase();

    return allConsents.filter(c => {
      const cName = c.guest_name.trim().toLowerCase();
      const cQid = c.qid_passport?.trim().toLowerCase();
      const cPhone = c.phone?.trim().toLowerCase();
      const cEmail = c.email?.trim().toLowerCase();

      // Exact match on QID or phone or email if provided
      if (targetQid && cQid && targetQid === cQid) return true;
      if (targetPhone && cPhone && targetPhone === cPhone) return true;
      if (targetEmail && cEmail && targetEmail === cEmail) return true;

      // Name match
      return cName === targetName;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [guestConsent, allConsents]);

  if (!isOpen || !guestConsent) return null;

  const totalVisits = guestHistory.length;
  const firstVisit = guestHistory[guestHistory.length - 1]?.date;
  const lastVisit = guestHistory[0]?.date;

  // Package frequencies
  const packageCounts: Record<string, number> = {};
  guestHistory.forEach(c => {
    const pkg = c.item_name || 'Standard Entrance Fee';
    packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
  });

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 relative">
          <div className="flex justify-between items-start pr-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <History className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Guest Entrance & Waiver History</h2>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                Complete visit timeline and signed consent logs for guest
              </p>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Guest Quick Bio Card */}
          <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Guest Name</span>
              <span className="text-sm font-black text-emerald-400">{guestConsent.guest_name}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">QID / Passport</span>
              <span className="text-xs font-bold text-slate-200">{guestConsent.qid_passport || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Visits</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[11px]">{totalVisits}</span>
                {totalVisits === 1 ? 'Visit Logged' : 'Visits Logged'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Latest Visit</span>
              <span className="text-xs font-bold text-slate-200">{lastVisit ? format(new Date(lastVisit), 'dd MMM yyyy') : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Guest Contact Details & Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Phone</span>
                <span className="text-xs font-bold text-slate-800">{guestConsent.phone || 'Not provided'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Email</span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[180px] block">{guestConsent.email || 'Not provided'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">First Known Visit</span>
                <span className="text-xs font-bold text-slate-800">{firstVisit ? format(new Date(firstVisit), 'dd MMM yyyy') : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Access Package Preference Tags */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Access Packages & Passes Used</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(packageCounts).map(([pkgName, count]) => (
                <div key={pkgName} className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{pkgName}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-200 text-indigo-800 text-[10px] font-black">{count}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" /> Entrance Log Timeline ({guestHistory.length})
              </h4>
              {onNewConsentForGuest && (
                <button
                  onClick={() => {
                    onClose();
                    onNewConsentForGuest(guestConsent);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider transition-all"
                >
                  + Log New Visit For Guest
                </button>
              )}
            </div>

            <div className="space-y-3">
              {guestHistory.map((item, index) => {
                const outletName = outlets?.find(o => o.id === item.outlet_id)?.name || 'Facility Outlet';
                
                return (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 uppercase">
                          {format(new Date(item.date), 'EEEE, dd MMMM yyyy')}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase tracking-wider">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          {outletName}
                        </span>
                        <span>•</span>
                        <span className="text-indigo-600 font-bold">
                          {item.item_name || 'Entrance Fee Pass'}
                        </span>
                        {item.notes && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 italic max-w-xs truncate">{item.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                      {item.guest_signature ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Waiver Signed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/60">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          No Signature
                        </div>
                      )}

                      <button
                        onClick={() => onPrint(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Waiver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Recorded in Supabase Security Registry
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Close History
          </button>
        </div>

      </div>
    </div>
  );
};
