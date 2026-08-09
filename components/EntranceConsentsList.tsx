import React, { useState, useEffect } from 'react';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceFeeConsent } from '../types';
import { Search, Calendar, FileSignature, Download, Printer, Edit3, Trash2, AlertTriangle, X, History, BarChart3, LayoutGrid, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { EntranceFeeConsentModal } from './EntranceFeeConsentModal';
import { GuestEntranceHistoryModal } from './GuestEntranceHistoryModal';
import { EntranceFeeReports } from './EntranceFeeReports';
import toast from 'react-hot-toast';

export const EntranceConsentsList = ({ propertyId, outletId }: { propertyId?: string, outletId?: string }) => {
    const { currentProperty, currentOutlet, properties, outlets, settings, hasPermission, user } = useSettings();
    const [consents, setConsents] = useState<EntranceFeeConsent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState<'registry' | 'reports'>('registry');
    const [editingConsent, setEditingConsent] = useState<EntranceFeeConsent | null>(null);
    const [deletingConsent, setDeletingConsent] = useState<EntranceFeeConsent | null>(null);
    const [selectedGuestHistoryConsent, setSelectedGuestHistoryConsent] = useState<EntranceFeeConsent | null>(null);
    const [newConsentGuestData, setNewConsentGuestData] = useState<Partial<EntranceFeeConsent> | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = hasPermission(user?.role_id || '', 'entrance_fee:edit') || hasPermission(user?.role_id || '', 'sales:edit') || user?.role_id === 'admin';
    const canDelete = hasPermission(user?.role_id || '', 'entrance_fee:delete') || hasPermission(user?.role_id || '', 'sales:delete') || user?.role_id === 'admin';

    const loadConsents = async () => {
        setLoading(true);
        try {
            const idToUse = outletId && outletId !== 'all' ? outletId : propertyId;
            const isProperty = !outletId || outletId === 'all';
            const data = await db.getEntranceFeeConsents(idToUse, isProperty);
            setConsents(data);
        } catch (err) {
            console.error('Failed to load consents', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConsents();
    }, [propertyId, outletId]);

    const handleDelete = async (id: string) => {
        setIsDeleting(true);
        try {
            await db.deleteEntranceFeeConsent(id);
            setConsents(prev => prev.filter(c => c.id !== id));
            toast.success('Entrance Fee Consent record deleted successfully!');
            setDeletingConsent(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete consent record.');
        } finally {
            setIsDeleting(false);
        }
    };

    const filtered = consents.filter(c => 
        c.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.qid_passport && c.qid_passport.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const isUnsplashDefault = (url?: string) => !url || url.includes('images.unsplash.com/photo-1540555700478-4be289fbecef');

    const handlePrint = (consent: EntranceFeeConsent) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Resolve outlet and property details for this specific consent
        const matchedOutlet = outlets?.find(o => o.id === consent.outlet_id) || currentOutlet || outlets?.[0];
        const matchedProperty = properties?.find(p => p.id === matchedOutlet?.property_id) || currentProperty || properties?.[0];

        const propertyName = matchedProperty?.name || currentProperty?.name || settings?.name || '';
        const outletName = matchedOutlet?.name || currentOutlet?.name || '';

        const rawLogo = 
            (matchedOutlet?.logo_url && !isUnsplashDefault(matchedOutlet.logo_url) ? matchedOutlet.logo_url : null) ||
            (matchedProperty?.logo_url && !isUnsplashDefault(matchedProperty.logo_url) ? matchedProperty.logo_url : null) ||
            (currentProperty?.logo_url && !isUnsplashDefault(currentProperty.logo_url) ? currentProperty.logo_url : null) ||
            (settings?.logo_url && !isUnsplashDefault(settings.logo_url) ? settings.logo_url : null) ||
            matchedOutlet?.logo_url || matchedProperty?.logo_url || currentProperty?.logo_url || settings?.logo_url || '';

        const logoUrl = isUnsplashDefault(rawLogo) ? '' : rawLogo;
        const address = matchedOutlet?.address?.trim() || matchedProperty?.address?.trim() || currentOutlet?.address?.trim() || settings?.address?.trim() || '';
        const phone = matchedOutlet?.phone?.trim() || matchedProperty?.phone?.trim() || currentOutlet?.phone?.trim() || settings?.phone?.trim() || '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Entrance Fee Consent - ${consent.guest_name}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
                        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
                        .header-left { display: flex; align-items: center; gap: 16px; }
                        .header-logo { max-height: 65px; max-width: 180px; object-fit: contain; }
                        .header-brand { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: -0.5px; line-height: 1.1; }
                        .header-outlet { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #059669; tracking: 1px; margin-top: 3px; }
                        .header-meta { font-size: 10px; color: #64748b; font-weight: 600; text-align: right; line-height: 1.4; }
                        .doc-title { color: #059669; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
                        .subtitle { font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 25px; letter-spacing: 1.5px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
                        .field { margin-bottom: 12px; }
                        .label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
                        .value { font-size: 13px; font-weight: 600; }
                        .waiver { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; font-size: 11px; line-height: 1.6; margin-bottom: 30px; }
                        .waiver-title { font-weight: 900; text-transform: uppercase; margin-bottom: 10px; color: #0f172a; font-size: 12px; letter-spacing: 0.5px; }
                        .signature-box { border-top: 1px solid #cbd5e1; padding-top: 15px; width: 280px; }
                        .sig-img { max-width: 100%; max-height: 90px; margin-bottom: 8px; }
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        <div class="header-left">
                            ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="Logo" />` : ''}
                            <div>
                                <div class="header-brand">${propertyName || 'PROPERTY & HEALTH CLUB'}</div>
                                <div class="header-outlet">${outletName || 'HEALTH CLUB / SPA'}</div>
                            </div>
                        </div>
                        <div class="header-meta">
                            ${address ? `<div>${address}</div>` : ''}
                            ${phone ? `<div>Tel: ${phone}</div>` : ''}
                        </div>
                    </div>

                    <div class="doc-title">Entrance Fee Consent</div>
                    <div class="subtitle">Guest Waiver & Liability Release Form</div>
                    
                    <div class="grid">
                        <div class="field">
                            <div class="label">Guest Name</div>
                            <div class="value">${consent.guest_name}</div>
                        </div>
                        <div class="field">
                            <div class="label">Date</div>
                            <div class="value">${format(new Date(consent.date), 'dd MMM yyyy')}</div>
                        </div>
                        <div class="field">
                            <div class="label">QID / Passport</div>
                            <div class="value">${consent.qid_passport || 'N/A'}</div>
                        </div>
                        <div class="field">
                            <div class="label">Contact</div>
                            <div class="value">${consent.phone || ''} ${consent.email ? '- ' + consent.email : ''}</div>
                        </div>
                    </div>

                    ${consent.item_name ? `
                    <div class="field" style="margin-bottom: 20px;">
                        <div class="label">Access Type / Package</div>
                        <div class="value">${consent.item_name}</div>
                    </div>
                    ` : ''}

                    <div class="waiver">
                        <div class="waiver-title">Waiver and Release of Liability Terms</div>
                        <ol style="margin: 0; padding-left: 18px;">
                            <li style="margin-bottom: 6px;"><strong>Assumption of Inherent Risk:</strong> I acknowledge and understand that the use of health club facilities, including the swimming pool, thermal suites, sauna, steam rooms, gym equipment, and participation in exercise activities, involves inherent risks of physical injury, illness, or property damage. I voluntarily participate and assume full responsibility for all risks.</li>
                            <li style="margin-bottom: 6px;"><strong>Physical Fitness & Medical Condition:</strong> I declare that I am in good health, physically sound, and suffer from no medical condition, impairment, or illness that would prevent my safe participation or endanger myself or others while utilizing the health club facilities.</li>
                            <li style="margin-bottom: 6px;"><strong>Compliance with Rules & Safety Regulations:</strong> I agree to strictly abide by all posted health club guidelines, pool depth markers, facility operating hours, proper athletic or swimwear attire policies, and instructions issued by life safety team members and staff.</li>
                            <li style="margin-bottom: 6px;"><strong>Personal Belongings & Valuables:</strong> I acknowledge that the facility management, property owners, and staff are not responsible or liable for any lost, stolen, misplaced, or damaged personal belongings, money, electronics, or valuables brought onto the premises.</li>
                            <li style="margin-bottom: 6px;"><strong>Indemnification & Legal Release:</strong> I hereby release, waive, and forever discharge facility management, property owners, officers, and staff from any and all claims, liabilities, demands, losses, or legal causes of action arising out of any injury, loss, or damage occurring during my visit.</li>
                        </ol>
                    </div>

                    <div class="signature-box">
                        ${consent.guest_signature ? `<img src="${consent.guest_signature}" class="sig-img" alt="Signature" />` : '<div style="height: 90px;"></div>'}
                        <div class="label">Guest Signature</div>
                        <div class="value">${consent.guest_name}</div>
                    </div>
                    
                    <script>
                        window.onload = () => window.print();
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold text-xs animate-pulse">Loading consents...</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* View Mode Switcher Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setActiveView('registry')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeView === 'registry'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Consents Registry ({consents.length})
                    </button>
                    <button
                        onClick={() => setActiveView('reports')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeView === 'reports'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Daily & Monthly Reports
                    </button>
                </div>

                {activeView === 'registry' && (
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by guest name, QID, phone..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border-none text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                        />
                    </div>
                )}
            </div>

            {/* Reports View */}
            {activeView === 'reports' && (
                <EntranceFeeReports 
                    consents={consents}
                    propertyId={propertyId}
                    outletId={outletId}
                    onPrintWaiver={handlePrint}
                />
            )}

            {/* Cards Grid Registry View */}
            {activeView === 'registry' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => setSelectedGuestHistoryConsent(c)}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col hover:border-emerald-300 hover:shadow-lg transition-all group cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">
                                            {c.guest_name}
                                        </h3>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                                            <History className="w-3 h-3" /> History
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-400" /> {format(new Date(c.date), 'dd MMM yyyy')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button 
                                        onClick={() => handlePrint(c)}
                                        className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                        title="Print Consent Waiver"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                    {canEdit && (
                                        <button 
                                            onClick={() => setEditingConsent(c)}
                                            className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                            title="Edit Consent Record"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button 
                                            onClick={() => setDeletingConsent(c)}
                                            className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                            title="Delete Consent Record"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 mb-4 flex-1">
                                {c.item_name && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-[9px] font-black text-slate-400 uppercase tracking-widest">Access</span>
                                        <span className="font-bold text-indigo-700">{c.item_name}</span>
                                    </div>
                                )}
                                {c.qid_passport && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-[9px] font-black text-slate-400 uppercase tracking-widest">QID/Pass</span>
                                        <span className="font-medium text-slate-600">{c.qid_passport}</span>
                                    </div>
                                )}
                                {(c.phone || c.email) && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact</span>
                                        <span className="font-medium text-slate-600">{c.phone} {c.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                {c.guest_signature ? (
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                                        <FileSignature className="w-3 h-3" />
                                        Signed Waiver
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg w-fit">
                                        <AlertTriangle className="w-3 h-3" />
                                        No Signature
                                    </div>
                                )}
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    Click for History &rarr;
                                </span>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <FileSignature className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">No Consents Found</h3>
                            <p className="text-xs font-medium text-slate-500 max-w-sm">No entrance fee consents match your current filters. New consents will appear here automatically.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Guest History Modal */}
            {selectedGuestHistoryConsent && (
                <GuestEntranceHistoryModal
                    isOpen={!!selectedGuestHistoryConsent}
                    onClose={() => setSelectedGuestHistoryConsent(null)}
                    guestConsent={selectedGuestHistoryConsent}
                    allConsents={consents}
                    onPrint={handlePrint}
                    onNewConsentForGuest={(g) => {
                        setSelectedGuestHistoryConsent(null);
                        setNewConsentGuestData({
                            guest_name: g.guest_name,
                            phone: g.phone,
                            email: g.email,
                            qid_passport: g.qid_passport,
                            outlet_id: g.outlet_id
                        });
                    }}
                />
            )}

            {/* New Consent Modal for Returning Guest */}
            {newConsentGuestData && (
                <EntranceFeeConsentModal
                    isOpen={!!newConsentGuestData}
                    onClose={() => setNewConsentGuestData(null)}
                    onSuccess={(newObj) => {
                        setConsents(prev => [newObj, ...prev]);
                        setNewConsentGuestData(null);
                        toast.success(`Logged new entrance visit for ${newObj.guest_name}`);
                    }}
                    initialData={newConsentGuestData}
                />
            )}

            {/* Edit Entrance Fee Consent Modal */}
            {editingConsent && (
                <EntranceFeeConsentModal
                    isOpen={!!editingConsent}
                    onClose={() => setEditingConsent(null)}
                    onSuccess={(updated) => {
                        setConsents(prev => prev.map(item => item.id === updated.id ? updated : item));
                        setEditingConsent(null);
                    }}
                    initialData={editingConsent}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deletingConsent && (
                <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2 text-rose-600 font-black text-base uppercase tracking-tight">
                                <AlertTriangle className="w-5 h-5" /> Delete Consent Record
                            </div>
                            <button onClick={() => setDeletingConsent(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            Are you sure you want to delete the entrance fee waiver consent for <strong className="text-slate-900">{deletingConsent.guest_name}</strong> dated <strong className="text-slate-900">{format(new Date(deletingConsent.date), 'dd MMM yyyy')}</strong>? This action will remove the record permanently from Supabase.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeletingConsent(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deletingConsent.id)}
                                disabled={isDeleting}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-200 disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};