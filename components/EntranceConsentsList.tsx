import React, { useState, useEffect } from 'react';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { EntranceFeeConsent } from '../types';
import { Search, Calendar, FileSignature, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';

export const EntranceConsentsList = ({ propertyId, outletId }: { propertyId?: string, outletId?: string }) => {
    const [consents, setConsents] = useState<EntranceFeeConsent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadConsents = async () => {
            setLoading(true);
            try {
                // Determine scope
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
        loadConsents();
    }, [propertyId, outletId]);

    const filtered = consents.filter(c => 
        c.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.qid_passport && c.qid_passport.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrint = (consent: EntranceFeeConsent) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Entrance Fee Consent - ${consent.guest_name}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
                        h1 { color: #059669; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
                        .subtitle { font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 30px; letter-spacing: 2px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .field { margin-bottom: 15px; }
                        .label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
                        .value { font-size: 14px; font-weight: 500; }
                        .waiver { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; font-size: 12px; line-height: 1.6; margin-bottom: 30px; }
                        .waiver-title { font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
                        .signature-box { border-top: 1px solid #e2e8f0; padding-top: 20px; width: 300px; }
                        .sig-img { max-width: 100%; max-height: 100px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <h1>Entrance Fee Consent</h1>
                    <div class="subtitle">Guest Waiver and Release Form</div>
                    
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
                    <div class="field">
                        <div class="label">Access Type / Package</div>
                        <div class="value">${consent.item_name}</div>
                    </div>
                    ` : ''}

                    <div class="waiver">
                        <div class="waiver-title">Waiver and Release of Liability</div>
                        <p>By signing this form, I acknowledge that the use of the health club facilities, including the pool and gym, involves inherent risks. I voluntarily assume all risks associated with participation in any physical activities or use of the facilities.</p>
                        <p>I hereby release, waive, and discharge the management, staff, and owners of the property from any and all liability, claims, demands, or causes of action arising out of any injury, loss, or damage that may occur to me or my property during my visit.</p>
                    </div>

                    <div class="signature-box">
                        ${consent.guest_signature ? `<img src="${consent.guest_signature}" class="sig-img" alt="Signature" />` : '<div style="height: 100px;"></div>'}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by guest name or QID..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border-none text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(c => (
                    <div key={c.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col hover:border-emerald-200 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{c.guest_name}</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {format(new Date(c.date), 'dd MMM yyyy')}
                                </p>
                            </div>
                            <button 
                                onClick={() => handlePrint(c)}
                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4 flex-1">
                            {c.item_name && (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="w-16 text-[9px] font-black text-slate-400 uppercase tracking-widest">Access</span>
                                    <span className="font-bold text-slate-700">{c.item_name}</span>
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

                        <div className="pt-4 border-t border-slate-100">
                            {c.guest_signature ? (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                                    <FileSignature className="w-3 h-3" />
                                    Signed
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg w-fit">
                                    <AlertTriangle className="w-3 h-3" />
                                    No Signature
                                </div>
                            )}
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
        </div>
    );
};