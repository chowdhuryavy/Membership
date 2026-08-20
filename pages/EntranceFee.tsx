import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceConsentsList } from '../components/EntranceConsentsList';
import { EntranceFeeConsentModal } from '../components/EntranceFeeConsentModal';
import { Button } from '../components/ui';
import { Ticket, Plus, Building2, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EntranceFee() {
    const { user, isSuperAdmin } = useAuth();
    const { currentOutlet, currentProperty, outlets = [], hasPermission } = useSettings();

    const canView = user && hasPermission(user.role_id, 'entrance_fee:view');
    const canCreate = user && hasPermission(user.role_id, 'entrance_fee:create');

    const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    if (!canView) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
                    <p className="text-slate-500 mt-2">You don't have permission to view Entrance Fees.</p>
                </div>
            </div>
        );
    }

    const allowedOutletsInProperty = useMemo(() => {
        if (!currentProperty || !user || !outlets) return [];
        if (isSuperAdmin || user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin') {
            return outlets.filter(o => o.property_id === currentProperty.id);
        }
        return outlets.filter(o => 
            o.property_id === currentProperty.id && 
            user.allowed_outlets?.includes(o.id)
        );
    }, [currentProperty, user, outlets, isSuperAdmin]);

    const canSwitchScope = Boolean(user && allowedOutletsInProperty.length > 1);

    const defaultInitialData = useMemo(() => ({ guestName: '' }), []);

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Top Bar Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/80">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                            <Ticket className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Entrance Fee & Day Pass</h1>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 pl-1">
                        Manage guest facility day passes, liability waivers, and entrance fee consents.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Property / Outlet Scope Switcher */}
                    {canSwitchScope && (
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setViewScope('outlet')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    viewScope === 'outlet'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Store className="w-3.5 h-3.5" />
                                {currentOutlet?.name || 'Outlet'}
                            </button>
                            <button
                                onClick={() => setViewScope('property')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    viewScope === 'property'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                All Property
                            </button>
                        </div>
                    )}

                    {canCreate && (
                        <Button
                            onClick={() => setShowConsentModal(true)}
                            className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <Plus className="w-4 h-4 mr-2" /> New Consent Form
                        </Button>
                    )}
                </div>
            </div>

            {/* Consents List Component */}
            <EntranceConsentsList 
                key={refreshKey}
                propertyId={currentProperty?.id} 
                outletId={viewScope === 'property' ? 'all' : currentOutlet?.id} 
            />

            {/* Modal */}
            {showConsentModal && (
                <EntranceFeeConsentModal
                    isOpen={true}
                    onClose={() => setShowConsentModal(false)}
                    onSuccess={() => {
                        setShowConsentModal(false);
                        setRefreshKey(prev => prev + 1);
                        toast.success('Entrance Fee Consent saved successfully!');
                    }}
                    initialData={defaultInitialData}
                />
            )}
        </div>
    );
}
